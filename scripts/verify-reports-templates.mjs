// Gate reports:templates:verify (R3) — modelos em appSettings (sem store nova), formato
// versionado, PERSONAL × SHARED, reports.templates.share, só configuração (nunca dados),
// revalidação ao abrir (modelo não amplia permissão), favoritos e recentes por usuário.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import storage from '../src/storage/storageAdapter.js';
import { STORE_NAMES } from '../src/storage/indexedDb/schema.js';
import {
  TEMPLATE_VERSION, deleteTemplate, getFavorites, getRecents, listTemplates, recordRecent, saveTemplate, templateToRequest, toggleFavorite,
} from '../src/modules/reporting/application/reportTemplateService.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const { db } = await seedReportFixture();
assert.ok(!STORE_NAMES.some((name) => /template|report/i.test(name)), 'nenhuma store nova de modelos/relatórios');

const config = {
  baseReportId: 'desempenho.lote',
  columns: ['animal', 'marca', 'peso_final', 'gmd'],
  filters: { sexo: { operator: 'in', values: ['M'] } },
  groups: [{ columnId: 'lote' }],
  aggregates: [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'gmd', columnId: 'gmd', op: 'weightedGmd' }],
  sort: [{ columnId: 'gmd', direction: 'desc' }],
  period: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' },
};

