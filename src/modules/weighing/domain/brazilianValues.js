const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseBrazilianNumber(value, { integer = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value)
    ? (integer ? Math.trunc(value) : value)
    : null;

  let text = String(value).trim().replace(/\s+/g, '');
  if (!text) return null;
  if (!/^[+-]?[\d.,]+$/.test(text)) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    text = text.replace(thousands, '').replace(decimal, '.');
  } else if (lastComma >= 0) {
    const parts = text.split(',');
    text = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else if (lastDot >= 0) {
    const parts = text.split('.');
    // Um único ponto seguido de 1–2 casas é decimal. Demais pontos são milhar.
    text = parts.length === 2 && parts[1].length <= 2
      ? text
      : parts.join('');
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return integer ? Math.trunc(parsed) : parsed;
}

function validDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseCivilDate(value) {
  if (!value) return null;
  const text = String(value).trim().slice(0, 10);
  let year;
  let month;
  let day;
  let match = text.match(ISO_DATE);
  if (match) {
    [, year, month, day] = match.map(Number);
  } else {
    match = text.match(BR_DATE);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }
  return validDateParts(year, month, day)
    ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;
}

export function isFutureCivilDate(value, today = new Date()) {
  const iso = parseCivilDate(value);
  if (!iso) return false;
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return iso > todayIso;
}

