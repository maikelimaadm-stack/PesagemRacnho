import React, { useState, useMemo } from "react";
import * as weighingService from "@/modules/weighing/application/weighingService";
import * as apartacaoService from "@/modules/auxiliary/application/apartacaoService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtInt, fmtNum } from "@/components/common/formatNumber";
import { parseBrazilianNumber } from "@/modules/weighing/domain/brazilianValues";
import ConfirmActionDialog from "@/components/common/ConfirmActionDialog";

export default function GerenciarApartacoesDialog({ open, onOpenChange, empresaId, apartacoes, lotes, pesagens, onRefresh, onUseApartacao, onUseLote }) {
  const [tab, setTab] = useState('apartacoes');
  const [isSaving, setIsSaving] = useState(false);
  const [nomeApartacao, setNomeApartacao] = useState("");
  const [editingApartacaoId, setEditingApartacaoId] = useState(null);
  const [apartacaoIdLote, setApartacaoIdLote] = useState("");
  const [nomeLote, setNomeLote] = useState("");
  const [qtdMaxima, setQtdMaxima] = useState("500");
  const [pesoMinimo, setPesoMinimo] = useState("");
  const [pesoMaximo, setPesoMaximo] = useState("");
  const [editingLoteId, setEditingLoteId] = useState(null);
  const [progressoAtualizacao, setProgressoAtualizacao] = useState({ show: false, current: 0, total: 0, texto: "" });
  const [deleteRequest, setDeleteRequest] = useState(null);

  const lotesFiltrados = useMemo(() => {
    if (!apartacaoIdLote) return lotes;
    return lotes.filter((l) => l.apartacao_id === apartacaoIdLote);
  }, [lotes, apartacaoIdLote]);

  const propagateApartacaoRename = async (apartacaoId, novoNome) => {
    const cachedLotes = await apartacaoService.filterLoteApartacoes({ apartacao_id: apartacaoId });
    const allPesagens = await weighingService.listEntries({ empresaId });
    const cachedPesagens = allPesagens.filter((p) => p.apartacao_id === apartacaoId);
    await Promise.all(cachedLotes.map((l) => apartacaoService.updateLoteApartacao(l.id, { nome_apartacao: novoNome })));
    if (cachedPesagens.length) {
      await weighingService.bulkUpdateEntries(
        cachedPesagens.map((p) => ({ id: p.id, patch: { nome_apartacao: novoNome } })),
        { recalculate: false },
      );
    }
  };

  const propagateLoteRename = async (loteId, novoNome) => {
    const allPesagens = await weighingService.listEntries({ empresaId });
    const cachedPesagens = allPesagens.filter((p) => p.lote_id === loteId);
    if (cachedPesagens.length) {
      await weighingService.bulkUpdateEntries(
        cachedPesagens.map((p) => ({ id: p.id, patch: { nome_lote: novoNome } })),
        { recalculate: false },
      );
    }
  };

  const salvarApartacao = async () => {
    if (isSaving) return;
    if (!nomeApartacao.trim()) { toast.error("Nome obrigatório"); return; }
    const nomeNormalizado = nomeApartacao.trim().toUpperCase();
    const duplicado = apartacoes.find((a) => a.nome_apartacao.toUpperCase() === nomeNormalizado && a.id !== editingApartacaoId);
    if (duplicado) { toast.error("Já existe uma apartação com esse nome!"); return; }

    setIsSaving(true);
    const data = { empresa_id: empresaId, nome_apartacao: nomeApartacao.trim() };

    try {
      if (editingApartacaoId) {
        await apartacaoService.updateApartacao(editingApartacaoId, data);
        const todosLotes = await apartacaoService.filterLoteApartacoes({ apartacao_id: editingApartacaoId });
        if (todosLotes.length > 0) {
          setProgressoAtualizacao({ show: true, current: 0, total: todosLotes.length, texto: "Atualizando lotes..." });
          const batchSize = 5;
          for (let i = 0; i < todosLotes.length; i += batchSize) {
            const batch = todosLotes.slice(i, i + batchSize);
            await Promise.all(batch.map((l) => apartacaoService.updateLoteApartacao(l.id, { nome_apartacao: nomeApartacao.trim() })));
            setProgressoAtualizacao((prev) => ({ ...prev, current: Math.min(i + batchSize, todosLotes.length), texto: `Atualizando ${fmtInt(Math.min(i + batchSize, todosLotes.length))} de ${fmtInt(todosLotes.length)} lotes...` }));
          }
          setProgressoAtualizacao({ show: false, current: 0, total: 0, texto: "" });
        }
        await propagateApartacaoRename(editingApartacaoId, data.nome_apartacao);
        toast.success(`Apartação atualizada! ${fmtInt(todosLotes.length)} lotes atualizados.`);
      } else {
        await apartacaoService.createApartacao(data);
        toast.success("Apartação criada!");
      }
      setNomeApartacao(""); setEditingApartacaoId(null); await onRefresh?.();
    } catch (error) { toast.error('Erro: ' + error.message); }
    finally { setIsSaving(false); setProgressoAtualizacao({ show: false, current: 0, total: 0, texto: "" }); }
  };

  const salvarLote = async () => {
    if (isSaving) return;
    if (!apartacaoIdLote) { toast.error("Selecione uma apartação"); return; }
    if (!nomeLote.trim()) { toast.error("Nome do lote obrigatório"); return; }
    if (!pesoMinimo || !pesoMaximo) { toast.error("Peso mínimo e máximo obrigatórios"); return; }
    const pesoMinimoNumero = parseBrazilianNumber(pesoMinimo);
    const pesoMaximoNumero = parseBrazilianNumber(pesoMaximo);
    const quantidadeMaximaNumero = parseBrazilianNumber(qtdMaxima);
    if (pesoMinimoNumero > pesoMaximoNumero) { toast.error("Peso mínimo não pode ser maior que o máximo"); return; }
    const nomeNormalizado = nomeLote.trim().toUpperCase();
    const duplicado = lotes.find((l) => l.apartacao_id === apartacaoIdLote && l.nome_lote.toUpperCase() === nomeNormalizado && l.id !== editingLoteId);
    if (duplicado) { toast.error("Já existe um lote com esse nome nesta apartação!"); return; }

    setIsSaving(true);
    const apt = apartacoes.find((a) => a.id === apartacaoIdLote);
    const data = { empresa_id: empresaId, apartacao_id: apartacaoIdLote, nome_apartacao: apt?.nome_apartacao || "", nome_lote: nomeLote.trim(), quantidade_maxima: Number.isFinite(quantidadeMaximaNumero) ? Math.trunc(quantidadeMaximaNumero) : 500, peso_minimo: pesoMinimoNumero, peso_maximo: pesoMaximoNumero, fechado: false };

    try {
      if (editingLoteId) {
        await apartacaoService.updateLoteApartacao(editingLoteId, data);
        await propagateLoteRename(editingLoteId, data.nome_lote);
        toast.success("Lote atualizado!");
      } else {
        await apartacaoService.createLoteApartacao(data);
        toast.success("Lote criado!");
      }
      setNomeLote(""); setQtdMaxima("500"); setPesoMinimo(""); setPesoMaximo(""); setEditingLoteId(null); await onRefresh?.();
    } catch (error) { toast.error('Erro: ' + error.message); }
    finally { setIsSaving(false); }
  };

  const excluirApartacao = async (id) => {
    const pesagensVinculadas = pesagens.filter((p) => p.apartacao_id === id);
    const lotesVinculados = lotes.filter((l) => l.apartacao_id === id);
    if (pesagensVinculadas.length > 0) { toast.error(`Esta apartação possui ${fmtInt(pesagensVinculadas.length)} pesagens vinculadas. Remova-as primeiro.`); return; }
    setDeleteRequest({ kind: 'apartacao', id, item: apartacoes.find((row) => row.id === id), lotesVinculados });
  };

  const excluirLote = async (id) => {
    const pesagensVinculadas = pesagens.filter((p) => p.lote_id === id);
    const loteInfo = lotes.find((l) => l.id === id);
    if (pesagensVinculadas.length > 0) { toast.error(`Lote "${loteInfo?.nome_lote}" possui ${fmtInt(pesagensVinculadas.length)} pesagens vinculadas.`); return; }
    setDeleteRequest({ kind: 'lote', id, item: loteInfo, lotesVinculados: [] });
  };

  const confirmDelete = async () => {
    if (!deleteRequest) return;
    try {
      if (deleteRequest.kind === 'apartacao') {
        for (const item of deleteRequest.lotesVinculados) await apartacaoService.deleteLoteApartacao(item.id);
        await apartacaoService.deleteApartacao(deleteRequest.id);
        toast.success('Apartação excluída.');
      } else {
        await apartacaoService.deleteLoteApartacao(deleteRequest.id);
        toast.success('Lote excluído.');
      }
      setDeleteRequest(null);
      await onRefresh?.();
    } catch (error) { toast.error(error.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--large d17d-management-dialog overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Gerenciar Apartações e Lotes</DialogTitle><DialogDescription className="sr-only">Cadastre, edite e organize apartações e seus lotes.</DialogDescription></DialogHeader>
        <div className="d17d-management-dialog__tabs flex gap-2 border-b pb-2">
          <Button variant={tab === 'apartacoes' ? 'default' : 'outline'} size="sm" onClick={() => setTab('apartacoes')}>Apartações</Button>
          <Button variant={tab === 'lotes' ? 'default' : 'outline'} size="sm" onClick={() => { setTab('lotes'); if (!apartacaoIdLote && apartacoes[0]) setApartacaoIdLote(apartacoes[0].id); }}>Lotes</Button>
        </div>
        <div className="d17b-standard-dialog__body d17d-management-dialog__body flex-1 overflow-auto">
          {tab === 'apartacoes' ? (
            <div className="space-y-3">
              <div className="flex gap-2 items-end bg-slate-50 p-3 rounded">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Nome da Apartação</Label>
                  <Input value={nomeApartacao} onChange={(e) => setNomeApartacao(e.target.value)} className="h-9 text-sm" placeholder="Ex: ROTINA" />
                </div>
                <Button onClick={salvarApartacao} disabled={isSaving} size="sm" className="emp-toolbar-btn emp-toolbar-btn-save">
                  {isSaving ? 'Salvando...' : editingApartacaoId ? 'Atualizar' : 'Adicionar'}
                </Button>
                {editingApartacaoId && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditingApartacaoId(null); setNomeApartacao(""); }}>Cancelar</Button>}
              </div>
              {progressoAtualizacao.show && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                  <div className="flex justify-between text-xs text-blue-800 mb-1"><span>{progressoAtualizacao.texto}</span><span className="font-bold">{fmtInt(Math.round(progressoAtualizacao.current / progressoAtualizacao.total * 100))}%</span></div>
                  <div className="w-full bg-blue-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progressoAtualizacao.current / progressoAtualizacao.total * 100}%` }} /></div>
                </div>
              )}
              <div className="d17d-management-table"><Table>
                <TableHeader><TableRow><TableHead className="text-xs">Nome</TableHead><TableHead className="text-xs text-center">Lotes</TableHead><TableHead className="text-xs text-center">Pesagens</TableHead><TableHead className="text-xs w-44">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {apartacoes.map((a) => {
                    const qtdLotes = lotes.filter((l) => l.apartacao_id === a.id).length;
                    const qtdPesagens = pesagens.filter((p) => p.apartacao_id === a.id).length;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs font-medium">{a.nome_apartacao}</TableCell>
                        <TableCell className="text-xs text-center">{fmtInt(qtdLotes)}</TableCell>
                        <TableCell className="text-xs text-center">{qtdPesagens > 0 ? <Badge variant="outline" className="text-[10px]">{fmtInt(qtdPesagens)}</Badge> : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {onUseApartacao && <Button size="sm" className="h-7 text-xs" onClick={() => { onUseApartacao(a); onOpenChange(false); }}>Usar</Button>}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setNomeApartacao(a.nome_apartacao); setEditingApartacaoId(a.id); }}><Edit2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluirApartacao(a.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {apartacoes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-slate-400 py-6">Nenhuma apartação cadastrada</TableCell></TableRow>}
                </TableBody>
              </Table></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-2 items-end bg-slate-50 p-3 rounded">
                <div className="space-y-1"><Label className="text-xs">Apartação</Label><Select value={apartacaoIdLote} onValueChange={setApartacaoIdLote}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{apartacoes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome_apartacao}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Nome Lote</Label><Input value={nomeLote} onChange={(e) => setNomeLote(e.target.value)} className="h-9 text-xs" placeholder="Ex: BOIADA" /></div>
                <div className="space-y-1"><Label className="text-xs">Qtd Máx</Label><Input type="text" inputMode="numeric" value={qtdMaxima} onChange={(e) => setQtdMaxima(e.target.value)} className="h-9 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Peso Mín</Label><Input type="text" inputMode="decimal" value={pesoMinimo} onChange={(e) => setPesoMinimo(e.target.value)} className="h-9 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Peso Máx</Label><Input type="text" inputMode="decimal" value={pesoMaximo} onChange={(e) => setPesoMaximo(e.target.value)} className="h-9 text-xs" /></div>
                <div className="flex gap-1">
                  <Button onClick={salvarLote} disabled={isSaving} size="sm" className="emp-toolbar-btn emp-toolbar-btn-save">{isSaving ? 'Salvando...' : editingLoteId ? 'Atualizar' : 'Adicionar'}</Button>
                  {editingLoteId && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditingLoteId(null); setNomeLote(""); setQtdMaxima("500"); setPesoMinimo(""); setPesoMaximo(""); }}>Cancelar</Button>}
                </div>
              </div>
              <div className="d17d-management-table"><Table>
                <TableHeader><TableRow><TableHead className="text-xs">Apartação</TableHead><TableHead className="text-xs">Lote</TableHead><TableHead className="text-xs text-center">Qtd Máx</TableHead><TableHead className="text-xs text-center">Peso Mín</TableHead><TableHead className="text-xs text-center">Peso Máx</TableHead><TableHead className="text-xs text-center">Pesagens</TableHead><TableHead className="text-xs w-44">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {lotesFiltrados.map((l) => {
                    const qtdPesagens = pesagens.filter((p) => p.lote_id === l.id).length;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{l.nome_apartacao}</TableCell>
                        <TableCell className="text-xs font-medium">{l.nome_lote}</TableCell>
                        <TableCell className="text-xs text-center">{fmtInt(l.quantidade_maxima)}</TableCell>
                        <TableCell className="text-xs text-center font-mono">{fmtNum(l.peso_minimo)}</TableCell>
                        <TableCell className="text-xs text-center font-mono">{fmtNum(l.peso_maximo)}</TableCell>
                        <TableCell className="text-xs text-center">{qtdPesagens > 0 ? <Badge variant="outline" className="text-[10px]">{fmtInt(qtdPesagens)}</Badge> : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {onUseLote && <Button size="sm" className="h-7 text-xs" onClick={() => { onUseLote(l); onOpenChange(false); }}>Usar</Button>}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setApartacaoIdLote(l.apartacao_id); setNomeLote(l.nome_lote); setQtdMaxima(String(l.quantidade_maxima)); setPesoMinimo(String(l.peso_minimo)); setPesoMaximo(String(l.peso_maximo)); setEditingLoteId(l.id); }}><Edit2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => excluirLote(l.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {lotesFiltrados.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-slate-400 py-6">{apartacaoIdLote ? 'Nenhum lote nesta apartação' : 'Selecione uma apartação'}</TableCell></TableRow>}
                </TableBody>
              </Table></div>
            </div>
          )}
        </div>
      </DialogContent>
      <ConfirmActionDialog
        open={Boolean(deleteRequest)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setDeleteRequest(null); }}
        title={deleteRequest?.kind === 'apartacao' ? 'Excluir apartação' : 'Excluir lote'}
        description={deleteRequest?.kind === 'apartacao'
          ? `A apartação “${deleteRequest?.item?.nome_apartacao || ''}” e ${fmtInt(deleteRequest?.lotesVinculados?.length || 0)} lote(s) sem pesagens serão inativados.`
          : `O lote “${deleteRequest?.item?.nome_lote || ''}” será inativado e deixará de aparecer nas seleções.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
      />
    </Dialog>
  );
}
