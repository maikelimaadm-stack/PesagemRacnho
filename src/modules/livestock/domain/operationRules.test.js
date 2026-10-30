import { describe, expect, it } from 'vitest';
import { checkConference, summarizeOperation, validateHeader, validateItem } from './operationRules.js';

const header = (extra = {}) => validateHeader({ tipo: 'SAIDA', subtipo: 'VENDA', data: '2026-03-01', ...extra });

describe('operationRules', () => {
  it('recusa data futura e subtipo de outro tipo', () => {
    expect(() => validateHeader({ tipo: 'ENTRADA', subtipo: 'VENDA', data: '2026-03-01' })).toThrow(/tipo de entrada/i);
    expect(() => validateHeader({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: `${new Date().getFullYear() + 1}-01-01` })).toThrow(/futuro/);
  });

  it('ajuste exige justificativa; mudança de lote exige o destino', () => {
    expect(() => validateHeader({ tipo: 'SAIDA', subtipo: 'AJUSTE_SAIDA', data: '2026-03-01' })).toThrow(/justificativa/);
    expect(() => validateHeader({ tipo: 'MOVIMENTACAO', subtipo: 'MUDANCA_LOTE', data: '2026-03-01' })).toThrow(/lote de destino/);
  });

  it('Venda exige peso; Morte aceita sem peso e nunca vira 0 kg', () => {
    expect(() => validateItem(header(), { animal_id: 'A' })).toThrow(/exige o peso/);
    const morte = validateItem(header({ subtipo: 'MORTE' }), { animal_id: 'A' });
    expect(morte.peso_kg).toBeNull();
    expect(() => validateItem(header(), { animal_id: 'A', peso: '0' })).toThrow(/maior que zero/);
    // R07: mesma regra do Lançamento — inteiro por truncamento (antes arredondava para 313).
    expect(validateItem(header(), { animal_id: 'A', peso: '312,6' }).peso_kg).toBe(312);
  });

  it('entrada de animal novo exige sexo; mãe só no nascimento', () => {
    const compra = validateHeader({ tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-03-01' });
    expect(() => validateItem(compra, { numero_animal: '1' })).toThrow(/sexo/);
    expect(validateItem(compra, { numero_animal: '1', sexo: 'f', mae_animal_id: 'X' }).mae_animal_id).toBeNull();
  });

  it('conferência: animal e identificação repetidos bloqueiam; quantidade divergente avisa', () => {
    const h = { tipo: 'ENTRADA', quantidade_prevista: 3 };
    const conf = checkConference(h, [{ dados: { numero_animal: '9', marca_id: 'M' } }, { dados: { numero_animal: '9', marca_id: 'M' }, peso_kg: 200 }]);
    expect(conf.ok).toBe(false);
    expect(conf.bloqueios[0]).toMatch(/Identificação repetida/);
    expect(conf.avisos.some((a) => /prevista 3, conferida 2/.test(a))).toBe(true);
    expect(checkConference({ tipo: 'SAIDA' }, [{ animal_id: 'A' }, { animal_id: 'A' }]).ok).toBe(false);
  });

  it('resumo usa só pesos medidos/informados e valores informados', () => {
    const r = summarizeOperation({ valor_total: null }, [{ peso_kg: 200, valor: 1000 }, { peso_kg: null, valor: 1000 }]);
    expect(r).toMatchObject({ quantidade: 2, pesados: 1, sem_peso: 1, peso_total_kg: 200, peso_medio_kg: 200, valor_total: 2000, valor_por_cabeca: 1000 });
  });
});
