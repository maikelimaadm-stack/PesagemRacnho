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
//      ("Imprimir só os gráficos", "PDF só dos gráficos") e o alternador estão na tela.
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
import { templatePayload, viewStatePayload } from '../src/modules/reporting/domain/reportScreenState.js';
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

await resetDb();
console.log(JSON.stringify({ gate: 'reports:charts-state:verify', ok: true, cases: results }, null, 2));
