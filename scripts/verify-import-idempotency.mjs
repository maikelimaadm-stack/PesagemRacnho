// Gate import:idempotency:verify — idempotência, duplicidade e job retomável (missão §33-§37).
// Cobre: reimportar o mesmo arquivo (também salvo com LF/BOM ou com colunas reordenadas) → 100%
// JÁ EXISTE e ZERO gravações em qualquer store; arquivo parcialmente igual → só as linhas novas;
// segundo job do mesmo arquivo usa `<sha256>#2` (sem ConstraintError); repesagem idêntica →
// POSSÍVEL DUPLICIDADE (não grava; grava só com acceptDuplicates); mesmo animal/data com outro peso
// → CONFLITO; idempotência por `id` técnico e por `id_externo`; plano velho (banco mudou) recusado;
// falha dentro da transação de um lote desfaz só aquele lote; job FALHOU com checkpoint e retomada
// que conclui sem duplicar.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { logicalIntegrity } from '../src/storage/indexedDb/health/health.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import { brandService } from '../src/modules/catalog/application/registryServices.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import {
  ROW_STATUS,
  analyzeImport,
  applyImport,
  deleteImportTemplate,
  listImportJobs,
  listImportTemplates,
  planToCsv,
  resultToCsv,
  saveImportTemplate,
} from '../src/modules/import/application/importService.js';

const STORES = ['pesagens', 'animais', 'animalIdentificadores', 'movimentosAnimais', 'animalLotes', 'sessoesPesagem', 'auditoria', 'importacoes', 'marcas', 'racas', 'categoriasAnimal', 'appSettings'];
const BOM = String.fromCharCode(0xfeff);
const csv = (...lines) => lines.join('\r\n');

await deleteDbForTests();
const db = await storage.ensureReady();
await brandService.create(null, { nome: 'ABC' });
const counts = async () => Object.fromEntries(await Promise.all(STORES.map(async (name) => [name, await db.table(name).count()])));
const rejects = async (promise, code) => {
  let error = null;
  try { await promise; } catch (caught) { error = caught; }
  assert.ok(error, `esperava recusa ${code}`);
  assert.equal(error.code, code, error.message);
  return error;
};

// 1. Importa e reimporta o mesmo arquivo.
const lines = ['Brinco;Marca;Sexo;Data;Peso;ID Externo', '1;ABC;M;05/01/2026;200;EXT-1', '1;ABC;M;05/02/2026;230;EXT-2', '2;ABC;M;06/01/2026;210;', '2;ABC;M;06/02/2026;240;'];
const original = csv(...lines);
const first = await analyzeImport({ text: original, type: 'HISTORICO' });
const firstResult = await applyImport(first);
assert.equal(firstResult.cadastrosCriados + firstResult.manejosCriados, 4);
const afterFirst = await counts();
for (const variant of [original, `${BOM}${lines.join('\n')}\n`]) {
  const replay = await analyzeImport({ text: variant, type: 'HISTORICO' });
  assert.equal(replay.hash, first.hash, 'LF/BOM não mudam o hash');
  assert.deepEqual(replay.rows.map((row) => row.status), Array(4).fill(ROW_STATUS.JA_EXISTE), 'reimportação = 100% JÁ EXISTE');
  assert.equal(replay.blocking, false);
  assert.deepEqual(replay.previousImports.map((job) => job.status), ['CONCLUIDA'], 'a análise mostra a importação anterior do arquivo');
  const result = await applyImport(replay);
  assert.equal(result.importacaoId, null);
  assert.equal(result.status, 'SEM_ALTERACOES');
  assert.equal(result.duplicidadesIgnoradas, 4);
  assert.deepEqual(await counts(), afterFirst, 'zero gravações (nenhum job, auditoria ou sessão)');
}
const reordered = csv('Peso;Data;Marca;Brinco', '230;05/02/2026;ABC;1', '200;05/01/2026;ABC;1', '240;06/02/2026;ABC;2', '210;06/01/2026;ABC;2');
const reorderedPlan = await analyzeImport({ text: reordered, type: 'HISTORICO' });
assert.notEqual(reorderedPlan.hash, first.hash, 'outro arquivo');
assert.deepEqual(reorderedPlan.rows.map((row) => row.status), Array(4).fill(ROW_STATUS.JA_EXISTE), 'colunas reordenadas: idempotência por evento, não por hash');
await applyImport(reorderedPlan);
assert.deepEqual(await counts(), afterFirst);

