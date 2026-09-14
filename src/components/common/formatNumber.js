const PT_BR = 'pt-BR';

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string'
    ? Number(value.trim().replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'))
    : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fmtNum(value, decimals) {
  const num = asFiniteNumber(value);
  if (num === null) return '-';

  if (decimals === undefined) {
    if (Number.isInteger(num)) return num.toLocaleString(PT_BR, { maximumFractionDigits: 0 });
    return num.toLocaleString(PT_BR, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return num.toLocaleString(PT_BR, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtInt(value) {
  const num = asFiniteNumber(value);
  return num === null ? '-' : Math.trunc(num).toLocaleString(PT_BR, { maximumFractionDigits: 0 });
}

export function fmtDecimal(value, decimals = 2) {
  return fmtNum(value, decimals);
}

export function fmtCurrency(value) {
  const num = asFiniteNumber(value);
  return num === null
    ? '-'
    : num.toLocaleString(PT_BR, {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

export function fmtDateBR(value, fallback = '--/--/----') {
  if (!value) return fallback;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? fallback
      : value.toLocaleDateString(PT_BR, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const source = String(value).trim();
  const br = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[1].padStart(2, '0')}/${br[2].padStart(2, '0')}/${br[3]}`;

  const iso = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;

  const date = new Date(source);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleDateString(PT_BR, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTimeBR(value, fallback = '--/--/---- --:--') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleString(PT_BR, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
}
