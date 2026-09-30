// Gate reports:cabecalho-interativo:verify (E1F 1.4.1, itens 2 e 3) — cabeçalho interativo da folha e "Mais
// filtros…" (docs/plano-mestre/E1F-COLUNAS-CABECALHO-NOVO-RELATORIO.md). Confere as funções PURAS que a tela usa
// (domain/headerActions.js, application/reportScreenModel.moreFilterColumnsOf) rodando o motor de verdade:
//   1. Resumido de tipo (Pesagens › Por Apartação (Resumo por Data)): menu de rótulo e métrica; Ordenar vira a
//      opção fixa equivalente (ou Personalizado); Calcular troca a conta (só as que a coluna aceita; a que já está
//      na folha fica desligada) e o número é o do motor; Ocultar/Adicionar pelas chaves do tipo (escolha gravável);
//   2. Detalhado (Analítico): Ordenar, Calcular/Subtotal-Total entram na linha de total com o número do motor;
//      Agrupar pelos botões do tipo (fica no tipo) ou por outra coluna (sai do tipo), até 3 níveis; Ocultar/Adicionar;
//   3. Vendas (relatório de venda): agrupar sai do tipo LEVANDO a população (cadeado); sem Calcular/Total;
//   4. Matriz: valor do eixo X sem menu; rótulo e TOTAL ordenam as linhas;
//   5. Personalizado genérico (outro relatório): Adicionar/Ocultar/Calcular nos totais do relatório;
//   6. permissão: nada do que o perfil não vê é oferecido (CONSULTA × valores comerciais);
//   7. larguras: limites, fórmula do arraste, folha (tela, impressão e PDF) com a largura escolhida no Resumido,
//      no Detalhado e na matriz; modelo/último estado guardam as chaves da folha;
//   8. marcação: tela com data-col-key/data-col-kind, botão do menu e puxador; impressão SEM nada disso (igual
//      à de antes); negativos;
//   9. "Mais filtros…": só as filtráveis sem botão próprio, e o filtro por uma delas vale no motor.
import assert from 'node:assert/strict';
import { ADMIN, CONSULTA, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { buildInitialReportState, typedViewSelection } from '../src/modules/reporting/application/reportInitialState.js';
import { filterButtonsOf, moreFilterColumnsOf, PREVIOUS_COLUMN } from '../src/modules/reporting/application/reportScreenModel.js';
import { normalizeTemplateConfig } from '../src/modules/reporting/application/reportTemplateService.js';
import { getReportDefinition, listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { applyHeaderAction, clampWidth, headerMenuOf, HEADER_WIDTH, isEmptyHeaderMenu, resizedWidth } from '../src/modules/reporting/domain/headerActions.js';
import { buildReportDocument, documentRows, DOC_ROW_TYPES } from '../src/modules/reporting/domain/reportDocument.js';
import { computeAggregates, aggregateSpecId } from '../src/modules/reporting/domain/reportAggregates.js';
import { canSeeColumn } from '../src/modules/reporting/domain/reportPermissions.js';
import { describeFilter } from '../src/modules/reporting/domain/filterEngine.js';
import { screenFixedFilters } from '../src/modules/reporting/domain/reportScreenState.js';
import { columnKeysOf, getReportView } from '../src/modules/reporting/domain/reportViews.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const PESAGENS = getReportDefinition('pesagens');
const close = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b);
let checks = 0;
const ok = (label) => { checks += 1; if (process.env.VERBOSE) console.log(`  ok ${label}`); };

// Pílula → filtro do serviço (o mesmo de components/reports/reportUi.toServiceFilters, sem React).
function serviceFilters(uiFilters, columns) {
  const out = {};
  for (const [id, filter] of Object.entries(uiFilters ?? {})) {
    const column = columns.find((item) => item.id === id);
    out[id] = column && ['entity', 'enum'].includes(column.type) && filter.match !== 'code' ? { ...filter, match: 'label' } : filter;
  }
  return out;
}

/** Estado da tela como o ReportView monta (buildInitialReportState + applyView). */
function screenState(definition, viewId = null, role = 'ADMIN') {
  const { state } = buildInitialReportState(definition, { role });
  if (definition.params.some((param) => param.type === 'period')) state.params = { ...state.params, ...P };
  if (!viewId) return state;
  const selection = typedViewSelection(definition, viewId, null);
  return { ...state, view: selection.view, matrix: selection.matrix, groups: selection.groups, mode: selection.mode, aggregates: selection.aggregates, columns: selection.columns, sort: selection.sort, summarySort: selection.summarySort, drill: [] };
}

async function run(definition, state, actor = ADMIN, extra = {}) {
  return runReport(definition.id, {
    params: state.params,
    selection: {
      columns: state.columns, filters: serviceFilters(state.uiFilters, definition.columns), fixedFilters: screenFixedFilters(state), groups: state.groups, aggregates: state.aggregates, sort: state.sort, search: state.search,
      mode: state.mode, summarySort: state.summarySort, drill: state.drill, view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
    },
  }, actor, extra);
}

/** Tela: aplica a escolha do menu (o que ReportView faz: update(patch) + a escolha do tipo). */
function act(ctx, docColumn, action) {
  const result = applyHeaderAction(ctx, docColumn, action);
  if (!result) return null;
  return { state: { ...ctx.state, ...result.patch }, typeKeys: result.typeKeys };
}

const ctxOf = (definition, state, viewModel, role = 'ADMIN') => ({ definition, state, viewModel, role });
const colOf = (doc, key) => doc.columns.find((column) => column.key === key);

// ---------------------------------------------------------------------------
// 1. Resumido de tipo: Pesagens › Por Apartação (Resumo por Data)
// ---------------------------------------------------------------------------
let state = screenState(PESAGENS, 'por-apartacao-data');
let vm = await run(PESAGENS, state);
let doc = buildReportDocument(vm);
let ctx = ctxOf(PESAGENS, state, vm);
assert.equal(doc.layout, 'summary');
const view = getReportView(PESAGENS, 'por-apartacao-data');

const labelMenu = headerMenuOf(ctx, colOf(doc, '__label__'), doc.layout);
assert.deepEqual(labelMenu.sort.map((item) => item.label), ['A-Z', 'Z-A'], 'rótulo: A-Z / Z-A');
assert.equal(labelMenu.calc, null, 'rótulo: sem Calcular');
assert.equal(labelMenu.hide, null, 'rótulo: não se oculta');
assert.equal(labelMenu.group, null, 'Resumido: métrica/rótulo não agrupam');
const currentKeys = columnKeysOf(view, PESAGENS, { aggregates: state.aggregates });
assert.deepEqual(labelMenu.add.filter((item) => item.group === 'tipo').map((item) => item.key).sort(), view.columnChoices.available.filter((key) => !currentKeys.includes(key)).sort(), 'Adicionar: primeiro as chaves do tipo que não estão na folha');
const firstOther = labelMenu.add.findIndex((item) => item.group === 'relatorio');
assert.ok(firstOther > 0 && labelMenu.add.slice(firstOther).every((item) => item.group === 'relatorio'), 'depois, as outras do relatório');
assert.ok(!labelMenu.add.slice(firstOther).some((item) => state.aggregates.some((spec) => aggregateSpecId(spec) === item.key)), 'NEGATIVO: nada que já está na folha');
ok('menu do rótulo');

const pesoMenu = headerMenuOf(ctx, colOf(doc, 'peso_medio'), doc.layout);
assert.deepEqual(pesoMenu.sort.map((item) => item.direction), ['desc', 'asc'], 'métrica: maior/menor');
const calcById = Object.fromEntries(pesoMenu.calc.options.map((option) => [option.id, option]));
assert.equal(calcById.avg.active, true, 'Média é a conta atual');
assert.equal(calcById.sum.disabled, true, 'Soma de peso já está na folha (Peso Total): desligada');
assert.equal(calcById.min.disabled, true, 'Mínimo já está (Menor)');
assert.ok(pesoMenu.calc.options.every((option) => ['sum', 'avg', 'min', 'max', 'count'].includes(option.id)), 'só as 5 contas');
ok('menu da métrica');

// Ordenar pela métrica com opção fixa equivalente → "Peso (Maior)".
let step = act(ctx, colOf(doc, 'peso_medio'), { type: 'sort', direction: 'desc', layout: doc.layout });
assert.equal(step.state.sortChoice, 'peso_desc', 'peso médio maior → Peso (Maior)');
vm = await run(PESAGENS, step.state);
assert.equal(vm.summarySort.key, 'peso_medio');
assert.equal(vm.summarySort.direction, 'desc');
// Sem opção equivalente (Qtd) → Personalizado, restrito ao nível folha.
step = act(ctx, colOf(doc, 'qtd'), { type: 'sort', direction: 'desc', layout: doc.layout });
assert.equal(step.state.sortChoice, null, 'Qtd: Personalizado');
assert.deepEqual(step.state.summarySort, { key: 'qtd', direction: 'desc' });
vm = await run(PESAGENS, step.state);
assert.equal(vm.summarySort.key, 'qtd');
assert.equal(vm.summarySort.columnId, 'nome_lote', 'no tipo, a ordem vale no nível folha');
ok('Ordenar no Resumido');

// Calcular: GMD Médio (ponderado) → Máximo, pelo motor.
state = screenState(PESAGENS, 'por-apartacao-data');
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, { ...state, widths: { gmd_medio: 130 } }, vm);
const gmdMenu = headerMenuOf(ctx, colOf(doc, 'gmd_medio'), doc.layout);
assert.ok(gmdMenu.calc.options.find((option) => option.id === 'avg')?.active, 'GMD médio = Média (ponderado)');
step = act(ctx, colOf(doc, 'gmd_medio'), { type: 'calc', choice: 'max', layout: doc.layout });
assert.ok(step, 'Máximo do GMD aplicado');
const maxSpec = step.state.aggregates.find((spec) => spec.op === 'max' && spec.columnId === 'gmd');
assert.ok(maxSpec && !step.state.aggregates.some((spec) => spec.id === 'gmd_medio'), 'GMD médio trocado por Máximo');
assert.equal(step.state.aggregates.findIndex((spec) => spec === maxSpec), state.aggregates.findIndex((spec) => spec.id === 'gmd_medio'), 'no mesmo lugar');
assert.deepEqual(step.state.widths, { [aggregateSpecId(maxSpec)]: 130 }, 'a largura acompanha a coluna');
assert.equal(step.state.view, 'por-apartacao-data', 'Calcular não sai do tipo');
vm = await run(PESAGENS, step.state);
doc = buildReportDocument(vm);
const maxKey = aggregateSpecId(maxSpec);
assert.ok(colOf(doc, maxKey), 'a coluna nova está na folha');
const engineMax = computeAggregates(vm.rows, [maxSpec], vm.resolve)[maxKey].value;
assert.ok(close(vm.totals[maxKey].value, engineMax), 'Máximo do GMD = motor sobre a população');
const grandMax = documentRows(doc).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL).cells.find((cell) => cell.key === maxKey);
assert.ok(close(grandMax.raw, engineMax), 'folha: total geral = motor');
// Negativos: conta que já está na folha e conta que a coluna não aceita não mudam nada.
assert.equal(applyHeaderAction(ctxOf(PESAGENS, state, await run(PESAGENS, state)), colOf(buildReportDocument(await run(PESAGENS, state)), 'peso_medio'), { type: 'calc', choice: 'sum', layout: 'summary' }), null, 'NEGATIVO: Soma do peso já na folha → nada');
assert.equal(applyHeaderAction(ctx, colOf(doc, '__label__'), { type: 'calc', choice: 'sum', layout: 'summary' }), null, 'NEGATIVO: rótulo não calcula');
ok('Calcular no Resumido');