// 2. Parcialmente igual → só as novas; segundo job do mesmo arquivo usa sufixo.
const partial = csv(...lines, '1;ABC;M;05/03/2026;260;', '3;ABC;M;07/01/2026;190;');
const partialFirst = await analyzeImport({ text: partial, type: 'HISTORICO', rules: { ignoredLines: [7] } });
assert.deepEqual(partialFirst.rows.map((row) => row.status), [...Array(4).fill(ROW_STATUS.JA_EXISTE), ROW_STATUS.NOVO, ROW_STATUS.IGNORADA]);
const partialResult = await applyImport(partialFirst);
assert.deepEqual([partialResult.manejosCriados, partialResult.cadastrosCriados, partialResult.duplicidadesIgnoradas], [1, 0, 4]);
const partialSecond = await analyzeImport({ text: partial, type: 'HISTORICO' });
assert.deepEqual(partialSecond.rows.map((row) => row.status), [...Array(5).fill(ROW_STATUS.JA_EXISTE), ROW_STATUS.NOVO]);
const secondJob = await applyImport(partialSecond);
assert.equal(secondJob.cadastrosCriados, 1);
const jobs = (await db.table('importacoes').toArray()).filter((row) => row.arquivo_sha256 === partialFirst.hash);
assert.deepEqual(jobs.map((row) => row.arquivo_hash).sort(), [partialFirst.hash, `${partialFirst.hash}#2`], 'índice único respeitado com sufixo documentado');

// 3. Repesagem, conflito de peso, id técnico e id_externo.
const beforeDup = await counts();
const dup = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '2;ABC;06/03/2026;250', '2;ABC;06/03/2026;250'), type: 'MANEJOS' });
assert.deepEqual(dup.rows.map((row) => row.status), [ROW_STATUS.NOVO, ROW_STATUS.POSSIVEL_DUPLICIDADE]);
assert.equal(dup.rows[1].messages[0], 'Repete a linha 2 (mesmo animal, data, tipo e peso); não será gravada.');
assert.equal(dup.blocking, false, 'possível duplicidade não bloqueia');
assert.equal(dup.summary.duplicidades, 1);
const dupResult = await applyImport(dup);
assert.equal(dupResult.manejosCriados, 1, 'repesagem não é gravada por padrão');
assert.equal((await counts()).pesagens, beforeDup.pesagens + 1);
const accepted = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '3;ABC;08/01/2026;191', '3;ABC;08/01/2026;191'), type: 'MANEJOS', rules: { acceptDuplicates: true } });
assert.deepEqual(accepted.rows.map((row) => row.status), [ROW_STATUS.NOVO, ROW_STATUS.NOVO], 'repesagem aceita explicitamente');
assert.equal((await applyImport(accepted)).manejosCriados, 2);
const beforeConflict = await counts();
const conflict = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '2;ABC;06/02/2026;241'), type: 'MANEJOS' });
assert.equal(conflict.rows[0].status, ROW_STATUS.CONFLITO, 'NEGATIVO: mesmo animal/data/tipo com peso diferente');
assert.equal(conflict.rows[0].messages[0], 'Já existe Manejo em 2026-02-06 com peso 240; a linha informa 241.');
await rejects(applyImport(conflict), 'IMPORT_BLOCKING');
assert.deepEqual(await counts(), beforeConflict, 'conflito → zero gravações');
const ext = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso;id_externo', '1;ABC;05/02/2026;230;EXT-2', '1;ABC;06/02/2026;230;EXT-1'), type: 'MANEJOS' });
assert.equal(ext.rows[0].status, ROW_STATUS.JA_EXISTE, 'id_externo igual e mesmos dados');
assert.equal(ext.rows[1].status, ROW_STATUS.CONFLITO, 'NEGATIVO: id_externo já usado por outro evento');
assert.match(ext.rows[1].messages[0], /id_externo EXT-1 já existe com dados diferentes \(Cadastro em 2026-01-05, peso 200\)/);
const stored = (await weighingService.listEntries()).find((row) => row.id_externo === 'EXT-2');
const byId = await analyzeImport({ text: csv('id;animal_id;data;tipo;numero;peso', `${stored.id};${stored.animal_id};2026-02-05;Manejo;1;230`, `${stored.id};${stored.animal_id};2026-02-05;Manejo;1;231`), type: 'MANEJOS' });
assert.deepEqual(byId.rows.map((row) => row.status), [ROW_STATUS.JA_EXISTE, ROW_STATUS.CONFLITO], 'id técnico: igual → JÁ EXISTE; diferente → CONFLITO');

