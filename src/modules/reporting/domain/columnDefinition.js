// ColumnDefinition única (docs/reporting/COLUMN-DEFINITION-CONTRACT.md).
// Uma coluna declara: tipo, grãos em que existe, como ler o valor (accessor), como exibir,
// como filtrar, se agrupa, quais agregações fazem sentido e se é sensível. Tela, CSV, JSON,
// impressão, PDF e XLSX leem a MESMA definição — não há formatter paralelo na tela.
import { GRAIN_LIST } from './reportGrain.js';

export const COLUMN_TYPES = Object.freeze([
  'text', 'identifier', 'number', 'integer', 'weight', 'gmd', 'percentage', 'money',
  'date', 'datetime', 'enum', 'boolean', 'entity',
]);

export const SENSITIVITY = Object.freeze({
  COMMERCIAL: 'commercial', // valores (preço, valor, arrobas) → commercial.values
  AUDIT: 'audit', // trilha de auditoria → audit.read
  PERSONAL: 'personal', // dados de usuários → users.manage
});

const NUMERIC_TYPES = new Set(['number', 'integer', 'weight', 'gmd', 'percentage', 'money']);
const DATE_TYPES = new Set(['date', 'datetime']);
const CATEGORICAL_TYPES = new Set(['text', 'identifier', 'enum', 'boolean', 'entity']);

// Agregações matematicamente válidas por tipo. `weightedAvg`, `weightedGmd` e `ratio` exigem
// declaração explícita na coluna (weightedBy / weighted / ratio); sem ela não são oferecidas.
const ALLOWED_BY_TYPE = {
  text: ['count', 'countDistinct'],
  identifier: ['count', 'countDistinct'],
  enum: ['count', 'countDistinct'],
  boolean: ['count', 'countDistinct'],
  entity: ['count', 'countDistinct'],
  number: ['count', 'countValid', 'sum', 'avg', 'min', 'max', 'range', 'weightedAvg', 'ratio'],
  integer: ['count', 'countValid', 'sum', 'avg', 'min', 'max', 'range', 'weightedAvg', 'ratio'],
  weight: ['count', 'countValid', 'sum', 'avg', 'min', 'max', 'range', 'weightedAvg'],
  money: ['count', 'countValid', 'sum', 'avg', 'min', 'max', 'range', 'weightedAvg', 'ratio'],
  percentage: ['count', 'countValid', 'avg', 'min', 'max', 'range', 'weightedAvg', 'ratio'],
  gmd: ['count', 'countValid', 'avg', 'min', 'max', 'range', 'weightedGmd'],
  date: ['count', 'countValid', 'min', 'max'],
  datetime: ['count', 'countValid', 'min', 'max'],
};

export const AGGREGATION_LABELS = Object.freeze({
  count: 'Contagem de registros',
  countValid: 'Contagem de valores',
  countDistinct: 'Distintos',
  sum: 'Soma',
  avg: 'Média simples',
  min: 'Mínimo',
  max: 'Máximo',
  range: 'Amplitude',
  weightedAvg: 'Média ponderada',
  weightedGmd: 'GMD ponderado',
  ratio: 'Razão',
});

export function isNumericType(type) { return NUMERIC_TYPES.has(type); }
export function isDateType(type) { return DATE_TYPES.has(type); }
export function isCategoricalType(type) { return CATEGORICAL_TYPES.has(type); }

/** Tipo de filtro usado pelo filterEngine para o tipo da coluna. */
export function filterTypeOfColumnType(type) {
  if (NUMERIC_TYPES.has(type)) return 'number';
  if (DATE_TYPES.has(type)) return 'date';
  if (type === 'enum') return 'enum';
  if (type === 'boolean') return 'boolean';
  if (type === 'entity') return 'entity';
  return 'text';
}

function defaultAggregations(type) {
  if (type === 'gmd') return ['avg', 'min', 'max'];
  if (type === 'percentage') return ['avg', 'min', 'max'];
  if (NUMERIC_TYPES.has(type)) return ['sum', 'avg', 'min', 'max', 'range'];
  if (DATE_TYPES.has(type)) return ['min', 'max'];
  return ['countDistinct'];
}

/** Agregações permitidas para a coluna, respeitando declarações explícitas. */
export function allowedAggregations(column) {
  const base = ALLOWED_BY_TYPE[column.type] || [];
  return base.filter((op) => {
    if (op === 'weightedAvg') return Boolean(column.weightedBy);
    if (op === 'weightedGmd') return Boolean(column.weighted);
    if (op === 'ratio') return Boolean(column.ratio);
    return true;
  });
}

/**
 * Valida e congela uma definição de coluna. Lança Error com a primeira inconsistência
 * (gate reports:columns:verify cobre os casos negativos).
 */
