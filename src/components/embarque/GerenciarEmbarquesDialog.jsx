import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MakDateControl from "@/components/mak/MakDateControl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit2, MoreVertical, Trash2 } from "lucide-react";
import * as shipmentService from "@/modules/shipments/application/shipmentService";
import { toast } from "sonner";
import { fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { parseBrazilianNumber } from "@/modules/weighing/domain/brazilianValues";
import ConfirmActionDialog from "@/components/common/ConfirmActionDialog";

export default function GerenciarEmbarquesDialog({ open, onOpenChange, empresaId, embarques, documentos, onRefresh, dbReady, pesagens = [], onUseDocument }) {
  const [tab, setTab] = useState("embarques");
  const [isSaving, setIsSaving] = useState(false);

  // Embarque form
  const [embEditingId, setEmbEditingId] = useState(null);
  const [embNome, setEmbNome] = useState("");
  const [embData, setEmbData] = useState("");
  const [embFrigorifico, setEmbFrigorifico] = useState("");
  const [embStatus, setEmbStatus] = useState("Planejado");

  const [embSelecionado, setEmbSelecionado] = useState("");

  // Documento form
  const [docEditingId, setDocEditingId] = useState(null);
  const [docTipo, setDocTipo] = useState("GTA");
  const [docNumeroGTA, setDocNumeroGTA] = useState("");
  const [docNumeroNfe, setDocNumeroNfe] = useState("");
  const [docMotorista, setDocMotorista] = useState("");
  const [docPlaca, setDocPlaca] = useState("");
  const [docPrevM, setDocPrevM] = useState("");
  const [docPrevF, setDocPrevF] = useState("");
  const [deleteRequest, setDeleteRequest] = useState(null);

  const documentosDoEmbarque = useMemo(() => documentos.filter(d => d.embarque_id === embSelecionado), [documentos, embSelecionado]);

  const allPesagens = useMemo(() => pesagens || [], [pesagens]);

  const sumByDoc = useMemo(() => {
    const m = {};
    allPesagens.forEach(p => {
      const id = p.documento_embarque_id;
      if (!id) return;
      const peso = p.peso || 0;
      if (!m[id]) m[id] = { totalPeso: 0, count: 0 };
      m[id].totalPeso += peso;
      m[id].count += 1;
    });
    Object.keys(m).forEach(id => {
      m[id].media = m[id].count ? m[id].totalPeso / m[id].count : 0;
    });
    return m;
  }, [allPesagens]);

  const salvarEmbarque = async () => {
    if (!embNome.trim()) { toast.error("Nome obrigatório"); return; }
    setIsSaving(true);
    const data = { empresa_id: empresaId, nome: embNome.trim(), data: embData || null, frigorifico: embFrigorifico || null, status: embStatus };
    try {
      if (embEditingId) await shipmentService.updateShipment(embEditingId, data);
      else {
        const created = await shipmentService.createShipment(data);
        setEmbSelecionado(created.id);
        setTab('documentos');
      }
      toast.success(embEditingId ? "Embarque atualizado" : "Embarque criado");
      setEmbEditingId(null); setEmbNome(""); setEmbData(""); setEmbFrigorifico(""); setEmbStatus("Planejado");
      onRefresh?.();
    } catch (e) { toast.error(e.message); } finally { setIsSaving(false); }
  };

  const salvarDocumento = async () => {
    if (!embSelecionado) { toast.error("Selecione um embarque"); return; }
    setIsSaving(true);
    const embNome = embarques.find(e => e.id === embSelecionado)?.nome || "";
    const data = {
      empresa_id: empresaId,
      embarque_id: embSelecionado,
      embarque_nome: embNome,
      tipo_documento: docTipo,
      numero_gta: docNumeroGTA || null,
      numero_nfe: docNumeroNfe || null,
      motorista_nome: docMotorista || null,
      placa_carreta: docPlaca || null,
      qtd_prev_machos: docPrevM ? Math.trunc(parseBrazilianNumber(docPrevM) || 0) : 0,
      qtd_prev_femeas: docPrevF ? Math.trunc(parseBrazilianNumber(docPrevF) || 0) : 0
    };
    try {
      if (docEditingId) await shipmentService.updateDocument(docEditingId, data);
      else await shipmentService.createDocument(data);
      toast.success(docEditingId ? "Documento atualizado" : "Documento criado");
      setDocEditingId(null); setDocTipo("GTA"); setDocNumeroGTA(""); setDocNumeroNfe(""); setDocMotorista(""); setDocPlaca(""); setDocPrevM(""); setDocPrevF("");
      onRefresh?.();
    } catch (e) { toast.error(e.message); } finally { setIsSaving(false); }
  };

  const handleDeleteDocumento = async (doc) => {
    const used = (sumByDoc[doc.id]?.count || 0) > 0;
    if (used) { toast.error('Não é possível excluir: existem pesagens vinculadas.'); return; }
    setDeleteRequest({ kind: 'documento', item: doc });
  };

  const handleDeleteEmbarque = async (emb) => {
    const docsCount = documentos.filter(d => d.embarque_id === emb.id).length;
    const hasPesagens = (pesagens || []).some(p => p.embarque_id === emb.id);
    if (docsCount > 0 || hasPesagens) { toast.error('Não é possível excluir: possui documentos/pesagens vinculados.'); return; }
    setDeleteRequest({ kind: 'embarque', item: emb });
  };

  const confirmDelete = async () => {
    if (!deleteRequest) return;
    try {
      if (deleteRequest.kind === 'documento') await shipmentService.deleteDocument(deleteRequest.item.id);
      else await shipmentService.deleteShipment(deleteRequest.item.id);
      toast.success(deleteRequest.kind === 'documento' ? 'Documento excluído' : 'Embarque excluído');
      setDeleteRequest(null);
      onRefresh?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--large d17d-management-dialog overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Documentação de Embarque</DialogTitle>
          <DialogDescription className="sr-only">Cadastre embarques e organize seus documentos.</DialogDescription>
        </DialogHeader>

        <div className="d17d-management-dialog__tabs flex gap-2 border-b pb-2">
          <Button variant={tab === 'embarques' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setTab('embarques')}>Embarques</Button>
          <Button variant={tab === 'documentos' ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => { setTab('documentos'); if (!embSelecionado && embarques[0]) setEmbSelecionado(embarques[0].id); }}>Documentos</Button>
        </div>

        <div className="d17b-standard-dialog__body d17d-management-dialog__body flex-1 overflow-auto">
          {tab === 'embarques' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-2 items-end bg-slate-50 p-3 rounded">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Nome</Label>
                  <Input value={embNome} onChange={(e)=>setEmbNome(e.target.value)} className="h-8 text-xs" placeholder="Ex: Embarque JBS" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <MakDateControl value={embData} onChange={(e)=>setEmbData(e.target.value)} ariaLabel="Data do embarque" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frigorífico</Label>
                  <Input value={embFrigorifico} onChange={(e)=>setEmbFrigorifico(e.target.value)} className="h-8 text-xs" placeholder="Destino" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={embStatus} onValueChange={setEmbStatus}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planejado">Planejado</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluido">Concluído</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={salvarEmbarque} disabled={isSaving} size="sm" className="emp-toolbar-btn emp-toolbar-btn-save">{isSaving ? 'Salvando...' : embEditingId ? 'Atualizar' : 'Adicionar'}</Button>
                  {embEditingId && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={()=>{setEmbEditingId(null);setEmbNome('');setEmbData('');setEmbFrigorifico('');setEmbStatus('Planejado');}}>Cancelar</Button>}
                </div>
              </div>

              <div className="d17d-management-table"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Frigorífico</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embarques.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium">{e.nome}</TableCell>
                      <TableCell className="text-xs">{fmtDateBR(e.data)}</TableCell>
                      <TableCell className="text-xs">{e.frigorifico || '-'}</TableCell>
                      <TableCell className="text-xs">{e.status || '-'}</TableCell>
                      <TableCell className="text-xs">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3.5 h-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={()=>{setEmbEditingId(e.id);setEmbNome(e.nome||'');setEmbData(e.data||'');setEmbFrigorifico(e.frigorifico||'');setEmbStatus(e.status||'Planejado');}} className="text-xs">Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>handleDeleteEmbarque(e)} className="text-xs text-red-600">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-2 items-end bg-slate-50 p-3 rounded">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Embarque</Label>
                  <Select value={embSelecionado} onValueChange={setEmbSelecionado}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {embarques.map(e=> <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo Doc</Label>
                  <Select value={docTipo} onValueChange={setDocTipo}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GTA">GTA</SelectItem>
                      <SelectItem value="NF-e">NF-e</SelectItem>
                      <SelectItem value="GTA+NF-e">GTA+NF-e</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nº GTA</Label>
                  <Input value={docNumeroGTA} onChange={(e)=>setDocNumeroGTA(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nº NF-e</Label>
                  <Input value={docNumeroNfe} onChange={(e)=>setDocNumeroNfe(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Motorista</Label>
                  <Input value={docMotorista} onChange={(e)=>setDocMotorista(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Placa</Label>
                  <Input value={docPlaca} onChange={(e)=>setDocPlaca(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prev. Machos</Label>
                  <Input type="text" inputMode="numeric" value={docPrevM} onChange={(e)=>setDocPrevM(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prev. Fêmeas</Label>
                  <Input type="text" inputMode="numeric" value={docPrevF} onChange={(e)=>setDocPrevF(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="flex gap-2 col-span-2">
                  <Button onClick={salvarDocumento} disabled={isSaving} size="sm" className="emp-toolbar-btn emp-toolbar-btn-save">{isSaving ? 'Salvando...' : docEditingId ? 'Atualizar' : 'Adicionar'}</Button>
                  {docEditingId && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={()=>{setDocEditingId(null);setDocTipo('GTA');setDocNumeroGTA('');setDocNumeroNfe('');setDocMotorista('');setDocPlaca('');setDocPrevM('');setDocPrevF('');}}>Cancelar</Button>}
                </div>
              </div>

              <div className="d17d-management-table"><Table>
                <TableHeader>
                  {/* Cabeçalho conforme padrão de tabelas: text-xs, font-bold, py-1, border */}
                  <TableRow>
                    <TableHead className="text-xs">GTA</TableHead>
                    <TableHead className="text-xs">NF-e</TableHead>
                    <TableHead className="text-xs text-center">Prev M/F</TableHead>
                    <TableHead className="text-xs text-right">Peso Total</TableHead>
                    <TableHead className="text-xs text-right">Peso Médio</TableHead>
                    <TableHead className="text-xs w-44">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Linhas com hover e células com bordas seguindo o padrão */}
                  {documentosDoEmbarque.map(d => (
                    <TableRow key={d.id} className="hover:bg-gray-50">
                      <TableCell className="text-xs py-1 border border-gray-300">{d.numero_gta || '-'}</TableCell>
                      <TableCell className="text-xs py-1 border border-gray-300">{d.numero_nfe || '-'}</TableCell>
                      <TableCell className="text-xs py-1 border border-gray-300 text-center">{fmtInt(d.qtd_prev_machos || 0)} / {fmtInt(d.qtd_prev_femeas || 0)}</TableCell>
                      <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{fmtNum(sumByDoc[d.id]?.totalPeso || 0)}</TableCell>
                      <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{fmtNum(sumByDoc[d.id]?.media || 0)}</TableCell>
                      <TableCell className="text-xs py-1 border border-gray-300">
                        <div className="flex items-center gap-1">{onUseDocument && <Button size="sm" className="h-7 text-xs" onClick={() => { const shipment = embarques.find((item) => item.id === d.embarque_id); onUseDocument(shipment, d); onOpenChange(false); }}>Usar no lançamento</Button>}<DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3.5 h-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={()=>{setDocEditingId(d.id);setEmbSelecionado(d.embarque_id);setDocTipo(d.tipo_documento||'GTA');setDocNumeroGTA(d.numero_gta||'');setDocNumeroNfe(d.numero_nfe||'');setDocMotorista(d.motorista_nome||'');setDocPlaca(d.placa_carreta||'');setDocPrevM(String(d.qtd_prev_machos||''));setDocPrevF(String(d.qtd_prev_femeas||''));}} className="text-xs">Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>handleDeleteDocumento(d)} className="text-xs text-red-600">Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu></div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            </div>
          )}
        </div>
      </DialogContent>
      <ConfirmActionDialog
        open={Boolean(deleteRequest)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setDeleteRequest(null); }}
        title={deleteRequest?.kind === 'documento' ? 'Excluir documento' : 'Excluir embarque'}
        description={deleteRequest?.kind === 'documento'
          ? 'O documento será inativado e deixará de aparecer nas seleções. O histórico técnico será preservado.'
          : `O embarque “${deleteRequest?.item?.nome || ''}” será inativado. Deseja continuar?`}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
      />
    </Dialog>
  );
}
