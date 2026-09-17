// Gate import:reconciliation:verify — conciliação de identidade e histórico (missão §18-§28).
// Casos (base montada pelo caminho oficial do Lançamento, weighingService.createEntry):
//   A — base vazia, Histórico conciliado: evento mais antigo = Cadastro, demais = Manejo, ordem
//       do arquivo irrelevante, derivados recalculados, rastro (importacao_id/fingerprint/auditoria);
//   B — animal existente com Cadastro: tudo vira Manejo; linha igual → JÁ EXISTE; retroativo
//       recalcula o posterior; linha anterior ao Cadastro → CONFLITO (plano bloqueado, zero gravações);
//   C — animal existente SEM Cadastro: Histórico/Cadastros → CONFLITO, Manejos → ERRO;
//   D — ambiguidade 300/ABC × 300/XYZ sem marca no arquivo → AMBÍGUO, gravação recusada, zero gravações;
//   E — identidade por identificador (RFID), por marca_id, por marca normalizada, animal_id
//       explícito ou estrangeiro, SN, e animal vendido com número reaproveitado;
//   F — cadastros mestres ausentes: nunca criados em silêncio; só com createMissingMasters e
//       registry.write (auditados pelo serviço de cadastros) antes dos eventos.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { brandService, breedService, categoryService } from '../src/modules/catalog/application/registryServices.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { ROW_STATUS, analyzeImport, applyImport } from '../src/modules/import/application/importService.js';
import { buildAnimalIdentityIndex, resolveAnimalIdentity } from '../src/modules/import/domain/animalIdentity.js';

const STORES = ['pesagens', 'animais', 'animalIdentificadores', 'movimentosAnimais', 'animalLotes', 'sessoesPesagem', 'auditoria', 'importacoes', 'marcas', 'racas', 'categoriasAnimal'];

await deleteDbForTests();
const db = await storage.ensureReady();
const abc = await brandService.create(null, { nome: 'ABC' });
const xyz = await brandService.create(null, { nome: 'XYZ' });
const nelore = await breedService.create(null, { nome: 'Nelore' });
await categoryService.create(null, { nome: 'Bezerro', sexo_aplicavel: 'M', peso_min_kg: 0, peso_max_kg: 199, ordem: 1 });
await categoryService.create(null, { nome: 'Garrote', sexo_aplicavel: 'M', peso_min_kg: 200, peso_max_kg: 349, ordem: 2 });
await categoryService.create(null, { nome: 'Boi', sexo_aplicavel: 'M', peso_min_kg: 350, ordem: 3 });

const counts = async () => Object.fromEntries(await Promise.all(STORES.map(async (name) => [name, await db.table(name).count()])));
const csv = (...lines) => lines.join('\r\n');
const byLine = (plan) => new Map(plan.rows.map((row) => [row.line, row]));
const register = (numero, marca, data, peso, extra = {}) => weighingService.createEntry({
  empresa_id: 'local', tipo_manejo: 'Cadastro', numero_animal: numero, marca: marca.nome, marca_id: marca.id, sexo: 'M', raca: 'Nelore', raca_id: nelore.id,
  data_pesagem: data, peso, categoria_automatica: true, ...extra,
});
const launch = (animal, tipo, data, peso, extra = {}) => weighingService.createEntry({
  empresa_id: 'local', tipo_manejo: tipo, animal_id: animal.animal_id, numero_animal: animal.numero_animal, marca: animal.marca, data_pesagem: data, peso, ...extra,
});
const rejects = async (promise, code) => {
  let error = null;
  try { await promise; } catch (caught) { error = caught; }
  assert.ok(error, `esperava recusa ${code}`);
  assert.equal(error.code, code, error.message);
  return error;
};

