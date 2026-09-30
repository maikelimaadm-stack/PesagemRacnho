// Gate import:identity:verify (E1G, parte A5) — identidade do brinco na importação e histórico
// anterior ao Cadastro. Massa de TESTE em fake-indexeddb, pela cadeia oficial (weighingService,
// analyzeImport/applyImport). Casos:
//   1 — chave numérica pura: "01016", "1016,0", "1016.0" → "1016"; letras e decimais de verdade
//       intactos; a identidade exata do app (normalizeIdentifierValue) não muda;
//   2 — índice: exato vence; sem exato, casa pela chave numérica (similarNumber); dois animais
//       parecidos → AMBÍGUO; índice sem os mapas numéricos (código antigo) → NONE;
//   3 — cabeçalhos "Dt.Ant.", "Dt. Anterior", "Data Ant.", "Peso Ant.", "Peso Anterior";
//   4 — Manejos com "01016"/"1016,0"/"1016.0" entram no animal 1016 (número gravado intacto, GMD
//       recalculado, reimportação = JÁ EXISTE); "A01" não casa com "A1"; aviso da tela;
//   5 — "007" e "7" no mesmo arquivo = o mesmo animal novo; outra marca = outro animal;
//   6 — Histórico anterior ao Cadastro gravado: a linha mais antiga vira Cadastro, o Cadastro
//       gravado vira Manejo na mesma transação (auditado), GMD calculado e visto no relatório;
//   7 — negativos: Manejos continua CONFLITO; evento gravado anterior à nova data → CONFLITO;
//       conflito na data mais antiga → ERRO; linha do novo Cadastro inválida → dependentes ERRO;
//       plano velho recusado dentro da transação (zero gravações); sem a troca o GMD some;
//   8 — o GMD do histórico importado aparece no relatório Pesagens;
//   9 — a tela de análise (StepConciliacao) mostra os dois avisos a partir do resumo.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { brandService, breedService, categoryService } from '../src/modules/catalog/application/registryServices.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { recalculateWeightSeries } from '../src/modules/weighing/domain/weighingSeries.js';
import { ROW_STATUS, analyzeImport, applyImport, readImportFile, suggestMapping } from '../src/modules/import/application/importService.js';
import {
  IDENTITY_STATUS,
  buildAnimalIdentityIndex,
  importGroupingKey,
  importNumberKey,
  normalizeIdentifierValue,
  resolveAnimalIdentity,
} from '../src/modules/import/domain/animalIdentity.js';
import { normalizeHeader } from '../src/modules/import/domain/importFields.js';
import { buildImportPlan, prepareImportRows } from '../src/modules/import/domain/importPlanner.js';
import { buildRegistryContext } from '../src/modules/import/domain/importRegistryContext.js';
import { writeImportBatch } from '../src/modules/import/infrastructure/importWriter.js';
import { afericaoDoArquivo, avisoNumerosParecidos, avisosCadastrosAntecipados } from '../src/components/importacao/importacaoModel.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const ADMIN = Object.freeze({ id: 'u-admin', nome: 'Ana Admin', role: 'ADMIN' });
const STORES = ['pesagens', 'animais', 'animalIdentificadores', 'movimentosAnimais', 'animalLotes', 'sessoesPesagem', 'auditoria', 'importacoes'];

// Gate técnico sem sessão (mesmo padrão de scripts/lib/reportFixtures.mjs): o relatório registra o
// provedor de ator ao carregar as Configurações; aqui ele fica desligado.
setActorProvider(null);
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
const register = (numero, marca, data, peso) => weighingService.createEntry({
  empresa_id: 'local', tipo_manejo: 'Cadastro', numero_animal: numero, marca: marca.nome, marca_id: marca.id, sexo: 'M', raca: 'Nelore', raca_id: nelore.id,
  data_pesagem: data, peso, categoria_automatica: true,
});
const seriesOf = async (animalId) => (await db.table('pesagens').where('animal_id').equals(animalId).toArray())
  .filter((row) => !row.deleted_at)
  .sort((left, right) => left.data_pesagem.localeCompare(right.data_pesagem));
const rejects = async (promise, code) => {
  let error = null;
  try { await promise; } catch (caught) { error = caught; }
  assert.ok(error, `esperava recusa ${code}`);
  assert.equal(error.code, code, error.message);
  return error;
};

