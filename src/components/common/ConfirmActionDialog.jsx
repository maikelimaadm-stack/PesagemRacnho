import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ConfirmActionDialog({
  open,
  onOpenChange,
  title = 'Confirmar operação',
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  destructive = false,
  busy = false,
  showCancel = true,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="d17b-standard-dialog__footer">
          {showCancel && <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>}
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            className={destructive ? 'emp-toolbar-btn-delete' : 'emp-toolbar-btn emp-toolbar-btn-save'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Processando…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
