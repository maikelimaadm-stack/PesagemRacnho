// Ordenação compartilhada (docs/reporting/ARCHITECTURE.md §sort).
// - estável e multi-chave: [{ columnId, direction: 'asc'|'desc' }];
// - ausentes (null/''/NaN) SEMPRE por último, nas duas direções (nunca viram 0 nem 01/01/1970);
// - números comparados como números; datas civis como texto YYYY-MM-DD;
// - texto com collator pt-BR (sem distinção de acento/caixa, numérico: "2" < "10").

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedFor(value, sortType) {
  if (sortType === 'number') return toNumber(value);
  if (value === null || value === undefined) return null;
  if (sortType === 'date') {
    const text = String(value).trim();
    return text ? text.slice(0, 19) : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** Compara dois valores já normalizados; ausentes tratados pelo chamador. */
function compareNormalized(left, right, sortType) {
  if (sortType === 'number' || typeof left === 'number') return left - right;
  if (sortType === 'date') return left < right ? -1 : left > right ? 1 : 0;
  return collator.compare(String(left), String(right));
}

export function compareValues(left, right, sortType = 'text', direction = 'asc') {
  const a = normalizedFor(left, sortType);
  const b = normalizedFor(right, sortType);
  if (a === null && b === null) return 0;
  if (a === null) return 1; // ausente por último, independente da direção
  if (b === null) return -1;
  const result = compareNormalized(a, b, sortType);
  return direction === 'desc' ? -result : result;
}

/**
 * Ordena uma cópia das linhas.
 * @param rows linhas
 * @param sorts [{ columnId, direction }]
 * @param resolve (columnId) => { sortValueOf(row), sortType }
 */
export function sortRows(rows, sorts = [], resolve) {
  const keys = (sorts || []).filter((sort) => sort?.columnId).map((sort) => {
    const accessor = resolve(sort.columnId);
    if (!accessor) throw new Error(`ordenação: coluna desconhecida (${sort.columnId})`);
    return { accessor, direction: sort.direction === 'desc' ? 'desc' : 'asc' };
  });
  if (!keys.length) return [...rows];
  // Pré-calcula as chaves (evita chamar accessors O(n log n) vezes) e ordena por índice (estável).
  const decorated = rows.map((row, index) => ({ row, index, values: keys.map((key) => key.accessor.sortValueOf(row)) }));
  decorated.sort((left, right) => {
    for (let i = 0; i < keys.length; i += 1) {
      const result = compareValues(left.values[i], right.values[i], keys[i].accessor.sortType, keys[i].direction);
      if (result !== 0) return result;
    }
    return left.index - right.index;
  });
  return decorated.map((item) => item.row);
}

export function sortTypeOfColumnType(type) {
  if (['number', 'integer', 'weight', 'gmd', 'percentage', 'money'].includes(type)) return 'number';
  if (type === 'date' || type === 'datetime') return 'date';
  return 'text';
}