// ---------------------------------------------------------------------------
// 1. Chave numérica pura
// ---------------------------------------------------------------------------
for (const [text, expected] of [['01016', '1016'], ['1016,0', '1016'], ['1016.0', '1016'], ['1016,00', '1016'], [' 01016 ', '1016'], ['007', '7'], ['7', '7'], ['000', '0'], ['0,0', '0'], ['1000', '1000'], ['0100', '100'], ['1,00', '1']]) {
  assert.equal(importNumberKey(text), expected, `chave numérica de "${text}"`);
}
for (const text of ['A01', '01A', 'A1', '1016.5', '1016,5', '1.016', '10 16', '1016.', 'SN', '', null]) {
  assert.equal(importNumberKey(text), null, `NEGATIVO: "${text}" não é brinco numérico`);
}
// E1G (revisão): três zeros depois do ponto/vírgula é separador de MILHAR ("1.000" = mil no Excel
// em português), não o ",0" decimal. A regra anterior (/[.,]0+/) tirava o "milhar" e "1.000"
// casava com o animal 1 — pesagem no animal errado.
for (const text of ['1.000', '2.000', '10.000', '1,000', '1016,000']) {
  assert.equal(importNumberKey(text), null, `NEGATIVO: "${text}" (milhar) não vira número parecido`);
}
assert.equal(/^0*(\d+?)(?:[.,]0+)?$/.exec('1.000')?.[1], '1', 'NEGATIVO: a regra anterior transformava "1.000" em "1"');
assert.equal(importGroupingKey('A01'), 'A01', 'número com letra agrupa pelo valor exato');
assert.notEqual(importGroupingKey('A01'), importGroupingKey('A1'), 'NEGATIVO: letras não perdem o zero');
assert.equal(importGroupingKey('007'), importGroupingKey('7'), '"007" e "7" agrupam juntos');
// A identidade exata do app (Lançamento, relatórios) continua a mesma.
assert.equal(normalizeIdentifierValue('01016'), '01016', 'NEGATIVO: a identidade exata não tira zeros');
assert.equal(normalizeIdentifierValue('1016,0'), '1016,0');

// ---------------------------------------------------------------------------
// 2. Índice: exato vence, depois o número parecido
// ---------------------------------------------------------------------------
const pureIndex = buildAnimalIdentityIndex({
  animals: [
    { id: 'p1016', numero_animal: '1016', marca: 'ABC', marca_id: 'm1' },
    { id: 'p7', numero_animal: '7', marca: 'ABC', marca_id: 'm1' },
    { id: 'p007', numero_animal: '007', marca: 'ABC', marca_id: 'm1' },
    { id: 'pA1', numero_animal: 'A1', marca: 'ABC', marca_id: 'm1' },
    { id: 'p1', numero_animal: '1', marca: 'ABC', marca_id: 'm1' },
  ],
  identifiers: [],
  marcas: [{ id: 'm1', nome: 'ABC' }],
});
const similar = resolveAnimalIdentity(pureIndex, { numero: '01016', marcaId: 'm1' });
assert.equal(similar.status, IDENTITY_STATUS.MATCH);
assert.equal(similar.animal.id, 'p1016');
assert.equal(similar.similarNumber, true, '"01016" casa por número parecido');
assert.equal(similar.via, 'numero_marca_id');
const exact = resolveAnimalIdentity(pureIndex, { numero: '1016', marcaId: 'm1' });
assert.equal(exact.similarNumber, false, 'número igual não é "parecido"');
assert.equal(resolveAnimalIdentity(pureIndex, { numero: '7', marcaId: 'm1' }).animal.id, 'p7', 'o valor exato vence o parecido');
assert.equal(resolveAnimalIdentity(pureIndex, { numero: '007', marcaId: 'm1' }).animal.id, 'p007', 'o valor exato vence o parecido ("007")');
const twoSimilar = resolveAnimalIdentity(pureIndex, { numero: '07', marcaId: 'm1' });
assert.equal(twoSimilar.status, IDENTITY_STATUS.AMBIGUOUS, 'NEGATIVO: dois animais parecidos → AMBÍGUO, nunca "o último vence"');
assert.equal(resolveAnimalIdentity(pureIndex, { numero: 'A01', marcaId: 'm1' }).status, IDENTITY_STATUS.NONE, 'NEGATIVO: "A01" não casa com "A1"');
assert.equal(resolveAnimalIdentity(pureIndex, { numero: '01016', marcaNome: 'XYZ' }).status, IDENTITY_STATUS.NONE, 'NEGATIVO: número parecido de outra marca não casa');
assert.equal(resolveAnimalIdentity(pureIndex, { numero: '1.000', marcaId: 'm1' }).status, IDENTITY_STATUS.NONE, 'NEGATIVO: "1.000" (mil) não casa com o animal 1');
assert.equal(resolveAnimalIdentity(pureIndex, { numero: '1,0', marcaId: 'm1' }).animal.id, 'p1', '"1,0" do Excel casa com o animal 1');
// Código antigo: índice sem os mapas numéricos → "01016" não achava o 1016.
const oldIndex = { ...pureIndex, numeric: undefined };
assert.equal(resolveAnimalIdentity(oldIndex, { numero: '01016', marcaId: 'm1' }).status, IDENTITY_STATUS.NONE, 'NEGATIVO: o índice antigo reprovaria (animal novo)');

