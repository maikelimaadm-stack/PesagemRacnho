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

function screenNumber(number, decimals, type) {
  const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  if (type === 'money') return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', ...options });
  const text = number.toLocaleString('pt-BR', options);
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

/** Rótulo do cabeçalho com unidade: "Peso (kg)". */
export function headerLabel(column) {
  return column.unit ? `${column.label} (${column.unit})` : column.label;
}
