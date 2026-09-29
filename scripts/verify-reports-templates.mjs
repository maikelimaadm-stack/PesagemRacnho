// Gate reports:templates:verify (R3) — modelos em appSettings (sem store nova), formato
// versionado, PERSONAL × SHARED, reports.templates.share, só configuração (nunca dados),
// revalidação ao abrir (modelo não amplia permissão), favoritos e recentes por usuário.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, GESTOR, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import storage from '../src/storage/storageAdapter.js';
import { STORE_NAMES } from '../src/storage/indexedDb/schema.js';
import {
  TEMPLATE_VERSION, deleteTemplate, getFavorites, getRecents, getReportViewState, listTemplates, recordRecent, saveReportViewState, saveTemplate, templateToRequest, toggleFavorite,
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
// id (uuid aleatório) e datas (relógio real) ficam fora da busca: "345" pode aparecer neles por acaso.
const serialized = JSON.stringify(stored, (key, value) => (['id', 'createdAt', 'updatedAt'].includes(key) ? undefined : value));
for (const forbidden of ['"rows"', '"data"', '"population"', '345', 'Frigo Sul']) assert.ok(!serialized.includes(forbidden), `modelo não guarda dados (${forbidden})`);
// E1 (1.4.0): o modelo guarda também o modo (Resumido/Detalhado) e a ordem do Resumido.
assert.deepEqual(Object.keys(stored.templates[0]).sort(), ['aggregates', 'baseReportId', 'baseReportVersion', 'columns', 'createdAt', 'filters', 'groups', 'id', 'mode', 'name', 'orientation', 'ownerName', 'ownerUserId', 'params', 'period', 'scope', 'search', 'sort', 'summarySort', 'updatedAt', 'updatedBy', 'version', 'widths'].sort());
assert.equal(stored.templates[0].baseReportId, 'desempenho', 'salvar a partir do id antigo grava o id novo');
assert.equal(stored.templates[0].mode, null, 'sem modo escolhido: abre no padrão da definição');

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

// Revisão UX (bloqueante): modelo com filtro de lista por RÓTULO (como a tela grava) em entidade/enum
// abre com a população correta já na primeira execução — sem depender de execução anterior da tela.
const porRotulo = await saveTemplate({ ...config, name: 'ALFA machos', scope: 'PERSONAL', filters: { marca: { operator: 'in', values: ['ALFA'], match: 'label' }, sexo: { operator: 'in', values: ['Macho'], match: 'label' } } }, GESTOR);
assert.deepEqual(porRotulo.filters.marca, { operator: 'in', value: '', valueTo: '', values: ['ALFA'], match: 'label' }, 'match "label" persiste no modelo');
const reqRotulo = templateToRequest(porRotulo, 'GESTOR');
const vmRotulo = await runReport(reqRotulo.reportId, { today: TODAY, params: reqRotulo.params, selection: reqRotulo.selection }, GESTOR);
assert.deepEqual(vmRotulo.rows.map((row) => row.animal_id).sort(), ['A1', 'A3'], 'rótulo ALFA/Macho encontra os animais (antes: 0 linhas)');
const vmFora = await runReport('desempenho.lote', { today: TODAY, params: reqRotulo.params, selection: { ...reqRotulo.selection, filters: { marca: { operator: 'not_in', values: ['alfa'], match: 'label' } } } }, GESTOR);
assert.ok(vmFora.rows.length > 0 && vmFora.rows.every((row) => row.marca_id !== 'm-alfa'), 'not_in por rótulo, sem acento/caixa');
const vmPorId = await runReport('desempenho.lote', { today: TODAY, params: reqRotulo.params, selection: { ...reqRotulo.selection, filters: { marca: { operator: 'in', values: ['ALFA'] } } } }, GESTOR);
assert.equal(vmPorId.rowCount, 0, 'sem match "label" o contrato continua comparando o id');

// Reaproveitamento na mesma tela: só mudou a seleção → mesmas linhas, sem reler; mudou parâmetro → relê.
const reuso = await runReport(reqRotulo.reportId, { today: TODAY, params: reqRotulo.params, selection: { ...reqRotulo.selection, filters: {} }, reuse: vmRotulo }, GESTOR);
assert.match(reuso.stats.strategy, /\+reuse$/);
assert.equal(reuso.sourceLoaded.rows, vmRotulo.sourceLoaded.rows, 'mesma referência de linhas');
const outroPeriodo = await runReport(reqRotulo.reportId, { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-02', to: '2026-09-15' } }, selection: reqRotulo.selection, reuse: vmRotulo }, GESTOR);
assert.doesNotMatch(outroPeriodo.stats.strategy, /reuse/, 'parâmetro diferente relê o banco');
await deleteTemplate(porRotulo.id, GESTOR);

// Listagem nunca entrega colunas/filtros que o papel não vê (modelo compartilhado com valor comercial).
const listadoConsulta = (await listTemplates(CONSULTA)).find((template) => template.id === comercial.id);
assert.deepEqual(listadoConsulta.columns, ['data_pesagem', 'numero_animal'], 'listagem sanitizada');
assert.deepEqual(listadoConsulta.filters, {}, 'filtro comercial não vaza na listagem');
assert.deepEqual((await listTemplates(ADMIN)).find((template) => template.id === comercial.id).columns, ['data_pesagem', 'numero_animal', 'valor_venda_total']);

// E1: modo e ordem do Resumido salvos e restaurados; modelo sem modo abre no padrão da definição.
const comModo = await saveTemplate({ ...config, name: 'Resumo por lote', scope: 'PERSONAL', mode: 'RESUMIDO', summarySort: { key: 'gmd', direction: 'desc' } }, GESTOR);
assert.equal(comModo.mode, 'RESUMIDO');
assert.deepEqual(comModo.summarySort, { key: 'gmd', direction: 'desc' });
const reqModo = templateToRequest(comModo, 'GESTOR');
assert.equal(reqModo.selection.mode, 'RESUMIDO');
const vmModo = await runReport(reqModo.reportId, { today: TODAY, params: reqModo.params, selection: reqModo.selection }, GESTOR);
assert.equal(vmModo.mode, 'RESUMIDO');
assert.deepEqual(vmModo.summarySort, { key: 'gmd', direction: 'desc' });
// Modelo sem modo (anterior à 1.4.0) — resposta 3 da responsável: Resumido só se tiver agrupamento.
assert.equal(templateToRequest({ ...comModo, groups: [{ columnId: 'lote', direction: 'asc' }], mode: undefined }, 'GESTOR').selection.mode, 'RESUMIDO', 'sem modo + agrupado → Resumido');
assert.equal(templateToRequest({ ...comModo, groups: [], mode: undefined }, 'GESTOR').selection.mode, 'DETALHADO', 'sem modo + sem agrupamento → Detalhado (mesmo em relatório que nasce resumido)');
assert.equal(templateToRequest({ ...comModo, baseReportId: 'embarques.romaneio', columns: [], groups: [], aggregates: [], sort: [], filters: {}, mode: undefined }, 'GESTOR').selection.mode, 'DETALHADO', 'Romaneio salvo como lista abre Detalhado (não um Resumido só com o Total geral)');
assert.equal(templateToRequest({ ...comModo, baseReportId: 'comercial.vendas', columns: [], groups: [], aggregates: [], sort: [], filters: {}, mode: undefined }, 'GESTOR').selection.mode, 'DETALHADO', 'sem modo → relatório sem grupo abre Detalhado');
assert.equal(templateToRequest({ ...comModo, groups: [], mode: 'RESUMIDO' }, 'GESTOR').selection.mode, 'RESUMIDO', 'modo gravado prevalece');
assert.equal(await code(() => saveTemplate({ ...config, name: 'Modo ruim', mode: 'COMPACTO' }, GESTOR)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: modo inválido');
await deleteTemplate(comModo.id, GESTOR);

// Favoritos e recentes por usuário (appSettings)
assert.deepEqual(await toggleFavorite('rebanho.atual', GESTOR), ['rebanho.atual']);
assert.deepEqual(await getFavorites(OPERADOR), [], 'favoritos são por usuário');
assert.deepEqual(await toggleFavorite('rebanho.atual', GESTOR), []);
// Id antigo como favorito vira "novo#antigo" (abre o relatório novo com a visão do antigo).
assert.deepEqual(await toggleFavorite('rebanho.dimensao.raca', GESTOR), ['rebanho.atual#rebanho.dimensao.raca']);
assert.deepEqual(await toggleFavorite('rebanho.atual#rebanho.dimensao.raca', GESTOR), []);
await recordRecent('pesagens.periodo', GESTOR, { now: '2026-09-15T09:00:00.000Z' });
await recordRecent('desempenho', GESTOR, { templateId: renomeado.id, now: '2026-09-15T09:05:00.000Z' });
await recordRecent('pesagens.periodo', GESTOR, { now: '2026-09-15T09:10:00.000Z' });
assert.deepEqual((await getRecents(GESTOR)).map((item) => `${item.reportId}#${item.presetId ?? ''}`), ['pesagens#pesagens.periodo', 'desempenho#'], 'recente sem duplicar, mais novo primeiro (id antigo → novo + visão)');
assert.equal(await code(() => toggleFavorite('inexistente', GESTOR)), 'REPORT_TEMPLATE_INVALID');
assert.equal(await code(() => toggleFavorite('pesagens#rebanho.dimensao.raca', GESTOR)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: visão de outro relatório');

// E1B: último estado de cada relatório por usuário (report-view-state) — preferência de tela, sem auditoria.
const estado = {
  columns: ['data_pesagem', 'numero_animal', 'peso'], filters: { sexo: { operator: 'in', values: ['Macho'] } },
  fixedFilters: { tipo_manejo: { operator: 'in', values: ['Saída'], match: 'code' } },
  groups: [{ columnId: 'nome_lote' }], aggregates: [{ id: 'qtd', columnId: 'numero_animal', op: 'countDistinct' }],
  mode: 'RESUMIDO', orientation: 'landscape', period: { preset: 'ultimos_30_dias' }, showEmptyColumns: true,
};
const gravado = await saveReportViewState('pesagens', estado, OPERADOR, { now: '2026-09-15T11:00:00.000Z' });
assert.equal(gravado.fixedFilters, undefined, 'condição fixa (de modelo/visão antiga) nunca entra no último estado');
const reaberto = await getReportViewState('pesagens', OPERADOR);
assert.deepEqual(reaberto.selection.groups.map((group) => group.columnId), ['nome_lote'], 'reabre com o agrupamento');
assert.equal(reaberto.selection.mode, 'RESUMIDO');
assert.equal(reaberto.orientation, 'landscape');
assert.equal(reaberto.showEmptyColumns, true);
assert.equal(reaberto.selection.fixedFilters, undefined, 'reaberto sem condição fixa');
// E1D: estado de Pesagens sem tipo que não era um tipo da E1B abre "Personalizado" (explícito), com a seleção dele.
assert.equal(reaberto.selection.view, null, 'E1D: sem tipo da E1B → Personalizado');
assert.equal(await getReportViewState('pesagens', GESTOR), null, 'último estado é por usuário');
// Estado gravado com condição fixa (versão de desenvolvimento anterior) → a condição é descartada ao ler.
const chaveEstado = 'report-view-state:local:' + OPERADOR.id;
const bruto = (await db.table('appSettings').get(chaveEstado)).value;
bruto.reports.pesagens.fixedFilters = { tipo_manejo: { operator: 'in', values: ['Saída'], match: 'code' } };
await db.table('appSettings').put({ key: chaveEstado, value: bruto });
assert.equal((await getReportViewState('pesagens', OPERADOR)).selection.fixedFilters, undefined, 'NEGATIVO: condição fixa antiga não volta');
assert.equal(await code(() => saveReportViewState('comercial.vendas', { ...estado, fixedFilters: {} }, OPERADOR)), 'AUTH_FORBIDDEN', 'NEGATIVO: relatório que o papel não abre');
assert.equal(await getReportViewState('comercial.vendas', OPERADOR), null);

// Persistência sobrevive a reabrir o banco
storage.resetForTests?.();
assert.equal((await listTemplates(OPERADOR)).length, 3);
assert.ok(await deleteTemplate(pessoal.id, OPERADOR));
assert.equal((await listTemplates(OPERADOR)).length, 2);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:templates:verify', ok: true }, null, 2));
