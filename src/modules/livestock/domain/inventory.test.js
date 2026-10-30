import { describe, expect, it } from 'vitest';
import { LOCAL_INDETERMINADO, computeInventory, previousDay } from './inventory.js';

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

  describe('R06: propriedade na data, não a atual', () => {
    // X: entrou em P1 (destino registrado), foi para P2 em 05/03 — hoje está em P2.
    // Y: entrada antiga SEM destino e sem movimentação; hoje o cadastro diz P2 (pode ter sido editado depois).
    // Z: entrada sem destino, mas movimentação P1 → P2 em 10/03 (a origem diz onde estava antes).
    const fontesProp = (extra = {}) => ({
      animais: [
        { id: 'X', numero_animal: 'X', propriedade_id: 'P2' },
        { id: 'Y', numero_animal: 'Y', propriedade_id: 'P2' },
        { id: 'Z', numero_animal: 'Z', propriedade_id: 'P2' },
      ],
      movimentos: [
        mov('ex', 'X', 'ENTRADA', '2026-01-10', 'Compra', { propriedade_destino_id: 'P1' }),
        mov('ix', 'X', 'INTERNA', '2026-03-05', 'Mudança de propriedade', { propriedade_origem_id: 'P1', propriedade_destino_id: 'P2' }),
        mov('ey', 'Y', 'ENTRADA', '2026-01-10', 'Entrada'),
        mov('ez', 'Z', 'ENTRADA', '2026-01-10', 'Entrada'),
        mov('iz', 'Z', 'INTERNA', '2026-03-10', 'Mudança de propriedade', { propriedade_origem_id: 'P1', propriedade_destino_id: 'P2' }),
      ],
      operacoes: [],
      animalLotes: [],
      cadastros: [],
      propriedadesIds: ['P1', 'P2'],
      ...extra,
    });
    const em = (from, to, propriedade_id, extra) => computeInventory(fontesProp(extra), { from, to, filtros: { propriedade_id } });

    it('fevereiro: X e Z estavam em P1; Y é INDETERMINADO (não vai para P2 pelo cadastro atual)', () => {
      const p1 = em('2026-02-01', '2026-02-28', 'P1');
      const p2 = em('2026-02-01', '2026-02-28', 'P2');
      expect(p1.animais_no_saldo_final.map((a) => a.id).sort()).toEqual(['X', 'Z']);
      expect(p2.saldo_final).toBe(0);
      expect(p2.conferencia.indeterminados.map((a) => a.animal_id)).toEqual(['Y']);
      expect(p2.limitacoes.some((l) => /INDETERMINADO/.test(l))).toBe(true);
      expect(p2.conferencia.fecha).toBe(false);
    });

    it('março: transferências internas aparecem enviadas/recebidas na data', () => {
      const p1 = em('2026-03-01', '2026-03-31', 'P1');
      const p2 = em('2026-03-01', '2026-03-31', 'P2');
      expect([p1.saldo_inicial, p1.internas.enviadas, p1.saldo_final]).toEqual([2, 2, 0]);
      expect([p2.saldo_inicial, p2.internas.recebidas, p2.saldo_final]).toEqual([0, 2, 2]);
    });

    it('conciliação: soma das propriedades + indeterminados = rebanho na data', () => {
      const total = computeInventory(fontesProp(), { from: '2026-02-01', to: '2026-02-28' }).saldo_final;
      const p1 = em('2026-02-01', '2026-02-28', 'P1');
      const p2 = em('2026-02-01', '2026-02-28', 'P2');
      expect(p1.saldo_final + p2.saldo_final + p2.conferencia.indeterminados.length).toBe(total);
    });

    it('com uma única propriedade já cadastrada, o local não é indeterminado', () => {
      const unica = computeInventory(fontesProp({ animais: [{ id: 'Y', numero_animal: 'Y', propriedade_id: 'P1' }], movimentos: [mov('ey', 'Y', 'ENTRADA', '2026-01-10', 'Entrada')], propriedadesIds: ['P1'] }), { from: '2026-02-01', to: '2026-02-28', filtros: { propriedade_id: 'P1' } });
      expect([unica.saldo_final, unica.conferencia.indeterminados.length]).toEqual([1, 0]);
      expect(LOCAL_INDETERMINADO).toBe('INDETERMINADO');
    });

    it('filtro de categoria declara que usa a categoria atual', () => {
      const inv = computeInventory(fontes(), { from: '2026-02-01', to: '2026-02-28', filtros: { categoria_id: 'C1' } });
      expect(inv.limitacoes.some((l) => /categoria ATUAL/.test(l))).toBe(true);
    });
  });
});
