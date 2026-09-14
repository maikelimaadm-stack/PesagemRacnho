import { parseBrazilianNumber, parseCivilDate } from './brazilianValues.js';
import { calculateWeightGain } from './weighingCalculations.js';

export const DEFAULT_WEIGHT_WARNING_POLICY = Object.freeze({
  minimumWeightKg: 20,
  maximumWeightKg: 1500,
  maximumAbsoluteGmdKg: 5,
  maximumWeightChangePercent: 35,
});

export function evaluateWeighingWarnings({ weight, date, history = [], policy = DEFAULT_WEIGHT_WARNING_POLICY }) {
  const parsedWeight = parseBrazilianNumber(weight);
  const parsedDate = parseCivilDate(date);
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || !parsedDate) return [];
  const warnings = [];
  if (parsedWeight < policy.minimumWeightKg || parsedWeight > policy.maximumWeightKg) {
    warnings.push({ code: 'WEIGHT_RANGE', message: `Peso de ${parsedWeight} kg fora da faixa de conferência (${policy.minimumWeightKg} a ${policy.maximumWeightKg} kg).` });
  }
  const gain = calculateWeightGain({ history, date: parsedDate, weight: parsedWeight });
  if (Number.isFinite(gain.pesoAnterior) && gain.pesoAnterior > 0 && Number.isFinite(gain.ganho)) {
    const percent = Math.abs(gain.ganho) / gain.pesoAnterior * 100;
    if (percent > policy.maximumWeightChangePercent) warnings.push({ code: 'WEIGHT_CHANGE', message: `Variação de ${percent.toFixed(1).replace('.', ',')}% desde a pesagem anterior.` });
  }
  if (Number.isFinite(gain.gmd) && Math.abs(gain.gmd) > policy.maximumAbsoluteGmdKg) {
    warnings.push({ code: 'GMD_RANGE', message: `GMD de ${gain.gmd.toFixed(3).replace('.', ',')} kg/dia acima da faixa de conferência.` });
  }
  return warnings;
}
