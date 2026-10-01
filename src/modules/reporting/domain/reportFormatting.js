// Formatação canônica (docs/reporting/EXPORT-CONTRACT.md §formatos). Uma única função decide
// como cada tipo aparece na tela, na impressão/PDF, no CSV, no XLSX e no JSON. A tela NÃO tem
// formatter próprio: chama formatCell com target 'screen'.
//
// Arredondamento acontece só aqui (apresentação), nunca antes de agregar.

export const DEFAULT_DECIMALS = Object.freeze({
  integer: 0,
  number: 2,
  weight: 2,
  gmd: 3,
  money: 2,
  percentage: 2,
});

export const MISSING_SCREEN = '—';

const BOOLEAN_LABELS = { true: 'Sim', false: 'Não' };

function decimalsFor(column) {
  if (Number.isInteger(column?.decimals)) return column.decimals;
  return DEFAULT_DECIMALS[column?.type] ?? 2;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Arredonda sem o erro binário típico (1.005 → 1.01). */
export function roundTo(value, decimals) {
  const number = toNumber(value);
  if (number === null) return null;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON * Math.sign(number)) * factor) / factor;
}

function civilDateBr(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!iso) return text;
  return { date: `${iso[3]}/${iso[2]}/${iso[1]}`, time: iso[4] ? `${iso[4]}:${iso[5]}` : null };
}

// Revisão E1G: um Intl.NumberFormat por (casas, moeda) em vez de toLocaleString a cada número — o mesmo texto
// (toLocaleString usa o mesmo formatador), ~25× mais rápido; os gráficos formatam milhares de pontos por vez.
const NUMBER_FORMATS = new Map();
function numberFormat(decimals, money) {
  const key = `${decimals}|${money ? 'brl' : ''}`;
  let format = NUMBER_FORMATS.get(key);
  if (!format) {
    const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    format = new Intl.NumberFormat('pt-BR', money ? { style: 'currency', currency: 'BRL', ...options } : options);
    NUMBER_FORMATS.set(key, format);
  }
  return format;
}

function screenNumber(number, decimals, type) {
  if (type === 'money') return numberFormat(decimals, true).format(number);
  const text = numberFormat(decimals, false).format(number);
  return type === 'percentage' ? `${text} %` : text;
}

/**
 * @param column ColumnDefinition (ou { type, decimals, options })
 * @param value valor já lido (valueOf) — para entidade passe o nome (displayOf)
 * @param {'screen'|'print'|'csv'|'xlsx'|'json'} target
 */
export function formatCell(column, value, target = 'screen') {
  const type = column?.type ?? 'text';
  const human = target === 'screen' || target === 'print';
  const missing = value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  if (missing) return target === 'json' || target === 'xlsx' ? null : human ? MISSING_SCREEN : '';

  if (['integer', 'number', 'weight', 'gmd', 'money', 'percentage'].includes(type)) {
    const decimals = decimalsFor(column);
    const rounded = roundTo(value, decimals);
    if (rounded === null) return target === 'json' || target === 'xlsx' ? null : human ? MISSING_SCREEN : '';
    if (target === 'json') return toNumber(value); // JSON leva o valor canônico, sem arredondar
    if (target === 'xlsx') return rounded; // número de verdade na planilha
    if (target === 'csv') return rounded.toFixed(decimals).replace('.', ','); // pt-BR, sem separador de milhar
    return screenNumber(rounded, decimals, type);
  }

  if (type === 'date' || type === 'datetime') {
    if (target === 'json') return String(value);
    const parsed = civilDateBr(value);
    if (typeof parsed === 'string') return parsed;
    return type === 'datetime' && parsed.time ? `${parsed.date} ${parsed.time}` : parsed.date;
  }

  if (type === 'boolean') {
    if (target === 'json') return value === true || value === 'true';
    return BOOLEAN_LABELS[String(value === true || value === 'true')];
  }

  if (type === 'enum' && Array.isArray(column.options)) {
    if (target === 'json') return value;
    const option = column.options.find((item) => item.value === value);
    return option ? option.label : String(value);
  }

  return String(value);
}

/**
 * Rótulo do cabeçalho com unidade: "Peso (kg)". Rótulo que já termina na unidade (E1D, cabeçalho do antigo
 * "Qtd @" na @ viva) não a repete — "Qtd @ (@)" seria ruído.
 */
export function headerLabel(column) {
  if (!column.unit || String(column.label ?? '').endsWith(` ${column.unit}`)) return column.label;
  return `${column.label} (${column.unit})`;
}
