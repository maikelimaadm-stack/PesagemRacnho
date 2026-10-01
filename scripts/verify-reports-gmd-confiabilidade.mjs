// Gate reports:gmd-confiabilidade:verify (M1 1.5.0 — docs/plano-mestre/M1-FUNDACAO-NUMERO.md §1.2, §2 "Entrega na
// interface" e §6). Massa de TESTE em IndexedDB em memória (fake-indexeddb): a de scripts/lib/reportFixtures (ago–set
// 2026) + dois animais, conferível à mão; nunca o banco real. Regras (cada uma com caso NEGATIVO — a regra da 1.4.2
// reprovaria):
//   a) linhas: gmd_qualidade/gmd_motivo DERIVADOS na leitura (classifyGmd) — Pesagens pelos dias do intervalo gravado,
//      Desempenho pelos dias do período do animal, Rebanho pelos dias da última pesagem / desde a entrada; o mínimo
//      vem de Configurações › Relatórios (padrão 21; request.gmdDiasMinimos nos testes; inválido é recusado);
//   b) contas: weightedGmd, média simples, mínimo, máximo, contagem, subtotal, total e o motor só com CONFIAVEL;
//   c) a troca do mínimo 21 → 28 (Configurações) muda o resultado; 7 traz o número da 1.4.2;
//   d) Matriz e "Calcular" do cabeçalho interativo só com CONFIAVEL;
//   e) linhas de texto do resumo e rodapé "GMD de N de M cab." contando só CONFIAVEL;
//   f) gráficos (GMD por grupo, evolução no modo GMD, faixas de GMD) só com CONFIAVEL;
//   g) paridade tela / impressão-PDF / CSV / XLSX: o MESMO número, o cinza (classe/estilo), o aviso ("Aviso do GMD")
//      e o rodapé;
//   h) coluna opcional "GMD (regressão)": fora do padrão de todo tipo, em "Adicionar coluna…" do Desempenho e do
//      Rebanho atual, lida só quando em uso (uma consulta pelo índice de data, nunca por animal), com qualidade.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { getReportDefinition, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { SHEET_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { computeAggregate } from '../src/modules/reporting/domain/reportAggregates.js';
import { annotateGmdQuality } from '../src/modules/reporting/domain/gmdColumns.js';
import { buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { buildMatrix } from '../src/modules/reporting/domain/matrixLayout.js';
import { applyHeaderAction, headerMenuOf } from '../src/modules/reporting/domain/headerActions.js';
import { buildReportCharts } from '../src/modules/reporting/domain/reportCharts.js';
import { viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { computeWeightedGmd } from '../src/modules/weighing/domain/weightRegression.js';
import { GMD_QUALIDADE } from '../src/modules/weighing/domain/gmdQuality.js';
import { updateAppConfig } from '../src/modules/settings/application/appConfigService.js';

const { CONFIAVEL, NAO_CONFIAVEL, SEM_GMD } = GMD_QUALIDADE;
const regras = [];
const ok = (name) => regras.push(name);
const close = (actual, expected, message, tolerance = 1e-9) => assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) <= tolerance, `${message}: esperado ${expected}, veio ${actual}`);
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const run = (id, selection = {}, extra = {}) => runReport(id, { today: TODAY, params: id === 'rebanho.atual' ? {} : P, arrobaDivisor: 30, selection, ...extra }, ADMIN);
const PESAGENS = getReportDefinition('pesagens');
const DESEMPENHO = getReportDefinition('desempenho');
const REBANHO = getReportDefinition('rebanho.atual');

// ---------------------------------------------------------------------------------------------------------------
// Massa: a dos gates (A1 300 → 330 em 20 d → 345 em 20 d; A2 250 → 260 em 10 d → venda 280 em 21 d; A3 morte sem
// peso; A4 só o Cadastro) + A5 (Cadastro 01/07 300 → Manejo 15/08 345: 45 dias, GMD 1,000) e A6 (Cadastro 01/09 280 →
// Manejo 11/09 290: 10 dias, GMD 1,000 — conferência logo depois da entrada).
// ---------------------------------------------------------------------------------------------------------------
const { db } = await seedReportFixture();
const extra = (id, numero, loteId, sexo = 'M') => ({
  empresa_id: 'local', status_animal: 'Ativo', animal_id: id, numero_animal: numero, sexo, marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore',
  ...(loteId === 'L1' ? { lote_id: 'L1', nome_lote: 'Lote 01' } : { lote_id: 'L2', nome_lote: 'Lote 02' }), apartacao_id: 'ap1', nome_apartacao: 'Engorda',
});
for (const entry of [
  { ...extra('A5', '505', 'L2'), id: 'a5c', tipo_manejo: 'Cadastro', data_pesagem: '2026-07-01', peso: 300 },
  { ...extra('A5', '505', 'L2'), id: 'a5m', tipo_manejo: 'Manejo', data_pesagem: '2026-08-15', peso: 345 },
  { ...extra('A6', '606', 'L1'), id: 'a6c', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 280 },
  { ...extra('A6', '606', 'L1'), id: 'a6m', tipo_manejo: 'Manejo', data_pesagem: '2026-09-11', peso: 290 },
]) await weighingService.createEntry(entry);