// 4. Plano velho: o banco mudou entre o dry-run e a gravação.
const stale = await analyzeImport({ text: csv('Brinco;Marca;Data;Peso', '3;ABC;09/02/2026;205', '2;ABC;06/04/2026;270'), type: 'MANEJOS' });
assert.equal(stale.blocking, false);
const animal3 = (await db.table('animais').toArray()).find((row) => row.numero_animal === '3');
await weighingService.createEntry({ empresa_id: 'local', tipo_manejo: 'Manejo', animal_id: animal3.id, numero_animal: '3', marca: 'ABC', data_pesagem: '2026-02-09', peso: 206 });
const beforeStale = await counts();
const staleError = await rejects(applyImport(stale), 'IMPORT_STALE_PLAN');
assert.deepEqual(staleError.lines, [2], 'linha divergente citada');
assert.deepEqual(await counts(), beforeStale, 'plano velho → zero gravações');

// 5. Lotes atômicos, falha no meio e retomada pelo checkpoint.
const bulk = csv('Brinco;Marca;Sexo;Data;Peso', ...Array.from({ length: 5 }, (_, index) => [
  `${100 + index};ABC;M;01/01/2026;${200 + index}`,
  `${100 + index};ABC;M;01/02/2026;${230 + index}`,
]).flat());
const bulkPlan = await analyzeImport({ text: bulk, type: 'HISTORICO', fileName: 'lote.csv' });
assert.equal(bulkPlan.summary.animaisNovos, 5);
const beforeBulk = await counts();
// Falha DENTRO da transação do 2º lote: o lote é desfeito por inteiro; o 1º lote permanece.
const movementTable = db.table('movimentosAnimais');
const originalBulkAdd = movementTable.bulkAdd;
let batchCalls = 0;
movementTable.bulkAdd = function patchedBulkAdd(...args) {
  batchCalls += 1;
  if (batchCalls === 2) return Promise.reject(new Error('falha simulada no lote 2'));
  return originalBulkAdd.apply(this, args);
};
const progress = [];
const failure = await applyImport(bulkPlan, null, { batchAnimals: 2, onProgress: (event) => progress.push(event) }).catch((error) => error);
movementTable.bulkAdd = originalBulkAdd;
assert.equal(failure.message, 'falha simulada no lote 2');
assert.deepEqual(progress.map((event) => [event.lote, event.lotes, event.animaisProcessados, event.animaisTotal]), [[1, 3, 2, 5]]);
const failedJob = (await db.table('importacoes').toArray()).find((row) => row.arquivo_sha256 === bulkPlan.hash);
assert.equal(failedJob.status, 'FALHOU');
assert.equal(failedJob.erro, 'falha simulada no lote 2');
assert.deepEqual(failedJob.checkpoint, { lotes_concluidos: 1, animais_processados: 2, animais_total: 5, ultima_chave: failedJob.checkpoint.ultima_chave });
assert.equal(failedJob.registros_criados, 4, 'contagens só do lote confirmado');
const midCounts = await counts();
assert.equal(midCounts.pesagens - beforeBulk.pesagens, 4, 'lote 2 desfeito por inteiro');
assert.equal(midCounts.animais - beforeBulk.animais, 2);
assert.equal(midCounts.importacoes - beforeBulk.importacoes, 1);

