// Cancelamento de aplicação com motivo obrigatório. O fato histórico nunca é apagado: o
// serviço grava cancelled_at e motivo_cancelamento (weighing.edit) e a linha continua
// visível com "Incluir canceladas" e na Ficha do Animal.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SanidadeField, SanidadeTextArea } from './SanidadeFormFields.jsx';
import { formatDateBR, formatDose, medicamentoNomeDe, programaNomeDe } from './sanidadeModel.js';

export default function CancelarAplicacaoDialog({ application, animal, busy, onOpenChange, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const open = Boolean(application);
  useEffect(() => { if (open) setMotivo(''); }, [open]);

  const submit = (event) => {
    event?.preventDefault?.();
    if (busy) return;
    if (!motivo.trim()) {
      toast.error('Informe o motivo do cancelamento.');
      return;
    }
    onConfirm(motivo.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact sanidade-dialog">
        <DialogHeader>
          <DialogTitle>Cancelar aplicação</DialogTitle>
          <DialogDescription>A aplicação continua no histórico marcada como cancelada, com o motivo informado.</DialogDescription>
        </DialogHeader>
        <form className="d17b-standard-dialog__body sanidade-form sanidade-form--single" onSubmit={submit}>
          {application ? (
            <dl className="sanidade-summary">
              <div><dt>Data</dt><dd>{formatDateBR(application.data)}</dd></div>
              <div><dt>Animal</dt><dd>{animal ? `${animal.numero} · ${animal.marca}` : '—'}</dd></div>
              <div><dt>Programa</dt><dd>{programaNomeDe(application)}</dd></div>
              <div><dt>Medicamento</dt><dd>{medicamentoNomeDe(application)}</dd></div>
              <div><dt>Dose</dt><dd>{formatDose(application.dose, application.unidade)}</dd></div>
            </dl>
          ) : null}
          <SanidadeField id="cancelar-motivo" label="Motivo do cancelamento" required wide>
            <SanidadeTextArea id="cancelar-motivo" value={motivo} onChange={setMotivo} rows={3} maxLength={500} />
          </SanidadeField>
        </form>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button type="button" variant="destructive" className="emp-toolbar-btn-delete" disabled={busy} onClick={submit}>{busy ? 'Cancelando…' : 'Cancelar aplicação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