// À mão (período 01/08 a 15/09), intervalos gravados: e2 20 d +30 (1,500) · e3 20 d +15 (0,750) · e5 10 d +10 (1,000) ·
// e6 21 d +20 (0,952) · a5m 45 d +45 (1,000) · a6m 10 d +10 (1,000).
const HAND = {
  21: { confiaveis: ['e6', 'a5m'], gmd: 65 / 66 },
  7: { confiaveis: ['e2', 'e3', 'e5', 'e6', 'a5m', 'a6m'], gmd: 130 / 126 },
  28: { confiaveis: ['a5m'], gmd: 1 },
  14: { confiaveis: ['e2', 'e3', 'e6', 'a5m'], gmd: 110 / 106 },
};
const ANALITICO = viewSelection('analitico', PESAGENS);

// ---------------------------------------------------------------------------------------------------------------
// a) Linhas com a qualidade derivada
// ---------------------------------------------------------------------------------------------------------------
const vm21 = await run('pesagens', ANALITICO);
assert.equal(vm21.gmdDiasMinimos, 21, 'sem configuração: o mínimo padrão 21 (Configurações › Relatórios)');
const byId = Object.fromEntries(vm21.rows.map((row) => [row.id, row]));
assert.deepEqual(['e2', 'e3', 'e5', 'e6', 'a5m', 'a6m', 'e1', 'e8'].map((id) => [id, byId[id].gmd_qualidade, byId[id].gmd_motivo]), [
  ['e2', NAO_CONFIAVEL, 'intervalo curto (20 dias)'], ['e3', NAO_CONFIAVEL, 'intervalo curto (20 dias)'], ['e5', NAO_CONFIAVEL, 'intervalo curto (10 dias)'],
  ['e6', CONFIAVEL, null], ['a5m', CONFIAVEL, null], ['a6m', NAO_CONFIAVEL, 'intervalo curto (10 dias)'],
  ['e1', SEM_GMD, 'sem pesagem anterior'], ['e8', SEM_GMD, 'sem pesagem anterior'],
], 'Pesagens: qualidade pelos dias do intervalo gravado');
close(byId.e2.gmd, 1.5, 'o FATO gravado não muda (o GMD do intervalo curto continua 1,500)');
await assert.rejects(() => run('pesagens', ANALITICO, { gmdDiasMinimos: 10 }), /intervalo mínimo do GMD deve ser 7, 14, 21, 28/, 'NEGATIVO: mínimo fora das opções é recusado');
assert.equal(JSON.parse(vm21.sourceKey).at(-1), 21, 'o mínimo entra no sourceKey (o reaproveitamento nunca serve linhas de outro mínimo)');
const reused28 = await run('pesagens', ANALITICO, { gmdDiasMinimos: 28, reuse: vm21 });
assert.ok(!reused28.stats.strategy.includes('+reuse'), 'NEGATIVO: outro mínimo não reaproveita as linhas classificadas com o anterior');
assert.equal(reused28.rows.find((row) => row.id === 'e6').gmd_qualidade, NAO_CONFIAVEL, 'mínimo 28: a venda de 21 dias passa a NAO_CONFIAVEL');
// Desempenho: pelos dias do período do animal (A6 10 dias); Rebanho: pela última pesagem e desde a entrada.
const des21 = await run('desempenho', viewSelection('analitico', DESEMPENHO));
const des = Object.fromEntries(des21.rows.map((row) => [row.animal_id, row]));
assert.deepEqual(['A1', 'A2', 'A5', 'A6', 'A3'].map((id) => [id, des[id].dias, des[id].gmd_qualidade]), [['A1', 40, CONFIAVEL], ['A2', 31, CONFIAVEL], ['A5', 45, CONFIAVEL], ['A6', 10, NAO_CONFIAVEL], ['A3', null, SEM_GMD]], 'Desempenho: pelos dias do período');
const reb21 = await run('rebanho.atual', viewSelection('analitico', REBANHO));
const reb = Object.fromEntries(reb21.rows.map((row) => [row.animal_id, row]));
assert.deepEqual(['A1', 'A5', 'A6'].map((id) => [id, reb[id].ultimo_gmd_qualidade, reb[id].gmd_entrada_qualidade]), [['A1', NAO_CONFIAVEL, CONFIAVEL], ['A5', CONFIAVEL, CONFIAVEL], ['A6', NAO_CONFIAVEL, NAO_CONFIAVEL]], 'Rebanho: Último GMD pelos dias da última pesagem; desde a entrada pelos dias desde a entrada');
assert.equal(reb.A1.ultimo_gmd_motivo, 'intervalo curto (20 dias)', 'Rebanho: o motivo do Último GMD');
ok('a-linhas-com-qualidade');

