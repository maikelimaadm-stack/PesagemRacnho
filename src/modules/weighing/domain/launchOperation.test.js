import { describe, expect, it } from 'vitest';
import {
  SUBTIPO_SAIDA_POR_MOTIVO,
  buildLaunchOperationInput,
  launchOperationMessage,
  launchUsesOperation,
} from './launchOperation.js';

describe('launchOperation — Lançamento × livro de operações', () => {
  it('Entrada e Saída novas viram operação; Manejo, edição, repesagem e SN seguem como pesagem', () => {
    expect(launchUsesOperation({ tipoManejo: 'Cadastro', numeroAnimal: '101' })).toBe(true);
    expect(launchUsesOperation({ tipoManejo: 'Saída', numeroAnimal: '101' })).toBe(true);
    expect(launchUsesOperation({ tipoManejo: 'Manejo', numeroAnimal: '101' })).toBe(false);
    expect(launchUsesOperation({ tipoManejo: 'Cadastro', numeroAnimal: '101', editing: true })).toBe(false);
    expect(launchUsesOperation({ tipoManejo: 'Saída', numeroAnimal: '101', repesagem: true })).toBe(false);
    expect(launchUsesOperation({ tipoManejo: 'Cadastro', numeroAnimal: 'SN 3' })).toBe(false);
  });

  it('motivos históricos de saída mapeiam para os subtipos da v9', () => {
    expect(SUBTIPO_SAIDA_POR_MOTIVO).toEqual({ Venda: 'VENDA', Abate: 'ABATE', 'Transferência': 'TRANSFERENCIA_ENVIADA', Morte: 'MORTE', 'Doação': 'DOACAO', Outros: 'AJUSTE_SAIDA' });
  });

  it('Compra: cabeçalho, item e pesagem vêm dos mesmos dados da tela', () => {
    const pesagem = { tipo_manejo: 'Cadastro', peso: 300 };
    const input = buildLaunchOperationInput({
      id: 'c1', tipoManejo: 'Cadastro', subtipoEntrada: 'COMPRA', dataPesagem: '2026-03-01', pesagem,
      numeroAnimal: ' 101 ', marcaId: 'MK', sexo: 'M', loteId: 'L1', pesoKg: 300, pesoOrigem: 'BALANCA', valor: 2500, gtaNumero: 'G1',
    });
    expect(input).toMatchObject({ id: 'c1', tipo: 'ENTRADA', subtipo: 'COMPRA', data: '2026-03-01', gta_numero: 'G1', pesagem });
    expect(input.item).toMatchObject({ numero_animal: '101', marca_id: 'MK', sexo: 'M', lote_id: 'L1', peso_kg: 300, peso_origem: 'BALANCA', valor: 2500 });
  });

  it('Saída sem peso: nada de peso nem origem inventados; causa só na Morte', () => {
    const morte = buildLaunchOperationInput({ id: 's1', tipoManejo: 'Saída', motivoSaida: 'Morte', dataPesagem: '2026-04-01', pesagem: {}, animalId: 'A1', causaMorteId: 'CM1' });
    expect(morte.item).toMatchObject({ animal_id: 'A1', peso_kg: null, peso_origem: null, causa_morte_id: 'CM1' });
    const venda = buildLaunchOperationInput({ id: 's2', tipoManejo: 'Saída', motivoSaida: 'Venda', dataPesagem: '2026-04-01', pesagem: {}, animalId: 'A1', causaMorteId: 'CM1', pesoKg: 360 });
    expect(venda.item.causa_morte_id).toBeNull();
    expect(() => buildLaunchOperationInput({ id: 's3', tipoManejo: 'Saída', motivoSaida: '', pesagem: {} })).toThrow(/motivo/);
  });

  it('mensagem de sucesso diz tipo, animal, pesagem e referência', () => {
    const msg = launchOperationMessage({ operacao: { id: 'abcdef123456', tipo: 'SAIDA', subtipo: 'VENDA' }, itens: [{ pesagem_id: 'p1' }] }, { numeroAnimal: '101' });
    expect(msg).toBe('Saída confirmada: animal 101 · Venda · com pesagem · operação abcdef12');
    const semPeso = launchOperationMessage({ operacao: { id: 'x', tipo: 'ENTRADA', subtipo: 'NASCIMENTO' }, itens: [{ pesagem_id: null }] }, { numeroAnimal: '7' });
    expect(semPeso).toMatch(/Entrada confirmada: animal 7 · Nascimento · sem pesagem — animal pendente de pesagem/);
  });
});
