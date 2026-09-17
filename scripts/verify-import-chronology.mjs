// Gate import:chronology:verify — cronologia canônica na importação (compareWeighingEvents:
// data → Cadastro < Manejo < Saída → gravação → id). Cobre: ordem do arquivo irrelevante (mesmo
// resultado com linhas embaralhadas), arquivos separados (Cadastros → Manejos de março → Manejos
// de fevereiro recalcula março), Saídas depois dos Manejos (situação, lote encerrado, movimento),
// mesmo dia Manejo + Saída ordenado por tipo, Saída sem peso por Morte com causa cadastrada.
// Negativos: Manejo depois da Saída, Manejo no dia da Saída, Saída com lançamento posterior, mesma
// data com pesos diferentes no arquivo, Morte sem causa, causa não cadastrada.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { brandService, breedService, deathCauseService } from '../src/modules/catalog/application/registryServices.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { ROW_STATUS, analyzeImport, applyImport } from '../src/modules/import/application/importService.js';

const csv = (...lines) => lines.join('\r\n');
const TS = '2026-01-01T00:00:00.000Z';

async function freshBase() {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  await brandService.create(null, { nome: 'ABC' });
  await breedService.create(null, { nome: 'Nelore' });
  await deathCauseService.create(null, { nome: 'Raio', categoria: 'Acidente' });
  await db.table('apartacoes').add({ id: 'ap-1', empresa_id: 'local', nome_apartacao: 'Recria', ativo: true, created_at: TS, updated_at: TS, deleted_at: null });
  await db.table('loteApartacoes').bulkAdd([
    { id: 'lote-a', empresa_id: 'local', apartacao_id: 'ap-1', nome_lote: 'Lote A', situacao: 'ABERTO', ativo: true, created_at: TS, updated_at: TS, deleted_at: null },
    { id: 'lote-b', empresa_id: 'local', apartacao_id: 'ap-1', nome_lote: 'Lote B', situacao: 'ABERTO', ativo: true, created_at: TS, updated_at: TS, deleted_at: null },
  ]);
  return db;
}

const seriesOf = async (db, numero) => {
  const animal = (await db.table('animais').toArray()).find((row) => row.numero_animal === numero && !row.deleted_at);
  const rows = (await weighingService.listEntries({ animalId: animal.id }));
  return { animal, rows: rows.sort((l, r) => l.data_pesagem.localeCompare(r.data_pesagem) || String(l.created_date).localeCompare(String(r.created_date))) };
};
const project = (rows) => rows.map((row) => [row.data_pesagem, row.tipo_manejo, row.peso, row.data_anterior ?? null, row.peso_anterior ?? null, row.dias ?? null, row.ganho ?? null, row.gmd ?? null]);
const importOk = async (text, type, rules = {}) => {
  const plan = await analyzeImport({ text, type, rules });
  assert.equal(plan.blocking, false, `${type}: ${JSON.stringify(plan.rows.filter((row) => row.status !== ROW_STATUS.NOVO && row.status !== ROW_STATUS.JA_EXISTE))}`);
  return { plan, result: await applyImport(plan) };
};

