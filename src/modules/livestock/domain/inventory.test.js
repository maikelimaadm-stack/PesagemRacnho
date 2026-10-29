import { describe, expect, it } from 'vitest';
import { computeInventory, previousDay } from './inventory.js';

const mov = (id, animal, natureza, data, tipo, extra = {}) => ({ id, animal_id: animal, natureza, data_evento: data, tipo, created_at: `${data}T00:00:00Z`, ...extra });
const fontes = (extra = {}) => ({
  animais: [
    { id: 'A', numero_animal: '1', sexo: 'M' },
    { id: 'B', numero_animal: '2', sexo: 'F', data_saida: '2026-02-10' },
    { id: 'C', numero_animal: '3', sexo: 'M' },
  ],
  movimentos: [
    mov('e1', 'A', 'ENTRADA', '2026-01-05', 'Entrada'),
    mov('e2', 'B', 'ENTRADA', '2026-01-05', 'Compra', { operacao_id: 'OP' }),
    mov('s2', 'B', 'SAIDA', '2026-02-10', 'Morte'),
    mov('e3', 'C', 'ENTRADA', '2026-02-01', 'Nascimento'),
  ],
  operacoes: [{ id: 'OP', subtipo: 'COMPRA' }],
  animalLotes: [],
  cadastros: [],
  ...extra,
});

describe('inventory', () => {
  it('dia anterior atravessa mês e ano', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });

  it('saldo inicial + entradas − saídas = final, pela data do evento', () => {
    const inv = computeInventory(fontes(), { from: '2026-02-01', to: '2026-02-28' });
    expect(inv.saldo_inicial).toBe(2);
    expect(inv.entradas.por_classe.NASCIMENTO).toBe(1);
    expect(inv.saidas.por_classe.MORTE).toBe(1);
    expect(inv.saldo_final).toBe(2);
    expect(inv.conferencia.fecha).toBe(true);
  });

  it('janeiro: compra classificada pela operação, cadastro antigo à parte', () => {
    const inv = computeInventory(fontes(), { from: '2026-01-01', to: '2026-01-31' });
    expect(inv.entradas.por_classe.COMPRA).toBe(1);
    expect(inv.entradas.por_classe.CADASTRO_LEGADO).toBe(1);
    expect(inv.saldo_final).toBe(2);
  });

  it('divergência: animal com Cadastro e sem movimento de entrada', () => {
    const inv = computeInventory(fontes({ animais: [...fontes().animais, { id: 'D', numero_animal: '4' }], cadastros: [{ animal_id: 'D', data_pesagem: '2026-01-02' }] }), { from: '2026-01-01', to: '2026-01-31' });
    expect(inv.conferencia.fecha).toBe(false);
    expect(inv.conferencia.divergencias[0]).toMatchObject({ numero_animal: '4' });
  });

  it('por lote: transferência interna recebida não é compra', () => {
    const inv = computeInventory(fontes({ animalLotes: [
      { animal_id: 'A', lote_id: 'L1', inicio: '2026-01-05', fim: '2026-02-15' },
      { animal_id: 'A', lote_id: 'L2', inicio: '2026-02-15', fim: null },
    ] }), { from: '2026-02-01', to: '2026-02-28', filtros: { lote_id: 'L2' } });
    expect(inv.internas.recebidas).toBe(1);
    expect(inv.entradas.total).toBe(0);
    expect(inv.saldo_final).toBe(1);
  });

  it('período inválido é recusado', () => {
    expect(() => computeInventory(fontes(), { from: '2026-03-01', to: '2026-02-01' })).toThrow(/Período/);
  });
});
