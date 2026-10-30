import { describe, expect, it } from 'vitest';
import { monthlyObserved, projectWeight, scenarioResolver } from './projection.js';
import { resolveTarget, validateTargetInput } from './targets.js';

describe('projeção diária', () => {
  const base = { peso_kg: 300, data: '2026-01-01', origem: 'BALANCA' };
  it('oráculo 314,6 kg e bissexto', () => {
    const r = scenarioResolver({ gmd_por_mes: { 1: 0.2, 2: 0.3 } });
    expect(projectWeight(base, '2026-03-01', r).peso_kg).toBe(314.6);
    expect(projectWeight({ ...base, data: '2028-01-01' }, '2028-03-01', r).peso_kg).toBe(314.9);
  });
  it('regime planejado prevalece sobre o cenário', () => {
    const r = scenarioResolver({ gmd_kg_dia: 0.5 }, { regimes: [{ de: '2026-01-11', ate: '2026-01-21', gmd: 1 }] });
    expect(projectWeight(base, '2026-01-31', r).peso_kg).toBe(300 + 10 * 0.5 + 10 * 1 + 10 * 0.5);
  });
  it('intervalo que atravessa meses não vira GMD mensal', () => {
    expect(monthlyObserved([{ de: '2026-01-15', ate: '2026-02-14', dias: 30, ganho: 15, gmd: 0.5 }]).meses).toEqual({});
  });
});

describe('metas', () => {
  const geral = { id: 'g', ...validateTargetInput({ escopo: 'GERAL', tipo: 'GMD', gmd_kg_dia: 0.4, vigencia_inicio: '2026-01-01' }) };
  const lote = { id: 'l', ...validateTargetInput({ escopo: 'LOTE', alvo_id: 'L1', tipo: 'GMD', gmd_kg_dia: 0.6, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-06-30' }) };
  it('precedência e vigência', () => {
    expect(resolveTarget([geral, lote], { lote_id: 'L1' }, '2026-03-01').meta.id).toBe('l');
    expect(resolveTarget([geral, lote], { lote_id: 'L1' }, '2026-07-01').meta.id).toBe('g');
    expect(resolveTarget([geral, lote], { lote_id: 'L2' }, '2026-03-01').nivel).toBe('GERAL');
  });
  it('conflito no mesmo nível não aplica nenhuma', () => {
    const a = { id: 'a', ...validateTargetInput({ escopo: 'COORTE', coorte: { sexo: 'M' }, tipo: 'GMD', gmd_kg_dia: 0.5, vigencia_inicio: '2026-01-01' }) };
    const b = { id: 'b', ...validateTargetInput({ escopo: 'COORTE', coorte: { raca_id: 'R' }, tipo: 'GMD', gmd_kg_dia: 0.7, vigencia_inicio: '2026-01-01' }) };
    const r = resolveTarget([a, b], { sexo: 'M', raca_id: 'R' }, '2026-02-01');
    expect(r.meta).toBeNull();
    expect(r.conflito).toHaveLength(2);
  });
});