// Ocultar e Adicionar pelas chaves do tipo (a escolha fica gravável por tipo e usuário).
state = screenState(PESAGENS, 'por-apartacao-data');
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
step = act(ctx, colOf(doc, 'machos'), { type: 'hide', layout: doc.layout });
assert.ok(!step.state.aggregates.some((spec) => spec.id === 'machos'), 'Machos saiu');
assert.equal(step.typeKeys.viewId, 'por-apartacao-data');
assert.deepEqual(step.typeKeys.keys, currentKeys.filter((key) => key !== 'machos'), 'escolha do tipo sem Machos');
const hiddenPair = act(ctx, colOf(doc, 'pair:faixa'), { type: 'hide', layout: doc.layout });
assert.ok(!hiddenPair.state.aggregates.some((spec) => ['faixa_min', 'faixa_max'].includes(spec.id)), 'Faixa exigida: as duas métricas saem');
assert.ok(!hiddenPair.typeKeys.keys.includes('faixa'));
step = act(ctx, colOf(doc, 'peso_medio'), { type: 'add', add: 'dias_medios', layout: doc.layout });
const order = step.state.aggregates.map((spec) => spec.id);
assert.equal(order.indexOf('dias_medios'), order.indexOf('peso_medio') + 1, 'Adicionar entra depois da coluna clicada');
assert.ok(step.typeKeys.keys.includes('dias_medios'));
vm = await run(PESAGENS, step.state);
doc = buildReportDocument(vm);
assert.equal(doc.columns.findIndex((column) => column.key === 'dias_medios'), doc.columns.findIndex((column) => column.key === 'peso_medio') + 1, 'folha: Dias Médios ao lado de Peso Médio');
assert.equal(applyHeaderAction(ctx, colOf(doc, 'peso_medio'), { type: 'add', add: 'nao_existe', layout: 'summary' }), null, 'NEGATIVO: chave que não existe');
// Outra do relatório (fora das chaves do tipo): entra na folha, o tipo continua e o número é o do motor.
const other = headerMenuOf(ctx, colOf(doc, 'peso_medio'), doc.layout).add.find((item) => item.group === 'relatorio' && /^(registros|count)/.test(item.key)) ?? headerMenuOf(ctx, colOf(doc, 'peso_medio'), doc.layout).add.find((item) => item.group === 'relatorio');
step = act(ctx, colOf(doc, 'peso_medio'), { type: 'add', add: other.key, layout: 'summary' });
assert.equal(step.state.view, 'por-apartacao-data', 'outra do relatório: o tipo continua');
assert.deepEqual(step.typeKeys.keys, currentKeys, 'a escolha do tipo não muda');
vm = await run(PESAGENS, step.state);
const otherSpec = step.state.aggregates.find((spec) => aggregateSpecId(spec) === other.key);
assert.ok(close(vm.totals[other.key].value, computeAggregates(vm.rows, [otherSpec], vm.resolve)[other.key].value), `${other.label} = motor`);
// Última métrica do tipo não se oculta (lista vazia seria o padrão do tipo).
const single = { ...state, aggregates: state.aggregates.filter((spec) => spec.id === 'qtd') };
const singleVm = await run(PESAGENS, single);
const singleDoc = buildReportDocument(singleVm);
const singleMenu = headerMenuOf(ctxOf(PESAGENS, single, singleVm), colOf(singleDoc, 'qtd'), singleDoc.layout);
assert.equal(singleMenu.hide.disabled, true, 'última coluna do tipo: Ocultar desligado');
assert.equal(applyHeaderAction(ctxOf(PESAGENS, single, singleVm), colOf(singleDoc, 'qtd'), { type: 'hide', layout: 'summary' }), null, 'NEGATIVO: não oculta a última');
ok('Ocultar/Adicionar no tipo resumido');

