// Gate reports:arroba-rotulos:verify (M1 1.5.0 — docs/plano-mestre/M1-FUNDACAO-NUMERO.md §5 e §6). As DUAS arrobas do
// produto continuam duas (sem unificar) e nunca se somam:
//   @ de PESO VIVO = peso ÷ divisor (30 ou 15, Configurações › Relatórios) — rótulo "(@ vivo ÷30)" / "(@ vivo ÷15)";
//   @ de CARCAÇA   = peso × rendimento ÷ 100 ÷ 15 (gravada no lançamento) — rótulo "(@ carcaça)".
// Massa de TESTE em IndexedDB em memória (fake-indexeddb): a de scripts/lib/reportFixtures (ago–set 2026) + uma venda com
// rendimento de 54 %, um abate com 52 % e uma venda SEM rendimento (com @ de carcaça legada gravada) — a @ viva e a de
// carcaça dão números DIFERENTES mesmo no ÷ 30. Nunca o banco real. Regras (cada uma com caso NEGATIVO — o código da
// 1.4.2 reprovaria):
//   a) nenhuma coluna/total/cabeçalho de arroba sem dizer qual: nas definições (colunas, totais, cabeçalhos dos tipos,
//      folha do MAKGESTAO, linhas de total, blocos de Vendas/Abates, gráficos) e em TODA saída de todo relatório com
//      arroba, em todos os tipos — tela (grade e métricas), folha, impressão/PDF, CSV, XLSX, JSON, "Colunas",
//      "Calcular"/"Adicionar coluna…" e gráficos; os rótulos da 1.4.2 ("Média (@)", "Peso em arrobas (@)", "Qtd @",
//      "Arrobas (@)", "Total @ carcaça") são reprovados pela mesma conferência;
//   b) o divisor em uso no rótulo da @ de peso vivo, com 30 e com 15 (nunca o outro, nunca sem divisor no view model);
//   c) o rótulo do total sai da COLUNA do total, nunca do id (modelo com o id trocado não vira "@ viva");
//   d) as duas na mesma folha: cada uma com o seu total (números à mão), separados na grade, folha, CSV, XLSX e JSON;
//   e) total misto RECUSADO: no serviço (runReport), no motor (computeAggregates/computeAggregate), na definição
//      (defineColumn/defineReport) e no menu do cabeçalho ("Calcular", "Subtotal/Total", "Adicionar coluna…");
//   f) rendimento: informado > padrão da empresa > padrão do parceiro; sem rendimento, vazio (nunca 50 %), e a @ de
//      carcaça legada sem rendimento não entra em conta.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { resolveSelection, runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { getReportDefinition, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { PESAGENS_SHEET_HEADERS, PESAGENS_SHEET_LINES } from '../src/modules/reporting/definitions/pesagens.js';
import { SHEET_LAYOUT_CONFIGS } from '../src/modules/reporting/domain/vendasLayout.js';
import { defineColumn } from '../src/modules/reporting/domain/columnDefinition.js';
import { createColumnResolver, defineReport } from '../src/modules/reporting/domain/reportDefinition.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { computeAggregate, computeAggregates } from '../src/modules/reporting/domain/reportAggregates.js';
import { ARROBA_MIXED_CODE, arrobaKindOf, definitionForDivisor } from '../src/modules/reporting/domain/arrobaColumns.js';
import { buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { buildReportCharts } from '../src/modules/reporting/domain/reportCharts.js';
import { applyHeaderAction, headerMenuOf } from '../src/modules/reporting/domain/headerActions.js';
import { typeColumnOptions } from '../src/modules/reporting/domain/typeColumns.js';
import { applyColumnKeys, listReportViews, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { summaryMetrics } from '../src/modules/reporting/domain/summaryLayout.js';
import { headerLabel } from '../src/modules/reporting/domain/reportFormatting.js';
import { buildReportLines } from '../src/modules/reporting/infrastructure/exporters/reportLayout.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { calculateCarcassTrade, resolveCarcassYield, YIELD_ORIGIN } from '../src/modules/weighing/domain/commercialCalculations.js';

const resumo = { gate: 'reports:arroba-rotulos:verify', ok: false, regras: [], relatorios: {}, rotulosConferidos: 0 };
const ok = (regra) => resumo.regras.push(regra);
const close = (actual, expected, message, tolerance = 1e-9) => assert.ok(actual !== null && actual !== undefined && Math.abs(actual - expected) <= tolerance, `${message}: esperado ${expected}, veio ${actual}`);
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const paramsOf = (definition) => (definition.params.some((param) => param.type === 'period') ? P : {});
const run = (id, selection, divisor, extra = {}) => runReport(id, { today: TODAY, params: paramsOf(getReportDefinition(id)), selection, arrobaDivisor: divisor, gmdDiasMinimos: 7, ...extra }, ADMIN);
const codeOf = async (fn) => { try { await fn(); return 'OK'; } catch (error) { return error.code ?? error.message; } };

// ---------------------------------------------------------------------------------------------------------------
// A conferência dos rótulos (a mesma para definições e saídas)
// ---------------------------------------------------------------------------------------------------------------
// Preço da @ é DINHEIRO (não é quantidade de arroba): "Valor @", "Preço/@", "Média valor da arroba". O rodapé "@ = peso
// vivo ÷ N" e a unidade depois de um número ("11,54 @", ao lado do rótulo que diz qual é) também não são nome de coluna.
const PRECO_DA_ARROBA = /Valor @|Preço\/@|Preço médio da @|Média Valor @|Média valor da arroba/gi;
const RODAPE = /@ = peso vivo ÷ \d+/g;
const NUMERO_EM_ARROBA = /(\d) @(?! vivo| carcaça)/g;
// O gráfico "@ produzidas por mês" (nome da medida, como no MAKGESTAO) diz qual arroba é na marca do fim do título.
const PRODUZIDAS = /@ produzidas por mês (?=\((?:@ vivo(?: ÷\d+)?|@ carcaça)\))/g;
/**
 * Problemas de um texto: "@" que não diz qual arroba é, "arroba(s)" solta, {@} sem resolver, @ viva sem o divisor (no
 * view model) ou com outro divisor que não o em uso.
 * @param {{ divisor?: number|null, estatico?: boolean }} options estatico = rótulo de definição (fora do view model):
 *   {@} é o lugar da marca e "(@ vivo)" sem divisor vale
 */
function problemasDeArroba(texto, { divisor = null, estatico = false } = {}) {
  const problemas = [];
  let text = String(texto ?? '');
  if (estatico) text = text.split('{@}').join('@ carcaça');
  else if (text.includes('{@}')) problemas.push('{@} sem resolver');
  const resto = text.replace(PRECO_DA_ARROBA, '').replace(RODAPE, '').replace(NUMERO_EM_ARROBA, '$1').replace(PRODUZIDAS, '');
  for (const match of resto.matchAll(/@/g)) {
    const depois = resto.slice(match.index + 1);
    const vivo = /^ vivo(?: ÷(\d+))?/.exec(depois);
    if (vivo) {
      if (!vivo[1] && !estatico) problemas.push('@ vivo sem o divisor');
      else if (vivo[1] && divisor !== null && Number(vivo[1]) !== divisor) problemas.push(`@ vivo ÷${vivo[1]} com o divisor ${divisor} em uso`);
      continue;
    }
    if (depois.startsWith(' carcaça')) continue;
    problemas.push('@ sem dizer qual arroba é');
  }
  if (/\barrobas?\b/i.test(resto)) problemas.push('"arroba" sem dizer qual');
  return problemas;
}
const confere = (texto, where, options) => {
  const problemas = problemasDeArroba(texto, options);
  assert.deepEqual(problemas, [], `${where}: "${texto}" — ${problemas.join('; ')}`);
  resumo.rotulosConferidos += 1;
};

// NEGATIVO: os rótulos da 1.4.2 são reprovados pela MESMA conferência; os novos passam (com 30 e com 15).
for (const antigo of ['Peso em arrobas (@)', 'Ganho em arrobas (@)', '@ carcaça estimada', 'Média (@)', 'Total (@)', 'Ganho médio (@)', 'Qtd @', 'Arrobas (@)', 'Total @ carcaça', 'Total @ Carcaça', 'Qtd @ Carcaça', 'Média @ carcaça', '@ produzidas por mês', '@', 'Peso médio (@)']) {
  assert.ok(problemasDeArroba(antigo, { divisor: 30 }).length > 0 || ['@ carcaça estimada', 'Total @ carcaça', 'Total @ Carcaça', 'Qtd @ Carcaça', 'Média @ carcaça'].includes(antigo), `NEGATIVO 1.4.2: "${antigo}" seria aceito`);
}
// A @ de carcaça da 1.4.2 já dizia "carcaça", mas sem o padrão único (marca entre parênteses): a conferência estrita do
// padrão novo também reprova esses — o nome tem de ser "(@ carcaça)".
const PADRAO = /\((@ vivo ÷(30|15)|@ carcaça)\)/;
for (const antigo of ['@ carcaça estimada', 'Total @ carcaça', 'Total @ Carcaça', 'Qtd @ Carcaça', 'Média @ carcaça']) assert.ok(!PADRAO.test(antigo), `NEGATIVO 1.4.2: "${antigo}" fora do padrão "(@ carcaça)"`);
for (const novo of ['Peso (@ vivo ÷30)', 'Média (@ vivo ÷30)', 'Carcaça estimada (@ carcaça)', 'Total (@ carcaça)', 'Valor @', 'Média valor da arroba', '@ = peso vivo ÷ 30', 'Média (@ vivo ÷30): 11,54 @']) {
  assert.deepEqual(problemasDeArroba(novo, { divisor: 30 }), [], `controle: "${novo}" é aceito`);
}
assert.deepEqual(problemasDeArroba('Média (@ vivo ÷30)', { divisor: 15 }), ['@ vivo ÷30 com o divisor 15 em uso'], 'NEGATIVO: o divisor errado é reprovado');
assert.deepEqual(problemasDeArroba('Média (@ vivo)', { divisor: 30 }), ['@ vivo sem o divisor'], 'NEGATIVO: @ viva sem divisor no view model é reprovada');
assert.ok(problemasDeArroba('Média ({@})', { divisor: 30 }).includes('{@} sem resolver'), 'NEGATIVO: {@} sem resolver é reprovado');
ok('a0-conferencia-reprova-os-rotulos-da-1.4.2');

// ---------------------------------------------------------------------------------------------------------------
// Massa
// ---------------------------------------------------------------------------------------------------------------
await seedReportFixture();
const bicho = (id, numero, extra = {}) => ({
  empresa_id: 'local', status_animal: 'Ativo', animal_id: id, numero_animal: numero, sexo: 'M', marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore',
  lote_id: 'L1', nome_lote: 'Lote 01', apartacao_id: 'ap1', nome_apartacao: 'Engorda', ...extra,
});
// A @ de carcaça como o Lançamento grava (calculateCarcassTrade: peso × rendimento ÷ 100 ÷ 15).
const carcaca = (peso, pct) => {
  const trade = calculateCarcassTrade({ weight: peso, yieldPercent: pct });
  return { rendimento_carcaca: pct, rendimento_origem: YIELD_ORIGIN.INFORMADO, peso_carcaca_estimado: trade.carcassWeightKg, quantidade_arrobas: trade.arrobas };
};
const a7 = bicho('A7', '707');
const a8 = bicho('A8', '808', { sexo: 'F', marca: 'BETA', marca_id: 'm-beta', lote_id: 'L2', nome_lote: 'Lote 02' });
const a9 = bicho('A9', '909', { lote_id: 'L2', nome_lote: 'Lote 02' });
for (const entry of [
  { ...a7, id: 'a7c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-02', peso: 400 },
  { ...a7, id: 'a7v', tipo_manejo: 'Saída', motivo_saida: 'Venda', data_pesagem: '2026-09-06', peso: 450, comprador: 'Frigo Sul', valor_arroba: 300, ...carcaca(450, 54) },
  { ...a8, id: 'a8c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-03', peso: 480 },
  { ...a8, id: 'a8a', tipo_manejo: 'Saída', motivo_saida: 'Abate', data_pesagem: '2026-09-08', peso: 500, frigorifico: 'Frigo Sul', valor_arroba_abate: 310, ...carcaca(500, 52) },
  { ...a9, id: 'a9c', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-04', peso: 290 },
  // Venda SEM rendimento, com uma @ de carcaça legada gravada (10 @): sem rendimento não há carcaça — não entra.
  { ...a9, id: 'a9v', tipo_manejo: 'Saída', motivo_saida: 'Venda', data_pesagem: '2026-09-09', peso: 300, comprador: 'Zeca Gado', valor_arroba: 280, quantidade_arrobas: 10 },
]) await weighingService.createEntry(entry);

// À mão — Saídas com peso no período: e6 venda 280 kg (50 % → 140 kg → 9,333 @), a7v venda 450 kg (54 % → 243 kg → 16,2 @),
// a8a abate 500 kg (52 % → 260 kg → 17,333 @), a9v venda 300 kg (sem rendimento → sem @ de carcaça); e8 morte sem peso.
const PESO_SAIDAS = 280 + 450 + 500 + 300;
const CARCACA = 140 / 15 + 243 / 15 + 260 / 15;
const VIVA = { 30: PESO_SAIDAS / 30, 15: PESO_SAIDAS / 15 };
assert.ok(Math.abs(VIVA[30] - CARCACA) > 1, 'controle da massa: a @ viva (÷ 30) e a de carcaça dão números diferentes');

// ---------------------------------------------------------------------------------------------------------------
// a) Definições: nenhuma coluna/total/cabeçalho de arroba sem dizer qual
// ---------------------------------------------------------------------------------------------------------------
const DEFINICOES = listAllReportDefinitions();
const colunasArroba = new Map();
for (const definition of DEFINICOES) {
  const where = definition.id;
  const byId = new Map(definition.columns.map((column) => [column.id, column]));
  for (const column of definition.columns) {
    const label = column.labelTemplate ?? column.label;
    if (arrobaKindOf(column)) {
      colunasArroba.set(column.id, column.arroba);
      assert.ok(label.includes('{@}'), `${where} › ${column.id}: coluna de arroba declara a marca ({@})`);
      assert.ok(!label.startsWith('@') && !column.label.startsWith('@'), `${where} › ${column.id}: rótulo não começa por "@" (o CSV poria apóstrofo)`);
    }
    if (column.type !== 'money') confere(label, `${where} › coluna ${column.id}`, { estatico: true });
  }
  const specs = [...(definition.defaultAggregates ?? []), ...(definition.views ?? []).flatMap((view) => view.aggregates ?? [])];
  for (const [id, label] of Object.entries(definition.metricLabels ?? {})) {
    const spec = specs.find((item) => (item.id ?? `${item.op}:${item.columnId ?? '*'}`) === id);
    if (byId.get(spec?.columnId)?.type !== 'money') confere(label, `${where} › total ${id}`, { estatico: true });
    if (arrobaKindOf(byId.get(spec?.columnId))) assert.ok(label.includes('{@}'), `${where} › total ${id}: rótulo de total de arroba com {@}`);
  }
  for (const view of definition.views ?? []) {
    for (const [id, label] of Object.entries(view.columnLabels ?? {})) {
      if (byId.get(id)?.type !== 'money') confere(label, `${where} › ${view.id} › cabeçalho ${id}`, { estatico: true });
    }
  }
  for (const chart of definition.charts ?? []) {
    for (const control of Object.values(chart.controls ?? {})) {
      for (const choice of control.choices) for (const text of [choice.label, choice.titulo].filter(Boolean)) confere(text, `${where} › gráfico ${chart.id} › ${choice.id}`, { estatico: true });
    }
  }
}
assert.deepEqual(Object.fromEntries([...colunasArroba].sort()), { ganho_arroba: 'vivo', peso_arroba: 'vivo', quantidade_arrobas: 'carcaca' }, 'as colunas de arroba declaram qual é (peso/ganho = @ de peso vivo; quantidade_arrobas = @ de carcaça)');
// Folha do MAKGESTAO, linhas de total e blocos de Vendas/Abates/Compras.
for (const [grupo, labels] of Object.entries(PESAGENS_SHEET_HEADERS)) for (const [key, label] of Object.entries(labels)) if (!['valor_arroba'].includes(key)) confere(label, `folha › ${grupo} › ${key}`, { estatico: true });
const linhas = Object.values(PESAGENS_SHEET_LINES).flatMap((value) => (Array.isArray(value) ? value : [...value.subtotal, ...value.total]));
for (const item of linhas) if (item.label) confere(item.label, `linha de total › ${item.key}`, { estatico: true });
for (const [layout, config] of Object.entries(SHEET_LAYOUT_CONFIGS)) {
  for (const [bloco, entries] of Object.entries(config.blocks)) for (const [id, label] of entries) if (label) confere(label, `${layout} › ${bloco} › ${id}`, { estatico: true });
}
ok('a1-definicoes-sem-arroba-anonima');

// ---------------------------------------------------------------------------------------------------------------
// a + b) Todas as saídas de todo relatório com arroba, em todos os tipos, com ÷ 30 e ÷ 15
// ---------------------------------------------------------------------------------------------------------------
const textoDoHtml = (html) => String(html ?? '').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const stringsDoXlsx = (content) => Object.entries(unzipStored(content)).filter(([name]) => name.startsWith('xl/worksheets/')).flatMap(([, xml]) => [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((match) => match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')));

// A marca que o rótulo de uma coluna/total de arroba TEM de ter (o rótulo que perde a marca — "Média", "Peso" — também
// é reprovado, não só o "@" sozinho).
const marcaDe = (column, divisor) => (column?.arroba === 'vivo' ? `(@ vivo ÷${divisor})` : column?.arroba === 'carcaca' ? '(@ carcaça)' : null);
const exigeMarca = (label, column, divisor, where) => {
  const marca = marcaDe(column, divisor);
  if (marca) assert.ok(String(label).includes(marca), `${where}: "${label}" sem a marca ${marca}`);
  return Boolean(marca);
};

/** Todo rótulo de toda saída de um view model (tela, folha, impressão/PDF, CSV, XLSX, JSON, menus e gráficos). */
async function rotulosDe(definition, vm, view) {
  const out = [];
  const add = (canal, texto) => { if (texto !== null && texto !== undefined && texto !== '') out.push([canal, String(texto)]); };
  const divisor = vm.arrobaDivisor;
  const where = `${definition.id} › ${vm.view?.id ?? 'personalizado'} ÷${divisor}`;
  const columnOf = (columnId) => vm.availableColumns.find((column) => column.id === columnId) ?? null;
  let marcas = 0;
  // Tela: grade (cabeçalhos com unidade), seletor/filtros (availableColumns), totais (metricLabels/summaryMetrics).
  for (const column of vm.columns) add('grade', headerLabel(column));
  for (const column of vm.availableColumns) add('colunas', column.label);
  for (const metric of summaryMetrics(vm)) add('totais', metric.label);
  for (const spec of vm.aggregates) add('metricLabels', vm.metricLabels[spec.id]);
  // Marca obrigatória: cada coluna/total de arroba diz qual é, em cada canal estruturado.
  for (const column of vm.columns) marcas += exigeMarca(headerLabel(column), column, divisor, `${where} grade ${column.id}`);
  for (const column of vm.availableColumns) marcas += exigeMarca(column.label, column, divisor, `${where} Colunas ${column.id}`);
  for (const metric of summaryMetrics(vm)) marcas += exigeMarca(metric.label, columnOf(metric.spec?.columnId), divisor, `${where} total ${metric.key}`);
  const lines = buildReportLines(vm, 'screen');
  for (const header of lines.headers) add('linhas', header);
  for (const line of lines.lines) add('linhas', line.metric);
  // Folha (estilo MAKGESTAO) e impressão/PDF.
  const doc = buildReportDocument(vm, { showDetails: true });
  for (const column of doc.columns) {
    add('folha', column.label);
    const source = column.kind === 'data' ? columnOf(column.column?.id ?? column.key) : column.kind === 'metric' ? columnOf(column.metric?.spec?.columnId) : null;
    marcas += exigeMarca(column.label, source, divisor, `${where} folha ${column.key}`);
  }
  for (const row of documentRows(doc)) for (const item of row.line?.items ?? []) add('folha-linha', item.label);
  if (doc.vendas) {
    const totalColumn = (id) => columnOf(SHEET_LAYOUT_CONFIGS[doc.vendas.layout].totals.find((total) => total.id === id)?.columnId);
    for (const row of doc.vendas.resumo.rows) marcas += exigeMarca(row.label, totalColumn(row.key), divisor, `${where} vendas ${row.key}`);
    for (const row of doc.vendas.resumo.rows) add('vendas', row.label);
    for (const bloco of [doc.vendas.porMarca, doc.vendas.porGrupo]) for (const column of bloco.columns) add('vendas', column.label);
    for (const item of doc.vendas.grupos.items) for (const total of item.totals) add('vendas', total.label);
    for (const column of doc.vendas.grupos.detailColumns ?? []) add('vendas', column.label);
    for (const total of doc.vendas.totalGeral.items) add('vendas', total.label);
  }
  for (const value of doc.matrix?.values ?? []) add('matriz', value.label);
  for (const metric of doc.matrix ? summaryMetrics(vm) : []) {
    const legenda = doc.matrix.legend;
    if (marcaDe(columnOf(metric.spec?.columnId), divisor)) marcas += exigeMarca(legenda, columnOf(metric.spec?.columnId), divisor, `${where} legenda da matriz`);
  }
  add('rodapé', doc.footer.arroba);
  const charts = (definition.charts ?? []).length ? { 'ganho-por-mes': { metrica: 'arroba' } } : null;
  const print = preparePrint(vm, ADMIN, { showDetails: true, ...(charts ? { chartsConfig: charts } : {}) });
  for (const texto of textoDoHtml(print.html).split('\n').map((text) => text.trim()).filter(Boolean)) add('pdf', texto);
  // CSV (cabeçalho e coluna "metrica"), XLSX (todos os textos das planilhas) e JSON (rótulos das colunas e do manifesto).
  const csv = parseCsv((await prepareEmission(vm, 'csv', ADMIN)).content);
  for (const header of csv[0]) add('csv', header.replace(/^'/, ''));
  if (vm.mode === 'DETALHADO') for (const column of vm.columns) marcas += exigeMarca(csv[0].find((header) => header === headerLabel(column)) ?? `(sem a coluna ${column.id} no CSV)`, column, divisor, `${where} CSV ${column.id}`);
  for (const row of csv.slice(1)) add('csv-metrica', row[3]);
  assert.ok(csv[0].every((header) => !header.startsWith("'@")), `${definition.id}: nenhum cabeçalho do CSV começa por "@" (apóstrofo)`);
  // (O manifesto da planilha é JSON de máquina — ids como "metrica":"arroba" não são rótulo.)
  for (const texto of stringsDoXlsx((await prepareEmission(vm, 'xlsx', ADMIN, charts ? { chartsConfig: charts } : {})).content)) if (!/^[[{]"?/.test(texto)) add('xlsx', texto);
  const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
  for (const column of [...json.columns, ...json.manifest.columns]) add('json', column.label);
  // Gráficos (título, opções, eixos, tabela, notas).
  if (charts) {
    for (const chart of buildReportCharts(vm, definition, charts, ADMIN.role)) {
      add('gráfico', chart.title);
      for (const control of chart.controls) for (const choice of control.choices) add('gráfico-opção', choice.label);
      add('gráfico-eixo', chart.eixos?.x?.titulo);
      add('gráfico-eixo', chart.eixos?.y?.titulo);
      for (const header of chart.tabela?.cabecalho ?? []) add('gráfico-tabela', header);
      for (const nota of chart.notas ?? []) add('gráfico-nota', nota);
    }
  }
  // Menus: "Colunas" do tipo e o cabeçalho interativo (Calcular, Subtotal/Total, Adicionar coluna…).
  if (view?.columnChoices) for (const option of typeColumnOptions(definition, view, ADMIN.role, { arrobaDivisor: vm.arrobaDivisor })) add('Colunas', option.label);
  const ctx = { definition, viewModel: vm, state: { view: vm.view?.id ?? null, columns: vm.columns.map((column) => column.id), aggregates: vm.aggregates, groups: vm.groups.map(({ columnId, direction }) => ({ columnId, ...(direction ? { direction } : {}) })), mode: vm.mode }, role: ADMIN.role };
  for (const column of doc.columns) {
    const menu = headerMenuOf(ctx, column, doc.layout);
    if (!menu) continue;
    add('menu', menu.label);
    for (const option of menu.add) add('Adicionar coluna…', option.label);
  }
  out.marcas = marcas;
  return out;
}

const RELATORIOS_COM_ARROBA = DEFINICOES.filter((definition) => definition.status !== 'blocked' && definition.columns.some((column) => arrobaKindOf(column)));
assert.deepEqual(RELATORIOS_COM_ARROBA.map((definition) => definition.id).sort(), ['comercial', 'controle.fechamento-dia', 'controle.pesagens-conferir', 'embarques.romaneio', 'pesagens', 'pesagens.pendencias', 'saidas'], 'os relatórios que têm coluna de arroba (M1: + Pesagens para conferir, que usa as colunas de pesagem)');
const ARROBA_COLUMNS = ['peso_arroba', 'ganho_arroba', 'quantidade_arrobas'];
for (const definition of RELATORIOS_COM_ARROBA) {
  const report = { tipos: 0, rotulos: 0, marcas: 0 };
  const selecoes = [];
  for (const view of listReportViews(definition)) {
    selecoes.push([view.id, viewSelection(view, definition), view]);
    // Tipo com "Colunas": também com TODAS as opções (Total (@), Ganho médio (@)…).
    if (view.columnChoices) selecoes.push([`${view.id}+todas`, { ...viewSelection(view, definition), ...applyColumnKeys(view, definition, view.columnChoices.available) }, view]);
  }
  // Personalizado (sem tipo): Detalhado com as colunas de arroba e os totais de cada uma; Resumido com os totais.
  const arrobaIds = ARROBA_COLUMNS.filter((id) => definition.columns.some((column) => column.id === id));
  const totaisArroba = arrobaIds.flatMap((columnId) => ['sum', 'avg', 'min', 'max'].map((op) => ({ op, columnId })));
  const groupable = definition.columns.find((column) => column.groupable)?.id;
  selecoes.push(['personalizado-detalhado', { view: null, mode: 'DETALHADO', groups: [], columns: ['numero_animal', 'peso', ...arrobaIds].filter((id) => definition.columns.some((column) => column.id === id)), aggregates: totaisArroba }, null]);
  selecoes.push(['personalizado-resumido', { view: null, mode: 'RESUMIDO', groups: [{ columnId: groupable }], aggregates: totaisArroba }, null]);
  for (const [nome, selection, view] of selecoes) {
    for (const divisor of [30, 15]) {
      const vm = await run(definition.id, selection, divisor);
      assert.equal(vm.arrobaDivisor, divisor, `${definition.id} › ${nome}: divisor ${divisor} no view model`);
      const rotulos = await rotulosDe(definition, vm, view);
      for (const [canal, texto] of rotulos) confere(texto, `${definition.id} › ${nome} ÷${divisor} › ${canal}`, { divisor });
      const outro = divisor === 30 ? '÷15' : '÷30';
      assert.ok(!rotulos.some(([, texto]) => texto.includes(`@ vivo ${outro}`)), `${definition.id} › ${nome} ÷${divisor}: nenhum rótulo com o outro divisor (${outro})`);
      if (vm.availableColumns.some((column) => column.arroba === 'vivo')) {
        assert.equal(vm.availableColumns.find((column) => column.id === 'peso_arroba').label.replace(/^Qtd /, 'Peso '), `Peso (@ vivo ÷${divisor})`, `${definition.id} › ${nome}: o divisor em uso no rótulo da @ de peso vivo (÷ ${divisor})`);
      }
      report.rotulos += rotulos.length;
      report.marcas += rotulos.marcas;
    }
    report.tipos += 1;
  }
  resumo.relatorios[definition.id] = report;
}
ok('a2-toda-saida-de-todo-relatorio-diz-qual-arroba');
ok('b-divisor-no-rotulo-com-30-e-com-15');

// Exemplos que a responsável vê (os nomes exatos).
{
  const PESAGENS = getReportDefinition('pesagens');
  const apLote = await run('pesagens', viewSelection('por-apartacao-lote', PESAGENS), 30);
  assert.ok(buildReportDocument(apLote).columns.some((column) => column.label === 'Média (@ vivo ÷30)'), 'folha MAKGESTAO: "Média (@ vivo ÷30)" (era "Média (@)")');
  const apLote15 = await run('pesagens', viewSelection('por-apartacao-lote', PESAGENS), 15);
  assert.ok(buildReportDocument(apLote15).columns.some((column) => column.label === 'Média (@ vivo ÷15)'), 'folha MAKGESTAO ÷ 15: "Média (@ vivo ÷15)"');
  const vendas15 = await run('pesagens', viewSelection('vendas', PESAGENS), 15);
  assert.equal(vendas15.columns.find((column) => column.id === 'peso_arroba').label, 'Qtd (@ vivo ÷15)', 'Vendas ÷ 15: "Qtd (@ vivo ÷15)" (era "Qtd @")');
  const abates = await run('comercial', viewSelection('abates', getReportDefinition('comercial')), 15);
  assert.equal(abates.columns.find((column) => column.id === 'quantidade_arrobas').label, 'Qtd (@ carcaça)', 'Abates: "Qtd (@ carcaça)" — a @ de carcaça não tem o divisor de Configurações');
  const graficos = buildReportCharts(apLote, PESAGENS, { 'ganho-por-mes': { metrica: 'arroba' } }, ADMIN.role).find((chart) => chart.id === 'ganho-por-mes');
  assert.deepEqual([graficos.title, graficos.eixos.y.titulo, graficos.controls.find((control) => control.id === 'metrica').choices.map((choice) => choice.label)], ['@ produzidas por mês (@ vivo ÷30)', '@ vivo ÷30', ['kg', '@ vivo ÷30']], 'gráfico "@ produzidas": é @ de peso vivo e diz isso (título, eixo, opção) — a fórmula não muda');
  const naoDefinido = definitionForDivisor(PESAGENS, null).columns.find((column) => column.id === 'peso_arroba').label;
  assert.equal(naoDefinido, 'Peso (@ vivo)', 'fora do view model: "(@ vivo)" sem divisor — nunca um divisor que talvez não seja o em uso');
}
ok('b2-exemplos-dos-nomes');

// ---------------------------------------------------------------------------------------------------------------
// c) O rótulo do total sai da COLUNA do total, nunca do id
// ---------------------------------------------------------------------------------------------------------------
{
  // Modelo antigo com o id "total_arroba" (o da @ viva na folha) apontando para a @ de carcaça.
  const trocado = await run('pesagens', { view: null, mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: [{ id: 'total_arroba', columnId: 'quantidade_arrobas', op: 'sum' }] }, 30);
  assert.equal(trocado.metricLabels.total_arroba, 'Total (@ carcaça)', 'o rótulo do id "total_arroba" sai da coluna do total: @ de carcaça');
  assert.equal(summaryMetrics(trocado)[0].label, 'Total (@ carcaça)', 'grade/folha/CSV: "Total (@ carcaça)"');
  // NEGATIVO: pelo id (como até a 1.4.2), seria o nome da @ viva sobre um número de carcaça.
  assert.equal(definitionForDivisor(getReportDefinition('pesagens'), 30).metricLabels.total_arroba, 'Total (@ vivo ÷30)', 'NEGATIVO: o rótulo do id na definição é o da @ viva');
}
ok('c-rotulo-pela-coluna-do-total');

// ---------------------------------------------------------------------------------------------------------------
// d) As duas arrobas na mesma folha: cada uma com o seu total (Saídas, Detalhado, totais ligados pelo cabeçalho)
// ---------------------------------------------------------------------------------------------------------------
const SAIDAS = getReportDefinition('saidas');
const COLUNAS_SAIDAS = ['data_pesagem', 'numero_animal', 'motivo_saida', 'peso', 'peso_arroba', 'quantidade_arrobas'];
const totaisSeparados = {};
for (const divisor of [30, 15]) {
  const base = { view: null, mode: 'DETALHADO', groups: [], columns: COLUNAS_SAIDAS, aggregates: [] };
  const vm0 = await run('saidas', base, divisor);
  const doc0 = buildReportDocument(vm0);
  // "Subtotal/Total desta coluna" nas duas colunas de arroba, pelo menu do cabeçalho (o mesmo código da tela).
  let state = { view: null, columns: COLUNAS_SAIDAS, aggregates: [], groups: [], mode: 'DETALHADO' };
  for (const key of ['peso_arroba', 'quantidade_arrobas']) {
    const column = doc0.columns.find((item) => item.key === key);
    const menu = headerMenuOf({ definition: SAIDAS, viewModel: vm0, state, role: ADMIN.role }, column, doc0.layout);
    assert.ok(menu.total && !menu.total.active, `÷${divisor}: "Total desta coluna" oferecido em ${key}`);
    state = { ...state, ...applyHeaderAction({ definition: SAIDAS, viewModel: vm0, state, role: ADMIN.role }, column, { type: 'total', layout: doc0.layout }).patch };
  }
  assert.deepEqual(state.aggregates.map((spec) => spec.id), ['sum:peso_arroba', 'sum:quantidade_arrobas'], `÷${divisor}: um total para cada arroba`);
  const vm = await run('saidas', { ...base, aggregates: state.aggregates }, divisor);
  close(vm.totals['sum:peso_arroba'].value, VIVA[divisor], `÷${divisor}: total da @ de peso vivo = 1.530 kg ÷ ${divisor}`);
  close(vm.totals['sum:quantidade_arrobas'].value, CARCACA, `÷${divisor}: total da @ de carcaça = (140 + 243 + 260) ÷ 15 (a venda sem rendimento fica fora)`);
  assert.equal(vm.totals['sum:quantidade_arrobas'].n_validos, 3, 'a @ de carcaça: 3 saídas com rendimento (a legada sem rendimento não conta)');
  // NEGATIVO: a soma das duas num total só (o que a proibição impede) daria outro número.
  assert.ok(Math.abs(VIVA[divisor] + CARCACA - vm.totals['sum:peso_arroba'].value) > 1 && Math.abs(VIVA[divisor] + CARCACA - vm.totals['sum:quantidade_arrobas'].value) > 1, 'NEGATIVO: o total misto não é nenhum dos dois');
  const nomes = summaryMetrics(vm).map((metric) => metric.label);
  assert.deepEqual(nomes, [`Peso total (@ vivo ÷${divisor})`, 'Carcaça total (@ carcaça)'], `÷${divisor}: cada total com o nome da sua arroba`);
  // Folha: dois itens na linha de TOTAL GERAL, cada um com o seu número.
  const doc = buildReportDocument(vm);
  const geral = documentRows(doc).find((row) => row.type === 'GRAND_TOTAL').line.items;
  const item = (prefixo) => geral.find((entry) => String(entry.label).startsWith(prefixo));
  assert.equal(item('Peso Total (@ vivo').label, `Peso Total (@ vivo ÷${divisor})`, 'folha: total da @ viva');
  assert.equal(item('Carcaça Total').label, 'Carcaça Total (@ carcaça)', 'folha: total da @ de carcaça');
  assert.equal(item('Peso Total (@ vivo').raw, vm.totals['sum:peso_arroba'].value, 'folha: o número da @ viva é o do motor');
  assert.equal(item('Carcaça Total').raw, vm.totals['sum:quantidade_arrobas'].value, 'folha: o número da @ de carcaça é o do motor');
  // CSV: duas linhas de total geral, uma por arroba, com rótulos diferentes.
  const csv = parseCsv((await prepareEmission(vm, 'csv', ADMIN)).content);
  const geralCsv = csv.filter((row) => row[0] === 'GRAND_TOTAL').map((row) => [row[3], row[4]]);
  assert.deepEqual(geralCsv.map(([nome]) => nome), [`Soma — Peso (@ vivo ÷${divisor})`, 'Soma — Carcaça estimada (@ carcaça)'], 'CSV: um total por arroba, cada um com o seu nome');
  assert.deepEqual(geralCsv.map(([, valor]) => valor), [VIVA[divisor].toFixed(2).replace('.', ','), CARCACA.toFixed(2).replace('.', ',')], 'CSV: os números à mão');
  // XLSX e JSON: os mesmos dois totais.
  const xlsxTextos = stringsDoXlsx((await prepareEmission(vm, 'xlsx', ADMIN)).content);
  assert.ok(xlsxTextos.includes(`Soma — Peso (@ vivo ÷${divisor})`) && xlsxTextos.includes('Soma — Carcaça estimada (@ carcaça)'), 'XLSX: os dois totais, separados');
  const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
  close(json.totals['sum:peso_arroba'].value, VIVA[divisor], 'JSON: total da @ viva');
  close(json.totals['sum:quantidade_arrobas'].value, CARCACA, 'JSON: total da @ de carcaça');
  totaisSeparados[divisor] = { viva: Number(VIVA[divisor].toFixed(3)), carcaca: Number(CARCACA.toFixed(3)) };
}
ok('d-cada-arroba-com-o-seu-total');

// ---------------------------------------------------------------------------------------------------------------
// e) Total misto RECUSADO — serviço, motor, definição e menu
// ---------------------------------------------------------------------------------------------------------------
const MISTO = [{ id: 'arrobas', columnId: 'peso_arroba', op: 'sum' }, { id: 'arrobas', columnId: 'quantidade_arrobas', op: 'sum' }];
const baseSaidas = { view: null, mode: 'DETALHADO', groups: [], columns: COLUNAS_SAIDAS };
// Serviço: o modelo com o mesmo total nas duas arrobas não abre (ARROBA_MISTA), no Detalhado e no Resumido.
assert.equal(await codeOf(() => run('saidas', { ...baseSaidas, aggregates: MISTO }, 30)), ARROBA_MIXED_CODE, 'serviço: total misto recusado (Detalhado)');
assert.equal(await codeOf(() => run('saidas', { view: null, mode: 'RESUMIDO', groups: [{ columnId: 'motivo_saida' }], aggregates: MISTO }, 15)), ARROBA_MIXED_CODE, 'serviço: total misto recusado (Resumido, ÷ 15)');
assert.equal(await codeOf(() => run('saidas', { ...baseSaidas, aggregates: [MISTO[0], { ...MISTO[1], id: 'arrobas_carcaca' }] }, 30)), 'OK', 'controle: as duas com ids próprios abrem');
// Serviço: a seleção é recusada na validação, antes de ler o banco (resolveSelection — modelo, último estado, tela).
assert.throws(() => resolveSelection(SAIDAS, { ...baseSaidas, aggregates: MISTO }, ADMIN.role), (error) => error.code === ARROBA_MIXED_CODE, 'serviço: resolveSelection recusa o total misto');
assert.doesNotThrow(() => resolveSelection(SAIDAS, { ...baseSaidas, aggregates: [MISTO[0], { ...MISTO[1], id: 'arrobas_carcaca' }] }, ADMIN.role), 'controle: resolveSelection aceita as duas separadas');
// NEGATIVO (motor da 1.4.2, sem a proibição): um total só, "arrobas", com o número da @ de carcaça — a @ viva sumia sem aviso.
const vmS = await run('saidas', { ...baseSaidas, aggregates: [] }, 30);
const antigo = {};
for (const spec of MISTO) antigo[spec.id] = computeAggregate(vmS.rows, spec, vmS.resolve);
assert.deepEqual(Object.keys(antigo), ['arrobas'], 'NEGATIVO 1.4.2: as duas viravam UM total');
close(antigo.arrobas.value, CARCACA, 'NEGATIVO 1.4.2: o total "arrobas" ficava com o número da @ de carcaça');
// Motor: a lista mista é recusada também fora do serviço (groupRows/computeAggregates).
assert.throws(() => computeAggregates(vmS.rows, MISTO, vmS.resolve), (error) => error.code === ARROBA_MIXED_CODE, 'motor: computeAggregates recusa o total misto');
// Motor: média ponderada de uma arroba pela outra (declarada numa coluna) é recusada; pelo peso em kg, não.
const G = [GRAINS.EVENT];
const viva = defineColumn({ id: 'viva_x', label: 'Peso ({@})', arroba: 'vivo', unit: '@', type: 'number', grains: G, weightedBy: 'carcaca_x', aggregations: ['sum', 'weightedAvg'] });
const vivaPeloKg = defineColumn({ id: 'viva_kg', label: 'Peso ({@})', arroba: 'vivo', unit: '@', type: 'number', grains: G, weightedBy: 'kg_x', aggregations: ['weightedAvg'] });
const carcacaX = defineColumn({ id: 'carcaca_x', label: 'Carcaça ({@})', arroba: 'carcaca', type: 'number', grains: G, aggregations: ['sum'] });
const kg = defineColumn({ id: 'kg_x', label: 'Peso', unit: 'kg', type: 'weight', grains: G });
const resolveX = createColumnResolver([viva, vivaPeloKg, carcacaX, kg]);
const linhasX = [{ viva_x: 10, viva_kg: 10, carcaca_x: 9, kg_x: 300 }, { viva_x: 20, viva_kg: 20, carcaca_x: 19, kg_x: 600 }];
assert.throws(() => computeAggregate(linhasX, { op: 'weightedAvg', columnId: 'viva_x' }, resolveX), (error) => error.code === ARROBA_MIXED_CODE, 'motor: média da @ viva ponderada pela @ de carcaça recusada');
close(computeAggregate(linhasX, { op: 'weightedAvg', columnId: 'viva_kg' }, resolveX).value, (10 * 300 + 20 * 600) / 900, 'controle: @ viva ponderada pelo kg é conta válida');
// Definição: coluna de arroba sem dizer qual / quantidade em "@" sem o tipo / peso por função (o motor não confere).
assert.throws(() => defineColumn({ id: 'x', label: 'Arrobas', type: 'number', grains: G }), /sem dizer qual/, 'NEGATIVO: coluna "Arrobas" sem o tipo');
assert.throws(() => defineColumn({ id: 'x', label: 'Peso em arrobas', unit: '@', type: 'number', grains: G }), /sem dizer qual/, 'NEGATIVO: "Peso em arrobas" (1.4.2) sem o tipo');
assert.throws(() => defineColumn({ id: 'x', label: 'Qtd @', arroba: 'vivo', type: 'number', grains: G }), /use \{@\}/, 'NEGATIVO: coluna de arroba sem a marca no rótulo');
assert.throws(() => defineColumn({ id: 'x', label: 'Qtd ({@})', arroba: 'gado', type: 'number', grains: G }), /arroba inválida/, 'NEGATIVO: tipo de arroba desconhecido');
assert.throws(() => defineColumn({ id: 'x', label: 'Peso ({@})', type: 'number', grains: G }), /só em coluna de arroba/, 'NEGATIVO: {@} em coluna que não é de arroba');
assert.throws(() => defineColumn({ id: 'x', label: 'Qtd ({@})', arroba: 'vivo', type: 'number', grains: G, weightedBy: () => 1, aggregations: ['weightedAvg'] }), /outra coluna/, 'NEGATIVO: peso de arroba por função');
assert.equal(defineColumn({ id: 'x', label: 'Valor @', type: 'money', grains: G }).label, 'Valor @', 'controle: preço da @ é dinheiro e não precisa do tipo');
// Definição de relatório: mesmo id nas duas arrobas, par "de–até" misto, rótulos sem/com {@} no lugar errado.
const minimo = { id: 't', title: 'T', family: 'pesagens', grain: GRAINS.EVENT, version: 1, source: 'events.byPeriod', requires: ['reports.read'], columns: EVENT_COLUMNS, params: [{ id: 'periodo', type: 'period', required: true }] };
const visao = (aggregates, extra = {}) => ({ id: 'v', label: 'V', mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates, ...extra });
assert.ok(defineReport({ ...minimo, views: [visao([{ id: 'a', columnId: 'peso_arroba', op: 'sum' }, { id: 'b', columnId: 'quantidade_arrobas', op: 'sum' }])], metricLabels: { a: 'Total ({@})', b: 'Total ({@})' } }), 'controle: as duas com ids e rótulos próprios');
assert.throws(() => defineReport({ ...minimo, defaultAggregates: [{ id: 'arrobas', columnId: 'peso_arroba', op: 'sum' }], views: [visao([{ id: 'arrobas', columnId: 'quantidade_arrobas', op: 'sum' }])] }), /não se somam/, 'NEGATIVO: o mesmo total (id) na @ viva e na de carcaça');
assert.throws(() => defineReport({ ...minimo, views: [visao([{ id: 'a', columnId: 'peso_arroba', op: 'min' }, { id: 'b', columnId: 'quantidade_arrobas', op: 'max' }])], metricPairs: [{ id: 'p', label: 'P', from: 'a', to: 'b' }] }), /arrobas diferentes/, 'NEGATIVO: par "de–até" juntando as duas');
assert.throws(() => defineReport({ ...minimo, views: [visao([{ id: 'a', columnId: 'peso_arroba', op: 'avg' }])], metricLabels: { a: 'Média (@)' } }), /não diz qual arroba/, 'NEGATIVO: "Média (@)" (1.4.2) num total de arroba');
assert.throws(() => defineReport({ ...minimo, views: [visao([{ id: 'a', columnId: 'peso', op: 'avg' }])], metricLabels: { a: 'Média ({@})' } }), /não é de arroba/, 'NEGATIVO: {@} num total em kg');
assert.throws(() => defineReport({ ...minimo, views: [visao([{ id: 'a', columnId: 'peso', op: 'avg' }], { columnLabels: { peso_arroba: 'Qtd @' } })] }), /não diz qual arroba/, 'NEGATIVO: cabeçalho "Qtd @" (1.4.2) do tipo');
// Menu do cabeçalho: com um total gravado no id de outra arroba (modelo antigo), "Total desta coluna" da @ viva não é
// oferecido nem aplicado (juntaria as duas no mesmo total); "Calcular" fica desligado.
{
  const gravado = [{ id: 'sum:peso_arroba', columnId: 'quantidade_arrobas', op: 'sum' }];
  const vm = await run('saidas', { ...baseSaidas, aggregates: gravado }, 30);
  const doc = buildReportDocument(vm);
  const ctx = { definition: SAIDAS, viewModel: vm, state: { view: null, columns: COLUNAS_SAIDAS, aggregates: gravado, groups: [], mode: 'DETALHADO' }, role: ADMIN.role };
  const colunaViva = doc.columns.find((column) => column.key === 'peso_arroba');
  const menu = headerMenuOf(ctx, colunaViva, doc.layout);
  assert.equal(menu.total, null, 'menu: "Total desta coluna" da @ viva não é oferecido (juntaria com a @ de carcaça no mesmo total)');
  assert.equal(menu.calc.options.find((option) => option.id === 'sum').disabled, true, 'menu: "Calcular › Soma" desligado');
  assert.equal(applyHeaderAction(ctx, colunaViva, { type: 'total', layout: doc.layout }), null, 'menu: aplicado, não muda nada');
  assert.equal(applyHeaderAction(ctx, colunaViva, { type: 'calc', choice: 'sum', layout: doc.layout }), null, 'menu: "Calcular › Soma" não muda nada');
  // NEGATIVO: a seleção que o menu da 1.4.2 produziria (os dois com o mesmo id) é a que o serviço recusa.
  assert.equal(await codeOf(() => run('saidas', { ...baseSaidas, aggregates: [...gravado, { id: 'sum:peso_arroba', columnId: 'peso_arroba', op: 'sum' }] }, 30)), ARROBA_MIXED_CODE, 'NEGATIVO: o patch sem a proibição seria um total misto');
  // Controle: na folha normal, o menu oferece o total de cada arroba e "Adicionar coluna…" nomeia as duas.
  const normal = await run('pesagens', { view: null, mode: 'DETALHADO', groups: [], columns: ['numero_animal', 'peso'], aggregates: [] }, 15);
  const docNormal = buildReportDocument(normal);
  const adicionar = headerMenuOf({ definition: getReportDefinition('pesagens'), viewModel: normal, state: { view: null, columns: ['numero_animal', 'peso'], aggregates: [], groups: [], mode: 'DETALHADO' }, role: ADMIN.role }, docNormal.columns[0], docNormal.layout).add.map((option) => option.label);
  for (const nome of ['Peso (@ vivo ÷15)', 'Ganho (@ vivo ÷15)', 'Carcaça estimada (@ carcaça)']) assert.ok(adicionar.includes(nome), `"Adicionar coluna…" oferece "${nome}"`);
  const resumido = await run('pesagens', { view: null, mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: [{ id: 'cab', columnId: 'numero_animal', op: 'countDistinct' }] }, 30);
  const docResumido = buildReportDocument(resumido);
  const adicionarResumido = headerMenuOf({ definition: getReportDefinition('pesagens'), viewModel: resumido, state: { view: null, aggregates: resumido.aggregates, groups: [{ columnId: 'nome_lote' }], mode: 'RESUMIDO' }, role: ADMIN.role }, docResumido.columns[0], docResumido.layout).add.map((option) => option.label);
  for (const nome of ['Média (@ vivo ÷30)', 'Total (@ vivo ÷30)', 'Carcaça total (@ carcaça)']) assert.ok(adicionarResumido.includes(nome), `"Adicionar coluna…" (Resumido) oferece "${nome}"`);
}
ok('e-total-misto-recusado');

// ---------------------------------------------------------------------------------------------------------------
// f) Rendimento: informado > padrão da empresa > padrão do parceiro; sem rendimento, vazio (nunca 50 %)
// ---------------------------------------------------------------------------------------------------------------
assert.deepEqual(resolveCarcassYield({ informed: 54, companyDefault: 52, partnerDefault: 50 }), { yieldPercent: 54, origin: YIELD_ORIGIN.INFORMADO }, 'rendimento informado primeiro');
assert.deepEqual(resolveCarcassYield({ companyDefault: 52, partnerDefault: 50 }), { yieldPercent: 52, origin: YIELD_ORIGIN.PADRAO_EMPRESA }, 'depois o padrão da empresa');
assert.deepEqual(resolveCarcassYield({ partnerDefault: 50 }), { yieldPercent: 50, origin: YIELD_ORIGIN.PADRAO_PARCEIRO }, 'depois o do parceiro');
assert.deepEqual(resolveCarcassYield({}), { yieldPercent: null, origin: null }, 'sem nenhum: vazio (não inventa 50 %)');
assert.equal(calculateCarcassTrade({ weight: 300, yieldPercent: null }).arrobas, null, 'sem rendimento: sem @ de carcaça');
{
  const vm = await run('saidas', { ...baseSaidas, aggregates: [] }, 30);
  const linha = (id) => vm.rows.find((row) => row.id === id);
  assert.equal(vm.resolve('quantidade_arrobas').valueOf(linha('a9v')), null, 'relatório: a venda sem rendimento fica sem @ de carcaça (a legada de 10 @ gravada sem rendimento não entra)');
  assert.notEqual(vm.resolve('quantidade_arrobas').valueOf(linha('a9v')), 300 * 0.5 / 15, 'NEGATIVO: nunca os 50 % inventados (300 × 50 % ÷ 15 = 10 @)');
  close(vm.resolve('quantidade_arrobas').valueOf(linha('a7v')), 243 / 15, 'relatório: venda com 54 % → 450 × 54 % ÷ 15');
  close(vm.resolve('peso_arroba').valueOf(linha('a9v')), 10, 'a @ de peso vivo da mesma venda continua (300 ÷ 30) — são duas arrobas');
}
ok('f-rendimento-sem-50-inventado');

await resetDb();
resumo.ok = true;
resumo.totaisSeparados = totaisSeparados;
console.log(JSON.stringify(resumo, null, 2));
