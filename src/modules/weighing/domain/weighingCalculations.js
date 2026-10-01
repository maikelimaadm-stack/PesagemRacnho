import { parseCivilDate } from './brazilianValues.js';
import { classifyGmd } from './gmdQuality.js';

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

// Arredondado sem "-0" (o -0,004 kg arredondado vira 0, não "-0,00" na folha).
const fixed = (value, digits) => {
  const rounded = Number(value.toFixed(digits));
  return rounded === 0 ? 0 : rounded;
};

/** Ganho de peso em kg, 2 casas (a conta da folha desde a 1.4.2). */
export function weightGainKg(pesoAtual, pesoAnterior) {
  return fixed(pesoAtual - pesoAnterior, 2);
}

/**
 * GMD simples entre duas pesagens: ganho ÷ dias, 3 casas (a conta da 1.4.2).
 * M1 (1.5.0): sem intervalo positivo ou sem ganho → null, nunca um 0 inventado (0 é um número e mente). Ganho 0 em
 * intervalo válido continua sendo GMD 0 (o boi não engordou).
 */
export function simpleGmd(ganho, dias) {
  if (ganho === null || ganho === undefined || ganho === '' || dias === null || dias === undefined || dias === '') return null;
  const gain = Number(ganho);
  const days = Number(dias);
  if (!Number.isFinite(gain) || !Number.isFinite(days) || days <= 0) return null;
  return fixed(gain / days, 3);
}

const SEM_CALCULO = Object.freeze({ dataAnterior: null, pesoAnterior: null, dias: null, ganho: null, gmd: null });

// M1: qualidade DERIVADA (contrato gmdQuality.classifyGmd). Nunca é gravada: quem grava (weighingService.createEntry,
// weighingSeries.recalculateWeightSeries, Lançamento) escolhe só os 5 campos de antes.
const withQuality = (result, diasMinimos) => ({ ...result, ...classifyGmd(result, diasMinimos) });

/**
 * Calcula a referência anterior exclusivamente dentro do histórico do mesmo
 * animal. Datas futuras e registros do mesmo dia não entram no cálculo.
 * Referência = evento com peso da data anterior mais recente; se houver mais de um
 * nessa data, vale o último na ordem do histórico recebido (ordem canônica), como na
 * projeção do animal.
 *
 * M1 (1.5.0, docs/plano-mestre/M1-FUNDACAO-NUMERO.md §1.1): devolve também gmdQualidade e gmdMotivo
 * ('CONFIAVEL' | 'NAO_CONFIAVEL' | 'SEM_GMD'; null | 'intervalo curto (N dias)' | 'sem pesagem anterior'), pela regra
 * do intervalo mínimo (diasMinimos = gmd_dias_minimos de Configurações › Relatórios; opcional, ausente ou inválido → 21).
 * gmd é null (nunca 0) quando não há conta possível. Os 5 campos de antes não mudam de nome nem de valor.
 *
 * @param {{ history?: object[], date: string, weight: number|string|null, diasMinimos?: number }} input
 *   date: 'YYYY-MM-DD' (ou 'DD/MM/AAAA'); data impossível → sem conta (SEM_GMD).
 * @returns {{ dataAnterior: string|null, pesoAnterior: number|null, dias: number|null, ganho: number|null,
 *   gmd: number|null, gmdQualidade: string, gmdMotivo: string|null }}
 */
export function calculateWeightGain({ history = [], date, weight, diasMinimos } = {}) {
  // Data da pesagem como dia civil válido ('YYYY-MM-DD' ou 'DD/MM/AAAA'); data impossível (dia 00, 30/02) não tem conta.
  const currentDate = parseCivilDate(date);
  const currentWeight = weightValue(weight);
  if (!currentDate || currentWeight === null) {
    return withQuality(SEM_CALCULO, diasMinimos);
  }

  let previous = null;
  for (const entry of history || []) {
    if (!entry || typeof entry !== 'object') continue;
    const entryDate = asIsoDate(entry.data_pesagem);
    // Data que não vira dia (ex.: dia 00) não é referência: daria dias NaN e um GMD inventado.
    if (!(entryDate < currentDate) || Number.isNaN(toUtcDay(entryDate)) || weightValue(entry.peso ?? entry.peso_kg) === null) continue;
    if (!previous || entryDate >= asIsoDate(previous.data_pesagem)) previous = entry;
  }

  if (!previous) {
    return withQuality(SEM_CALCULO, diasMinimos);
  }

  const dataAnterior = asIsoDate(previous.data_pesagem);
  const pesoAnterior = weightValue(previous.peso ?? previous.peso_kg);
  const dias = Math.round((toUtcDay(currentDate) - toUtcDay(dataAnterior)) / 86_400_000);
  const ganho = weightGainKg(currentWeight, pesoAnterior);
  const gmd = simpleGmd(ganho, dias);

  return withQuality({ dataAnterior, pesoAnterior, dias, ganho, gmd }, diasMinimos);
}