// ---------------------------------------------------------------------------------------------------------------
// b) Contas só com o CONFIAVEL (total, subtotal, média simples, mínimo, máximo, contagem, motor)
// ---------------------------------------------------------------------------------------------------------------
const totalsSel = { ...ANALITICO, aggregates: [...ANALITICO.aggregates, { op: 'avg', columnId: 'gmd' }, { op: 'min', columnId: 'gmd' }, { op: 'max', columnId: 'gmd' }, { op: 'countValid', columnId: 'gmd' }] };
const contas = await run('pesagens', totalsSel);
close(contas.totals.gmd_medio.value, HAND[21].gmd, 'total geral ponderado = (20 + 45) ÷ (21 + 45)');
// Média simples, mínimo e máximo leem o GMD GRAVADO de cada pesagem (3 casas: e6 = 0,952).
close(contas.totals['avg:gmd'].value, (0.952 + 1) / 2, 'média simples só dos confiáveis');
close(contas.totals['min:gmd'].value, 0.952, 'mínimo dos confiáveis (o 0,750 de 20 dias fica fora)');
close(contas.totals['max:gmd'].value, 1, 'máximo dos confiáveis (o 1,500 de 20 dias fica fora)');
assert.deepEqual([contas.totals['countValid:gmd'].value, contas.totals.gmd_medio.n_validos, contas.totals.gmd_medio.n_total], [2, 2, 12], 'contagem: 2 GMD confiáveis em 12 pesagens (o intervalo curto conta como ausente)');
// NEGATIVO: a conta da 1.4.2 (todo GMD com par válido) dava outro número.
const antigo = vm21.rows.filter((row) => Number(row.dias) > 0 && typeof row.ganho === 'number');
const antigoGmd = antigo.reduce((sum, row) => sum + row.ganho, 0) / antigo.reduce((sum, row) => sum + row.dias, 0);
close(antigoGmd, HAND[7].gmd, 'à mão: a regra antiga = (30 + 15 + 10 + 20 + 45 + 10) ÷ (20 + 20 + 10 + 21 + 45 + 10)');
assert.ok(Math.abs(antigoGmd - contas.totals.gmd_medio.value) > 1e-3, 'NEGATIVO: o intervalo curto não puxa mais o GMD médio');
// Subtotal por lote: Lote 01 só tem intervalos curtos → sem GMD ("-"), nunca 0; Lote 02 = e6 + a5m.
const porLote = await run('pesagens', { ...ANALITICO, groups: [{ columnId: 'nome_lote' }] });
const lote = Object.fromEntries(porLote.tree.map((node) => [node.label, node]));
assert.equal(lote['Lote 01'].aggregates.gmd_medio.value, null, 'subtotal Lote 01: só intervalos curtos → sem GMD (nunca 0)');
close(lote['Lote 02'].aggregates.gmd_medio.value, 65 / 66, 'subtotal Lote 02');
// Motor puro (o que a folha, a matriz e o gráfico chamam): linhas classificadas pela fonte.
const rows = [{ id: 1, gmd: 2, ganho: 20, dias: 10 }, { id: 2, gmd: 1, ganho: 30, dias: 30 }];
const resolve = createColumnResolver(EVENT_COLUMNS);
annotateGmdQuality(rows, EVENT_COLUMNS, 21);
close(computeAggregate(rows, { columnId: 'gmd', op: 'weightedGmd' }, resolve).value, 1, 'weightedGmd: só o de 30 dias');
annotateGmdQuality(rows, EVENT_COLUMNS, 7);
close(computeAggregate(rows, { columnId: 'gmd', op: 'weightedGmd' }, resolve).value, 50 / 40, 'mínimo 7: os dois');
ok('b-contas-so-confiavel');