// ---------------------------------------------------------------------------
// 3. Cabeçalhos do MAKGESTAO antigo
// ---------------------------------------------------------------------------
const aliasCases = { 'Dt.Ant.': 'data_anterior', 'Dt. Anterior': 'data_anterior', 'Data Ant.': 'data_anterior', 'Data Anterior': 'data_anterior', 'Peso Ant.': 'peso_anterior', 'Peso Anterior': 'peso_anterior', 'Dt.': 'data', Peso: 'peso' };
for (const [header, expected] of Object.entries(aliasCases)) {
  assert.equal(suggestMapping([header], 'HISTORICO')[header], expected, `cabeçalho "${header}" (${normalizeHeader(header)}) → ${expected}`);
}
const makgestao = suggestMapping(['Animal', 'Dt.', 'Peso', 'Dt.Ant.', 'Peso Ant.', 'Dias', 'Ganho (kg)', 'GMD'], 'HISTORICO');
assert.deepEqual(makgestao, { Animal: 'numero', 'Dt.': 'data', Peso: 'peso', 'Dt.Ant.': 'data_anterior', 'Peso Ant.': 'peso_anterior', Dias: 'dias', 'Ganho (kg)': 'ganho', GMD: 'gmd' }, 'planilha do MAKGESTAO mapeia inteira');
assert.equal(suggestMapping(['Dt.Ant.X'], 'HISTORICO')['Dt.Ant.X'], null, 'NEGATIVO: cabeçalho desconhecido continua sem campo');

// ---------------------------------------------------------------------------
// 4. Manejos com número parecido entram no animal existente
// ---------------------------------------------------------------------------
const a1016 = await register('1016', abc, '2026-01-10', 200);
const aA1 = await register('A1', abc, '2026-01-10', 210);
const fileManejos = csv('Brinco;Marca;Data;Peso', '01016;ABC;10/02/2026;220', '1016,0;ABC;10/03/2026;240', '1016.0;ABC;10/04/2026;260', 'A01;ABC;10/02/2026;230');
const beforeManejos = await counts();
const planManejos = await analyzeImport({ text: fileManejos, type: 'MANEJOS' });
assert.deepEqual(await counts(), beforeManejos, '4: análise não grava');
const rowsManejos = byLine(planManejos);
for (const line of [2, 3, 4]) {
  assert.equal(rowsManejos.get(line).status, ROW_STATUS.NOVO, `4: linha ${line} NOVO`);
  assert.equal(rowsManejos.get(line).identity.animalId, a1016.animal_id, `4: linha ${line} casou com o 1016`);
  assert.equal(rowsManejos.get(line).identity.isNew, false);
  assert.ok(rowsManejos.get(line).messages.some((message) => message.startsWith(`Número ${rowsManejos.get(line).identity.similarNumber.informado} reconhecido como o animal 1016`)), `4: linha ${line} explica o número parecido`);
}
assert.deepEqual(planManejos.summary.numerosParecidos, { linhas: 3, exemplos: ['01016 → 1016', '1016,0 → 1016', '1016.0 → 1016'], outrosExemplos: 0 });
assert.equal(avisoNumerosParecidos(planManejos.summary), '3 linhas casaram com animais existentes por número parecido: 01016 → 1016, 1016,0 → 1016, 1016.0 → 1016.', '4: aviso da tela');
assert.equal(avisoNumerosParecidos({ numerosParecidos: { linhas: 1, exemplos: ['01016 → 1016'], outrosExemplos: 0 } }), '1 linha casou com um animal existente por número parecido: 01016 → 1016.');
assert.equal(avisoNumerosParecidos({ numerosParecidos: { linhas: 0, exemplos: [], outrosExemplos: 0 } }), null, 'sem número parecido não há aviso');
assert.equal(rowsManejos.get(5).status, ROW_STATUS.ERRO, 'NEGATIVO: "A01" não casa com "A1"');
assert.equal(rowsManejos.get(5).messages[0], 'Animal A01 / ABC não encontrado. Importe o Cadastro antes (tipo Cadastros ou Histórico).');
assert.deepEqual([2, 3, 4].map((line) => rowsManejos.get(line).derived.gmd), [0.645, 0.714, 0.645], '4: GMD recalculado contra o 1016');
const planManejosOk = await analyzeImport({ text: fileManejos, type: 'MANEJOS', rules: { ignoredLines: [5] } });
const resultManejos = await applyImport(planManejosOk);
assert.equal(resultManejos.manejosCriados, 3);
assert.equal(resultManejos.animaisNovos, 0, '4: nenhum animal novo');
assert.equal((await counts()).animais, beforeManejos.animais, '4: nenhum animal novo na base');
const series1016 = await seriesOf(a1016.animal_id);
assert.deepEqual(series1016.map((row) => [row.data_pesagem, row.legacy_payload.tipo_manejo, row.legacy_payload.numero_animal, row.legacy_payload.gmd ?? null]), [
  ['2026-01-10', 'Cadastro', '1016', null], ['2026-02-10', 'Manejo', '1016', 0.645], ['2026-03-10', 'Manejo', '1016', 0.714], ['2026-04-10', 'Manejo', '1016', 0.645],
], '4: o número gravado é o do animal (1016), não o da planilha');
assert.equal((await db.table('animais').where('id').equals(a1016.animal_id).first()).numero_animal, '1016', '4: o número do animal não muda');
assert.equal((await db.table('animais').where('id').equals(aA1.animal_id).first()).numero_animal, 'A1');
const replayManejos = await analyzeImport({ text: fileManejos, type: 'MANEJOS', rules: { ignoredLines: [5] } });
assert.deepEqual([2, 3, 4].map((line) => byLine(replayManejos).get(line).status), Array(3).fill(ROW_STATUS.JA_EXISTE), '4: reimportação = JÁ EXISTE');

