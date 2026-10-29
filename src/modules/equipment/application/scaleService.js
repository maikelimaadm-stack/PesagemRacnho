// Adaptador configurado + estabilidade → Lançamento.
// Não derruba a conexão Bluetooth a cada ensureScaleReady (era a causa da queda em segundos).
import { assertAdapterShape, createReading } from '../domain/scaleContract.js';
import { createStabilityTracker } from '../domain/stabilityTracker.js';
import { createSimulatorAdapter } from '../adapters/simulatorAdapter.js';
import { createS3SerialAdapter } from '../adapters/s3SerialAdapter.js';
import { createS3BluetoothAdapter } from '../adapters/s3BluetoothAdapter.js';
import { getEquipmentConfig, updateEquipmentConfig } from './equipmentConfigService.js';

let activeAdapter = null;
let activeAdapterKey = null;
let unsubscribeAdapter = null;
let unsubscribeAdapterStatus = null;
let lastReading = null;
let lastStable = null;
let stabilityTracker = null;
let statusListeners = new Set();
let readingListeners = new Set();
let bootPromise = null;

function adapterKeyOf(config) {
  if (!config || config.adapter === 'none') return 'none';
  if (config.adapter === 's3-bluetooth') {
    return `s3-bluetooth:${config.rememberedBluetooth?.deviceId || ''}`;
  }
  if (config.adapter === 's3-usb') {
    return `s3-usb:${config.baudRate || 9600}`;
  }
  return String(config.adapter);
}

function notifyStatus() {
  const snapshot = getStatus();
  for (const cb of statusListeners) {
    try { cb(snapshot); } catch { /* ignore */ }
  }
}

function notifyReading(reading) {
  lastReading = reading;
  if (reading?.stable && reading.weightKg != null) lastStable = reading;
  for (const cb of readingListeners) {
    try { cb(reading); } catch { /* ignore */ }
  }
  // Não notifica status a cada tick de peso — evita re-render do shell e travamento na captura.
}

function buildAdapter(config) {
  switch (config.adapter) {
    case 'simulator':
      // Modo 's3': o simulador do app se comporta como o S3 real (só envia quando muda).
      return assertAdapterShape(createSimulatorAdapter({ mode: 's3' }));
    case 's3-usb':
      return assertAdapterShape(createS3SerialAdapter({ baudRate: config.baudRate }));
    case 's3-bluetooth':
      return assertAdapterShape(createS3BluetoothAdapter({
        rememberedDeviceId: config.rememberedBluetooth?.deviceId || null,
      }));
    default:
      return null;
  }
}

async function tearDown() {
  if (unsubscribeAdapter) {
    unsubscribeAdapter();
    unsubscribeAdapter = null;
  }
  if (unsubscribeAdapterStatus) {
    unsubscribeAdapterStatus();
    unsubscribeAdapterStatus = null;
  }
  if (activeAdapter) {
    try { await activeAdapter.disconnect(); } catch { /* ignore */ }
    activeAdapter = null;
  }
  activeAdapterKey = null;
  stabilityTracker?.reset();
  stabilityTracker = null;
}

function wireAdapter(adapter, config) {
  activeAdapter = adapter;
  activeAdapterKey = adapterKeyOf(config);
  // Estabilidade (stabilityTracker): o S3 só manda o peso quando muda, então o
  // número parado também vira "estável" pelo timer, sem esperar nova leitura.
  stabilityTracker = createStabilityTracker({
    windowMs: config.stabilityMs,
    toleranceKg: config.stabilityKg,
    onSettled: (reading) => notifyReading(reading),
  });
  unsubscribeAdapter = activeAdapter.onReading((raw) => {
    notifyReading(stabilityTracker.track(raw));
  });
  if (typeof activeAdapter.onStatus === 'function') {
    unsubscribeAdapterStatus = activeAdapter.onStatus(() => notifyStatus());
  }
}

export function getStatus() {
  const adapterStatus = activeAdapter?.status?.() || { connected: false, label: 'Balança', detail: 'Não configurada' };
  return {
    adapterId: activeAdapter?.id || 'none',
    connected: Boolean(adapterStatus.connected),
    label: adapterStatus.label,
    detail: adapterStatus.detail,
    lastWeightKg: lastReading?.weightKg ?? null,
    lastStableKg: lastStable?.weightKg ?? null,
    stable: Boolean(lastReading?.stable),
  };
}