// ---------------------------------------------------------------------------
// 2. Detalhado: Analítico
// ---------------------------------------------------------------------------
state = screenState(PESAGENS, 'analitico');
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
assert.equal(doc.layout, 'detail');
const pesoData = headerMenuOf(ctx, colOf(doc, 'peso'), doc.layout);
assert.deepEqual(pesoData.sort.map((item) => item.label), ['Maior primeiro', 'Menor primeiro']);
step = act(ctx, colOf(doc, 'peso'), { type: 'sort', direction: 'asc', layout: doc.layout });
assert.equal(step.state.sortChoice, 'peso_asc', 'Peso menor → Peso (Menor)');
step = act(ctx, colOf(doc, 'sexo'), { type: 'sort', direction: 'desc', layout: doc.layout });
assert.equal(step.state.sortChoice, null);
assert.deepEqual(step.state.sort, [{ columnId: 'sexo', direction: 'desc' }], 'Sexo Z-A: Personalizado');
vm = await run(PESAGENS, step.state);
assert.deepEqual(vm.sort[0], { columnId: 'sexo', direction: 'desc' });
ok('Ordenar no Detalhado');

// Calcular (liga/desliga) e Subtotal/Total: entram na linha de total do antigo com o número do motor.
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
const pesoAggs = PESAGENS.columns.find((column) => column.id === 'peso').aggregations;
assert.deepEqual(headerMenuOf(ctx, colOf(doc, 'peso'), doc.layout).calc.options.map((option) => option.id), ['sum', 'avg', 'min', 'max', ...(pesoAggs.some((op) => ['countValid', 'countDistinct'].includes(op)) ? ['count'] : [])], 'Peso: Soma, Média, Mínimo, Máximo (e Contagem só se a coluna conta)');
const noCount = headerMenuOf(ctx, colOf(doc, 'sexo'), doc.layout).calc;
assert.ok(!noCount || noCount.options.every((option) => option.op !== 'count'), 'NEGATIVO: no Detalhado a contagem de registros não é "desta coluna"');
step = act(ctx, colOf(doc, 'peso'), { type: 'calc', choice: 'sum', layout: doc.layout });
assert.ok(step.state.aggregates.some((spec) => spec.op === 'sum' && spec.columnId === 'peso'), 'Soma do peso ligada');
const total = headerMenuOf(ctx, colOf(doc, 'dias'), doc.layout).total;
assert.deepEqual(total, { op: 'sum', active: false }, 'Dias: total = soma');
step = act({ ...ctx, state: step.state }, colOf(doc, 'dias'), { type: 'total', layout: doc.layout });
assert.ok(step.state.aggregates.some((spec) => spec.op === 'sum' && spec.columnId === 'dias'), 'Total de Dias ligado');
vm = await run(PESAGENS, { ...step.state, groups: [{ columnId: 'nome_lote' }] });
doc = buildReportDocument(vm);
const byId = new Map();
(function walk(nodes) { for (const node of nodes ?? []) { byId.set(node.id, node); walk(node.children); } })(vm.tree);
const extraKeys = ['sum:peso', 'sum:dias'];
let lines = 0;
for (const row of documentRows(doc).filter((item) => item.line)) {
  const population = row.type === DOC_ROW_TYPES.GRAND_TOTAL ? vm.rows : byId.get(row.id.replace(/#subtotal$/, ''))?.rows;
  const engine = computeAggregates(population, vm.aggregates, vm.resolve);
  for (const key of extraKeys) {
    const item = row.line.items.find((candidate) => candidate.key === key);
    assert.ok(item, `${row.id}: ${key} na linha de total`);
    assert.ok(close(item.raw, engine[key].value), `${row.id}: ${item.label} = motor (${item.raw} × ${engine[key].value})`);
    lines += 1;
  }
  assert.ok(['qtd', 'peso_medio', 'gmd_medio'].every((key) => row.line.items.some((item) => item.key === key)), `${row.id}: itens do antigo continuam`);
}
assert.ok(lines >= 4, 'subtotais e total geral conferidos');
assert.ok(/Soma|Peso Total/.test(documentRows(doc).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL).line.items.find((item) => item.key === 'sum:peso').label), 'rótulo do total ligado');
// De novo = desliga.
const off = act({ ...ctx, state: step.state }, colOf(doc, 'dias'), { type: 'total', layout: 'detail' });
assert.ok(!off.state.aggregates.some((spec) => spec.columnId === 'dias'), 'Total de Dias desligado');
// Sem nada ligado, a linha do Analítico é a do antigo (nada a mais).
const plain = buildReportDocument(await run(PESAGENS, state));
assert.deepEqual(documentRows(plain).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL).line.items.map((item) => item.key), ['qtd', 'peso_medio', 'gmd_medio', 'ganho_total'], 'NEGATIVO: sem total extra, a linha não muda');
ok('Calcular e Subtotal/Total no Detalhado');

