// Gate reports:charts-state:verify (E1G 1.4.2 — docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B, "Tela"): a vista
// "Folha | Gráficos" e a configuração dos gráficos no ESTADO da tela, nos modelos ("Meus relatórios") e no último
// estado — as MESMAS funções que a tela usa (reportInitialState, reportScreenState, reportTemplateService,
// customReports, domain/reportCharts). Massa de TESTE (scripts/lib/reportFixtures: fake-indexeddb). Casos, com os
// NEGATIVOS (o código antigo reprovaria):
//   a) modelo sem gráficos guarda exatamente as chaves de antes; com a vista Gráficos, só `display`/`charts` a mais
//      (chaves só quando diferentes do padrão); vista inválida é erro ao salvar; "Gráficos" num relatório sem
//      gráficos e opção desconhecida ficam fora; ao abrir, o que sumiu sai com AVISO (nunca erro);
//   b) modelo → estado da tela → payload: ida e volta sem perda; último estado idem (e o padrão não grava nada);
//   c) "Salvar alterações" acende ao mudar a vista ou um gráfico e apaga ao voltar ao padrão (a chave sai — NEGATIVO:
//      gravar a escolha igual ao padrão deixaria "alterado"); o detalhe aberto por um clique no gráfico é passageiro;
//   d) "Série" segue o 1º nível do tipo; ligar/desligar série na legenda = o mesmo gráfico calculado com a série
//      oculta, sem voltar ao motor e sem repintar (NEGATIVO: sem ocultar, difere);
//   e) trocar de vista não roda o relatório de novo: display/charts fora do execute da tela (NEGATIVO: o mesmo
//      verificador acusa um execute que dependesse da vista); a vista Gráficos não lê o banco;
//   f) dica e clique da tela (chartHoverTargets/chartTargetTip/chartTargetDrill) sobre a MESMA geometria, com os
//      textos da folha; o clique numa barra leva o caminho do grupo (onDrill);
//   g) GMD vazio diz o porquê ("Sem GMD neste período: precisa de uma pesagem anterior") — nunca barra 0;
//   h) a configuração da tela chega à impressão/PDF e ao Excel (a mesma buildReportCharts), e os itens do menu
//      ("Imprimir só os gráficos", "PDF só dos gráficos") e o alternador estão na tela;
//   i) revisão: o clique no gráfico SOMA ao detalhe já aberto (NEGATIVO: trocar o detalhe abria as fêmeas de todos
//      os lotes); o × volta ao modo e ao detalhe de antes — Analítico continua Detalhado e "Salvar alterações" não
//      acende (NEGATIVO: o × antigo, "Resumido sem detalhe", acendia); "Demais" de um grupo só abre aquele grupo
//      (NEGATIVO: o caminho antigo só tinha o mês); todas as séries escondidas dizem isso (não "nenhum valor").
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { buildInitialReportState } from '../src/modules/reporting/application/reportInitialState.js';
import { getReportViewState, listTemplates, saveReportViewState, saveTemplate, templateToRequest } from '../src/modules/reporting/application/reportTemplateService.js';
import { isReportChanged, reportSnapshot } from '../src/modules/reporting/application/customReports.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { PESAGENS } from '../src/modules/reporting/definitions/pesagens.js';
import { chartDrillPatch, leaveDrillPatch, restingMode, templatePayload, viewStatePayload } from '../src/modules/reporting/domain/reportScreenState.js';
import { DESEMPENHO } from '../src/modules/reporting/definitions/desempenho.js';
import { typedViewSelection } from '../src/modules/reporting/application/reportInitialState.js';
import { getReportView } from '../src/modules/reporting/domain/reportViews.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { TEXTO_TODAS_ESCONDIDAS, renderChartSvg } from '../src/modules/reporting/infrastructure/exporters/chartSvg.js';
import {
  CHART_DISPLAYS, CHART_DRILL_HINT, TEXTO_SEM_GMD, buildReportChart, buildReportCharts, chartConfigToggleSeries, chartConfigWith, chartOptionsOf, chartTargetDrill,
  chartTargetTip, chartsOf, chartsStateOf, displayOf, normalizeChartConfig, withHiddenSeries,
} from '../src/modules/reporting/domain/reportCharts.js';
import { chartGeometry, chartHoverTargets } from '../src/modules/reporting/domain/chartScale.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';

