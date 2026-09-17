// Motor de filtros compartilhado (docs/reporting/FILTER-CONTRACT.md).
// Extraído de matchesMakColumnFilter (Relação de Pesagens) e corrigido:
// - `values` (múltipla escolha) respeita o operador: in (padrão) / not_in (também
//   not_equals e not_contains com lista);
// - texto comparado sem distinção de acento e caixa (igual à pesquisa);
// - número aceita vírgula decimal em todos os operadores, inclusive "contém";
// - tipos enum, boolean e entity (entidade compara o ID, nunca o nome);
// - datas civis YYYY-MM-DD comparadas como texto (sem fuso), com between/not_between;
// - filtros são objetos serializáveis { operator, value, valueTo, values, match? };
//   match: 'label' (enum/entidade) compara o rótulo exibido — é o que a tela e os modelos salvos
//   guardam; sem match, compara o código/id.
// Função pura: o mesmo filtro produz a mesma população na tela, no relatório e na exportação.

export const FILTER_OPERATORS = Object.freeze({
  text: ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'in', 'not_in', 'empty', 'not_empty'],
  number: ['contains', 'equals', 'not_equals', 'greater', 'greater_equal', 'less', 'less_equal', 'between', 'not_between', 'in', 'not_in', 'empty', 'not_empty'],
  date: ['contains', 'equals', 'not_equals', 'before', 'after', 'on_or_before', 'on_or_after', 'between', 'not_between', 'in', 'not_in', 'empty', 'not_empty'],
  enum: ['in', 'not_in', 'equals', 'not_equals', 'empty', 'not_empty'],
  boolean: ['equals', 'empty', 'not_empty'],
  entity: ['in', 'not_in', 'equals', 'not_equals', 'empty', 'not_empty'],
});

export const FILTER_TYPES = Object.freeze(Object.keys(FILTER_OPERATORS));

/** Rótulos dos operadores para pessoas (tela, impressão, XLSX): nunca o código cru. */
export const OPERATOR_LABELS = Object.freeze({
  contains: 'contém', not_contains: 'não contém', equals: '=', not_equals: '≠', starts_with: 'começa com', ends_with: 'termina com',
  greater: '>', greater_equal: '≥', less: '<', less_equal: '≤', between: 'entre', not_between: 'fora de', in: 'em', not_in: 'fora de',
  empty: 'vazio', not_empty: 'preenchido', before: 'antes de', after: 'depois de', on_or_before: 'até', on_or_after: 'a partir de',
});

/** Texto legível de um filtro; códigos de enum viram rótulos pelas opções da coluna. */
export function describeFilter(filter, column = null) {
  if (!filter || typeof filter !== 'object') return String(filter ?? '');
  const optionLabel = (value) => {
    if (filter.match === 'label' || !Array.isArray(column?.options)) return value;
    const option = column.options.find((item) => String(item.value ?? item.id) === String(value));
    return option ? option.label : value;
  };
  const op = OPERATOR_LABELS[filter.operator];
  if (filter.values?.length) return `${op ?? 'em'} ${filter.values.map(optionLabel).join(', ')}`;
  if (['empty', 'not_empty'].includes(filter.operator)) return op;
  if (typeof filter.value === 'boolean') return filter.value ? 'sim' : 'não';
  if (filter.valueTo !== undefined && filter.valueTo !== null && filter.valueTo !== '') return `${op ?? ''} ${filter.value} e ${filter.valueTo}`.trim();
  return `${op ?? ''} ${optionLabel(filter.value)}`.trim();
}

const NEGATIVE_LIST_OPERATORS = new Set(['not_in', 'not_equals', 'not_contains']);

export function defaultOperatorFor(filterType) {
  if (filterType === 'text') return 'contains';
  if (filterType === 'number') return 'between';
  if (filterType === 'date') return 'equals';
  if (filterType === 'boolean') return 'equals';
  return 'in';
}

/** Texto comparável: sem acento, minúsculo, espaços colapsados. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericText(value) {
  const number = toNumber(value);
  return number === null ? String(value ?? '').trim().replace(',', '.') : String(number);
}

function civilDate(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return text.slice(0, 10);
}

function isEmptyValue(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** Normaliza o filtro para o formato serializável (aceita string pura = operador padrão). */
export function normalizeFilter(filter, filterType = 'text') {
  if (filter && typeof filter === 'object') {
    return {
      operator: filter.operator || defaultOperatorFor(filterType),
      value: filter.value ?? '',
      valueTo: filter.valueTo ?? '',
      values: Array.isArray(filter.values) ? filter.values.map((item) => (item === null || item === undefined ? '' : String(item))) : [],
      ...(filter.match === 'label' ? { match: 'label' } : {}),
    };
  }
  return { operator: defaultOperatorFor(filterType), value: filter == null ? '' : String(filter), valueTo: '', values: [] };
}

