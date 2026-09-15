import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MakDateControl from '@/components/mak/MakDateControl';
import { suggestCategory } from '@/modules/operations/domain/categorySuggestion';

// Perfil do animal SN: os mesmos seletores do Cadastro no Lançamento. Marca,
// raça e categoria são SELECIONADAS dos cadastros mestres (nunca texto livre);
// a categoria é sugerida por sexo + nascimento e a escolha manual prevalece.
const EMPTY_PROFILE = { sexo: 'M', marca: '', marcaId: '', raca: '', racaId: '', categoriaId: '', categoriaOrigem: '', nascimento: '', nascimentoEstimado: false };
const NONE = '__none__';

export default function ConfirmarAnimalSnDialog({
  open,
  onOpenChange,
  initialValue,
  inherited,
  marcas = [],
  racas = [],
  categorias = [],
  referenceDate,
  onConfirm,
}) {
  const [form, setForm] = useState(EMPTY_PROFILE);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_PROFILE, ...(initialValue || {}) });
  }, [open, initialValue]);

  const update = (patch) => setForm((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));

  const marcasAtivas = useMemo(() => marcas.filter((item) => item && item.ativo !== false), [marcas]);
  const racasAtivas = useMemo(() => racas.filter((item) => item && item.ativo !== false), [racas]);
  const categoriasAtivas = useMemo(() => categorias.filter((item) => item && item.ativo !== false), [categorias]);

  // Sugestão automática: só quando a categoria não foi escolhida manualmente.
  useEffect(() => {
    if (!open || form.categoriaOrigem === 'manual') return;
    const sugerida = suggestCategory({ categorias: categoriasAtivas, sexo: form.sexo, nascimento: form.nascimento, referenceDate });
    const proximoId = sugerida?.id ?? '';
    if (proximoId !== form.categoriaId || (proximoId && form.categoriaOrigem !== 'sugerida')) {
      update({ categoriaId: proximoId, categoriaOrigem: proximoId ? 'sugerida' : '' });
    }
  }, [open, form.sexo, form.nascimento, form.categoriaOrigem, form.categoriaId, categoriasAtivas, referenceDate]);

  const confirmar = () => {
    const marca = marcasAtivas.find((item) => item.id === form.marcaId);
    const raca = racasAtivas.find((item) => item.id === form.racaId);
    if (!String(form.sexo || '').trim()) {
      toast.error('Informe o campo Sexo do animal SN.');
      return;
    }
    if (!marca) {
      toast.error('Selecione a marca cadastrada do animal SN.');
      return;
    }
    if (!raca) {
      toast.error('Selecione a raça cadastrada do animal SN.');
      return;
    }
    const categoria = categoriasAtivas.find((item) => item.id === form.categoriaId) || null;
    onConfirm({
      sexo: String(form.sexo).trim(),
      marca: marca.nome,
      marcaId: marca.id,
      raca: raca.nome,
      racaId: raca.id,
      categoriaId: categoria?.id ?? '',
      categoriaOrigem: categoria ? form.categoriaOrigem || 'manual' : '',
      nascimento: form.nascimento || '',
      nascimentoEstimado: Boolean(form.nascimento) && Boolean(form.nascimentoEstimado),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17d-sn-dialog">
        <DialogHeader>
          <DialogTitle>Dados do animal SN</DialogTitle>
          <DialogDescription>
            {inherited
              ? 'Os dados do último SN foram preenchidos. Confira antes de salvar o lançamento atual.'
              : 'Informe os dados do animal SN antes de salvar o lançamento.'}
          </DialogDescription>
        </DialogHeader>

        <div className="d17b-standard-dialog__body d17d-sn-dialog__grid">
          <div className="space-y-1">
            <Label>Sexo</Label>
            <Select value={form.sexo} onValueChange={(value) => update({ sexo: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="F">F</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Marca</Label>
            <Select value={form.marcaId || NONE} onValueChange={(value) => { const marca = marcasAtivas.find((item) => item.id === value); update({ marcaId: marca?.id ?? '', marca: marca?.nome ?? '' }); }}>
              <SelectTrigger aria-label="Marca do animal SN"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Selecione a marca</SelectItem>
                {marcasAtivas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Raça</Label>
            <Select value={form.racaId || NONE} onValueChange={(value) => { const raca = racasAtivas.find((item) => item.id === value); update({ racaId: raca?.id ?? '', raca: raca?.nome ?? '' }); }}>
              <SelectTrigger aria-label="Raça do animal SN"><SelectValue placeholder="Selecione a raça" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Selecione a raça</SelectItem>
                {racasAtivas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nascimento <span className="text-slate-500 font-normal">(opcional)</span></Label>
            <MakDateControl value={form.nascimento} onChange={(event) => update({ nascimento: event.target.value || '' })} ariaLabel="Data de nascimento do animal SN" />
            {form.nascimento ? (
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={Boolean(form.nascimentoEstimado)} onChange={(event) => update({ nascimentoEstimado: event.target.checked })} aria-label="Nascimento estimado" />
                Estimado
              </label>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Categoria {form.categoriaOrigem === 'sugerida' ? <span className="text-emerald-700 font-normal">(sugerida)</span> : form.categoriaOrigem === 'manual' ? <span className="text-slate-500 font-normal">(manual)</span> : null}</Label>
            <Select value={form.categoriaId || NONE} onValueChange={(value) => update(value === NONE ? { categoriaId: '', categoriaOrigem: '' } : { categoriaId: value, categoriaOrigem: 'manual' })}>
              <SelectTrigger aria-label="Categoria do animal SN"><SelectValue placeholder="Automática" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Automática (sexo e nascimento)</SelectItem>
                {categoriasAtivas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={confirmar}>Confirmar e salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
