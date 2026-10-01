// M1 (1.5.0) — GMD por regressão (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §2). Função pura, sem Dexie e sem React.
// Interface CONGELADA pelo integrador (os relatórios e a ficha consomem); a implementação é do agente do domínio.
//
// Inclinação de peso × dia por mínimos quadrados PONDERADOS por recência, na janela dos últimos 120 dias:
//   w = exp(−idadeEmDias / tauDias)            (tau 60 → meia-vida ≈ 42 dias; idade contada a partir de `hoje`)
//   b = Σ w·(d − d̄w)·(p − p̄w) / Σ w·(d − d̄w)²   (d̄w, p̄w = médias ponderadas de dia e peso)
//   erro padrão = √( Σ w·r² / (n − 2) / Σ w·(d − d̄w)² ), com piso de 0,08 kg/dia  (r = resíduo da reta ponderada)
// Com 2 pontos é a CONTA SIMPLES (a mesma de calculateWeightGain: ganho com 2 casas ÷ dias, 3 casas) e o erro padrão é o
// piso (não há resíduo para medir). Menos de 2 pontos na janela ou menos de 14 dias cobertos → gmd null, SEM_GMD.
// É uma COLUNA OPCIONAL ("GMD (regressão)"): o GMD entre pesagens consecutivas continua sendo o padrão da folha.
import { GMD_DIAS_MINIMOS_PADRAO, GMD_QUALIDADE, classifyGmd } from './gmdQuality.js';
import { simpleGmd, weightGainKg } from './weighingCalculations.js';

export const REGRESSAO_JANELA_DIAS = 120;
export const REGRESSAO_TAU_DIAS = 60;
/** Mínimo de dias cobertos para haver GMD por regressão (abaixo disso: SEM_GMD). */
export const REGRESSAO_DIAS_COBERTOS_MINIMO = 14;
/** Piso do erro padrão (kg/dia) — a previsão da M3 usa; aqui só é calculado. */
export const REGRESSAO_ERRO_PADRAO_PISO = 0.08;