// 1. Ordem do arquivo irrelevante: o mesmo histórico em duas ordens dá a mesma série.
const header = 'Brinco;Marca;Sexo;Data;Peso;Apartação;Lote';
const ordered = ['1;ABC;M;01/01/2026;200;Recria;Lote A', '1;ABC;M;01/02/2026;230;Recria;Lote A', '1;ABC;M;03/03/2026;262;Recria;Lote B', '1;ABC;M;01/04/2026;290;;'];
const shuffled = [ordered[2], ordered[3], ordered[0], ordered[1]];
const results = [];
for (const lines of [ordered, shuffled]) {
  const db = await freshBase();
  const { plan } = await importOk(csv(header, ...lines), 'HISTORICO');
  assert.deepEqual(plan.rows.filter((row) => row.eventType === 'Cadastro').map((row) => row.data), ['2026-01-01'], 'um único Cadastro: a data mais antiga');
  const { animal, rows } = await seriesOf(db, '1');
  results.push(project(rows));
  assert.equal(animal.lote_atual_id, 'lote-b', 'lote atual = último evento com lote');
  const stays = (await db.table('animalLotes').where('animal_id').equals(animal.id).toArray()).filter((row) => !row.deleted_at).sort((l, r) => l.inicio.localeCompare(r.inicio));
  assert.deepEqual(stays.map((row) => [row.lote_id, row.inicio, row.fim]), [['lote-a', '2026-01-01', '2026-03-03'], ['lote-b', '2026-03-03', null]]);
  const movements = (await db.table('movimentosAnimais').where('animal_id').equals(animal.id).toArray()).map((row) => [row.tipo, row.data_evento, row.lote_origem_id, row.lote_destino_id]).sort((l, r) => l[1].localeCompare(r[1]));
  assert.deepEqual(movements, [['Entrada', '2026-01-01', null, 'lote-a'], ['Mudança de lote', '2026-03-03', 'lote-a', 'lote-b']]);
  assert.equal((await logicalIntegrity()).issues.length, 0);
}
assert.deepEqual(results[0], results[1], 'NEGATIVO da ordem: arquivo embaralhado produz a mesma série');
assert.deepEqual(results[0][2], ['2026-03-03', 'Manejo', 262, '2026-02-01', 230, 30, 32, 1.067]);
// Saída depois do histórico encerra a permanência no lote e zera o lote atual.
{
  const current = await storage.ensureReady();
  await importOk(csv('Brinco;Marca;Data;Motivo;Peso', '1;ABC;10/04/2026;Venda;300'), 'SAIDAS');
  const { animal } = await seriesOf(current, '1');
  assert.equal(animal.situacao, 'VENDIDO');
  assert.equal(animal.lote_atual_id, null, 'saída zera o lote atual');
  const closed = (await current.table('animalLotes').where('animal_id').equals(animal.id).toArray()).filter((row) => !row.deleted_at).sort((l, r) => l.inicio.localeCompare(r.inicio));
  assert.deepEqual(closed.map((row) => [row.lote_id, row.fim]), [['lote-a', '2026-03-03'], ['lote-b', '2026-04-10']], 'saída encerra o lote');
  assert.equal((await logicalIntegrity()).issues.length, 0);
}

// 2. Arquivos separados: Cadastros → Manejos de março → Manejos de fevereiro (retroativo).
let db = await freshBase();
await importOk(csv('Brinco;Marca;Sexo;Data;Peso', '10;ABC;M;05/01/2026;180', '11;ABC;M;06/01/2026;190'), 'CADASTROS', { categoryMode: 'PLANILHA' });
await importOk(csv('Brinco;Marca;Data;Peso', '10;ABC;05/03/2026;240', '11;ABC;06/03/2026;250'), 'MANEJOS');
let s10 = await seriesOf(db, '10');
assert.deepEqual(project(s10.rows)[1], ['2026-03-05', 'Manejo', 240, '2026-01-05', 180, 59, 60, 1.017], 'março contra o Cadastro');
const { plan: februaryPlan, result: february } = await importOk(csv('Brinco;Marca;Data;Peso', '10;ABC;04/02/2026;215', '11;ABC;05/02/2026;220'), 'MANEJOS');
assert.equal(februaryPlan.summary.eventosRecalculados, 2, 'dry-run avisa os 2 Manejos de março que mudam');
assert.equal(february.eventosRecalculados, 2);
assert.equal(february.seriesRecalculadas, 2, 'só as séries afetadas');
s10 = await seriesOf(db, '10');
assert.deepEqual(project(s10.rows), [
  ['2026-01-05', 'Cadastro', 180, null, null, null, null, null],
  ['2026-02-04', 'Manejo', 215, '2026-01-05', 180, 30, 35, 1.167],
  ['2026-03-05', 'Manejo', 240, '2026-02-04', 215, 29, 25, 0.862],
], 'fevereiro recalculou março');
// Reimportar os três arquivos: tudo JÁ EXISTE.
for (const [text, type] of [
  [csv('Brinco;Marca;Sexo;Data;Peso', '10;ABC;M;05/01/2026;180', '11;ABC;M;06/01/2026;190'), 'CADASTROS'],
  [csv('Brinco;Marca;Data;Peso', '10;ABC;05/03/2026;240', '11;ABC;06/03/2026;250'), 'MANEJOS'],
  [csv('Brinco;Marca;Data;Peso', '10;ABC;04/02/2026;215', '11;ABC;05/02/2026;220'), 'MANEJOS'],
]) {
  const replay = await analyzeImport({ text, type });
  assert.deepEqual(replay.rows.map((row) => row.status), [ROW_STATUS.JA_EXISTE, ROW_STATUS.JA_EXISTE], `${type}: reimportação = JÁ EXISTE`);
}

