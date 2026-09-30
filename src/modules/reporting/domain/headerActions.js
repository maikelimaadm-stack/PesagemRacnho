// Cabeçalho interativo da folha (E1F, item 2): o que o menu do título de uma coluna oferece (Ordenar, Calcular,
// Agrupar por esta coluna, Subtotal/Total, Ocultar, Adicionar coluna…, largura) e o que cada escolha muda no
// estado da tela. Funções puras: a tela (ReportView → ReportSheetView/SheetColumnMenu) e o gate
// reports:cabecalho-interativo usam o MESMO código. Só SELEÇÃO — ordem, totais, grupos, colunas e larguras vão
// para o estado e daí para o serviço (runReport), que valida contra a definição e o papel; nenhuma conta aqui.
//
// Regras (docs/plano-mestre/E1F-COLUNAS-CABECALHO-NOVO-RELATORIO.md):
//   - Ordenar: no relatório com "Ordenar por" fixo (sortChoices) vira a opção equivalente; sem ela, ordem própria
//     ("Personalizado"), como o clique no cabeçalho da E1B/E1D;
//   - Calcular: no Resumido troca a operação da métrica; no Detalhado liga/desliga o total da coluna. Só as
//     operações que a coluna aceita no motor (column.aggregations — o serviço recusa as outras);
//   - Agrupar por esta coluna: só coluna agrupável, até 3 níveis; no tipo com botões de agrupamento
//     (groupChoices) usa a regra dos botões; fora disso sai do tipo levando a população dele (leaveViewPatch);
//   - Subtotal/Total desta coluna (Detalhado): a conta padrão da coluna entra/sai dos totais;
//   - Ocultar / Adicionar coluna…: no tipo com "Colunas" (columnChoices) pelas chaves do tipo (e a escolha fica
//     gravada por tipo e usuário); fora dele, as colunas/totais do relatório que o papel vê;
//   - largura: state.widths[chave da coluna da folha], entre HEADER_WIDTH.MIN e MAX (a folha usa na tela, na
//     impressão e no PDF — reportDocument.decideSheetLayout).
import { isCategoricalType } from './columnDefinition.js';
import { summaryMetricLabels } from './aggregateLabels.js';
import { MAX_GROUP_LEVELS } from './groupEngine.js';
import { toggleGroupChoice } from './groupChoices.js';
import { aggregateSpecId } from './reportAggregates.js';
import { REPORT_MODES, metricKeysOf } from './reportDefinition.js';
import { headerLabel } from './reportFormatting.js';
import { canSeeColumn } from './reportPermissions.js';
import { leaveViewPatch } from './reportScreenState.js';
import { columnKeysOf, getReportView } from './reportViews.js';
import { applySortChoice, sortChoiceForColumn, sortChoiceForMetric } from './sortChoices.js';
import { SUMMARY_LABEL_SORT, SUMMARY_ROWS_METRIC } from './summaryLayout.js';
import { hasTypeColumns, typeColumnOptions } from './typeColumns.js';

/** Limites da largura escolhida arrastando a borda do título (px da folha). */
export const HEADER_WIDTH = Object.freeze({ MIN: 40, MAX: 600 });

/** Contas do "Calcular", na ordem do menu. */
export const CALC_CHOICES = Object.freeze([
  Object.freeze({ id: 'sum', label: 'Soma' }),
  Object.freeze({ id: 'avg', label: 'Média' }),
  Object.freeze({ id: 'min', label: 'Mínimo' }),
  Object.freeze({ id: 'max', label: 'Máximo' }),
  Object.freeze({ id: 'count', label: 'Contagem' }),
]);
// Operação do motor → conta do menu (a média ponderada e o GMD ponderado SÃO a "Média" da coluna).
const CHOICE_OF_OP = Object.freeze({ sum: 'sum', avg: 'avg', weightedAvg: 'avg', weightedGmd: 'avg', min: 'min', max: 'max', count: 'count', countValid: 'count', countDistinct: 'count' });
const NUMERIC_TYPES = new Set(['integer', 'number', 'weight', 'gmd', 'money', 'percentage']);
const DATE_TYPES = new Set(['date', 'datetime']);

