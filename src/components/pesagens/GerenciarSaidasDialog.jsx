import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSetting, setSetting } from '@/modules/settings/application/settingsService';
import { fmtCurrency } from '@/components/common/formatNumber';

const vazioComprador = { nome: '', documento: '', telefone: '', cidade: '', observacoes: '' };
const vazioVenda = { nome: '', compradorId: '', comprador: '', destinoVenda: '', valorArroba: '', rendimentoCarcacaVenda: '50', valorVendaTotal: '', numeroGTAVenda: '', numeroNFeVenda: '', valorFreteVenda: '', observacoesVenda: '' };
const vazioAbate = { nome: '', frigorifico: '', valorArrobaAbate: '', rendimentoCarcacaAbate: '50', valorTotalAbate: '', numeroGTAAbate: '', observacoesAbate: '' };
const novoId = () => globalThis.crypto.randomUUID();

export default function GerenciarSaidasDialog({ open, onOpenChange, empresaId, initialTab = 'venda', onApply }) {
  const storageKey = `perfis-saida:${empresaId}`;
  const [tab, setTab] = useState(initialTab);
  const [perfis, setPerfis] = useState({ compradores: [], venda: [], abate: [] });
  const [form, setForm] = useState(vazioVenda);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setForm(initialTab === 'abate' ? vazioAbate : vazioVenda);
    setEditingId(null);
    getSetting(storageKey, { compradores: [], venda: [], abate: [] }).then((value) => setPerfis({ compradores: value?.compradores || [], venda: value?.venda || [], abate: value?.abate || [] }));
  }, [open, initialTab, storageKey]);

  const lista = useMemo(() => tab === 'compradores' ? perfis.compradores || [] : perfis[tab] || [], [perfis, tab]);
  const reset = (nextTab = tab) => { setForm(nextTab === 'compradores' ? { ...vazioComprador } : nextTab === 'abate' ? { ...vazioAbate } : { ...vazioVenda }); setEditingId(null); };
  const trocarTab = (nextTab) => { setTab(nextTab); reset(nextTab); };
  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const persistir = async (next) => { setPerfis(next); await setSetting(storageKey, next); };
  const salvar = async () => {
    if (!form.nome.trim()) return toast.error('Informe um nome para identificar o cadastro.');
    setIsSaving(true);
    try {
      const record = { ...form, id: editingId || novoId(), nome: form.nome.trim() };
      const updated = editingId ? lista.map((item) => item.id === editingId ? record : item) : [...lista, record];
      const bucket = tab === 'compradores' ? 'compradores' : tab;
      const nextPerfis = { ...perfis, [bucket]: updated };
      if (tab === 'compradores' && editingId) nextPerfis.venda = perfis.venda.map((sale) => sale.compradorId === editingId ? { ...sale, comprador: record.nome } : sale);
      await persistir(nextPerfis);
      toast.success(editingId ? 'Cadastro atualizado.' : 'Cadastro salvo.');
      reset();
    } finally { setIsSaving(false); }
  };
  const excluir = async (id) => {
    if (tab === 'compradores' && perfis.venda.some((item) => item.compradorId === id)) return toast.error('Este comprador está vinculado a um cadastro de venda.');
    const bucket = tab === 'compradores' ? 'compradores' : tab;
    await persistir({ ...perfis, [bucket]: lista.filter((item) => item.id !== id) });
    if (editingId === id) reset();
    toast.success('Cadastro excluído.');
  };

  const fields = tab === 'compradores'
    ? [['documento', 'CPF/CNPJ'], ['telefone', 'Telefone'], ['cidade', 'Cidade'], ['observacoes', 'Observações']]
    : tab === 'venda'
    ? [
      ['destinoVenda', 'Destino'], ['valorArroba', 'Valor da arroba', 'number'], ['valorVendaTotal', 'Valor total', 'number'],
      ['rendimentoCarcacaVenda', 'Rendimento de carcaça (%)', 'number'],
      ['numeroGTAVenda', 'Número GTA'], ['numeroNFeVenda', 'Número NF-e'], ['valorFreteVenda', 'Frete', 'number'], ['observacoesVenda', 'Observações'],
    ]
    : [
      ['frigorifico', 'Frigorífico'], ['valorArrobaAbate', 'Valor da arroba', 'number'], ['valorTotalAbate', 'Valor total', 'number'],
      ['rendimentoCarcacaAbate', 'Rendimento de carcaça (%)', 'number'],
      ['numeroGTAAbate', 'Número GTA'], ['observacoesAbate', 'Observações'],
    ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--large d17d-management-dialog overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Compradores, Vendas e Abates</DialogTitle><DialogDescription>Cadastre os dados uma vez, selecione o registro correto e aplique-o ao lançamento.</DialogDescription></DialogHeader>
        <div className="d17d-management-dialog__tabs flex gap-2 border-b pb-2">
          <Button variant={tab === 'compradores' ? 'default' : 'outline'} size="sm" onClick={() => trocarTab('compradores')}>Compradores</Button>
          <Button variant={tab === 'venda' ? 'default' : 'outline'} size="sm" onClick={() => trocarTab('venda')}>Vendas</Button>
          <Button variant={tab === 'abate' ? 'default' : 'outline'} size="sm" onClick={() => trocarTab('abate')}>Abates</Button>
        </div>
        <div className="d17b-standard-dialog__body d17d-management-dialog__body flex-1 overflow-auto space-y-3">
          <section className="d17d-management-form">
            <div className="d17d-management-form__heading"><div><strong>{editingId ? `Editar cadastro de ${tab}` : `Novo cadastro de ${tab}`}</strong><small>Salve uma vez e reutilize em vários lançamentos.</small></div></div>
            <div className="grid grid-cols-4 gap-2 items-end">
              <div className="space-y-1"><Label className="text-xs">{tab === 'compradores' ? 'Nome/Razão social' : 'Nome do cadastro'}</Label><Input value={form.nome || ''} onChange={setField('nome')} className="h-9 text-xs" placeholder={tab === 'compradores' ? 'Ex: Comprador ABC' : tab === 'venda' ? 'Ex: Venda frigorífico X' : 'Ex: Abate agosto'} /></div>
              {tab === 'venda' && <div className="space-y-1"><Label className="text-xs">Comprador</Label><Select value={form.compradorId || '__none__'} onValueChange={(value) => { const buyer = perfis.compradores.find((item) => item.id === value); setForm((current) => ({ ...current, compradorId: value === '__none__' ? '' : value, comprador: buyer?.nome || '' })); }}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o comprador" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sem comprador</SelectItem>{perfis.compradores.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>}
              {fields.map(([field, label, type]) => <div key={field} className={`space-y-1 ${field.startsWith('observacoes') ? 'col-span-2' : ''}`}><Label className="text-xs">{label}</Label><Input type="text" inputMode={type === 'number' ? 'decimal' : undefined} value={form[field] || ''} onChange={setField(field)} className="h-9 text-xs" /></div>)}
              <div className="flex gap-1"><Button size="sm" className="h-9 text-xs" disabled={isSaving} onClick={salvar}>{isSaving ? 'Salvando...' : editingId ? 'Atualizar' : 'Adicionar'}</Button>{editingId && <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => reset()}>Cancelar</Button>}</div>
            </div>
          </section>
          <div className="d17d-management-table">
            <Table>
              <TableHeader><TableRow><TableHead>Cadastro</TableHead><TableHead>{tab === 'compradores' ? 'Documento / Cidade' : tab === 'venda' ? 'Comprador / Destino' : 'Frigorífico'}</TableHead><TableHead className="text-right">{tab === 'compradores' ? 'Telefone' : 'Valor da arroba'}</TableHead><TableHead className="text-right">{tab === 'compradores' ? 'Vendas' : 'Valor total'}</TableHead><TableHead className="w-56">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {lista.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.nome}</TableCell><TableCell>{tab === 'compradores' ? [item.documento, item.cidade].filter(Boolean).join(' · ') || '-' : tab === 'venda' ? [item.comprador, item.destinoVenda].filter(Boolean).join(' · ') || '-' : item.frigorifico || '-'}</TableCell><TableCell className="text-right">{tab === 'compradores' ? item.telefone || '-' : fmtCurrency(tab === 'venda' ? item.valorArroba : item.valorArrobaAbate)}</TableCell><TableCell className="text-right">{tab === 'compradores' ? perfis.venda.filter((sale) => sale.compradorId === item.id).length : fmtCurrency(tab === 'venda' ? item.valorVendaTotal : item.valorTotalAbate)}</TableCell><TableCell><div className="flex gap-1">{tab !== 'compradores' && <Button size="sm" className="h-7 text-xs" onClick={() => { onApply?.(tab, item); onOpenChange(false); }}>Usar no lançamento</Button>}<Button variant="ghost" size="icon" onClick={() => { setEditingId(item.id); setForm(item); }}><Edit2 /></Button><Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteRequest(item)}><Trash2 /></Button></div></TableCell></TableRow>)}
                {lista.length === 0 && <TableRow><TableCell colSpan={5} className="d17d-empty-row">Nenhum cadastro de {tab}.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
      <Dialog open={Boolean(deleteRequest)} onOpenChange={(next) => { if (!next) setDeleteRequest(null); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
          <DialogHeader><DialogTitle>Excluir cadastro</DialogTitle><DialogDescription>Confirme a exclusão de “{deleteRequest?.nome}”. Cadastros vinculados continuam protegidos.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteRequest(null)}>Cancelar</Button><Button variant="destructive" onClick={async () => { const id = deleteRequest?.id; setDeleteRequest(null); if (id) await excluir(id); }}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