export function getLastStableReading() {
  return lastStable;
}

export function onScaleReading(cb) {
  readingListeners.add(cb);
  return () => readingListeners.delete(cb);
}

export function onScaleStatus(cb) {
  statusListeners.add(cb);
  try { cb(getStatus()); } catch { /* ignore */ }
  return () => statusListeners.delete(cb);
}

/**
 * Garante adaptador montado. NÃO desconecta se já estiver no mesmo adaptador
 * (evitar queda da S3 quando shell/lançamento/config chamam de novo).
 */
export async function ensureScaleReady({ force = false } = {}) {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const config = await getEquipmentConfig();
    const key = adapterKeyOf(config);

    if (!force && activeAdapter && activeAdapterKey === key) {
      notifyStatus();
      return getStatus();
    }

    await tearDown();
    if (config.adapter === 'none') {
      notifyStatus();
      return getStatus();
    }

    wireAdapter(buildAdapter(config), config);

    if (config.adapter === 'simulator') {
      await activeAdapter.connect();
    } else if (config.adapter === 's3-bluetooth' && config.rememberedBluetooth?.deviceId) {
      try {
        await activeAdapter.connect({ forcePicker: false });
      } catch {
        /* fica offline até Procurar */
      }
    }
    notifyStatus();
    return getStatus();
  })().finally(() => { bootPromise = null; });
  return bootPromise;
}

export async function connectConfiguredScale({ forcePicker = false } = {}) {
  const config = await getEquipmentConfig();
  if (config.adapter === 'none') {
    throw Object.assign(
      new Error('Nenhuma balança configurada. Clique em Procurar dispositivos (com o Bluetooth do PC ligado).'),
      { code: 'SCALE_NOT_CONFIGURED' },
    );
  }

  // Só recria adaptador se mudou o tipo — senão preserva o device BLE em memória (reconexão).
  const key = adapterKeyOf(config);
  if (!activeAdapter || activeAdapterKey !== key) {
    await ensureScaleReady({ force: true });
  }
  if (!activeAdapter) {
    wireAdapter(buildAdapter(config), config);
  }

  const remembered = await activeAdapter.connect({ forcePicker });
  if (remembered?.deviceId && config.adapter === 's3-bluetooth') {
    await updateEquipmentConfig({ rememberedBluetooth: remembered });
    activeAdapterKey = adapterKeyOf(await getEquipmentConfig());
  }
  if (remembered && !remembered.deviceId && config.adapter === 's3-usb') {
    await updateEquipmentConfig({ rememberedPort: remembered });
  }
  notifyStatus();
  return getStatus();
}

export async function disconnectScale() {
  await tearDown();
  lastReading = null;
  notifyStatus();
}

export async function captureWeightForLaunch() {
  const config = await getEquipmentConfig();
  if (config.adapter === 'none') {
    throw Object.assign(
      new Error('Configure a balança: Configurações › Equipamentos › Procurar dispositivos.'),
      { code: 'SCALE_NOT_CONFIGURED' },
    );
  }
  await ensureScaleReady();
  if (!getStatus().connected) {
    const needPicker = config.adapter === 's3-bluetooth'
      ? !config.rememberedBluetooth?.deviceId
      : true;
    await connectConfiguredScale({ forcePicker: needPicker });
  }

  if (lastStable?.weightKg != null) return lastStable;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      if (lastReading?.weightKg != null) resolve(createReading({ ...lastReading, stable: true }));
      else {
        reject(Object.assign(
          new Error('Conectou, mas ainda sem peso. Mantenha o S3 ligado; a conexão agora reconecta sozinha se cair.'),
          { code: 'SCALE_NO_READING' },
        ));
      }
    }, 5000);
    const off = onScaleReading((reading) => {
      if (reading?.stable && reading.weightKg != null) {
        clearTimeout(timeout);
        off();
        resolve(reading);
      }
    });
  });
}