export function defineColumn(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('coluna: definição ausente');
  const { id, label, type } = spec;
  if (!id || typeof id !== 'string') throw new Error('coluna: id obrigatório');
  if (!label) throw new Error(`coluna ${id}: label obrigatório`);
  if (!COLUMN_TYPES.includes(type)) throw new Error(`coluna ${id}: tipo inválido (${type})`);
  if (!Array.isArray(spec.grains) || spec.grains.length === 0) throw new Error(`coluna ${id}: grains obrigatório`);
  for (const grain of spec.grains) if (!GRAIN_LIST.includes(grain)) throw new Error(`coluna ${id}: grão inválido (${grain})`);
  if (spec.accessor != null && typeof spec.accessor !== 'function') throw new Error(`coluna ${id}: accessor deve ser função`);
  if (spec.display != null && typeof spec.display !== 'function') throw new Error(`coluna ${id}: display deve ser função`);
  if (type === 'entity' && typeof spec.display !== 'function') throw new Error(`coluna ${id}: entidade exige display (nome) além do accessor (id)`);
  if (spec.groupOrder != null && typeof spec.groupOrder !== 'function') throw new Error(`coluna ${id}: groupOrder deve ser função`);
  if (type === 'enum' && !Array.isArray(spec.options)) throw new Error(`coluna ${id}: enum exige options`);
  if (spec.sensitive != null && !Object.values(SENSITIVITY).includes(spec.sensitive)) throw new Error(`coluna ${id}: sensibilidade inválida (${spec.sensitive})`);
  if (spec.weighted && (!spec.weighted.gain || !spec.weighted.days)) throw new Error(`coluna ${id}: weighted exige gain e days`);
  const column = {
    source: 'historico',
    sortable: true,
    filterable: true,
    groupable: false,
    exportable: true,
    defaultVisible: false,
    defaultWidth: 120,
    align: NUMERIC_TYPES.has(type) ? 'right' : 'left',
    sensitive: null,
    unit: null,
    decimals: null,
    ...spec,
  };
  const allowed = allowedAggregations(column);
  const aggregations = spec.aggregations ?? defaultAggregations(type).filter((op) => allowed.includes(op));
  for (const op of aggregations) {
    if (!allowed.includes(op)) throw new Error(`coluna ${id}: agregação ${op} não é válida para o tipo ${type}`);
  }
  if (column.groupable && !CATEGORICAL_TYPES.has(type) && !DATE_TYPES.has(type)) {
    throw new Error(`coluna ${id}: só colunas categóricas ou de data podem agrupar`);
  }
  // E1G: conta padrão da coluna no "Subtotal/Total desta coluna" e no "Adicionar coluna…" (ex.: Dias = média —
  // somar dias de animais diferentes não diz nada). Sem ela, a regra geral (headerActions.defaultTotalOp).
  if (spec.totalOp != null && !aggregations.includes(spec.totalOp)) throw new Error(`coluna ${id}: totalOp ${spec.totalOp} fora das agregações da coluna`);
  column.aggregations = Object.freeze([...aggregations]);
  column.filterType = filterTypeOfColumnType(type);
  column.grains = Object.freeze([...spec.grains]);
  if (column.options) column.options = Object.freeze(column.options.map((option) => Object.freeze(typeof option === 'object' ? { ...option } : { value: option, label: String(option) })));
  return Object.freeze(column);
}

/** Valor bruto da coluna (id para entidade; código para enum; número/data canônicos). */
export function valueOf(column, row) {
  return column.accessor ? column.accessor(row) : row?.[column.id];
}

/** Valor para exibição/pesquisa (nome para entidade, rótulo para enum). */
export function displayOf(column, row) {
  if (column.display) return column.display(row);
  const value = valueOf(column, row);
  if (column.type === 'enum' && column.options) {
    const option = column.options.find((item) => item.value === value);
    return option ? option.label : value;
  }
  return value;
}

/** Chave de agrupamento: id para entidade, valor normalizado para os demais. */
export function groupKeyOf(column, row) {
  if (column.groupKey) return column.groupKey(row);
  const value = valueOf(column, row);
  if (column.type === 'date' || column.type === 'datetime') return value ? String(value).slice(0, 10) : null;
  return value;
}

export function groupLabelOf(column, row) {
  if (column.groupLabel) return column.groupLabel(row);
  return displayOf(column, row);
}

/** Chave de ORDEM do grupo quando o rótulo não ordena (ex.: Sessão "dd/mm/aaaa · status" → data ISO). */
export function groupOrderOf(column, row) {
  return column.groupOrder ? column.groupOrder(row) ?? null : null;
}

export function indexColumns(columns) {
  const map = new Map();
  for (const column of columns) {
    if (map.has(column.id)) throw new Error(`coluna duplicada: ${column.id}`);
    map.set(column.id, column);
  }
  return map;
}
