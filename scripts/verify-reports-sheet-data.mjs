// Gate reports:sheet-data:verify (E1B 1.4.0) — dados, colunas e visões da FOLHA dos relatórios, tudo
// pelo motor da E1 (nenhuma conta nova fora de aggregateEngine/reportAggregates/groupEngine):
//   1. Faixa exigida do lote na linha (pelo lote_id, sem fallback por nome) e no agregado do nível lote.
//   2. @ de PESO VIVO com divisor 30 e 15 (request.arrobaDivisor e Configurações › Relatórios):
//      Média (@) = Peso médio ÷ divisor, Total (@) = Peso total ÷ divisor — também no ganho.
//   3. vm.arrobaDivisor e manifesto; reuse com divisor diferente não reaproveita linhas.
//   4. Machos/Fêmeas (0 onde não há), animais com pesagem anterior, filtro "Pesagem anterior" sim/não.
//   5. "Tipo de relatório": cada visão de Pesagens = a seleção equivalente; padrão + analítico gerados
//      para relatório sem visões; defineReport recusa visão incoerente. E1D: os tipos de Pesagens são os
//      5 do MAKGESTAO; onde este gate usava um tipo da E1B que saiu ("Por lote", "Por data", "Analítico
//      por animal") para exercitar a folha, usa a MESMA seleção escrita à mão (agora "Personalizado").
//   6. Rótulos de curral no cabeçalho do Resumido; kg agregado com 1 casa, @ com 2, GMD com 3.
//   7. Colunas novas não sensíveis e nenhum valor comercial vaza para quem não vê.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { getReportDefinition, listAllReportDefinitions, LEGACY_REPORT_ALIASES } from '../src/modules/reporting/definitions/reportCatalog.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { ANALYTIC_EVENT_COLUMNS, SHEET_COLUMN_KEYS, SHEET_TOTALS, SHEET_TOTALS_SEM_FAIXA, VENDAS_COLUMNS, VENDAS_POPULATION, VENDAS_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';
import { defineReport, createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { defineColumn } from '../src/modules/reporting/domain/columnDefinition.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { applyColumnKeys, filtersForDisplay, listReportViews, matchView, parseSortChoice, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { buildSummaryLayout, summaryMetrics, SUMMARY_LABEL_SORT } from '../src/modules/reporting/domain/summaryLayout.js';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { buildReportDocument, orderNodes } from '../src/modules/reporting/domain/reportDocument.js';
import { aggregateValueColumn } from '../src/modules/reporting/domain/aggregateLabels.js';
import { buildReportLines } from '../src/modules/reporting/infrastructure/exporters/reportLayout.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { buildEventLookups, enrichEventRows, normalizeLiveArrobaDivisor } from '../src/modules/reporting/infrastructure/reportSources/eventRows.js';
import { getReportSettings, updateAppConfig } from '../src/modules/settings/application/appConfigService.js';
import storage from '../src/storage/storageAdapter.js';
import { can } from '../src/modules/auth/domain/permissionService.js';

const PERIOD = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const PESAGENS = getReportDefinition('pesagens');
const run = (selection = {}, extra = {}, actor = ADMIN) => runReport('pesagens', { today: TODAY, params: PERIOD, selection, ...extra }, actor);
const close = (actual, expected, message) => {
  if (expected === null) return assert.equal(actual, null, message);
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
};
const byLabel = (vm) => Object.fromEntries(vm.summaryRows.map((row) => [row.label, row]));
const value = (node, id) => node.aggregates[id]?.value ?? null;
const NEW_COLUMNS = ['lote_peso_minimo', 'lote_peso_maximo', 'peso_arroba', 'ganho_arroba', 'animais_machos', 'animais_femeas', 'animais_com_anterior', 'tem_pesagem_anterior'];
const FOLHA_IDS = ['qtd', 'faixa_min', 'faixa_max', 'menor', 'maior', 'peso_medio', 'media_arroba', 'peso_total', 'total_arroba', 'ganho_medio', 'ganho_medio_arroba', 'ganho_total', 'ganho_total_arroba', 'dias_medios', 'gmd_medio', 'machos', 'femeas'];
// Seleções da folha escritas à mão (as dos tipos "Por lote" e "Por data" da E1B, que saíram na E1D):
// continuam válidas como "Personalizado" e exercitam todas as métricas da folha.
const POR_LOTE = { mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: SHEET_TOTALS };
const POR_DATA = { mode: 'RESUMIDO', groups: [{ columnId: 'data_pesagem', direction: 'desc' }], aggregates: SHEET_TOTALS_SEM_FAIXA };
const APDATA_GROUPS = [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem', direction: 'desc' }, { columnId: 'nome_lote' }];

// ---- 0. Colunas novas: existem, não sensíveis, derivadas/atuais, fora da Relação ----
for (const id of NEW_COLUMNS) {
  const column = EVENT_COLUMNS.find((item) => item.id === id);
  assert.ok(column, `coluna ${id} existe`);
  assert.equal(column.sensitive, null, `${id}: não sensível`);
  assert.equal(column.defaultVisible, false, `${id}: fora das colunas padrão`);
  assert.ok(['derivado', 'atual'].includes(column.source), `${id}: origem derivado/atual`);
}
assert.deepEqual(SHEET_TOTALS.map((spec) => spec.id), FOLHA_IDS, 'métricas da folha: ids fixos, nesta ordem');
assert.equal(EVENT_COLUMNS.find((item) => item.id === 'peso').decimals, null, 'coluna peso continua sem casas próprias (Relação/exportação com 2)');

// Accessors da @ viva: ausente → null (nunca 0); zero de verdade continua zero; sem divisor → null.
const eventResolve = createColumnResolver(EVENT_COLUMNS);
assert.equal(eventResolve('peso_arroba').valueOf({ peso: null, arroba_divisor: 30 }), null, '@ sem peso → null');
assert.equal(eventResolve('peso_arroba').valueOf({ peso: 300, arroba_divisor: 30 }), 10, '300 kg ÷ 30 = 10 @');
assert.equal(eventResolve('peso_arroba').valueOf({ peso: 300, arroba_divisor: 15 }), 20, '300 kg ÷ 15 = 20 @');
assert.equal(eventResolve('peso_arroba').valueOf({ peso: 300 }), null, 'sem divisor na linha → null');
assert.equal(eventResolve('ganho_arroba').valueOf({ ganho: 0, arroba_divisor: 30 }), 0, 'ganho 0 de verdade → 0 @');
assert.equal(eventResolve('ganho_arroba').valueOf({ ganho: null, arroba_divisor: 30 }), null, 'sem pesagem anterior → null @');
assert.equal(eventResolve('animais_machos').groupKeyOf({ sexo: 'Macho', animal_key: 'A9' }), 'A9', 'legado "Macho" conta como macho');
assert.equal(eventResolve('animais_femeas').groupKeyOf({ sexo: 'M', animal_key: 'A9' }), null, 'macho não conta em Fêmeas');
assert.equal(normalizeLiveArrobaDivisor(20), 30, 'divisor fora de 30/15 na fonte → 30');

// Fonte pura: faixa só pelo lote_id (nome se repete entre apartações), divisor na linha.
const lookups = buildEventLookups({ lotes: [{ id: 'L9', nome_lote: 'Lote X', peso_minimo: 100, peso_maximo: 200 }], arrobaDivisor: 15 });
const [comId, soNome] = enrichEventRows([
  { id: 'x1', lote_id: 'L9', nome_lote: 'Lote X', numero_animal: '1', peso: 300 },
  { id: 'x2', lote_id: null, nome_lote: 'Lote X', numero_animal: '2', peso: 300 },
], lookups);
assert.deepEqual([comId.lote_peso_minimo, comId.lote_peso_maximo, comId.arroba_divisor], [100, 200, 15], 'faixa e divisor na linha');
assert.deepEqual([soNome.lote_peso_minimo, soNome.lote_peso_maximo], [null, null], 'NEGATIVO: sem lote_id não busca faixa pelo nome');

// Sessão agrupa em ordem de DATA: o rótulo "dd/mm/aaaa · status" ordenado como texto punha
// 01/01/2026 antes de 01/10/2025 (Sessão continua no "Agrupar por"; até a E1C era o tipo que Pesagens abria).
const sessionRows = enrichEventRows(['S1', 'S2', 'S3'].map((sessao_id, index) => ({ id: `s${index}`, sessao_id, numero_animal: String(index), peso: 300 })), buildEventLookups({
  sessoes: [{ id: 'S1', data: '2026-01-01', status: 'ABERTA' }, { id: 'S2', data: '2025-10-01', status: 'FECHADA' }, { id: 'S3', data: '2025-12-02', status: 'ABERTA' }],
}));
const sessionLabels = (direction) => groupRows(sessionRows, [{ columnId: 'sessao', direction }], eventResolve).nodes.map((node) => node.label);
assert.deepEqual(sessionLabels('asc'), ['01/10/2025 · fechada', '02/12/2025 · aberta', '01/01/2026 · aberta'], 'sessões em ordem cronológica');
assert.deepEqual(sessionLabels('desc'), ['01/01/2026 · aberta', '02/12/2025 · aberta', '01/10/2025 · fechada'], 'sessões da mais nova para a mais antiga');
const sessionTreeVm = { tree: groupRows(sessionRows, [{ columnId: 'sessao' }], eventResolve).nodes };
assert.deepEqual(orderNodes(sessionTreeVm.tree, { key: SUMMARY_LABEL_SORT, direction: 'desc' }).map((node) => node.label), sessionLabels('desc'), '"Ordenar por rótulo" da folha também segue a data da sessão');

await seedReportFixture();

// ---- 1. Faixa do lote na linha e no nível lote ----
const detalhe = await run({ mode: 'DETALHADO', groups: [], columns: ['data_pesagem', 'numero_animal', 'nome_lote', 'lote_peso_minimo', 'lote_peso_maximo', 'peso', 'peso_arroba'] }, { arrobaDivisor: 30 });
const rowById = Object.fromEntries(detalhe.rows.map((row) => [row.id, row]));
assert.deepEqual([rowById.e1.lote_peso_minimo, rowById.e1.lote_peso_maximo], [300, 400], 'e1 (Lote 01): faixa 300–400');
assert.deepEqual([rowById.e4.lote_peso_minimo, rowById.e4.lote_peso_maximo], [200, 300], 'e4 (Lote 02): faixa 200–300');
assert.deepEqual([rowById.e9.lote_peso_minimo, rowById.e9.lote_peso_maximo], [null, null], 'e9 sem lote: faixa vazia');
assert.ok(detalhe.rows.every((row) => row.arroba_divisor === 30), 'divisor 30 em toda linha');

const porLote30 = await run(POR_LOTE, { arrobaDivisor: 30 });
const lotes30 = byLabel(porLote30);
assert.deepEqual(Object.keys(lotes30), ['Lote 01', 'Lote 02', 'Não informado'], 'Por lote: Lote 01, Lote 02, Não informado');
assert.deepEqual([value(lotes30['Lote 01'], 'faixa_min'), value(lotes30['Lote 01'], 'faixa_max')], [300, 400], 'Lote 01: faixa exigida 300–400');
assert.deepEqual([value(lotes30['Lote 02'], 'faixa_min'), value(lotes30['Lote 02'], 'faixa_max')], [200, 300], 'Lote 02: faixa exigida 200–300');
assert.deepEqual([value(lotes30['Não informado'], 'faixa_min'), value(lotes30['Não informado'], 'faixa_max')], [null, null], 'sem lote: faixa "—"');
assert.deepEqual(porLote30.metricPairs.map((pair) => [pair.id, pair.from, pair.to, pair.leafOnly]), [['faixa', 'faixa_min', 'faixa_max', true]], 'vm.metricPairs: Faixa exigida');

// ---- 2. @ viva = kg ÷ divisor (30 e 15), no nó e no total ----
const checkArroba = (vm, divisor, context) => {
  assert.equal(vm.arrobaDivisor, divisor, `${context}: vm.arrobaDivisor`);
  for (const node of [...vm.summaryRows, { label: 'Total geral', aggregates: vm.totals }]) {
    const at = (id) => value(node, id);
    close(at('media_arroba'), at('peso_medio') === null ? null : at('peso_medio') / divisor, `${context} ${node.label}: Média (@) = Peso médio ÷ ${divisor}`);
    close(at('total_arroba'), at('peso_total') === null ? null : at('peso_total') / divisor, `${context} ${node.label}: Total (@) = Peso total ÷ ${divisor}`);
    close(at('ganho_medio_arroba'), at('ganho_medio') === null ? null : at('ganho_medio') / divisor, `${context} ${node.label}: Ganho médio (@)`);
    close(at('ganho_total_arroba'), at('ganho_total') === null ? null : at('ganho_total') / divisor, `${context} ${node.label}: Ganho total (@)`);
  }
};
checkArroba(porLote30, 30, 'divisor 30');
close(porLote30.totals.peso_total.value, 2375, 'peso total da massa');
close(porLote30.totals.total_arroba.value, 2375 / 30, 'Total (@) geral = 2375 ÷ 30');
const porLote15 = await run(POR_LOTE, { arrobaDivisor: 15 });
checkArroba(porLote15, 15, 'divisor 15');
close(porLote15.totals.total_arroba.value, 2375 / 15, 'Total (@) geral = 2375 ÷ 15');
await assert.rejects(() => run({}, { arrobaDivisor: 20 }), /divisor da arroba/, 'NEGATIVO: divisor fora de 30/15 é recusado');

// Pelas Configurações (sem arrobaDivisor na chamada): padrão 30, gravado 15, gravado inválido → 30.
assert.equal((await getReportSettings()).arroba_divisor, 30, 'Configurações: padrão 30');
const semDivisor = await run(POR_LOTE);
assert.equal(semDivisor.arrobaDivisor, 30, 'sem configuração: divisor 30');
await updateAppConfig(ADMIN, { arroba_divisor: 15 });
const configurado = await run(POR_LOTE);
checkArroba(configurado, 15, 'Configurações 15');
assert.equal(configurado.rows.every((row) => row.arroba_divisor === 15), true, 'linhas com o divisor configurado');
await storage.settings.set('report-settings:local', { versao: 1, arroba_divisor: 20 });
assert.equal((await run({})).arrobaDivisor, 30, 'valor inválido gravado volta ao padrão 30');
await updateAppConfig(ADMIN, { arroba_divisor: 30 });

// ---- 3. Manifesto e reuse ----
for (const format of ['csv', 'json', 'xlsx']) {
  const { manifest } = await prepareEmission(porLote15, format, ADMIN);
  assert.equal(manifest.arrobaDivisor, 15, `manifesto ${format}: divisor usado`);
}
const base = await run(POR_LOTE, { arrobaDivisor: 30 });
const trocado = await run(POR_LOTE, { arrobaDivisor: 15, reuse: base });
assert.notEqual(trocado.sourceKey, base.sourceKey, 'divisor entra no sourceKey');
assert.ok(!trocado.stats.strategy.includes('+reuse'), 'NEGATIVO: divisor diferente não reaproveita as linhas');
checkArroba(trocado, 15, 'depois de trocar o divisor');
const mesmo = await run(POR_DATA, { arrobaDivisor: 15, reuse: trocado });
assert.ok(mesmo.stats.strategy.endsWith('+reuse'), 'mesmo divisor: reaproveita (só mudou o agrupamento)');
checkArroba(mesmo, 15, 'reuse com o mesmo divisor');

// ---- 4. Machos/Fêmeas, animais com pesagem anterior, filtro Pesagem anterior ----
// A1 macho (L1), A2 fêmea (L2), A3 macho (L1), A4 fêmea (sem lote); com anterior: A1 (e2, e3) e A2 (e5).
const contagens = await run({ mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: [...SHEET_TOTALS, { id: 'n_anterior', columnId: 'animais_com_anterior', op: 'countDistinct' }] }, { arrobaDivisor: 30 });
const sexo = Object.fromEntries(contagens.summaryRows.map((row) => [row.label, [value(row, 'machos'), value(row, 'femeas'), value(row, 'n_anterior'), value(row, 'qtd')]]));
assert.deepEqual(sexo, { 'Lote 01': [2, 0, 1, 2], 'Lote 02': [0, 1, 1, 1], 'Não informado': [0, 1, 0, 1] }, 'Machos, Fêmeas, com anterior e Qtd por lote (0 onde não há)');
assert.deepEqual([contagens.totals.machos.value, contagens.totals.femeas.value, contagens.totals.n_anterior.value, contagens.totals.qtd.value], [2, 2, 2, 4], 'totais: 2 machos, 2 fêmeas, 2 com anterior, 4 animais');
const machosPublic = contagens.availableColumns.find((column) => column.id === 'animais_machos');
assert.equal(machosPublic.zeroAsEmpty, true, 'publicColumn expõe zeroAsEmpty');
assert.equal(contagens.availableColumns.find((column) => column.id === 'peso').zeroAsEmpty, undefined, 'só quem declara');
assert.equal(aggregateValueColumn({ op: 'countDistinct', columnId: 'animais_femeas' }, contagens.availableColumns).zeroAsEmpty, true, 'métrica Fêmeas pede 0 como vazio na folha');

const ids = (vm) => vm.rows.map((row) => row.id).sort();
const com = await run({ mode: 'DETALHADO', groups: [], filters: { tem_pesagem_anterior: { operator: 'equals', value: true } } });
const sem = await run({ mode: 'DETALHADO', groups: [], filters: { tem_pesagem_anterior: { operator: 'equals', value: false } } });
const preenchida = await run({ mode: 'DETALHADO', groups: [], filters: { data_anterior: { operator: 'not_empty' } } });
const vazia = await run({ mode: 'DETALHADO', groups: [], filters: { data_anterior: { operator: 'empty' } } });
assert.deepEqual(ids(com), ['e2', 'e3', 'e5'], 'Com pesagem anterior: e2, e3, e5');
assert.deepEqual(ids(com), ids(preenchida), 'sim = data anterior preenchida');
assert.deepEqual(ids(sem), ids(vazia), 'não = data anterior vazia');
assert.equal(ids(com).length + ids(sem).length, detalhe.rowCount, 'sim + não = população');
const porAnterior = await run({ mode: 'RESUMIDO', groups: [{ columnId: 'tem_pesagem_anterior' }] });
assert.deepEqual(buildSummaryLayout(porAnterior, 'screen').rows.map((row) => row.label), ['Não', 'Sim', 'Total geral'], 'agrupa por Pesagem anterior (Sim/Não)');

// ---- 5. Visões ("Tipo de relatório") ----
// E1D: os 5 tipos do MAKGESTAO, com os nomes e a ordem do antigo; abre em "Por Apartação (Resumo por Data)".
const views = listReportViews(PESAGENS);
assert.deepEqual(views.map((view) => [view.id, view.label]), [
  ['analitico', 'Analítico (Detalhado)'],
  ['sintetico-matriz', 'Sintético (Matriz)'],
  ['por-apartacao-lote', 'Por Apartação/Lote'],
  ['por-apartacao-data', 'Por Apartação (Resumo por Data)'],
  ['vendas', 'Vendas (Detalhado)'],
], 'tipos de Pesagens, nesta ordem');
assert.equal(PESAGENS.defaultView, 'por-apartacao-data', 'tipo padrão');
assert.ok(!views.some((view) => ['padrao', 'por-lote', 'por-data'].includes(view.id)), 'NEGATIVO: "Resumo por Sessão", "Por lote" e "Por data" (E1B) não são mais tipos');
assert.ok(views.every((view) => !LEGACY_REPORT_ALIASES[view.id] && !LEGACY_REPORT_ALIASES[`pesagens.${view.id}`]), 'visões fora dos aliases antigos');
assert.deepEqual(PESAGENS.defaultGroups, [{ columnId: 'sessao' }], 'defaultGroups de Pesagens inalterado');
assert.deepEqual(PESAGENS.defaultAggregates.map((spec) => spec.id), ['registros', 'animais', 'peso_medio', 'peso_min', 'peso_max', 'gmd_ponderado'], 'defaultAggregates de Pesagens inalterado');
// Colunas padrão do Analítico = as do antigo (item 4).
const ANALITICO_COLUMNS = ['data_pesagem', 'numero_animal', 'sexo', 'raca', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd'];
// Métricas visíveis por padrão nas tabelas por lote (item 5): Qtd, Faixa, Menor, Maior, Peso médio, Média (@),
// Peso total, GMD médio, Machos, Fêmeas (a coluna Lote é o rótulo).
const SHEET_DEFAULT_IDS = ['qtd', 'faixa_min', 'faixa_max', 'menor', 'maior', 'peso_medio', 'media_arroba', 'peso_total', 'gmd_medio', 'machos', 'femeas'];
const SHEET_DEFAULT = SHEET_TOTALS.filter((spec) => SHEET_DEFAULT_IDS.includes(spec.id));
// Seleção equivalente escrita à mão (contrato da E1D), comparada com o tipo: nenhum tipo faz conta nova.
const EQUIVALENT = {
  analitico: { mode: 'DETALHADO', groups: [], columns: ANALITICO_COLUMNS, aggregates: [{ id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }, { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' }] },
  // Matriz: Linhas (Sexo) › Colunas (Lote), célula = Qtd distinta, Peso médio, GMD ponderado.
  'sintetico-matriz': { mode: 'RESUMIDO', groups: [{ columnId: 'sexo' }, { columnId: 'nome_lote' }], aggregates: [{ id: 'qtd', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }, { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' }] },
  'por-apartacao-lote': { mode: 'RESUMIDO', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], aggregates: SHEET_DEFAULT },
  'por-apartacao-data': { mode: 'RESUMIDO', groups: APDATA_GROUPS, aggregates: SHEET_DEFAULT },
  // Vendas: população fixa = Saída por Venda (condição fixa, como "Vendas do período").
  vendas: { mode: 'DETALHADO', groups: [{ columnId: 'comprador' }], columns: [...VENDAS_COLUMNS], aggregates: VENDAS_TOTALS, fixedFilters: VENDAS_POPULATION },
};
const plain = (item) => JSON.parse(JSON.stringify(item));
let viewsChecked = 0;
for (const view of views) {
  const selection = viewSelection(view, PESAGENS);
  assert.equal(selection.view, view.id, `${view.id}: o tipo vai explícito na seleção`);
  assert.deepEqual(plain(viewSelection(view.id, PESAGENS)), plain(selection), `${view.id}: por id = por objeto`);
  const viaView = await run(selection, { arrobaDivisor: 30 });
  const viaMao = await run(EQUIVALENT[view.id], { arrobaDivisor: 30 });
  assert.equal(viaView.view?.id, view.id, `${view.id}: view model com o tipo`);
  assert.equal(viaMao.view, null, `${view.id}: seleção à mão é "Personalizado"`);
  assert.equal(viaView.mode, EQUIVALENT[view.id].mode, `${view.id}: modo`);
  assert.deepEqual(viaView.groups.map((group) => [group.columnId, group.direction ?? 'asc']), EQUIVALENT[view.id].groups.map((group) => [group.columnId, group.direction ?? 'asc']), `${view.id}: agrupamento e direção`);
  assert.deepEqual(viaView.aggregates, viaMao.aggregates, `${view.id}: totais`);
  assert.deepEqual(viaView.columns.map((column) => column.id), viaMao.columns.map((column) => column.id), `${view.id}: colunas`);
  assert.deepEqual(plain(viaView.totals), plain(viaMao.totals), `${view.id}: total geral = seleção equivalente`);
  assert.deepEqual((viaView.summaryRows ?? []).map((row) => [row.id, plain(row.aggregates)]), (viaMao.summaryRows ?? []).map((row) => [row.id, plain(row.aggregates)]), `${view.id}: linhas do Resumido = seleção equivalente`);
  assert.deepEqual(viaView.rows.map((row) => row.id), viaMao.rows.map((row) => row.id), `${view.id}: mesma população da seleção equivalente`);
  // Só Vendas recorta a população (Saída por Venda); os outros 4 usam todas as pesagens do período.
  if (view.id === 'vendas') assert.ok(viaView.rowCount > 0 && viaView.rowCount < detalhe.rowCount, 'Vendas: só as saídas por venda');
  else assert.equal(viaView.rowCount, detalhe.rowCount, `${view.id}: mesma população`);
  assert.equal(matchView(PESAGENS, { groups: EQUIVALENT[view.id].groups, mode: EQUIVALENT[view.id].mode }), view.id, `${view.id}: matchView reconhece o tipo pela estrutura`);
  viewsChecked += 1;
}
assert.equal(matchView(PESAGENS, { groups: [{ columnId: 'data_pesagem', direction: 'desc' }], mode: 'RESUMIDO' }), null, 'NEGATIVO: "Por data" da E1B → Personalizado');
assert.equal(matchView(PESAGENS, { groups: [{ columnId: 'nome_lote' }], mode: 'RESUMIDO' }), null, 'NEGATIVO: "Por lote" da E1B → Personalizado');
assert.equal(matchView(PESAGENS, { groups: [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem' }, { columnId: 'nome_lote' }], mode: 'RESUMIDO' }), null, 'NEGATIVO: direção diferente não é o tipo (o "Ordenar por" do tipo é que inverte)');
assert.equal(matchView(PESAGENS, { groups: [{ columnId: 'nome_lote' }], mode: 'DETALHADO' }), null, 'NEGATIVO: modo diferente → Personalizado');
assert.equal(matchView(PESAGENS, { groups: [{ columnId: 'marca' }], mode: 'RESUMIDO' }), null, 'agrupamento sem visão → Personalizado');
// A matriz declara groups vazio (os níveis vêm dos eixos): um Resumido sem agrupamento NÃO é a matriz.
assert.equal(matchView(PESAGENS, { groups: [], mode: 'RESUMIDO' }), null, 'NEGATIVO: Resumido sem agrupamento não passa por "Sintético (Matriz)"');
// Revisão final: o tipo só aparece quando está aplicado de fato (totais; colunas no Detalhado) — senão
// "Personalizado", e escolher o tipo de novo o reaplica.
const porLoteSel = viewSelection('por-apartacao-lote', PESAGENS);
assert.equal(matchView(PESAGENS, { groups: porLoteSel.groups, mode: porLoteSel.mode, aggregates: SHEET_TOTALS, columns: porLoteSel.columns }), 'por-apartacao-lote', 'mesmos totais do tipo → Por Apartação/Lote');
assert.equal(matchView(PESAGENS, { groups: porLoteSel.groups, mode: porLoteSel.mode, aggregates: [] }), null, 'NEGATIVO: sem os totais da visão → Personalizado');
assert.equal(matchView(PESAGENS, { groups: porLoteSel.groups, mode: porLoteSel.mode, aggregates: [...SHEET_TOTALS].reverse() }), 'por-apartacao-lote', 'ordem dos totais não importa');
const analiticoSel = viewSelection('analitico', PESAGENS);
assert.equal(matchView(PESAGENS, { groups: [], mode: 'DETALHADO', aggregates: analiticoSel.aggregates, columns: analiticoSel.columns }), 'analitico');
assert.equal(matchView(PESAGENS, { groups: [], mode: 'DETALHADO', aggregates: analiticoSel.aggregates, columns: analiticoSel.columns.slice(1) }), null, 'NEGATIVO: Detalhado com outras colunas → Personalizado');
// "Ordenar por": chave de total com ":" (criada no diálogo Totais) não se perde.
assert.deepEqual(parseSortChoice('metrica:sum:peso:asc'), { kind: 'metrica', key: 'sum:peso', direction: 'asc' }, 'chave com ":"');
assert.deepEqual(parseSortChoice('metrica:peso_medio:desc'), { kind: 'metrica', key: 'peso_medio', direction: 'desc' });
assert.deepEqual(parseSortChoice('rotulo:desc'), { kind: 'rotulo', key: '', direction: 'desc' });
assert.deepEqual(parseSortChoice('nivel:1:desc'), { kind: 'nivel', key: '1', direction: 'desc' });
// Filtro da definição em código (Rebanho atual: situação = ATIVO) vai para a tela como rótulo ("Ativo"):
// o botão Status marca e conta certo, e a população é a mesma.
const REBANHO = getReportDefinition('rebanho.atual');
const shown = filtersForDisplay(REBANHO.defaultFilters, REBANHO.columns);
assert.deepEqual(shown.situacao.values, ['Ativo'], 'ATIVO → Ativo');
assert.deepEqual(filtersForDisplay({ situacao: { operator: 'in', values: ['ATIVO'], match: 'code' } }, REBANHO.columns).situacao.values, ['ATIVO'], 'condição por código fica como está');
assert.deepEqual(filtersForDisplay({ situacao: { operator: 'in', values: ['ATIVO', 'Ativo'] } }, REBANHO.columns).situacao.values, ['Ativo'], 'código e rótulo do mesmo valor contam uma vez');
const apData = await run(viewSelection('por-apartacao-data', PESAGENS), { arrobaDivisor: 30 });
for (const apartacao of apData.summaryRows.filter((row) => row.level === 1)) {
  const datas = apData.summaryRows.filter((row) => row.level === 2 && row.path[0].key === apartacao.key).map((row) => row.key);
  assert.ok(datas.length > 0, `${apartacao.label}: tem datas`);
  assert.deepEqual(datas, [...datas].sort().reverse(), `Por apartação (${apartacao.label}): datas da mais recente para a mais antiga`);
}
assert.deepEqual([...new Set(apData.summaryRows.map((row) => row.level))].sort(), [1, 2, 3], 'Apartação › Data › Lote');

// Faixa exigida só no nível do LOTE em todos os canais: acima dele (apartação, data) e no Total geral a
// menor mínima/maior máxima de lotes diferentes não é a faixa de ninguém.
const faixaKeys = ['faixa_min', 'faixa_max'];
const csvLayout = buildSummaryLayout(apData, 'csv');
const faixaCols = faixaKeys.map((key) => csvLayout.metrics.findIndex((metric) => metric.key === key) + csvLayout.groupHeaders.length);
for (const row of csvLayout.rows) {
  const cells = faixaCols.map((index) => row.cells[index]);
  // Lote sem faixa no cadastro (ou "Não informado") fica vazio de verdade.
  if (row.level === 3) assert.equal(cells.every((cell) => cell !== ''), faixaKeys.every((key) => row.node.aggregates[key]?.value != null), `CSV: faixa do lote ${row.label} = a do cadastro`);
  else assert.deepEqual(cells, ['', ''], `CSV: sem faixa no nível ${row.level} (${row.label})`);
}
assert.ok(csvLayout.rows.some((row) => row.level === 3 && faixaCols.every((index) => row.cells[index] !== '')), 'CSV: há lote com faixa');
const xlsxLayout = buildSummaryLayout(apData, 'xlsx');
assert.ok(xlsxLayout.rows.filter((row) => row.level !== 3).every((row) => faixaCols.every((index) => row.cells[index] === null)), 'XLSX: faixa vazia fora do nível do lote');
// Detalhado com o mesmo agrupamento e todas as métricas da folha ("Personalizado": o tipo é Resumido).
const apDetalhe = await run({ mode: 'DETALHADO', groups: APDATA_GROUPS, aggregates: SHEET_TOTALS }, { arrobaDivisor: 30 });
const subtotalFaixa = buildReportLines(apDetalhe, 'csv').lines.filter((line) => (line.type === 'SUBTOTAL' || line.type === 'GRAND_TOTAL') && faixaKeys.includes(line.spec?.id));
assert.ok(subtotalFaixa.length > 0 && subtotalFaixa.every((line) => line.level === 3), 'Detalhado: faixa só no subtotal do lote');
const detailDoc = buildReportDocument(apDetalhe, { orientation: 'landscape' });
const chipRows = [];
const walkDoc = (section) => { if (section.table) chipRows.push(...section.table.rows.filter((row) => row.chips).map((row) => ({ level: section.level, row }))); section.sections.forEach(walkDoc); };
detailDoc.sections.forEach(walkDoc);
assert.ok(chipRows.length > 0, 'folha do Detalhado tem subtotais');
for (const { level, row } of chipRows) {
  const labels = row.chips.items.map((item) => item.label);
  assert.ok(!labels.some((label) => /Faixa (mínima|máxima)/.test(label)), 'folha do Detalhado: faixa num item só');
  assert.equal(labels.includes('Faixa exigida (kg)'), level === 3, `folha do Detalhado: faixa só no subtotal do lote (nível ${level})`);
}
assert.equal(detailDoc.footer.arroba, '@ = peso vivo ÷ 30', 'folha do Detalhado: totais em @ → rodapé explica o divisor');
for (const { row } of chipRows) {
  for (const item of row.chips.items.filter((chip) => chip.label === 'Machos' || chip.label === 'Fêmeas')) {
    assert.notEqual(item.text, '0', `folha do Detalhado: contagem 0 de ${item.label} aparece "—", como no Resumido`);
  }
}
assert.ok(!detailDoc.grandTotal.rows[0].chips.items.some((item) => item.label === 'Faixa exigida (kg)'), 'folha do Detalhado: sem faixa no Total geral');

// E1E: todos os relatórios declaram os seus tipos (conferidos em reports:tipos-todos). Relatório SEM visões
// declaradas (hoje só os da aba Controle da Manutenção): "Resumo por <agrupamento padrão>" + Analítico gerados.
const rebanho = getReportDefinition('rebanho.atual');
assert.ok(rebanho.views.length > 0 && rebanho.defaultView === 'por-lote', 'E1E: rebanho.atual declara os tipos (padrão Por Lote)');
const semTipos = getReportDefinition('controle.qualidade-dados');
assert.equal(semTipos.views.length, 0, 'controle.qualidade-dados não declara visões');
const geradas = listReportViews(semTipos);
assert.deepEqual(geradas.map((view) => [view.id, view.mode, view.groups.map((group) => group.columnId)]), [
  ['padrao', 'DETALHADO', ['gravidade', 'categoria_problema']],
  ['analitico', 'DETALHADO', []],
], 'padrão + analítico gerados');
for (const view of geradas) assert.equal(matchView(semTipos, { groups: view.groups, mode: view.mode }), view.id);
// E1C (resposta 11): título da folha de Pesagens = "Pesagens Individuais"; os demais com o próprio nome.
// E1D: com tipo, "(Analítico)" só no Analítico (Vendas, Detalhado, é "Sintético"); sem tipo, pelo modo.
assert.equal(buildReportDocument(apData).title, 'Relatório de Pesagens Individuais (Sintético)', 'título da folha de Pesagens (tipo resumido)');
assert.equal(buildReportDocument(apDetalhe).title, 'Relatório de Pesagens Individuais (Analítico)', 'título da folha de Pesagens (Personalizado Detalhado: pelo modo)');
const vendasFolha = await run(viewSelection('vendas', PESAGENS), { arrobaDivisor: 30 });
assert.equal(vendasFolha.mode, 'DETALHADO', 'Vendas é Detalhado');
assert.equal(buildReportDocument(vendasFolha).title, 'Relatório de Pesagens Individuais (Sintético)', 'Vendas (Detalhado): título "(Sintético)", como no MAKGESTAO');
// E1D: a folha de Vendas é o relatório de venda do antigo (layout "vendas", blocos conferidos em reports:vendas-por-comprador).
assert.deepEqual([buildReportDocument(vendasFolha).layout, buildReportDocument(vendasFolha).vendas.porGrupo.title], ['vendas', 'TOTAIS POR COMPRADOR'], 'Vendas: folha no layout do relatório de venda');
assert.equal(buildReportDocument(await run(viewSelection('analitico', PESAGENS), { arrobaDivisor: 30 })).title, 'Relatório de Pesagens Individuais (Analítico)', 'Analítico: título "(Analítico)"');
assert.equal(apData.reportName, 'Pesagens', 'o nome do relatório (cartão, arquivo, manifesto) continua "Pesagens"');
const rebanhoFolha = await runReport('rebanho.atual', { today: TODAY, params: {}, selection: viewSelection('por-lote', REBANHO) }, ADMIN);
assert.equal(buildReportDocument(rebanhoFolha).title, 'Relatório de Rebanho atual (Sintético)', 'outros relatórios com o próprio nome');
const rebanhoCodigo = await runReport('rebanho.atual', { today: TODAY, params: {}, selection: { mode: 'DETALHADO', groups: [], filters: REBANHO.defaultFilters } }, ADMIN);
const rebanhoRotulo = await runReport('rebanho.atual', { today: TODAY, params: {}, selection: { mode: 'DETALHADO', groups: [], filters: { situacao: { ...shown.situacao, match: 'label' } } } }, ADMIN);
const rebanhoTodos = await runReport('rebanho.atual', { today: TODAY, params: {}, selection: { mode: 'DETALHADO', groups: [], filters: {} } }, ADMIN);
assert.ok(rebanhoCodigo.rows.length > 0 && rebanhoCodigo.rows.length < rebanhoTodos.rows.length, 'massa tem ativos e não ativos');
assert.deepEqual(ids(rebanhoRotulo), ids(rebanhoCodigo), 'filtro pelo rótulo "Ativo" = filtro pelo código ATIVO (mesma população)');
let generatedChecked = 0;
for (const definition of listAllReportDefinitions().filter((item) => item.status !== 'blocked')) {
  const list = listReportViews(definition);
  assert.ok(list.length >= 1 && list.at(-1).mode === 'DETALHADO', `${definition.id}: tem visão analítica`);
  assert.equal(new Set(list.map((view) => view.id)).size, list.length, `${definition.id}: ids de visão únicos`);
  if (!definition.defaultGroups.length && !definition.views.length) assert.deepEqual(list.map((view) => view.id), ['analitico'], `${definition.id}: sem agrupamento padrão → só Analítico`);
  generatedChecked += 1;
}

// defineReport recusa visão incoerente.
const E = [GRAINS.EVENT];
const cols = [
  defineColumn({ id: 'lote', label: 'Lote', type: 'text', grains: E, groupable: true }),
  defineColumn({ id: 'data', label: 'Data', type: 'date', grains: E, groupable: true }),
  defineColumn({ id: 'sexo', label: 'Sexo', type: 'text', grains: E, groupable: true }),
  defineColumn({ id: 'marca', label: 'Marca', type: 'text', grains: E, groupable: true }),
  defineColumn({ id: 'peso', label: 'Peso', unit: 'kg', type: 'weight', grains: E }),
];
const valid = { id: 't', title: 'T', family: 'pesagens', grain: GRAINS.EVENT, version: 1, source: 'events.byPeriod', requires: ['reports.read'], columns: cols, params: [{ id: 'periodo', type: 'period', required: true }] };
const okView = { id: 'v', label: 'V', groups: [{ columnId: 'lote' }], mode: 'RESUMIDO', aggregates: [{ id: 'pm', columnId: 'peso', op: 'avg' }] };
assert.equal(defineReport({ ...valid, views: [okView] }).views.length, 1, 'controle: visão válida aceita');
assert.ok(Object.isFrozen(defineReport({ ...valid, views: [okView] }).views[0].groups), 'visão congelada');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, groups: [{ columnId: 'xpto' }] }] }), /desconhecida/, 'NEGATIVO: coluna inexistente');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, groups: [{ columnId: 'peso' }] }] }), /não é agrupável/, 'NEGATIVO: coluna não agrupável');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, groups: ['lote', 'data', 'sexo', 'marca'].map((columnId) => ({ columnId })) }] }), /no máximo 3/, 'NEGATIVO: 4 níveis');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, aggregates: [{ id: 'x', columnId: 'lote', op: 'sum' }] }] }), /inválida/, 'NEGATIVO: operação inválida para a coluna');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, aggregates: [{ id: 'x', columnId: 'peso', op: 'weightedGmd' }] }] }), /inválida/, 'NEGATIVO: GMD ponderado sem declaração');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, mode: 'SINTETICO' }] }), /modo inválido/, 'NEGATIVO: modo inválido');
assert.throws(() => defineReport({ ...valid, views: [okView, { ...okView }] }), /duplicada/, 'NEGATIVO: id de visão repetido');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, groups: [{ columnId: 'lote', direction: 'cima' }] }] }), /direção inválida/, 'NEGATIVO: direção inválida');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, presetId: 'x' }] }), /chave desconhecida/, 'NEGATIVO: chave desconhecida na visão');
assert.throws(() => defineReport({ ...valid, views: [{ ...okView, summarySort: { key: 'xpto' } }] }), /métrica desconhecida/, 'NEGATIVO: ordem do resumo em métrica inexistente');
assert.throws(() => defineReport({ ...valid, metricLabels: { pm: '' } }), /rótulo vazio/, 'NEGATIVO: rótulo vazio');
assert.throws(() => defineReport({ ...valid, sheetTitle: '  ' }), /sheetTitle/, 'NEGATIVO: sheetTitle vazio');
assert.throws(() => defineReport({ ...valid, views: [okView], metricPairs: [{ id: 'f', label: 'F', from: 'pm', to: 'xpto' }] }), /métrica desconhecida/, 'NEGATIVO: par com métrica inexistente');