// Agrupar: botão do tipo (fica no Analítico) e outra coluna (sai do tipo), até 3 níveis.
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
step = act(ctx, colOf(doc, 'nome_lote'), { type: 'group', layout: doc.layout });
assert.deepEqual(step.state.groups, [{ columnId: 'nome_lote' }]);
assert.equal(step.state.view, 'analitico', 'Lote é botão do Analítico: fica no tipo');
assert.equal(headerMenuOf(ctx, colOf(doc, 'data_pesagem'), doc.layout).group.leavesType, true, 'Data não é botão: sai do tipo');
step = act({ ...ctx, state: step.state }, colOf(doc, 'data_pesagem'), { type: 'group', layout: doc.layout });
assert.equal(step.state.view, null, 'agrupar por Data: Personalizado');
assert.deepEqual(step.state.groups, [{ columnId: 'nome_lote' }, { columnId: 'data_pesagem' }]);
assert.equal(step.state.mode, 'DETALHADO');
vm = await run(PESAGENS, step.state);
assert.equal(vm.view, null);
assert.deepEqual(vm.groups.map((group) => group.columnId), ['nome_lote', 'data_pesagem'], 'motor agrupa pelos dois');
const three = { ...step.state, groups: [...step.state.groups, { columnId: 'sexo' }] };
const threeVm = await run(PESAGENS, three);
const threeDoc = buildReportDocument(threeVm);
const fourth = headerMenuOf(ctxOf(PESAGENS, three, threeVm), colOf(threeDoc, 'raca'), threeDoc.layout);
assert.equal(fourth.group.disabled, true, 'com 3 níveis o 4º fica desligado');
assert.equal(applyHeaderAction(ctxOf(PESAGENS, three, threeVm), colOf(threeDoc, 'raca'), { type: 'group', layout: 'detail' }), null, 'NEGATIVO: 4º nível não entra');
assert.equal(headerMenuOf(ctx, colOf(doc, 'peso'), doc.layout).group, null, 'NEGATIVO: Peso não agrupa');
ok('Agrupar pelo cabeçalho');

