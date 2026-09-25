// ReportDefinition (docs/reporting/REPORT-DEFINITION-CONTRACT.md). Modelo 1 = definição em código.
// A definição fixa: grão, fonte, colunas permitidas (todas do grão), padrões de colunas,
// ordenação, agrupamento e totais, parâmetros e permissões genéricas. Modelos salvos só
// escolhem dentro do que a definição permite.
import { GRAINS, assertGrain, columnSupportsGrain, grainHasAnimal } from './reportGrain.js';
import { allowedAggregations, groupKeyOf, groupLabelOf, groupOrderOf, displayOf, indexColumns, valueOf } from './columnDefinition.js';
import { sortTypeOfColumnType } from './sortEngine.js';
import { MAX_GROUP_LEVELS } from './groupEngine.js';
import { aggregateSpecId } from './reportAggregates.js';
import { SUMMARY_LABEL_SORT, SUMMARY_ROWS_METRIC } from './summaryLayout.js';

export const REPORT_FAMILIES = Object.freeze({
  rebanho: 'Rebanho',
  pesagens: 'Pesagens',
  desempenho: 'Desempenho',
  movimentacao: 'Movimentação',
  saidas: 'Saídas',
  comercial: 'Comercial',
  embarques: 'Embarques',
  controle: 'Controle',
  cadastros: 'Cadastros',
});

export const DATA_CLASSIFICATION = Object.freeze({
  CANONICAL: 'CANÔNICO',
  LEGACY_EVENT: 'COMERCIAL — DADOS LEGADOS/POR EVENTO',
});

// E1 (1.4.0): RESUMIDO = uma linha por grupo com as métricas em colunas; DETALHADO = linhas de
// dados com grupos e subtotais (como até a 1.3.x).
export const REPORT_MODES = Object.freeze({ RESUMIDO: 'RESUMIDO', DETALHADO: 'DETALHADO' });

// Onde o relatório aparece: catálogo de Relatórios, aba Controle da Manutenção, ou em lugar nenhum
// (backlog/bloqueados e cadastros — continuam no código, executáveis por id quando não bloqueados).
export const REPORT_VISIBILITY = Object.freeze({ CATALOG: 'catalog', MAINTENANCE: 'maintenance', HIDDEN: 'hidden' });

export function normalizeReportMode(mode, fallback = REPORT_MODES.DETALHADO) {
  return mode === REPORT_MODES.RESUMIDO || mode === REPORT_MODES.DETALHADO ? mode : fallback;
}

const PARAM_TYPES = new Set(['period', 'integer', 'date', 'ranges']);

/** Accessor único usado por filtro, ordenação, agrupamento e agregação. */
export function createColumnResolver(columns) {
  const byId = indexColumns(columns);
  const cache = new Map();
  return (columnId) => {
    if (cache.has(columnId)) return cache.get(columnId);
    const column = byId.get(columnId);
    if (!column) return null;
    const accessor = {
      column,
      valueOf: (row) => valueOf(column, row),
      displayOf: (row) => displayOf(column, row),
      filterValueOf: (row) => valueOf(column, row),
      sortValueOf: (row) => (column.type === 'entity' || column.type === 'enum' ? displayOf(column, row) : valueOf(column, row)),
      sortType: column.type === 'entity' || column.type === 'enum' ? 'text' : sortTypeOfColumnType(column.type),
      filterType: column.filterType,
      groupKeyOf: (row) => groupKeyOf(column, row),
      groupLabelOf: (row) => groupLabelOf(column, row),
      groupOrderOf: (row) => groupOrderOf(column, row),
    };
    cache.set(columnId, accessor);
    return accessor;
  };
}

function assertIds(ids, byId, context) {
  for (const id of ids || []) if (!byId.has(id)) throw new Error(`${context}: coluna desconhecida (${id})`);
}

