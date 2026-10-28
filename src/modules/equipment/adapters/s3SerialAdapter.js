// Tru-Test / Datamars S3 via USB (Web Serial). Preferível quando o Bluetooth do PC falha.
// Parser ASCII compartilhado com BLE (aceita 0 kg quando o monitor zera).
import { createReading } from '../domain/scaleContract.js';
import { parseAsciiWeight } from '../domain/s3WeightParse.js';

export function createS3SerialAdapter({ baudRate = 9600 } = {}) {
  let port = null;
  let reader = null;
  let closed = true;
  let listeners = new Set();
  let lastRaw = '';
  let connected = false;
  let detail = 'USB / Serial';

  const emit = (reading) => {
    for (const cb of listeners) {
      try { cb(reading); } catch { /* ignore */ }
    }
  };

  const parseLine = (line) => {
    const text = String(line || '').trim();
    if (!text) return;
    lastRaw = text;
    const parsed = parseAsciiWeight(text);
    if (!parsed) return;
    emit(createReading({
      weightKg: parsed.weightKg,
      stable: parsed.stable,
      source: 'S3',
      raw: parsed.raw,
    }));
  };

  const readLoop = async () => {
    if (!port?.readable) return;
    const decoder = new TextDecoderStream();
    const input = port.readable.pipeThrough(decoder);
    reader = input.getReader();
    let buffer = '';
    try {
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value || '';
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || '';
        for (const line of parts) parseLine(line);
      }
    } catch (error) {
      detail = error?.message || 'Leitura USB interrompida';
      connected = false;
    } finally {
      try { reader?.releaseLock(); } catch { /* ignore */ }
      reader = null;
    }
  };

  return {
    id: 's3-usb',
    label: 'Tru-Test S3 (USB)',
    async connect() {
      if (!navigator.serial) {
        throw Object.assign(new Error('Este computador não oferece USB/Serial no app. Use o Electron (desktop:dev).'), { code: 'SERIAL_UNAVAILABLE' });
      }
      if (connected && port) return;
      port = await navigator.serial.requestPort();
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
      closed = false;
      connected = true;
      detail = `USB ${baudRate} 8N1`;
      readLoop();
    },
    async disconnect() {
      closed = true;
      connected = false;
      try { await reader?.cancel(); } catch { /* ignore */ }
      try { await port?.close(); } catch { /* ignore */ }
      reader = null;
      port = null;
      detail = 'USB / Serial';
    },
    onReading(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    status() {
      return {
        connected,
        label: connected ? 'S3 USB conectada' : 'S3 USB',
        detail: connected ? detail : (lastRaw ? `Último: ${lastRaw}` : 'Cabo USB — recomendado se o Bluetooth falhar'),
      };
    },
  };
}