// ---------------------------------------------------------------------------
// Caso A — base vazia, histórico conciliado (ordem do arquivo embaralhada)
// ---------------------------------------------------------------------------
const fileA = csv(
  'Brinco;Marca;Sexo;Raça;Data;Peso;GMD',
  '100;ABC;M;Nelore;01/03/2026;262,5;9,999',
  '100;ABC;M;Nelore;10/01/2026;180;',
  '101;ABC;M;Nelore;15/01/2026;230;',
  '100;ABC;M;Nelore;09/02/2026;220;1,333',
);
const beforeA = await counts();
const planA = await analyzeImport({ text: fileA, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' }, fileName: 'historico-a.csv' });
assert.deepEqual(await counts(), beforeA, 'A: dry-run não grava');
const rowsA = byLine(planA);
assert.equal(planA.blocking, false);
assert.deepEqual({ ...planA.summary, cadastrosMestresAusentes: undefined }, {
  linhasLidas: 4, novos: 4, animaisEncontrados: 0, animaisNovos: 2, cadastros: 2, manejos: 2, saidas: 0, jaExistem: 0, ignoradas: 0,
  duplicidades: 0, ambiguidades: 0, conflitos: 0, erros: 0, cadastrosMestresAusentes: undefined, categoriasAutomaticasResolvidas: 2,
  categoriasNaoResolvidas: 0, seriesAfetadas: 2, eventosRecalculados: 0, cadastrosMestresNovos: 0,
}, 'A: resumo exato');
assert.deepEqual([3, 5, 2, 4].map((line) => rowsA.get(line).eventType), ['Cadastro', 'Manejo', 'Manejo', 'Cadastro'], 'A: mais antigo = Cadastro, independente da ordem');
assert.deepEqual(rowsA.get(5).derived, { data_anterior: '2026-01-10', peso_anterior: 180, dias: 30, ganho: 40, gmd: 1.333 });
assert.deepEqual(rowsA.get(2).derived, { data_anterior: '2026-02-09', peso_anterior: 220, dias: 20, ganho: 42.5, gmd: 2.125 });
assert.ok(rowsA.get(2).messages.includes('GMD: planilha 9,999, recalculado 2,125.'), 'A: derivado da planilha só comparado');
assert.ok(!rowsA.get(5).messages.some((message) => message.startsWith('GMD')), 'A: GMD igual não gera aviso');
assert.equal(rowsA.get(3).categoria.nome, 'Bezerro');
assert.equal(rowsA.get(4).categoria.nome, 'Garrote');
const resultA = await applyImport(planA);
assert.deepEqual({ ...resultA, importacaoId: undefined }, {
  importacaoId: undefined, status: 'CONCLUIDA', retomada: false, linhasProcessadas: 4, cadastrosCriados: 2, manejosCriados: 2, saidasCriadas: 0,
  animaisConciliados: 0, animaisNovos: 2, duplicidadesIgnoradas: 0, erros: 0, seriesRecalculadas: 2, eventosRecalculados: 0,
  categoriasResolvidasAutomaticamente: 2, cadastrosMestresCriados: 0, lotes: 1, linhasGravadas: [2, 3, 4, 5],
}, 'A: resultado exato');
const afterA = await counts();
assert.equal(afterA.pesagens - beforeA.pesagens, 4);
assert.equal(afterA.animais - beforeA.animais, 2);
assert.equal(afterA.animalIdentificadores - beforeA.animalIdentificadores, 2);
assert.equal(afterA.movimentosAnimais - beforeA.movimentosAnimais, 2, 'A: um movimento Entrada por Cadastro');
assert.equal(afterA.importacoes - beforeA.importacoes, 1);
assert.equal(afterA.auditoria - beforeA.auditoria, 5, 'A: CRIAR por evento + IMPORTAR do job');
assert.equal(afterA.marcas, beforeA.marcas, 'A: nenhuma marca criada');
const job = await db.table('importacoes').where('id').equals(resultA.importacaoId).first();
assert.equal(job.status, 'CONCLUIDA');
assert.equal(job.tipo_importacao, 'HISTORICO');
assert.equal(job.arquivo_sha256, planA.hash);
assert.equal(job.arquivo_hash, planA.hash);
assert.equal(job.arquivo_nome, 'historico-a.csv');
assert.equal(job.registros_criados, 4);
assert.equal((await db.table('auditoria').where('entidade_id').equals(job.id).toArray())[0].acao, 'IMPORTAR');
const animal100 = (await db.table('animais').toArray()).find((row) => row.numero_animal === '100');
assert.equal(animal100.marca_id, abc.id);
assert.equal(animal100.raca_id, nelore.id);
assert.equal(animal100.origem, 'importacao');
assert.equal(animal100.ultimo_peso_kg, 262.5);
assert.equal(animal100.situacao, 'ATIVO');
const series100 = (await db.table('pesagens').where('animal_id').equals(animal100.id).toArray()).sort((l, r) => l.data_pesagem.localeCompare(r.data_pesagem));
assert.deepEqual(series100.map((row) => row.legacy_payload.tipo_manejo), ['Cadastro', 'Manejo', 'Manejo']);
assert.ok(series100.every((row) => row.legacy_payload.importacao_id === job.id), 'A: importacao_id no payload');
assert.equal(series100[1].legacy_payload.import_fingerprint, `local|novo:id:${abc.id}|100|2026-02-09|Manejo|220.00`, 'A: fingerprint canônico');
assert.equal(series100[2].legacy_payload.gmd, 2.125, 'A: derivado gravado');
assert.equal((await logicalIntegrity()).issues.length, 0, 'A: integridade lógica');
const replayA = await analyzeImport({ text: fileA, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } });
assert.deepEqual(replayA.rows.map((row) => row.status), Array(4).fill(ROW_STATUS.JA_EXISTE), 'A: reanálise = 100% JÁ EXISTE');

// ---------------------------------------------------------------------------
// Caso B — animal existente com Cadastro: Manejos, JÁ EXISTE, retroativo e conflito
// ---------------------------------------------------------------------------
const b = await register('200', abc, '2026-01-10', 200);
const bMarch = await launch(b, 'Manejo', '2026-03-10', 260);
const fileB = csv('Brinco;Marca;Data;Peso', '200;ABC;10/01/2026;200', '200;ABC;10/02/2026;230', '200;ABC;05/01/2026;190');
const beforeB = await counts();
const planB = await analyzeImport({ text: fileB, type: 'HISTORICO' });
const rowsB = byLine(planB);
assert.deepEqual([2, 3, 4].map((line) => [rowsB.get(line).status, rowsB.get(line).eventType]), [
  [ROW_STATUS.JA_EXISTE, 'Cadastro'], [ROW_STATUS.NOVO, 'Manejo'], [ROW_STATUS.CONFLITO, 'Manejo'],
], 'B: situação por linha');
assert.equal(rowsB.get(4).messages[0], 'A data 2026-01-05 é anterior ao Cadastro do animal (2026-01-10).');
assert.equal(rowsB.get(3).identity.animalId, b.animal_id);
assert.equal(planB.summary.eventosRecalculados, 1, 'B: o Manejo de março será recalculado');
assert.equal(planB.blocking, true);
await rejects(applyImport(planB), 'IMPORT_BLOCKING');
assert.deepEqual(await counts(), beforeB, 'B: plano bloqueante → zero gravações');
const planB2 = await analyzeImport({ text: fileB, type: 'HISTORICO', rules: { ignoredLines: [4] } });
assert.equal(byLine(planB2).get(4).status, ROW_STATUS.IGNORADA);
assert.equal(planB2.blocking, false);
const resultB = await applyImport(planB2);
assert.equal(resultB.manejosCriados, 1);
assert.equal(resultB.animaisConciliados, 1);
assert.equal(resultB.eventosRecalculados, 1);
assert.equal(resultB.duplicidadesIgnoradas, 1);
const march = await weighingService.getEntryById(bMarch.id);
assert.deepEqual([march.data_anterior, march.peso_anterior, march.dias, march.ganho, march.gmd], ['2026-02-10', 230, 28, 30, 1.071], 'B: retroativo recalculou o posterior');
assert.equal((await counts()).animais, beforeB.animais, 'B: nenhum animal novo');

// ---------------------------------------------------------------------------
// Caso C — animal existente sem Cadastro (legado)
// ---------------------------------------------------------------------------
const ts = '2026-01-01T00:00:00.000Z';
await db.table('animais').add({ id: 'legado-210', empresa_id: 'local', numero_animal: '210', identificacao_normalizada: '210', marca: 'ABC', marca_id: abc.id, sexo: 'M', situacao: 'ATIVO', categoria_automatica: true, created_at: ts, updated_at: ts, deleted_at: null });
await db.table('pesagens').add({ id: 'legado-210-m1', animal_id: 'legado-210', data_pesagem: '2026-01-20', peso_kg: 240, tipo_pesagem: 'Manejo', legacy_payload: { tipo_manejo: 'Manejo', numero_animal: '210', marca: 'ABC', peso: 240, animal_id: 'legado-210' }, created_at: ts, updated_at: ts, deleted_at: null });
const fileC = csv('Brinco;Marca;Data;Peso', '210;ABC;20/02/2026;250');
const beforeC = await counts();
const historyC = await analyzeImport({ text: fileC, type: 'HISTORICO' });
assert.equal(historyC.rows[0].status, ROW_STATUS.CONFLITO);
assert.match(historyC.rows[0].messages[0], /já existe sem Cadastro/);
const registrationC = await analyzeImport({ text: fileC, type: 'CADASTROS', rules: { categoryMode: 'AUTOMATICA' } });
assert.equal(registrationC.rows[0].status, ROW_STATUS.CONFLITO);
const managementC = await analyzeImport({ text: fileC, type: 'MANEJOS' });
assert.equal(managementC.rows[0].status, ROW_STATUS.ERRO);
assert.equal(managementC.rows[0].messages[0], 'O animal existe sem Cadastro: importe o Cadastro antes dos Manejos.');
await rejects(applyImport(historyC), 'IMPORT_BLOCKING');
assert.deepEqual(await counts(), beforeC, 'C: zero gravações');

// ---------------------------------------------------------------------------
// Caso D — ambiguidade (nunca "o último vence")
// ---------------------------------------------------------------------------
const d1 = await register('300', abc, '2026-01-05', 250);
const d2 = await register('300', xyz, '2026-01-06', 260);
const beforeD = await counts();
const ambiguous = await analyzeImport({ text: csv('Brinco;Data;Peso', '300;01/03/2026;280'), type: 'MANEJOS' });
assert.equal(ambiguous.rows[0].status, ROW_STATUS.AMBIGUO);
assert.equal(ambiguous.rows[0].identity.animalId, null, 'D: nenhum animal escolhido');
assert.equal(ambiguous.rows[0].messages[0], 'Identificação ambígua: 300 / ABC, 300 / XYZ. Informe a marca ou o ID do animal.');
assert.equal(ambiguous.summary.ambiguidades, 1);
assert.equal(ambiguous.blocking, true);
await rejects(applyImport(ambiguous), 'IMPORT_BLOCKING');
const ambiguousHistory = await analyzeImport({ text: csv('Brinco;Data;Peso', '300;01/03/2026;280'), type: 'HISTORICO' });
assert.equal(ambiguousHistory.rows[0].status, ROW_STATUS.AMBIGUO, 'D: histórico também não cria animal novo');
assert.deepEqual(await counts(), beforeD, 'D: ambiguidade → zero gravações');
const withBrand = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '300; xyz ;01/03/2026;280'), type: 'MANEJOS' });
assert.equal(withBrand.rows[0].status, ROW_STATUS.NOVO);
assert.equal(withBrand.rows[0].identity.animalId, d2.animal_id, 'D: marca normalizada desambigua');
assert.equal(withBrand.rows[0].identity.via, 'identificador');

