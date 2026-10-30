import { describe, expect, it } from 'vitest';
import { CAPTURE_REASONS, createCaptureGate } from './captureGate';

let seq = 0;
const leitura = (weightKg, stable, epoch = 1) => ({ weightKg, stable, epoch, seq: ++seq, source: 'S3' });
const conectado = { connected: true, epoch: 1 };

describe('createCaptureGate — liberação do peso para salvar', () => {
  it('estável novo da conexão atual libera; instável não', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(418, false));
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.INSTAVEL);
    const estavel = leitura(420, true);
    gate.observe(estavel);
    const r = gate.evaluate(conectado);
    expect(r.ok).toBe(true);
    expect(r.reading).toBe(estavel);
  });

  it('P01: animal A = 420 salvo → animal B sem nova leitura NÃO salva com o peso do A', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    gate.consume(gate.evaluate(conectado).reading);
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.AGUARDANDO_PROXIMO_ANIMAL);
    // A continua na balança e o monitor manda o mesmo estável de novo (firmware antigo, 1 s).
    gate.observe(leitura(420, true));
    expect(gate.evaluate(conectado).ok).toBe(false);
  });

  it('plataforma vazia entre os animais libera o próximo estável', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    gate.consume(gate.evaluate(conectado).reading);
    gate.observe(leitura(3, false));
    expect(gate.evaluate(conectado).ok).toBe(false);
    gate.observe(leitura(395, false));
    gate.observe(leitura(397, true));
    const r = gate.evaluate(conectado);
    expect(r.ok).toBe(true);
    expect(r.reading.weightKg).toBe(397);
  });

  it('troca sem esvaziar: variação grande e estável em peso diferente libera', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    gate.consume(gate.evaluate(conectado).reading);
    gate.observe(leitura(700, false)); // A saindo e B entrando ao mesmo tempo
    gate.observe(leitura(352, true));
    expect(gate.evaluate(conectado).ok).toBe(true);
  });

  it('o mesmo animal mexendo muito e voltando ao mesmo peso não libera (leitura tardia do A)', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    gate.consume(gate.evaluate(conectado).reading);
    gate.observe(leitura(470, false));
    gate.observe(leitura(420.5, true));
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.MESMO_PESO_DO_ANTERIOR);
  });

  it('balança oscilando o tempo todo nunca vira estável (sem timeout que inventa estabilidade)', () => {
    const gate = createCaptureGate();
    for (let i = 0; i < 60; i += 1) gate.observe(leitura(400 + (i % 2 ? 6 : -6), false));
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.INSTAVEL);
  });

  it('instável fora da faixa derruba o estável anterior (o animal mexeu)', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    gate.observe(leitura(431, false));
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.INSTAVEL);
  });

  it('P03: desconectar invalida; estável de outra época não vale', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true, 1));
    expect(gate.evaluate({ connected: false, epoch: 1 }).reason).toBe(CAPTURE_REASONS.DESCONECTADA);
    gate.invalidate();
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.INSTAVEL);
    gate.observe(leitura(420, true, 1));
    expect(gate.evaluate({ connected: true, epoch: 2 }).reason).toBe(CAPTURE_REASONS.OUTRA_CONEXAO);
  });

  it('reconexão com o animal já usado ainda na balança continua esperando o próximo', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true, 1));
    gate.consume(gate.evaluate(conectado).reading);
    gate.observe(leitura(420, true, 2)); // nova conexão, o mesmo boi
    expect(gate.evaluate({ connected: true, epoch: 2 }).reason).toBe(CAPTURE_REASONS.AGUARDANDO_PROXIMO_ANIMAL);
  });

  it('zero ou peso ausente não liberam pesagem', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(0, true));
    expect(gate.evaluate(conectado).ok).toBe(false);
    gate.observe({ weightKg: null, stable: true, epoch: 1, seq: ++seq });
    expect(gate.evaluate(conectado).ok).toBe(false);
  });

  it('cancelar o animal (sem salvar) não consome o peso', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    expect(gate.evaluate(conectado).ok).toBe(true);
    // a tela desistiu: nada de consume()
    expect(gate.evaluate(conectado).ok).toBe(true);
  });

  it('reset começa do zero (pesagem automática religada)', () => {
    const gate = createCaptureGate();
    gate.observe(leitura(420, true));
    gate.consume(gate.evaluate(conectado).reading);
    gate.reset();
    expect(gate.evaluate(conectado).reason).toBe(CAPTURE_REASONS.SEM_LEITURA);
  });
});
