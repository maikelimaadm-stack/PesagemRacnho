// Parser de peso Tru-Test / Datamars S3 (BLE Weight Measurement + ASCII serial).
//
// O S3 anuncia o perfil BLE Weight Scale, mas no fio o LSB do Weight NÃO é o
// GATT de balança doméstica (0,005 kg). Medição real no campo:
//   monitor 58,5 kg → raw 1170 → com ×0,05 = 58,5 (com ×0,005 virava 5,85).
// Por isso o padrão de fio do S3 é 0,05 kg por LSB.

export const WEIGHT_SCALE_SERVICE_UUID = '0000181d-0000-1000-8000-00805f9b34fb';
export const WEIGHT_MEASUREMENT_UUID = '00002a9d-0000-1000-8000-00805f9b34fb';
export const WEIGHT_SCALE_FEATURE_UUID = '00002a9e-0000-1000-8000-00805f9b34fb';

/** Limite operacional pecuário (S3 ~2 t). 0 é válido (monitor zerado). */
export const WEIGHT_KG_MIN = 0;
export const WEIGHT_KG_MAX = 3000;

const WEIGHT_UNSUCCESSFUL = 0xffff;

/** Encoding de fio confirmado no Tru-Test/Datamars S3 (pecuário). */
export const S3_WIRE_RESOLUTION_KG = 0.05;
/** Encoding GATT doméstico (referência; NÃO usar no S3). */
export const GATT_WEIGHT_RESOLUTION_KG = 0.005;
export const GATT_WEIGHT_RESOLUTION_LB = 0.01;

/** Capacidade de resolução (Feature bits 3–6) — informativo. */
const FEATURE_DISPLAY_RESOLUTION_KG = Object.freeze([
  null,
  0.5,
  0.2,
  0.1,
  0.05,
  0.02,
  0.01,
  0.005,
]);

const LB_TO_KG = 0.45359237;

const ASCII_WEIGHT_RE = /(?:^|[^\d])(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:kg|KG)\b/;
const ASCII_WEIGHT_LOOSE_RE = /(?:^|[^\d.,])(\d{1,4}(?:[.,]\d{1,2})?)(?=[^\d]|$)/;

export function normalizeBleUuid(uuid) {
  const raw = String(uuid || '').trim().toLowerCase();
  if (!raw) return '';
  if (/^[0-9a-f]{4}$/.test(raw)) return `0000${raw}-0000-1000-8000-00805f9b34fb`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw)) return raw;
  return raw;
}

export function isWeightMeasurementUuid(uuid) {
  return normalizeBleUuid(uuid) === WEIGHT_MEASUREMENT_UUID;
}

export function isWeightScaleFeatureUuid(uuid) {
  return normalizeBleUuid(uuid) === WEIGHT_SCALE_FEATURE_UUID;
}

export function isWeightScaleServiceUuid(uuid) {
  return normalizeBleUuid(uuid) === WEIGHT_SCALE_SERVICE_UUID;
}

/**
 * Capacidade de resolução declarada no Feature (0x2A9E).
 * @param {number} featureBits uint32 little-endian
 * @returns {number|null}
 */
export function displayResolutionKgFromFeature(featureBits) {
  const bits = Number(featureBits) >>> 0;
  const code = (bits >>> 3) & 0b1111;
  if (code <= 0 || code >= FEATURE_DISPLAY_RESOLUTION_KG.length) return null;
  return FEATURE_DISPLAY_RESOLUTION_KG[code] ?? null;
}

/** @deprecated Prefer S3_WIRE_RESOLUTION_KG no decode do S3. */
export function resolutionKgFromFeature(featureBits) {
  return displayResolutionKgFromFeature(featureBits) ?? S3_WIRE_RESOLUTION_KG;
}

function inWeightRange(n) {
  return Number.isFinite(n) && n >= WEIGHT_KG_MIN && n <= WEIGHT_KG_MAX;
}

function toDataView(input) {
  if (!input) return null;
  if (typeof DataView !== 'undefined' && input instanceof DataView) return input;
  if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
    return new DataView(input);
  }
  if (ArrayBuffer.isView?.(input)) {
    return new DataView(input.buffer, input.byteOffset, input.byteLength);
  }
  if (Array.isArray(input)) {
    const bytes = Uint8Array.from(input);
    return new DataView(bytes.buffer);
  }
  return null;
}

/**
 * BLE Weight Measurement (0x2A9D):
 * [0] Flags (bit0: 0=SI kg, 1=imperial lb)
 * [1..2] Weight uint16 LE
 * 0xFFFF = medição sem sucesso
 *
 * S3: SI = raw × 0,05 kg (padrão). Imperial mantém GATT raw × 0,01 lb.
 */
export function parseBleWeightMeasurement(input, { resolutionKg = S3_WIRE_RESOLUTION_KG } = {}) {
  const view = toDataView(input);
  if (!view || view.byteLength < 3) return null;

  const flags = view.getUint8(0);
  const raw = view.getUint16(1, true);
  if (raw === WEIGHT_UNSUCCESSFUL) return null;

  const imperial = (flags & 0x01) !== 0;
  const step = Number.isFinite(resolutionKg) && resolutionKg > 0
    ? resolutionKg
    : S3_WIRE_RESOLUTION_KG;
  const weightKg = imperial
    ? raw * GATT_WEIGHT_RESOLUTION_LB * LB_TO_KG
    : raw * step;

  if (!inWeightRange(weightKg)) return null;

  const rounded = Math.round(weightKg * 100) / 100;
  return {
    weightKg: rounded,
    stable: false,
    raw: `ble:${flags.toString(16)}:${raw}`,
    sourceHint: 'ble-weight-measurement',
  };
}

/** Linha ASCII (USB/serial ou UART BLE). Aceita 0 kg. */
export function parseAsciiWeight(text) {
  const line = String(text || '').trim();
  if (!line) return null;

  const labeled = ASCII_WEIGHT_RE.exec(line);
  const match = labeled || ASCII_WEIGHT_LOOSE_RE.exec(line);
  if (!match) return null;

  const weightKg = Number(String(match[1]).replace(',', '.'));
  if (!inWeightRange(weightKg)) return null;

  if (!labeled && weightKg !== 0 && (weightKg < 20 || weightKg >= 1000)) return null;

  return {
    weightKg: Math.round(weightKg * 100) / 100,
    stable: /stable|estavel|estável|\bST\b|hold/i.test(line),
    raw: line,
    sourceHint: labeled ? 'ascii-kg' : 'ascii-loose',
  };
}

/**
 * Entrada genérica de DataView/bytes (notificação BLE ou buffer).
 */
export function parseWeightFromBytes(input, {
  preferBle = true,
  resolutionKg = S3_WIRE_RESOLUTION_KG,
} = {}) {
  const view = toDataView(input);
  if (!view || view.byteLength < 1) return null;

  if (preferBle && view.byteLength >= 3) {
    const ble = parseBleWeightMeasurement(view, { resolutionKg });
    if (ble) return ble;
  }

  try {
    const text = new TextDecoder().decode(
      view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
    );
    return parseAsciiWeight(text);
  } catch {
    return null;
  }
}