// ---------------------------------------------------------------------------
// Caso E — identificador, marca_id, animal_id, SN e número reaproveitado
// ---------------------------------------------------------------------------
const rfid = await register('400', abc, '2026-01-07', 300);
await db.table('animalIdentificadores').add({ id: 'rfid-400', animal_id: rfid.animal_id, tipo: 'RFID', valor: '982 000 123', valor_normalizado: '982 000 123', marca_id: null, ativo: true, principal: false, inicio: '2026-01-07', fim: null, created_at: ts, updated_at: ts, deleted_at: null });
const byRfid = await analyzeImport({ text: csv('Identificador;Data;Peso', '982  000 123;01/03/2026;330'), type: 'MANEJOS' });
assert.equal(byRfid.rows[0].status, ROW_STATUS.NOVO);
assert.equal(byRfid.rows[0].identity.animalId, rfid.animal_id, 'E: identificador RFID ativo (espaços normalizados)');
assert.equal(byRfid.rows[0].identity.via, 'identificador');
const byBrandId = await analyzeImport({ text: csv('numero;marca_id;data;peso', `300;${d1.marca_id};2026-03-01;281`), type: 'MANEJOS' });
assert.equal(byBrandId.rows[0].identity.animalId, d1.animal_id, 'E: [marca_id + valor_normalizado]');
const legacyText = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '210;abc;21/02/2026;251'), type: 'HISTORICO' });
assert.equal(legacyText.rows[0].identity.animalId, 'legado-210', 'E: animal sem identificador casa por número + marca');
assert.equal(legacyText.rows[0].identity.via, 'numero_marca_id');
const explicit = await analyzeImport({ text: csv('animal_id;numero;data;peso', `${d2.animal_id};300;2026-03-02;282`, 'id-de-outra-base;400;2026-03-02;331', `${d2.animal_id};999;2026-03-03;283`), type: 'MANEJOS' });
assert.equal(explicit.rows[0].identity.animalId, d2.animal_id, 'E: animal_id explícito vence a ambiguidade do número');
assert.equal(explicit.rows[0].identity.via, 'animal_id');
assert.equal(explicit.rows[1].identity.animalId, rfid.animal_id, 'E: animal_id estrangeiro cai para número/marca');
assert.ok(explicit.rows[1].messages.includes('animal_id "id-de-outra-base" não existe nesta base; a identificação usa número e marca.'));
assert.equal(explicit.rows[2].status, ROW_STATUS.ERRO, 'NEGATIVO: animal_id e número divergentes');
// CSV técnico vindo de outra instalação: ids estrangeiros caem para os nomes; sem nome, erro.
const technicalHeader = 'id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao';
const foreign = await analyzeImport({ text: csv(technicalHeader, 'ev-1;an-1;;2026-02-01;Cadastro;;;700;ABC;marca-de-fora;M;Nelore;raca-de-fora;Garrote;cat-de-fora;210.5;;;', 'ev-2;an-2;;2026-02-01;Cadastro;;;701;;marca-de-fora;M;;;;;211;;;'), type: 'HISTORICO', rules: { categoryMode: 'PLANILHA' } });
assert.equal(foreign.rules.effectiveDecimal, 'ponto');
assert.equal(foreign.rows[0].status, ROW_STATUS.NOVO, 'E: ids de outra base resolvidos pelos nomes');
assert.equal(foreign.rows[0].peso, 210.5);
assert.equal(foreign.rows[0].categoria.nome, 'Garrote');
assert.ok(foreign.rows[0].messages.includes('marca_id "marca-de-fora" não existe nesta base; Marca identificada pelo nome.'));
assert.ok(foreign.rows[0].messages.includes('animal_id "an-1" não existe nesta base; a identificação usa número e marca.'));
assert.equal(foreign.rows[1].status, ROW_STATUS.ERRO, 'NEGATIVO: id estrangeiro sem nome');
assert.equal(foreign.rows[1].messages[0], 'marca_id "marca-de-fora" não existe nos cadastros.');
const sn = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', 'SN;ABC;M;01/03/2026;150', ';ABC;M;01/03/2026;151', 'SN;ABC;M;02/03/2026;152'), type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } });
assert.deepEqual(sn.rows.map((row) => row.status), [ROW_STATUS.ERRO, ROW_STATUS.ERRO, ROW_STATUS.ERRO], 'E: SN/vazio nunca agrupam');
assert.match(sn.rows[0].messages[0], /SN/);
assert.equal(sn.rows[1].messages[0], 'Identificação do animal não informada.');

