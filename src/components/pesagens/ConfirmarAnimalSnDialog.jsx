import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY_PROFILE = { sexo: 'M', raca: 'Nelore', era: '', marca: '' };

export default function ConfirmarAnimalSnDialog({
  open,
  onOpenChange,
  initialValue,
  inherited,
  racas = [],
  eras = [],
  marcas = [],
  onConfirm,
}) {
  const [form, setForm] = useState(EMPTY_PROFILE);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_PROFILE, ...(initialValue || {}) });
  }, [open, initialValue]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const confirmar = () => {
    const profile = {
      sexo: String(form.sexo || '').trim(),
      raca: String(form.raca || '').trim(),
      era: String(form.era || '').trim(),
      marca: String(form.marca || '').trim(),
    };

    const missing = [
      ['sexo', 'Sexo'],
      ['raca', 'Raça'],
      ['era', 'Era'],
      ['marca', 'Marca'],
    ].find(([field]) => !profile[field]);

    if (missing) {
      toast.error(`Informe o campo ${missing[1]} do animal SN.`);
      return;
    }

    onConfirm(profile);
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
            <Select value={form.sexo} onValueChange={(value) => update('sexo', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="F">F</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Raça</Label>
            <Input value={form.raca} onChange={(event) => update('raca', event.target.value)} list="sn-racas" placeholder="Ex: Nelore" />
            <datalist id="sn-racas">{racas.map((value) => <option key={value} value={value} />)}</datalist>
          </div>
          <div className="space-y-1">
            <Label>Era</Label>
            <Input value={form.era} onChange={(event) => update('era', event.target.value)} list="sn-eras" placeholder="Ex: 14" />
            <datalist id="sn-eras">{eras.map((value) => <option key={value} value={value} />)}</datalist>
          </div>
          <div className="space-y-1">
            <Label>Marca</Label>
            <Input value={form.marca} onChange={(event) => update('marca', event.target.value)} list="sn-marcas" placeholder="Ex: ABC" />
            <datalist id="sn-marcas">{marcas.map((value) => <option key={value} value={value} />)}</datalist>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={confirmar}>Confirmar e salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
