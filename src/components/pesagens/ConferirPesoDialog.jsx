import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Peso fora das faixas operacionais de conferência: o lançamento só segue com uma
// justificativa, que vai para justificativa_alerta da pesagem. Cada abertura começa vazia.
export default function ConferirPesoDialog({ open, warnings = [], onCancel, onConfirm }) {
  const [justificativa, setJustificativa] = useState("");
  useEffect(() => { if (open) setJustificativa(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
        <DialogHeader>
          <DialogTitle>Conferir peso informado</DialogTitle>
          <DialogDescription>O lançamento pode ser válido, mas está fora das faixas operacionais de conferência.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">{warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul>
          <div className="space-y-1"><Label className="text-xs" htmlFor="conferir-peso-justificativa">Justificativa para continuar</Label><Input id="conferir-peso-justificativa" value={justificativa} onChange={(event) => setJustificativa(event.target.value)} placeholder="Ex.: peso conferido na balança" /></div>
        </div>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!justificativa.trim()} onClick={() => onConfirm(justificativa.trim())}>Confirmar e salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