/** Totais de uma lista (padrão da definição ou de uma visão): coluna existe e a operação é permitida. */
function assertAggregateList(aggregates, byId, context, grain) {
  for (const aggregate of aggregates || []) {
    if (!aggregate?.op) throw new Error(`${context}: agregação sem operação`);
    if (aggregate.op === 'count' && !aggregate.columnId) continue;
    assertIds([aggregate.columnId], byId, context);
    const column = byId.get(aggregate.columnId);
    if (aggregate.op !== 'count' && !allowedAggregations(column).includes(aggregate.op)) {
      throw new Error(`${context}: agregação ${aggregate.op} inválida para ${column.id} (${column.type})`);
    }
    if (aggregate.op === 'countDistinct' && aggregate.columnId === 'animal' && !grainHasAnimal(grain)) {
      throw new Error(`${context}: animais únicos só em grãos com animal`);
    }
  }
}

// "Tipo de relatório" (E1B §3): visão nomeada = atalho para agrupamentos/modo/totais da E1. Só
// seleção — nenhuma conta nova. Não entra em LEGACY_REPORT_ALIASES (aliases congelados da E1).
const VIEW_KEYS = new Set(['id', 'label', 'description', 'groups', 'mode', 'aggregates', 'columns', 'sort', 'summarySort', 'filters']);
const DIRECTIONS = new Set(['asc', 'desc']);
const cloneFrozen = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozen));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneFrozen(item)])));
  return value;
};

function defineViews(views, spec, byId, context) {
  if (views == null) return Object.freeze([]);
  if (!Array.isArray(views)) throw new Error(`${context}: views deve ser lista`);
  const seen = new Set();
  return Object.freeze(views.map((view) => {
    if (!view?.id || typeof view.id !== 'string') throw new Error(`${context}: visão sem id`);
    const where = `${context} visão ${view.id}`;
    if (seen.has(view.id)) throw new Error(`${context}: visão duplicada (${view.id})`);
    seen.add(view.id);
    for (const key of Object.keys(view)) if (!VIEW_KEYS.has(key)) throw new Error(`${where}: chave desconhecida (${key})`);
    if (!view.label || typeof view.label !== 'string') throw new Error(`${where}: rótulo obrigatório`);
    if (!Object.values(REPORT_MODES).includes(view.mode)) throw new Error(`${where}: modo inválido (${view.mode})`);
    if (!Array.isArray(view.groups)) throw new Error(`${where}: groups deve ser lista (vazia = sem agrupamento)`);
    if (view.groups.length > MAX_GROUP_LEVELS) throw new Error(`${where}: no máximo ${MAX_GROUP_LEVELS} níveis de agrupamento`);
    for (const group of view.groups) {
      assertIds([group?.columnId], byId, `${where} groups`);
      if (!byId.get(group.columnId).groupable) throw new Error(`${where}: ${group.columnId} não é agrupável`);
      if (group.direction != null && !DIRECTIONS.has(group.direction)) throw new Error(`${where}: direção inválida (${group.direction})`);
    }
    if (new Set(view.groups.map((group) => group.columnId)).size !== view.groups.length) throw new Error(`${where}: coluna repetida no agrupamento`);
    if (view.aggregates != null) {
      if (!Array.isArray(view.aggregates)) throw new Error(`${where}: aggregates deve ser lista`);
      assertAggregateList(view.aggregates, byId, `${where} aggregates`, spec.grain);
      const ids = view.aggregates.map(aggregateSpecId);
      if (new Set(ids).size !== ids.length) throw new Error(`${where}: id de total repetido`);
    }
    if (view.columns != null) {
      if (!Array.isArray(view.columns) || !view.columns.length) throw new Error(`${where}: columns deve ser lista não vazia`);
      assertIds(view.columns, byId, `${where} columns`);
    }
    for (const sort of view.sort || []) {
      assertIds([sort?.columnId], byId, `${where} sort`);
      if (!byId.get(sort.columnId).sortable) throw new Error(`${where}: ${sort.columnId} não é ordenável`);
      if (sort.direction != null && !DIRECTIONS.has(sort.direction)) throw new Error(`${where}: direção inválida (${sort.direction})`);
    }
    if (view.filters != null) assertIds(Object.keys(view.filters), byId, `${where} filters`);
    if (view.summarySort != null) {
      const metricIds = (view.aggregates ?? spec.defaultAggregates ?? []).map(aggregateSpecId);
      const key = view.summarySort?.key;
      if (key !== SUMMARY_LABEL_SORT && key !== SUMMARY_ROWS_METRIC && !metricIds.includes(key)) throw new Error(`${where}: ordem do resumo em métrica desconhecida (${key})`);
      if (view.summarySort.direction != null && !DIRECTIONS.has(view.summarySort.direction)) throw new Error(`${where}: direção inválida (${view.summarySort.direction})`);
    }
    return cloneFrozen(view);
  }));
}