// ---------------------------------------------------------------------------
// 5. "007" e "7" no mesmo arquivo = o mesmo animal novo
// ---------------------------------------------------------------------------
const fileNew = csv('Brinco;Marca;Sexo;Data;Peso', '007;ABC;M;01/02/2026;150', '7;ABC;M;01/03/2026;171', '0007;XYZ;M;01/02/2026;160', 'B07;ABC;M;01/02/2026;155', 'B7;ABC;M;01/03/2026;165');
const planNew = await analyzeImport({ text: fileNew, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } });
const rowsNew = byLine(planNew);
assert.equal(rowsNew.get(2).identity.key, rowsNew.get(3).identity.key, '5: "007" e "7" da mesma marca = o mesmo animal');
assert.deepEqual([2, 3].map((line) => [rowsNew.get(line).status, rowsNew.get(line).eventType]), [[ROW_STATUS.NOVO, 'Cadastro'], [ROW_STATUS.NOVO, 'Manejo']]);
assert.equal(rowsNew.get(3).derived.gmd, 0.75, '5: GMD do "7" contra o "007" (21 kg em 28 dias)');
assert.ok(rowsNew.get(2).messages.includes('Os números 007, 7 foram tratados como o mesmo animal (zeros à esquerda ou ",0" do Excel).'));
assert.notEqual(rowsNew.get(4).identity.key, rowsNew.get(2).identity.key, 'NEGATIVO: outra marca = outro animal');
assert.equal(rowsNew.get(4).eventType, 'Cadastro');
assert.notEqual(rowsNew.get(5).identity.key, rowsNew.get(6).identity.key, 'NEGATIVO: "B07" e "B7" (com letra) são animais diferentes');
assert.equal(planNew.summary.animaisNovos, 4, '5: ABC 7, XYZ 7, B07 e B7');
assert.deepEqual(planNew.summary.numerosParecidos, { linhas: 0, exemplos: [], outrosExemplos: 0 }, '5: nenhum casou com animal existente');
const fileNewRead = readImportFile(fileNew);
assert.deepEqual(afericaoDoArquivo(fileNewRead, suggestMapping(fileNewRead.headers, 'HISTORICO')), { linhas: 5, mapeado: true, animais: 4, repetidos: 1, maxLinhas: 2 }, '5: a aferição também conta "007" e "7" como um animal');
const resultNew = await applyImport(planNew);
assert.equal(resultNew.animaisNovos, 4);
const created7 = (await db.table('animais').toArray()).filter((row) => !row.deleted_at && row.marca_id === abc.id && importGroupingKey(row.numero_animal) === '7');
assert.equal(created7.length, 1, '5: um animal só para "007" e "7"');
assert.equal(created7[0].numero_animal, '007', '5: nasce com o número da linha do Cadastro (gravado como veio)');
assert.equal((await seriesOf(created7[0].id)).length, 2);