export function isFilterActive(filter) {
  if (filter && typeof filter === 'object') {
    if (['empty', 'not_empty'].includes(filter.operator)) return true;
    if (Array.isArray(filter.values) && filter.values.length > 0) return true;
    if (typeof filter.value === 'boolean') return true;
    return String(filter.value ?? '').trim() !== '';
  }
  return String(filter ?? '').trim() !== '';
}

function comparableForList(value, filterType) {
  if (filterType === 'number') return numericText(value);
  if (filterType === 'date') return civilDate(value);
  if (filterType === 'entity' || filterType === 'enum' || filterType === 'boolean') return String(value ?? '');
  return normalizeText(value);
}

/**
 * Casa um valor bruto com um filtro. `rawValue` é o valor canônico da coluna
 * (id para entidade, número para numéricos, YYYY-MM-DD para datas).
 */
export function matchesFilter(rawValue, filter, filterType = 'text') {
  if (!isFilterActive(filter)) return true;
  if (!FILTER_TYPES.includes(filterType)) throw new Error(`filtro: tipo desconhecido (${filterType})`);
  const normalized = normalizeFilter(filter, filterType);
  const { operator } = normalized;
  const empty = isEmptyValue(rawValue);
  if (operator === 'empty') return empty;
  if (operator === 'not_empty') return !empty;

  // Lista (múltipla escolha) — respeita o operador.
  if (normalized.values.length > 0 || operator === 'in' || operator === 'not_in') {
    const list = new Set(normalized.values.map((item) => comparableForList(item, filterType)));
    const found = !empty && list.has(comparableForList(rawValue, filterType));
    return NEGATIVE_LIST_OPERATORS.has(operator) ? !found : found;
  }

  if (filterType === 'boolean') {
    const expected = normalized.value === true || ['true', 'sim', '1'].includes(normalizeText(normalized.value));
    if (empty) return false;
    const actual = rawValue === true || ['true', 'sim', '1'].includes(normalizeText(rawValue));
    return actual === expected;
  }

  if (filterType === 'entity' || filterType === 'enum') {
    const actual = empty ? '' : String(rawValue);
    const expected = String(normalized.value);
    if (operator === 'not_equals') return actual !== expected;
    return actual === expected;
  }

  if (filterType === 'number') {
    if (operator === 'contains') {
      if (empty) return false;
      return numericText(rawValue).includes(numericText(normalized.value));
    }
    const actual = toNumber(rawValue);
    const expected = toNumber(normalized.value);
    if (actual === null || expected === null) return false;
    if (operator === 'greater') return actual > expected;
    if (operator === 'greater_equal') return actual >= expected;
    if (operator === 'less') return actual < expected;
    if (operator === 'less_equal') return actual <= expected;
    if (operator === 'between' || operator === 'not_between') {
      const expectedTo = toNumber(normalized.valueTo);
      if (expectedTo === null) return false;
      const inside = actual >= Math.min(expected, expectedTo) && actual <= Math.max(expected, expectedTo);
      return operator === 'not_between' ? !inside : inside;
    }
    if (operator === 'not_equals') return actual !== expected;
    return actual === expected;
  }

  if (filterType === 'date') {
    const actual = civilDate(rawValue);
    const expected = civilDate(normalized.value);
    if (!actual || !expected) return false;
    if (operator === 'contains') return actual.includes(String(normalized.value).trim());
    if (operator === 'before') return actual < expected;
    if (operator === 'after') return actual > expected;
    if (operator === 'on_or_before') return actual <= expected;
    if (operator === 'on_or_after') return actual >= expected;
    if (operator === 'between' || operator === 'not_between') {
      const expectedTo = civilDate(normalized.valueTo);
      if (!expectedTo) return false;
      const [from, to] = [expected, expectedTo].sort();
      const inside = actual >= from && actual <= to;
      return operator === 'not_between' ? !inside : inside;
    }
    if (operator === 'not_equals') return actual !== expected;
    return actual === expected;
  }

  // Texto: sem acento e sem caixa.
  const actual = normalizeText(rawValue);
  const expected = normalizeText(normalized.value);
  if (operator === 'not_contains') return !actual.includes(expected);
  if (operator === 'equals') return actual === expected;
  if (operator === 'not_equals') return actual !== expected;
  if (operator === 'starts_with') return actual.startsWith(expected);
  if (operator === 'ends_with') return actual.endsWith(expected);
  return actual.includes(expected);
}

