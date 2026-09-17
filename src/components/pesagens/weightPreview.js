import { parseBrazilianNumber, parseCivilDate } from '../../modules/weighing/domain/brazilianValues.js';
import { calculateWeightGain } from '../../modules/weighing/domain/weighingCalculations.js';

// Presentation only: the curve contains saved entries before the launch date.
// A draft must never be counted as a recorded weighing or include future history.
export function buildWeightPreview({ history = [], date, weight, editingId }) {
  const currentDate = parseCivilDate(date);
  const previous = history
    .filter((entry) => !editingId || String(entry.id) !== String(editingId))
    .map((entry) => ({ ...entry, peso: parseBrazilianNumber(entry.peso), data_pesagem: parseCivilDate(entry.data_pesagem) }))
    .filter((entry) => currentDate && entry.data_pesagem && entry.data_pesagem < currentDate && Number.isFinite(entry.peso) && entry.peso > 0)
    .sort((a, b) => a.data_pesagem.localeCompare(b.data_pesagem));
  const parsedWeight = parseBrazilianNumber(weight);
  const hasWeight = Number.isFinite(parsedWeight) && parsedWeight > 0;
  // Sem peso digitado: calcula só a referência anterior (peso 1 é marcador; ganho/GMD saem nulos).
  const gain = calculateWeightGain({ history: previous, date: currentDate, weight: hasWeight ? parsedWeight : 1 });
  if (!hasWeight) { gain.ganho = null; gain.gmd = null; }
  const values = previous.slice(-6).map((entry) => entry.peso);
  if (!values.length) return { gain, trend: null };
  const minimum = Math.min(...values);
  const span = Math.max(Math.max(...values) - minimum, 1);
  const coords = values.map((value, index) => ({
    x: 2 + 88 * index / Math.max(values.length - 1, 1),
    y: 19 - (value - minimum) / span * 16.5,
  }));
  return { gain, trend: {
    points: coords.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
    end: coords.at(-1), count: values.length,
    totalGain: values.at(-1) - values[0],
  } };
}