// Falha fora da transação (depois do commit do lote, no aviso de progresso) e retomada.
const interrupted = await applyImport(bulkPlan, null, { batchAnimals: 2, onProgress: () => { throw new Error('janela fechada'); } }).catch((error) => error);
assert.equal(interrupted.message, 'janela fechada');
const interruptedJob = await db.table('importacoes').where('id').equals(failedJob.id).first();
assert.equal(interruptedJob.status, 'FALHOU', 'mesmo job retomado e interrompido');
assert.equal(interruptedJob.tentativas, 2);
assert.equal(interruptedJob.checkpoint.lotes_concluidos, 2);
assert.equal(interruptedJob.checkpoint.animais_processados, 4);
const resumed = await applyImport(bulkPlan, null, { batchAnimals: 2 });
assert.equal(resumed.retomada, true);
assert.equal(resumed.importacaoId, failedJob.id, 'retomada continua o mesmo job');
assert.deepEqual([resumed.cadastrosCriados, resumed.manejosCriados, resumed.animaisNovos], [1, 1, 1], 'só o que faltava');
const doneJob = await db.table('importacoes').where('id').equals(failedJob.id).first();
assert.equal(doneJob.status, 'CONCLUIDA');
assert.equal(doneJob.tentativas, 3);
assert.equal(doneJob.registros_criados, 10);
assert.equal(doneJob.animais_criados, 5);
assert.equal(doneJob.checkpoint.lotes_concluidos, 3);
assert.equal(doneJob.checkpoint.animais_processados, 5);
const afterBulk = await counts();
assert.equal(afterBulk.pesagens - beforeBulk.pesagens, 10, 'nenhum evento duplicado');
assert.equal(afterBulk.animais - beforeBulk.animais, 5, 'nenhum animal duplicado');
assert.equal(afterBulk.importacoes - beforeBulk.importacoes, 1, 'um único job');
assert.equal((await db.table('auditoria').toArray()).filter((row) => row.acao === 'IMPORTAR' && row.entidade_id === failedJob.id).length, 1);
const finalReplay = await analyzeImport({ text: bulk, type: 'HISTORICO' });
assert.deepEqual([...new Set(finalReplay.rows.map((row) => row.status))], [ROW_STATUS.JA_EXISTE]);
assert.equal((await applyImport(bulkPlan)).status, 'SEM_ALTERACOES', 'plano já aplicado: sem gravar de novo');
assert.equal((await logicalIntegrity()).issues.length, 0);

// 5. (cont.) Duas gravações simultâneas do mesmo plano (duplo clique): nada duplica.
const racePlan = await analyzeImport({ text: csv('Brinco;Marca;Sexo;Data;Peso', 'R1;ABC;M;03/01/2026;201', 'R1;ABC;M;03/02/2026;231', '1;ABC;M;07/03/2026;275'), type: 'HISTORICO' });
assert.equal(racePlan.summary.novos, 3);
const beforeRace = await counts();
const race = await Promise.allSettled([applyImport(racePlan), applyImport(racePlan)]);
assert.ok(race.some((item) => item.status === 'fulfilled'), 'uma das gravações conclui');
for (const item of race.filter((entry) => entry.status === 'rejected')) assert.equal(item.reason.code, 'IMPORT_STALE_PLAN', item.reason.message);
const afterRace = await counts();
assert.equal(afterRace.pesagens - beforeRace.pesagens, 3, 'gravação concorrente não duplica eventos');
assert.equal(afterRace.animais - beforeRace.animais, 1, 'gravação concorrente não duplica o animal');

// 5a. Lote grande sem nenhuma leitura de categoria (categoria manual vazia e Manejos sem faixa):
// dentro da transação só se aguarda operação do IndexedDB — senão o Dexie fecha a transação
// antes da hora (PrematureCommitError) a partir de ~100 animais no lote.
const manual = csv('Brinco;Marca;Sexo;Data;Peso', ...Array.from({ length: 250 }, (_, index) => [`M${index};ABC;M;02/01/2026;200`, `M${index};ABC;M;02/02/2026;220`]).flat());
const manualPlan = await analyzeImport({ text: manual, type: 'HISTORICO', rules: { categoryMode: 'PLANILHA' } });
assert.equal(manualPlan.blocking, false);
const manualResult = await applyImport(manualPlan, null, { batchAnimals: 250 });
assert.deepEqual([manualResult.animaisNovos, manualResult.lotes], [250, 1], 'lote de 250 animais manuais numa transação');