const TEXT_ONLY_OPERATORS = new Set(['contains', 'not_contains', 'starts_with', 'ends_with']);

/**
 * Enum/entidade filtrados por um controle de texto (pílula da Relação): "contém" casa com o
 * código OU com o rótulo exibido; listas e igualdade continuam pelo código/id.
 */
export function matchesAccessor(row, filter, accessor) {
  return compileAccessorFilter(filter, accessor)(row);
}

function compileAccessorFilter(filter, accessor) {
  const type = accessor.filterType;
  const byLabel = (type === 'enum' || type === 'entity') && filter && typeof filter === 'object' && filter.match === 'label';
  const normalized = normalizeFilter(filter, type);
  const { operator } = normalized;
  // Lista: o Set é montado uma vez por filtro, não por linha.
  if (operator !== 'empty' && operator !== 'not_empty' && (normalized.values.length > 0 || operator === 'in' || operator === 'not_in')) {
    const listType = byLabel ? 'text' : type;
    const list = new Set(normalized.values.map((item) => comparableForList(item, listType)));
    const negative = NEGATIVE_LIST_OPERATORS.has(operator);
    const read = byLabel ? (row) => accessor.displayOf(row) : (row) => accessor.filterValueOf(row);
    return (row) => {
      const raw = read(row);
      const found = !isEmptyValue(raw) && list.has(comparableForList(raw, listType));
      return negative ? !found : found;
    };
  }
  if (byLabel) return (row) => matchesFilter(accessor.displayOf(row), filter, 'text');
  return (row) => matchesAccessorSlow(row, filter, accessor);
}

function matchesAccessorSlow(row, filter, accessor) {
  const raw = accessor.filterValueOf(row);
  const type = accessor.filterType;
  if ((type === 'enum' || type === 'entity') && filter && typeof filter === 'object' && TEXT_ONLY_OPERATORS.has(filter.operator) && !(filter.values?.length)) {
    const negative = filter.operator === 'not_contains';
    const positive = { ...filter, operator: negative ? 'contains' : filter.operator };
    const hit = matchesFilter(raw, positive, 'text') || matchesFilter(accessor.displayOf(row), positive, 'text');
    return negative ? !hit : hit;
  }
  return matchesFilter(raw, filter, type);
}

/**
 * Aplica pesquisa + filtros de coluna (AND entre colunas) sobre uma população.
 * @param rows linhas canônicas
 * @param {{ search?: string, searchColumnIds?: string[], filters?: Record<string, object> }} criteria
 * @param {(columnId: string) => { valueOf: Function, filterValueOf?: Function, displayOf: Function, filterType: string } | null} resolve
 */
export function applyFilters(rows, criteria = {}, resolve) {
  const activeFilters = Object.entries(criteria.filters || {})
    .filter(([, filter]) => isFilterActive(filter))
    .map(([columnId, filter]) => {
      const accessor = resolve(columnId);
      if (!accessor) throw new Error(`filtro: coluna desconhecida (${columnId})`);
      return compileAccessorFilter(filter, accessor);
    });
  const term = normalizeText(criteria.search);
  const searchAccessors = term ? (criteria.searchColumnIds || []).map((columnId) => resolve(columnId)).filter(Boolean) : [];
  if (!activeFilters.length && !term) return rows;
  return rows.filter((row) => {
    if (term) {
      const haystack = normalizeText(searchAccessors.map((accessor) => accessor.displayOf(row) ?? '').join(' '));
      if (!haystack.includes(term)) return false;
    }
    for (const predicate of activeFilters) {
      if (!predicate(row)) return false;
    }
    return true;
  });
}

/** Remove filtros inativos e valida tipos: forma estável para modelos salvos. */
export function serializeFilters(filters = {}) {
  const out = {};
  for (const [columnId, filter] of Object.entries(filters)) {
    if (!isFilterActive(filter)) continue;
    const source = typeof filter === 'object' ? filter : { value: filter };
    out[columnId] = {
      operator: source.operator ?? null,
      value: source.value ?? '',
      valueTo: source.valueTo ?? '',
      values: Array.isArray(source.values) ? source.values.map((item) => (item === null || item === undefined ? '' : String(item))) : [],
      ...(source.match === 'label' ? { match: 'label' } : {}),
    };
  }
  return out;
}
