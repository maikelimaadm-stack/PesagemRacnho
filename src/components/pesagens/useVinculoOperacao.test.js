import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVinculoOperacao, vinculoConferido } from './useVinculoOperacao';

const adiado = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, erro) => { resolve = ok; reject = erro; });
  return { promise, resolve, reject };
};

describe('useVinculoOperacao — consulta do vínculo antes de excluir (fail-closed)', () => {
  it('falha na consulta NÃO vira "sem vínculo": fica em erro e não libera a exclusão', async () => {
    const consultar = vi.fn().mockRejectedValue(new Error('IndexedDB indisponível'));
    const { result } = renderHook(() => useVinculoOperacao(consultar));
    await act(() => result.current.consultar('p1'));
    expect(result.current.estado).toMatchObject({ status: 'erro', pesagemId: 'p1', vinculo: null, erro: 'IndexedDB indisponível' });
    expect(vinculoConferido(result.current.estado, 'p1')).toBe(false);
  });

  it('enquanto carrega não libera; concluída sem vínculo libera só para a mesma pesagem', async () => {
    const pendente = adiado();
    const { result } = renderHook(() => useVinculoOperacao(() => pendente.promise));
    let consulta;
    act(() => { consulta = result.current.consultar('p1'); });
    expect(result.current.estado.status).toBe('carregando');
    expect(vinculoConferido(result.current.estado, 'p1')).toBe(false);
    await act(async () => { pendente.resolve(null); await consulta; });
    expect(vinculoConferido(result.current.estado, 'p1')).toBe(true);
    expect(vinculoConferido(result.current.estado, 'p2')).toBe(false);
  });

  it('resposta atrasada do animal A não libera excluir o animal B', async () => {
    const a = adiado();
    const b = adiado();
    const consultar = vi.fn((id) => (id === 'A' ? a.promise : b.promise));
    const { result } = renderHook(() => useVinculoOperacao(consultar));
    let pa;
    let pb;
    act(() => { pa = result.current.consultar('A'); });
    act(() => { pb = result.current.consultar('B'); });
    await act(async () => { a.resolve(null); await pa; });
    expect(result.current.estado).toMatchObject({ status: 'carregando', pesagemId: 'B' });
    await act(async () => { b.resolve({ operacao: { id: 'op', tipo: 'SAIDA' }, quantidade: 1 }); await pb; });
    expect(result.current.estado).toMatchObject({ status: 'pronto', pesagemId: 'B' });
    expect(result.current.estado.vinculo.operacao.id).toBe('op');
  });

  it('tentar de novo depois da falha consulta outra vez', async () => {
    const consultar = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useVinculoOperacao(consultar));
    await act(() => result.current.consultar('p1'));
    expect(result.current.estado.status).toBe('erro');
    await act(() => result.current.consultar('p1'));
    expect(vinculoConferido(result.current.estado, 'p1')).toBe(true);
  });
});
