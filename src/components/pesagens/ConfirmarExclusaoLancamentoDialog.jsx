import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Exclusão de um lançamento pelo Lançamento. `bloqueado`: o lançamento é o cadastro
// original de um animal com histórico (plano de exclusão com cascata bloqueada).
export default function ConfirmarExclusaoLancamentoDialog({ pesagem, bloqueado = false, onCancel, onConfirm }) {
  const animal = `${pesagem?.numero_animal} / Marca ${pesagem?.marca || '-'}`;
  return (
    <Dialog open={Boolean(pesagem)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogDescription>{bloqueado
            ? `O cadastro original de ${animal} possui histórico e não pode ser excluído. Inative o animal ou cancele somente um evento.`
            : `Somente este lançamento de ${animal} será excluído. O cadastro e os demais registros serão preservados.`}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="d17b-standard-dialog__footer"><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button className="emp-toolbar-btn-delete" disabled={bloqueado} onClick={onConfirm}>Excluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
