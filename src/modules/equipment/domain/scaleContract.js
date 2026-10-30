// Contrato único de balança (plano E4): leitura normalizada + adaptador plugável.
// O Lançamento só consome ScaleReading — não fala com USB/Bluetooth direto.
import { launchWeightKg } from '../../weighing/domain/weightNormalization.js';

export const SCALE_SOURCES = Object.freeze(['S3', 'SIMULADOR', 'MANUAL', 'ARQUIVO']);
export const SCALE_ADAPTER_IDS = Object.freeze(['none', 'simulator', 's3-usb', 's3-bluetooth']);

/**
 * @typedef {object} ScaleReading
 * @property {number|null} weightKg
 * @property {boolean} stable
 * @property {'kg'} unit
 * @property {string} at ISO timestamp
 * @property {'S3'|'SIMULADOR'|'MANUAL'|'ARQUIVO'} source
 * @property {string} [raw]
 * @property {string} [animalEid]
 */

/**
 * @typedef {object} ScaleAdapter
 * @property {string} id
 * @property {string} label
 * @property {(opts?: object) => Promise<void>} connect
 * @property {() => Promise<void>} disconnect
 * @property {(cb: (reading: ScaleReading) => void) => () => void} onReading
 * @property {() => { connected: boolean, label: string, detail?: string }} status
 */

export function createReading({ weightKg = null, stable = false, source = 'MANUAL', raw, animalEid } = {}) {
  return Object.freeze({
    weightKg: weightKg === null || weightKg === undefined || weightKg === '' ? null : Number(weightKg),
    stable: Boolean(stable),
    unit: 'kg',
    at: new Date().toISOString(),
    source,
    ...(raw !== undefined ? { raw: String(raw) } : {}),
    ...(animalEid !== undefined ? { animalEid: String(animalEid) } : {}),
  });
}

/**
 * Texto do campo Peso do Lançamento.
 * Sempre inteiro (sem vírgula): monitor 58,5 → campo "58".
 */
export function formatWeightForField(weightKg) {
  if (weightKg === null || weightKg === undefined || !Number.isFinite(Number(weightKg))) return '';
  // R07: mesma regra do lançamento (truncamento). Leitura ≤ 0 (balança vazia/tara) mostra o inteiro como antes.
  const kg = launchWeightKg(Number(weightKg));
  return String(kg ?? Math.trunc(Number(weightKg)));
}

export function assertAdapterShape(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new Error('Adaptador de balança inválido.');
  for (const key of ['id', 'label', 'connect', 'disconnect', 'onReading', 'status']) {
    if (adapter[key] === undefined) throw new Error(`Adaptador sem ${key}.`);
  }
  if (typeof adapter.connect !== 'function' || typeof adapter.disconnect !== 'function') {
    throw new Error('Adaptador: connect/disconnect devem ser funções.');
  }
  if (typeof adapter.onReading !== 'function' || typeof adapter.status !== 'function') {
    throw new Error('Adaptador: onReading/status devem ser funções.');
  }
  return adapter;
}
