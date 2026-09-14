import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowUp, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const RESUMO_FIELDS = [
  { id: 'peso', label: 'Peso', kind: 'number' },
  { id: 'valor_pago_cabeca', label: 'Valor de compra', kind: 'currency' },
  { id: 'valor_venda_total', label: 'Valor de venda', kind: 'currency' },
  { id: 'valor_arroba', label: 'Valor da arroba', kind: 'currency' },
  { id: 'quantidade_arrobas', label: 'Quantidade de arrobas', kind: 'number' },
  { id: 'dias', label: 'Dias', kind: 'integer' },
  { id: 'ganho', label: 'Ganho', kind: 'number' },
  { id: 'gmd', label: 'GMD', kind: 'number' },
];
export const RESUMO_OPERATIONS = [
  { id: 'count', label: 'Contar registros' }, { id: 'sum', label: 'Somar' }, { id: 'average', label: 'Média (soma ÷ quantidade)' },
  { id: 'min', label: 'Menor valor' }, { id: 'max', label: 'Maior valor' }, { id: 'difference', label: 'Maior menos menor' }, { id: 'ratio', label: 'Dividir a soma por outro campo' },
];
export const RESUMO_SCOPES = [
  { id: 'dia', label: 'Todos do dia' }, { id: 'historico', label: 'Todo o histórico' }, { id: 'apartacao', label: 'Apartação selecionada' },
  { id: 'cadastro', label: 'Somente cadastros' }, { id: 'manejo', label: 'Somente manejos' }, { id: 'saida', label: 'Todas as saídas' },
  { id: 'venda', label: 'Somente vendas' }, { id: 'abate', label: 'Somente abates' },
];
export const RESUMO_GROUPS = [
  { id: 'none', label: 'Sem agrupamento' }, { id: 'nome_apartacao', label: 'Por apartação' }, { id: 'nome_lote', label: 'Por lote' },
  { id: 'tipo_manejo', label: 'Por tipo de movimento' }, { id: 'motivo_saida', label: 'Por motivo de saída' },
  { id: 'sexo', label: 'Por sexo' }, { id: 'marca', label: 'Por marca' },
];

const empty = { label: '', field: 'peso', operation: 'sum', divisorField: 'quantidade_arrobas', scope: 'dia', groupBy: 'none' };
const novoId = () => globalThis.crypto?.randomUUID?.() || `resumo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ConfigurarResumosDialog({ open, onOpenChange, value = [], onSave }) {
  const [items, setItems] = useState(value);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  useEffect(() => { if (open) { setItems(value); setForm(empty); setEditingId(null); } }, [open, value]);
  const reset = () => { setForm(empty); setEditingId(null); };
  const adicionar = () => {
    if (!form.label.trim()) return toast.error('Informe o nome que aparecerá no resumo.');
    const item = { ...form, id: editingId || novoId(), label: form.label.trim() };
    setItems((current) => editingId ? current.map((row) => row.id === editingId ? item : row) : [...current, item]);
    reset();
  };
  const salvarTudo = () => { onSave(items); onOpenChange(false); toast.success('Resumo personalizado salvo.'); };
  const move = (index, direction) => setItems((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const fieldLabel = (id) => RESUMO_FIELDS.find((field) => field.id === id)?.label || id;
  const operationLabel = (id) => RESUMO_OPERATIONS.find((operation) => operation.id === id)?.label || id;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="d17b-standard-dialog d17b-standard-dialog--large d17d-management-dialog overflow-hidden flex flex-col">
      <DialogHeader><DialogTitle>Configurar Resumo Personalizado</DialogTitle><DialogDescription className="sr-only">Escolha métricas, operações e o conjunto de registros usado nos cálculos.</DialogDescription></DialogHeader>
      <div className="d17b-standard-dialog__body flex-1 overflow-auto space-y-3">
        <section className="d17d-management-form">
          <div className="d17d-management-form__heading"><div><strong>{editingId ? 'Editar métrica' : 'Adicionar métrica'}</strong><small>Você pode contar, somar, calcular média, mínimo, máximo ou dividir totais.</small></div></div>
          <div className="grid grid-cols-7 gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">Nome no resumo</Label><Input value={form.label} onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))} className="h-9 text-xs" placeholder="Ex: Peso total" /></div>
            <div className="space-y-1"><Label className="text-xs">Campo</Label><Select value={form.field} onValueChange={(field) => setForm((c) => ({ ...c, field }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{RESUMO_FIELDS.map((field) => <SelectItem key={field.id} value={field.id}>{field.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Operação</Label><Select value={form.operation} onValueChange={(operation) => setForm((c) => ({ ...c, operation }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{RESUMO_OPERATIONS.map((operation) => <SelectItem key={operation.id} value={operation.id}>{operation.label}</SelectItem>)}</SelectContent></Select></div>
            {form.operation === 'ratio' && <div className="space-y-1"><Label className="text-xs">Dividir por</Label><Select value={form.divisorField} onValueChange={(divisorField) => setForm((c) => ({ ...c, divisorField }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{RESUMO_FIELDS.map((field) => <SelectItem key={field.id} value={field.id}>{field.label}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-1"><Label className="text-xs">Registros usados</Label><Select value={form.scope} onValueChange={(scope) => setForm((c) => ({ ...c, scope }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{RESUMO_SCOPES.map((scope) => <SelectItem key={scope.id} value={scope.id}>{scope.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Organizar resultado</Label><Select value={form.groupBy || 'none'} onValueChange={(groupBy) => setForm((c) => ({ ...c, groupBy }))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{RESUMO_GROUPS.map((group) => <SelectItem key={group.id} value={group.id}>{group.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex gap-1"><Button size="sm" className="h-9 text-xs" onClick={adicionar}>{editingId ? 'Atualizar' : 'Adicionar'}</Button>{editingId && <Button variant="outline" size="sm" className="h-9 text-xs" onClick={reset}>Cancelar</Button>}</div>
          </div>
        </section>
        <div className="d17d-management-table">
          <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Campo</TableHead><TableHead>Operação</TableHead><TableHead>Registros</TableHead><TableHead>Organização</TableHead><TableHead className="w-40">Ações</TableHead></TableRow></TableHeader><TableBody>
            {items.map((item, index) => <TableRow key={item.id}><TableCell className="font-medium">{item.label}</TableCell><TableCell>{fieldLabel(item.field)}{item.operation === 'ratio' ? ` ÷ ${fieldLabel(item.divisorField)}` : ''}</TableCell><TableCell>{operationLabel(item.operation)}</TableCell><TableCell>{RESUMO_SCOPES.find((scope) => scope.id === item.scope)?.label}</TableCell><TableCell>{RESUMO_GROUPS.find((group) => group.id === (item.groupBy || 'none'))?.label}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" disabled={index === 0} aria-label="Mover métrica para cima" onClick={() => move(index, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon" disabled={index === items.length - 1} aria-label="Mover métrica para baixo" onClick={() => move(index, 1)}><ArrowDown /></Button><Button variant="ghost" size="icon" onClick={() => { setEditingId(item.id); setForm({ ...empty, ...item }); }}><Edit2 /></Button><Button variant="ghost" size="icon" className="text-red-500" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}><Trash2 /></Button></div></TableCell></TableRow>)}
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="d17d-empty-row">Adicione as métricas que deseja acompanhar.</TableCell></TableRow>}
          </TableBody></Table>
        </div>
      </div>
      <div className="d17b-standard-dialog__footer"><Button onClick={salvarTudo}>Salvar resumo</Button></div>
    </DialogContent>
  </Dialog>;
}