// Ocultar e Adicionar no Detalhado do tipo (colunas do tipo, escolha gravável).
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
step = act(ctx, colOf(doc, 'raca'), { type: 'hide', layout: doc.layout });
assert.ok(!step.state.columns.includes('raca'));
assert.deepEqual(step.typeKeys, { viewId: 'analitico', keys: state.columns.filter((id) => id !== 'raca') });
const addPeso = headerMenuOf(ctx, colOf(doc, 'peso'), doc.layout).add;
assert.deepEqual(addPeso.filter((item) => item.group === 'tipo').map((item) => item.key).sort(), ['data_anterior', 'observacao', 'peso_anterior'].sort(), 'Analítico: Adicionar = primeiro as opcionais do tipo');
assert.ok(addPeso.some((item) => item.group === 'relatorio' && item.key === 'marca'), 'depois as outras colunas do relatório (Marca)');
assert.ok(!addPeso.some((item) => state.columns.includes(item.key)), 'NEGATIVO: nenhuma que já está na folha');
step = act(ctx, colOf(doc, 'peso'), { type: 'add', add: 'peso_anterior', layout: doc.layout });
assert.equal(step.state.columns.indexOf('peso_anterior'), step.state.columns.indexOf('peso') + 1, 'Peso Ant. ao lado de Peso');
vm = await run(PESAGENS, step.state);
assert.ok(vm.columns.some((column) => column.id === 'peso_anterior'), 'motor devolve a coluna nova');
ok('Ocultar/Adicionar no Detalhado');

// ---------------------------------------------------------------------------
// 3. Vendas (relatório de venda): agrupar sai do tipo LEVANDO a população
// ---------------------------------------------------------------------------
state = { ...screenState(PESAGENS, 'vendas'), showDetails: true };
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm, { showDetails: true });
ctx = ctxOf(PESAGENS, state, vm);
assert.equal(doc.layout, 'vendas');
const vendasPeso = headerMenuOf(ctx, colOf(doc, 'peso'), doc.layout);
assert.equal(vendasPeso.calc, null, 'relatório de venda: sem Calcular');
assert.equal(vendasPeso.total, null, 'relatório de venda: sem Subtotal/Total');
step = act(ctx, colOf(doc, 'data_pesagem'), { type: 'group', layout: doc.layout });
assert.equal(step.state.view, null, 'agrupar em Vendas: Personalizado');
assert.deepEqual(step.state.groups, [{ columnId: 'comprador' }, { columnId: 'data_pesagem' }], 'Comprador › Data');
assert.deepEqual(Object.keys(step.state.typePopulation).sort(), ['motivo_saida', 'tipo_manejo'], 'população de Vendas vai junto');
vm = await run(PESAGENS, step.state);
assert.deepEqual(Object.keys(vm.lockedFilters).sort(), ['motivo_saida', 'tipo_manejo'], 'cadeado continua');
assert.ok(vm.rows.every((row) => vm.resolve('motivo_saida').valueOf(row) === 'Venda'), 'só vendas');
const vendasHtml = renderSheetBody(doc, { mode: 'fragment', interactive: true, headerMenu: true });
assert.ok(/<table class="sv-table sv-table--detail"[^>]*>(<colgroup>[\s\S]*?<\/colgroup>)?<thead><tr><th data-col="0" data-key="comprador" data-col-key="comprador" data-col-kind="data"/.test(vendasHtml), 'tela: tabela de detalhe da venda com cabeçalho interativo');
assert.ok(!/data-col-key/.test(renderSheetBody(doc, { mode: 'print', headerMenu: true })), 'impressão da venda sem cabeçalho interativo');
ok('Vendas');