// ---------------------------------------------------------------------------
// 6. Histórico anterior ao Cadastro gravado: Cadastro antecipado
// ---------------------------------------------------------------------------
// O Cadastro foi lançado no dia (29/09) e o histórico antigo (02/06 e 01/08) chega por planilha.
const a701 = await register('701', abc, '2026-09-29', 330);
const fileHist = csv('Brinco;Marca;Dt.;Peso;Dt.Ant.;Peso Ant.', '0701;ABC;01/08/2026;300;02/06/2026;260', '701;ABC;02/06/2026;260;;', '701;ABC;29/09/2026;330;01/08/2026;300');
const beforeHist = await counts();
const planHist = await analyzeImport({ text: fileHist, type: 'HISTORICO' });
assert.deepEqual(await counts(), beforeHist, '6: análise não grava');
assert.equal(planHist.blocking, false, '6: o histórico anterior ao Cadastro não bloqueia mais');
const rowsHist = byLine(planHist);
assert.deepEqual([2, 3, 4].map((line) => [rowsHist.get(line).status, rowsHist.get(line).eventType]), [
  [ROW_STATUS.NOVO, 'Manejo'], [ROW_STATUS.NOVO, 'Cadastro'], [ROW_STATUS.JA_EXISTE, 'Manejo'],
], '6: a linha mais antiga vira Cadastro; o Cadastro gravado aparece como Manejo');
assert.ok(rowsHist.get(3).messages.includes('O Cadastro de 29/09/2026 do animal 701 passa a Manejo; o novo Cadastro é 02/06/2026.'), '6: a análise mostra a troca antes de gravar');
assert.ok(rowsHist.get(4).messages.includes('O Cadastro de 29/09/2026 do animal 701 passa a Manejo; o novo Cadastro é 02/06/2026 (linha 3).'));
assert.equal(rowsHist.get(2).identity.similarNumber.informado, '0701', '6: o "0701" casou por número parecido');
assert.deepEqual(rowsHist.get(2).derived, { data_anterior: '2026-06-02', peso_anterior: 260, dias: 60, ganho: 40, gmd: 0.667 });
assert.deepEqual(rowsHist.get(3).derived, { data_anterior: null, peso_anterior: null, dias: null, ganho: null, gmd: null }, '6: Cadastro sem derivados');
assert.deepEqual(rowsHist.get(4).derived, { data_anterior: '2026-08-01', peso_anterior: 300, dias: 59, ganho: 30, gmd: 0.508 }, '6: o antigo Cadastro ganha GMD');
assert.ok(!rowsHist.get(4).messages.some((message) => message.startsWith('Data anterior') || message.startsWith('Peso anterior')), '6: "Dt.Ant."/"Peso Ant." da planilha conferem com o recalculado');
assert.equal(planHist.summary.eventosRecalculados, 1, '6: o antigo Cadastro será recalculado');
assert.deepEqual(planHist.summary.cadastrosAntecipados, [{ animalId: a701.animal_id, animal: '701 / ABC', numero: '701', cadastroGravado: '2026-09-29', novoCadastro: '2026-06-02', linha: 3 }]);
assert.deepEqual(avisosCadastrosAntecipados(planHist.summary), ['O Cadastro de 29/09/2026 do animal 701 passa a Manejo; o novo Cadastro é 02/06/2026.'], '6: frase da tela');
const promote = planHist.animals.find((animal) => animal.animalId === a701.animal_id).promoteRegistration;
assert.deepEqual(promote, { numero: '701', line: 3, data: '2026-06-02', demotedEventId: a701.id, demotedData: '2026-09-29' });

// 7a. Plano velho recusado DENTRO da transação (writer), sem gravar nada.
const staleRows = new Map(planHist.rows.filter((row) => row.status === ROW_STATUS.NOVO).map((row) => [row.line, row]));
const staleGroup = planHist.animals.find((animal) => animal.animalId === a701.animal_id);
const writeArgs = (group) => ({ groups: [group], rowsByLine: staleRows, job: { id: 'job-de-teste' }, empresaId: 'local', operador: 'GATE', propriedadeId: null, clock: () => new Date().toISOString() });
const beforeStale = await counts();
await rejects(writeImportBatch(db, writeArgs({ ...staleGroup, promoteRegistration: { ...promote, demotedEventId: 'outro-evento' } })), 'IMPORT_STALE_PLAN');
await rejects(writeImportBatch(db, writeArgs({ ...staleGroup, promoteRegistration: { ...promote, demotedData: '2026-09-28' } })), 'IMPORT_STALE_PLAN');
await rejects(writeImportBatch(db, writeArgs({ ...staleGroup, promoteRegistration: null })), 'IMPORT_STALE_PLAN');
assert.deepEqual(await counts(), beforeStale, 'NEGATIVO: plano velho → zero gravações (transação desfeita)');