// 3. Saídas depois: Venda no mesmo dia do último Manejo (ordenada depois dele) e Morte sem peso.
const updatedBefore = new Map((await db.table('pesagens').toArray()).map((row) => [row.id, row.updated_at]));
const exits = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Causa da morte;Peso', '10;ABC;05/03/2026;Venda;;241', '11;ABC;10/03/2026;Morte;raio;'), type: 'SAIDAS' });
assert.deepEqual(exits.rows.map((row) => [row.status, row.eventType, row.peso]), [[ROW_STATUS.NOVO, 'Saída', 241], [ROW_STATUS.NOVO, 'Saída', null]]);
const exitResult = await applyImport(exits);
assert.equal(exitResult.saidasCriadas, 2);
s10 = await seriesOf(db, '10');
assert.deepEqual(s10.rows.map((row) => row.tipo_manejo), ['Cadastro', 'Manejo', 'Manejo', 'Saída'], 'mesmo dia: Manejo antes da Saída');
assert.equal(s10.animal.situacao, 'VENDIDO');
assert.equal(s10.animal.data_saida, '2026-03-05');
assert.equal(s10.animal.ultimo_peso_kg, 241);
const s11 = await seriesOf(db, '11');
assert.equal(s11.animal.situacao, 'MORTO');
assert.equal(s11.animal.ultimo_peso_kg, 250, 'Morte sem peso não zera o peso atual');
const death = s11.rows.at(-1);
assert.equal(death.causa_morte, 'Raio');
assert.ok(death.causa_morte_id, 'causa resolvida no cadastro');
assert.equal(death.gmd ?? null, null, 'Saída não recebe derivados');
const movementTypes = (await db.table('movimentosAnimais').toArray()).map((row) => row.tipo).sort();
assert.deepEqual(movementTypes, ['Entrada', 'Entrada', 'Morte', 'Venda']);
for (const row of await db.table('pesagens').toArray()) {
  if (updatedBefore.has(row.id)) assert.equal(row.updated_at, updatedBefore.get(row.id), 'Saída não regrava a série (derivados inalterados)');
}