// Rótulos de curral da folha por id de métrica ("Qtd", "Média (@)") e pares "de–até" (Faixa exigida).
function defineMetricLabels(labels, context) {
  if (labels == null) return Object.freeze({});
  if (typeof labels !== 'object' || Array.isArray(labels)) throw new Error(`${context}: metricLabels deve ser objeto { id: rótulo }`);
  for (const [id, label] of Object.entries(labels)) {
    if (typeof label !== 'string' || !label.trim()) throw new Error(`${context}: rótulo vazio para a métrica ${id}`);
  }
  return cloneFrozen(labels);
}

function defineMetricPairs(pairs, spec, views, context) {
  if (pairs == null) return Object.freeze([]);
  if (!Array.isArray(pairs)) throw new Error(`${context}: metricPairs deve ser lista`);
  const known = new Set([...(spec.defaultAggregates || []), ...views.flatMap((view) => view.aggregates || [])].map(aggregateSpecId));
  const seen = new Set();
  for (const pair of pairs) {
    if (!pair?.id || !pair.label) throw new Error(`${context}: par de métricas sem id/rótulo`);
    if (seen.has(pair.id)) throw new Error(`${context}: par de métricas duplicado (${pair.id})`);
    seen.add(pair.id);
    if (!pair.from || !pair.to || pair.from === pair.to) throw new Error(`${context}: par ${pair.id} exige duas métricas diferentes (from/to)`);
    for (const id of [pair.from, pair.to]) if (!known.has(id)) throw new Error(`${context}: par ${pair.id} cita métrica desconhecida (${id})`);
    // leafColumnId: o par só vale quando o último nível de agrupamento é essa coluna (ex.: faixa do lote).
    if (pair.leafColumnId != null && !(spec.columns || []).some((column) => column.id === pair.leafColumnId && column.groupable)) {
      throw new Error(`${context}: par ${pair.id} amarrado a coluna inexistente ou não agrupável (${pair.leafColumnId})`);
    }
  }
  return cloneFrozen(pairs);
}

/**
 * Valida e congela uma definição. Lança Error na primeira inconsistência — inclusive
 * coluna de outro grão (gate reports:grain:verify).
 */
