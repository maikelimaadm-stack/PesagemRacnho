import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categoriesForSex } from '@/modules/operations/domain/categorySuggestion';
import { CATEGORIA_AUTOMATICA } from '@/modules/weighing/domain/launchContext';

// Perfil do animal SN: os mesmos seletores do Cadastro no Lançamento, na mesma
// ordem (sexo, categoria, raça, marca). Tudo é SELECIONADO dos cadastros mestres
// (nunca texto livre); "Automático" escolhe a categoria pelo peso ao salvar.
// O perfil confirmado vale só para o SN salvo: não vira contexto do Cadastro (V-07).
const EMPTY_PROFILE = { sexo: 'M', marca: '', marcaId: '', raca: '', racaId: '', categoriaSelecao: CATEGORIA_AUTOMATICA };
const NONE = '__none__';

export default function ConfirmarAnimalSnDialog({
  open,
  onOpenChange,
  initialValue,
  inherited,
  marcas = [],
  racas = [],
  categorias = [],
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
  const categoriasDoSexo = useMemo(() => categoriesForSex(categorias, form.sexo), [categorias, form.sexo]);
  const categoriaValida = form.categoriaSelecao === CATEGORIA_AUTOMATICA
    || categoriasDoSexo.some((item) => item.id === form.categoriaSelecao);

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
    onConfirm({
      sexo: String(form.sexo).trim(),
      marca: marca.nome,
      marcaId: marca.id,
      raca: raca.nome,
      racaId: raca.id,
      categoriaSelecao: categoriaValida ? form.categoriaSelecao : CATEGORIA_AUTOMATICA,
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
              <SelectTrigger aria-label="Sexo do animal SN"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="F">F</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={categoriaValida ? form.categoriaSelecao : CATEGORIA_AUTOMATICA} onValueChange={(value) => update({ categoriaSelecao: value })}>
              <SelectTrigger aria-label="Categoria do animal SN"><SelectValue placeholder="Automático" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={CATEGORIA_AUTOMATICA}>Automático (pelo peso)</SelectItem>
                {categoriasDoSexo.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
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
            <Label>Marca</Label>
            <Select value={form.marcaId || NONE} onValueChange={(value) => { const marca = marcasAtivas.find((item) => item.id === value); update({ marcaId: marca?.id ?? '', marca: marca?.nome ?? '' }); }}>
              <SelectTrigger aria-label="Marca do animal SN"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Selecione a marca</SelectItem>
                {marcasAtivas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
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
