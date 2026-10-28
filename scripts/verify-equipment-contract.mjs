import assert from 'node:assert/strict';
import { createSimulatorAdapter } from '../src/modules/equipment/adapters/simulatorAdapter.js';
import { createS3BluetoothAdapter } from '../src/modules/equipment/adapters/s3BluetoothAdapter.js';
import { assertAdapterShape, formatWeightForField, createReading } from '../src/modules/equipment/domain/scaleContract.js';
import { normalizeEquipmentConfig } from '../src/modules/equipment/application/equipmentConfigService.js';
import {
  displayResolutionKgFromFeature,
  parseAsciiWeight,
  parseBleWeightMeasurement,
  resolutionKgFromFeature,
} from '../src/modules/equipment/domain/s3WeightParse.js';

const sim = assertAdapterShape(createSimulatorAdapter({ targetKg: 310.5, tickMs: 20 }));
assert.equal(sim.id, 'simulator');
await sim.connect();
const first = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('simulador sem leitura')), 2000);
  const off = sim.onReading((reading) => {
    if (reading?.stable && reading.weightKg != null) {
      clearTimeout(t);
      off();
      resolve(reading);
    }
  });
});
assert.equal(first.source, 'SIMULADOR');
assert.ok(Math.abs(first.weightKg - 310.5) < 0.01);
await sim.disconnect();

const bridge = assertAdapterShape(createS3BluetoothAdapter({ rememberedDeviceId: 'abc' }));
assert.equal(bridge.id, 's3-bluetooth');
assert.match(bridge.status().detail, /Bluetooth|app|Windows|PC/i);

assert.equal(formatWeightForField(328.4), '328');
assert.equal(formatWeightForField(58.5), '58');
assert.equal(formatWeightForField(0), '0');
assert.equal(createReading({ weightKg: 100, stable: true, source: 'S3' }).unit, 'kg');

const cfg = normalizeEquipmentConfig({
  adapter: 's3-bluetooth',
  rememberedBluetooth: { deviceId: 'dev-1', deviceName: 'S3' },
});
assert.equal(cfg.adapter, 's3-bluetooth');
assert.equal(cfg.rememberedBluetooth.deviceId, 'dev-1');
assert.equal(cfg.autoFillOnStable, true);

// --- Parser BLE Weight Measurement (S3: raw × 0,05 kg) ---
assert.equal(displayResolutionKgFromFeature(0b011 << 3), 0.1);
assert.equal(displayResolutionKgFromFeature(0), null);
assert.equal(resolutionKgFromFeature(0), 0.05);

// Monitor 0 kg.
const zero = parseBleWeightMeasurement(new Uint8Array([0x00, 0x00, 0x00]));
assert.ok(zero);
assert.equal(zero.weightKg, 0);

// Monitor 58,5 kg: raw 1170 × 0,05 = 58,5 — NÃO 5,85 (bug ×0,005).
const fiftyEightHalf = parseBleWeightMeasurement(new Uint8Array([0x00, 0x92, 0x04]));
assert.ok(fiftyEightHalf);
assert.equal(fiftyEightHalf.weightKg, 58.5);
assert.equal(formatWeightForField(fiftyEightHalf.weightKg), '58');

// 199,5 kg: raw 3990 × 0,05
const cattle = parseBleWeightMeasurement(new Uint8Array([0x00, 0x96, 0x0f]));
assert.ok(cattle);
assert.equal(cattle.weightKg, 199.5);

// 0xFFFF = medição sem sucesso
assert.equal(parseBleWeightMeasurement(new Uint8Array([0x00, 0xff, 0xff])), null);

// ASCII: zero com unidade; sem unidade evita ano/ID tipo 1999
assert.equal(parseAsciiWeight('0 kg')?.weightKg, 0);
assert.equal(parseAsciiWeight('328,4 kg')?.weightKg, 328.4);
assert.equal(parseAsciiWeight('1999'), null);
assert.equal(parseAsciiWeight('451.8')?.weightKg, 451.8);

console.log('OK verify-equipment-contract');
