const asIsoDate = (value) => String(value || '').slice(0, 10);

const toUtcDay = (value) => {
  const [year, month, day] = asIsoDate(value).split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
};

// Peso medido: número finito > 0. null/vazio/0 não são pesagem (Number(null) seria 0).
const weightValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/**
 * Calcula a referência anterior exclusivamente dentro do histórico do mesmo
 * animal. Datas futuras e registros do mesmo dia não entram no cálculo.
 * Referência = evento com peso da data anterior mais recente; se houver mais de um
 * nessa data, vale o último na ordem do histórico recebido (ordem canônica), como na
 * projeção do animal.
 */
export function calculateWeightGain({ history = [], date, weight }) {
  const currentDate = asIsoDate(date);
  const currentWeight = weightValue(weight);
  if (!currentDate || currentWeight === null) {
    return { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  }

  let previous = null;
  for (const entry of history) {
    const entryDate = asIsoDate(entry.data_pesagem);
    if (!(entryDate < currentDate) || weightValue(entry.peso ?? entry.peso_kg) === null) continue;
    if (!previous || entryDate >= asIsoDate(previous.data_pesagem)) previous = entry;
  }

  if (!previous) {
    return { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  }

  const dataAnterior = asIsoDate(previous.data_pesagem);
  const pesoAnterior = weightValue(previous.peso ?? previous.peso_kg);
  const dias = Math.round((toUtcDay(currentDate) - toUtcDay(dataAnterior)) / 86_400_000);
  const ganho = Number((currentWeight - pesoAnterior).toFixed(2));
  const gmd = dias > 0 ? Number((ganho / dias).toFixed(3)) : 0;

  return { dataAnterior, pesoAnterior, dias, ganho, gmd };
}