// Pessoal (OPERADOR pode criar o próprio) e compartilhado (só com reports.templates.share)
const pessoal = await saveTemplate({ ...config, name: 'GMD machos', scope: 'PERSONAL' }, OPERADOR, { now: '2026-09-15T10:00:00.000Z' });
assert.equal(pessoal.version, TEMPLATE_VERSION);
assert.equal(pessoal.scope, 'PERSONAL');
assert.equal(pessoal.ownerUserId, OPERADOR.id);
assert.equal(await code(() => saveTemplate({ ...config, name: 'Tentativa', scope: 'SHARED' }, OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não compartilha');
assert.equal(await code(() => saveTemplate({ ...config, name: 'Tentativa', scope: 'SHARED' }, CONSULTA)), 'AUTH_FORBIDDEN', 'CONSULTA não compartilha');
const compartilhado = await saveTemplate({ ...config, name: 'GMD engorda', scope: 'SHARED' }, GESTOR);
assert.equal(compartilhado.scope, 'SHARED');

// Persistência em appSettings: formato versionado e SEM dados
const stored = (await db.table('appSettings').get('report-templates:local')).value;
assert.equal(stored.version, 1);
assert.equal(stored.templates.length, 2);
const serialized = JSON.stringify(stored);
for (const forbidden of ['"rows"', '"data"', '"population"', '345', 'Frigo Sul']) assert.ok(!serialized.includes(forbidden), `modelo não guarda dados (${forbidden})`);
assert.deepEqual(Object.keys(stored.templates[0]).sort(), ['aggregates', 'baseReportId', 'baseReportVersion', 'columns', 'createdAt', 'filters', 'groups', 'id', 'name', 'orientation', 'ownerName', 'ownerUserId', 'params', 'period', 'scope', 'search', 'sort', 'updatedAt', 'updatedBy', 'version', 'widths'].sort());

// Visibilidade: dono vê o pessoal; todos veem o compartilhado
assert.deepEqual((await listTemplates(OPERADOR)).map((t) => t.name).sort(), ['GMD engorda', 'GMD machos']);
assert.deepEqual((await listTemplates(GESTOR)).map((t) => t.name), ['GMD engorda'], 'pessoal de outro usuário é invisível');
assert.deepEqual((await listTemplates(CONSULTA)).map((t) => t.name), ['GMD engorda']);

// Edição/exclusão
assert.equal(await code(() => saveTemplate({ ...config, id: pessoal.id, name: 'Invasão', scope: 'PERSONAL' }, GESTOR)), 'AUTH_FORBIDDEN', 'GESTOR não altera pessoal alheio');
assert.equal(await code(() => deleteTemplate(pessoal.id, ADMIN)), 'AUTH_FORBIDDEN', 'nem ADMIN apaga pessoal alheio');
assert.equal(await code(() => deleteTemplate(compartilhado.id, OPERADOR)), 'AUTH_FORBIDDEN', 'OPERADOR não apaga compartilhado');
const renomeado = await saveTemplate({ ...config, id: compartilhado.id, name: 'GMD engorda (v2)', scope: 'SHARED' }, ADMIN, { now: '2026-09-15T11:00:00.000Z' });
assert.equal(renomeado.ownerUserId, GESTOR.id, 'dono preservado na edição');
assert.equal(renomeado.createdAt, compartilhado.createdAt);
assert.equal(await code(() => saveTemplate({ ...config, name: 'gmd MACHOS', scope: 'PERSONAL' }, OPERADOR)), 'REPORT_TEMPLATE_INVALID', 'nome duplicado');

// Validação estrutural
assert.equal(await code(() => saveTemplate({ ...config, name: 'x', columns: ['xpto'] }, GESTOR)), 'REPORT_TEMPLATE_INVALID');
assert.equal(await code(() => saveTemplate({ ...config, name: 'x', groups: [{ columnId: 'peso_final' }] }, GESTOR)), 'REPORT_TEMPLATE_INVALID', 'grupo não agrupável');
assert.equal(await code(() => saveTemplate({ ...config, name: 'x', aggregates: [{ columnId: 'marca', op: 'sum' }] }, GESTOR)), 'REPORT_TEMPLATE_INVALID', 'total inválido');
assert.equal(await code(() => saveTemplate({ ...config, name: 'x', period: { preset: 'semana_que_vem' } }, GESTOR)), 'REPORT_TEMPLATE_INVALID');
assert.equal(await code(() => saveTemplate({ ...config, name: 'x', groups: [{ columnId: 'marca' }, { columnId: 'sexo' }, { columnId: 'lote' }, { columnId: 'raca' }] }, GESTOR)), 'REPORT_TEMPLATE_INVALID', '4 níveis');

// Modelo nunca amplia permissão: coluna comercial num modelo compartilhado some para CONSULTA
const comercial = await saveTemplate({ baseReportId: 'pesagens.periodo', name: 'Vendas com valor', scope: 'SHARED', columns: ['data_pesagem', 'numero_animal', 'valor_venda_total'], filters: { valor_venda_total: { operator: 'greater', value: '0' } }, period: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } }, ADMIN);
assert.equal(await code(() => saveTemplate({ baseReportId: 'pesagens.periodo', name: 'Sem permissão', columns: ['valor_venda_total'] }, OPERADOR)), 'AUTH_FORBIDDEN', 'autor não grava coluna que não vê');
const paraConsulta = templateToRequest(comercial, 'CONSULTA');
assert.deepEqual(paraConsulta.selection.columns, ['data_pesagem', 'numero_animal']);
assert.deepEqual(paraConsulta.selection.filters, {}, 'filtro em coluna sensível removido');
assert.equal(paraConsulta.warnings[0].code, 'TEMPLATE_COLUMNS_REMOVED');
const vmConsulta = await runReport(paraConsulta.reportId, { today: TODAY, params: paraConsulta.params, selection: paraConsulta.selection }, CONSULTA);
assert.ok(!vmConsulta.columns.some((column) => column.id === 'valor_venda_total'));

// Aplicar modelo reproduz a configuração
const request = templateToRequest(renomeado, 'GESTOR');
const vm = await runReport(request.reportId, { today: TODAY, params: request.params, selection: request.selection }, GESTOR);
assert.deepEqual(vm.columns.map((column) => column.id), config.columns);
assert.deepEqual(vm.groups.map((group) => group.columnId), ['lote']);
assert.deepEqual(vm.rows.map((row) => row.animal_id).sort(), ['A1', 'A3'], 'filtro sexo = M aplicado');
assert.equal(vm.period.from, '2026-08-01');

// Favoritos e recentes por usuário (appSettings)
assert.deepEqual(await toggleFavorite('rebanho.inventario', GESTOR), ['rebanho.inventario']);
assert.deepEqual(await getFavorites(OPERADOR), [], 'favoritos são por usuário');
assert.deepEqual(await toggleFavorite('rebanho.inventario', GESTOR), []);
await recordRecent('pesagens.periodo', GESTOR, { now: '2026-09-15T09:00:00.000Z' });
await recordRecent('desempenho.lote', GESTOR, { templateId: renomeado.id, now: '2026-09-15T09:05:00.000Z' });
await recordRecent('pesagens.periodo', GESTOR, { now: '2026-09-15T09:10:00.000Z' });
assert.deepEqual((await getRecents(GESTOR)).map((item) => item.reportId), ['pesagens.periodo', 'desempenho.lote'], 'recente sem duplicar, mais novo primeiro');
assert.equal(await code(() => toggleFavorite('inexistente', GESTOR)), 'REPORT_TEMPLATE_INVALID');

// Persistência sobrevive a reabrir o banco
storage.resetForTests?.();
assert.equal((await listTemplates(OPERADOR)).length, 3);
assert.ok(await deleteTemplate(pessoal.id, OPERADOR));
assert.equal((await listTemplates(OPERADOR)).length, 2);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:templates:verify', ok: true }, null, 2));
