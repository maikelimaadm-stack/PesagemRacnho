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
    status: 'available',
    ...spec,
    columns: Object.freeze([...columns]),
    sensitivities: Object.freeze(sensitivities),
  });
}