const resultHist = await applyImport(planHist);
assert.equal(resultHist.cadastrosCriados, 1);
assert.equal(resultHist.manejosCriados, 1);
assert.equal(resultHist.animaisConciliados, 1);
assert.equal(resultHist.animaisNovos, 0);
assert.equal(resultHist.eventosRecalculados, 1);
const series701 = await seriesOf(a701.animal_id);
assert.deepEqual(series701.map((row) => [row.data_pesagem, row.tipo_pesagem, row.legacy_payload.tipo_manejo, row.legacy_payload.numero_animal, row.gmd ?? null, row.legacy_payload.gmd ?? null]), [
  ['2026-06-02', 'Cadastro', 'Cadastro', '701', null, null],
  ['2026-08-01', 'Manejo', 'Manejo', '701', 0.667, 0.667],
  ['2026-09-29', 'Manejo', 'Manejo', '701', 0.508, 0.508],
], '6: um Cadastro só, o mais antigo; o antigo Cadastro é Manejo com GMD');
assert.equal(series701[2].id, a701.id, '6: o evento antigo é o mesmo (só muda o tipo e os derivados)');
assert.equal(series701[2].legacy_payload.data_anterior, '2026-08-01');
const audit701 = (await db.table('auditoria').where('entidade_id').equals(a701.id).toArray()).filter((row) => row.acao === 'ATUALIZAR');
assert.equal(audit701.length, 1, '6: a troca é auditada');
assert.equal(audit701[0].origem, 'importacao');
assert.equal(audit701[0].importacao_id, resultHist.importacaoId);
assert.equal(audit701[0].antes.legacy_payload.tipo_manejo, 'Cadastro');
assert.equal(audit701[0].depois.legacy_payload.tipo_manejo, 'Manejo');
assert.equal(audit701[0].motivo, 'Cadastro antecipado pela importação do histórico: o Cadastro de 29/09/2026 passa a Manejo; o novo Cadastro é 02/06/2026.');
const movements701 = (await db.table('movimentosAnimais').where('animal_id').equals(a701.animal_id).toArray());
assert.deepEqual(movements701.filter((row) => !row.deleted_at).map((row) => [row.tipo, row.data_evento]), [['Entrada', '2026-06-02']], '6: uma Entrada ativa, na data do novo Cadastro');
assert.ok(movements701.some((row) => row.deleted_at && row.tipo === 'Entrada' && row.pesagem_id === a701.id), '6: a Entrada antiga fica cancelada (exclusão lógica)');
const identifiers701 = (await db.table('animalIdentificadores').where('animal_id').equals(a701.animal_id).toArray()).filter((row) => !row.deleted_at);
assert.deepEqual(identifiers701.map((row) => [row.valor, row.inicio]), [['701', '2026-06-02']], '6: o identificador vale desde o novo Cadastro');
const animal701 = await db.table('animais').where('id').equals(a701.animal_id).first();
assert.equal(animal701.numero_animal, '701');
assert.equal(animal701.ultimo_peso_kg, 330);
assert.equal(animal701.situacao, 'ATIVO');
assert.equal((await logicalIntegrity()).issues.length, 0, '6: integridade lógica');
const replayHist = await analyzeImport({ text: fileHist, type: 'HISTORICO' });
assert.deepEqual(replayHist.rows.map((row) => [row.status, row.eventType]), [[ROW_STATUS.JA_EXISTE, 'Manejo'], [ROW_STATUS.JA_EXISTE, 'Cadastro'], [ROW_STATUS.JA_EXISTE, 'Manejo']], '6: reimportação = JÁ EXISTE');
assert.deepEqual(replayHist.summary.cadastrosAntecipados, [], '6: nada a antecipar de novo');

// NEGATIVO: sem a troca (regra antiga), o evento de 29/09 continua Cadastro e fica sem GMD.
const oldRule = recalculateWeightSeries([
  { id: 'n1', animal_id: 'x', tipo_manejo: 'Manejo', data_pesagem: '2026-06-02', peso: 260 },
  { id: 'n2', animal_id: 'x', tipo_manejo: 'Manejo', data_pesagem: '2026-08-01', peso: 300 },
  { id: 'reg', animal_id: 'x', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-29', peso: 330 },
]);
assert.equal(oldRule.find((update) => update.id === 'reg').patch.gmd, null, 'NEGATIVO: com o Cadastro no fim o GMD dele seria nulo');

// ---------------------------------------------------------------------------
// 7. Negativos da antecipação
// ---------------------------------------------------------------------------
// 7b. Os outros tipos continuam como antes.
const a702 = await register('702', abc, '2026-09-29', 320);
const beforeOthers = await counts();
const manejos702 = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '702;ABC;02/06/2026;250'), type: 'MANEJOS' });
assert.equal(manejos702.rows[0].status, ROW_STATUS.CONFLITO, 'NEGATIVO: Manejos não antecipa o Cadastro');
assert.equal(manejos702.rows[0].messages[0], 'A data 2026-06-02 é anterior ao Cadastro do animal (2026-09-29).');
const cadastros702 = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', '702;ABC;M;02/06/2026;250'), type: 'CADASTROS', rules: { categoryMode: 'AUTOMATICA' } });
assert.equal(cadastros702.rows[0].status, ROW_STATUS.CONFLITO, 'NEGATIVO: Cadastros não antecipa o Cadastro');
assert.deepEqual([manejos702.summary.cadastrosAntecipados, cadastros702.summary.cadastrosAntecipados], [[], []]);

