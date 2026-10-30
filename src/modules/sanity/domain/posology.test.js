import { describe, expect, it } from 'vitest';
import { JANELA_CARENCIA_DESCONHECIDA_DIAS, computeDose, missingForApproval, releaseCoversUnknown, validatePosologyInput, withdrawalCase, withdrawalEnd, withdrawalStatus } from './posology.js';

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

  it('R05: zero, aberta, encerrada, cancelada e desconhecida são casos distintos', () => {
    const d = '2026-06-10';
    expect(withdrawalCase({ data: '2026-06-01', carencia_carne_ate: '2026-06-01', medicamento_id: 'M' }, d)).toBe('ZERO');
    expect(withdrawalCase({ data: '2026-06-01', carencia_carne_ate: '2026-06-11', medicamento_id: 'M' }, d)).toBe('ABERTA');
    expect(withdrawalCase({ data: '2026-06-01', carencia_carne_ate: '2026-06-10', medicamento_id: 'M' }, d)).toBe('ENCERRADA');
    expect(withdrawalCase({ data: '2026-06-01', carencia_carne_ate: '2026-07-01', medicamento_id: 'M', cancelled_at: 'x' }, d)).toBe('CANCELADA');
    expect(withdrawalCase({ data: '2026-06-01', carencia_carne_ate: null, carencia_conhecida: false, medicamento_id: 'X' }, d)).toBe('DESCONHECIDA');
    // Registro antigo sem o campo carencia_conhecida: desconhecida, nunca zero.
    expect(withdrawalCase({ data: '2026-06-01', medicamento_id: 'X' }, d)).toBe('DESCONHECIDA');
    expect(withdrawalCase({ data: '2026-06-01' }, d)).toBe('SEM_MEDICAMENTO');
    expect(withdrawalCase({ data: '2026-06-11', carencia_carne_ate: '2026-07-01', medicamento_id: 'M' }, d)).toBe('POSTERIOR');
  });

  it('R05: janela da carência desconhecida é 180 dias (antes 120)', () => {
    expect(JANELA_CARENCIA_DESCONHECIDA_DIAS).toBe(180);
    const app = (data) => ({ id: data, data, carencia_carne_ate: null, carencia_conhecida: false, medicamento_id: 'X' });
    expect(withdrawalStatus([app('2026-01-01')], '2026-05-31').desconhecidas).toHaveLength(1); // 150 dias: fora da janela antiga
    expect(withdrawalStatus([app('2025-12-01')], '2026-05-31').desconhecidas).toHaveLength(0); // 181 dias
  });

  it('R05: liberação só cobre carência desconhecida se for documentada', () => {
    expect(releaseCoversUnknown(null)).toBe(false);
    expect(releaseCoversUnknown({ responsavel: 'Dr. X CRMV 1', motivo: 'Laudo de resíduo negativo' })).toBe(false);
    expect(releaseCoversUnknown({ responsavel: 'Dr. X CRMV 1', motivo: 'Laudo de resíduo negativo', evidencia: 'Laudo 12/2026' })).toBe(true);
  });

  it('o que falta para aprovar', () => {
    expect(missingForApproval({ modo: 'PROPORCIONAL' })).toContain('fonte (bula, receituário ou protocolo)');
    expect(missingForApproval(aprovada())).toEqual([]);
  });
});