// ---------------------------------------------------------------------------------------------------------------
// c) Troca do mínimo em Configurações › Relatórios (21 → 28 → 7 → 21)
// ---------------------------------------------------------------------------------------------------------------
for (const minimo of [28, 7, 14, 21]) {
  await updateAppConfig(ADMIN, { gmd_dias_minimos: minimo });
  const vm = await run('pesagens', ANALITICO);
  assert.equal(vm.gmdDiasMinimos, minimo, `Configurações: mínimo ${minimo}`);
  assert.deepEqual(vm.rows.filter((row) => row.gmd_qualidade === CONFIAVEL).map((row) => row.id).sort(), [...HAND[minimo].confiaveis].sort(), `mínimo ${minimo}: os confiáveis`);
  close(vm.totals.gmd_medio.value, HAND[minimo].gmd, `mínimo ${minimo}: GMD médio`);
}
const config21 = await run('pesagens', ANALITICO);
close(config21.totals.gmd_medio.value, HAND[21].gmd, 'voltar para 21: o número volta (o intervalo de 21 dias volta ao normal)');
assert.equal(config21.rows.find((row) => row.id === 'e6').gmd_qualidade, CONFIAVEL, 'e6 (21 dias) confiável de novo');
ok('c-troca-do-minimo');

// ---------------------------------------------------------------------------------------------------------------
// d) Matriz e "Calcular" do cabeçalho interativo
// ---------------------------------------------------------------------------------------------------------------
const matrixVm = await run('pesagens', { view: 'sintetico-matriz', matrix: { eixoY: 'lote', eixoX: 'mes' } });
const matrix = buildMatrix(matrixVm);
const cell = (rowKey, monthKey) => {
  const row = matrix.rows.find((item) => item.key === rowKey);
  return row.cells[matrix.columns.findIndex((column) => column.key === monthKey)]?.aggregates.gmd_medio.value ?? null;
};
assert.deepEqual([cell('L1', '2026-08'), cell('L1', '2026-09')], [null, null], 'Matriz: Lote 01 só com intervalos curtos → sem GMD');
close(cell('L2', '2026-08'), 1, 'Matriz: Lote 02 × ago = só a5m (o e5 de 10 dias fica fora)');
close(cell('L2', '2026-09'), 20 / 21, 'Matriz: Lote 02 × set = e6');
close(matrix.totalRow.total.aggregates.gmd_medio.value, HAND[21].gmd, 'Matriz: canto = total da folha');
const analDoc = buildReportDocument(vm21);
const gmdColumn = analDoc.columns.find((column) => column.key === 'gmd');
const ctx = { definition: PESAGENS, state: { view: 'analitico', mode: 'DETALHADO', columns: vm21.columns.map((column) => column.id), aggregates: vm21.aggregates.map((spec) => ({ ...spec })), groups: [] }, viewModel: vm21, role: 'ADMIN' };
const menu = headerMenuOf(ctx, gmdColumn, 'detail');
assert.deepEqual(menu.calc.options.map((option) => [option.id, option.op]), [['avg', 'weightedGmd'], ['min', 'min'], ['max', 'max'], ['count', 'countValid']], '"Calcular" do GMD: média (ponderada), mínimo, máximo, contagem');
for (const [choice, id, expected] of [['min', 'min:gmd', 0.952], ['max', 'max:gmd', 1], ['count', 'countValid:gmd', 2]]) {
  const patch = applyHeaderAction(ctx, gmdColumn, { type: 'calc', choice, layout: 'detail' }).patch;
  const calculated = await run('pesagens', { ...ANALITICO, aggregates: patch.aggregates });
  close(calculated.totals[id].value, expected, `"Calcular" ${choice}: só os confiáveis`);
}
ok('d-matriz-e-calcular');

