// Registro de aplicação avulsa (sem pesagem): animal, data, programa e/ou medicamento,
// dose, unidade, via e observação. Escolher o medicamento sugere unidade, via e dose
// (só em campos vazios). Aplicações feitas no Lançamento nascem junto da pesagem e não
// passam por aqui. A gravação (weighing.write) é do chamador; o serviço valida de novo.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MakDateControl from '@/components/mak/MakDateControl';
import AnimalSearchField from './AnimalSearchField.jsx';
import { SanidadeField, SanidadeSelect, SanidadeTextArea, SanidadeTextInput } from './SanidadeFormFields.jsx';
import {
  aplicacaoInputFromForm,
  applyMedicamentoDefaults,
  catalogOptions,
  emptyAplicacaoForm,
  formatCarencia,
  validateAplicacaoForm,
} from './sanidadeModel.js';

export default function AplicacaoFormDialog({
  open,
  busy,
  animalIndex,
  animalsLoading,
  initialAnimal,
  programas,
  medicamentos,
  unidades,
  vias,
  viaLabels,
  suggestDose,
  onOpenChange,
  onSubmit,
}) {
  const [form, setForm] = useState(() => emptyAplicacaoForm());
  useEffect(() => {
    if (open) setForm({ ...emptyAplicacaoForm(), animal: initialAnimal || null });
  }, [open, initialAnimal]);
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const medicamento = useMemo(() => medicamentos.find((item) => item.id === form.medicamento_id) || null, [medicamentos, form.medicamento_id]);

  const chooseMedicamento = (id) => {
    const escolhido = medicamentos.find((item) => item.id === id) || null;
    setForm((current) => applyMedicamentoDefaults({ ...current, medicamento_id: id }, escolhido, suggestDose));
  };

  const submit = (event) => {
    event?.preventDefault?.();
    if (busy) return;
    const erros = validateAplicacaoForm(form);
    if (erros.length) {
      toast.error(erros.join(' '));
      return;
    }
    onSubmit(aplicacaoInputFromForm(form));
  };

  const referencia = medicamento
    ? [medicamento.dose_padrao ? `Dose padrão: ${medicamento.dose_padrao}` : null, medicamento.carencia_dias != null && medicamento.carencia_dias !== '' ? `Carência: ${formatCarencia(medicamento.carencia_dias)}` : null].filter(Boolean).join(' · ')
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog sanidade-dialog">
        <DialogHeader>
          <DialogTitle>Registrar aplicação</DialogTitle>
          <DialogDescription>Aplicação avulsa, sem pesagem. Para aplicar durante a pesagem, use o Lançamento.</DialogDescription>
        </DialogHeader>
        <form className="d17b-standard-dialog__body sanidade-form" onSubmit={submit}>
          <SanidadeField id="aplicacao-animal" label="Animal" required>
            <AnimalSearchField id="aplicacao-animal" index={animalIndex} loading={animalsLoading} value={form.animal} onChange={setField('animal')} autoFocus={!initialAnimal} />
          </SanidadeField>
          <SanidadeField id="aplicacao-data" label="Data" required>
            <MakDateControl value={form.data} onChange={(event) => setField('data')(event.target.value)} ariaLabel="Data da aplicação" className="sanidade-form__date" />
          </SanidadeField>
          <SanidadeField id="aplicacao-programa" label="Programa/procedimento" hint="Informe o programa, o medicamento ou os dois.">
            <SanidadeSelect id="aplicacao-programa" value={form.programa_sanidade_id} onChange={setField('programa_sanidade_id')} options={catalogOptions(programas, form.programa_sanidade_id)} />
          </SanidadeField>
          <SanidadeField id="aplicacao-medicamento" label="Medicamento/produto" hint={referencia || undefined}>
            <SanidadeSelect id="aplicacao-medicamento" value={form.medicamento_id} onChange={chooseMedicamento} options={catalogOptions(medicamentos, form.medicamento_id)} />
          </SanidadeField>
          <SanidadeField id="aplicacao-dose" label="Dose">
            <SanidadeTextInput id="aplicacao-dose" value={form.dose} onChange={setField('dose')} inputMode="decimal" maxLength={12} placeholder="Ex.: 10 ou 2,5" />
          </SanidadeField>
          <SanidadeField id="aplicacao-unidade" label="Unidade">
            <SanidadeSelect id="aplicacao-unidade" value={form.unidade} onChange={setField('unidade')} noneLabel="Nenhuma" options={unidades.map((unidade) => ({ value: unidade, label: unidade }))} />
          </SanidadeField>
          <SanidadeField id="aplicacao-via" label="Via de aplicação">
            <SanidadeSelect id="aplicacao-via" value={form.via_aplicacao} onChange={setField('via_aplicacao')} noneLabel="Nenhuma" options={vias.map((via) => ({ value: via, label: viaLabels[via] ?? via }))} />
          </SanidadeField>
          <SanidadeField id="aplicacao-observacao" label="Observação" wide>
            <SanidadeTextArea id="aplicacao-observacao" value={form.observacao} onChange={setField('observacao')} rows={2} maxLength={500} />
          </SanidadeField>
          <button type="submit" className="sr-only">Registrar</button>
        </form>
        <DialogFooter className="d17b-standard-dialog__footer">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={busy} onClick={submit}>{busy ? 'Registrando…' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
