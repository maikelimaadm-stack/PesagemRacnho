import { describe, expect, it } from 'vitest';
import { assertCode, assertTransition, currentSituation, expandRange, physicalCount } from './identifierStock.js';

describe('identifierStock', () => {
  it('faixa preserva zeros e limita tamanho', () => {
    expect(expandRange({ prefixo: 'b', inicio: '0098', fim: '0101' })).toEqual(['B0098', 'B0099', 'B0100', 'B0101']);
    expect(() => expandRange({ inicio: 10, fim: 1 })).toThrow(/Faixa inválida/);
    expect(() => expandRange({ inicio: 1, fim: 6000 })).toThrow(/5.000/);
  });

  it('SN e SISBOV curto recusados', () => {
    expect(() => assertCode('BRINCO', ' sn ')).toThrow(/não é um código de estoque/);
    expect(() => assertCode('SISBOV', '123')).toThrow(/15 dígitos/);
    expect(assertCode('rfid', ' 982 000 1 ').valor_normalizado).toBe('9820001');
  });

  it('situação pela última ação; oficial não volta depois de aplicado', () => {
    const hist = [
      { acao: 'RECEBIDO', data: '2026-01-01', created_at: 'a' },
      { acao: 'APLICADO', data: '2026-01-02', created_at: 'b', animal_id: 'X' },
      { acao: 'PERDIDO', data: '2026-01-03', created_at: 'c' },
    ];
    expect(currentSituation(hist).situacao).toBe('PERDIDO');
    expect(() => assertTransition('SISBOV', 'DISPONIVEL', 'APLICADO', hist)).toThrow(/reaproveitado/);
    expect(() => assertTransition('BRINCO', 'APLICADO', 'DEVOLVIDO', hist)).toThrow(/não é possível/);
    expect(assertTransition('BRINCO', 'RESERVADO', 'APLICADO', [])).toBe('APLICADO');
  });

  it('conferência física só compara', () => {
    const sistema = [{ valor_normalizado: 'A1', situacao: 'DISPONIVEL' }, { valor_normalizado: 'A2', situacao: 'APLICADO' }];
    expect(physicalCount(sistema, ['a1'])).toMatchObject({ fecha: true, faltando: [], sobrando: [] });
    expect(physicalCount(sistema, ['A2'])).toMatchObject({ fecha: false, faltando: ['A1'], sobrando: [{ valor: 'A2', situacao_no_sistema: 'APLICADO' }] });
  });
});
