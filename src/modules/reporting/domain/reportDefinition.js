// ReportDefinition (docs/reporting/REPORT-DEFINITION-CONTRACT.md). Modelo 1 = definição em código.
// A definição fixa: grão, fonte, colunas permitidas (todas do grão), padrões de colunas,
// ordenação, agrupamento e totais, parâmetros e permissões genéricas. Modelos salvos só
// escolhem dentro do que a definição permite.
import { GRAINS, assertGrain, columnSupportsGrain, grainHasAnimal } from './reportGrain.js';
import { allowedAggregations, groupKeyOf, groupLabelOf, displayOf, indexColumns, valueOf } from './columnDefinition.js';
import { sortTypeOfColumnType } from './sortEngine.js';
import { MAX_GROUP_LEVELS } from './groupEngine.js';

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
    };
    cache.set(columnId, accessor);
    return accessor;
  };
}

function assertIds(ids, byId, context) {
  for (const id of ids || []) if (!byId.has(id)) throw new Error(`${context}: coluna desconhecida (${id})`);
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
  for (const aggregate of spec.defaultAggregates || []) {
    if (aggregate.op === 'count' && !aggregate.columnId) continue;
    assertIds([aggregate.columnId], byId, `${context} defaultAggregates`);
    const column = byId.get(aggregate.columnId);
    if (aggregate.op !== 'count' && !allowedAggregations(column).includes(aggregate.op)) {
      throw new Error(`${context}: agregação ${aggregate.op} inválida para ${column.id} (${column.type})`);
    }
    if (aggregate.op === 'countDistinct' && aggregate.columnId === 'animal' && !grainHasAnimal(spec.grain)) {
      throw new Error(`${context}: animais únicos só em grãos com animal`);
    }
  }
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
  });
}