export function defineReport(spec) {
  if (!spec?.id) throw new Error('relatório: id obrigatório');
  const context = `relatório ${spec.id}`;
  if (!spec.title) throw new Error(`${context}: título obrigatório`);
  if (!REPORT_FAMILIES[spec.family]) throw new Error(`${context}: família inválida (${spec.family})`);
  assertGrain(spec.grain, context);
  if (!Number.isInteger(spec.version) || spec.version < 1) throw new Error(`${context}: version inteira ≥ 1`);
  if (!Array.isArray(spec.requires) || !spec.requires.includes('reports.read')) throw new Error(`${context}: requires deve incluir reports.read`);
  if (spec.status !== 'blocked') {
    if (!spec.source) throw new Error(`${context}: source obrigatório`);
    if (!Array.isArray(spec.columns) || spec.columns.length === 0) throw new Error(`${context}: colunas obrigatórias`);
  }
  const columns = spec.columns || [];
  for (const column of columns) {
    if (!columnSupportsGrain(column, spec.grain)) {
      throw new Error(`${context}: coluna ${column.id} não existe no grão ${spec.grain} (declara ${column.grains?.join(', ')})`);
    }
  }
  const byId = indexColumns(columns);
  assertIds(spec.defaultColumns, byId, `${context} defaultColumns`);
  assertIds(spec.searchColumns, byId, `${context} searchColumns`);
  assertIds(Object.keys(spec.defaultFilters || {}), byId, `${context} defaultFilters`);
  if (spec.lockedFilters != null && typeof spec.lockedFilters !== 'function') throw new Error(`${context}: lockedFilters deve ser função (params) => filtros`);
  for (const sort of spec.defaultSort || []) {
    assertIds([sort.columnId], byId, `${context} defaultSort`);
    if (!byId.get(sort.columnId).sortable) throw new Error(`${context}: ${sort.columnId} não é ordenável`);
  }
  const groups = spec.defaultGroups || [];
  if (groups.length > MAX_GROUP_LEVELS) throw new Error(`${context}: no máximo ${MAX_GROUP_LEVELS} níveis de agrupamento`);
  for (const group of groups) {
    assertIds([group.columnId], byId, `${context} defaultGroups`);
    if (!byId.get(group.columnId).groupable) throw new Error(`${context}: ${group.columnId} não é agrupável`);
  }
  assertAggregateList(spec.defaultAggregates, byId, `${context} defaultAggregates`, spec.grain);
  for (const param of spec.params || []) {
    if (!param.id || !PARAM_TYPES.has(param.type)) throw new Error(`${context}: parâmetro inválido (${param.id}/${param.type})`);
  }
  const requiresPeriod = (spec.params || []).some((param) => param.type === 'period' && param.required);
  if ([GRAINS.EVENT, GRAINS.ANIMAL_PERIOD, GRAINS.EXIT].includes(spec.grain) && spec.status !== 'blocked' && !requiresPeriod && !spec.periodExemption) {
    throw new Error(`${context}: grão ${spec.grain} exige período obrigatório (ou periodExemption justificado)`);
  }
  if (spec.defaultMode != null && !Object.values(REPORT_MODES).includes(spec.defaultMode)) throw new Error(`${context}: defaultMode inválido (${spec.defaultMode})`);
  if (spec.visibility != null && !Object.values(REPORT_VISIBILITY).includes(spec.visibility)) throw new Error(`${context}: visibility inválida (${spec.visibility})`);
  // Filtros rápidos: atalhos nomeados ("Somente mortes") que só preenchem filtros de colunas do relatório.
  for (const quick of spec.quickFilters || []) {
    if (!quick?.id || !quick.label || !quick.filters || typeof quick.filters !== 'object') throw new Error(`${context}: filtro rápido inválido`);
    assertIds(Object.keys(quick.filters), byId, `${context} quickFilters.${quick.id}`);
  }
  for (const columnId of spec.quickGroups || []) {
    assertIds([columnId], byId, `${context} quickGroups`);
    if (!byId.get(columnId).groupable) throw new Error(`${context}: ${columnId} não é agrupável (quickGroups)`);
  }
  const views = defineViews(spec.views, spec, byId, context);
  const metricLabels = defineMetricLabels(spec.metricLabels, context);
  const metricPairs = defineMetricPairs(spec.metricPairs, spec, views, context);
  const sensitivities = [...new Set(columns.map((column) => column.sensitive).filter(Boolean))];
  return Object.freeze({
    description: '',
    classification: DATA_CLASSIFICATION.CANONICAL,
    notes: [],
    metrics: [],
    params: [],
    defaultColumns: columns.filter((column) => column.defaultVisible).map((column) => column.id),
    searchColumns: [],
    defaultSort: [],
    defaultGroups: [],
    defaultAggregates: [],
    quickFilters: [],
    quickGroups: [],
    status: 'available',
    ...spec,
    // Resumido por padrão quando o relatório nasce agrupado (E1 §1.1).
    defaultMode: spec.defaultMode ?? ((spec.defaultGroups || []).length > 0 ? REPORT_MODES.RESUMIDO : REPORT_MODES.DETALHADO),
    visibility: spec.visibility ?? (spec.status === 'blocked' ? REPORT_VISIBILITY.HIDDEN : REPORT_VISIBILITY.CATALOG),
    columns: Object.freeze([...columns]),
    sensitivities: Object.freeze(sensitivities),
    // E1B: visões declaradas ("Tipo de relatório"; sem nenhuma, reportViews.listReportViews gera
    // padrão + analítico), rótulos de curral por id de métrica e pares "de–até" da folha.
    views,
    metricLabels,
    metricPairs,
  });
}
