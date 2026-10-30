import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Avisos da conferência da operação (ex.: carência aberta numa venda) antes de confirmar a Entrada/Saída do
// Lançamento. Nada foi gravado; "Confirmar mesmo assim" salva o mesmo lançamento com a ciência registrada.
// Bloqueios (ex.: abate com carência) não passam por aqui: o serviço recusa.
export default function OperacaoAvisosDialog({ avisos, onCancel, onConfirm }) {
  return (
    <Dialog open={Boolean(avisos?.length)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Confira antes de confirmar</DialogTitle>
          <DialogDescription>Nada foi gravado ainda. Confira os avisos da operação:</DialogDescription>
        </DialogHeader>
        <ul className="d17b-standard-dialog__body list-disc pl-5 text-sm" aria-label="Avisos da operação">
          {(avisos || []).map((aviso) => <li key={aviso}>{aviso}</li>)}
        </ul>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button variant="outline" onClick={onCancel}>Voltar</Button>
          <Button className="emp-toolbar-btn emp-toolbar-btn-save" onClick={onConfirm}>Confirmar mesmo assim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
