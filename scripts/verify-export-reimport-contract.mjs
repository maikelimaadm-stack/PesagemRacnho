// Gate export:reimport-contract:verify (fatia D da reconciliação sanidade/lançamento/importação).
// O CSV "para reimportação" é um contrato técnico, não um relatório:
// 1) cabeçalhos exatos, datas ISO (AAAA-MM-DD), decimal com ponto, sem derivados;
// 2) Relação (população da tela) e Manutenção (registros Dexie crus) geram o MESMO conteúdo por linha;
// 3) ida e volta: pesagens semeadas pelo serviço (Cadastro + Manejos + Saídas, retroativo, saída sem
//    peso, categoria automática e manual) → CSV técnico → analyzeImport da importação conciliada
//    (fatia B) na mesma base: 100% "JÁ EXISTE" e nenhuma gravação em nenhuma store.
// Contrato consumido da fatia B: analyzeImport({ text, type: 'HISTORICO'|'SAIDAS', mapping:
// suggestMapping(headers, type), rules: {} }, ADMIN_ACTOR). Enquanto
// src/modules/import/application/importService.js não existir, o gate falha como PENDENTE (nunca passa
// sem a ida e volta).
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { loadEventRows } from '../src/modules/reporting/infrastructure/reportSources/eventSource.js';
import { relationPopulation } from '../src/modules/reporting/application/relationPopulation.js';
import { parseCsv } from '../src/modules/weighing/domain/csvParser.js';
import {
  EXPORT_PROFILES,
  REIMPORT_HEADERS,
  buildWeighingCsv,
  buildWeighingTechnicalCsv,
} from '../src/modules/weighing/export/weighingExportContract.js';

const GATE = 'export:reimport-contract:verify';
const EMPRESA = 'local';
const EXPECTED_HEADER_LINE = 'id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao';
const ADMIN_ACTOR = Object.freeze({ id: 'u-admin', nome: 'Administrador', role: 'ADMIN' });
const OBS_TRICKY = 'entrada; lote "A"\nconferido';

assert.equal(REIMPORT_HEADERS.join(';'), EXPECTED_HEADER_LINE, 'cabeçalhos técnicos exatos');

// ---------------------------------------------------------------------------
// 1) Massa pelo serviço canônico (mesmo caminho do Lançamento).
await deleteDbForTests();
setActorProvider(null);
const db = await storage.ensureReady();
const ts = '2026-09-16T00:00:00.000Z';
const registry = (id, nome, extra = {}) => ({ id, empresa_id: EMPRESA, nome, nome_normalizado: nome.toUpperCase(), ativo: true, padrao: false, abreviacao: null, created_at: ts, updated_at: ts, deleted_at: null, ...extra });
const categoria = (id, nome, sexo, min, max, era, ordem) => ({ id, empresa_id: EMPRESA, nome, nome_normalizado: nome.toUpperCase(), sexo_aplicavel: sexo, peso_min_kg: min, peso_max_kg: max, era, ordem, ativo: true, created_at: ts, updated_at: ts, deleted_at: null });
await db.table('categoriasAnimal').clear();
await db.table('categoriasAnimal').bulkAdd([
  categoria('cat-bezerro', 'Bezerro', 'M', 200, 330, 12, 1),
  categoria('cat-garrote', 'Garrote', 'M', 330, 500, 24, 2),
  categoria('cat-novilha', 'Novilha', 'F', 200, 450, 24, 3),
]);
await db.table('marcas').bulkAdd([registry('m-alfa', 'ALFA'), registry('m-beta', 'BETA')]);
await db.table('racas').add(registry('r-nelore-gate', 'NELORE GATE'));

const animalA = { empresa_id: EMPRESA, animal_id: 'a-100', numero_animal: '100', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'NELORE GATE', raca_id: 'r-nelore-gate' };
const animalB = { empresa_id: EMPRESA, animal_id: 'a-200', numero_animal: '200', marca: 'BETA', marca_id: 'm-beta', sexo: 'F', raca: 'NELORE GATE', raca_id: 'r-nelore-gate' };
const animalC = { empresa_id: EMPRESA, animal_id: 'a-300', numero_animal: '300', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'NELORE GATE', raca_id: 'r-nelore-gate' };

