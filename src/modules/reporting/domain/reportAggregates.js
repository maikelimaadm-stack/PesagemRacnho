// Liga as especificações de total/subtotal de um relatório às colunas e ao motor canônico.
// Especificação serializável: { id?, columnId, op }. `op` precisa estar em column.aggregations
// (ou ser 'count', sempre permitido). Nenhuma conta é feita aqui além de escolher o accessor.
import {
  count, countDistinct, countValid, max as maxOf, min as minOf, ratio, range as rangeOf, sum, avg, weightedAvg,
} from './aggregateEngine.js';

function readerFor(spec, row) {
  if (typeof spec === 'function') return spec(row);
  return row?.[spec];
}

function dateExtreme(rows, accessor, pick) {
  let best = null;
  let valid = 0;
  for (const row of rows) {
    const raw = accessor(row);
    if (raw === null || raw === undefined || String(raw).trim() === '') continue;
    const value = String(raw).slice(0, 19);
    valid += 1;
    if (best === null || (pick === 'min' ? value < best : value > best)) best = value;
  }
  return { value: best, n_validos: valid, n_ausentes: rows.length - valid, n_total: rows.length };
}

export function aggregateSpecId(spec) {
  return spec.id ?? `${spec.op}:${spec.columnId ?? '*'}`;
}

/** Valida uma especificação contra a coluna; lança Error com mensagem clara. */
export function assertAggregateSpec(spec, resolve) {
  if (!spec?.op) throw new Error('agregação: op obrigatório');
  if (spec.op === 'count' && !spec.columnId) return null;
  const accessor = resolve(spec.columnId);
  if (!accessor) throw new Error(`agregação: coluna desconhecida (${spec.columnId})`);
  if (spec.op !== 'count' && !accessor.column.aggregations.includes(spec.op)) {
    throw new Error(`agregação: ${spec.op} não é permitida na coluna ${spec.columnId} (${accessor.column.type})`);
  }
  return accessor;
}

export function computeAggregate(rows, spec, resolve) {
  const accessor = assertAggregateSpec(spec, resolve);
  const column = accessor?.column;
  const valueOf = accessor ? (row) => accessor.valueOf(row) : null;
  switch (spec.op) {
    case 'count': return count(rows);
    case 'countValid': return countValid(rows, valueOf);
    case 'countDistinct': return countDistinct(rows, (row) => accessor.groupKeyOf(row));
    case 'sum': return sum(rows, valueOf);
    case 'avg': return avg(rows, valueOf);
    case 'min': return column.type === 'date' || column.type === 'datetime' ? dateExtreme(rows, valueOf, 'min') : minOf(rows, valueOf);
    case 'max': return column.type === 'date' || column.type === 'datetime' ? dateExtreme(rows, valueOf, 'max') : maxOf(rows, valueOf);
    case 'range': return rangeOf(rows, valueOf);
    case 'weightedAvg': return weightedAvg(rows, { value: valueOf, weight: (row) => readerFor(column.weightedBy, row) });
    case 'weightedGmd': return ratio(rows, { numerator: (row) => readerFor(column.weighted.gain, row), denominator: (row) => readerFor(column.weighted.days, row) });
    case 'ratio': return ratio(rows, { numerator: (row) => readerFor(column.ratio.numerator, row), denominator: (row) => readerFor(column.ratio.denominator, row) });
    default: throw new Error(`agregação: operação desconhecida (${spec.op})`);
  }
}

/** { [specId]: resultado } para uma população. */
export function computeAggregates(rows, specs = [], resolve) {
  const out = {};
  for (const spec of specs) out[aggregateSpecId(spec)] = { ...computeAggregate(rows, spec, resolve), op: spec.op, columnId: spec.columnId ?? null };
  return out;
}