// ---------------------------------------------------------------------------
// 4. Matriz
// ---------------------------------------------------------------------------
state = screenState(PESAGENS, 'sintetico-matriz');
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
assert.equal(doc.layout, 'matrix');
const xColumn = doc.columns.find((column) => column.kind === 'matrix' && !column.total);
assert.equal(headerMenuOf(ctx, xColumn, doc.layout), null, 'valor do eixo X: sem menu');
const totalMenu = headerMenuOf(ctx, doc.columns.find((column) => column.total), doc.layout);
assert.equal(totalMenu.sort.length, vm.aggregates.length * 2, 'TOTAL: maior/menor de cada valor da célula');
assert.equal(totalMenu.hide, null);
assert.deepEqual(totalMenu.add, []);
step = act(ctx, doc.columns.find((column) => column.total), { type: 'sort', key: 'qtd', direction: 'desc', layout: doc.layout });
vm = await run(PESAGENS, step.state);
assert.equal(vm.summarySort.key, 'qtd');
const qtds = buildReportDocument(vm).flat.rows.filter((row) => row.type === DOC_ROW_TYPES.GROUP).map((row) => row.cells.at(-1).raw[0]);
assert.deepEqual(qtds, [...qtds].sort((a, b) => b - a), 'linhas da matriz por Qtd (maior primeiro)');
step = act(ctx, colOf(doc, '__label__'), { type: 'sort', direction: 'desc', layout: doc.layout });
assert.deepEqual(step.state.summarySort, { key: '__label__', direction: 'desc' }, 'rótulo Z-A');
ok('Matriz');

// ---------------------------------------------------------------------------
// 5. Personalizado genérico (outro relatório): métricas do relatório
// ---------------------------------------------------------------------------
const generic = listReportDefinitions().find((definition) => definition.id !== 'pesagens' && definition.id !== 'comercial' && (definition.defaultAggregates ?? []).length && (definition.defaultGroups ?? []).length);
assert.ok(generic, 'um relatório genérico com totais e agrupamento');
state = { ...screenState(generic), view: null, mode: 'RESUMIDO', groups: generic.defaultGroups.map((group) => ({ ...group })) };
vm = await run(generic, state);
doc = buildReportDocument(vm);
ctx = ctxOf(generic, state, vm);
const metricColumn = doc.columns.find((column) => column.kind === 'metric');
const addGeneric = headerMenuOf(ctx, metricColumn, doc.layout).add;
assert.ok(addGeneric.length > 0, `${generic.id}: há totais para adicionar`);
step = act(ctx, metricColumn, { type: 'add', add: addGeneric[0].key, layout: doc.layout });
assert.equal(step.typeKeys, null, 'fora do tipo: nada a gravar por tipo');
const added = step.state.aggregates.filter((spec) => !state.aggregates.some((item) => aggregateSpecId(item) === aggregateSpecId(spec)));
assert.ok(added.length >= 1, `${generic.id}: um total a mais`);
vm = await run(generic, step.state);
for (const spec of added) {
  const id = aggregateSpecId(spec);
  assert.ok(vm.aggregates.some((item) => item.id === id), `${generic.id}: ${id} vale no motor`);
  assert.ok(close(vm.totals[id]?.value ?? null, computeAggregates(vm.rows, [spec], vm.resolve)[id].value ?? null), `${generic.id}: ${id} = motor sobre a população`);
}
step = act(ctx, metricColumn, { type: 'hide', layout: doc.layout });
assert.ok(!step.state.aggregates.some((spec) => aggregateSpecId(spec) === metricColumn.key), `${generic.id}: métrica oculta`);
ok(`Personalizado genérico (${generic.id})`);

// ---------------------------------------------------------------------------
// 6. Permissão: CONSULTA nunca vê oferta de coluna comercial
// ---------------------------------------------------------------------------
const byColumn = new Map(PESAGENS.columns.map((column) => [column.id, column]));
state = { ...screenState(PESAGENS, null, 'CONSULTA'), view: null, mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: [{ id: 'registros', op: 'count' }] };
vm = await run(PESAGENS, state, CONSULTA);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm, 'CONSULTA');
const consultaAdd = headerMenuOf(ctx, colOf(doc, 'registros'), doc.layout).add;
assert.ok(consultaAdd.length > 0);
const addState = (key) => act(ctx, colOf(doc, 'registros'), { type: 'add', add: key, layout: 'summary' }).state;
for (const option of consultaAdd) {
  for (const spec of addState(option.key).aggregates.filter((item) => item.columnId)) assert.ok(canSeeColumn(byColumn.get(spec.columnId), 'CONSULTA'), `CONSULTA: ${option.label} não é comercial`);
}
assert.ok(!consultaAdd.some((option) => /valor/i.test(option.key)), 'NEGATIVO: nenhum total de valor oferecido');
const adminAdd = headerMenuOf(ctxOf(PESAGENS, state, vm, 'ADMIN'), colOf(doc, 'registros'), doc.layout).add;
assert.ok(adminAdd.some((option) => /valor/.test(option.key)), 'ADMIN vê os totais de valor');
state = { ...screenState(PESAGENS, null, 'CONSULTA'), view: null, mode: 'DETALHADO', groups: [], columns: ['data_pesagem', 'numero_animal', 'peso'] };
vm = await run(PESAGENS, state, CONSULTA);
doc = buildReportDocument(vm);
const detailAdd = headerMenuOf(ctxOf(PESAGENS, state, vm, 'CONSULTA'), colOf(doc, 'peso'), doc.layout).add;
assert.ok(detailAdd.length > 0 && detailAdd.every((option) => canSeeColumn(byColumn.get(option.key), 'CONSULTA')), 'CONSULTA: Adicionar coluna só com o que vê');
ok('permissão');

