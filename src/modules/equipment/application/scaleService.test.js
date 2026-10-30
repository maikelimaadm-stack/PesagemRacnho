import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReading } from '../domain/scaleContract';

// Adaptador controlado pelo teste no lugar do simulador (config.adapter = 'simulator').
const fake = vi.hoisted(() => ({ listeners: new Set(), statusListeners: new Set(), connected: false }));
vi.mock('../adapters/simulatorAdapter.js', () => ({
  createSimulatorAdapter: () => ({
    id: 'simulator',
    label: 'Fake',
    async connect() { fake.connected = true; for (const cb of fake.statusListeners) cb(); },
    async disconnect() { fake.connected = false; for (const cb of fake.statusListeners) cb(); },
    onReading(cb) { fake.listeners.add(cb); return () => fake.listeners.delete(cb); },
    onStatus(cb) { fake.statusListeners.add(cb); return () => fake.statusListeners.delete(cb); },
    status() { return { connected: fake.connected, label: 'Fake' }; },
  }),
}));
vi.mock('./equipmentConfigService.js', () => ({
  getEquipmentConfig: async () => ({ adapter: 'simulator', stabilityMs: 500, stabilityKg: 0.5, emptyThresholdKg: 10, rearmDeltaKg: 30 }),
  updateEquipmentConfig: async () => ({}),
}));

const scale = await import('./scaleService.js');

const enviar = (weightKg) => { for (const cb of [...fake.listeners]) cb(createReading({ weightKg, stable: false, source: 'S3' })); };
const cair = () => { fake.connected = false; for (const cb of [...fake.statusListeners]) cb(); };
const voltar = () => { fake.connected = true; for (const cb of [...fake.statusListeners]) cb(); };

describe('scaleService — captura segura (P01–P03)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await scale.__testing.reset();
    await scale.ensureScaleReady({ force: true });
  });
  afterEach(() => vi.useRealTimers());

  it('S3 só envia quando muda: estabiliza pelo silêncio, numerado e da conexão atual', () => {
    enviar(410); enviar(418); enviar(420);
    expect(scale.evaluateCapture().ok).toBe(false);
    vi.advanceTimersByTime(500);
    const r = scale.evaluateCapture();
    expect(r.ok).toBe(true);
    expect(r.reading).toMatchObject({ weightKg: 420, stable: true, epoch: scale.getStatus().epoch });
    expect(r.reading.seq).toBeGreaterThan(0);
  });

  it('P01: A=420 salvo → B sem leitura nova não é liberado; plataforma vazia + B estável libera', () => {
    enviar(420); vi.advanceTimersByTime(500);
    scale.consumeCapture(scale.evaluateCapture().reading);
    vi.advanceTimersByTime(5000);
    expect(scale.evaluateCapture().reason).toBe('AGUARDANDO_PROXIMO_ANIMAL');
    enviar(0); enviar(330); enviar(352); vi.advanceTimersByTime(500);
    const b = scale.evaluateCapture();
    expect(b.ok).toBe(true);
    expect(b.reading.weightKg).toBe(352);
  });

  it('P02: oscilando por mais de 5 s não vira estável; captureWeightForLaunch rejeita', async () => {
    const promessa = scale.captureWeightForLaunch({ timeoutMs: 5000 });
    const pego = promessa.catch((err) => err);
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 25; i += 1) { enviar(i % 2 ? 412 : 428); await vi.advanceTimersByTimeAsync(250); }
    const err = await pego;
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('SCALE_NOT_STABLE');
    expect(scale.evaluateCapture().ok).toBe(false);
  });

  it('P03: queda do link invalida o estável; silêncio durante a queda não confirma', () => {
    enviar(420); vi.advanceTimersByTime(500);
    expect(scale.getLastStableReading()).not.toBeNull();
    cair();
    expect(scale.getLastStableReading()).toBeNull();
    expect(scale.evaluateCapture().reason).toBe('DESCONECTADA');
    voltar();
    expect(scale.evaluateCapture().ok).toBe(false);
    enviar(420); cair(); vi.advanceTimersByTime(1000);
    expect(scale.getLastStableReading()).toBeNull();
    voltar(); enviar(421); vi.advanceTimersByTime(500);
    expect(scale.evaluateCapture().ok).toBe(true);
  });

  it('P03: desconectar pela tela limpa leitura e estável; trocar de aparelho começa outra época', async () => {
    enviar(420); vi.advanceTimersByTime(500);
    const epocaAntes = scale.getStatus().epoch;
    await scale.disconnectScale();
    expect(scale.getStatus()).toMatchObject({ connected: false, lastWeightKg: null, lastStableKg: null });
    await scale.ensureScaleReady({ force: true });
    expect(scale.getStatus().epoch).toBeGreaterThan(epocaAntes);
    expect(scale.evaluateCapture().ok).toBe(false);
  });

  it('sequência é monotônica entre leituras e conexões', async () => {
    const seqs = [];
    scale.onScaleReading((r) => seqs.push(r.seq));
    enviar(300); enviar(310);
    await scale.disconnectScale();
    await scale.ensureScaleReady({ force: true });
    enviar(320);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});
