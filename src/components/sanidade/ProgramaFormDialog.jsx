// Diálogo de novo/editar programa ou procedimento sanitário. Sem registry.write abre só
// para consulta (campos desabilitados, sem Salvar). Enter salva; a gravação é do chamador.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SanidadeField, SanidadeSelect, SanidadeTextArea, SanidadeTextInput } from './SanidadeFormFields.jsx';
import { emptyProgramaForm, programaFormFromRecord, programaInputFromForm, validateProgramaForm } from './sanidadeModel.js';

export default function ProgramaFormDialog({ open, record, readOnly, busy, tipos, tipoLabels, empresaId, onOpenChange, onSubmit }) {
  const [form, setForm] = useState(emptyProgramaForm);
  useEffect(() => {
    if (open) setForm(record ? programaFormFromRecord(record) : emptyProgramaForm());
  }, [open, record]);
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event?.preventDefault?.();
    if (readOnly || busy) return;
    const erros = validateProgramaForm(form, tipos);
    if (erros.length) {
      toast.error(erros.join(' '));
      return;
    }
    onSubmit(programaInputFromForm(form, { id: record?.id, empresaId }));
  };

  const title = readOnly ? 'Consultar programa' : record ? 'Editar programa' : 'Novo programa';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog sanidade-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Programas e procedimentos organizam o que é aplicado no rebanho (ex.: vacinação, vermifugação).{readOnly ? ' Somente leitura para o seu papel.' : ''}</DialogDescription>
        </DialogHeader>
        <form className="d17b-standard-dialog__body sanidade-form" onSubmit={submit}>
          <SanidadeField id="programa-nome" label="Nome" required wide>
            <SanidadeTextInput id="programa-nome" value={form.nome} onChange={setField('nome')} disabled={readOnly} autoFocus={!readOnly} maxLength={120} />
          </SanidadeField>
          <SanidadeField id="programa-tipo" label="Tipo" required>
            <SanidadeSelect id="programa-tipo" value={form.tipo} onChange={setField('tipo')} disabled={readOnly} required options={tipos.map((tipo) => ({ value: tipo, label: tipoLabels[tipo] ?? tipo }))} />
          </SanidadeField>
          <SanidadeField id="programa-ordem" label="Ordem" hint="Posição nas listas (menor aparece primeiro).">
            <SanidadeTextInput id="programa-ordem" value={form.ordem} onChange={setField('ordem')} disabled={readOnly} inputMode="numeric" maxLength={6} />
          </SanidadeField>
          <SanidadeField id="programa-descricao" label="Descrição" wide>
            <SanidadeTextArea id="programa-descricao" value={form.descricao} onChange={setField('descricao')} disabled={readOnly} maxLength={1000} />
          </SanidadeField>
          <button type="submit" className="sr-only" disabled={readOnly}>Salvar</button>
        </form>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{readOnly ? 'Fechar' : 'Cancelar'}</Button>
          {!readOnly ? <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={busy} onClick={submit}>{busy ? 'Salvando…' : 'Salvar'}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