// 4. Negativos de cronologia.
const afterExit = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '11;ABC;10/03/2026;252', '10;ABC;01/03/2026;239', '10;ABC;05/03/2026;242'), type: 'MANEJOS' });
assert.equal(afterExit.rows[0].status, ROW_STATUS.CONFLITO, 'NEGATIVO: Manejo no dia da Saída');
assert.equal(afterExit.rows[0].messages[0], 'O animal já possui Morte em 2026-03-10; o Manejo de 2026-03-10 não pode entrar.');
assert.equal(afterExit.rows[1].status, ROW_STATUS.NOVO, 'retroativo antes da saída continua permitido');
assert.equal(afterExit.rows[2].status, ROW_STATUS.CONFLITO, 'NEGATIVO: mesmo dia de um Manejo gravado com outro peso');
assert.equal(afterExit.rows[2].messages[0], 'Já existe Manejo em 2026-03-05 com peso 240; a linha informa 242.');
const later = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '10;ABC;06/03/2026;242'), type: 'MANEJOS' });
assert.equal(later.rows[0].status, ROW_STATUS.ERRO, 'NEGATIVO: Manejo depois da Saída (identidade já saiu)');
db = await freshBase();
await importOk(csv('Brinco;Marca;Sexo;Data;Peso', '20;ABC;M;05/01/2026;180', '20;ABC;M;05/02/2026;200'), 'HISTORICO');
const retroExit = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Peso', '20;ABC;01/02/2026;Venda;195'), type: 'SAIDAS' });
assert.equal(retroExit.rows[0].status, ROW_STATUS.CONFLITO, 'NEGATIVO: Saída com lançamento posterior');
assert.equal(retroExit.rows[0].messages[0], 'Existem lançamentos posteriores a 2026-02-01 (Manejo em 2026-02-05). Corrija ou cancele antes da saída retroativa.');
const sameDayConflict = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', '21;ABC;M;05/01/2026;180', '21;ABC;M;05/01/2026;185', '21;ABC;M;05/02/2026;200'), type: 'HISTORICO' });
assert.deepEqual(sameDayConflict.rows.map((row) => row.status), [ROW_STATUS.CONFLITO, ROW_STATUS.CONFLITO, ROW_STATUS.ERRO], 'NEGATIVO: mesma data com pesos diferentes; o resto espera o Cadastro');
const deathChecks = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Causa da morte;Peso', '20;ABC;06/02/2026;Morte;;', '20;ABC;06/02/2026;Morte;Picada;'), type: 'SAIDAS' });
assert.equal(deathChecks.rows[0].status, ROW_STATUS.CONFLITO, 'duas saídas do mesmo animal no arquivo');
const noCause = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Causa da morte;Peso', '20;ABC;06/02/2026;Morte;;'), type: 'SAIDAS' });
assert.equal(noCause.rows[0].messages[0], 'Causa da morte obrigatória para saída por Morte.', 'NEGATIVO: Morte sem causa');
const unknownCause = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Causa da morte;Peso', '20;ABC;06/02/2026;Morte;Picada;'), type: 'SAIDAS' });
assert.equal(unknownCause.rows[0].status, ROW_STATUS.ERRO, 'NEGATIVO: causa não cadastrada');
assert.deepEqual(unknownCause.summary.cadastrosMestresAusentes, [{ store: 'causasMorte', rotulo: 'Causa da morte', nome: 'Picada', linhas: [2] }]);
const noWeightSale = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Peso', '20;ABC;06/02/2026;Venda;'), type: 'SAIDAS' });
assert.equal(noWeightSale.rows[0].messages[0], 'Peso obrigatório para saída por Venda.', 'NEGATIVO: Venda sem peso');
const createCause = await analyzeImport({ text: csv('Brinco;Marca;Data;Motivo;Causa da morte;Peso', '20;ABC;06/02/2026;Morte;Picada;'), type: 'SAIDAS', rules: { createMissingMasters: true } });
assert.equal(createCause.rows[0].status, ROW_STATUS.NOVO);
const created = await applyImport(createCause);
assert.equal(created.cadastrosMestresCriados, 1, 'causa criada só com a opção explícita');
assert.ok(await deathCauseService.resolveByName('Picada'));
assert.equal((await seriesOf(db, '20')).animal.situacao, 'MORTO');
assert.equal((await logicalIntegrity()).issues.length, 0);

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:chronology:verify',
  ok: true,
  cases: ['ordem do arquivo irrelevante', 'Cadastros → Manejos março → Manejos fevereiro recalcula março', 'Saídas depois (Venda no mesmo dia, Morte sem peso)', 'lotes e movimentos pela série mesclada'],
  negativeTests: ['Manejo no dia da Saída', 'Manejo depois da Saída', 'Saída com lançamento posterior', 'mesma data com pesos diferentes', 'duas saídas no arquivo', 'Morte sem causa', 'causa não cadastrada', 'Venda sem peso'],
}, null, 2));
