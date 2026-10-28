// Tru-Test S3 via Web Bluetooth — Weight Scale Service (0x181D) + reconexão automática.
// Só interpreta Weight Measurement (0x2A9D). Encoding GATT fixo: raw × 0,005 kg (SI).
import { createReading } from '../domain/scaleContract.js';
import {
  WEIGHT_SCALE_SERVICE_UUID,
  isWeightMeasurementUuid,
  isWeightScaleServiceUuid,
  parseBleWeightMeasurement,
  parseWeightFromBytes,
} from '../domain/s3WeightParse.js';

const RECONNECT_DELAYS_MS = [800, 1500, 3000, 5000, 8000];

const PREFERRED_SERVICE_UUIDS = [
  WEIGHT_SCALE_SERVICE_UUID,
];

export function createS3BluetoothAdapter({ rememberedDeviceId = null } = {}) {
  let device = null;
  let server = null;
  let connected = false;
  let listeners = new Set();
  let detail = 'Bluetooth do app';
  let rememberedId = rememberedDeviceId;
  let notificationStops = [];
  let userStopped = false;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let disconnectHandler = null;
  let statusListeners = new Set();

  const emitStatus = () => {
    for (const cb of statusListeners) {
      try { cb(statusSnapshot()); } catch { /* ignore */ }
    }
  };

  const emit = (reading) => {
    for (const cb of listeners) {
      try { cb(reading); } catch { /* ignore */ }
    }
  };

  const statusSnapshot = () => ({
    connected: Boolean(connected && device?.gatt?.connected),
    label: 'S3 Bluetooth',
    detail: connected && device?.gatt?.connected
      ? detail
      : (reconnectTimer
        ? `Reconectando… (tentativa ${reconnectAttempt + 1})`
        : 'Ligue o Bluetooth do PC — o app procura e conecta'),
  });

  const clearReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const clearNotifications = () => {
    for (const stop of notificationStops) {
      try { stop(); } catch { /* ignore */ }
    }
    notificationStops = [];
  };

  const emitParsed = (parsed) => {
    if (!parsed || parsed.weightKg == null) return;
    emit(createReading({
      weightKg: parsed.weightKg,
      stable: parsed.stable,
      source: 'S3',
      raw: parsed.raw,
    }));
  };

  const handleValue = (event) => {
    const target = event?.target;
    const value = target?.value;
    if (!value) return;
    // Só Weight Measurement — battery / device info / Feature não são peso.
    if (target?.uuid && !isWeightMeasurementUuid(target.uuid)) return;
    const parsed = parseBleWeightMeasurement(value)
      || parseWeightFromBytes(value, { preferBle: true });
    emitParsed(parsed);
  };

  const subscribeGently = async (gattServer) => {
    clearNotifications();
    let services = [];
    for (const uuid of PREFERRED_SERVICE_UUIDS) {
      try {
        services.push(await gattServer.getPrimaryService(uuid));
      } catch { /* serviço ausente */ }
    }
    if (!services.length) {
      try {
        const all = await gattServer.getPrimaryServices();
        services = all.filter((service) => isWeightScaleServiceUuid(service.uuid));
        if (!services.length) services = all;
      } catch {
        services = [];
      }
    }

    for (const service of services) {
      let chars = [];
      try { chars = await service.getCharacteristics(); } catch { continue; }
      for (const characteristic of chars) {
        if (!isWeightMeasurementUuid(characteristic.uuid)) continue;
        const props = characteristic.properties || {};
        if (props.notify || props.indicate) {
          try {
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', handleValue);
            notificationStops.push(() => {
              try {
                characteristic.removeEventListener('characteristicvaluechanged', handleValue);
                characteristic.stopNotifications();
              } catch { /* ignore */ }
            });
          } catch { /* ignore */ }
        }
      }
    }

    // Leitura pontual só da Weight Measurement (não battery / device info).
    for (const service of services) {
      let chars = [];
      try { chars = await service.getCharacteristics(); } catch { continue; }
      for (const characteristic of chars) {
        if (!isWeightMeasurementUuid(characteristic.uuid)) continue;
        if (!characteristic.properties?.read) continue;
        try {
          const value = await characteristic.readValue();
          emitParsed(parseBleWeightMeasurement(value));
        } catch { /* ignore */ }
      }
    }

    detail = notificationStops.length
      ? `Conectado a ${device?.name || 'S3'} · link estável`
      : `Conectado a ${device?.name || 'S3'} · aguardando peso`;
    emitStatus();
  };

  const scheduleReconnect = () => {
    if (userStopped || !device || reconnectTimer) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    detail = `Conexão caiu — reconectando em ${Math.round(delay / 1000)}s…`;
    emitStatus();
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      if (userStopped || !device) return;
      reconnectAttempt += 1;
      try {
        await attachGatt(device);
        reconnectAttempt = 0;
      } catch {
        scheduleReconnect();
      }
    }, delay);
  };

  const onGattDisconnected = () => {
    connected = false;
    server = null;
    clearNotifications();
    if (userStopped) {
      detail = 'Bluetooth desconectado';
      emitStatus();
      return;
    }
    detail = 'Bluetooth caiu — reconectando…';
    emitStatus();
    scheduleReconnect();
  };

  const attachGatt = async (chosen) => {
    clearReconnect();
    device = chosen;
    rememberedId = chosen.id;

    if (disconnectHandler) {
      try { device.removeEventListener('gattserverdisconnected', disconnectHandler); } catch { /* ignore */ }
    }
    disconnectHandler = onGattDisconnected;
    device.addEventListener('gattserverdisconnected', disconnectHandler);

    if (!device.gatt) {
      throw Object.assign(
        new Error(`“${device.name || 'S3'}” não aceita conexão de dados BLE neste PC.`),
        { code: 'BLUETOOTH_NO_GATT' },
      );
    }

    if (device.gatt.connected) {
      server = device.gatt;
    } else {
      server = await device.gatt.connect();
    }
    connected = true;
    userStopped = false;
    detail = `Conectado a ${device.name || 'S3'}`;
    emitStatus();
    try {
      await subscribeGently(server);
    } catch {
      detail = `Conectado a ${device.name || 'S3'} — mantendo link`;
      emitStatus();
    }
    return { deviceId: rememberedId, deviceName: device.name || null };
  };

  return {
    id: 's3-bluetooth',
    label: 'Tru-Test S3 (Bluetooth)',
    getRememberedDevice() {
      return rememberedId ? { deviceId: rememberedId, deviceName: device?.name || null } : null;
    },
    onStatus(cb) {
      statusListeners.add(cb);
      try { cb(statusSnapshot()); } catch { /* ignore */ }
      return () => statusListeners.delete(cb);
    },
    async connect({ forcePicker = false } = {}) {
      if (!navigator.bluetooth) {
        throw Object.assign(
          new Error('Bluetooth indisponível neste app. Use o desktop (Electron) com o Bluetooth do PC ligado.'),
          { code: 'BLUETOOTH_UNAVAILABLE' },
        );
      }
      userStopped = false;
      clearReconnect();

      if (connected && device?.gatt?.connected) {
        return { deviceId: rememberedId, deviceName: device.name || null };
      }

      if (!forcePicker && device?.gatt) {
        try {
          return await attachGatt(device);
        } catch { /* tenta getDevices / picker */ }
      }

      if (!forcePicker && rememberedId && navigator.bluetooth.getDevices) {
        try {
          const known = await navigator.bluetooth.getDevices();
          const match = known.find((item) => item.id === rememberedId);
          if (match) return attachGatt(match);
        } catch { /* picker */ }
      }

      let chosen;
      try {
        chosen = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            'generic_access',
            'generic_attribute',
            'device_information',
            'battery_service',
            WEIGHT_SCALE_SERVICE_UUID,
            '0000181b-0000-1000-8000-00805f9b34fb',
            '0000180a-0000-1000-8000-00805f9b34fb',
            '0000180f-0000-1000-8000-00805f9b34fb',
          ],
        });
      } catch (error) {
        const msg = String(error?.message || error || '');
        if (/User cancelled|No device|canceled|cancelled|No port/i.test(msg)) {
          throw Object.assign(
            new Error('Nenhum dispositivo escolhido. Com o Bluetooth do PC ligado, clique em Procurar e selecione o S3.'),
            { code: 'BLUETOOTH_NO_DEVICE', cause: error },
          );
        }
        throw error;
      }
      reconnectAttempt = 0;
      return attachGatt(chosen);
    },
    async disconnect() {
      userStopped = true;
      clearReconnect();
      clearNotifications();
      connected = false;
      if (disconnectHandler && device) {
        try { device.removeEventListener('gattserverdisconnected', disconnectHandler); } catch { /* ignore */ }
      }
      disconnectHandler = null;
      try { device?.gatt?.disconnect(); } catch { /* ignore */ }
      server = null;
      detail = 'Bluetooth do app';
      emitStatus();
    },
    onReading(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    status() {
      return statusSnapshot();
    },
  };
}