// ---- 6. Cabeçalho do Resumido e casas decimais ----
const layout30 = buildSummaryLayout(porLote30, 'screen');
assert.deepEqual(layout30.headers, [
  'Lote', 'Qtd', 'Faixa mínima do lote (kg)', 'Faixa máxima do lote (kg)', 'Menor (kg)', 'Maior (kg)', 'Peso médio (kg)', 'Média (@)', 'Peso total (kg)', 'Total (@)',
  'Ganho médio (kg)', 'Ganho médio (@)', 'Ganho total (kg)', 'Ganho total (@)', 'Dias médios', 'GMD médio (kg/dia)', 'Machos', 'Fêmeas',
], 'rótulos de curral da folha no cabeçalho do Resumido');
assert.deepEqual(porLote30.metricLabels.qtd, 'Qtd', 'vm.metricLabels');
const cells = Object.fromEntries(layout30.rows.map((row) => [row.label, row.cells]));
// Lote 01: 300, 330, 345, 410 (+ e8 sem peso) → médio 346,25; total 1385; ganho 30 + 15 em 20 + 20 dias.
assert.deepEqual(cells['Lote 01'], ['Lote 01', '2', '300,0', '400,0', '300,0', '410,0', '346,3', '11,54', '1.385,0', '46,17', '22,5', '0,75', '45,0', '1,50', '20,0', '1,125', '2', '0'], 'Lote 01: kg 1 casa, @ 2, GMD 3');
// Lote 02: 250, 260, 280 → médio 263,33; total 790; ganho 10 em 10 dias.
assert.deepEqual(cells['Lote 02'], ['Lote 02', '1', '200,0', '300,0', '250,0', '280,0', '263,3', '8,78', '790,0', '26,33', '10,0', '0,33', '10,0', '0,33', '10,0', '1,000', '0', '1'], 'Lote 02');
assert.deepEqual(cells['Não informado'], ['Não informado', '1', '—', '—', '200,0', '200,0', '200,0', '6,67', '200,0', '6,67', '—', '—', '—', '—', '—', '—', '0', '1'], 'sem lote: faixa e GMD "—" (nunca 0,000)');
// Faixa exigida é do lote: no Total geral fica vazia (não é a faixa de nenhum lote).
assert.deepEqual(cells['Total geral'], ['Total geral', '4', '', '', '200,0', '410,0', '296,9', '9,90', '2.375,0', '79,17', '18,3', '0,61', '55,0', '1,83', '16,7', '1,100', '2', '2'], 'Total geral recalculado sobre a população');
const layout15 = buildSummaryLayout(porLote15, 'screen');
assert.equal(layout15.rows.at(-1).cells[layout15.headers.indexOf('Total (@)')], '158,33', 'divisor 15: Total (@) = 2.375 ÷ 15');
const metrics = Object.fromEntries(summaryMetrics(porLote30).map((metric) => [metric.key, metric.column]));
assert.equal(metrics.peso_medio.decimals, 1, 'kg agregado: 1 casa');
assert.equal(metrics.media_arroba.decimals, 2, '@: 2 casas');
assert.equal(metrics.media_arroba.unit, '@', '@: unidade na métrica (rodapé "@ = peso vivo ÷ N")');
assert.equal(metrics.gmd_medio.type, 'gmd', 'GMD: 3 casas');
// Detalhado: o valor de cada linha continua com as casas da coluna (kg 2); subtotal agregado com 1. (As
// colunas do antigo "Analítico por animal" da E1B, com a de @, escritas à mão: "Personalizado".)
const analitico = await run({ mode: 'DETALHADO', groups: [], columns: [...ANALYTIC_EVENT_COLUMNS] }, { arrobaDivisor: 30 });
const lines = buildReportLines(analitico, 'screen');
const pesoIndex = analitico.columns.findIndex((column) => column.id === 'peso');
const arrobaIndex = analitico.columns.findIndex((column) => column.id === 'peso_arroba');
const e1Line = lines.lines.find((line) => line.type === 'DATA' && line.row.id === 'e1');
assert.equal(e1Line.cells[pesoIndex], '300,00', 'linha de dados: kg com 2 casas (coluna)');
assert.equal(e1Line.cells[arrobaIndex], '10,00', 'linha de dados: 300 ÷ 30 = 10,00 @');
assert.ok(lines.headers.includes('Peso em arrobas (@)'), 'cabeçalho da coluna de @');
assert.equal(lines.lines.find((line) => line.type === 'GRAND_TOTAL' && line.spec.id === 'peso_medio').value, '296,9', 'total do Detalhado: kg agregado com 1 casa');
// XLSX: kg agregado no formato #,##0.0 (estilo 11), @ com 2 casas (6), GMD com 3 (7).
const xlsx = unzipStored((await prepareEmission(porLote30, 'xlsx', ADMIN)).content);
assert.match(xlsx['xl/styles.xml'], /numFmtId="167" formatCode="#,##0\.0"/, 'XLSX: formato de 1 casa');
const sheet = xlsx['xl/worksheets/sheet1.xml'];
assert.match(sheet, /s="11"><v>346\.3<\/v>/, 'XLSX: Peso médio 346,3 no formato de 1 casa');
assert.match(sheet, /s="6"><v>11\.54<\/v>/, 'XLSX: Média (@) 11,54 com 2 casas');
assert.match(sheet, /s="7"><v>1\.125<\/v>/, 'XLSX: GMD 1,125 com 3 casas');

