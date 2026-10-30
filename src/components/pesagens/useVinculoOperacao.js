import { useCallback, useRef, useState } from 'react';

// Consulta "esta pesagem pertence a uma operação?" antes de excluir no Lançamento — FAIL-CLOSED:
//   carregando → não se confirma nada; erro → nada é excluído (o operador tenta de novo);
//   pronto     → `vinculo` (operação + quantidade de animais) ou null (pesagem sem operação).
// Cada consulta tem um número: resposta atrasada de uma consulta anterior (outro animal ou tentativa anterior)
// é descartada e nunca libera a exclusão de outro lançamento.
export const VINCULO_OCIOSO = Object.freeze({ status: 'ocioso', pesagemId: null, vinculo: null, erro: null });

export function useVinculoOperacao(consultarVinculo) {
  const [estado, setEstado] = useState(VINCULO_OCIOSO);
  const sequencia = useRef(0);
  const consultar = useCallback(async (pesagemId) => {
    sequencia.current += 1;
    const minha = sequencia.current;
    setEstado({ status: 'carregando', pesagemId, vinculo: null, erro: null });
    try {
      const vinculo = pesagemId ? await consultarVinculo(pesagemId) : null;
      if (sequencia.current !== minha) return;
      setEstado({ status: 'pronto', pesagemId, vinculo: vinculo || null, erro: null });
    } catch (error) {
      if (sequencia.current !== minha) return;
      setEstado({ status: 'erro', pesagemId, vinculo: null, erro: error?.message || 'falha ao consultar a operação' });
    }
  }, [consultarVinculo]);
  const limpar = useCallback(() => {
    sequencia.current += 1;
    setEstado(VINCULO_OCIOSO);
  }, []);
  return { estado, consultar, limpar };
}

/** Só com a consulta concluída PARA ESTA pesagem dá para decidir o que o Excluir faz. */
export function vinculoConferido(estado, pesagemId) {
  return Boolean(pesagemId) && estado?.status === 'pronto' && estado.pesagemId === pesagemId;
}
