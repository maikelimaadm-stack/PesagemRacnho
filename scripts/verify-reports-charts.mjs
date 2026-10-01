// Gate reports:charts:verify (E1G 1.4.2 — docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B): os GRÁFICOS dos
// relatórios saem do MESMO view model do runReport, pelo MESMO motor (groupRows/computeAggregates) e com os
// MESMOS specs da folha — o gráfico bate com a folha por construção. Massa de TESTE (scripts/lib/reportFixtures:
// fake-indexeddb, ago–set/2026, conferível à mão) + um view model sintético de 9 lotes. Casos:
//   a) definições: Pesagens/Desempenho/Rebanho declaram os gráficos; defineCharts recusa coluna sensível, coluna
//      desconhecida, operação não permitida, chave desconhecida, id repetido (NEGATIVOS); o opcional sem coluna
//      fica fora com aviso (Rebanho "GMD médio por lote" — nas duas ordens do merge com a trilha GMD);
//   b) Evolução Lote × Mês = as células do Sintético (Matriz) (346,67/345; 255/280), total e "Média geral" =
//      vm.totals, texto = sheetNumberText (o da folha); tempo PROPORCIONAL às datas (NEGATIVO: por índice não);
//   c) GMD por grupo: Lote 01 1,125 (45 ÷ 40), cobertura 1 de 2, grupo sem GMD fora das barras e em texto (nunca
//      0 — NEGATIVO), barras em ordem, o resto = a folha; Desempenho 1,056 (75 ÷ 71) — as duas definições;
//   d) Ganho por mês: ago 40 kg = 1,333 @; soma das colunas = totais da folha; nota "@ = peso vivo ÷ 30";
//   e) histogramas: última pesagem COM PESO por animal (NEGATIVO: a Saída sem peso não apaga o animal), faixas
//      semiabertas (300 cai em [300, 330) — NEGATIVO: fechada à direita não), soma = cabeças com peso; faixas
//      de GMD do Desempenho; Rebanho;
//   f) halteres: final − inicial = ganho médio da folha, só com par válido (NEGATIVO: com todos os animais não);
//   g) 9 lotes → 7 + "Demais", calculado sobre a UNIÃO das linhas (NEGATIVO: não é a média das médias);
//   h) cor segue a entidade (filtro e detalhe não repintam — NEGATIVO: por posição repintaria); o detalhe de um
//      grupo recorta as linhas do gráfico; a série segue o 1º nível do tipo; CONSULTA recebe os mesmos gráficos;
//   i) y null = "-" em todo texto; normalizeChartConfig (desconhecido sai com aviso); geometria (peso sem partir de
//      0, base 0 nas barras, ≤ 24 px com ponta arredondada, rótulos diretos sem colidir).
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { PESAGENS, SHEET_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';
import { DESEMPENHO } from '../src/modules/reporting/definitions/desempenho.js';
import { REBANHO_ATUAL, REBANHO_CHARTS } from '../src/modules/reporting/definitions/rebanho.js';
import { ANIMAL_CURRENT_COLUMNS } from '../src/modules/reporting/definitions/columns/animalColumns.js';
import { createColumnResolver, defineReport } from '../src/modules/reporting/domain/reportDefinition.js';
import { defineColumn, indexColumns } from '../src/modules/reporting/domain/columnDefinition.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { aggregateValueColumn } from '../src/modules/reporting/domain/aggregateLabels.js';
import { sheetNumberText } from '../src/modules/reporting/domain/reportDocument.js';
import { buildMatrix } from '../src/modules/reporting/domain/matrixLayout.js';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import {
  CHART_SLOTS, FAIXAS_GMD, buildReportCharts, chartColumnIds, chartsOf, defineCharts, faixaDe, faixasDePeso, normalizeChartConfig, ultimaPesagemPorAnimal,
} from '../src/modules/reporting/domain/reportCharts.js';
import { chartGeometry, dayNumber, niceTicks, spreadLabels } from '../src/modules/reporting/domain/chartScale.js';

const results = [];
const PERIODO = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const close = (actual, expected, message, tolerance = 1e-9) => assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${message}: esperado ${expected}, veio ${actual}`);
const errorOf = (fn) => { try { fn(); return null; } catch (error) { return error.message; } };
const chartOf = (charts, id) => charts.find((chart) => chart.id === id);
const seriesOf = (chart, key) => chart.series.find((series) => series.key === key);
const pointOf = (series, xKey) => series.points.find((point) => point.xKey === xKey);
const textOf = (vm, spec, value) => sheetNumberText(aggregateValueColumn(spec, [vm.resolve(spec.columnId).column]), value, { op: spec.op });

await seedReportFixture();

// ---------------------------------------------------------------------------------------------------------
// a) Definições e validação
// ---------------------------------------------------------------------------------------------------------
{
  assert.deepEqual(PESAGENS.charts.map((chart) => chart.id), ['evolucao-peso', 'gmd-por-grupo', 'ganho-por-mes', 'distribuicao-peso'], 'Pesagens: os 4 gráficos (NEGATIVO: antes da E1G a definição não tinha charts)');
  assert.deepEqual(DESEMPENHO.charts.map((chart) => chart.id), ['gmd-por-grupo', 'peso-inicial-final', 'faixas-gmd', 'distribuicao-peso'], 'Desempenho: os 4 gráficos');
  assert.ok(REBANHO_ATUAL.charts.some((chart) => chart.id === 'distribuicao-peso'), 'Rebanho: distribuição do peso atual');
  // "GMD médio por lote" do Rebanho depende das colunas de GMD do Rebanho (trilha GMD da E1G): presente se a folha
  // já tem o GMD médio ponderado; senão fora, com aviso — o gate vale nas duas ordens do merge.
  const rebanhoGmd = REBANHO_ATUAL.charts.find((chart) => chart.id === 'gmd-por-lote');
  const rebanhoSkip = REBANHO_ATUAL.chartsSkipped.find((item) => item.id === 'gmd-por-lote');
  assert.ok(Boolean(rebanhoGmd) !== Boolean(rebanhoSkip), 'Rebanho "GMD médio por lote": ou está nos gráficos, ou fora com aviso — nunca os dois, nunca sumido');
  if (rebanhoSkip) assert.match(rebanhoSkip.motivo, /GMD médio por lote/, 'aviso diz qual gráfico ficou fora');
  if (rebanhoGmd) assert.equal(rebanhoGmd.valor.op, 'weightedGmd', 'Rebanho: GMD ponderado da folha');
  for (const definition of [PESAGENS, DESEMPENHO, REBANHO_ATUAL]) {
    const byId = indexColumns(definition.columns);
    for (const id of chartColumnIds(definition)) {
      assert.ok(byId.has(id), `${definition.id}: coluna ${id} do gráfico existe no grão`);
      assert.equal(byId.get(id).sensitive, null, `${definition.id}: gráfico só com coluna não sensível (${id})`);
    }
  }
  // NEGATIVOS da validação (defineCharts direto, colunas de Pesagens).
  const byId = indexColumns(PESAGENS.columns);
  const base = { id: 'x', kind: 'barras', title: 'X', controls: { serie: { label: 'Por', choices: [{ id: 'lote', label: 'Lote', columnId: 'nome_lote' }] } }, cab: { id: 'qtd', columnId: 'numero_animal', op: 'countDistinct' }, valor: { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' } };
  const context = { context: 'relatório teste', grain: PESAGENS.grain, aggregates: PESAGENS.defaultAggregates };
  assert.equal(defineCharts([base], byId, context).charts.length, 1, 'declaração válida passa');
  assert.match(errorOf(() => defineCharts([{ ...base, valor: { id: 'v', columnId: 'valor_arroba', op: 'avg' } }], byId, context)), /sensível/, 'NEGATIVO: gráfico com valor_arroba (sensível) é recusado');
  assert.match(errorOf(() => defineCharts([{ ...base, controls: { serie: { label: 'Por', choices: [{ id: 'c', label: 'Comprador', columnId: 'comprador' }, { id: 'v', label: 'Valor', columnId: 'valor_venda_total' }] } } }], byId, context)), /sensível|agrupável/, 'NEGATIVO: nem por um controle entra coluna sensível');
  assert.match(errorOf(() => defineCharts([{ ...base, valor: { id: 'v', columnId: 'nao_existe', op: 'avg' } }], byId, context)), /desconhecida/, 'NEGATIVO: coluna desconhecida');
  assert.match(errorOf(() => defineCharts([{ ...base, valor: { id: 'v', columnId: 'peso', op: 'weightedGmd' } }], byId, context)), /não permitida/, 'NEGATIVO: operação não permitida na coluna');
  assert.match(errorOf(() => defineCharts([{ ...base, cor: 'red' }], byId, context)), /chave desconhecida/, 'NEGATIVO: chave desconhecida');
  assert.match(errorOf(() => defineCharts([base, base], byId, context)), /duplicado/, 'NEGATIVO: id repetido');
  assert.match(errorOf(() => defineCharts([{ ...base, controls: { serie: { label: 'Por', choices: [{ id: 'data', label: 'Data', columnId: 'peso' }] } } }], byId, context)), /agrupável/, 'NEGATIVO: série em coluna não agrupável');
  const optional = defineCharts([{ ...base, opcional: true, valor: { op: 'weightedGmd', columnId: 'gmd_desde_entrada_x' } }], byId, context);
  assert.equal(optional.charts.length, 0, 'opcional sem a coluna fica fora');
  assert.match(optional.skipped[0].motivo, /gmd_desde_entrada_x/, 'e o aviso diz a coluna');
  const fromSheet = defineCharts([{ ...base, valor: { op: 'weightedGmd' } }], byId, context).charts[0];
  assert.deepEqual({ ...fromSheet.valor }, { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' }, 'spec sem coluna = o total da folha com a mesma operação (mesmo id)');
  assert.match(errorOf(() => defineReport({ ...PESAGENS, charts: [{ ...base, valor: { id: 'v', columnId: 'valor_arroba', op: 'avg' } }] })), /sensível/, 'NEGATIVO: defineReport chama defineCharts');
  results.push({ caso: 'definições', pesagens: PESAGENS.charts.length, desempenho: DESEMPENHO.charts.length, rebanho: REBANHO_ATUAL.charts.map((chart) => chart.id), rebanhoFora: REBANHO_ATUAL.chartsSkipped.map((item) => item.id) });
}

// ---------------------------------------------------------------------------------------------------------
// b) Evolução Lote × Mês = Sintético (Matriz)
// ---------------------------------------------------------------------------------------------------------
const matrixVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: { view: 'sintetico-matriz', matrix: { eixoY: 'lote', eixoX: 'mes' } } }, ADMIN);
{
  const charts = buildReportCharts(matrixVm, PESAGENS, { 'evolucao-peso': { serie: 'lote', eixo: 'mes', metrica: 'peso' } }, ADMIN.role);
  const chart = chartOf(charts, 'evolucao-peso');
  const peso = PESAGENS.charts[0].controls.metrica.choices[0].valor;
  // À mão: Lote 01 ago (300, 330, 410) ÷ 3 = 346,67; set 345 (A3 morreu sem peso); Lote 02 ago (250, 260) = 255; set 280.
  close(pointOf(seriesOf(chart, 'L1'), '2026-08').y, 1040 / 3, 'Lote 01 ago');
  close(pointOf(seriesOf(chart, 'L1'), '2026-09').y, 345, 'Lote 01 set');
  close(pointOf(seriesOf(chart, 'L2'), '2026-08').y, 255, 'Lote 02 ago');
  close(pointOf(seriesOf(chart, 'L2'), '2026-09').y, 280, 'Lote 02 set');
  assert.equal(pointOf(seriesOf(chart, 'L1'), '2026-09').cab, 2, 'Cab. em cada ponto (A1 e A3)');
  const matrix = buildMatrix(matrixVm);
  for (const row of matrix.rows) {
    row.cells.forEach((cell, index) => {
      const point = pointOf(seriesOf(chart, row.key), matrix.columns[index].key);
      if (!cell) { assert.equal(point, undefined, 'cruzamento sem pesagem = sem ponto'); return; }
      assert.equal(point.y, cell.aggregates.peso_medio.value, `ponto = célula da matriz (${row.label} × ${matrix.columns[index].label})`);
      assert.equal(point.cab, cell.aggregates.qtd.value, 'Cab. = Qtd da matriz');
      assert.equal(point.text, textOf(matrixVm, peso, point.y), 'texto = sheetNumberText (o da folha)');
    });
  }
  assert.equal(chart.total.valor, matrixVm.totals.peso_medio.value, 'total = vm.totals');
  assert.equal(chart.referencia.valor, matrixVm.totals.peso_medio.value, '"Média geral" = total da folha');
  assert.equal(pointOf(seriesOf(chart, 'L1'), '2026-08').text, '346,7 kg', 'rótulo em pt-BR com a unidade, como a folha');
  assert.deepEqual(chart.tabela.cabecalho, ['Lote', 'ago/2026', 'set/2026', 'No período'], 'tabela Série × Mês');
  assert.equal(chart.tabela.linhas.at(-1)[0], 'Todos', 'linha Todos = total por mês');
  // Tempo proporcional (defeito da curva antiga: eixo pelo índice). Série Todos por Data: 11 dias (21/08 → 01/09)
  // e 2 dias (10/09 → 12/09) não podem ficar do mesmo tamanho.
  const byDate = chartOf(buildReportCharts(matrixVm, PESAGENS, { 'evolucao-peso': { serie: 'todos', eixo: 'data' } }, ADMIN.role), 'evolucao-peso');
  const geometry = chartGeometry(byDate, { width: 718, height: 260 });
  const px = new Map(geometry.hover.columns.map((column) => [column.xKey, column.x]));
  const gapLong = px.get('2026-09-01') - px.get('2026-08-21');
  const gapShort = px.get('2026-09-12') - px.get('2026-09-10');
  close(gapLong / gapShort, 11 / 2, 'distância em px proporcional aos dias', 0.05);
  assert.notEqual(Math.round(gapLong), Math.round(gapShort), 'NEGATIVO: por índice as duas distâncias seriam iguais');
  assert.equal(pointOf(byDate.series[0], '2026-09-01').y, null, '01/09: só a Saída sem peso → ponto ausente (y null)');
  assert.ok(!geometry.lines[0].points.some((point) => point.key === '2026-09-01'), 'e sem marcador (nunca 0)');
  results.push({ caso: 'evolução = matriz', lote01: [pointOf(seriesOf(chart, 'L1'), '2026-08').text, pointOf(seriesOf(chart, 'L1'), '2026-09').text], razaoPx: Number((gapLong / gapShort).toFixed(3)) });
}

// ---------------------------------------------------------------------------------------------------------
// c) GMD por grupo — Pesagens (contra a anterior) e Desempenho (do período)
// ---------------------------------------------------------------------------------------------------------
{
  const sheetVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: { view: 'por-apartacao-lote', aggregates: [...SHEET_TOTALS] } }, ADMIN);
  const chart = chartOf(buildReportCharts(sheetVm, PESAGENS, { 'gmd-por-grupo': { serie: 'lote' } }, ADMIN.role), 'gmd-por-grupo');
  const bars = chart.series[0].points;
  close(pointOf(chart.series[0], 'L1').y, 45 / 40, 'Lote 01: (30 + 15) ÷ (20 + 20) = 1,125');
  assert.equal(pointOf(chart.series[0], 'L1').text, '1,125', 'GMD com 3 casas (sheetNumberText)');
  assert.deepEqual(pointOf(chart.series[0], 'L1').cobertura, { validos: 1, total: 2 }, 'cobertura: GMD de 1 de 2 animais (A1 sim, A3 não)');
  assert.match(pointOf(chart.series[0], 'L1').rotulo, /^1,125 kg\/dia · 2 cab\. · GMD de 1$/, 'rótulo da barra');
  // O resto bate com a FOLHA (Por Apartação/Lote, GMD médio do lote) — a trilha GMD pode mudar o número do Lote 02
  // (Saída com peso) e o gráfico acompanha sem mudança.
  const loteNodes = sheetVm.tree.flatMap((node) => node.children);
  for (const bar of bars) assert.equal(bar.y, loteNodes.find((node) => node.key === bar.xKey).aggregates.gmd_medio.value, `barra ${bar.xLabel} = GMD médio da folha`);
  assert.equal(chart.referencia.valor, sheetVm.totals.gmd_medio.value, 'GMD geral = total da folha');
  for (let index = 1; index < bars.length; index += 1) assert.ok(bars[index - 1].y >= bars[index].y, 'barras do maior para o menor');
  assert.ok(!bars.some((bar) => bar.xKey === '__nao_informado__'), 'NEGATIVO: A4 (só Cadastro) não vira barra 0');
  assert.ok(!bars.some((bar) => bar.y === 0), 'nenhuma barra 0 inventada');
  assert.deepEqual(chart.semValor.itens.map((item) => [item.label, item.cab]), [['Não informado', 1]], 'grupo sem GMD em texto');
  assert.equal(chart.semValor.texto, 'Sem GMD: Não informado (1 cab.)');
  assert.match(chart.subtitle, /pesagem anterior/, 'subtítulo diz a definição (Pesagens: contra a anterior)');
  assert.match(chart.cobertura.texto, /^GMD de 2 de 4 cab\.$/, 'cobertura do gráfico');

  const desVm = await runReport('desempenho', { today: TODAY, params: PERIODO }, CONSULTA);
  const des = chartOf(buildReportCharts(desVm, DESEMPENHO, {}, CONSULTA.role), 'gmd-por-grupo');
  close(des.referencia.valor, 75 / 71, 'Desempenho: (45 + 30) ÷ (40 + 31) = 1,056');
  assert.equal(des.referencia.valor, desVm.totals.gmd_ponderado.value, 'Desempenho = gmd_ponderado da folha');
  assert.equal(des.referencia.text, '1,056');
  close(pointOf(des.series[0], 'L1').y, 1.125, 'Desempenho Lote 01');
  assert.match(des.subtitle, /período/, 'subtítulo diz a definição (Desempenho: do período)');
  // E1G (integração): com a venda pesada recebendo GMD (A1) e o Desempenho partindo da pesagem anterior ao período (A2),
  // as duas definições coincidem nesta massa — (45 + 30) ÷ (40 + 31) nos dois. O subtítulo continua dizendo qual é.
  assert.equal(des.referencia.text, chart.referencia.text, 'Pesagens e Desempenho dão o mesmo GMD geral nesta massa (A1 + A2)');
  results.push({ caso: 'GMD por grupo', pesagens: bars.map((bar) => `${bar.xLabel} ${bar.text}`), geralPesagens: chart.referencia.text, desempenho: des.referencia.text });
}

// ---------------------------------------------------------------------------------------------------------
// d) Ganho e @ por mês
// ---------------------------------------------------------------------------------------------------------
{
  const sheetVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: { view: 'por-apartacao-lote', aggregates: [...SHEET_TOTALS] } }, ADMIN);
  const kg = chartOf(buildReportCharts(sheetVm, PESAGENS, { 'ganho-por-mes': { serie: 'todos', metrica: 'kg' } }, ADMIN.role), 'ganho-por-mes');
  const arroba = chartOf(buildReportCharts(sheetVm, PESAGENS, { 'ganho-por-mes': { serie: 'todos', metrica: 'arroba' } }, ADMIN.role), 'ganho-por-mes');
  close(pointOf(kg.series[0], '2026-08').y, 40, 'ago: 30 (A1) + 10 (A2) = 40 kg');
  close(pointOf(arroba.series[0], '2026-08').y, 40 / 30, 'ago: 40 ÷ 30 = 1,333 @');
  assert.equal(pointOf(kg.series[0], '2026-08').text, '40,0 kg');
  assert.equal(pointOf(arroba.series[0], '2026-08').text, '1,33');
  const sum = (chart) => chart.series[0].points.reduce((total, point) => total + (point.y ?? 0), 0);
  close(sum(kg), sheetVm.totals.ganho_total.value, 'soma das colunas = Ganho total da folha');
  close(sum(arroba), sheetVm.totals.ganho_total_arroba.value, 'soma das colunas em @ = Ganho total (@) da folha');
  close(pointOf(kg.series[0], '2026-09').y, sheetVm.totals.ganho_total.value - 40, 'set = total − ago (15 kg hoje)');
  assert.ok(arroba.notas.includes('@ = peso vivo ÷ 30 (Configurações › Relatórios).'), 'nota do divisor da @ (vm.arrobaDivisor)');
  assert.equal(pointOf(kg.series[0], '2026-08').tone, CHART_SLOTS.POS, 'série única: ganho em verde, perda em vermelho');
  const byLote = chartOf(buildReportCharts(sheetVm, PESAGENS, { 'ganho-por-mes': { serie: 'lote' } }, ADMIN.role), 'ganho-por-mes');
  // Por lote: as colunas de cada mês somam a do "Todos" (soma é aditiva — cada pesagem está num lote só).
  for (const point of kg.series[0].points) {
    close(byLote.series.reduce((total, series) => total + (pointOf(series, point.xKey)?.y ?? 0), 0), point.y, `${point.xLabel}: lotes somam o mês`);
  }
  assert.deepEqual(byLote.series.map((series) => series.label), ['Lote 01', 'Lote 02', 'Não informado'], 'séries por lote, "Não informado" por último');
  results.push({ caso: 'ganho por mês', ago: [pointOf(kg.series[0], '2026-08').text, pointOf(arroba.series[0], '2026-08').text], total: sheetVm.totals.ganho_total.value });
}

// ---------------------------------------------------------------------------------------------------------
// e) Histogramas
// ---------------------------------------------------------------------------------------------------------
{
  const last = ultimaPesagemPorAnimal(matrixVm.rows, matrixVm.resolve, 'numero_animal', 'peso');
  const byAnimal = new Map(last.map((item) => [item.row.animal_id, item]));
  assert.equal(byAnimal.get('A3').value, 410, 'A3: a Saída por morte SEM peso não apaga o animal — fica a última com peso (410)');
  assert.equal(byAnimal.get('A3').row.id, 'e7', 'NEGATIVO: a linha literal mais recente (e8, sem peso) não é usada');
  assert.equal(byAnimal.get('A1').value, 345, 'A1: última pesagem (10/09)');
  const hist = chartOf(buildReportCharts(matrixVm, PESAGENS, { 'distribuicao-peso': { faixa: 'auto' } }, ADMIN.role), 'distribuicao-peso');
  const counted = hist.series[0].points.reduce((total, point) => total + point.y, 0);
  assert.equal(counted, 4, 'soma das faixas = cabeças com peso (4)');
  assert.ok(hist.series[0].points.length <= 14 && hist.series[0].points.length >= 8, `automática: 8–14 faixas (${hist.series[0].points.length})`);
  // Faixa semiaberta [300, 330): período até 15/08 → A1 com 300 kg (01/08) cai em [300, 330).
  const early = await runReport('pesagens', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-08-15' } }, selection: { view: 'analitico' } }, ADMIN);
  const h30 = chartOf(buildReportCharts(early, PESAGENS, { 'distribuicao-peso': { faixa: '30' } }, ADMIN.role), 'distribuicao-peso');
  assert.equal(pointOf(h30.series[0], '300-330').y, 1, '300 kg cai em [300, 330)');
  assert.equal(pointOf(h30.series[0], '270-300').y, 0, 'NEGATIVO: faixa fechada à direita poria 300 em [270, 300]');
  assert.equal(pointOf(h30.series[0], '300-330').xLabel, '300–330 kg');
  assert.equal(faixaDe(300, faixasDePeso([260, 300, 410], 30)).key, '300-330');
  assert.equal(faixaDe(329.99, faixasDePeso([260, 300, 410], 30)).key, '300-330');
  // Desempenho: faixas de GMD (A1 1,125 e A2 0,968 em [0,9; 1,2)); A3 e A4 sem GMD.
  const desVm = await runReport('desempenho', { today: TODAY, params: PERIODO }, ADMIN);
  const faixas = chartOf(buildReportCharts(desVm, DESEMPENHO, {}, ADMIN.role), 'faixas-gmd');
  assert.deepEqual(faixas.series[0].points.map((point) => point.y), [0, 0, 0, 0, 2, 0], 'faixas de curral de GMD');
  assert.deepEqual(faixas.series[0].points.map((point) => point.xKey), FAIXAS_GMD.map((band) => band.key));
  assert.equal(faixas.series[0].points[0].tone, 'neg', '< 0 (perdendo peso) no vermelho reservado');
  assert.equal(faixas.semValor.texto, 'Sem GMD: 2 cab.', 'sem GMD em texto');
  const desPeso = chartOf(buildReportCharts(desVm, DESEMPENHO, {}, ADMIN.role), 'distribuicao-peso');
  assert.equal(desPeso.series[0].points.reduce((total, point) => total + point.y, 0), desVm.rows.filter((row) => row.peso_final > 0).length, 'Desempenho: soma = animais com peso final');
  close(desPeso.referencia.valor, desVm.totals.peso_final_medio.value, 'marca do peso médio = Peso final médio da folha');
  const rebVm = await runReport('rebanho.atual', { today: TODAY }, ADMIN);
  const reb = chartOf(buildReportCharts(rebVm, REBANHO_ATUAL, {}, ADMIN.role), 'distribuicao-peso');
  assert.equal(reb.series[0].points.reduce((total, point) => total + point.y, 0), rebVm.rows.filter((row) => row.ultimo_peso_kg > 0).length, 'Rebanho: soma = ativos com peso');
  close(reb.referencia.valor, rebVm.totals.peso_medio.value, 'Rebanho: marca = Peso médio da folha');
  const categorias = chartOf(buildReportCharts(rebVm, REBANHO_ATUAL, { 'distribuicao-peso': { faixa: 'categorias' } }, ADMIN.role), 'distribuicao-peso');
  assert.equal(categorias.series[0].points.reduce((total, point) => total + point.y, 0), reb.total.valor, '"Faixas das categorias" = a coluna Faixa de peso, mesma soma');
  results.push({ caso: 'histogramas', pesagens: hist.series[0].points.filter((point) => point.y).map((point) => `${point.xLabel}: ${point.y}`), faixasGmd: faixas.series[0].points.map((point) => point.y) });
}

// ---------------------------------------------------------------------------------------------------------
// f) Halteres
// ---------------------------------------------------------------------------------------------------------
{
  const desVm = await runReport('desempenho', { today: TODAY, params: PERIODO }, ADMIN);
  const chart = chartOf(buildReportCharts(desVm, DESEMPENHO, { 'peso-inicial-final': { serie: 'lote' } }, ADMIN.role), 'peso-inicial-final');
  const [start, end] = chart.series;
  for (const point of end.points) {
    const from = pointOf(start, point.xKey).y;
    const gain = desVm.rows.filter((row) => row.lote_id === point.xKey && row.ganho != null);
    close(point.y - from, gain.reduce((total, row) => total + row.ganho, 0) / gain.length, `${point.xLabel}: final − inicial = ganho médio`);
  }
  close(chart.total.valor, desVm.totals.ganho_medio.value, 'Todos: final − inicial = Ganho médio da folha (37,5)');
  close(desVm.totals.ganho_medio.value, 37.5, 'à mão: (45 + 30) ÷ 2');
  const allFinal = desVm.rows.reduce((total, row) => total + row.peso_final, 0) / desVm.rows.length;
  const allStart = desVm.rows.reduce((total, row) => total + row.peso_inicial, 0) / desVm.rows.length;
  assert.notEqual(Number((allFinal - allStart).toFixed(6)), 37.5, 'NEGATIVO: com todos os animais (sem par) a diferença não é o ganho médio');
  assert.equal(pointOf(end, 'L1').rotulo, '+45,0 kg · 1,125 kg/dia · 1 cab.', 'rótulo do haltere');
  assert.match(chart.semValor.texto, /Não informado \(1 cab\.\)/, 'grupo sem par em texto');
  results.push({ caso: 'halteres', lote01: pointOf(end, 'L1').rotulo });
}

// ---------------------------------------------------------------------------------------------------------
// g) 9 lotes → 7 + "Demais" (união das linhas)
// ---------------------------------------------------------------------------------------------------------
{
  const resolve = createColumnResolver(PESAGENS.columns);
  const rows = [];
  for (let lote = 1; lote <= 9; lote += 1) {
    // Lote n com (10 − n) animais: tamanhos diferentes, para a média das médias não coincidir com a da união.
    for (let animal = 1; animal <= 10 - lote; animal += 1) {
      rows.push({ id: `r${lote}-${animal}`, animal_id: `A${lote}-${animal}`, numero_animal: `${lote}${animal}`, lote_id: `L${lote}`, nome_lote: `Lote ${String(lote).padStart(2, '0')}`, data_pesagem: '2026-08-10', tipo_manejo: 'Manejo', peso: 200 + lote * 10 + animal * 3, dias: 10, ganho: lote, gmd: lote / 10, arroba_divisor: 30 });
    }
  }
  const vm = { reportId: 'pesagens', rows, population: rows, resolve, groups: [], period: { from: '2026-08-01', to: '2026-08-31' }, arrobaDivisor: 30, animalColumnId: 'numero_animal' };
  const chart = chartOf(buildReportCharts(vm, PESAGENS, { 'evolucao-peso': { serie: 'lote', eixo: 'mes' } }, ADMIN.role), 'evolucao-peso');
  assert.equal(chart.series.length, 8, '9 lotes → 7 com cor + "Demais"');
  assert.deepEqual(chart.series.slice(0, 7).map((series) => series.slot), [1, 2, 3, 4, 5, 6, 7], '7 cores na ordem fixa');
  const demais = chart.series[7];
  assert.equal(demais.label, 'Demais (2 lotes)');
  assert.equal(demais.slot, CHART_SLOTS.DEMAIS, '"Demais" em cinza');
  assert.deepEqual(demais.membros, ['L8', 'L9'], 'ficam os 7 com mais cabeças');
  const rest = rows.filter((row) => ['L8', 'L9'].includes(row.lote_id));
  const union = rest.reduce((total, row) => total + row.peso, 0) / rest.length;
  const avgOf = (id) => { const list = rows.filter((row) => row.lote_id === id); return list.reduce((total, row) => total + row.peso, 0) / list.length; };
  const meanOfMeans = (avgOf('L8') + avgOf('L9')) / 2;
  close(demais.points[0].y, union, '"Demais" = peso médio da UNIÃO das linhas');
  assert.notEqual(Number(union.toFixed(6)), Number(meanOfMeans.toFixed(6)), 'NEGATIVO: a média das médias daria outro número');
  results.push({ caso: '9 lotes', series: chart.series.map((series) => series.label), demais: demais.points[0].text });
}

// ---------------------------------------------------------------------------------------------------------
// h) Cor pela entidade, detalhe, série do tipo, CONSULTA
// ---------------------------------------------------------------------------------------------------------
{
  const slotOf = (vm, key) => seriesOf(chartOf(buildReportCharts(vm, PESAGENS, { 'evolucao-peso': { serie: 'lote' } }, ADMIN.role), 'evolucao-peso'), key)?.slot;
  assert.equal(slotOf(matrixVm, 'L2'), 2, 'Lote 02 = cor 2 (ordem da população)');
  const femeas = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: { view: 'sintetico-matriz', matrix: { eixoY: 'lote', eixoX: 'mes' }, filters: { sexo: { operator: 'in', values: ['F'] } } } }, ADMIN);
  assert.ok(!femeas.rows.some((row) => row.lote_id === 'L1'), 'filtro Fêmeas tira o Lote 01');
  assert.equal(slotOf(femeas, 'L2'), 2, 'filtrar não repinta: Lote 02 continua cor 2 (NEGATIVO: pela posição viraria cor 1)');
  const detalhe = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: { view: 'sintetico-matriz', matrix: { eixoY: 'lote', eixoX: 'mes' }, drill: [{ columnId: 'nome_lote', key: 'L2' }] } }, ADMIN);
  const drillCharts = buildReportCharts(detalhe, PESAGENS, { 'evolucao-peso': { serie: 'lote' }, 'gmd-por-grupo': { serie: 'lote' } }, ADMIN.role);
  assert.deepEqual(chartOf(drillCharts, 'evolucao-peso').series.map((series) => series.key), ['L2'], 'detalhe de um grupo: o gráfico usa as linhas recortadas');
  assert.deepEqual(chartOf(drillCharts, 'gmd-por-grupo').series[0].points.map((point) => point.xKey), ['L2']);
  assert.equal(slotOf(detalhe, 'L2'), 2, 'e a cor do grupo não muda');
  assert.deepEqual(pointOf(seriesOf(chartOf(buildReportCharts(matrixVm, PESAGENS, {}, ADMIN.role), 'evolucao-peso'), 'L1'), '2026-08').drill, [{ columnId: 'nome_lote', key: 'L1', label: 'Lote 01' }, { columnId: 'mes_pesagem', key: '2026-08', label: 'ago/2026' }], 'ponto leva o caminho do detalhe (onDrill)');
  // A série segue o 1º nível do tipo quando está entre as opções: Desempenho "Por Categoria" → GMD por categoria.
  const porCategoria = await runReport('desempenho', { today: TODAY, params: PERIODO, selection: { view: 'por-categoria' } }, ADMIN);
  assert.equal(chartOf(buildReportCharts(porCategoria, DESEMPENHO, {}, ADMIN.role), 'gmd-por-grupo').config.serie, 'categoria', 'Por Categoria abre o GMD por categoria');
  assert.equal(chartOf(buildReportCharts(porCategoria, DESEMPENHO, { 'gmd-por-grupo': { serie: 'lote' } }, ADMIN.role), 'gmd-por-grupo').config.serie, 'lote', 'a escolha da pessoa vale mais');
  // CONSULTA: os mesmos gráficos (só colunas não sensíveis).
  const consultaVm = await runReport('pesagens', { today: TODAY, params: PERIODO, selection: { view: 'sintetico-matriz', matrix: { eixoY: 'lote', eixoX: 'mes' } } }, CONSULTA);
  assert.equal(chartsOf(PESAGENS, CONSULTA.role).length, 4, 'CONSULTA vê os 4 gráficos');
  assert.deepEqual(buildReportCharts(consultaVm, PESAGENS, {}, CONSULTA.role), buildReportCharts(matrixVm, PESAGENS, {}, ADMIN.role), 'CONSULTA recebe exatamente os mesmos gráficos');
  assert.deepEqual(chartsOf(PESAGENS, 'SEM_PAPEL'), [], 'papel sem acesso ao relatório: nenhum gráfico');
  results.push({ caso: 'cor/detalhe/CONSULTA', lote02: 2 });
}

// ---------------------------------------------------------------------------------------------------------
// i) null = "-", configuração, geometria
// ---------------------------------------------------------------------------------------------------------
{
  const every = [
    ...buildReportCharts(matrixVm, PESAGENS, { 'ganho-por-mes': { serie: 'lote' }, 'evolucao-peso': { metrica: 'gmd' } }, ADMIN.role),
    ...buildReportCharts(await runReport('desempenho', { today: TODAY, params: PERIODO }, ADMIN), DESEMPENHO, {}, ADMIN.role),
  ];
  let nulls = 0;
  for (const chart of every) for (const series of chart.series) for (const point of series.points) if (point.y == null) { nulls += 1; assert.equal(point.text, '-', `${chart.id}: y null = "-" (nunca 0)`); }
  assert.ok(nulls >= 2, 'a massa tem pontos sem valor (Lote 02 set sem ganho; A4)');
  const ganhoLote = chartOf(every, 'ganho-por-mes');
  assert.equal(ganhoLote.tabela.linhas.find((line) => line[0] === 'Não informado')[1], '', 'sem pesagem no mês = célula vazia; com pesagem sem valor = "-"');

  const { config, warnings } = normalizeChartConfig(PESAGENS, {
    'evolucao-peso': { serie: 'raca', eixo: 'semana', cor: 'x', oculto: ['L1', 'L1', 3] },
    'grafico-velho': { serie: 'lote' },
    'gmd-por-grupo': 'lote',
  });
  assert.deepEqual(config, { 'evolucao-peso': { serie: 'raca', oculto: ['L1'] } }, 'só o que a definição declara');
  assert.deepEqual(warnings.map((warning) => warning.code).sort(), ['CHART_CHOICE_UNKNOWN', 'CHART_CONFIG_INVALID', 'CHART_OPTION_UNKNOWN', 'CHART_UNKNOWN'], 'desconhecido sai com aviso');
  assert.deepEqual(normalizeChartConfig(PESAGENS, null), { config: {}, warnings: [] });
  const hidden = chartOf(buildReportCharts(matrixVm, PESAGENS, { 'evolucao-peso': { serie: 'lote', oculto: ['L1'] } }, ADMIN.role), 'evolucao-peso');
  assert.equal(seriesOf(hidden, 'L1').oculto, true, 'série oculta pela legenda');
  assert.ok(!chartGeometry(hidden).lines.some((line) => line.key === 'L1'), 'oculta não é desenhada (as outras não mudam de cor)');
  assert.equal(seriesOf(hidden, 'L2').slot, 2);

  const peso = chartOf(buildReportCharts(matrixVm, PESAGENS, { 'evolucao-peso': { serie: 'lote' } }, ADMIN.role), 'evolucao-peso');
  const pesoGeometry = chartGeometry(peso, { width: 718, height: 260 });
  assert.ok(pesoGeometry.yAxis.ticks[0].value > 0, `peso: eixo Y sem partir de 0 (${pesoGeometry.yAxis.ticks[0].value}) — NEGATIVO: com base 0 as linhas ficariam achatadas`);
  const bars = chartGeometry(chartOf(buildReportCharts(matrixVm, PESAGENS, {}, ADMIN.role), 'gmd-por-grupo'), { width: 718, height: 260 });
  assert.ok(bars.zero && bars.bars.every((bar) => Math.abs(bar.x - bars.zero.x1) < 0.2), 'barras: base no zero');
  assert.ok(bars.bars.every((bar) => bar.h <= 24 && /Q/.test(bar.d)), 'barras ≤ 24 px com ponta arredondada');
  const ticks = niceTicks(0, 1.125, 5);
  assert.ok(ticks.min === 0 && ticks.max >= 1.125 && ticks.ticks.includes(0.5), 'marcas bonitas');
  assert.equal(dayNumber('2026-09') - dayNumber('2026-08'), 31, 'mês no dia 15 (tempo proporcional)');
  const spread = spreadLabels([{ want: 100 }, { want: 101 }, { want: 102 }], { top: 0, bottom: 200 });
  assert.ok(spread[1].y - spread[0].y >= 12 && spread[2].y - spread[1].y >= 12, 'rótulos diretos sem colidir (≥ 12 px) — NEGATIVO: no lugar pedido ficariam a 1 px');
  const empty = chartGeometry({ ...peso, vazio: true });
  assert.equal(empty.empty, true, 'gráfico vazio');
  results.push({ caso: 'null/config/geometria', nulls, avisos: warnings.length });
}

// Rebanho "GMD médio por lote" nas duas ordens do merge: presente → bate com a folha; ausente → aviso (acima).
{
  const rebanhoGmd = REBANHO_ATUAL.charts.find((chart) => chart.id === 'gmd-por-lote');
  if (rebanhoGmd) {
    const view = REBANHO_ATUAL.views.find((item) => (item.aggregates ?? []).some((spec) => spec.id === rebanhoGmd.valor.id));
    const rebVm = await runReport('rebanho.atual', { today: TODAY, selection: view ? { view: view.id } : {} }, ADMIN);
    const chart = chartOf(buildReportCharts(rebVm, REBANHO_ATUAL, { 'gmd-por-lote': { serie: 'lote' } }, ADMIN.role), 'gmd-por-lote');
    if (rebVm.totals[rebanhoGmd.valor.id]) assert.equal(chart.total.valor, rebVm.totals[rebanhoGmd.valor.id].value, 'Rebanho: GMD geral = GMD médio da folha');
    const nodes = groupRows(rebVm.rows, [{ columnId: 'lote_atual' }], rebVm.resolve, { aggregates: [rebanhoGmd.valor] }).nodes;
    for (const bar of chart.series[0].points) assert.equal(bar.y, nodes.find((node) => node.key === bar.xKey).aggregates[rebanhoGmd.valor.id].value, `Rebanho ${bar.xLabel} = motor da folha`);
    results.push({ caso: 'Rebanho GMD por lote', barras: chart.series[0].points.length });
  } else {
    results.push({ caso: 'Rebanho GMD por lote', fora: REBANHO_ATUAL.chartsSkipped.find((item) => item.id === 'gmd-por-lote').motivo });
  }
  // Simulação da ordem inversa do merge: um Rebanho com colunas de GMD (nomes de teste) e o "GMD médio" ponderado
  // nos totais — o MESMO REBANHO_CHARTS passa a trazer o gráfico, com os números do motor da folha.
  const GMD_TESTE = [
    defineColumn({ id: 'ganho_teste', label: 'Ganho desde a entrada', unit: 'kg', type: 'weight', grains: [GRAINS.ANIMAL_CURRENT], aggregations: ['countValid', 'sum', 'avg'] }),
    defineColumn({ id: 'dias_teste', label: 'Dias desde a entrada', type: 'integer', grains: [GRAINS.ANIMAL_CURRENT], aggregations: ['countValid', 'sum', 'avg'] }),
    defineColumn({ id: 'gmd_teste', label: 'GMD desde a entrada', unit: 'kg/dia', type: 'gmd', grains: [GRAINS.ANIMAL_CURRENT], weighted: { gain: 'ganho_teste', days: 'dias_teste' }, aggregations: ['countValid', 'avg', 'weightedGmd'] }),
  ];
  const simulated = defineReport({
    id: 'teste.rebanho-gmd', family: 'rebanho', grain: GRAINS.ANIMAL_CURRENT, version: 1, source: 'animals.current', requires: ['reports.read', 'animal.read'], title: 'Rebanho (teste)',
    columns: [...ANIMAL_CURRENT_COLUMNS, ...GMD_TESTE], defaultAggregates: [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'gmd_medio', columnId: 'gmd_teste', op: 'weightedGmd' }],
    charts: REBANHO_CHARTS,
  });
  assert.deepEqual(simulated.charts.map((chart) => chart.id), ['distribuicao-peso', 'gmd-por-lote'], 'com o GMD na folha, o gráfico entra (merge na outra ordem)');
  assert.deepEqual(simulated.chartsSkipped, [], 'e sem aviso');
  const simRows = [
    { id: 'x1', animal_id: 'x1', numero_animal: '1', lote_atual_id: 'LA', lote_atual_nome: 'Lote A', ultimo_peso_kg: 400, ganho_teste: 100, dias_teste: 100 },
    { id: 'x2', animal_id: 'x2', numero_animal: '2', lote_atual_id: 'LA', lote_atual_nome: 'Lote A', ultimo_peso_kg: 380, ganho_teste: 30, dias_teste: 60 },
    { id: 'x3', animal_id: 'x3', numero_animal: '3', lote_atual_id: 'LB', lote_atual_nome: 'Lote B', ultimo_peso_kg: 300, ganho_teste: null, dias_teste: null },
  ];
  const simVm = { reportId: simulated.id, rows: simRows, population: simRows, resolve: createColumnResolver(simulated.columns), groups: [], period: null, animalColumnId: 'animal' };
  const simChart = chartOf(buildReportCharts(simVm, simulated, {}, ADMIN.role), 'gmd-por-lote');
  close(pointOf(simChart.series[0], 'LA').y, 130 / 160, 'Lote A: (100 + 30) ÷ (100 + 60)');
  assert.deepEqual(simChart.semValor.itens.map((item) => item.label), ['Lote B'], 'Lote B sem GMD em texto');
  assert.equal(simChart.config.serie, 'lote', 'agrupado pelo lote atual');
}

assert.equal(getReportDefinition('pesagens').charts, PESAGENS.charts, 'catálogo entrega a definição com os gráficos');
await resetDb();
console.log(JSON.stringify({ gate: 'reports:charts:verify', ok: true, cases: results }, null, 2));
