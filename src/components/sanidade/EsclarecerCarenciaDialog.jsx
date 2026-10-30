// R2-03: esclarecimento da carência de uma aplicação que ficou DESCONHECIDA (medicamento sem carência na época).
// Prazo em dias, fonte (bula, receituário, laudo) e responsável técnico — tudo obrigatório e auditado. É o caminho
// para regularizar tratamentos antigos: a carência desconhecida não expira sozinha com o tempo.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SanidadeField, SanidadeTextInput } from './SanidadeFormFields.jsx';
import { formatDateBR, medicamentoNomeDe } from './sanidadeModel.js';

export default function EsclarecerCarenciaDialog({ application, animal, busy, onOpenChange, onConfirm }) {
  const [form, setForm] = useState({ dias: '', fonte: '', responsavel: '', zero: false });
  const open = Boolean(application);
  useEffect(() => { if (open) setForm({ dias: '', fonte: '', responsavel: '', zero: false }); }, [open]);
  const set = (campo) => (value) => setForm((f) => ({ ...f, [campo]: value }));

  const submit = (event) => {
    event?.preventDefault?.();
    if (busy) return;
    // A regra (vazio ≠ zero; zero só confirmado) é do domínio; aqui só se envia o texto como digitado.
    onConfirm({ carencia_carne_dias: form.dias, fonte: form.fonte, responsavel: form.responsavel, zero_confirmado: form.zero === true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact sanidade-dialog">
        <DialogHeader>
          <DialogTitle>Esclarecer carência</DialogTitle>
          <DialogDescription>O prazo vale a partir da data da aplicação. Fica registrado com a fonte, o responsável e a auditoria. Não é decisão veterinária automática.</DialogDescription>
        </DialogHeader>
        <form className="d17b-standard-dialog__body sanidade-form sanidade-form--single" onSubmit={submit}>
          {application ? (
            <dl className="sanidade-summary">
              <div><dt>Data</dt><dd>{formatDateBR(application.data)}</dd></div>
              <div><dt>Animal</dt><dd>{animal ? `${animal.numero} · ${animal.marca}` : '—'}</dd></div>
              <div><dt>Medicamento</dt><dd>{medicamentoNomeDe(application)}</dd></div>
            </dl>
          ) : null}
          <SanidadeField id="esclarecer-dias" label="Carência de carne (dias)" required>
            <SanidadeTextInput id="esclarecer-dias" value={form.dias} onChange={set('dias')} inputMode="numeric" maxLength={4} />
          </SanidadeField>
          {form.dias.trim() === '0' ? (
            <label className="rb-check"><input type="checkbox" checked={form.zero} onChange={(e) => setForm((f) => ({ ...f, zero: e.target.checked }))} /> Confirmo que a fonte indica carência de 0 dia (vazio ou "não sei" não é zero).</label>
          ) : null}
          <SanidadeField id="esclarecer-fonte" label="Fonte do prazo (bula, receituário, laudo)" required wide>
            <SanidadeTextInput id="esclarecer-fonte" value={form.fonte} onChange={set('fonte')} maxLength={200} />
          </SanidadeField>
          <SanidadeField id="esclarecer-responsavel" label="Responsável técnico (nome e registro)" required wide>
            <SanidadeTextInput id="esclarecer-responsavel" value={form.responsavel} onChange={set('responsavel')} maxLength={120} />
          </SanidadeField>
        </form>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button type="button" disabled={busy} onClick={submit}>{busy ? 'Gravando…' : 'Registrar carência'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