// 7c. Evento gravado anterior à nova data (legado com Manejo antes do Cadastro) → CONFLITO.
const legacyTs = '2026-01-01T00:00:00.000Z';
await db.table('pesagens').add({ id: 'legado-702-m', animal_id: a702.animal_id, data_pesagem: '2026-05-01', peso_kg: 240, tipo_pesagem: 'Manejo', legacy_payload: { tipo_manejo: 'Manejo', numero_animal: '702', marca: 'ABC', peso: 240, animal_id: a702.animal_id }, created_at: legacyTs, updated_at: legacyTs, deleted_at: null });
const anomaly = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '702;ABC;02/06/2026;250'), type: 'HISTORICO' });
assert.equal(anomaly.rows[0].status, ROW_STATUS.CONFLITO, 'NEGATIVO: o novo Cadastro precisa ser anterior a todos os eventos gravados');
assert.equal(anomaly.rows[0].messages[0], 'A data 2026-06-02 é anterior ao Cadastro do animal (2026-09-29).');
assert.deepEqual(anomaly.summary.cadastrosAntecipados, []);
await db.table('pesagens').where('id').equals('legado-702-m').delete();

// 7d. Conflito do próprio arquivo na data mais antiga → ERRO (o Cadastro fica indefinido).
const conflictEarliest = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '702;ABC;02/06/2026;250', '702;ABC;02/06/2026;255', '702;ABC;01/08/2026;290'), type: 'HISTORICO' });
assert.deepEqual(conflictEarliest.rows.map((row) => row.status), [ROW_STATUS.CONFLITO, ROW_STATUS.CONFLITO, ROW_STATUS.ERRO]);
assert.equal(conflictEarliest.rows[2].messages[0], 'O evento mais antigo deste animal está em conflito; resolva-o para definir o Cadastro.');
assert.deepEqual(conflictEarliest.summary.cadastrosAntecipados, []);
assert.equal(conflictEarliest.blocking, true);
await rejects(applyImport(conflictEarliest), 'IMPORT_BLOCKING');
assert.deepEqual(await counts(), beforeOthers, 'NEGATIVO: nada gravado nos negativos');

// 7e. Linha do novo Cadastro que não será gravada: as anteriores ao Cadastro gravado viram ERRO.
// Planejador puro com série sintética. Só a linha mais antiga fica sem apartação e cai na
// apartação fixa inexistente (erro dela); as outras citam uma apartação pelo nome (só aviso).
const pureRegistry = buildRegistryContext({ marcas: [{ id: 'm1', nome: 'ABC', empresa_id: 'local' }] }, 'local');
const pureContext = {
  identityIndex: buildAnimalIdentityIndex({ animals: [{ id: 'x900', empresa_id: 'local', numero_animal: '900', marca: 'ABC', marca_id: 'm1' }], identifiers: [], marcas: [{ id: 'm1', nome: 'ABC' }] }),
  registry: pureRegistry,
};
const pureFile = readImportFile(csv('Brinco;Marca;Data;Peso;Apartação', '900;ABC;02/06/2026;200;', '900;ABC;01/08/2026;250;Engorda', '900;ABC;15/09/2026;330;Engorda'));
const prepared = prepareImportRows({ type: 'HISTORICO', file: pureFile, mapping: suggestMapping(pureFile.headers, 'HISTORICO'), rules: { fixedValues: { apartacao_id: 'ap-inexistente' } }, context: pureContext });
const purePlan = buildImportPlan(prepared, {
  ...pureContext,
  seriesByAnimal: new Map([['x900', [{ id: 'ev-900', animal_id: 'x900', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 300 }]]]),
  permissions: { canRegistryWrite: false },
});
const pureRows = byLine(purePlan);
assert.equal(pureRows.get(2).status, ROW_STATUS.ERRO, '7e: a linha do novo Cadastro não passa na validação');
assert.ok(pureRows.get(2).messages.includes('Apartação fixa "ap-inexistente" não existe.'));
assert.equal(pureRows.get(2).eventType, 'Manejo', '7e: a troca é desfeita na linha');
assert.ok(!pureRows.get(2).messages.some((message) => message.includes('passa a Manejo')), '7e: sem o aviso da troca');
assert.equal(pureRows.get(3).status, ROW_STATUS.ERRO, 'NEGATIVO: Manejo anterior ao Cadastro gravado não entra sem o novo Cadastro');
assert.equal(pureRows.get(3).messages.at(-1), 'Depende do Cadastro da linha 2, que não será gravado.');
assert.equal(pureRows.get(4).status, ROW_STATUS.NOVO, '7e: a linha depois do Cadastro gravado segue normal');
assert.deepEqual(purePlan.summary.cadastrosAntecipados, []);
assert.equal(purePlan.animals[0].promoteRegistration, null);

