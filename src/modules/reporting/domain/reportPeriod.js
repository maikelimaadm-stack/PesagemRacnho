// Período do relatório: datas civis YYYY-MM-DD, intervalo fechado [from, to].
// Presets relativos são resolvidos NA EMISSÃO (com `today` injetado) e o intervalo resolvido
// vai para o manifesto: "Últimos 30 dias = 18/08/2026 a 16/09/2026".

export const PERIOD_PRESETS = Object.freeze({
  hoje: 'Hoje',
  ontem: 'Ontem',
  ultimos_7_dias: 'Últimos 7 dias',
  ultimos_30_dias: 'Últimos 30 dias',
  ultimos_90_dias: 'Últimos 90 dias',
  ultimos_365_dias: 'Últimos 365 dias',
  mes_atual: 'Mês atual',
  mes_anterior: 'Mês anterior',
  ano_atual: 'Ano atual',
  personalizado: 'Personalizado',
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function pad(value) { return String(value).padStart(2, '0'); }

function toIso(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseIso(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function isCivilDate(value) {
  return typeof value === 'string' && ISO.test(value) && parseIso(value) !== null;
}

export function addDays(iso, days) {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** Hoje como data civil local (fora dos testes). */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function daysBetween(fromIso, toIsoDate) {
  const from = parseIso(fromIso);
  const to = parseIso(toIsoDate);
  if (!from || !to) return null;
  return Math.round((to - from) / 86400000);
}

/**
 * @param {{ preset?: string, from?: string, to?: string }} period
 * @param {string} today YYYY-MM-DD
 * @returns {{ preset: string, label: string, from: string, to: string, days: number }}
 */
export function resolvePeriod(period, today) {
  if (!isCivilDate(today)) throw new Error('período: data de referência inválida');
  const preset = period?.preset || (period?.from || period?.to ? 'personalizado' : 'ultimos_30_dias');
  if (!PERIOD_PRESETS[preset]) throw new Error(`período: preset desconhecido (${preset})`);
  let from;
  let to = today;
  const [year, month] = today.split('-').map(Number);
  switch (preset) {
    case 'hoje': from = today; break;
    case 'ontem': from = addDays(today, -1); to = from; break;
    case 'ultimos_7_dias': from = addDays(today, -6); break;
    case 'ultimos_30_dias': from = addDays(today, -29); break;
    case 'ultimos_90_dias': from = addDays(today, -89); break;
    case 'ultimos_365_dias': from = addDays(today, -364); break;
    case 'mes_atual': from = `${year}-${pad(month)}-01`; break;
    case 'mes_anterior': {
      const firstOfMonth = `${year}-${pad(month)}-01`;
      to = addDays(firstOfMonth, -1);
      from = `${to.slice(0, 7)}-01`;
      break;
    }
    case 'ano_atual': from = `${year}-01-01`; break;
    default: {
      from = period?.from;
      to = period?.to;
      if (!isCivilDate(from) || !isCivilDate(to)) throw new Error('período personalizado: informe data inicial e final válidas');
      if (from > to) [from, to] = [to, from];
    }
  }
  return { preset, label: PERIOD_PRESETS[preset], from, to, days: daysBetween(from, to) + 1 };
}

export function describePeriod(resolved) {
  const br = (iso) => iso.split('-').reverse().join('/');
  return resolved.preset === 'personalizado'
    ? `${br(resolved.from)} a ${br(resolved.to)}`
    : `${resolved.label} = ${br(resolved.from)} a ${br(resolved.to)}`;
}