await weighingService.createEntry({ ...animalA, id: 'c-100', id_externo: 'EXT-100', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 300.5, categoria_automatica: true, nome_apartacao: 'ROTINA', nome_lote: 'MEIO', observacao: OBS_TRICKY });
await weighingService.createEntry({ ...animalA, id: 'm-100b', tipo_manejo: 'Manejo', data_pesagem: '2026-09-01', peso: 341.25, nome_apartacao: 'ROTINA', nome_lote: 'BOIADA' });
// Retroativo: entra entre o Cadastro e o Manejo já gravado (a série é recalculada pelo serviço).
await weighingService.createEntry({ ...animalA, id: 'm-100a', tipo_manejo: 'Manejo', data_pesagem: '2026-08-15', peso: 320, nome_apartacao: 'ROTINA', nome_lote: 'MEIO' });
await weighingService.createEntry({ ...animalA, id: 's-100', tipo_manejo: 'Saída', motivo_saida: 'Venda', data_pesagem: '2026-09-10', peso: 350, observacao: '=1+1' });
await weighingService.createEntry({ ...animalB, id: 'c-200', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 280, categoria_id: 'cat-novilha', categoria_automatica: false });
await weighingService.createEntry({ ...animalB, id: 'm-200', tipo_manejo: 'Manejo', data_pesagem: '2026-08-20', peso: 295.8 });
await weighingService.createEntry({ ...animalB, id: 's-200', tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'Raio', data_pesagem: '2026-09-05', peso: null });
await weighingService.createEntry({ ...animalC, id: 'c-300', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-02', peso: 410, categoria_automatica: true });
const SEEDED = 8;

// ---------------------------------------------------------------------------
// 2) Exportação técnica pelas duas portas: Relação (tela) e Manutenção (registros crus).
const relationRows = relationPopulation((await loadEventRows({ empresaId: EMPRESA })).rows, {});
assert.equal(relationRows.length, SEEDED);
const fromRelation = buildWeighingCsv(relationRows, { profile: EXPORT_PROFILES.REIMPORT });
const lookups = {
  marcas: await db.table('marcas').toArray(),
  racas: await db.table('racas').toArray(),
  categorias: await db.table('categoriasAnimal').toArray(),
};
const fromMaintenance = buildWeighingTechnicalCsv(await db.table('pesagens').toArray(), { lookups });

// O parser usado pela importação (trim por campo, aspas, quebra de linha dentro de aspas).
const tableOf = (content) => {
  const { delimiter, rows: [header, ...body] } = parseCsv(content);
  assert.equal(delimiter, ";", "separador detectado pela importação");
  return { header, records: body.map((line) => Object.fromEntries(header.map((name, index) => [name, line[index] ?? '']))) };
};
const relationTable = tableOf(fromRelation.content);
const maintenanceTable = tableOf(fromMaintenance.content);
for (const { header, records } of [relationTable, maintenanceTable]) {
  assert.deepEqual(header, [...REIMPORT_HEADERS], 'parser da importação lê os cabeçalhos técnicos exatos');
  assert.equal(records.length, SEEDED);
}
assert.equal(fromRelation.content.slice(1, fromRelation.content.indexOf('\r\n')), EXPECTED_HEADER_LINE);
const byId = (table) => new Map(table.records.map((record) => [record.id, record]));
const relationById = byId(relationTable);
const maintenanceById = byId(maintenanceTable);
for (const [id, record] of relationById) assert.deepEqual(maintenanceById.get(id), record, `Relação e Manutenção iguais na linha ${id}`);
assert.deepEqual(maintenanceTable.records.map((record) => record.id), ['c-100', 'c-200', 'm-100a', 'm-200', 'm-100b', 'c-300', 's-200', 's-100'], 'Manutenção na cronologia canônica');

// Formatos: ISO, ponto, ausente vazio, sem derivados, textos preservados.
for (const record of relationTable.records) {
  assert.match(record.data, /^\d{4}-\d{2}-\d{2}$/, `data ISO (${record.id})`);
  assert.match(record.peso, /^$|^\d+(\.\d+)?$/, `peso com ponto ou vazio (${record.id})`);
  assert.ok(['Cadastro', 'Manejo', 'Saída'].includes(record.tipo), `tipo canônico (${record.id})`);
  assert.ok(['M', 'F'].includes(record.sexo), `sexo em código (${record.id})`);
  assert.ok(record.animal_id && record.numero && record.marca_id, `identidade completa (${record.id})`);
}
const stored = new Map((await weighingService.listEntries({ empresaId: EMPRESA })).map((entry) => [entry.id, entry]));
for (const [id, record] of relationById) {
  const entry = stored.get(id);
  assert.equal(record.data, entry.data_pesagem, `data igual à gravada (${id})`);
  assert.equal(record.peso === '' ? null : Number(record.peso), entry.peso ?? null, `peso igual ao gravado (${id})`);
  assert.equal(record.animal_id, entry.animal_id);
  assert.equal(record.categoria_id, entry.categoria_id ?? '', `categoria gravada no evento (${id})`);
}
assert.equal(relationById.get('c-100').peso, '300.5');
assert.equal(relationById.get('m-100b').peso, '341.25');
assert.equal(relationById.get('m-200').peso, '295.8');
assert.equal(relationById.get('s-200').peso, '', 'Saída por Morte sem peso: vazio, nunca 0');
assert.equal(relationById.get('s-200').causa_morte, 'Raio');
assert.equal(relationById.get('s-100').motivo_saida, 'Venda');
assert.equal(relationById.get('c-100').id_externo, 'EXT-100');
assert.equal(relationById.get('c-100').observacao, OBS_TRICKY, '";", aspas e quebra de linha preservados');
assert.equal(relationById.get('s-100').observacao, "'=1+1", 'fórmula neutralizada com apóstrofo (a importação remove o apóstrofo)');
assert.equal(relationById.get('c-100').categoria, 'Bezerro', 'categoria automática pelo peso');
assert.equal(relationById.get('m-100b').categoria, 'Garrote', 'Manejo reclassifica animal automático');
assert.equal(relationById.get('c-200').categoria, 'Novilha', 'categoria manual do Cadastro exportada como gravada');
assert.equal(relationById.get('c-100').marca, 'ALFA');
assert.equal(relationById.get('c-100').raca_id, 'r-nelore-gate');
assert.equal(relationById.get('m-100a').lote, 'MEIO');
assert.equal(relationById.get('m-100a').apartacao, 'ROTINA');
for (const derived of ['data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd']) {
  assert.ok(!relationTable.header.includes(derived), `NEGATIVO: derivado ${derived} fora do CSV técnico`);
}
assert.ok(stored.get('m-100b').gmd != null, 'a base tem GMD gravado — e mesmo assim ele não é exportado');
const friendly = buildWeighingCsv(relationRows, {});
assert.notDeepEqual(friendly.headers, [...REIMPORT_HEADERS], 'NEGATIVO: relatório amigável não é o contrato técnico');
assert.ok(friendly.content.includes('300,50') && !fromRelation.content.includes('300,50'), 'NEGATIVO: vírgula decimal só no amigável');

// ---------------------------------------------------------------------------
// 3) Ida e volta pela importação conciliada (fatia B): tudo JÁ EXISTE, nada gravado.
const importServicePath = fileURLToPath(new URL('../src/modules/import/application/importService.js', import.meta.url));
const partial = { gate: GATE, headers: REIMPORT_HEADERS.length, rows: SEEDED, relationEqualsMaintenance: true };
if (!existsSync(importServicePath)) {
  console.log(JSON.stringify({ ...partial, ok: false, pending: true, reason: 'src/modules/import/application/importService.js (fatia B) ainda não existe: ida e volta não verificada' }, null, 2));
  await deleteDbForTests();
  process.exit(1);
}

const importService = await import(pathToFileURL(importServicePath).href);
const fields = await import('../src/modules/import/domain/importFields.js');
const { ROW_STATUS } = await import('../src/modules/import/domain/importConstants.js');
const analyzeImport = importService.analyzeImport;
const suggestMapping = importService.suggestMapping ?? fields.suggestMapping;
assert.equal(typeof analyzeImport, 'function', 'importService exporta analyzeImport');
assert.equal(typeof suggestMapping, 'function', 'suggestMapping disponível');

/** Linhas do plano do dry-run (aceita as formas usuais do resultado). */
function planRowsOf(result) {
  const rows = [result?.rows, result?.linhas, result?.plan?.rows, result?.plano?.linhas, result?.lines].find(Array.isArray);
  assert.ok(rows, `analyzeImport devolveu plano sem linhas (chaves: ${Object.keys(result || {}).join(', ')})`);
  return rows;
}
const statusOf = (row) => row?.status ?? row?.situacao ?? row?.estado ?? null;

async function snapshotCounts() {
  const counts = {};
  for (const table of db.tables) counts[table.name] = await table.count();
  return counts;
}

setActorProvider(() => ADMIN_ACTOR);
const before = await snapshotCounts();
const flows = [
  { type: 'HISTORICO', rows: relationRows.filter((row) => row.tipo_manejo !== 'Saída') },
  { type: 'SAIDAS', rows: relationRows.filter((row) => row.tipo_manejo === 'Saída') },
];
const results = {};
for (const flow of flows) {
  const csv = buildWeighingCsv(flow.rows, { profile: EXPORT_PROFILES.REIMPORT });
  const headers = parseCsv(csv.content).rows[0];
  const mapping = suggestMapping(headers, flow.type);
  for (const header of REIMPORT_HEADERS) assert.equal(mapping[header], header, `${flow.type}: "${header}" mapeia 1:1 sem intervenção`);
  const result = await analyzeImport({ text: csv.content, type: flow.type, mapping, rules: {} }, ADMIN_ACTOR);
  const planRows = planRowsOf(result);
  assert.equal(planRows.length, flow.rows.length, `${flow.type}: uma linha de plano por linha do arquivo`);
  const statuses = planRows.map(statusOf);
  assert.ok(statuses.every((status) => status === ROW_STATUS.JA_EXISTE), `${flow.type}: 100% "${ROW_STATUS.JA_EXISTE}" (obtido: ${JSON.stringify(statuses)})`);
  results[flow.type] = { rows: planRows.length, jaExiste: statuses.length };
}
const after = await snapshotCounts();
assert.deepEqual(after, before, 'NEGATIVO: a análise (dry-run) não grava em nenhuma store');
setActorProvider(null);

await deleteDbForTests();
console.log(JSON.stringify({ ...partial, ok: true, roundTrip: results, writes: 0 }, null, 2));
