import { describe, expect, it } from 'vitest';
import { JANELA_CARENCIA_DESCONHECIDA_DIAS, computeDose, missingForApproval, releaseCoversUnknown, validatePosologyInput, validateWithdrawalClarification, withdrawalCase, withdrawalEnd, withdrawalExitPolicy, withdrawalStatus } from './posology.js';

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

  it('R2-03: carência desconhecida não expira por decurso de tempo (180 dias só prioriza o alerta)', () => {
    expect(JANELA_CARENCIA_DESCONHECIDA_DIAS).toBe(180);
    const app = (data) => ({ id: data, data, carencia_carne_ate: null, carencia_conhecida: false, medicamento_id: 'X' });
    const dia = '2026-12-31';
    const antes = (n) => { const d = new Date(Date.UTC(2026, 11, 31)); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    for (const n of [0, 35, 150, 180, 181, 365, 1000]) {
      const st = withdrawalStatus([app(antes(n))], dia);
      expect(st.desconhecidas).toHaveLength(1);
      expect(st.desconhecidas[0].recente).toBe(n <= 180);
      expect(withdrawalExitPolicy({ status: st, subtipo: 'ABATE' }).bloqueios).toHaveLength(1);
    }
    // Registro antigo sem o campo carencia_conhecida também segue pendente.
    expect(withdrawalStatus([{ id: 'v', data: '2020-01-01', medicamento_id: 'X' }], dia).desconhecidas).toHaveLength(1);
    // Esclarecida (prazo registrado) deixa de ser desconhecida: aberta ou encerrada pela data.
    expect(withdrawalCase({ data: '2020-01-01', carencia_carne_ate: '2020-02-05', medicamento_id: 'X', carencia_esclarecimento: { fonte: 'bula' } }, dia)).toBe('ENCERRADA');
  });

  it('R2-03: política única de saída — abate bloqueia, venda/transferência avisam', () => {
    const st = withdrawalStatus([
      { id: 'a', data: '2026-06-01', carencia_carne_ate: '2026-07-01', medicamento_id: 'M' },
      { id: 'b', data: '2026-05-01', carencia_carne_ate: null, carencia_conhecida: false, medicamento_id: 'X' },
    ], '2026-06-10');
    expect(withdrawalExitPolicy({ status: st, subtipo: 'ABATE' }).bloqueios).toHaveLength(2);
    for (const subtipo of ['VENDA', 'TRANSFERENCIA_ENVIADA', 'DOACAO']) {
      const p = withdrawalExitPolicy({ status: st, subtipo });
      expect([p.bloqueios.length, p.avisos.length]).toEqual([0, 2]);
    }
    const valida = { responsavel: 'Dr. X CRMV 1', motivo: 'Laudo de resíduo negativo', evidencia: 'Laudo 12/2026', data: '2026-06-09' };
    expect(withdrawalExitPolicy({ status: st, subtipo: 'ABATE', liberacao: valida }).bloqueios).toHaveLength(0);
    // Liberação datada ANTES do tratamento não o cobre.
    expect(withdrawalExitPolicy({ status: st, subtipo: 'ABATE', liberacao: { ...valida, data: '2026-04-30' } }).bloqueios.length).toBeGreaterThan(0);
    // Sem evidência não cobre a desconhecida.
    expect(withdrawalExitPolicy({ status: st, subtipo: 'ABATE', liberacao: { ...valida, evidencia: '' } }).bloqueios.some((b) => /desconhecida/.test(b))).toBe(true);
    // Zero e encerrada não prendem.
    const livre = withdrawalStatus([{ id: 'z', data: '2026-06-01', carencia_carne_ate: '2026-06-01', medicamento_id: 'M' }, { id: 'e', data: '2026-01-01', carencia_carne_ate: '2026-02-01', medicamento_id: 'M' }], '2026-06-10');
    expect(withdrawalExitPolicy({ status: livre, subtipo: 'ABATE' }).bloqueios).toHaveLength(0);
  });

  it('R2-03: esclarecimento exige prazo, fonte e responsável', () => {
    expect(() => validateWithdrawalClarification({ carencia_carne_dias: 35, fonte: 'bula', responsavel: '' })).toThrow();
    expect(() => validateWithdrawalClarification({ carencia_carne_dias: -1, fonte: 'Bula do produto', responsavel: 'Dr. X' })).toThrow();
    expect(validateWithdrawalClarification({ carencia_carne_dias: 35, fonte: 'Bula do produto', responsavel: 'Dr. X CRMV 1' }).carencia_carne_dias).toBe(35);
  });

  it('o que falta para aprovar', () => {
    expect(missingForApproval({ modo: 'PROPORCIONAL' })).toContain('fonte (bula, receituário ou protocolo)');
    expect(missingForApproval(aprovada())).toEqual([]);
  });
});
