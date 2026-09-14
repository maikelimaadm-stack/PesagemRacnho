import { parseBrazilianNumber } from './brazilianValues.js';

export const DEFAULT_CARCASS_YIELD_PERCENT = 50;

export function normalizeCarcassYield(value, fallback = DEFAULT_CARCASS_YIELD_PERCENT) {
  const parsed = parseBrazilianNumber(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return fallback;
  return parsed;
}

export function calculateCarcassTrade({ weight, yieldPercent, pricePerArroba }) {
  const liveWeightKg = parseBrazilianNumber(weight);
  const normalizedYield = normalizeCarcassYield(yieldPercent);
  const price = parseBrazilianNumber(pricePerArroba);
  if (!Number.isFinite(liveWeightKg) || liveWeightKg <= 0) {
    return { liveWeightKg: null, yieldPercent: normalizedYield, carcassWeightKg: null, arrobas: null, estimatedValue: null };
  }
  const carcassWeightKg = liveWeightKg * normalizedYield / 100;
  const arrobas = carcassWeightKg / 15;
  return {
    liveWeightKg,
    yieldPercent: normalizedYield,
    carcassWeightKg,
    arrobas,
    estimatedValue: Number.isFinite(price) && price >= 0 ? arrobas * price : null,
  };
}