// 5b. Cadastros mestres: duplicado por nome normalizado → JÁ EXISTE; reimportação sem gravar.
const mastersFile = csv('Marca;Raça;Causa da morte;Categoria;Sexo;Peso mínimo;Peso máximo;Era;Ordem', ' abc ;Nelore;Raio;Bezerro;M;0;199;12;1', 'XYZ;nelore;;Garrote;M;200;349;24;2', ';;;Boi;M;400;350;;');
const mastersPlan = await analyzeImport({ text: mastersFile, type: 'MESTRES' });
assert.deepEqual(mastersPlan.rows.map((row) => [row.line, row.identity.label, row.status]), [
  [2, 'Marca: abc', ROW_STATUS.JA_EXISTE], [2, 'Raça: Nelore', ROW_STATUS.NOVO], [2, 'Causa da morte: Raio', ROW_STATUS.NOVO], [2, 'Categoria: Bezerro', ROW_STATUS.NOVO],
  [3, 'Marca: XYZ', ROW_STATUS.NOVO], [3, 'Raça: nelore', ROW_STATUS.JA_EXISTE], [3, 'Categoria: Garrote', ROW_STATUS.NOVO], [4, 'Categoria: Boi', ROW_STATUS.ERRO],
], 'MESTRES: situação por item');
assert.equal(mastersPlan.rows[5].messages[0], 'Raça "nelore" já listada na linha 2.');
assert.equal(mastersPlan.rows[7].messages[0], 'Categoria "Boi": Peso mínimo não pode ser maior que o peso máximo.', 'NEGATIVO: validação do cadastro');
await rejects(applyImport(mastersPlan), 'IMPORT_BLOCKING');
await rejects(analyzeImport({ text: mastersFile, type: 'MESTRES' }, { id: 'u-op', role: 'OPERADOR' }), 'AUTH_FORBIDDEN');
const mastersOk = await analyzeImport({ text: mastersFile, type: 'MESTRES', rules: { ignoredLines: [4] } });
const beforeMasters = await counts();
const mastersResult = await applyImport(mastersOk);
assert.equal(mastersResult.cadastrosMestresCriados, 5);
const afterMasters = await counts();
assert.deepEqual([afterMasters.marcas - beforeMasters.marcas, afterMasters.racas - beforeMasters.racas, afterMasters.categoriasAnimal - beforeMasters.categoriasAnimal], [1, 1, 2]);
assert.equal(afterMasters.auditoria - beforeMasters.auditoria, 6, 'CRIAR por cadastro (serviço) + IMPORTAR');
const bezerro = (await db.table('categoriasAnimal').toArray()).find((row) => row.nome === 'Bezerro');
assert.deepEqual([bezerro.sexo_aplicavel, bezerro.peso_min_kg, bezerro.peso_max_kg, bezerro.era, bezerro.ordem], ['M', 0, 199, 12, 1]);
const mastersReplay = await analyzeImport({ text: mastersFile, type: 'MESTRES', rules: { ignoredLines: [4] } });
assert.equal(mastersReplay.summary.novos, 0, 'MESTRES reimportado: nada novo');
assert.equal((await applyImport(mastersReplay)).status, 'SEM_ALTERACOES');
assert.deepEqual(await counts(), afterMasters, 'MESTRES reimportado: zero gravações');

