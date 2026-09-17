// Motor canônico de agregação (programa reporting — docs/reporting/AGGREGATION-CONTRACT.md).
//
// Semântica obrigatória:
// - null ≠ 0: valor ausente (null, undefined, '', NaN, texto não numérico) é EXCLUÍDO e contado em n_ausentes;
// - sem nenhum valor válido o resultado é null (a tela mostra "—"), nunca 0;
// - count conta REGISTROS; countDistinct conta chaves distintas (animais únicos) e nunca é somado entre grupos;
// - weightedAvg / ratio usam somente pares válidos (as duas pontas presentes);
// - nada é arredondado aqui: arredondar é papel da formatação.
//
// Toda função é pura e opera sobre a população recebida; subtotais e total geral chamam o motor
// de novo sobre a população do grupo / do dataset — nunca somam resultados de filhos.

export const AGGREGATION_OPS = Object.freeze([
  'count', 'countValid', 'countDistinct', 'sum', 'avg', 'min', 'max', 'range', 'weightedAvg', 'ratio',
]);

/** Converte para número finito ou null (aceita "1234,5" e "1234.5"; rejeita vazio e texto). */
export function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readerOf(fieldOrAccessor) {
  if (typeof fieldOrAccessor === 'function') return fieldOrAccessor;
  if (typeof fieldOrAccessor === 'string' && fieldOrAccessor) return (row) => row?.[fieldOrAccessor];
  throw new Error('aggregateEngine: campo ou accessor obrigatório');
}

function isMissingKey(value) {
  return value === null || value === undefined || value === '';
}

function numericValues(rows, fieldOrAccessor) {
  const read = readerOf(fieldOrAccessor);
  const values = [];
  let missing = 0;
  for (const row of rows) {
    const value = toFiniteNumber(read(row));
    if (value === null) missing += 1;
    else values.push(value);
  }
  return { values, missing };
}

function result(value, nValid, nMissing, total, extra = {}) {
  return { value, n_validos: nValid, n_ausentes: nMissing, n_total: total, ...extra };
}

export function count(rows) {
  const total = rows.length;
  return result(total, total, 0, total);
}

export function countValid(rows, field) {
  const { values, missing } = numericValues(rows, field);
  return result(values.length, values.length, missing, rows.length);
}

export function countDistinct(rows, field) {
  const read = readerOf(field);
  const keys = new Set();
  let missing = 0;
  for (const row of rows) {
    const key = read(row);
    if (isMissingKey(key)) missing += 1;
    else keys.add(String(key));
  }
  return result(keys.size, rows.length - missing, missing, rows.length);
}

export function sum(rows, field) {
  const { values, missing } = numericValues(rows, field);
  const value = values.length ? values.reduce((acc, item) => acc + item, 0) : null;
  return result(value, values.length, missing, rows.length);
}

export function avg(rows, field) {
  const { values, missing } = numericValues(rows, field);
  const value = values.length ? values.reduce((acc, item) => acc + item, 0) / values.length : null;
  return result(value, values.length, missing, rows.length);
}

// Laço simples: Math.min(...array) estoura a pilha acima de ~125 mil valores.
function extremes(values) {
  let low = Infinity;
  let high = -Infinity;
  for (const value of values) { if (value < low) low = value; if (value > high) high = value; }
  return values.length ? { low, high } : null;
}

export function min(rows, field) {
  const { values, missing } = numericValues(rows, field);
  return result(extremes(values)?.low ?? null, values.length, missing, rows.length);
}

export function max(rows, field) {
  const { values, missing } = numericValues(rows, field);
  return result(extremes(values)?.high ?? null, values.length, missing, rows.length);
}

export function range(rows, field) {
  const { values, missing } = numericValues(rows, field);
  const bounds = extremes(values);
  return result(bounds ? bounds.high - bounds.low : null, values.length, missing, rows.length);
}

/**
 * Média ponderada Σ(valor × peso) / Σ(peso), somente linhas com valor E peso válidos e peso > 0.
 */
export function weightedAvg(rows, { value: valueField, weight: weightField }) {
  const readValue = readerOf(valueField);
  const readWeight = readerOf(weightField);
  let numerator = 0;
  let denominator = 0;
  let valid = 0;
  for (const row of rows) {
    const value = toFiniteNumber(readValue(row));
    const weight = toFiniteNumber(readWeight(row));
    if (value === null || weight === null || weight <= 0) continue;
    numerator += value * weight;
    denominator += weight;
    valid += 1;
  }
  return result(valid && denominator > 0 ? numerator / denominator : null, valid, rows.length - valid, rows.length);
}

/**
 * Razão Σ(numerador) / Σ(denominador) sobre pares válidos (denominador > 0 por padrão).
 * GMD ponderado = ratio(ganho, dias): Σ ganhos ÷ Σ dias correspondentes.
 */
export function ratio(rows, { numerator: numeratorField, denominator: denominatorField, requirePositiveDenominator = true }) {
  const readNumerator = readerOf(numeratorField);
  const readDenominator = readerOf(denominatorField);
  let numerator = 0;
  let denominator = 0;
  let valid = 0;
  for (const row of rows) {
    const top = toFiniteNumber(readNumerator(row));
    const bottom = toFiniteNumber(readDenominator(row));
    if (top === null || bottom === null) continue;
    if (requirePositiveDenominator ? bottom <= 0 : bottom === 0) continue;
    numerator += top;
    denominator += bottom;
    valid += 1;
  }
  return result(valid && denominator !== 0 ? numerator / denominator : null, valid, rows.length - valid, rows.length, {
    numerator: valid ? numerator : null,
    denominator: valid ? denominator : null,
  });
}

/** GMD ponderado canônico: Σ ganho ÷ Σ dias, só pares válidos com dias > 0. */
export function weightedGmd(rows, { gain = 'ganho', days = 'dias' } = {}) {
  return ratio(rows, { numerator: gain, denominator: days });
}

const OPS = { count, countValid, countDistinct, sum, avg, min, max, range, weightedAvg, ratio };

/**
 * Aplica uma especificação serializável: { op, field } ou { op: 'weightedAvg', value, weight }
 * ou { op: 'ratio', numerator, denominator }. Um accessor (função) pode substituir o campo.
 */
export function aggregate(rows, spec) {
  const population = Array.isArray(rows) ? rows : [];
  const op = spec?.op;
  if (!AGGREGATION_OPS.includes(op)) throw new Error(`aggregateEngine: operação desconhecida (${op})`);
  if (op === 'count') return count(population);
  if (op === 'weightedAvg') return weightedAvg(population, { value: spec.accessor ?? spec.value ?? spec.field, weight: spec.weight });
  if (op === 'ratio') return ratio(population, { numerator: spec.numerator, denominator: spec.denominator, requirePositiveDenominator: spec.requirePositiveDenominator ?? true });
  return OPS[op](population, spec.accessor ?? spec.field);
}

/** Várias agregações sobre a mesma população: { [id]: resultado }. */
export function aggregateAll(rows, specs = []) {
  const out = {};
  for (const spec of specs) out[spec.id ?? `${spec.op}:${spec.field ?? ''}`] = aggregate(rows, spec);
  return out;
}