// ---------------------------------------------------------------------------
// 7. Larguras
// ---------------------------------------------------------------------------
assert.equal(clampWidth(10), HEADER_WIDTH.MIN);
assert.equal(clampWidth(5000), HEADER_WIDTH.MAX);
assert.equal(clampWidth('abc'), null);
const target = resizedWidth({ widths: [100, 100, 100, 300], index: 0, targetPx: 250, tableWidthPx: 1047 });
assert.ok(Math.abs((target / (target + 500)) * 1047 - 250) < 1, `arraste: a coluna fica com o tamanho do arraste (${target})`);
assert.equal(resizedWidth({ widths: [100], index: 0, targetPx: 50, tableWidthPx: 700 }), 100, 'coluna única: nada muda');
state = screenState(PESAGENS, 'por-apartacao-data');
vm = await run(PESAGENS, state);
doc = buildReportDocument(vm);
ctx = ctxOf(PESAGENS, state, vm);
step = act(ctx, colOf(doc, 'peso_medio'), { type: 'resize', width: 5000, layout: doc.layout });
assert.deepEqual(step.state.widths, { peso_medio: HEADER_WIDTH.MAX }, 'largura nos limites');
step = act(ctx, colOf(doc, 'peso_medio'), { type: 'resize', width: 180, layout: doc.layout });
const wide = buildReportDocument(vm, { widths: step.state.widths });
const index = wide.columns.findIndex((column) => column.key === 'peso_medio');
assert.equal(wide.print.widths[index], 180, 'Resumido: a folha usa a largura escolhida');
assert.ok(wide.print.widthPercents[index] > doc.print.widthPercents[index], 'Resumido: a coluna ficou mais larga no papel');
assert.deepEqual(wide.print.userWidths, ['peso_medio']);
const printed = await preparePrint(vm, ADMIN, { widths: step.state.widths, orientation: 'landscape' });
assert.ok(printed.html.includes(`<col style="width:${wide.print.widthPercents[index]}%">`) || printed.html.includes(`width:${printed.layout.widthPercents[index]}%`), 'impressão/PDF: colgroup com a largura escolhida');
assert.equal(printed.layout.widths[index], 180, 'impressão/PDF: mesma largura');
const reset = act({ ...ctx, state: step.state }, colOf(doc, 'peso_medio'), { type: 'resetWidth', layout: doc.layout });
assert.deepEqual(reset.state.widths, {}, 'largura automática de novo');
// Detalhado e matriz também.
const detailState = screenState(PESAGENS, 'analitico');
const detailVm = await run(PESAGENS, detailState);
const detailDoc = buildReportDocument(detailVm, { widths: { peso: 300 } });
assert.equal(detailDoc.print.widths[detailDoc.columns.findIndex((column) => column.key === 'peso')], 300, 'Detalhado: largura escolhida');
const matrixVm = await run(PESAGENS, screenState(PESAGENS, 'sintetico-matriz'));
const matrixDoc = buildReportDocument(matrixVm, { widths: { __label__: 200 } });
assert.equal(matrixDoc.print.widths[0], 200, 'matriz: largura escolhida');
// Modelo e último estado guardam as chaves da folha (métrica, rótulo, eixo), nos limites.
const saved = normalizeTemplateConfig(PESAGENS, { widths: { peso_medio: 180, __label__: 20, 'x:Lote 01': 90, 'pair:faixa': 9999, peso: 'x' } });
assert.deepEqual(saved.widths, { peso_medio: 180, __label__: HEADER_WIDTH.MIN, 'x:Lote 01': 90, 'pair:faixa': HEADER_WIDTH.MAX }, 'modelo guarda as larguras da folha');
ok('larguras');

// ---------------------------------------------------------------------------
// 8. Marcação: tela com cabeçalho interativo; impressão sem nada disso
// ---------------------------------------------------------------------------
const heads = (html) => [...html.matchAll(/<th ([^>]*)>([\s\S]*?)<\/th>/g)];
for (const [viewId, extra] of [['por-apartacao-data', {}], ['por-apartacao-lote', {}], ['analitico', {}], ['sintetico-matriz', {}], ['vendas', { showDetails: true }]]) {
  const current = screenState(PESAGENS, viewId);
  const model = await run(PESAGENS, current);
  const sheet = buildReportDocument(model, extra);
  const screen = renderSheetBody(sheet, { mode: 'fragment', interactive: true, headerMenu: true });
  const cells = heads(screen).filter(([, attrs]) => /data-col=/.test(attrs));
  assert.ok(cells.length > 0, `${viewId}: cabeçalho na tela`);
  for (const [, attrs, inner] of cells) {
    const key = attrs.match(/data-col-key="([^"]*)"/)?.[1];
    assert.ok(key && /data-col-kind="(label|metric|pair|data|matrix)"/.test(attrs), `${viewId}: <th> com data-col-key/data-col-kind`);
    assert.ok(inner.includes(`data-col-grip="${key}"`), `${viewId}: puxador de largura em ${key}`);
    const kind = attrs.match(/data-col-kind="([^"]*)"/)[1];
    const isX = kind === 'matrix' && !/mk-tcol/.test(attrs);
    assert.equal(inner.includes(`data-col-menu="${key}"`), !isX, `${viewId}: botão do menu em ${key}${isX ? ' (NEGATIVO: eixo X sem menu)' : ''}`);
    // Cada botão aponta para uma coluna do documento com menu de verdade.
    const docColumn = sheet.columns.find((column) => column.key === key.replace(/&amp;/g, '&'));
    assert.ok(docColumn, `${viewId}: ${key} é coluna do documento`);
    if (!isX) assert.ok(!isEmptyHeaderMenu(headerMenuOf(ctxOf(PESAGENS, current, model), docColumn, sheet.layout)), `${viewId}: menu de ${key} tem o que fazer`);
  }
  const print = renderSheetBody(sheet, { mode: 'print', headerMenu: true });
  assert.equal(print, renderSheetBody(sheet, { mode: 'print' }), `${viewId}: impressão igual com ou sem headerMenu`);
  assert.ok(!/data-col-key|data-col-menu|data-col-grip|sheet-col-btn/.test(print), `${viewId}: NEGATIVO — impressão sem cabeçalho interativo`);
  const legacy = renderSheetBody(sheet, { mode: 'fragment', interactive: true });
  assert.ok(!/data-col-grip/.test(legacy), `${viewId}: sem headerMenu (aba Controle) a tela é a de antes`);
  const printed2 = await preparePrint(model, ADMIN, { orientation: 'landscape', showDetails: extra.showDetails === true });
  assert.ok(!/data-col-grip|data-col-menu/.test(printed2.html), `${viewId}: documento de impressão/PDF sem puxador`);
}
// Ordenada: aria-sort no <th> da coluna.
const sortedScreen = renderSheetBody(buildReportDocument(await run(PESAGENS, screenState(PESAGENS, 'por-apartacao-data'))), { mode: 'fragment', interactive: true, headerMenu: true, sort: { key: 'peso_medio', direction: 'desc' } });
assert.ok(/data-col-key="peso_medio"[^>]*aria-sort="descending"/.test(sortedScreen), 'coluna ordenada com aria-sort');
ok('marcação');

