// Diálogo de novo/editar medicamento ou produto. Dose padrão é texto livre de referência
// (ex.: "10" ou "1 ml / 50 kg"): quando é só um número vira dose sugerida na aplicação;
// não há cálculo por peso, estoque nem prescrição. Sem registry.write abre para consulta.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SanidadeField, SanidadeSelect, SanidadeTextArea, SanidadeTextInput } from './SanidadeFormFields.jsx';
import { emptyMedicamentoForm, medicamentoFormFromRecord, medicamentoInputFromForm, validateMedicamentoForm } from './sanidadeModel.js';

export default function MedicamentoFormDialog({ open, record, readOnly, busy, unidades, vias, viaLabels, empresaId, onOpenChange, onSubmit }) {
  const [form, setForm] = useState(emptyMedicamentoForm);
  useEffect(() => {
    if (open) setForm(record ? medicamentoFormFromRecord(record) : emptyMedicamentoForm());
  }, [open, record]);
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event?.preventDefault?.();
    if (readOnly || busy) return;
    const erros = validateMedicamentoForm(form, { unidades, vias });
    if (erros.length) {
      toast.error(erros.join(' '));
      return;
    }
    onSubmit(medicamentoInputFromForm(form, { id: record?.id, empresaId }));
  };

  const title = readOnly ? 'Consultar medicamento' : record ? 'Editar medicamento' : 'Novo medicamento';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog sanidade-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Produto usado nas aplicações. Unidade, via e dose padrão são sugeridas ao aplicar e podem ser alteradas.{readOnly ? ' Somente leitura para o seu papel.' : ''}</DialogDescription>
        </DialogHeader>
        <form className="d17b-standard-dialog__body sanidade-form" onSubmit={submit}>
          <SanidadeField id="medicamento-nome" label="Nome" required wide>
            <SanidadeTextInput id="medicamento-nome" value={form.nome} onChange={setField('nome')} disabled={readOnly} autoFocus={!readOnly} maxLength={120} />
          </SanidadeField>
          <SanidadeField id="medicamento-principio" label="Princípio ativo">
            <SanidadeTextInput id="medicamento-principio" value={form.principio_ativo} onChange={setField('principio_ativo')} disabled={readOnly} maxLength={120} />
          </SanidadeField>
          <SanidadeField id="medicamento-fabricante" label="Fabricante">
            <SanidadeTextInput id="medicamento-fabricante" value={form.fabricante} onChange={setField('fabricante')} disabled={readOnly} maxLength={120} />
          </SanidadeField>
          <SanidadeField id="medicamento-unidade" label="Unidade padrão">
            <SanidadeSelect id="medicamento-unidade" value={form.unidade_padrao} onChange={setField('unidade_padrao')} disabled={readOnly} noneLabel="Nenhuma" options={unidades.map((unidade) => ({ value: unidade, label: unidade }))} />
          </SanidadeField>
          <SanidadeField id="medicamento-dose" label="Dose padrão" hint="Referência: um número (ex.: 10) vira sugestão na aplicação; texto (ex.: 1 ml / 50 kg) só é exibido.">
            <SanidadeTextInput id="medicamento-dose" value={form.dose_padrao} onChange={setField('dose_padrao')} disabled={readOnly} maxLength={60} />
          </SanidadeField>
          <SanidadeField id="medicamento-via" label="Via de aplicação">
            <SanidadeSelect id="medicamento-via" value={form.via_aplicacao} onChange={setField('via_aplicacao')} disabled={readOnly} noneLabel="Nenhuma" options={vias.map((via) => ({ value: via, label: viaLabels[via] ?? via }))} />
          </SanidadeField>
          <SanidadeField id="medicamento-carencia" label="Carência (dias)" hint="Informativa; não bloqueia vendas nem abates.">
            <SanidadeTextInput id="medicamento-carencia" value={form.carencia_dias} onChange={setField('carencia_dias')} disabled={readOnly} inputMode="numeric" maxLength={4} />
          </SanidadeField>
          <SanidadeField id="medicamento-observacao" label="Observação" wide>
            <SanidadeTextArea id="medicamento-observacao" value={form.observacao} onChange={setField('observacao')} disabled={readOnly} maxLength={1000} />
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