// Número reaproveitado: 500/ABC vendido em 01/03; 500/XYZ cadastrado em 01/04.
const sold = await register('500', abc, '2026-01-10', 300);
await launch(sold, 'Saída', '2026-03-01', 320, { motivo_saida: 'Venda' });
const reused = await register('500', xyz, '2026-04-01', 210);
const afterSale = await analyzeImport({ text: csv('Brinco;Data;Peso', '500;01/05/2026;240', '500;01/02/2026;310'), type: 'MANEJOS' });
assert.equal(afterSale.rows[0].identity.animalId, reused.animal_id, 'E: depois da venda o número é do animal ativo');
assert.equal(afterSale.rows[0].status, ROW_STATUS.NOVO);
assert.equal(afterSale.rows[1].identity.animalId, sold.animal_id, 'E: antes da venda e antes do novo Cadastro é do animal vendido');
assert.equal(afterSale.rows[1].status, ROW_STATUS.NOVO);
const soldOnly = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '500;ABC;01/05/2026;240', '500;ABC;01/03/2026;321'), type: 'MANEJOS' });
assert.equal(soldOnly.rows[0].status, ROW_STATUS.ERRO, 'E: só o animal vendido casa → ERRO');
assert.match(soldOnly.rows[0].messages[0], /já saiu \(500 \/ ABC saiu em 2026-03-01 \(Venda\)\)\. O evento de 2026-05-01 é posterior à saída/);
assert.equal(soldOnly.rows[1].status, ROW_STATUS.CONFLITO, 'E: Manejo no dia da saída → CONFLITO');
const soldHistory = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', '500;ABC;M;01/05/2026;240'), type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } });
assert.equal(soldHistory.rows[0].status, ROW_STATUS.ERRO, 'NEGATIVO: histórico não cria outro animal em silêncio sobre número vendido');
assert.equal(soldHistory.summary.animaisNovos, 0);