export const HEADER_LAYOUTS = Object.freeze({ SUMMARY: 'summary', DETAIL: 'detail', MATRIX: 'matrix', VENDAS: 'vendas' });

const clone = (value) => JSON.parse(JSON.stringify(value));
const sameSpec = (left, right) => left.op === right.op && (left.columnId ?? null) === (right.columnId ?? null);
const columnOf = (definition, columnId) => (definition?.columns ?? []).find((column) => column.id === columnId) ?? null;

/** Largura dentro dos limites (px inteiros). */
export function clampWidth(width) {
  const number = Number(width);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(HEADER_WIDTH.MAX, Math.max(HEADER_WIDTH.MIN, number)));
}

/**
 * Largura a gravar para a coluna `index` ficar com `targetPx` na tela. A folha desenha as colunas em % da
 * largura da tabela (table-layout fixo): mudar uma coluna muda a parte das outras. Resolve w·(W − T) = T·(S − w₀)
 * — as outras larguras ficam como estão (S = soma das larguras da folha, w₀ = a atual, W = largura da tabela).
 * @param {{ widths: number[], index: number, targetPx: number, tableWidthPx: number }} input widths = doc.print.widths
 * @returns {number|null} px dentro de HEADER_WIDTH (null = nada a mudar)
 */
export function resizedWidth({ widths, index, targetPx, tableWidthPx }) {
  const list = (widths ?? []).map(Number);
  const current = list[index];
  if (!Number.isFinite(current) || !(tableWidthPx > 0) || !(targetPx > 0)) return null;
  const others = list.reduce((sum, width) => sum + width, 0) - current;
  // Tabela de uma coluna só (ou alvo maior que a tabela): a proporção não muda — fica o máximo que cabe.
  if (others <= 0) return clampWidth(current);
  if (targetPx >= tableWidthPx) return HEADER_WIDTH.MAX;
  return clampWidth((targetPx * others) / (tableWidthPx - targetPx));
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

/**
 * @typedef {object} HeaderContext
 * @property {object} definition ReportDefinition
 * @property {object} viewModel resultado de runReport (mode, aggregates, sort, summarySort, groups…)
 * @property {object} state estado da tela (columns, aggregates, groups, sort, summarySort, sortChoice, view,
 *   typePopulation, drill, widths)
 * @property {string} role papel de quem vê (nunca oferece o que ele não vê)
 */

const viewOf = ({ definition, state }) => (state?.view ? getReportView(definition, state.view) : null);
const modeOf = ({ viewModel, state }) => viewModel?.mode ?? state?.mode;
// "Colunas" do tipo valem quando o tipo está no próprio modo (no detalhe de um grupo do Resumido, não).
const typeColumnsOn = (ctx, view) => hasTypeColumns(view) && view.mode === modeOf(ctx);

/** Níveis como a opção de "Ordenar por" os mostra (o "Personalizado" de um clique parte do que se vê). */
function shownGroups({ definition, state }) {
  if (!state.sortChoice) return state.groups ?? [];
  const view = state.view ? getReportView(definition, state.view) : null;
  return applySortChoice(definition, view, { sort: state.sort, summarySort: state.summarySort, groups: state.groups, aggregates: state.aggregates }, state.sortChoice).groups;
}

/** Operação do motor para uma conta do menu, entre as que a coluna aceita (null = a coluna não faz). */
export function calcOpFor(choiceId, column) {
  const accepted = new Set(column?.aggregations ?? []);
  const first = (list) => list.find((op) => accepted.has(op)) ?? null;
  if (choiceId === 'sum') return first(['sum']);
  if (choiceId === 'avg') return first(column?.type === 'gmd' ? ['weightedGmd', 'avg'] : ['avg', 'weightedAvg']);
  if (choiceId === 'min') return first(['min']);
  if (choiceId === 'max') return first(['max']);
  if (choiceId === 'count') {
    // Sem contagem declarada na coluna: a contagem de registros (sempre aceita pelo motor e pelos modelos).
    return first(isCategoricalType(column?.type) ? ['countDistinct', 'countValid'] : ['countValid', 'countDistinct']) ?? 'count';
  }
  return null;
}

/** Total de uma conta numa coluna (contagem de registros sem coluna). */
function specFor(op, columnId) {
  return op === 'count' ? { id: 'count:*', op: 'count' } : { id: `${op}:${columnId}`, op, columnId };
}

/** Conta padrão do "Subtotal/Total desta coluna" (Detalhado): soma no número, média no GMD/%, distintos no texto. */
export function defaultTotalOp(column) {
  if (!column || DATE_TYPES.has(column.type)) return null;
  const accepted = new Set(column.aggregations ?? []);
  const first = (list) => list.find((op) => accepted.has(op)) ?? null;
  if (column.type === 'gmd') return first(['weightedGmd', 'avg']);
  if (column.type === 'percentage') return first(['avg', 'weightedAvg']);
  if (NUMERIC_TYPES.has(column.type)) return first(['sum', 'avg']);
  return first(['countDistinct', 'countValid']);
}

// ---------------------------------------------------------------------------
// Ordenar
// ---------------------------------------------------------------------------

function sortLabels(type) {
  if (DATE_TYPES.has(type)) return { desc: 'Mais recente primeiro', asc: 'Mais antiga primeiro' };
  if (NUMERIC_TYPES.has(type)) return { desc: 'Maior primeiro', asc: 'Menor primeiro' };
  return { asc: 'A-Z', desc: 'Z-A' };
}

function sortOptions(ctx, docColumn, layout) {
  const { definition, viewModel } = ctx;
  const shownSummary = viewModel?.summarySort ?? null;
  const summaryItem = (key, direction, label) => ({ key, direction, label, active: shownSummary?.key === key && shownSummary.direction === direction, target: 'summary' });
  if (docColumn.kind === 'label') {
    return ['asc', 'desc'].map((direction) => summaryItem(SUMMARY_LABEL_SORT, direction, direction === 'asc' ? 'A-Z' : 'Z-A'));
  }
  if (layout === HEADER_LAYOUTS.MATRIX) {
    // Coluna TOTAL: as linhas pelo total de cada valor da célula (Qtd, Peso médio, GMD médio).
    if (!docColumn.total) return [];
    return (viewModel?.aggregates ?? []).flatMap((spec) => {
      const labels = sortLabels(NUMERIC_TYPES.has(columnOf(definition, spec.columnId)?.type) || !spec.columnId ? 'number' : 'text');
      const name = viewModel.metricLabels?.[spec.id] ?? spec.id;
      return ['desc', 'asc'].map((direction) => summaryItem(spec.id, direction, `${name}: ${labels[direction].toLocaleLowerCase('pt-BR')}`));
    });
  }
  if (docColumn.kind === 'metric' || docColumn.kind === 'pair') {
    const key = docColumn.kind === 'pair' ? docColumn.from?.key : docColumn.key;
    if (!key) return [];
    const type = docColumn.kind === 'pair' ? 'number' : docColumn.metric?.column?.type ?? 'number';
    const labels = sortLabels(DATE_TYPES.has(type) ? type : 'number');
    return ['desc', 'asc'].map((direction) => summaryItem(key, direction, labels[direction]));
  }
  if (docColumn.kind === 'data') {
    const column = columnOf(definition, docColumn.key);
    if (!column || column.sortable === false || column.metricOnly) return [];
    const labels = sortLabels(column.type);
    const first = (viewModel?.sort ?? [])[0];
    const order = NUMERIC_TYPES.has(column.type) || DATE_TYPES.has(column.type) ? ['desc', 'asc'] : ['asc', 'desc'];
    return order.map((direction) => ({ key: column.id, direction, label: labels[direction], active: first?.columnId === column.id && first.direction === direction, target: 'rows' }));
  }
  return [];
}

function applySort(ctx, option) {
  const { definition, viewModel, state } = ctx;
  const fixed = Boolean(definition.sortChoices?.length);
  if (option.target === 'rows') {
    if (!fixed) return { sort: [{ columnId: option.key, direction: option.direction }] };
    const choice = sortChoiceForColumn(definition, option.key, option.direction);
    return choice ? { sortChoice: choice } : { sortChoice: null, sort: [{ columnId: option.key, direction: option.direction }], groups: shownGroups(ctx) };
  }
  const summarySort = { key: option.key, direction: option.direction };
  if (!fixed) return { summarySort };
  const choice = option.key === SUMMARY_LABEL_SORT ? null : sortChoiceForMetric(definition, viewModel?.aggregates ?? state.aggregates, option.key, option.direction);
  return choice ? { sortChoice: choice } : { sortChoice: null, summarySort, groups: shownGroups(ctx) };
}

// ---------------------------------------------------------------------------
// Totais (Calcular / Subtotal-Total) e métricas (Ocultar / Adicionar no Resumido)
// ---------------------------------------------------------------------------

/** Totais atuais (os do estado; o view model como reserva). */
const aggregatesOf = ({ state, viewModel }) => clone(state?.aggregates ?? (viewModel?.aggregates ?? []));

/** Métricas por trás de uma coluna do Resumido (o par "de–até" = as duas). */
function docSpecs(ctx, docColumn) {
  const current = aggregatesOf(ctx);
  const ids = docColumn.kind === 'pair' ? [docColumn.pair?.from, docColumn.pair?.to] : [docColumn.key];
  return ids.map((id) => current.find((spec) => aggregateSpecId(spec) === id)).filter(Boolean);
}

/** summarySort que deixou de existir sai (ordem natural); renomeada, segue a nova. */
function keepSummarySort(state, aggregates, renamed = {}) {
  const sort = state.summarySort;
  if (!sort?.key) return sort ?? null;
  if (renamed[sort.key]) return { ...sort, key: renamed[sort.key] };
  if (sort.key === SUMMARY_LABEL_SORT || sort.key === SUMMARY_ROWS_METRIC) return sort;
  return aggregates.some((spec) => aggregateSpecId(spec) === sort.key) ? sort : null;
}

function calcOptions(ctx, docColumn, layout) {
  const { definition, role } = ctx;
  if (layout === HEADER_LAYOUTS.SUMMARY && docColumn.kind === 'metric') {
    const spec = docColumn.metric?.spec;
    const column = spec?.columnId ? columnOf(definition, spec.columnId) : null;
    if (!column || !canSeeColumn(column, role)) return null;
    const current = aggregatesOf(ctx);
    const options = CALC_CHOICES.map((choice) => {
      const op = calcOpFor(choice.id, column);
      if (!op) return null;
      const next = specFor(op, column.id);
      const active = CHOICE_OF_OP[spec.op] === choice.id;
      const taken = !active && current.some((item) => sameSpec(item, next));
      return { id: choice.id, label: choice.label, op, active, disabled: taken, title: taken ? 'Essa conta já está numa coluna da folha' : null };
    }).filter(Boolean);
    return options.length > 1 ? { mode: 'replace', options } : null;
  }
  if ((layout === HEADER_LAYOUTS.DETAIL) && docColumn.kind === 'data') {
    const column = columnOf(definition, docColumn.key);
    if (!column || column.metricOnly || !canSeeColumn(column, role)) return null;
    const current = aggregatesOf(ctx);
    const options = CALC_CHOICES.map((choice) => {
      const op = calcOpFor(choice.id, column);
      if (!op || op === 'count') return null; // contagem de registros não é "desta coluna"
      return { id: choice.id, label: choice.label, op, active: current.some((item) => sameSpec(item, specFor(op, column.id))), disabled: false, title: null };
    }).filter(Boolean);
    return options.length ? { mode: 'toggle', options } : null;
  }
  return null;
}

function applyCalc(ctx, docColumn, option) {
  const { state } = ctx;
  const current = aggregatesOf(ctx);
  if (option.mode === 'toggle') {
    const spec = specFor(option.op, docColumn.key);
    const aggregates = current.some((item) => sameSpec(item, spec)) ? current.filter((item) => !sameSpec(item, spec)) : [...current, spec];
    return { aggregates, summarySort: keepSummarySort(state, aggregates) };
  }
  const old = docColumn.metric.spec;
  const next = specFor(option.op, old.columnId);
  if (sameSpec(old, next) || current.some((item) => sameSpec(item, next))) return null;
  const oldId = aggregateSpecId(old);
  const newId = aggregateSpecId(next);
  const aggregates = current.map((item) => (aggregateSpecId(item) === oldId ? next : item));
  const widths = { ...(state.widths ?? {}) };
  // A largura escolhida acompanha a coluna.
  if (widths[oldId] !== undefined) { widths[newId] = widths[oldId]; delete widths[oldId]; }
  return { aggregates, summarySort: keepSummarySort(state, aggregates, { [oldId]: newId }), widths };
}

function totalOption(ctx, docColumn, layout) {
  if (layout !== HEADER_LAYOUTS.DETAIL || docColumn.kind !== 'data') return null;
  const column = columnOf(ctx.definition, docColumn.key);
  if (!column || column.metricOnly || !canSeeColumn(column, ctx.role)) return null;
  const op = defaultTotalOp(column);
  if (!op) return null;
  // Ligado = a conta padrão da coluna já está nos totais (a média do tipo, ex. Peso Médio, não conta: é outra conta).
  return { op, active: aggregatesOf(ctx).some((spec) => sameSpec(spec, specFor(op, column.id))) };
}

function applyTotal(ctx, docColumn, option) {
  const current = aggregatesOf(ctx);
  const spec = specFor(option.op, docColumn.key);
  const aggregates = option.active ? current.filter((item) => !sameSpec(item, spec)) : [...current, spec];
  return { aggregates, summarySort: keepSummarySort(ctx.state, aggregates) };
}

// ---------------------------------------------------------------------------
// Agrupar por esta coluna
// ---------------------------------------------------------------------------

function groupOption(ctx, docColumn, layout) {
  if (docColumn.kind !== 'data' || (layout !== HEADER_LAYOUTS.DETAIL && layout !== HEADER_LAYOUTS.VENDAS)) return null;
  const column = columnOf(ctx.definition, docColumn.key);
  if (!column?.groupable || !canSeeColumn(column, ctx.role)) return null;
  const groups = ctx.state.groups ?? [];
  const view = viewOf(ctx);
  const active = groups.some((group) => group.columnId === column.id);
  const inChoices = Boolean(view?.groupChoices?.includes(column.id));
  const full = !active && groups.length >= MAX_GROUP_LEVELS;
  return {
    active,
    leavesType: Boolean(view) && !inChoices,
    disabled: full,
    title: full ? `No máximo ${MAX_GROUP_LEVELS} níveis de agrupamento: tire um deles para agrupar por ${column.label}.` : null,
  };
}

function applyGroup(ctx, docColumn, option) {
  const { definition, state } = ctx;
  if (option.disabled) return null;
  const view = viewOf(ctx);
  const groups = state.groups ?? [];
  if (view?.groupChoices?.includes(docColumn.key)) {
    const next = toggleGroupChoice(view.groupChoices, groups, docColumn.key);
    return next.blocked ? null : { groups: next.groups, drill: [] };
  }
  const next = option.active ? groups.filter((group) => group.columnId !== docColumn.key) : [...groups.map((group) => ({ ...group })), { columnId: docColumn.key }];
  // Fora dos botões do tipo: sai do tipo ("Personalizado") levando a população dele, no Detalhado que se vê.
  return { groups: next, mode: REPORT_MODES.DETALHADO, ...(view ? leaveViewPatch(definition, state) : {}) };
}

// ---------------------------------------------------------------------------
// Ocultar / Adicionar coluna
// ---------------------------------------------------------------------------

function typeKeyOfDoc(docColumn) {
  return docColumn.kind === 'pair' ? docColumn.pair?.id : docColumn.key;
}

function hideOption(ctx, docColumn, layout) {
  const { state, definition } = ctx;
  if (layout === HEADER_LAYOUTS.MATRIX || docColumn.kind === 'label') return null;
  if (docColumn.kind === 'data') {
    const columns = state.columns ?? [];
    return { disabled: columns.filter((id) => id !== docColumn.key).length === 0, title: null };
  }
  if (docColumn.kind === 'metric' || docColumn.kind === 'pair') {
    const view = viewOf(ctx);
    const remaining = metricKeysOf(aggregatesOf(ctx), definition.metricPairs ?? []).filter((key) => key !== typeKeyOfDoc(docColumn));
    // No tipo com "Colunas", a última métrica fica (lista vazia = o padrão do tipo).
    const last = typeColumnsOn(ctx, view) && !remaining.length;
    return { disabled: last, title: last ? 'A folha precisa de ao menos uma coluna' : null };
  }
  return null;
}

/** Chaves do seletor "Colunas" do tipo para uma seleção (null fora do tipo com "Colunas"). */
function typeKeys(ctx, selection) {
  const view = viewOf(ctx);
  if (!typeColumnsOn(ctx, view)) return null;
  return { viewId: view.id, keys: columnKeysOf(view, ctx.definition, selection) };
}

function applyHide(ctx, docColumn, option) {
  const { state } = ctx;
  if (option?.disabled) return null;
  if (docColumn.kind === 'data') {
    const columns = (state.columns ?? []).filter((id) => id !== docColumn.key);
    return { patch: { columns }, typeKeys: typeKeys(ctx, { columns }) };
  }
  const drop = new Set(docSpecs(ctx, docColumn).map(aggregateSpecId));
  if (!drop.size) return null;
  // A ordem pela métrica tirada sai; a escolha do tipo vai sem a chave (as métricas extras ficam na tela).
  const aggregates = aggregatesOf(ctx).filter((spec) => !drop.has(aggregateSpecId(spec)));
  return { patch: { aggregates, summarySort: keepSummarySort(state, aggregates) }, typeKeys: typeKeys(ctx, { aggregates }) };
}

/** Totais que o relatório oferece para "Adicionar coluna…" no Resumido fora de um tipo com "Colunas". */
function reportMetricOptions(ctx) {
  const { definition, role } = ctx;
  const current = aggregatesOf(ctx);
  const visible = (spec) => !spec.columnId || (columnOf(definition, spec.columnId) && canSeeColumn(columnOf(definition, spec.columnId), role));
  const has = (spec) => current.some((item) => sameSpec(item, spec));
  const pool = [];
  for (const spec of [...(definition.defaultAggregates ?? []), ...(definition.views ?? []).flatMap((view) => view.aggregates ?? [])]) {
    if (!pool.some((item) => sameSpec(item, spec))) pool.push(clone(spec));
  }
  // Coluna que não está em nenhum total do relatório: a conta padrão dela.
  for (const column of definition.columns ?? []) {
    if (column.metricOnly || !(column.aggregations ?? []).length || pool.some((spec) => spec.columnId === column.id)) continue;
    const op = defaultTotalOp(column) ?? (DATE_TYPES.has(column.type) ? calcOpFor('max', column) : null);
    if (op) pool.push({ op, columnId: column.id });
  }
  const labels = summaryMetricLabels(pool, definition.columns ?? [], { grain: definition.grain, animalColumnId: definition.animalColumnId ?? null, metricLabels: definition.metricLabels ?? null });
  const options = [];
  const paired = new Set();
  for (const pair of definition.metricPairs ?? []) {
    const from = pool.find((spec) => spec.id === pair.from);
    const to = pool.find((spec) => spec.id === pair.to);
    if (!from || !to) continue;
    paired.add(from).add(to);
    if (visible(from) && visible(to) && !(has(from) && has(to))) options.push({ key: pair.id, label: pair.label, specs: [from, to] });
  }
  pool.forEach((spec, index) => {
    if (paired.has(spec) || has(spec) || !visible(spec)) return;
    const id = spec.id && !current.some((item) => aggregateSpecId(item) === spec.id) ? spec.id : `${spec.op}:${spec.columnId ?? '*'}`;
    options.push({ key: id, label: labels[index], specs: [{ ...spec, id }] });
  });
  return options;
}

function addOptions(ctx, docColumn, layout) {
  const { definition, state, role } = ctx;
  if (layout === HEADER_LAYOUTS.MATRIX) return [];
  const view = viewOf(ctx);
  if (docColumn.kind === 'data') {
    const shown = new Set(state.columns ?? []);
    if (typeColumnsOn(ctx, view) && view.mode === REPORT_MODES.DETALHADO) {
      return typeColumnOptions(definition, view, role).filter((option) => !shown.has(option.key)).map((option) => ({ key: option.key, label: option.label }));
    }
    return (definition.columns ?? []).filter((column) => !column.metricOnly && !shown.has(column.id) && canSeeColumn(column, role))
      .map((column) => ({ key: column.id, label: headerLabel(column) }));
  }
  if (typeColumnsOn(ctx, view) && view.mode === REPORT_MODES.RESUMIDO) {
    const current = new Set(columnKeysOf(view, definition, { aggregates: aggregatesOf(ctx) }));
    return typeColumnOptions(definition, view, role).filter((option) => !current.has(option.key)).map((option) => ({ key: option.key, label: option.label }));
  }
  return reportMetricOptions(ctx).map(({ key, label }) => ({ key, label }));
}

function insertAfter(list, index, items) {
  const at = index < 0 ? list.length : index + 1;
  return [...list.slice(0, at), ...items, ...list.slice(at)];
}

function applyAdd(ctx, docColumn, addKey) {
  const { definition, state } = ctx;
  const view = viewOf(ctx);
  if (docColumn.kind === 'data') {
    if (!addOptions(ctx, docColumn, HEADER_LAYOUTS.DETAIL).some((option) => option.key === addKey)) return null;
    const current = state.columns ?? [];
    const columns = insertAfter(current, current.indexOf(docColumn.key), [addKey]);
    return { patch: { columns }, typeKeys: typeKeys(ctx, { columns }) };
  }
  const current = aggregatesOf(ctx);
  let specs;
  if (typeColumnsOn(ctx, view) && view.mode === REPORT_MODES.RESUMIDO) {
    if (!view.columnChoices.available.includes(addKey)) return null;
    const pool = view.aggregates ?? definition.defaultAggregates ?? [];
    const pair = (definition.metricPairs ?? []).find((item) => item.id === addKey);
    specs = (pair ? [pair.from, pair.to] : [addKey]).map((id) => pool.find((spec) => aggregateSpecId(spec) === id)).filter(Boolean).map(clone);
  } else {
    specs = reportMetricOptions(ctx).find((option) => option.key === addKey)?.specs ?? null;
  }
  if (!specs?.length) return null;
  // Depois da coluna clicada (no rótulo, no começo).
  const anchor = docColumn.kind === 'label' ? -1 : Math.max(...docSpecs(ctx, docColumn).map((spec) => current.findIndex((item) => aggregateSpecId(item) === aggregateSpecId(spec))), -1);
  const fresh = specs.filter((spec) => !current.some((item) => sameSpec(item, spec)));
  const aggregates = docColumn.kind === 'label' ? [...fresh, ...current] : insertAfter(current, anchor, fresh);
  return { patch: { aggregates, summarySort: keepSummarySort(state, aggregates) }, typeKeys: typeKeys(ctx, { aggregates }) };
}

// ---------------------------------------------------------------------------
// Menu e aplicação
// ---------------------------------------------------------------------------

/**
 * Menu do título de uma coluna da folha.
 * @param {HeaderContext} ctx
 * @param docColumn coluna do documento (buildReportDocument → doc.columns): { key, kind, label, metric?, pair?, column? }
 * @param {'summary'|'detail'|'matrix'|'vendas'} layout doc.layout
 * @returns {null | { key, label, kind, layout, sort: object[], calc: object|null, group: object|null,
 *   total: object|null, hide: object|null, add: { key, label }[], width: number|null }}
 *   null = a coluna não tem menu (valor do eixo X da matriz)
 */
export function headerMenuOf(ctx, docColumn, layout) {
  if (!docColumn) return null;
  if (layout === HEADER_LAYOUTS.MATRIX && docColumn.kind === 'matrix' && !docColumn.total) return null;
  const menu = {
    key: docColumn.key,
    label: docColumn.label,
    kind: docColumn.kind,
    layout,
    sort: sortOptions(ctx, docColumn, layout),
    // Relatório de venda (Vendas/Abates/Compras): os quadros têm os totais do tipo — nada a calcular aqui.
    calc: layout === HEADER_LAYOUTS.VENDAS ? null : calcOptions(ctx, docColumn, layout),
    group: groupOption(ctx, docColumn, layout),
    total: layout === HEADER_LAYOUTS.VENDAS ? null : totalOption(ctx, docColumn, layout),
    hide: hideOption(ctx, docColumn, layout),
    add: addOptions(ctx, docColumn, layout),
    width: Number.isFinite(Number(ctx.state?.widths?.[docColumn.key])) ? Number(ctx.state.widths[docColumn.key]) : null,
  };
  return menu;
}

/**
 * Escolha no menu → mudança do estado da tela.
 * @param {HeaderContext} ctx
 * @param docColumn a coluna do menu
 * @param {{ type: 'sort'|'calc'|'group'|'total'|'hide'|'add'|'resize'|'resetWidth', layout?: string,
 *   direction?: string, key?: string, op?: string, choice?: string, add?: string, width?: number }} action
 * @returns {null | { patch: object, typeKeys: { viewId: string, keys: string[] }|null }} null = nada muda;
 *   typeKeys = a escolha de "Colunas" do tipo a gravar para o usuário (reportTemplateService.saveTypeColumnPrefs)
 */
export function applyHeaderAction(ctx, docColumn, action) {
  const layout = action.layout ?? HEADER_LAYOUTS.SUMMARY;
  const menu = headerMenuOf(ctx, docColumn, layout);
  const wrap = (patch) => (patch ? { patch, typeKeys: null } : null);
  switch (action.type) {
    case 'sort': {
      const option = menu?.sort.find((item) => item.direction === action.direction && (action.key == null || item.key === action.key));
      return option ? wrap(applySort(ctx, option)) : null;
    }
    case 'calc': {
      const option = menu?.calc?.options.find((item) => item.id === action.choice);
      if (!option || option.disabled) return null;
      return wrap(applyCalc(ctx, docColumn, { ...option, mode: menu.calc.mode }));
    }
    case 'total':
      return menu?.total ? wrap(applyTotal(ctx, docColumn, menu.total)) : null;
    case 'group':
      return menu?.group ? wrap(applyGroup(ctx, docColumn, menu.group)) : null;
    case 'hide':
      return menu?.hide ? applyHide(ctx, docColumn, menu.hide) : null;
    case 'add':
      return menu?.add.some((item) => item.key === action.add) ? applyAdd(ctx, docColumn, action.add) : null;
    case 'resize': {
      const width = clampWidth(action.width);
      if (width === null) return null;
      return wrap({ widths: { ...(ctx.state.widths ?? {}), [docColumn.key]: width } });
    }
    case 'resetWidth': {
      const widths = { ...(ctx.state.widths ?? {}) };
      if (!(docColumn.key in widths)) return null;
      delete widths[docColumn.key];
      return wrap({ widths });
    }
    default:
      return null;
  }
}

/** Vazio = só largura (o menu não tem mais nada a oferecer). */
export function isEmptyHeaderMenu(menu) {
  return !menu || (!menu.sort.length && !menu.calc && !menu.group && !menu.total && !menu.hide && !menu.add.length && menu.width === null);
}
