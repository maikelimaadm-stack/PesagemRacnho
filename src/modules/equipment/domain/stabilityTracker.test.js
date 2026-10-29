import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReading } from './scaleContract';
import { createStabilityTracker } from './stabilityTracker';
import { createSimulatorAdapter } from '../adapters/simulatorAdapter';

const leitura = (weightKg, stable = false) => createReading({ weightKg, stable, source: 'S3' });

describe('createStabilityTracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('S3 real: monitor trava o número e para de enviar → estável pelo silêncio', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    expect(tracker.track(leitura(312.5)).stable).toBe(false);
    expect(tracker.track(leitura(318)).stable).toBe(false);
    expect(tracker.track(leitura(320.5)).stable).toBe(false);
    // O S3 não manda mais nada (firmware ≥ 1.2.6: só envia quando muda).
    vi.advanceTimersByTime(499);
    expect(settled).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ weightKg: 320.5, stable: true });
  });

  it('número ainda mexendo: o timer recomeça a cada kg inteiro novo', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(300));
    vi.advanceTimersByTime(400);
    tracker.track(leitura(305));
    vi.advanceTimersByTime(400);
    expect(settled).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(settled.map((r) => r.weightKg)).toEqual([305]);
  });

  it('oscilação na virada do número (319,95 ↔ 320,00) não reinicia a contagem', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(319.95));
    vi.advanceTimersByTime(250);
    tracker.track(leitura(320));
    vi.advanceTimersByTime(250);
    expect(settled).toHaveLength(1);
  });

  it('passo de 1 kg (resolução do S3 acima de 200 kg) reinicia a contagem', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(320));
    vi.advanceTimersByTime(400);
    tracker.track(leitura(321));
    vi.advanceTimersByTime(400);
    expect(settled).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(settled.map((r) => r.weightKg)).toEqual([321]);
  });

  it('meio quilo (resolução do S3 abaixo de 200 kg) não reinicia', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(150));
    vi.advanceTimersByTime(300);
    tracker.track(leitura(150.5));
    vi.advanceTimersByTime(200);
    expect(settled).toHaveLength(1);
    expect(settled[0].weightKg).toBe(150.5);
  });

  it('firmware antigo (envia a cada 1 s): leitura igual após a janela já vem estável', () => {
    const tracker = createStabilityTracker({ windowMs: 500 });
    tracker.track(leitura(280));
    vi.advanceTimersByTime(1000);
    expect(tracker.track(leitura(280)).stable).toBe(true);
  });

  it('plataforma vazia (0 kg) nunca fica estável', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(0));
    vi.advanceTimersByTime(5000);
    expect(tracker.track(leitura(0)).stable).toBe(false);
    expect(settled).toHaveLength(0);
  });

  it('animal sai antes de estabilizar: não emite estável do peso antigo', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(320));
    vi.advanceTimersByTime(200);
    tracker.track(leitura(0));
    vi.advanceTimersByTime(2000);
    expect(settled).toHaveLength(0);
  });

  it('leitura já marcada estável pelo adaptador passa direto, sem timer', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    expect(tracker.track(leitura(250, true)).stable).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(settled).toHaveLength(0);
  });

  it('reset (desconectar) cancela o timer pendente', () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    tracker.track(leitura(320));
    tracker.reset();
    vi.advanceTimersByTime(1000);
    expect(settled).toHaveLength(0);
  });

  it('simulador no modo S3 (só envia quando muda) chega a estável pelo tracker', async () => {
    const settled = [];
    const tracker = createStabilityTracker({ windowMs: 500, onSettled: (r) => settled.push(r) });
    const sim = createSimulatorAdapter({ targetKg: 310, tickMs: 100, mode: 's3' });
    const recebidas = [];
    sim.onReading((raw) => { recebidas.push(raw); tracker.track(raw); });
    await sim.connect();
    vi.advanceTimersByTime(3000);
    await sim.disconnect();
    expect(recebidas.every((r) => r.stable === false)).toBe(true);
    expect(recebidas.filter((r) => r.weightKg === 310)).toHaveLength(1);
    expect(settled.at(-1)).toMatchObject({ weightKg: 310, stable: true });
  });
});
