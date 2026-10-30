import { describe, expect, it } from 'vitest';
import { computeDose, missingForApproval, validatePosologyInput, withdrawalEnd, withdrawalStatus } from './posology.js';

const aprovada = (extra = {}) => ({
  ...validatePosologyInput({ medicamento_id: 'M', modo: 'PROPORCIONAL', unidade: 'ml', dose_por_unidade: 1, kg_por_unidade: 50, principio_ativo: 'P', apresentacao: 'A', indicacao: 'I', via_aplicacao: 'SC', carencia_carne_dias: 30, fonte: 'BULA', vigencia_inicio: '2026-01-01', ...extra }),
  status: 'APROVADA',
});
const peso = (kg, origem = 'BALANCA', data = '2026-03-01') => ({ kg, origem, data });

describe('posology', () => {
  it('arredondamento é da regra (nenhum, próximo, acima, abaixo)', () => {
    expect(computeDose(aprovada(), peso(312), { dataAplicacao: '2026-03-01' }).dose).toBe(6.24);
    expect(computeDose(aprovada({ arredondamento: { modo: 'PROXIMO', passo: 0.5 } }), peso(312), { dataAplicacao: '2026-03-01' }).dose).toBe(6);
    expect(computeDose(aprovada({ arredondamento: { modo: 'ACIMA', passo: 0.5 } }), peso(312), { dataAplicacao: '2026-03-01' }).dose).toBe(6.5);
    expect(computeDose(aprovada({ arredondamento: { modo: 'ABAIXO', passo: 1 } }), peso(349), { dataAplicacao: '2026-03-01' }).dose).toBe(6);
  });

  it('incompleta, rascunho, peso ausente/estimado não calculam', () => {
    expect(computeDose({ ...aprovada(), status: 'RASCUNHO' }, peso(300), { dataAplicacao: '2026-03-01' }).ok).toBe(false);
    expect(computeDose({ ...aprovada(), principio_ativo: null }, peso(300), { dataAplicacao: '2026-03-01' }).bloqueios[0]).toMatch(/incompleta/);
    expect(computeDose(aprovada(), peso(null), { dataAplicacao: '2026-03-01' }).ok).toBe(false);
    expect(computeDose(aprovada(), peso(300, 'PROJETADO'), { dataAplicacao: '2026-03-01' }).ok).toBe(false);
    expect(computeDose(null, peso(300)).bloqueios[0]).toMatch(/sem posologia/);
  });

  it('carência zero ≠ desconhecida; data civil atravessa mês', () => {
    expect(withdrawalEnd('2026-01-30', { posologia: { carencia_carne_dias: 30 } }).carencia_carne_ate).toBe('2026-03-01');
    expect(withdrawalEnd('2026-03-01', { medicamento: { carencia_dias: 0 } }).carencia_carne_ate).toBe('2026-03-01');
    expect(withdrawalEnd('2026-03-01', { medicamento: {} }).carencia_carne_ate).toBeNull();
    const st = withdrawalStatus([
      { id: 'a', data: '2026-03-01', carencia_carne_ate: '2026-03-31', medicamento_id: 'M' },
      { id: 'b', data: '2026-03-05', carencia_carne_ate: null, carencia_conhecida: false, medicamento_id: 'X' },
      { id: 'c', data: '2026-03-02', carencia_carne_ate: '2026-04-30', medicamento_id: 'M', cancelled_at: 'x' },
    ], '2026-03-31');
    expect([st.emCarencia, st.desconhecidas.length]).toEqual([false, 1]);
  });

  it('o que falta para aprovar', () => {
    expect(missingForApproval({ modo: 'PROPORCIONAL' })).toContain('fonte (bula, receituário ou protocolo)');
    expect(missingForApproval(aprovada())).toEqual([]);
  });
});
