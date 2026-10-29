// Simulador: oscila e estabiliza um peso — permite ver o campo Peso preenchido sem hardware.
// modo 's3': imita o Bluetooth do S3 real (firmware ≥ 1.2.6): só envia quando o número
// muda e nunca marca estável — quem decide a estabilidade é o stabilityTracker.
import { createReading } from '../domain/scaleContract.js';

const DEFAULT_TARGET = 328.4;

export function createSimulatorAdapter({ targetKg = DEFAULT_TARGET, tickMs = 200, mode = 'stable-flag' } = {}) {
  let timer = null;
  let listeners = new Set();
  let connected = false;
  let step = 0;
  let current = targetKg - 4;
  let lastSent = null;
  const s3Like = mode === 's3';

  const emit = (reading) => {
    if (s3Like) {
      if (reading.weightKg === lastSent) return;
      lastSent = reading.weightKg;
      reading = createReading({ weightKg: reading.weightKg, stable: false, source: reading.source });
    }
    for (const cb of listeners) {
      try { cb(reading); } catch { /* listener isolado */ }
    }
  };

  const tick = () => {
    step += 1;
    // ~2 s de oscilação, depois estabiliza no alvo.
    if (step < 10) {
      current = targetKg + (Math.sin(step / 2) * 2.2) + (s3Like ? 0 : ((Math.random() - 0.5) * 0.6));
      emit(createReading({ weightKg: current, stable: false, source: 'SIMULADOR' }));
      return;
    }
    current = targetKg;
    emit(createReading({ weightKg: current, stable: true, source: 'SIMULADOR' }));
  };

  return {
    id: 'simulator',
    label: 'Simulador',
    async connect() {
      if (connected) return;
      connected = true;
      step = 0;
      current = targetKg - 4;
      lastSent = null;
      timer = setInterval(tick, tickMs);
      tick();
    },
    async disconnect() {
      connected = false;
      if (timer) clearInterval(timer);
      timer = null;
    },
    onReading(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    status() {
      return {
        connected,
        label: connected ? 'Simulador ligado' : 'Simulador',
        detail: connected ? `${formatHint(current)} kg` : 'Gera peso estável para o Lançamento',
      };
    },
  };
}

function formatHint(kg) {
  if (!Number.isFinite(kg)) return '—';
  return (Math.round(kg * 10) / 10).toFixed(1).replace('.', ',');
}