// ---------------------------------------------------------------------------
// Caso F — cadastros mestres ausentes
// ---------------------------------------------------------------------------
const fileF = csv('Brinco;Marca;Raça;Sexo;Data;Peso', '600;Fazenda Nova;Angus;M;01/02/2026;210', '601;ABC;Angus;M;01/02/2026;215');
const beforeF = await counts();
const missingF = await analyzeImport({ text: fileF, type: 'CADASTROS', rules: { categoryMode: 'AUTOMATICA' } });
assert.deepEqual(missingF.rows.map((row) => row.status), [ROW_STATUS.ERRO, ROW_STATUS.ERRO]);
assert.deepEqual(missingF.summary.cadastrosMestresAusentes, [
  { store: 'marcas', rotulo: 'Marca', nome: 'Fazenda Nova', linhas: [2] },
  { store: 'racas', rotulo: 'Raça', nome: 'Angus', linhas: [2, 3] },
], 'F: lista de cadastros ausentes');
assert.equal(missingF.rows[0].messages[0], 'Marca "Fazenda Nova" não cadastrada. Cadastre antes ou marque "Criar cadastros ausentes".');
await rejects(applyImport(missingF), 'IMPORT_BLOCKING');
const operatorF = await analyzeImport({ text: fileF, type: 'CADASTROS', rules: { categoryMode: 'AUTOMATICA', createMissingMasters: true } }, { id: 'u-op', role: 'OPERADOR' });
assert.match(operatorF.rows[0].messages.join(' '), /não tem permissão registry.write/, 'F: OPERADOR não cria cadastros');
assert.equal(operatorF.blocking, true);
assert.deepEqual(await counts(), beforeF, 'F: nada criado em silêncio');
const createF = await analyzeImport({ text: fileF, type: 'CADASTROS', rules: { categoryMode: 'AUTOMATICA', createMissingMasters: true } }, { id: 'u-gestor', role: 'GESTOR' });
assert.deepEqual(createF.rows.map((row) => row.status), [ROW_STATUS.NOVO, ROW_STATUS.NOVO]);
assert.equal(createF.rows[0].messages[0], 'Marca "Fazenda Nova" não cadastrada: será criada antes da gravação.');
const resultF = await applyImport(createF, { id: 'u-gestor', role: 'GESTOR' });
assert.equal(resultF.cadastrosMestresCriados, 2);
assert.equal(resultF.animaisNovos, 2);
const novaMarca = await brandService.resolveByName('fazenda nova');
assert.ok(novaMarca, 'F: marca criada pelo serviço de cadastros');
const angus = await breedService.resolveByName('ANGUS');
assert.equal((await db.table('animais').toArray()).find((row) => row.numero_animal === '600').marca_id, novaMarca.id, 'F: animal com o id da marca criada');
assert.equal((await db.table('animais').toArray()).find((row) => row.numero_animal === '601').raca_id, angus.id);
const registryAudit = (await db.table('auditoria').toArray()).filter((row) => ['marcas', 'racas'].includes(row.entidade) && [novaMarca.id, angus.id].includes(row.entidade_id));
assert.deepEqual(registryAudit.map((row) => [row.entidade, row.acao]).sort(), [['marcas', 'CRIAR'], ['racas', 'CRIAR']], 'F: criação auditada');
const pendingF = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', '602;Outra Nova;M;01/02/2026;220'), type: 'CADASTROS', rules: { categoryMode: 'AUTOMATICA', createMissingMasters: true } }, { id: 'u-gestor', role: 'GESTOR' });
const beforeOperatorF = await counts();
await rejects(applyImport(pendingF, { id: 'u-op', role: 'OPERADOR' }), 'AUTH_FORBIDDEN');
assert.deepEqual(await counts(), beforeOperatorF, 'NEGATIVO: OPERADOR não grava plano que cria cadastros');