// ---- 7. Ninguém ganha acesso a valor comercial ----
for (const actor of [OPERADOR, CONSULTA]) {
  // E1D: o tipo com TODAS as colunas do seletor "Colunas" (o padrão mostra 11 das 17 métricas).
  const apView = listReportViews(PESAGENS).find((view) => view.id === 'por-apartacao-data');
  const vm = await run({ ...viewSelection(apView, PESAGENS), ...applyColumnKeys(apView, PESAGENS, SHEET_COLUMN_KEYS) }, { arrobaDivisor: 30 }, actor);
  assert.deepEqual(vm.aggregates.map((spec) => spec.id), FOLHA_IDS, `${actor.role}: todas as métricas da folha (nenhuma é comercial)`);
  assert.ok(!vm.availableColumns.some((column) => column.sensitive), `${actor.role}: nenhuma coluna sensível oferecida`);
  // OPERADOR não exporta (reports.export): confere a própria folha (layout); CONSULTA, os arquivos.
  const texts = can(actor.role, 'reports.export')
    ? await Promise.all(['csv', 'json', 'xlsx'].map(async (format) => {
      const { content } = await prepareEmission(vm, format, actor);
      return [format, typeof content === 'string' ? content : new TextDecoder().decode(content)];
    }))
    : [['tela', JSON.stringify(buildSummaryLayout(vm, 'screen').headers.concat(buildSummaryLayout(vm, 'screen').rows.flatMap((row) => row.cells)))]];
  for (const [format, text] of texts) {
    for (const secret of ['3000', '140,00', '@ carcaça', 'Carcaça', 'Rendimento', 'Valor venda', 'Preço/@', 'Arrobas (@)']) {
      assert.ok(!text.includes(secret), `${actor.role} ${format}: não contém "${secret}"`);
    }
  }
  const analiticoVm = await run(viewSelection('analitico', PESAGENS), { arrobaDivisor: 30 }, actor);
  assert.deepEqual(analiticoVm.columns.map((column) => column.id), ANALITICO_COLUMNS, `${actor.role}: Analítico sem coluna comercial`);
}

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:sheet-data:verify',
  ok: true,
  newColumns: NEW_COLUMNS.length,
  sheetMetrics: FOLHA_IDS.length,
  pesagensViews: viewsChecked,
  definitionsWithViews: generatedChecked,
  divisors: [30, 15],
}, null, 2));