// ---------------------------------------------------------------------------
// 9. "Mais filtros…"
// ---------------------------------------------------------------------------
const available = PESAGENS.columns.filter((column) => canSeeColumn(column, 'ADMIN'));
const more = moreFilterColumnsOf(PESAGENS, available);
const buttons = new Set(filterButtonsOf(PESAGENS, available).map(({ column }) => column.id));
assert.ok(more.length > 5, 'Pesagens: várias colunas em "Mais filtros"');
assert.ok(more.every((column) => !buttons.has(column.id) && column.id !== PREVIOUS_COLUMN && column.filterable !== false && !column.metricOnly), 'só as filtráveis sem botão próprio');
assert.ok(['motivo_saida', 'comprador', 'peso', 'numero_animal'].every((id) => more.some((column) => column.id === id)), 'Motivo da saída, Comprador, Peso e Animal estão lá');
assert.ok(!more.some((column) => column.id === 'nome_lote'), 'NEGATIVO: Lote tem botão próprio');
const labels = more.map((column) => column.label);
assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), 'em ordem alfabética');
const consultaMore = moreFilterColumnsOf(PESAGENS, PESAGENS.columns.filter((column) => canSeeColumn(column, 'CONSULTA')));
assert.ok(consultaMore.every((column) => canSeeColumn(column, 'CONSULTA')), 'CONSULTA: só o que vê');
assert.ok(!consultaMore.some((column) => column.id === 'valor_venda_total'), 'NEGATIVO: CONSULTA sem Valor venda');
// O filtro por uma coluna do "Mais filtros" vale no motor (mesmo caminho dos botões).
state = screenState(PESAGENS, 'analitico');
const semFiltro = await run(PESAGENS, state);
const comFiltro = await run(PESAGENS, { ...state, uiFilters: { motivo_saida: { operator: 'in', value: '', valueTo: '', values: ['Morte'] } } });
assert.ok(comFiltro.rows.length > 0 && comFiltro.rows.length < semFiltro.rows.length, 'Motivo da saída = Morte filtra');
assert.ok(comFiltro.rows.every((row) => comFiltro.resolve('motivo_saida').valueOf(row) === 'Morte'), 'só mortes');
const pesoFiltro = await run(PESAGENS, { ...state, uiFilters: { peso: { operator: 'between', value: '300', valueTo: '400', values: [] } } });
assert.ok(pesoFiltro.rows.length > 0 && pesoFiltro.rows.every((row) => row.peso >= 300 && row.peso <= 400), 'Peso entre 300 e 400 (condição de número)');
const dataFiltro = await run(PESAGENS, { ...state, uiFilters: { data_pesagem: { operator: 'on_or_after', value: '2026-09-01', valueTo: '', values: [] } } });
assert.ok(dataFiltro.rows.length > 0 && dataFiltro.rows.every((row) => String(row.data_pesagem) >= '2026-09-01'), 'Data a partir de 01/09 (condição de data)');
// Coluna sim/não marcada na lista: valor true/false no motor, "Sim"/"Não" no texto (rodapé da folha).
const booleanColumn = PESAGENS.columns.find((column) => column.type === 'boolean' && column.id !== PREVIOUS_COLUMN) ?? PESAGENS.columns.find((column) => column.id === PREVIOUS_COLUMN);
const simFiltro = await run(PESAGENS, { ...state, uiFilters: { [booleanColumn.id]: { operator: 'in', value: '', valueTo: '', values: ['true'] } } });
assert.ok(simFiltro.rows.every((row) => simFiltro.resolve(booleanColumn.id).valueOf(row) === true), `${booleanColumn.label} = Sim filtra pelo valor`);
assert.equal(describeFilter({ operator: 'in', values: ['true'] }, booleanColumn), 'em Sim', 'rodapé diz "Sim", não "true"');
ok('Mais filtros');

console.log(`reports:cabecalho-interativo:verify OK (${checks} blocos)`);