// Função pura reutilizável: nunca "último vence".
const index = buildAnimalIdentityIndex({
  animals: [{ id: 'a', numero_animal: '9', marca: 'ABC', marca_id: 'm1' }, { id: 'b', numero_animal: '9', marca: 'XYZ', marca_id: 'm2' }],
  identifiers: [],
  marcas: [{ id: 'm1', nome: 'ABC' }, { id: 'm2', nome: 'XYZ' }],
});
assert.equal(resolveAnimalIdentity(index, { numero: '9' }).status, 'AMBIGUOUS');
assert.equal(resolveAnimalIdentity(index, { numero: '9', marcaId: 'm2' }).animal.id, 'b');
assert.equal(resolveAnimalIdentity(index, { numero: '9', marcaNome: 'abc' }).animal.id, 'a');
assert.equal(resolveAnimalIdentity(index, { numero: '9', marcaNome: 'Outra' }).status, 'NONE');
assert.equal((await logicalIntegrity()).issues.length, 0, 'integridade lógica ao final');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:reconciliation:verify',
  ok: true,
  cases: {
    A: 'base vazia: Cadastro = mais antigo, Manejos recalculados, rastro e auditoria',
    B: 'animal com Cadastro: JÁ EXISTE, retroativo recalcula posterior, anterior ao Cadastro = CONFLITO',
    C: 'animal sem Cadastro: CONFLITO/ERRO sem gravação',
    D: 'ambiguidade sem marca: AMBÍGUO e zero gravações',
    E: 'identificador RFID, marca_id, marca normalizada, animal_id, SN, número reaproveitado',
  },
  negativeTests: ['plano bloqueante recusado', 'ambiguidade não grava', 'SN/vazio', 'animal_id divergente', 'evento após a saída', 'histórico sobre número vendido'],
}, null, 2));