// ---------------------------------------------------------------------------------------------------------------
// e) Linhas de texto do resumo e rodapé "GMD de N de M cab."
// ---------------------------------------------------------------------------------------------------------------
const resumo = buildReportDocument(await run('pesagens', viewSelection('por-apartacao-data', PESAGENS)));
const grand = documentRows(resumo).find((row) => row.type === 'GRAND_TOTAL');
const gmdItem = grand.line.items.find((item) => item.key === 'gmd_medio');
close(gmdItem.raw, HAND[21].gmd, 'TOTAL GERAL do Resumo por Data: GMD Médio só com o confiável');
assert.equal(gmdItem.text, `${(65 / 66).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia`, 'texto da linha');
assert.equal(analDoc.footer.gmd, 'GMD de 2 de 6 cab.', 'rodapé: só A2 e A5 têm GMD confiável');
const footer7 = buildReportDocument(await run('pesagens', ANALITICO, { gmdDiasMinimos: 7 })).footer;
assert.equal(footer7.gmd, 'GMD de 4 de 6 cab.', 'mínimo 7: A1, A2, A5 e A6');
const comNumero = new Set(vm21.rows.filter((row) => typeof row.gmd === 'number').map((row) => row.animal_id));
assert.equal(comNumero.size, 4, 'NEGATIVO: a contagem antiga (qualquer GMD com número) diria 4 de 6');
assert.equal(analDoc.footer.gmdCinza, 'GMD em cinza = intervalo menor que 21 dias: não entra na média', 'rodapé explica o cinza');
assert.equal(footer7.gmdCinza, null, 'sem GMD em cinza, sem a nota');
ok('e-resumo-e-rodape');

// ---------------------------------------------------------------------------------------------------------------
// f) Gráficos de GMD só com o confiável
// ---------------------------------------------------------------------------------------------------------------
const sheetVm = await run('pesagens', { view: 'por-apartacao-lote', aggregates: [...SHEET_TOTALS] });
const porGrupo = buildReportCharts(sheetVm, PESAGENS, { 'gmd-por-grupo': { serie: 'lote' } }, 'ADMIN').find((chart) => chart.id === 'gmd-por-grupo');
assert.deepEqual(porGrupo.series[0].points.map((point) => point.xKey), ['L2'], 'GMD por grupo: só o Lote 02 tem barra (o Lote 01 só tem intervalos curtos)');
close(porGrupo.series[0].points[0].y, 65 / 66, 'barra do Lote 02 = subtotal da folha');
assert.match(porGrupo.semValor.texto, /Lote 01 \(3 cab\.\)/, 'Lote 01 em "Sem GMD" (nunca barra 0)');
assert.equal(porGrupo.cobertura.texto, 'GMD de 2 de 6 cab.', 'cobertura do gráfico = rodapé da folha');
const evolucao = buildReportCharts(sheetVm, PESAGENS, { 'evolucao-peso': { serie: 'todos', eixo: 'mes', metrica: 'gmd' } }, 'ADMIN').find((chart) => chart.id === 'evolucao-peso');
const mes = Object.fromEntries(evolucao.series[0].points.map((point) => [point.xKey, point.y]));
close(mes['2026-08'], 1, 'evolução do GMD: ago = só a5m');
close(mes['2026-09'], 20 / 21, 'evolução do GMD: set = só e6');
const desCharts = buildReportCharts(des21, DESEMPENHO, {}, 'ADMIN');
const faixas = desCharts.find((chart) => chart.id === 'faixas-gmd');
assert.equal(faixas.series[0].points.reduce((sum, point) => sum + point.y, 0), 3, 'faixas de GMD: A1, A2 e A5 (o A6 de 10 dias fica fora)');
assert.equal(faixas.semValor.texto, 'Sem GMD: 3 cab.', 'A3, A4 e A6 em "Sem GMD"');
const faixas7 = buildReportCharts(await run('desempenho', viewSelection('analitico', DESEMPENHO), { gmdDiasMinimos: 7 }), DESEMPENHO, {}, 'ADMIN').find((chart) => chart.id === 'faixas-gmd');
assert.equal(faixas7.series[0].points.reduce((sum, point) => sum + point.y, 0), 4, 'NEGATIVO: com o mínimo 7 o A6 entra (como na 1.4.2)');
const desPorGrupo = desCharts.find((chart) => chart.id === 'gmd-por-grupo');
close(desPorGrupo.series[0].points.find((point) => point.xKey === 'L1').y, 45 / 40, 'Desempenho Lote 01: só o A1 (o A6 de 10 dias fica fora)');
ok('f-graficos');

