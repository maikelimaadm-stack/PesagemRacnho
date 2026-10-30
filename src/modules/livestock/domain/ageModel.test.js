import { describe, expect, it } from 'vitest';
import { AGE_POLICY_DEFAULTS, ageAt, categoriaProdutiva, completedMonths, eraAt, normalizeAgePolicy, validateBirthInput } from './ageModel.js';

describe('ageModel', () => {
  it('meses completos por aniversário, inclusive fim de mês e ano bissexto', () => {
    expect(completedMonths('2025-01-31', '2025-02-27')).toBe(0);
    expect(completedMonths('2025-01-31', '2025-02-28')).toBe(1);
    expect(completedMonths('2024-01-31', '2024-02-29')).toBe(1);
    expect(completedMonths('2024-02-29', '2025-02-28')).toBe(12);
    expect(completedMonths('2025-03-15', '2026-03-14')).toBe(11);
  });

  it('sem dado: desconhecida (nenhuma data inventada)', () => {
    const idade = ageAt({}, '2026-01-01');
    expect(idade.desconhecida).toBe(true);
    expect(eraAt({}, '2026-01-01')).toBeNull();
  });

  it('mês estimado dá faixa; idade declarada conta da data de referência', () => {
    const mes = ageAt({ nascimento_data: '2025-03-01', nascimento_precisao: 'MES' }, '2025-04-15');
    expect([mes.min, mes.max, mes.estimada]).toEqual([0, 1, true]);
    const decl = ageAt({ nascimento_precisao: 'IDADE_DECLARADA', idade_declarada_meses: 10, idade_referencia_data: '2026-01-20' }, '2026-03-20');
    expect(decl.meses).toBe(12);
  });

  it('era pela faixa; limite incerto marcado; categoria só sugerida com política ligada', () => {
    const animal = { nascimento_data: '2025-01-10', nascimento_precisao: 'DIA', sexo: 'F' };
    expect(eraAt(animal, '2026-02-10').rotulo).toBe('13 a 24 meses');
    expect(eraAt(animal, '2026-01-10').rotulo).toBe('0 a 12 meses', '12 meses completos ainda é a 1ª faixa (limite inclusivo)');
    expect(categoriaProdutiva(animal, '2026-02-10').valor).toBeNull();
    const policy = normalizeAgePolicy({ ...AGE_POLICY_DEFAULTS, sugerir_categoria_produtiva: true });
    expect(categoriaProdutiva(animal, '2026-02-10', policy)).toEqual({ valor: 'Novilha', origem: 'SUGERIDA' });
    expect(categoriaProdutiva({ ...animal, categoria_produtiva: 'Matriz' }, '2026-02-10', policy)).toEqual({ valor: 'Matriz', origem: 'INFORMADA' });
  });

  it('valida nascimento e política', () => {
    expect(() => validateBirthInput({ nascimento_precisao: 'MES', nascimento_mes: '2025-13', nascimento_fonte: 'OUTRA' })).toThrow(/mês e o ano/);
    expect(validateBirthInput({ nascimento_precisao: 'DESCONHECIDA' }).nascimento_data).toBeNull();
    expect(() => normalizeAgePolicy({ faixas_meses: [12, 12] })).toThrow(/crescentes/);
  });
});