const DAY_MS = 86_400_000;
// 'YYYY-MM-DD' (ou ISO com hora) → número do dia civil (UTC). Fora do formato ou data impossível (31/02, mês 13) → null.
const dayOf = (value) => {
  const text = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split('-').map(Number);
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return Math.round(time / DAY_MS);
};
// Peso medido: número (ou texto numérico) finito > 0; null, vazio, booleano e 0 não são pesagem.
const weightOf = (value) => {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const positiveOr = (value, fallback) => {
  const number = Number(value);
  return value !== null && value !== '' && Number.isFinite(number) && number > 0 ? number : fallback;
};
// Arredondado sem "-0" (uma reta quase plana não vira "-0,000" na folha).
const round = (value, digits) => {
  const rounded = Number(value.toFixed(digits));
  return rounded === 0 ? 0 : rounded;
};

/**
 * @param {{ data: string, peso: number }[]} points pesagens já limpas (só as úteis), em qualquer ordem
 * @param {{ janelaDias?: number, tauDias?: number, hoje?: string, diasMinimos?: number }} [options]
 *   janelaDias: só pontos com idade 0..janelaDias (padrão 120; inválido → 120); pontos depois de `hoje` ficam fora;
 *   tauDias: constante da ponderação por recência (padrão 60; inválido → 60);
 *   hoje: 'YYYY-MM-DD' de referência da janela e das idades (ausente ou inválido: a data mais recente dos pontos);
 *   diasMinimos: gmd_dias_minimos (qualidade pelos dias cobertos; ausente ou inválido → 21)
 * @returns {{ gmd: number|null, n: number, diasCobertos: number, erroPadrao: number|null, qualidade: string }}
 *   n e diasCobertos contam só os pontos da janela; gmd null e qualidade SEM_GMD com menos de 2 pontos na janela ou
 *   menos de 14 dias cobertos; com GMD, qualidade CONFIAVEL (diasCobertos ≥ diasMinimos) ou NAO_CONFIAVEL.
 */
export function computeWeightedGmd(points, { janelaDias = REGRESSAO_JANELA_DIAS, tauDias = REGRESSAO_TAU_DIAS, hoje, diasMinimos = GMD_DIAS_MINIMOS_PADRAO } = {}) {
  const janela = positiveOr(janelaDias, REGRESSAO_JANELA_DIAS);
  const tau = positiveOr(tauDias, REGRESSAO_TAU_DIAS);
  const clean = (Array.isArray(points) ? points : [])
    .map((point) => ({ d: dayOf(point?.data), p: weightOf(point?.peso) }))
    .filter((point) => point.d !== null && point.p !== null);
  const ref = dayOf(hoje) ?? (clean.length ? Math.max(...clean.map((point) => point.d)) : null);
  const inWindow = ref === null ? [] : clean.filter((point) => point.d <= ref && ref - point.d <= janela);
  const n = inWindow.length;
  const days = inWindow.map((point) => point.d);
  const diasCobertos = n ? Math.max(...days) - Math.min(...days) : 0;
  const semGmd = { gmd: null, n, diasCobertos, erroPadrao: null, qualidade: GMD_QUALIDADE.SEM_GMD };
  if (n < 2 || diasCobertos < REGRESSAO_DIAS_COBERTOS_MINIMO) return semGmd;
  const qualidadeDe = (gmd) => classifyGmd({ dias: diasCobertos, gmd }, diasMinimos).gmdQualidade;

  if (n === 2) {
    // A conta simples, idêntica à de calculateWeightGain (a reta por 2 pontos, sem o arredondamento diferente da
    // fórmula ponderada — que às vezes errava a 3ª casa: 300 → 284,6 kg em 16 dias dava −0,962 em vez de −0,963).
    const [first, last] = inWindow[0].d <= inWindow[1].d ? inWindow : [inWindow[1], inWindow[0]];
    const gmd = simpleGmd(weightGainKg(last.p, first.p), last.d - first.d);
    return { gmd, n, diasCobertos, erroPadrao: REGRESSAO_ERRO_PADRAO_PISO, qualidade: qualidadeDe(gmd) };
  }

  // Pesos por recência. Contados a partir da pesagem mais nova da janela — proporcionais a exp(−idade/tau) a partir
  // de `hoje` (fator constante exp(−(hoje − maisNova)/tau)), o que não muda nem a inclinação nem o erro padrão, e não
  // deixa os pesos sumirem (underflow) quando `hoje` está longe da última pesagem.
  const newest = Math.max(...days);
  const w = inWindow.map((point) => Math.exp(-(newest - point.d) / tau));
  const sumW = w.reduce((sum, value) => sum + value, 0);
  const dBar = inWindow.reduce((sum, point, i) => sum + w[i] * point.d, 0) / sumW;
  const pBar = inWindow.reduce((sum, point, i) => sum + w[i] * point.p, 0) / sumW;
  let sxx = 0;
  let sxy = 0;
  inWindow.forEach((point, i) => {
    sxx += w[i] * (point.d - dBar) ** 2;
    sxy += w[i] * (point.d - dBar) * (point.p - pBar);
  });
  if (!(sxx > 0) || !Number.isFinite(sxy)) return semGmd;
  const slope = sxy / sxx;
  const intercept = pBar - slope * dBar;
  const residual = inWindow.reduce((sum, point, i) => sum + w[i] * (point.p - (intercept + slope * point.d)) ** 2, 0);
  const erroPadrao = Math.max(REGRESSAO_ERRO_PADRAO_PISO, Math.sqrt(residual / (n - 2) / sxx));
  const gmd = round(slope, 3);
  return { gmd, n, diasCobertos, erroPadrao: round(erroPadrao, 3), qualidade: qualidadeDe(gmd) };
}