// 6. Relatório CSV, modelos e permissões.
const report = planToCsv(dup);
assert.ok(report.startsWith(BOM), 'BOM');
assert.equal(report.split('\r\n')[0], `${BOM}linha;situacao;tipo_evento;animal;animal_id;animal_novo;data;peso;categoria;origem_categoria;data_anterior;peso_anterior;dias;ganho;gmd;mensagens`);
assert.match(report, /\r\n2;NOVO;Manejo;2 \/ ABC;[^;]+;Não;06\/03\/2026;250;;;06\/02\/2026;240;28;10;0,357;\r\n/, 'datas dd/mm/aaaa e vírgula decimal');
assert.match(report, /\r\n3;POSSÍVEL DUPLICIDADE;Manejo;2 \/ ABC;[^;]+;Não;06\/03\/2026;250;;;;;;;;"Repete a linha 2 \(mesmo animal, data, tipo e peso\); não será gravada."\r\n/, 'mensagem com ";" escapada');
const resultCsv = resultToCsv(dupResult, dup);
assert.match(resultCsv, /Manejos criados;1/);
assert.match(resultCsv, /;GRAVADO\r\n/);
assert.match(resultCsv, /;NÃO GRAVADO\r\n/);
const template = await saveImportTemplate({ nome: 'Balança fazenda', tipoImportacao: 'HISTORICO', columnMapping: { Brinco: 'numero', Data: 'data', Peso: 'peso', Nada: null }, categoryMode: 'AUTOMATICA', dateFormat: 'DD/MM/AAAA', decimalFormat: 'virgula', fixedValues: { sexo: 'M' }, rows: [['dado']], text: 'não guardar' });
assert.deepEqual(Object.keys(template).sort(), ['categoryMode', 'columnMapping', 'dateFormat', 'decimalFormat', 'delimiter', 'fixedValues', 'id', 'nome', 'tipoImportacao', 'updatedAt'], 'modelo nunca guarda dados');
const setting = await db.table('appSettings').get('import-template:local');
assert.equal(setting.value.version, 1);
assert.equal((await listImportTemplates('local')).length, 1);
await assert.rejects(saveImportTemplate({ nome: 'x', tipoImportacao: 'HISTORICO', columnMapping: { A: 'inexistente' } }), /Campo "inexistente" não existe para HISTORICO/, 'NEGATIVO: modelo com campo inexistente');
await assert.rejects(saveImportTemplate({ nome: '', tipoImportacao: 'HISTORICO' }), /Informe o nome/);
await rejects(analyzeImport({ text: original, type: 'HISTORICO' }, { id: 'u-consulta', role: 'CONSULTA' }), 'AUTH_FORBIDDEN');
assert.equal((await analyzeImport({ text: original, type: 'HISTORICO' }, { id: 'u-operador', role: 'OPERADOR' })).blocking, false, 'OPERADOR importa eventos (weighing.write)');
await rejects(applyImport(bulkPlan, { id: 'u-consulta', role: 'CONSULTA' }), 'AUTH_FORBIDDEN');
await rejects(saveImportTemplate({ nome: 'y', tipoImportacao: 'MESTRES' }, { id: 'u-operador', role: 'OPERADOR' }), 'AUTH_FORBIDDEN');
await rejects(analyzeImport({ text: original, type: 'HISTORICO' }, { id: 'sem-papel' }), 'AUTH_FORBIDDEN');
await rejects(analyzeImport({ text: 'Marca\nNova', type: 'MESTRES' }, { id: 'u-operador', role: 'OPERADOR' }), 'AUTH_FORBIDDEN');
setActorProvider(() => null);
await rejects(analyzeImport({ text: original, type: 'HISTORICO' }), 'AUTH_FORBIDDEN');
setActorProvider(null);
const history = await listImportJobs({ limit: 3 });
assert.equal(history.length, 3, 'histórico de jobs do assistente');
assert.ok(history.every((row) => row.origem === 'assistente-importacao' && row.status === 'CONCLUIDA'));
assert.ok(history[0].created_at >= history[2].created_at, 'mais novo primeiro');
await rejects(listImportJobs({}, { id: 'sem-papel' }), 'AUTH_FORBIDDEN');
assert.equal(await deleteImportTemplate(template.id), true);
assert.deepEqual(await listImportTemplates('local'), []);

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:idempotency:verify',
  ok: true,
  cases: ['reimportação idêntica/LF/BOM/colunas reordenadas = zero gravações', 'parcialmente igual grava só as novas', 'sufixo do índice único', 'repesagem', 'id técnico e id_externo', 'plano velho recusado', 'lote atômico', 'checkpoint e retomada'],
  negativeTests: ['conflito de peso', 'id_externo reutilizado', 'id técnico com outro peso', 'plano velho', 'falha no meio do lote', 'CONSULTA/OPERADOR/sem sessão recusados', 'modelo com campo inexistente'],
}, null, 2));