// ---------------------------------------------------------------------------
// 8. GMD calculado aparece no relatório Pesagens
// ---------------------------------------------------------------------------
const report = await runReport('pesagens.periodo', { today: '2026-09-30', params: { periodo: { preset: 'personalizado', from: '2026-01-01', to: '2026-09-30' } } }, ADMIN);
setActorProvider(null);
const reportRows701 = report.rows.filter((row) => row.animal_id === a701.animal_id).sort((left, right) => String(left.data_pesagem).localeCompare(String(right.data_pesagem)));
assert.deepEqual(reportRows701.map((row) => [row.data_pesagem, row.tipo_manejo, row.gmd ?? null]), [
  ['2026-06-02', 'Cadastro', null], ['2026-08-01', 'Manejo', 0.667], ['2026-09-29', 'Manejo', 0.508],
], '8: o relatório Pesagens mostra o GMD do histórico importado e do antigo Cadastro');
const reportRows1016 = report.rows.filter((row) => row.animal_id === a1016.animal_id);
assert.equal(reportRows1016.length, 4, '8: as pesagens do "01016" estão no animal 1016');
assert.equal(new Set(reportRows1016.map((row) => row.numero_animal)).size, 1, '8: um número só no relatório');

// ---------------------------------------------------------------------------
// 9. A tela de análise mostra os dois avisos (texto vindo do resumo do motor)
// ---------------------------------------------------------------------------
const stepConciliacao = readFileSync(fileURLToPath(new URL('../src/components/importacao/StepConciliacao.jsx', import.meta.url)), 'utf8');
assert.match(stepConciliacao, /const numerosParecidos = avisoNumerosParecidos\(summary\);/, '9: aviso de número parecido vem do resumo');
assert.match(stepConciliacao, /data-testid="importacao-numeros-parecidos"/, '9: bloco do número parecido na análise');
assert.match(stepConciliacao, /const cadastrosAntecipados = avisosCadastrosAntecipados\(summary\);/, '9: frases do Cadastro antecipado vêm do resumo');
assert.match(stepConciliacao, /data-testid="importacao-cadastros-antecipados"/, '9: bloco do Cadastro antecipado na análise');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:identity:verify',
  ok: true,
  cases: {
    chaveNumerica: '"01016", "1016,0", "1016.0" → 1016; letras e decimais intactos; identidade exata do app sem mudança',
    indice: 'exato vence; sem exato casa por número parecido; dois parecidos = AMBÍGUO; índice antigo = NONE',
    cabecalhos: 'Dt.Ant., Dt. Anterior, Data Ant., Peso Ant., Peso Anterior',
    manejos: '3 linhas casaram por número parecido, número gravado 1016, GMD recalculado, reimportação JÁ EXISTE',
    mesmoArquivo: '"007" e "7" = o mesmo animal novo; outra marca e números com letra separados',
    cadastroAntecipado: 'Cadastro de 29/09 vira Manejo com GMD, novo Cadastro 02/06, auditoria, Entrada e identificador ajustados, relatório com GMD',
    tela: 'análise mostra "N linhas casaram … por número parecido" e "O Cadastro de … passa a Manejo"',
  },
  negativeTests: [
    'letras/decimais não viram número', 'milhar "1.000" não vira o animal 1', 'identidade exata do app intacta', 'dois parecidos = AMBÍGUO', 'índice antigo não casa',
    'A01 ≠ A1', 'marca diferente não casa', 'Manejos/Cadastros continuam CONFLITO', 'evento gravado anterior → CONFLITO',
    'conflito na data mais antiga → ERRO', 'novo Cadastro inválido → dependentes ERRO', 'plano velho recusado na transação', 'sem a troca o GMD some',
  ],
}, null, 2));
