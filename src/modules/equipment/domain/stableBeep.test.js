import { describe, expect, it } from 'vitest';
import { createStableBeepTracker } from './stableBeep';

const serie = (tracker, leituras) => leituras.map((l) => tracker.update(l));

describe('bip de peso estável (pesagem automática)', () => {
  it('um bip quando a balança libera o peso estável do animal; nenhum enquanto oscila', () => {
    const t = createStableBeepTracker();
    expect(serie(t, [
      { kg: 0, liberado: false },
      { kg: 150, liberado: false },
      { kg: 312, liberado: false },
      { kg: 328, liberado: true },
      { kg: 328, liberado: true },
      { kg: 328, liberado: true },
    ])).toEqual([false, false, false, true, false, false]);
  });

  it('nunca bipa com a plataforma vazia ou peso 0, mesmo que algo chegue "liberado"', () => {
    const t = createStableBeepTracker();
    expect(serie(t, [{ kg: 0, liberado: true }, { kg: 3, liberado: true }, { kg: null, liberado: true }, { kg: '', liberado: true }])).toEqual([false, false, false, false]);
  });

  it('animal mexe e volta ao mesmo peso: não bipa de novo; esvaziar a plataforma rearma', () => {
    const t = createStableBeepTracker();
    expect(serie(t, [
      { kg: 328, liberado: true },
      { kg: 340, liberado: false },
      { kg: 328.5, liberado: true },
      { kg: 0, liberado: false },
      { kg: 328, liberado: true },
    ])).toEqual([true, false, false, false, true]);
  });

  it('depois de salvar, só bipa de novo quando o portão liberar o próximo animal (peso diferente)', () => {
    const t = createStableBeepTracker();
    expect(serie(t, [
      { kg: 328, liberado: true },
      { kg: 328, liberado: false },
      { kg: 280, liberado: false },
      { kg: 295, liberado: true },
    ])).toEqual([true, false, false, true]);
  });

  it('reset (pesagem automática religada) volta ao começo', () => {
    const t = createStableBeepTracker();
    expect(t.update({ kg: 328, liberado: true })).toBe(true);
    t.reset();
    expect(t.update({ kg: 328, liberado: true })).toBe(true);
  });
});