// ---------------------------------------------------------------------------------------------------------------
// g) Paridade tela / impressão-PDF / CSV / XLSX
// ---------------------------------------------------------------------------------------------------------------
const GRAY_IDS = ['e2', 'e3', 'e5', 'a6m'];
const grayCells = documentRows(analDoc).filter((row) => row.type === 'DATA').map((row) => row.cells.find((item) => item.key === 'gmd')).filter((item) => item.gmd?.cinza);
assert.deepEqual(grayCells.map((item) => item.text).sort(), ['0,750', '1,000', '1,000', '1,500'], 'folha: o MESMO número dos 4 intervalos curtos, em cinza');
assert.ok(grayCells.every((item) => item.tone === undefined && /^intervalo curto \(\d+ dias\)$/.test(item.gmd.aviso)), 'cinza no lugar do verde/vermelho, com o aviso');
const screenHtml = renderSheetBody(analDoc);
const pdf = preparePrint(vm21, ADMIN, {});
for (const [where, html] of [['tela', screenHtml], ['impressão/PDF', pdf.html]]) {
  const tds = [...html.matchAll(/<td[^>]*class="[^"]*mk-gmd-cinza[^"]*"[^>]*>([^<]*)<\/td>/g)];
  assert.equal(tds.length, GRAY_IDS.length, `${where}: 4 células de GMD em cinza`);
  assert.ok(tds.every((match) => /title="GMD não entra na média: intervalo curto \(\d+ dias\)" data-gmd="NAO_CONFIAVEL"/.test(match[0])), `${where}: title com o motivo e data-gmd`);
  assert.ok(html.includes('<span>GMD de 2 de 6 cab.</span>') && html.includes('<span>GMD em cinza = intervalo menor que 21 dias: não entra na média</span>'), `${where}: rodapé`);
}
assert.match(pdf.html, /td\.mk-gmd-cinza \{ color: var\(--mk-gray-500\); \}/, 'PDF: o cinza do tema da folha');
// CSV: o mesmo número e o aviso na coluna logo após o GMD.
const csv = parseCsv((await prepareEmission(vm21, 'csv', ADMIN)).content);
const header = csv[0];
const gi = header.indexOf('GMD (kg/dia)');
assert.equal(header[gi + 1], 'Aviso do GMD', 'CSV: "Aviso do GMD" logo após o GMD');
const csvRow = (animal, data) => csv.find((row) => row.includes(animal) && row.includes(data));
assert.deepEqual([csvRow('101', '21/08/2026')[gi], csvRow('101', '21/08/2026')[gi + 1]], ['1,500', 'intervalo curto (20 dias)'], 'CSV: e2 com o número e o aviso');
assert.deepEqual([csvRow('202', '05/09/2026')[gi], csvRow('202', '05/09/2026')[gi + 1]], ['0,952', ''], 'CSV: e6 confiável, sem aviso');
assert.deepEqual([csvRow('101', '01/08/2026')[gi], csvRow('101', '01/08/2026')[gi + 1]], ['', ''], 'CSV: Cadastro sem GMD (vazio, nunca 0)');
const csv7 = parseCsv((await prepareEmission(await run('pesagens', ANALITICO, { gmdDiasMinimos: 7 }), 'csv', ADMIN)).content);
assert.ok(!csv7[0].includes('Aviso do GMD'), 'NEGATIVO: sem intervalo curto, as colunas de sempre');
// XLSX: o mesmo número (como número), em cinza (estilo 12), o aviso ao lado e o rodapé no fim da planilha.
const sheet = unzipStored((await prepareEmission(vm21, 'xlsx', ADMIN)).content)['xl/worksheets/sheet1.xml'];
const xlsxRows = [...sheet.matchAll(/<row r="\d+">([\s\S]*?)<\/row>/g)].map(([, body]) => [...body.matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"( t="inlineStr")?(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, , style, inline, inner]) => ({
  style: Number(style), value: inner === undefined ? null : inline ? inner.replace(/^<is><t xml:space="preserve">|<\/t><\/is>$/g, '') : Number(inner.replace(/<\/?v>/g, '')),
})));
const xHeader = xlsxRows.find((row) => row.some((item) => item.value === 'GMD (kg/dia)')).map((item) => item.value);
const xi = xHeader.indexOf('GMD (kg/dia)');
assert.equal(xHeader[xi + 1], 'Aviso do GMD', 'XLSX: "Aviso do GMD" logo após o GMD');
const xRow = (animal, data) => xlsxRows.find((row) => row.some((item) => item.value === animal) && row.some((item) => item.value === data));
assert.deepEqual([xRow('101', '21/08/2026')[xi].value, xRow('101', '21/08/2026')[xi].style, xRow('101', '21/08/2026')[xi + 1].value], [1.5, 12, 'intervalo curto (20 dias)'], 'XLSX: e2 = 1,5 (número) em cinza, com o aviso');
assert.deepEqual([xRow('202', '05/09/2026')[xi].value, xRow('202', '05/09/2026')[xi].style], [0.952, 7], 'XLSX: e6 no estilo normal de 3 casas');
assert.match(sheet, /<c r="[A-Z]+\d+" s="10" t="inlineStr"><is><t xml:space="preserve">GMD de 2 de 6 cab\.<\/t><\/is><\/c>/, 'XLSX: rodapé "GMD de N de M cab."');
assert.ok(sheet.includes('GMD em cinza = intervalo menor que 21 dias: não entra na média'), 'XLSX: o que o cinza quer dizer');
assert.match(unzipStored((await prepareEmission(vm21, 'xlsx', ADMIN)).content)['xl/styles.xml'], /<xf numFmtId="165" fontId="3"[^>]*\/>\n<\/cellXfs>/, 'XLSX: estilo 12 = 3 casas com a fonte cinza');
ok('g-paridade');

