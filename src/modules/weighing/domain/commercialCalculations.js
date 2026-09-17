import { parseBrazilianNumber } from './brazilianValues.js';

// Fórmula canônica de arroba (programa reporting, decisão §8): 1 @ = 15 kg de CARCAÇA.
//   carcaça_kg = peso_vivo_kg × rendimento_% / 100
//   arrobas    = carcaça_kg / 15
// Sem rendimento válido não há carcaça nem arrobas: o resultado é null ("—"), nunca 0 nem 50 %.
export const ARROBA_CARCASS_KG = 15;

export const YIELD_ORIGIN = Object.freeze({
  INFORMADO: 'INFORMADO',
  PADRAO_EMPRESA: 'PADRAO_EMPRESA',
  PADRAO_PARCEIRO: 'PADRAO_PARCEIRO',
});

/** Rendimento em % no intervalo (0, 100]; qualquer outro valor → null. */
export function normalizeCarcassYield(value) {
  const parsed = typeof value === 'number' ? value : parseBrazilianNumber(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return null;
  return parsed;
}

/**
 * Ordem: 1) informado no fato; 2) padrão da empresa explicitamente configurado;
 * 3) padrão do parceiro; 4) ausente ({ yieldPercent: null, origin: null }).
 */
export function resolveCarcassYield({ informed, companyDefault, partnerDefault } = {}) {
  const candidates = [
    [informed, YIELD_ORIGIN.INFORMADO],
    [companyDefault, YIELD_ORIGIN.PADRAO_EMPRESA],
    [partnerDefault, YIELD_ORIGIN.PADRAO_PARCEIRO],
  ];
  for (const [value, origin] of candidates) {
    const yieldPercent = normalizeCarcassYield(value);
    if (yieldPercent != null) return { yieldPercent, origin };
  }
  return { yieldPercent: null, origin: null };
}

/** Arrobas de uma carcaça em kg; null quando a carcaça não é conhecida. */
export function arrobasFromCarcassKg(carcassWeightKg) {
  return Number.isFinite(carcassWeightKg) && carcassWeightKg > 0 ? carcassWeightKg / ARROBA_CARCASS_KG : null;
}

export function calculateCarcassTrade({ weight, yieldPercent, pricePerArroba }) {
  const liveWeight = typeof weight === 'number' ? weight : parseBrazilianNumber(weight);
  const liveWeightKg = Number.isFinite(liveWeight) && liveWeight > 0 ? liveWeight : null;
  const normalizedYield = normalizeCarcassYield(yieldPercent);
  const price = typeof pricePerArroba === 'number' ? pricePerArroba : parseBrazilianNumber(pricePerArroba);
  const carcassWeightKg = liveWeightKg != null && normalizedYield != null ? liveWeightKg * normalizedYield / 100 : null;
  const arrobas = arrobasFromCarcassKg(carcassWeightKg);
  return {
    liveWeightKg,
    yieldPercent: normalizedYield,
    carcassWeightKg,
    arrobas,
    estimatedValue: arrobas != null && Number.isFinite(price) && price >= 0 ? arrobas * price : null,
  };
}
