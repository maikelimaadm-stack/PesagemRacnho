import { parseBrazilianNumber, parseCivilDate } from '../../modules/weighing/domain/brazilianValues.js';
import { calculateWeightGain } from '../../modules/weighing/domain/weighingCalculations.js';
import { classifyGmd, gmdExibicao, normalizeGmdDiasMinimos } from '../../modules/weighing/domain/gmdQuality.js';

// Presentation only: the curve contains saved entries before the launch date.
// A draft must never be counted as a recorded weighing or include future history.
// M1 (1.5.0): `gmd` é a exibição do GMD prévio pelo contrato (gmdQuality.gmdExibicao) — intervalo menor que
// `diasMinimos` (Configurações › Relatórios, gmd_dias_minimos; ausente/inválido → 21) sai em cinza com o aviso
// "intervalo curto (N dias)"; sem pesagem anterior (ou sem peso digitado) sai "-". `gain` continua o do domínio.
export function buildWeightPreview({ history = [], date, weight, editingId, diasMinimos }) {
  const minimo = normalizeGmdDiasMinimos(diasMinimos);
  const currentDate = parseCivilDate(date);
  const previous = history
    .filter((entry) => !editingId || String(entry.id) !== String(editingId))
    .map((entry) => ({ ...entry, peso: parseBrazilianNumber(entry.peso), data_pesagem: parseCivilDate(entry.data_pesagem) }))
    .filter((entry) => currentDate && entry.data_pesagem && entry.data_pesagem < currentDate && Number.isFinite(entry.peso) && entry.peso > 0)
    .sort((a, b) => a.data_pesagem.localeCompare(b.data_pesagem));
  const parsedWeight = parseBrazilianNumber(weight);
  const hasWeight = Number.isFinite(parsedWeight) && parsedWeight > 0;
  // Sem peso digitado: calcula só a referência anterior (peso 1 é marcador; ganho/GMD saem nulos).
  const gain = calculateWeightGain({ history: previous, date: currentDate, weight: hasWeight ? parsedWeight : 1, diasMinimos: minimo });
  if (!hasWeight) { gain.ganho = null; gain.gmd = null; }
  const qualidade = classifyGmd({ dias: gain.dias, gmd: gain.gmd }, minimo);
  // Com a qualidade já no domínio (calculateWeightGain da M1), a prévia sem peso não carrega a do peso-marcador.
  if (Object.hasOwn(gain, 'gmdQualidade')) Object.assign(gain, qualidade);
  const gmd = { ...qualidade, ...gmdExibicao({ gmd: gain.gmd, ...qualidade }) };
  const values = previous.slice(-6).map((entry) => entry.peso);
  if (!values.length) return { gain, gmd, trend: null };
  const minimum = Math.min(...values);
  const span = Math.max(Math.max(...values) - minimum, 1);
  const coords = values.map((value, index) => ({
    x: 2 + 88 * index / Math.max(values.length - 1, 1),
    y: 19 - (value - minimum) / span * 16.5,
  }));
  return { gain, gmd, trend: {
    points: coords.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
    end: coords.at(-1), count: values.length,
    totalGain: values.at(-1) - values[0],
  } };
}
