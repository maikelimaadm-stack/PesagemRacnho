import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Exclusão de um lançamento pelo Lançamento. `bloqueado`: o lançamento é o cadastro
// original de um animal com histórico (plano de exclusão com cascata bloqueada), ou pertence a uma operação com
// vários animais. `operacao` ({ operacao, quantidade }): a pesagem é a Entrada/Saída de uma operação — excluir
// cancela a operação com motivo (auditado), nunca apaga em silêncio.
export default function ConfirmarExclusaoLancamentoDialog({ pesagem, bloqueado = false, operacao = null, onCancel, onConfirm }) {
  const animal = `${pesagem?.numero_animal} / Marca ${pesagem?.marca || '-'}`;
  const [motivo, setMotivo] = useState('');
  useEffect(() => { if (pesagem) setMotivo(''); }, [pesagem]);
  const vinculada = Boolean(operacao?.operacao);
  const descricao = vinculada
    ? (bloqueado
      ? `Este lançamento de ${animal} faz parte de uma operação com ${operacao.quantidade} animais. Cancele-a em Rebanho › ${operacao.operacao.tipo === 'ENTRADA' ? 'Entradas' : 'Saídas'}.`
      : `Este lançamento de ${animal} é a ${operacao.operacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada como operação. Excluir cancela a operação: o efeito no rebanho, no livro e no inventário é desfeito e o motivo fica na auditoria.`)
    : (bloqueado
      ? `O cadastro original de ${animal} possui histórico e não pode ser excluído. Inative o animal ou cancele somente um evento.`
      : `Somente este lançamento de ${animal} será excluído. O cadastro e os demais registros serão preservados.`);
  const motivoOk = !vinculada || motivo.trim().length >= 3;
  return (
    <Dialog open={Boolean(pesagem)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{vinculada ? 'Cancelar operação' : 'Confirmar exclusão'}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {vinculada && !bloqueado ? (
          <div className="d17b-standard-dialog__body space-y-1">
            <Label htmlFor="motivo-cancelamento-operacao" className="text-xs font-medium">Motivo do cancelamento <span className="text-red-500">*</span></Label>
            <Input id="motivo-cancelamento-operacao" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: lançado no animal errado" aria-label="Motivo do cancelamento" />
          </div>
        ) : null}
        <DialogFooter className="d17b-standard-dialog__footer"><Button variant="outline" onClick={onCancel}>Voltar</Button><Button className="emp-toolbar-btn-delete" disabled={bloqueado || !motivoOk} onClick={() => onConfirm(vinculada ? motivo.trim() : undefined)}>{vinculada ? 'Cancelar operação' : 'Excluir'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
