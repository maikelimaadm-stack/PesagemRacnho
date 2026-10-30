import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Exclusão de um lançamento pelo Lançamento. `bloqueado`: o lançamento é o cadastro
// original de um animal com histórico (plano de exclusão com cascata bloqueada), ou pertence a uma operação com
// vários animais. `operacao` ({ operacao, quantidade }): a pesagem é a Entrada/Saída de uma operação — excluir
// cancela a operação com motivo (auditado), nunca apaga em silêncio.
// `consulta` (useVinculoOperacao): enquanto a consulta do vínculo carrega ou se ela falhou, NADA pode ser
// confirmado (fail-closed); a falha explica que nada foi apagado e oferece "Tentar de novo".
export default function ConfirmarExclusaoLancamentoDialog({ pesagem, bloqueado = false, operacao: operacaoProp = null, consulta = null, onRetry, onCancel, onConfirm }) {
  const animal = `${pesagem?.numero_animal} / Marca ${pesagem?.marca || '-'}`;
  const [motivo, setMotivo] = useState('');
  useEffect(() => { if (pesagem) setMotivo(''); }, [pesagem]);
  const status = consulta ? consulta.status : 'pronto';
  const operacao = consulta ? consulta.vinculo : operacaoProp;
  const vinculada = status === 'pronto' && Boolean(operacao?.operacao);
  const bloqueio = vinculada ? operacao.quantidade > 1 : bloqueado;
  let descricao;
  if (status === 'carregando' || status === 'ocioso') {
    descricao = `Conferindo se o lançamento de ${animal} pertence a uma operação de Entrada/Saída…`;
  } else if (status === 'erro') {
    descricao = `Não foi possível confirmar se o lançamento de ${animal} pertence a uma operação. Nenhum dado foi apagado.`;
  } else if (vinculada) {
    descricao = bloqueio
      ? `Este lançamento de ${animal} faz parte de uma operação com ${operacao.quantidade} animais. Cancele-a em Rebanho › ${operacao.operacao.tipo === 'ENTRADA' ? 'Entradas' : 'Saídas'}.`
      : `Este lançamento de ${animal} é a ${operacao.operacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada como operação. Excluir cancela a operação: o efeito no rebanho, no livro e no inventário é desfeito e o motivo fica na auditoria.`;
  } else {
    descricao = bloqueio
      ? `O cadastro original de ${animal} possui histórico e não pode ser excluído. Inative o animal ou cancele somente um evento.`
      : `Somente este lançamento de ${animal} será excluído. O cadastro e os demais registros serão preservados.`;
  }
  const conferido = status === 'pronto';
  const motivoOk = !vinculada || motivo.trim().length >= 3;
  return (
    <Dialog open={Boolean(pesagem)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{vinculada ? 'Cancelar operação' : 'Confirmar exclusão'}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {status === 'erro' ? (
          <div className="d17b-standard-dialog__body space-y-2" role="alert">
            <p className="text-xs text-red-700">{consulta?.erro}</p>
            <Button type="button" variant="outline" onClick={onRetry}>Tentar de novo</Button>
          </div>
        ) : null}
        {vinculada && !bloqueio ? (
          <div className="d17b-standard-dialog__body space-y-1">
            <Label htmlFor="motivo-cancelamento-operacao" className="text-xs font-medium">Motivo do cancelamento <span className="text-red-500">*</span></Label>
            <Input id="motivo-cancelamento-operacao" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: lançado no animal errado" aria-label="Motivo do cancelamento" />
          </div>
        ) : null}
        <DialogFooter className="d17b-standard-dialog__footer"><Button variant="outline" onClick={onCancel}>Voltar</Button><Button className="emp-toolbar-btn-delete" disabled={!conferido || bloqueio || !motivoOk} onClick={() => onConfirm(vinculada ? motivo.trim() : undefined)}>{vinculada ? 'Cancelar operação' : 'Excluir'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
