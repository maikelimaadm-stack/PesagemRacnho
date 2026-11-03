// Configuração de balança em appSettings (chave própria).
import { getSetting, setSetting } from '../../settings/application/settingsService.js';
import { SCALE_ADAPTER_IDS } from '../domain/scaleContract.js';

export const EQUIPMENT_CONFIG_VERSION = 1;
export const EQUIPMENT_CONFIG_KEY = 'equipment-config:local';

export const EQUIPMENT_STATUS_ACCENTS = Object.freeze(['green', 'blue']);

export const EQUIPMENT_CONFIG_DEFAULTS = Object.freeze({
  versao: EQUIPMENT_CONFIG_VERSION,
  adapter: 'none', // none | simulator | s3-bluetooth | s3-usb
  baudRate: 9600,
  stabilityKg: 0.5,
  /** Janela curta: kg inteiro do monitor parado = estável (acompanha a tela da S3). */
  stabilityMs: 500,
  /** Abaixo disto a plataforma está vazia: libera o próximo animal (portão da captura, P01). */
  emptyThresholdKg: 10,
  /** Variação mínima (kg) que conta como troca de animal sem esvaziar a plataforma. */
  rearmDeltaKg: 30,
  autoFillOnStable: true,
  /** Bip curto (1 toque, ~1 s) quando a pesagem automática libera o peso estável do animal. */
  beepOnStable: true,
  /** Cor do “prontinho” / ícone da balança (online e pesagem automática). */
  statusAccent: 'green', // green | blue
  rememberedPort: null,
  rememberedBluetooth: null, // { deviceId, deviceName }
});

const BAUD_RATES = Object.freeze([9600, 19200, 38400, 57600, 115200]);

export function normalizeEquipmentConfig(raw = {}) {
  const adapter = SCALE_ADAPTER_IDS.includes(raw.adapter) ? raw.adapter : EQUIPMENT_CONFIG_DEFAULTS.adapter;
  const baudRate = BAUD_RATES.includes(Number(raw.baudRate)) ? Number(raw.baudRate) : EQUIPMENT_CONFIG_DEFAULTS.baudRate;
  const stabilityKg = Number(raw.stabilityKg);
  const stabilityMs = Number(raw.stabilityMs);
  const emptyThresholdKg = Number(raw.emptyThresholdKg);
  const rearmDeltaKg = Number(raw.rearmDeltaKg);
  const rememberedPort = raw.rememberedPort && typeof raw.rememberedPort === 'object'
    ? {
        usbVendorId: raw.rememberedPort.usbVendorId ?? null,
        usbProductId: raw.rememberedPort.usbProductId ?? null,
        bluetoothServiceClassId: raw.rememberedPort.bluetoothServiceClassId ?? null,
      }
    : null;
  const rememberedBluetooth = raw.rememberedBluetooth && typeof raw.rememberedBluetooth === 'object' && raw.rememberedBluetooth.deviceId
    ? {
        deviceId: String(raw.rememberedBluetooth.deviceId),
        deviceName: raw.rememberedBluetooth.deviceName ? String(raw.rememberedBluetooth.deviceName) : null,
      }
    : null;
  const statusAccent = EQUIPMENT_STATUS_ACCENTS.includes(raw.statusAccent)
    ? raw.statusAccent
    : EQUIPMENT_CONFIG_DEFAULTS.statusAccent;
  return {
    versao: EQUIPMENT_CONFIG_VERSION,
    adapter,
    baudRate,
    stabilityKg: Number.isFinite(stabilityKg) && stabilityKg > 0 ? stabilityKg : EQUIPMENT_CONFIG_DEFAULTS.stabilityKg,
    stabilityMs: Number.isFinite(stabilityMs) && stabilityMs >= 200 ? Math.round(stabilityMs) : EQUIPMENT_CONFIG_DEFAULTS.stabilityMs,
    emptyThresholdKg: Number.isFinite(emptyThresholdKg) && emptyThresholdKg > 0 && emptyThresholdKg <= 100 ? emptyThresholdKg : EQUIPMENT_CONFIG_DEFAULTS.emptyThresholdKg,
    rearmDeltaKg: Number.isFinite(rearmDeltaKg) && rearmDeltaKg >= 5 && rearmDeltaKg <= 500 ? rearmDeltaKg : EQUIPMENT_CONFIG_DEFAULTS.rearmDeltaKg,
    autoFillOnStable: raw.autoFillOnStable === false ? false : true,
    beepOnStable: raw.beepOnStable === false ? false : true,
    statusAccent,
    rememberedPort,
    rememberedBluetooth,
  };
}

export async function getEquipmentConfig() {
  const stored = await getSetting(EQUIPMENT_CONFIG_KEY, null);
  return normalizeEquipmentConfig(stored && typeof stored === 'object' ? stored : {});
}

export async function updateEquipmentConfig(patch = {}) {
  const current = await getEquipmentConfig();
  const next = normalizeEquipmentConfig({ ...current, ...patch });
  await setSetting(EQUIPMENT_CONFIG_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pesagens:equipment-config', { detail: next }));
  }
  return next;
}
