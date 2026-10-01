// M1 (1.5.0) — GMD por regressão (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §2). Função pura, sem Dexie e sem React.
// Interface CONGELADA pelo integrador (os relatórios e a ficha consomem); a implementação é do agente do domínio.
//
// Inclinação de peso × dia por mínimos quadrados PONDERADOS por recência, na janela dos últimos 120 dias:
//   w = exp(−idadeEmDias / tauDias)            (tau 60 → meia-vida ≈ 42 dias)
//   b = Σ w·(d − d̄w)·(p − p̄w) / Σ w·(d − d̄w)²   (d̄w, p̄w = médias ponderadas de dia e peso)
// Com 2 pontos é a reta pelos 2 pontos (a conta simples). É uma COLUNA OPCIONAL ("GMD (regressão)"): o GMD entre
// pesagens consecutivas continua sendo o padrão da folha.
import { GMD_DIAS_MINIMOS_PADRAO, GMD_QUALIDADE, classifyGmd } from './gmdQuality.js';

export const REGRESSAO_JANELA_DIAS = 120;
export const REGRESSAO_TAU_DIAS = 60;
/** Mínimo de dias cobertos para haver GMD por regressão (abaixo disso: SEM_GMD). */
export const REGRESSAO_DIAS_COBERTOS_MINIMO = 14;
/** Piso do erro padrão (kg/dia) — a previsão da M3 usa; aqui só é calculado. */
export const REGRESSAO_ERRO_PADRAO_PISO = 0.08;

const DAY_MS = 86_400_000;
const dayOf = (value) => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
};
const round = (value, digits) => Number(value.toFixed(digits));

/**
 * @param {{ data: string, peso: number }[]} points pesagens já limpas (só as úteis), em qualquer ordem
 * @param {{ janelaDias?: number, tauDias?: number, hoje?: string, diasMinimos?: number }} [options]
 *   hoje: 'YYYY-MM-DD' de referência da janela e das idades (padrão: a data mais recente dos pontos);
 *   diasMinimos: gmd_dias_minimos (qualidade pelos dias cobertos; padrão 21)
 * @returns {{ gmd: number|null, n: number, diasCobertos: number, erroPadrao: number|null, qualidade: string }}
 *   gmd null e qualidade SEM_GMD com menos de 2 pontos na janela ou menos de 14 dias cobertos.
 */
export function computeWeightedGmd(points, { janelaDias = REGRESSAO_JANELA_DIAS, tauDias = REGRESSAO_TAU_DIAS, hoje, diasMinimos = GMD_DIAS_MINIMOS_PADRAO } = {}) {
  const clean = (Array.isArray(points) ? points : [])
    .map((point) => ({ d: dayOf(point?.data), p: Number(point?.peso) }))
    .filter((point) => point.d !== null && Number.isFinite(point.p) && point.p > 0);
  const ref = hoje ? dayOf(hoje) : (clean.length ? Math.max(...clean.map((point) => point.d)) : null);
  const inWindow = ref === null ? [] : clean.filter((point) => point.d <= ref && ref - point.d <= janelaDias);
  const n = inWindow.length;
  const days = inWindow.map((point) => point.d);
  const diasCobertos = n ? Math.max(...days) - Math.min(...days) : 0;
  if (n < 2 || diasCobertos < REGRESSAO_DIAS_COBERTOS_MINIMO) {
    return { gmd: null, n, diasCobertos, erroPadrao: null, qualidade: GMD_QUALIDADE.SEM_GMD };
  }
  // Pesos por recência, normalizados para somar n (a variância residual fica na escala dos dados).
  const raw = inWindow.map((point) => Math.exp(-(ref - point.d) / tauDias));
  const scale = n / raw.reduce((sum, w) => sum + w, 0);
  const w = raw.map((value) => value * scale);
  const sumW = w.reduce((sum, value) => sum + value, 0);
  const dBar = inWindow.reduce((sum, point, i) => sum + w[i] * point.d, 0) / sumW;
  const pBar = inWindow.reduce((sum, point, i) => sum + w[i] * point.p, 0) / sumW;
  let sxx = 0;
  let sxy = 0;
  inWindow.forEach((point, i) => {
    sxx += w[i] * (point.d - dBar) ** 2;
    sxy += w[i] * (point.d - dBar) * (point.p - pBar);
  });
  if (!(sxx > 0)) return { gmd: null, n, diasCobertos, erroPadrao: null, qualidade: GMD_QUALIDADE.SEM_GMD };
  const slope = sxy / sxx;
  const intercept = pBar - slope * dBar;
  let erroPadrao = REGRESSAO_ERRO_PADRAO_PISO;
  if (n > 2) {
    const residual = inWindow.reduce((sum, point, i) => sum + w[i] * (point.p - (intercept + slope * point.d)) ** 2, 0);
    erroPadrao = Math.max(REGRESSAO_ERRO_PADRAO_PISO, Math.sqrt(residual / (n - 2) / sxx));
  }
  const gmd = round(slope, 3);
  const { gmdQualidade } = classifyGmd({ dias: diasCobertos, gmd }, diasMinimos);
  return { gmd, n, diasCobertos, erroPadrao: round(erroPadrao, 3), qualidade: gmdQualidade };
}
