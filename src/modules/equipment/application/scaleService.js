// Adaptador configurado + estabilidade → Lançamento.
// Não derruba a conexão Bluetooth a cada ensureScaleReady (era a causa da queda em segundos).
//
// Missão pesagens-integrada (P01–P03): toda leitura sai daqui numerada — `seq` (monotônica
// na vida do app), `epoch` (época da conexão: muda a cada conexão, queda, troca de aparelho
// ou desligamento) e `receivedAt`. O portão de captura (domain/captureGate) decide se há
// leitura estável NOVA para o animal da vez; a tela só salva o peso da balança com ele.
// Desconectar, cair o link ou trocar de aparelho invalida o último estável (P03) e nenhuma
// leitura instável vira estável por tempo (P02).
import { assertAdapterShape, createReading } from '../domain/scaleContract.js';
import { createStabilityTracker } from '../domain/stabilityTracker.js';
import { createCaptureGate } from '../domain/captureGate.js';
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
let readingSequence = 0;
let connectionEpoch = 0;
let lastConnected = false;
let captureGate = createCaptureGate();

const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

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

function isAdapterConnected() {
  return Boolean(activeAdapter?.status?.()?.connected);
}

// Nova época: o estável da conexão anterior não vale mais (P03).
function bumpEpoch() {
  connectionEpoch += 1;
  lastStable = null;
  captureGate.invalidate();
  stabilityTracker?.reset();
}

function notifyStatus() {
  const connected = isAdapterConnected();
  if (connected !== lastConnected) {
    lastConnected = connected;
    bumpEpoch();
  }
  const snapshot = getStatus();
  for (const cb of statusListeners) {
    try { cb(snapshot); } catch { /* ignore */ }
  }
}

function notifyReading(reading) {
  if (!reading) return;
  const numbered = Object.freeze({ ...reading, seq: ++readingSequence, epoch: connectionEpoch, receivedAt: nowMs() });
  lastReading = numbered;
  if (numbered.stable && numbered.weightKg != null) lastStable = numbered;
  else if (numbered.weightKg == null || !numbered.stable) {
    // Instável fora da faixa do estável anterior: o estável deixou de representar o monitor.
    if (lastStable && (numbered.weightKg == null || Math.abs(Number(numbered.weightKg) - Number(lastStable.weightKg)) > 1)) lastStable = null;
  }
  captureGate.observe(numbered);
  for (const cb of readingListeners) {
    try { cb(numbered); } catch { /* ignore */ }
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
  // Troca/remoção do aparelho: nada da conexão anterior serve para salvar (P03).
  lastReading = null;
  lastConnected = false;
  bumpEpoch();
}

function wireAdapter(adapter, config) {
  activeAdapter = adapter;
  activeAdapterKey = adapterKeyOf(config);
  captureGate = createCaptureGate({
    emptyThresholdKg: config.emptyThresholdKg,
    rearmDeltaKg: config.rearmDeltaKg,
  });
  // Estabilidade (stabilityTracker): o S3 só manda o peso quando muda, então o
  // número parado também vira "estável" pelo timer, sem esperar nova leitura —
  // mas só com a balança conectada e na mesma época (silêncio por queda não é estável).
  // Época em que chegou a última leitura crua: o timer do silêncio só confirma estável se a
  // conexão ainda é a mesma (troca de época também reseta o tracker e cancela o timer).
  let lastRawEpoch = null;
  stabilityTracker = createStabilityTracker({
    windowMs: config.stabilityMs,
    toleranceKg: config.stabilityKg,
    onSettled: (reading) => {
      if (!isAdapterConnected() || lastRawEpoch !== connectionEpoch) return;
      notifyReading(reading);
    },
  });
  unsubscribeAdapter = activeAdapter.onReading((raw) => {
    if (!raw) return;
    lastRawEpoch = connectionEpoch;
    notifyReading(stabilityTracker.track(raw));
  });
  if (typeof activeAdapter.onStatus === 'function') {
    unsubscribeAdapterStatus = activeAdapter.onStatus(() => notifyStatus());
  }
}

export function getStatus() {
  const adapterStatus = activeAdapter?.status?.() || { connected: false, label: 'Balança', detail: 'Não configurada' };
  const connected = Boolean(adapterStatus.connected);
  return {
    adapterId: activeAdapter?.id || 'none',
    connected,
    label: adapterStatus.label,
    detail: adapterStatus.detail,
    epoch: connectionEpoch,
    lastWeightKg: lastReading?.weightKg ?? null,
    lastStableKg: connected ? (lastStable?.weightKg ?? null) : null,
    stable: connected && Boolean(lastReading?.stable),
    lastSeq: lastReading?.seq ?? null,
  };
}

/** Último estável da conexão ATUAL (null desconectado ou depois de troca de época). */
export function getLastStableReading() {
  if (!isAdapterConnected() || !lastStable || lastStable.epoch !== connectionEpoch) return null;
  return lastStable;
}

/**
 * Pode salvar com o peso da balança? Devolve { ok, reason, message, reading }.
 * A leitura liberada é estável, da conexão atual, e ainda não usada por outro animal.
 */
export function evaluateCapture() {
  return captureGate.evaluate({ connected: isAdapterConnected(), epoch: connectionEpoch });
}

/** Marca a leitura como usada — chamar só depois do salvamento ter dado certo. */
export function consumeCapture(reading) {
  captureGate.consume(reading);
}

/** "Liberar peso": o operador confirma que é outro animal; o estável atual volta a valer (ver captureGate.release). */
export function releaseCapture() {
  captureGate.release();
}

/** Pesagem automática religada / troca de dia: o portão recomeça (não muda a conexão). */
export function resetCapture() {
  captureGate.reset();
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
  // tearDown já invalida leitura e estável (P03: nada fica de uma conexão anterior).
  lastStable = null;
  notifyStatus();
}

/**
 * Espera uma leitura estável NOVA (P02): no tempo-limite rejeita — nunca transforma a última
 * leitura instável em estável.
 */
export async function captureWeightForLaunch({ timeoutMs = 5000 } = {}) {
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

  const ready = evaluateCapture();
  if (ready.ok) return ready.reading;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      const last = evaluateCapture();
      reject(Object.assign(
        new Error(lastReading?.weightKg != null
          ? `Sem leitura estável nova: ${last.message || 'peso ainda não estabilizou.'}`
          : 'Conectou, mas ainda sem peso. Mantenha o S3 ligado; a conexão agora reconecta sozinha se cair.'),
        { code: lastReading?.weightKg != null ? 'SCALE_NOT_STABLE' : 'SCALE_NO_READING', reason: last.reason },
      ));
    }, timeoutMs);
    const off = onScaleReading(() => {
      const r = evaluateCapture();
      if (r.ok) {
        clearTimeout(timeout);
        off();
        resolve(r.reading);
      }
    });
  });
}

// Exposto só para testes (estado interno do módulo).
export const __testing = {
  createReading,
  async reset() {
    await tearDown();
    readingSequence = 0;
    captureGate = createCaptureGate();
    statusListeners = new Set();
    readingListeners = new Set();
  },
};
