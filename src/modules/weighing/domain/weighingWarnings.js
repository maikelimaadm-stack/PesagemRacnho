import { parseBrazilianNumber, parseCivilDate } from './brazilianValues.js';
import { calculateWeightGain } from './weighingCalculations.js';

export const DEFAULT_WEIGHT_WARNING_POLICY = Object.freeze({
  minimumWeightKg: 20,
  maximumWeightKg: 1500,
  maximumAbsoluteGmdKg: 5,
  maximumWeightChangePercent: 35,
});

const positive = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

/**
 * Monta a política de avisos a partir da configuração da empresa
 * (`weight-warning-policy`: faixa_peso_min, faixa_peso_max, limite_gmd_alerta,
 * variacao_max_percent). Valores ausentes ou inválidos caem nos defaults; uma
 * faixa invertida (mín ≥ máx) descarta a faixa configurada inteira.
 */
export function buildWeightWarningPolicy(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  let minimumWeightKg = positive(source.faixa_peso_min, DEFAULT_WEIGHT_WARNING_POLICY.minimumWeightKg);
  let maximumWeightKg = positive(source.faixa_peso_max, DEFAULT_WEIGHT_WARNING_POLICY.maximumWeightKg);
  if (minimumWeightKg >= maximumWeightKg) {
    minimumWeightKg = DEFAULT_WEIGHT_WARNING_POLICY.minimumWeightKg;
    maximumWeightKg = DEFAULT_WEIGHT_WARNING_POLICY.maximumWeightKg;
  }
  return Object.freeze({
    minimumWeightKg,
    maximumWeightKg,
    maximumAbsoluteGmdKg: positive(source.limite_gmd_alerta, DEFAULT_WEIGHT_WARNING_POLICY.maximumAbsoluteGmdKg),
    maximumWeightChangePercent: positive(source.variacao_max_percent, DEFAULT_WEIGHT_WARNING_POLICY.maximumWeightChangePercent),
  });
}

export function evaluateWeighingWarnings({ weight, date, history = [], policy = DEFAULT_WEIGHT_WARNING_POLICY }) {
  // Política parcial (ou nula) completa-se com os defaults: nenhum limite fica indefinido.
  const rules = { ...DEFAULT_WEIGHT_WARNING_POLICY, ...(policy && typeof policy === 'object' ? policy : {}) };
  const parsedWeight = parseBrazilianNumber(weight);
  const parsedDate = parseCivilDate(date);
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || !parsedDate) return [];
  const warnings = [];
  if (parsedWeight < rules.minimumWeightKg || parsedWeight > rules.maximumWeightKg) {
    warnings.push({ code: 'WEIGHT_RANGE', message: `Peso de ${parsedWeight} kg fora da faixa de conferência (${rules.minimumWeightKg} a ${rules.maximumWeightKg} kg).` });
  }
  const gain = calculateWeightGain({ history, date: parsedDate, weight: parsedWeight });
  if (Number.isFinite(gain.pesoAnterior) && gain.pesoAnterior > 0 && Number.isFinite(gain.ganho)) {
    const percent = Math.abs(gain.ganho) / gain.pesoAnterior * 100;
    if (percent > rules.maximumWeightChangePercent) warnings.push({ code: 'WEIGHT_CHANGE', message: `Variação de ${percent.toFixed(1).replace('.', ',')}% desde a pesagem anterior.` });
  }
  if (Number.isFinite(gain.gmd) && Math.abs(gain.gmd) > rules.maximumAbsoluteGmdKg) {
    warnings.push({ code: 'GMD_RANGE', message: `GMD de ${gain.gmd.toFixed(3).replace('.', ',')} kg/dia acima da faixa de conferência.` });
  }
  return warnings;
}