const results = [];
const code = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const PERIODO = { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' };
const KEYS_BEFORE = ['aggregates', 'baseReportId', 'baseReportVersion', 'columns', 'createdAt', 'filters', 'groups', 'id', 'mode', 'name', 'orientation', 'ownerName', 'ownerUserId', 'params', 'period', 'scope', 'search', 'sort', 'summarySort', 'updatedAt', 'updatedBy', 'version', 'widths'];
const { db } = await seedReportFixture();
const storedTemplates = async () => (await db.table('appSettings').get('report-templates:local')).value.templates;
const defaultState = (definition, role = 'ADMIN') => {
  const state = buildInitialReportState(definition, { role }).state;
  const periodParam = definition.params.find((param) => param.type === 'period');
  return periodParam ? { ...state, params: { ...state.params, [periodParam.id]: PERIODO } } : state;
};
const CHARTS = { 'evolucao-peso': { serie: 'lote', eixo: 'data', oculto: ['L2'] }, 'distribuicao-peso': { faixa: '20' } };

// ---------------------------------------------------------------------------------------------------------
// a) chaves do modelo, validação ao salvar, avisos ao abrir
// ---------------------------------------------------------------------------------------------------------
{
  const base = { baseReportId: 'desempenho', columns: ['animal', 'peso_final', 'gmd'], groups: [{ columnId: 'lote' }], period: PERIODO };
  const plain = await saveTemplate({ ...base, name: 'Sem gráficos', scope: 'PERSONAL', display: 'folha', charts: {} }, ADMIN);
  assert.deepEqual(Object.keys(plain).sort(), KEYS_BEFORE, 'modelo sem gráficos: exatamente as chaves de antes (display "folha" e charts {} não gravam)');
  const withCharts = await saveTemplate({ ...base, name: 'Com gráficos', scope: 'PERSONAL', display: 'graficos', charts: { 'gmd-por-grupo': { serie: 'sexo' }, 'faixas-gmd': { oculto: [] } } }, ADMIN);
  assert.deepEqual(Object.keys(withCharts).sort(), [...KEYS_BEFORE, 'charts', 'display'].sort(), 'com a vista Gráficos: só display/charts a mais');
  assert.equal(withCharts.display, 'graficos');
  assert.deepEqual(withCharts.charts, { 'gmd-por-grupo': { serie: 'sexo' } }, 'gráfico sem nada escolhido não grava');
  const stored = (await storedTemplates()).find((template) => template.id === withCharts.id);
  assert.deepEqual([stored.display, stored.charts], ['graficos', { 'gmd-por-grupo': { serie: 'sexo' } }], 'gravado em appSettings (sem store nova, sem dados)');
  assert.ok(!JSON.stringify(stored).includes('"rows"') && !JSON.stringify(stored).includes('"points"'), 'o modelo guarda só a configuração (nunca pontos do gráfico)');
  assert.equal(await code(() => saveTemplate({ ...base, name: 'Vista errada', display: 'pizza' }, ADMIN)), 'REPORT_TEMPLATE_INVALID', 'NEGATIVO: vista desconhecida é recusada ao salvar');
  const noCharts = await saveTemplate({ baseReportId: 'comercial', name: 'Comercial em gráficos', display: 'graficos', charts: { x: { serie: 'y' } } }, ADMIN);
  assert.ok(!('display' in noCharts) && !('charts' in noCharts), 'relatório sem gráficos: a vista Gráficos não é gravada');
  const dropped = await saveTemplate({ ...base, name: 'Opção velha', charts: { 'gmd-por-grupo': { serie: 'cor-do-pelo', cor: 'azul' }, 'nao-existe': { serie: 'lote' } } }, ADMIN);
  assert.ok(!('charts' in dropped), 'gráfico/opção desconhecidos não entram no modelo');
  // Ao abrir: o que deixou de existir sai com aviso.
  const request = templateToRequest({ ...plain, display: 'mosaico', charts: { 'gmd-por-grupo': { serie: 'cor-do-pelo' }, 'faixas-gmd': { pizza: 1 }, 'nao-existe': {}, 'peso-inicial-final': { serie: 'raca' } } }, 'ADMIN');
  assert.deepEqual(request.warnings.map((warning) => warning.code).sort(), ['CHART_CHOICE_UNKNOWN', 'CHART_DISPLAY_INVALID', 'CHART_OPTION_UNKNOWN', 'CHART_UNKNOWN'].sort(), 'avisos: vista, gráfico, opção e escolha desconhecidos');
  assert.ok(!('display' in request), 'vista inválida: abre na folha');
  assert.deepEqual(request.charts, { 'peso-inicial-final': { serie: 'raca' } }, 'fica só o que existe');
  const plainRequest = templateToRequest(plain, 'ADMIN');
  assert.ok(!('display' in plainRequest) && !('charts' in plainRequest), 'modelo antigo: o pedido não muda (sem chaves novas)');
  assert.deepEqual(chartsStateOf(getReportDefinition('comercial'), { display: 'graficos' }).warnings.map((warning) => warning.code), ['CHART_DISPLAY_UNAVAILABLE'], 'Gráficos num relatório sem gráficos: aviso');
  results.push({ caso: 'modelo', chavesNovas: ['charts', 'display'], avisos: request.warnings.length });
}

// ---------------------------------------------------------------------------------------------------------
// b) ida e volta: modelo → tela → modelo; último estado
// ---------------------------------------------------------------------------------------------------------
let opened;
{
  const state = { ...defaultState(PESAGENS, 'OPERADOR'), display: 'graficos', charts: CHARTS };
  const saved = await saveTemplate({ name: 'Pesagens em gráficos', scope: 'PERSONAL', ...templatePayload(PESAGENS, state, 'OPERADOR') }, OPERADOR);
  assert.deepEqual([saved.display, saved.charts], ['graficos', CHARTS], 'templatePayload leva a vista e os gráficos');
  const listed = (await listTemplates(OPERADOR)).find((template) => template.id === saved.id);
  opened = buildInitialReportState(PESAGENS, { template: listed, role: 'OPERADOR' }).state;
  assert.equal(opened.display, 'graficos', 'o modelo reabre na vista Gráficos');
  assert.deepEqual(opened.charts, CHARTS, 'com os gráficos como estavam');
  assert.equal(reportSnapshot(PESAGENS, opened, 'OPERADOR'), reportSnapshot(PESAGENS, state, 'OPERADOR'), 'reabre exatamente como foi salvo');
  const fresh = buildInitialReportState(PESAGENS, { role: 'OPERADOR' }).state;
  assert.deepEqual([fresh.display, fresh.charts], [CHART_DISPLAYS.FOLHA, {}], 'sem modelo nem último estado: folha, gráficos no padrão');
  // Último estado
  await saveReportViewState('pesagens', viewStatePayload(PESAGENS, state, 'OPERADOR'), OPERADOR);
  const viewState = await getReportViewState('pesagens', OPERADOR);
  const reopened = buildInitialReportState(PESAGENS, { role: 'OPERADOR', savedState: viewState }).state;
  assert.deepEqual([reopened.display, reopened.charts], ['graficos', CHARTS], 'último estado: volta na vista Gráficos com a configuração');
  await saveReportViewState('pesagens', viewStatePayload(PESAGENS, defaultState(PESAGENS, 'OPERADOR'), 'OPERADOR'), OPERADOR);
  const storedState = (await db.table('appSettings').get(`report-view-state:local:${OPERADOR.id}`)).value.reports.pesagens;
  assert.ok(!('display' in storedState) && !('charts' in storedState), 'último estado no padrão: nenhuma chave nova');
  const back = buildInitialReportState(PESAGENS, { role: 'OPERADOR', savedState: await getReportViewState('pesagens', OPERADOR) }).state;
  assert.equal(back.display, 'folha', 'e reabre na folha');
  results.push({ caso: 'ida e volta', display: opened.display, graficos: Object.keys(opened.charts) });
}

// ---------------------------------------------------------------------------------------------------------
// c) "Salvar alterações" (Meus relatórios)
// ---------------------------------------------------------------------------------------------------------
const vm = await runReport('pesagens', { today: TODAY, params: { periodo: PERIODO }, selection: { view: opened.view, groups: opened.groups, columns: opened.columns, aggregates: opened.aggregates, mode: opened.mode, sortChoice: opened.sortChoice } }, OPERADOR);
{
  const baseline = reportSnapshot(PESAGENS, opened, 'OPERADOR');
  const changed = (patch) => isReportChanged(baseline, PESAGENS, { ...opened, ...patch }, 'OPERADOR');
  assert.equal(changed({}), false, 'recém-aberto');
  assert.equal(changed({ display: 'folha' }), true, 'trocar de vista acende "Salvar alterações"');
  const other = chartConfigWith(PESAGENS, opened.charts, 'distribuicao-peso', 'faixa', '50', vm);
  assert.deepEqual(other['distribuicao-peso'], { faixa: '50' });
  assert.equal(changed({ charts: other }), true, 'mudar um gráfico acende');
  const toDefault = chartConfigWith(PESAGENS, opened.charts, 'distribuicao-peso', 'faixa', 'auto', vm);
  assert.ok(!('distribuicao-peso' in toDefault), 'voltar ao padrão tira a chave');
  assert.equal(changed({ charts: toDefault }), true, 'Auto ≠ 20 kg salvo: alterado');
  const restored = chartConfigWith(PESAGENS, toDefault, 'distribuicao-peso', 'faixa', '20', vm);
  assert.equal(changed({ charts: restored }), false, 'e de volta aos 20 kg salvos: sem alteração');
  // NEGATIVO: gravar a escolha igual ao padrão ({ faixa: 'auto' }) deixaria o relatório "alterado" à toa.
  const naive = { ...opened.charts, 'ganho-por-mes': { metrica: 'kg' } };
  assert.equal(changed({ charts: naive }), true, 'NEGATIVO: a chave igual ao padrão mudaria o retrato');
  assert.equal(changed({ charts: chartConfigWith(PESAGENS, opened.charts, 'ganho-por-mes', 'metrica', 'kg', vm) }), false, 'chartConfigWith não grava o padrão: sem alteração');
  const twice = chartConfigToggleSeries(chartConfigToggleSeries(opened.charts, 'evolucao-peso', 'L1'), 'evolucao-peso', 'L1');
  assert.equal(changed({ charts: twice }), false, 'esconder e mostrar a mesma série: sem alteração');
  assert.equal(changed({ charts: chartConfigToggleSeries(opened.charts, 'evolucao-peso', 'L2') }), true, 'mostrar a série que estava oculta: alterado');
  // Clique numa barra: a folha no detalhe (display "folha") — passageiro como o detalhe da folha.
  const drill = [{ columnId: 'nome_lote', key: 'L1', label: 'Lote 01' }];
  assert.equal(changed({ display: 'folha', drill, mode: 'DETALHADO', chartDrill: true }), false, 'detalhe aberto pelo gráfico não é alteração (volta aos gráficos)');
  assert.equal(changed({ display: 'folha', drill, mode: 'DETALHADO' }), true, 'NEGATIVO: sem marcar que veio do gráfico, a vista folha contaria como alteração');
  assert.equal(templatePayload(PESAGENS, { ...opened, display: 'folha', drill, chartDrill: true }, 'OPERADOR').display, 'graficos', 'o modelo guarda a vista de onde o detalhe saiu');
  results.push({ caso: 'salvar alterações', vista: true, grafico: true, padraoSemChave: true });
}

// ---------------------------------------------------------------------------------------------------------
// d) Série segue o tipo; legenda sem recalcular
// ---------------------------------------------------------------------------------------------------------
{
  const evolucao = PESAGENS.charts.find((chart) => chart.id === 'evolucao-peso');
  assert.equal(vm.groups[0].columnId, 'nome_apartacao', 'tipo padrão de Pesagens agrupa por Apartação');
  assert.equal(chartOptionsOf(evolucao, {}, vm).serie.id, 'apartacao', 'sem escolha, a Série segue o 1º nível do tipo');
  assert.deepEqual(chartConfigWith(PESAGENS, {}, 'evolucao-peso', 'serie', 'apartacao', vm), {}, 'escolher o que o tipo já dá não grava');
  assert.deepEqual(chartConfigWith(PESAGENS, {}, 'evolucao-peso', 'serie', 'lote', vm), { 'evolucao-peso': { serie: 'lote' } }, 'Lote (padrão declarado) num tipo por Apartação é escolha: grava');
  for (const [chartId, key, value] of [['nao-existe', 'serie', 'lote'], ['evolucao-peso', 'cor', 'x'], ['evolucao-peso', 'serie', 'cor-do-pelo']]) {
    assert.deepEqual(chartConfigWith(PESAGENS, opened.charts, chartId, key, value, vm), opened.charts, `desconhecido não muda nada (${chartId}/${key}/${value})`);
  }
  const { config } = normalizeChartConfig(PESAGENS, { 'evolucao-peso': { serie: 'lote', eixo: 'mes' } });
  const options = chartOptionsOf(evolucao, config, vm);
  const base = buildReportChart(vm, evolucao, { ...options, oculto: [] });
  const hidden = withHiddenSeries(base, ['L2']);
  assert.deepEqual(hidden, buildReportChart(vm, evolucao, { ...options, oculto: ['L2'] }), 'legenda: o mesmo gráfico com a série oculta, sem voltar ao motor');
  assert.notDeepEqual(base, hidden, 'NEGATIVO: sem ocultar, o gráfico é outro');
  assert.deepEqual(hidden.series.map((series) => series.slot), base.series.map((series) => series.slot), 'esconder uma série não repinta as outras');
  assert.ok(!chartGeometry(hidden).lines.some((line) => line.key === 'L2') && chartGeometry(base).lines.some((line) => line.key === 'L2'), 'a série oculta sai do desenho');
  assert.equal(hidden.legenda, true, 'e continua na legenda para ligar de volta');
  results.push({ caso: 'série e legenda', serie: 'apartacao', oculta: 'L2' });
}

// ---------------------------------------------------------------------------------------------------------
// e) trocar de vista não roda o relatório de novo
// ---------------------------------------------------------------------------------------------------------
{
  const view = read('src/components/reports/ReportView.jsx');
  // O execute da tela (useCallback) só depende do que muda o PEDIDO ao motor.
  const executeDeps = (source) => {
    const match = /const execute = useCallback\(async[\s\S]*?\n {2}\}, \[([^\]]*)\]\);/.exec(source);
    assert.ok(match, 'execute da tela encontrado');
    return match[1].split(',').map((item) => item.trim());
  };
  const runsOnDisplay = (deps) => deps.some((dep) => /^state(\.(display|charts|chartDrill))?$/.test(dep));
  const deps = executeDeps(view);
  assert.ok(deps.includes('state.params') && deps.includes('serviceFilters'), 'execute depende do pedido (período, filtros…)');
  assert.equal(runsOnDisplay(deps), false, 'execute NÃO depende de display/charts: trocar de vista não relê o banco');
  const executeBody = /const execute = useCallback\(async[\s\S]*?\n {2}\}, \[/.exec(view)[0];
  assert.ok(!/display|charts/.test(executeBody.replace(/sheetTitle/g, '')), 'o pedido ao runReport não leva a vista nem os gráficos');
  // NEGATIVO: o mesmo verificador acusa um execute que dependesse da vista.
  assert.equal(runsOnDisplay(executeDeps(view.replace('state.sortChoice, actor,', 'state.sortChoice, state.display, actor,'))), true, 'NEGATIVO: com state.display nas dependências, o verificador acusa');
  const chartsView = read('src/components/reports/ReportChartsView.jsx');
  assert.ok(!/^import[^\n]*(runReport|reportService|storage|indexedDb|Service)/m.test(chartsView) && !/runReport\(/.test(chartsView), 'a vista Gráficos não lê o banco (nenhum serviço importado)');
  assert.match(chartsView, /buildReportChart\(viewModel, chart,/, 'calcula sobre o view model já carregado');
  assert.match(chartsView, /withHiddenSeries\(base, options\.oculto\)/, 'a legenda não recalcula');
  assert.match(view, /viewModel && showCharts \? \(\s*<ReportChartsView/, 'vista Gráficos no lugar da folha');
  assert.match(view, /const setDisplay = \(next\) => update\(\{ display: next, chartDrill: false \}\);/, 'o alternador só muda a vista');
  results.push({ caso: 'sem rodar de novo', dependencias: deps.length });
}

// ---------------------------------------------------------------------------------------------------------
// f) dica e clique da tela sobre a mesma geometria
// ---------------------------------------------------------------------------------------------------------
{
  const charts = buildReportCharts(vm, PESAGENS, { 'gmd-por-grupo': { serie: 'lote' }, 'evolucao-peso': { serie: 'lote', eixo: 'mes' } }, 'OPERADOR');
  const bars = charts.find((chart) => chart.id === 'gmd-por-grupo');
  const geometry = chartGeometry(bars, { width: 560, height: 280 });
  const targets = chartHoverTargets(geometry);
  assert.equal(targets.length, geometry.bars.length, 'um alvo por barra desenhada');
  targets.forEach((target, index) => {
    const bar = geometry.bars[index];
    assert.ok(target.hit.y <= bar.y && target.hit.y + target.hit.h >= bar.y + bar.h, 'o alvo cobre a barra (linha inteira do grupo)');
  });
  const lote01 = targets.find((target) => target.xKey === 'L1');
  assert.deepEqual(chartTargetTip(bars, lote01), { title: 'Lote 01', lines: [bars.series[0].points.find((point) => point.xKey === 'L1').rotulo] }, 'dica da barra = rótulo do domínio');
  assert.match(chartTargetTip(bars, lote01).lines[0], /^1,125 kg\/dia · 2 cab\. · GMD de 1$/, 'texto da folha: 1,125 kg/dia · 2 cab. · GMD de 1');
  assert.deepEqual(chartTargetDrill(bars, lote01), [{ columnId: 'nome_lote', key: 'L1', label: 'Lote 01' }], 'clique na barra = detalhe do grupo (onDrill)');
  const line = charts.find((chart) => chart.id === 'evolucao-peso');
  const lineTargets = chartHoverTargets(chartGeometry(line, { width: 560, height: 280 }));
  assert.deepEqual(lineTargets.map((target) => target.xKey), ['2026-08', '2026-09'], 'linha: um alvo por x (cruz vertical)');
  const august = chartTargetTip(line, lineTargets[0]);
  assert.equal(august.title, 'ago/2026');
  assert.deepEqual(august.rows.map((row) => `${row.label}: ${row.text}`).slice(0, 2), ['Lote 01: 346,7 kg · 2 cab.', 'Lote 02: 255,0 kg · 1 cab.'], 'dica em linha: uma linha por série visível, texto da folha (ago: A1 e A3 no Lote 01; A2 no Lote 02)');
  assert.deepEqual(chartTargetDrill(line, lineTargets[0]), [{ columnId: 'mes_pesagem', key: '2026-08', label: 'ago/2026' }], 'várias séries: o clique abre o mês');
  assert.ok(CHART_DRILL_HINT.includes('folha'));
  results.push({ caso: 'dica e clique', barra: chartTargetTip(bars, lote01).lines[0] });
}

// ---------------------------------------------------------------------------------------------------------
// g) GMD vazio diz o porquê
// ---------------------------------------------------------------------------------------------------------
{
  const cadastros = { ...vm, rows: vm.rows.filter((row) => row.tipo_manejo === 'Cadastro') };
  const charts = buildReportCharts(cadastros, PESAGENS, {}, 'OPERADOR');
  const gmd = charts.find((chart) => chart.id === 'gmd-por-grupo');
  assert.equal(gmd.vazio, true, 'só Cadastros: sem GMD');
  assert.equal(gmd.textoVazio, TEXTO_SEM_GMD, 'mensagem clara');
  assert.equal(TEXTO_SEM_GMD, 'Sem GMD neste período: precisa de uma pesagem anterior.');
  assert.equal(chartGeometry(gmd).bars.length, 0, 'NEGATIVO de barra 0: nada desenhado');
  const semNinguem = buildReportCharts({ ...vm, rows: [] }, PESAGENS, {}, 'OPERADOR').find((chart) => chart.id === 'distribuicao-peso');
  assert.equal(semNinguem.vazio, true, 'histograma sem nenhum animal: vazio (não colunas de 0)');
  assert.match(semNinguem.textoVazio, /Nenhum animal com peso no período/);
  results.push({ caso: 'GMD vazio', texto: gmd.textoVazio });
}

// ---------------------------------------------------------------------------------------------------------
// h) a configuração chega à impressão/PDF e ao Excel; a tela liga tudo
// ---------------------------------------------------------------------------------------------------------
{
  const chartsConfig = { 'evolucao-peso': { serie: 'lote', eixo: 'data' } };
  // Imprimir/exportar exige reports.export (ADMIN) e o view model da própria sessão.
  const adminVm = await runReport('pesagens', { today: TODAY, params: { periodo: PERIODO }, selection: { view: opened.view, groups: opened.groups, columns: opened.columns, aggregates: opened.aggregates, mode: opened.mode, sortChoice: opened.sortChoice } }, ADMIN);
  const print = preparePrint(adminVm, ADMIN, { chartsConfig, chartsOnly: false });
  assert.equal(print.manifest.display, 'graficos');
  assert.equal(print.manifest.charts.find((chart) => chart.id === 'evolucao-peso').config.eixo, 'data', 'a escolha da tela vai para o PDF');
  const only = preparePrint(adminVm, ADMIN, { chartsConfig, chartsOnly: true });
  assert.equal(only.manifest.chartsOnly, true, '"só os gráficos"');
  const sheet = preparePrint(adminVm, ADMIN, {});
  assert.ok(!sheet.manifest.charts && !sheet.html.includes('rc-block'), 'vista Folha: impressão como antes');
  const xlsx = await prepareEmission(adminVm, 'xlsx', ADMIN, { chartsConfig });
  assert.ok(Object.keys(unzipStored(xlsx.content)).some((name) => name === 'xl/worksheets/sheet3.xml'), 'Excel na vista Gráficos: aba Gráficos');
  const view = read('src/components/reports/ReportView.jsx');
  assert.match(view, /const chartOptions = showCharts \? \{ chartsConfig: state\.charts, chartsOnly: overrides\.chartsOnly === true \} : \{\};/, 'Imprimir/PDF: gráficos só na vista Gráficos');
  assert.match(view, /const withCharts = format === "xlsx" && showCharts;/, 'Excel: aba Gráficos só na vista Gráficos');
  assert.match(view, /onPrintCharts=\{showCharts \? \(\) => emitDocument\("print", \{ chartsOnly: true \}\) : null\}/, 'menu: imprimir só os gráficos');
  assert.match(view, /onPdfCharts=\{showCharts \? \(\) => emitDocument\("pdf", \{ chartsOnly: true \}\) : null\}/, 'menu: PDF só dos gráficos');
  assert.match(view, /\{chartsAvailable \? <MakgestaoDisplaySwitch value=\{display\} onChange=\{setDisplay\} \/> : null\}/, 'alternador só nos relatórios com gráficos');
  assert.match(view, /const chartsAvailable = useMemo\(\(\) => makScreen && chartsOf\(definition, actor\.role\)\.length > 0/, 'na tela do MAKGESTAO e com gráficos que o perfil vê');
  const screen = read('src/components/reports/MakgestaoScreen.jsx');
  for (const text of ['Imprimir só os gráficos', 'PDF só dos gráficos', '"Folha"', '"Gráficos"', 'aria-label="Ver como"']) assert.ok(screen.includes(text), `tela: ${text}`);
  // Vista por perfil: CONSULTA vê os mesmos gráficos; relatório sem gráficos fica na folha.
  assert.deepEqual(chartsOf(PESAGENS, CONSULTA.role).map((chart) => chart.id), chartsOf(PESAGENS, 'ADMIN').map((chart) => chart.id), 'CONSULTA vê os mesmos gráficos');
  assert.equal(displayOf(getReportDefinition('comercial'), 'graficos', 'ADMIN'), 'folha', 'relatório sem gráficos: folha');
  assert.equal(displayOf(PESAGENS, 'graficos', CONSULTA.role), 'graficos');
  const css = read('src/styles/reports.css');
  assert.match(css, /@container \(min-width: 1200px\) \{ \.rpt-charts__grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \} \}/, '2 colunas com a área ≥ 1200 px');
  assert.match(css, /html:is\(\.dark, \.tema-escuro, \.escuro\) \.rpt-chart \{/, 'cartões no tema escuro');
  results.push({ caso: 'impressão, Excel e tela', pdf: print.manifest.charts.length, xlsx: true });
}

// ---------------------------------------------------------------------------------------------------------
// i) revisão: detalhe aberto pelo gráfico (soma ao detalhe, volta ao modo de antes), "Demais" de um só, séries ocultas
// ---------------------------------------------------------------------------------------------------------
{
  // Soma ao detalhe já aberto: folha no Lote 02 → "Gráficos" → barra "Fêmea" do GMD por sexo.
  const lote02 = [{ columnId: 'nome_lote', key: 'L2', label: 'Lote 02' }];
  const drilled = { ...opened, display: 'graficos', drill: lote02, mode: 'DETALHADO', chartDrill: false, drillBase: null };
  const drilledVm = await runReport('pesagens', { today: TODAY, params: { periodo: PERIODO }, selection: { view: opened.view, groups: opened.groups, drill: lote02, mode: 'DETALHADO' } }, OPERADOR);
  const porSexo = buildReportCharts(drilledVm, PESAGENS, { 'gmd-por-grupo': { serie: 'sexo' } }, 'OPERADOR').find((chart) => chart.id === 'gmd-por-grupo');
  const femea = porSexo.series[0].points.find((point) => point.xKey === 'F');
  assert.deepEqual(femea.drill.map((part) => part.columnId), ['sexo'], 'o caminho do gráfico é relativo às linhas que ele mostra');
  const patch = chartDrillPatch(drilled, femea.drill);
  assert.deepEqual(patch.drill.map((part) => `${part.columnId}=${part.key}`), ['nome_lote=L2', 'sexo=F'], 'o clique no gráfico SOMA ao detalhe aberto');
  const rowsOf = async (drill) => (await runReport('pesagens', { today: TODAY, params: { periodo: PERIODO }, selection: { view: opened.view, groups: opened.groups, drill, mode: 'DETALHADO' } }, OPERADOR)).rows.map((row) => row.animal_id);
  const merged = [...new Set(await rowsOf(patch.drill))];
  const replaced = [...new Set(await rowsOf(femea.drill))];
  assert.deepEqual(merged, ['A2'], 'folha: só as fêmeas do Lote 02');
  assert.ok(replaced.includes('A4') && !merged.includes('A4'), 'NEGATIVO: trocar o detalhe pelo caminho do gráfico abria as fêmeas de todos os lotes (A4, sem lote)');
  const back = leaveDrillPatch({ ...drilled, ...patch });
  assert.deepEqual([back.drill, back.mode, back.display, back.chartDrill], [lote02, 'DETALHADO', 'graficos', false], 'o × volta aos gráficos do Lote 02');
  assert.deepEqual(leaveDrillPatch({ ...drilled, ...back }), { drill: [], mode: 'RESUMIDO', drillBase: null }, 'o × seguinte sai do detalhe da folha, como antes (Resumido)');
  assert.equal(restingMode({ ...drilled, ...patch }), 'RESUMIDO', 'o modelo guarda o Resumido de onde o detalhe da folha saiu');

  // Tipo Detalhado (Desempenho › Analítico): o × volta ao Detalhado e nada conta como alteração.
  const analitico = getReportView(DESEMPENHO, 'analitico');
  const selection = typedViewSelection(DESEMPENHO, analitico, {});
  const init = defaultState(DESEMPENHO);
  const base = { ...init, view: selection.view, groups: selection.groups, mode: selection.mode, columns: selection.columns ?? init.columns, aggregates: selection.aggregates ?? init.aggregates, display: 'graficos' };
  assert.equal(base.mode, 'DETALHADO');
  const baseline = reportSnapshot(DESEMPENHO, base, 'ADMIN');
  const lote01 = [{ columnId: 'lote', key: 'L1', label: 'Lote 01' }];
  const during = { ...base, ...chartDrillPatch(base, lote01) };
  assert.deepEqual([during.mode, during.display, during.chartDrill], ['DETALHADO', 'folha', true]);
  assert.equal(isReportChanged(baseline, DESEMPENHO, during, 'ADMIN'), false, 'no detalhe aberto pelo gráfico: sem alteração');
  assert.equal(templatePayload(DESEMPENHO, during, 'ADMIN').mode, 'DETALHADO', 'o modelo guarda o modo de onde o detalhe saiu');
  assert.equal(viewStatePayload(DESEMPENHO, during, 'ADMIN').mode, 'DETALHADO', 'o último estado também');
  const after = { ...during, ...leaveDrillPatch(during) };
  assert.deepEqual([after.drill, after.mode, after.display], [[], 'DETALHADO', 'graficos'], 'o × volta ao Analítico, na vista Gráficos');
  assert.equal(isReportChanged(baseline, DESEMPENHO, after, 'ADMIN'), false, 'e "Salvar alterações" continua apagado');
  const oldLeave = { ...during, drill: [], mode: 'RESUMIDO', display: 'graficos', chartDrill: false, drillBase: null };
  assert.equal(isReportChanged(baseline, DESEMPENHO, oldLeave, 'ADMIN'), true, 'NEGATIVO: o × antigo (Resumido sem detalhe) acendia "Salvar alterações" no Analítico');
  assert.equal(isReportChanged(baseline, DESEMPENHO, { ...during, drillBase: null }, 'ADMIN'), true, 'NEGATIVO: sem lembrar o modo de antes, o detalhe acendia "Salvar alterações"');
  const view = read('src/components/reports/ReportView.jsx');
  assert.match(view, /const onChartDrill = \(path\) => update\(chartDrillPatch\(state, drillPatch\(path\)\.drill\)\);/, 'a tela usa chartDrillPatch no clique do gráfico');
  assert.match(view, /const leaveDrill = \(\) => update\(leaveDrillPatch\(state\)\);/, 'e leaveDrillPatch no ×');
  assert.match(view, /const onDrill = \(path\) => update\(\{ \.\.\.drillPatch\(path\), chartDrill: false, drillBase: null \}\);/, 'o clique na folha continua como antes (volta ao Resumido)');

  // "Demais" de um grupo só (8 lotes → 7 + o 8º em cinza): o ponto abre aquele lote naquele mês.
  const resolve = createColumnResolver(PESAGENS.columns);
  const rows = [];
  for (let lote = 1; lote <= 8; lote += 1) {
    for (let animal = 1; animal <= 10 - lote; animal += 1) rows.push({ id: `r${lote}-${animal}`, animal_id: `A${lote}-${animal}`, numero_animal: `${lote}${animal}`, lote_id: `L${lote}`, nome_lote: `Lote 0${lote}`, data_pesagem: '2026-08-10', tipo_manejo: 'Manejo', peso: 200 + lote * 10 + animal * 3, dias: 10, ganho: lote, gmd: lote / 10, arroba_divisor: 30 });
  }
  const synthetic = { reportId: 'pesagens', rows, population: rows, resolve, groups: [], period: { from: '2026-08-01', to: '2026-08-31' }, arrobaDivisor: 30, animalColumnId: 'numero_animal' };
  const line = buildReportCharts(synthetic, PESAGENS, { 'evolucao-peso': { serie: 'lote', eixo: 'mes' } }, 'ADMIN').find((chart) => chart.id === 'evolucao-peso');
  const oitavo = line.series.at(-1);
  assert.deepEqual([oitavo.key, oitavo.label, oitavo.slot], ['L8', 'Lote 08', 'demais'], '8º lote em cinza, com o próprio nome');
  const only = withHiddenSeries(line, line.series.slice(0, -1).map((series) => series.key));
  const click = chartTargetDrill(only, chartHoverTargets(chartGeometry(only, { width: 560, height: 280 }))[0]);
  assert.deepEqual(click.map((part) => `${part.columnId}=${part.key}`), ['nome_lote=L8', 'mes_pesagem=2026-08'], 'clique no Lote 08 = o Lote 08 naquele mês');
  const matches = (path) => rows.filter((row) => path.every((part) => String(resolve(part.columnId).groupKeyOf(row)) === part.key)).length;
  assert.equal(matches(click), rows.filter((row) => row.lote_id === 'L8').length, 'a folha abre só as pesagens do Lote 08');
  const oldPath = groupRows(rows.filter((row) => row.lote_id === 'L8'), [{ columnId: 'mes_pesagem' }], resolve).nodes[0].path;
  assert.ok(matches(oldPath) > matches(click), 'NEGATIVO: o caminho antigo (só o mês) abria as pesagens de todos os lotes');
  assert.equal(oitavo.points[0].text, line.tabela.linhas[7][1], 'o ponto e a tabela têm o mesmo número');

  // Todas as séries escondidas: o gráfico diz isso (não "nenhum valor").
  const allHidden = withHiddenSeries(line, line.series.map((series) => series.key));
  const svg = renderChartSvg(allHidden, chartGeometry(allHidden, { width: 560, height: 280 }));
  assert.ok(svg.includes(TEXTO_TODAS_ESCONDIDAS) && !svg.includes('Nenhum valor'), 'todas escondidas: aviso próprio');
  const vazio = buildReportCharts({ ...vm, rows: vm.rows.filter((row) => row.tipo_manejo === 'Cadastro') }, PESAGENS, {}, 'OPERADOR').find((chart) => chart.id === 'gmd-por-grupo');
  assert.ok(renderChartSvg(vazio).includes(TEXTO_SEM_GMD), 'sem valor de verdade: continua o porquê');
  results.push({ caso: 'revisão', somaDetalhe: patch.drill.length, voltaAoModo: after.mode, demaisDeUm: click.length });
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:charts-state:verify', ok: true, cases: results }, null, 2));
