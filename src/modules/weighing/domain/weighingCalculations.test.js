import { describe, expect, it } from 'vitest';
import { calculateWeightGain } from './weighingCalculations';

describe('calculateWeightGain — datas e sinais (P12)', () => {
  it('pesagem anterior com data impossível (30/02) não é referência', () => {
    const r = calculateWeightGain({ history: [{ data_pesagem: '2026-02-30', peso: 300 }], date: '2026-03-10', weight: 320 });
    expect(r.gmd).toBeNull();
    expect(r.dataAnterior).toBeNull();
    expect(r.gmdQualidade).toBe('SEM_GMD');
  });

  it('usa a anterior válida mais recente, ignorando a impossível', () => {
    const r = calculateWeightGain({
      history: [{ data_pesagem: '2026-01-01', peso: 290 }, { data_pesagem: '2026-02-30', peso: 300 }],
      date: '2026-03-02',
      weight: 320,
    });
    expect(r.dataAnterior).toBe('2026-01-01');
    expect(r.dias).toBe(60);
  });

  it('data atual impossível não tem conta', () => {
    expect(calculateWeightGain({ history: [{ data_pesagem: '2026-01-01', peso: 290 }], date: '2026-02-30', weight: 320 }).gmd).toBeNull();
  });

  it('GMD negativo e zero verdadeiros são preservados', () => {
    const neg = calculateWeightGain({ history: [{ data_pesagem: '2026-01-01', peso: 300 }], date: '2026-01-31', weight: 285 });
    expect(neg.gmd).toBe(-0.5);
    const zero = calculateWeightGain({ history: [{ data_pesagem: '2026-01-01', peso: 300 }], date: '2026-01-31', weight: 300 });
    expect(zero.gmd).toBe(0);
  });

  it('mesmo dia nunca é anterior', () => {
    expect(calculateWeightGain({ history: [{ data_pesagem: '2026-03-01', peso: 300 }], date: '2026-03-01', weight: 310 }).gmd).toBeNull();
  });
});