// ---------------------------------------------------------------------------------------------------------------
// h) Coluna opcional "GMD (regressão)"
// ---------------------------------------------------------------------------------------------------------------
for (const definition of listAllReportDefinitions()) {
  const usesRegression = (list) => (list ?? []).some((item) => (typeof item === 'string' ? item : item?.columnId) === 'gmd_regressao' || item === 'avg:gmd_regressao');
  assert.ok(!usesRegression(definition.defaultColumns) && !usesRegression(definition.defaultAggregates), `${definition.id}: regressão fora do padrão do relatório`);
  for (const view of definition.views ?? []) {
    assert.ok(!usesRegression(view.columns) && !usesRegression(view.aggregates) && !usesRegression(view.columnChoices?.defaults), `${definition.id} › ${view.id}: regressão fora do padrão do tipo`);
  }
}
for (const definition of [DESEMPENHO, REBANHO]) {
  assert.ok(definition.columns.some((column) => column.id === 'gmd_regressao' && column.type === 'gmd' && column.gmdQuality), `${definition.id}: coluna "GMD (regressão)" com qualidade`);
  const vm = definition === DESEMPENHO ? des21 : reb21;
  const doc = buildReportDocument(vm);
  const state = { view: 'analitico', mode: 'DETALHADO', columns: vm.columns.map((column) => column.id), aggregates: vm.aggregates.map((spec) => ({ ...spec })), groups: [] };
  const add = headerMenuOf({ definition, state, viewModel: vm, role: 'ADMIN' }, doc.columns.find((column) => column.kind === 'data'), 'detail').add;
  assert.ok(add.some((option) => option.key === 'gmd_regressao' && option.label === 'GMD (regressão) (kg/dia)'), `${definition.id}: "Adicionar coluna…" oferece o GMD (regressão)`);
  const resumoVm = await run(definition.id, viewSelection('por-lote', definition));
  const resumoDoc = buildReportDocument(resumoVm);
  const resumoState = { view: 'por-lote', mode: 'RESUMIDO', aggregates: resumoVm.aggregates.map((spec) => ({ ...spec })), groups: resumoVm.groups.map((group) => ({ columnId: group.columnId })) };
  const addResumo = headerMenuOf({ definition, state: resumoState, viewModel: resumoVm, role: 'ADMIN' }, resumoDoc.columns.find((column) => column.kind === 'metric'), 'summary').add;
  assert.ok(addResumo.some((option) => option.key === 'avg:gmd_regressao' && option.label === 'GMD (regressão) médio (kg/dia)'), `${definition.id}: no Resumido, "GMD (regressão) médio"`);
  assert.equal(vm.stats.regressao, null, `${definition.id}: sem a coluna, a janela de 120 dias não é lida`);
  assert.ok(vm.rows.every((row) => row.gmd_regressao === undefined), `${definition.id}: sem a coluna, nenhuma regressão nas linhas`);
}
// Em uso: uma leitura pelo índice de data (janela de 120 dias até o fim do período / hoje), nunca uma por animal.
const comRegressao = await run('desempenho', { ...viewSelection('analitico', DESEMPENHO), columns: [...viewSelection('analitico', DESEMPENHO).columns, 'gmd_regressao'] }, { reuse: des21 });
assert.ok(comRegressao.stats.strategy.includes('+reuse'), 'acrescentar a coluna reaproveita as linhas (lê só a janela)');
const janela = await db.table('pesagens').where('data_pesagem').between('2026-05-18', '2026-09-15', true, true).count();
assert.deepEqual(comRegressao.stats.regressao, { hoje: '2026-09-15', rowsRead: janela }, 'Desempenho: hoje = fim do período; lidas só as pesagens da janela (05/18 a 15/09)');
const regDes = Object.fromEntries(comRegressao.rows.map((row) => [row.animal_id, row]));
const expectedA1 = computeWeightedGmd([{ data: '2026-08-01', peso: 300 }, { data: '2026-08-21', peso: 330 }, { data: '2026-09-10', peso: 345 }], { hoje: '2026-09-15', diasMinimos: 21 });
assert.deepEqual([regDes.A1.gmd_regressao, regDes.A1.gmd_regressao_n, regDes.A1.gmd_regressao_dias, regDes.A1.gmd_regressao_qualidade], [expectedA1.gmd, 3, 40, CONFIAVEL], 'A1: computeWeightedGmd das 3 pesagens (interface congelada)');
assert.ok(regDes.A1.gmd_regressao >= 0.75 && regDes.A1.gmd_regressao <= 1.5, 'A1: entre o menor e o maior GMD dos intervalos (aceite 3)');
assert.deepEqual([regDes.A5.gmd_regressao, regDes.A5.gmd_regressao_qualidade], [1, CONFIAVEL], 'A5: 2 pesagens em 45 dias = a conta simples');
assert.deepEqual([regDes.A6.gmd_regressao, regDes.A6.gmd_regressao_qualidade], [null, SEM_GMD], 'A6: 10 dias cobertos (< 14) → sem regressão');
const again = await run('desempenho', { ...viewSelection('analitico', DESEMPENHO), columns: [...viewSelection('analitico', DESEMPENHO).columns, 'gmd_regressao'] }, { reuse: comRegressao });
assert.equal(again.stats.regressao, comRegressao.stats.regressao, 'reaproveitada: não lê a janela de novo');
close(again.totals['avg:gmd_regressao']?.value ?? computeAggregate(again.rows, { columnId: 'gmd_regressao', op: 'avg' }, again.resolve).value, (expectedA1.gmd + 1 + regDes.A2.gmd_regressao) / 3, 'média do GMD (regressão): só os confiáveis');
// Rebanho atual: hoje = hoje; o mesmo número da Ficha do Animal (janela até hoje).
const rebReg = await run('rebanho.atual', { ...viewSelection('analitico', REBANHO), columns: [...viewSelection('analitico', REBANHO).columns, 'gmd_regressao'] });
assert.equal(rebReg.stats.regressao.hoje, TODAY, 'Rebanho: hoje');
assert.equal(rebReg.rows.find((row) => row.animal_id === 'A1').gmd_regressao, expectedA1.gmd, 'Rebanho: A1 = o mesmo do Desempenho até 15/09');
// Qualidade da regressão: 14 a 20 dias cobertos = cinza (NAO_CONFIAVEL), como qualquer GMD.
const curto = computeWeightedGmd([{ data: '2026-09-01', peso: 280 }, { data: '2026-09-16', peso: 295 }], { hoje: '2026-09-16', diasMinimos: 21 });
assert.deepEqual([curto.diasCobertos, curto.qualidade], [15, NAO_CONFIAVEL], '15 dias cobertos: regressão NAO_CONFIAVEL');
// NEGATIVO: nenhuma consulta de pesagens por animal num laço (a leitura é a da janela, pelo índice).
const animalSource = fs.readFileSync(new URL('../src/modules/reporting/infrastructure/reportSources/animalSource.js', import.meta.url), 'utf8');
assert.ok(!/for \(const (row|animal)[^\n]*\) \{[^}]*await (db\.table\('pesagens'\)|loadEventRows)/.test(animalSource), 'NEGATIVO: nenhuma consulta por animal');
ok('h-regressao-opcional');

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:gmd-confiabilidade:verify', ok: true, regras,
  gmdMedio: { 7: Number(HAND[7].gmd.toFixed(6)), 14: Number(HAND[14].gmd.toFixed(6)), 21: Number(HAND[21].gmd.toFixed(6)), 28: HAND[28].gmd },
  rodape: analDoc.footer.gmd, regressaoA1: expectedA1.gmd, janelaLida: janela,
}, null, 2));
