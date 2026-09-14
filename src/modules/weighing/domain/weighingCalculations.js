const asIsoDate = (value) => String(value || '').slice(0, 10);

const toUtcDay = (value) => {
  const [year, month, day] = asIsoDate(value).split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
};

/**
 * Calcula a referência anterior exclusivamente dentro do histórico do mesmo
 * animal. Datas futuras e registros do mesmo dia não entram no cálculo.
 */
export function calculateWeightGain({ history = [], date, weight }) {
  const currentDate = asIsoDate(date);
  const currentWeight = Number(weight);
  if (!currentDate || !Number.isFinite(currentWeight)) {
    return { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  }

  const previous = history
    .filter((entry) => asIsoDate(entry.data_pesagem) < currentDate && Number.isFinite(Number(entry.peso)))
    .sort((left, right) => asIsoDate(right.data_pesagem).localeCompare(asIsoDate(left.data_pesagem)))[0];

  if (!previous) {
    return { dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null };
  }

  const dataAnterior = asIsoDate(previous.data_pesagem);
  const pesoAnterior = Number(previous.peso);
  const dias = Math.round((toUtcDay(currentDate) - toUtcDay(dataAnterior)) / 86_400_000);
  const ganho = Number((currentWeight - pesoAnterior).toFixed(2));
  const gmd = dias > 0 ? Number((ganho / dias).toFixed(3)) : 0;

  return { dataAnterior, pesoAnterior, dias, ganho, gmd };
}
