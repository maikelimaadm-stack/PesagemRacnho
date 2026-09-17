import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Layers, Save, Sigma, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGGREGATION_LABELS } from "@/modules/reporting/domain/columnDefinition";
import { MAX_GROUP_LEVELS } from "@/modules/reporting/domain/groupEngine";
import { headerLabel } from "./reportUi";

const NONE = "__nenhum__";

/** Agrupar por até 3 níveis, com reordenação. Só colunas `groupable` e visíveis ao perfil. */
export function ReportGroupingDialog({ open, onOpenChange, columns, groups, onApply }) {
  const [draft, setDraft] = useState(groups);
  useEffect(() => { if (open) setDraft(groups); }, [open, groups]);
  const groupable = columns.filter((column) => column.groupable);
  const setLevel = (index, columnId) => {
    const next = [...draft];
    if (columnId === NONE) next.splice(index, 1);
    else next[index] = { columnId, direction: next[index]?.direction ?? "asc" };
    setDraft(next.filter(Boolean));
  };
  const move = (index, delta) => {
    const next = [...draft];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };
  const slots = Math.min(MAX_GROUP_LEVELS, draft.length + 1);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog rpt-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm"><Layers className="h-4 w-4" aria-hidden="true" />Agrupar por</DialogTitle>
          <DialogDescription>Até {MAX_GROUP_LEVELS} níveis. Subtotais são recalculados sobre cada grupo.</DialogDescription>
        </DialogHeader>
        <div className="rpt-dialog__list">
          {Array.from({ length: slots }, (_, index) => {
            const level = draft[index];
            const used = new Set(draft.filter((_, i) => i !== index).map((item) => item.columnId));
            return (
              <div key={index} className="rpt-dialog__row">
                <span className="rpt-dialog__index">{index + 1}.</span>
                <Select value={level?.columnId ?? NONE} onValueChange={(value) => setLevel(index, value)}>
                  <SelectTrigger aria-label={`Nível ${index + 1}`}><SelectValue placeholder="Sem agrupamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{index === 0 ? "Sem agrupamento" : "Nenhum"}</SelectItem>
                    {groupable.filter((column) => !used.has(column.id)).map((column) => <SelectItem key={column.id} value={column.id}>{column.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {level ? (
                  <>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDraft(draft.map((item, i) => (i === index ? { ...item, direction: item.direction === "desc" ? "asc" : "desc" } : item)))} aria-label="Inverter ordem do grupo" title={level.direction === "desc" ? "Decrescente" : "Crescente"}>
                      {level.direction === "desc" ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>Subir</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={index >= draft.length - 1} onClick={() => move(index, 1)}>Descer</Button>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDraft([])}>Remover agrupamento</Button>
          <Button type="button" className="emp-toolbar-btn-save" onClick={() => { onApply(draft); onOpenChange(false); }}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Totais por coluna: só as operações matematicamente válidas declaradas na coluna. */
export function ReportTotalsDialog({ open, onOpenChange, columns, aggregates, animalColumnId, onApply }) {
  const [draft, setDraft] = useState(aggregates);
  useEffect(() => { if (open) setDraft(aggregates); }, [open, aggregates]);
  const has = (columnId, op) => draft.some((spec) => (spec.columnId ?? null) === (columnId ?? null) && spec.op === op);
  const toggle = (columnId, op) => {
    if (has(columnId, op)) setDraft(draft.filter((spec) => !((spec.columnId ?? null) === (columnId ?? null) && spec.op === op)));
    else setDraft([...draft, { id: columnId ? `${op}:${columnId}` : op, op, ...(columnId ? { columnId } : {}) }]);
  };
  const label = (column, op) => (op === "countDistinct" && column.id === animalColumnId ? "Animais únicos" : AGGREGATION_LABELS[op]);
  const configurable = columns.filter((column) => column.aggregations?.some((op) => op !== "count"));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog rpt-dialog rpt-dialog--wide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm"><Sigma className="h-4 w-4" aria-hidden="true" />Configurar totais</DialogTitle>
          <DialogDescription>Aplicados a cada subtotal e ao total geral. Valores ausentes não contam como zero.</DialogDescription>
        </DialogHeader>
        <div className="rpt-dialog__list rpt-dialog__list--scroll">
          <label className="rpt-dialog__check"><input type="checkbox" checked={has(null, "count")} onChange={() => toggle(null, "count")} /> Contagem de registros</label>
          {configurable.map((column) => (
            <div key={column.id} className="rpt-dialog__row rpt-dialog__row--wrap">
              <span className="rpt-dialog__column">{headerLabel(column)}</span>
              {column.aggregations.filter((op) => op !== "count").map((op) => (
                <label key={op} className="rpt-dialog__check">
                  <input type="checkbox" checked={has(column.id, op)} onChange={() => toggle(column.id, op)} /> {label(column, op)}
                </label>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDraft([])}>Nenhum</Button>
          <Button type="button" className="emp-toolbar-btn-save" onClick={() => { onApply(draft); onOpenChange(false); }}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Salvar modelo: pessoal ou compartilhado (só com reports.templates.share). */
export function ReportSaveTemplateDialog({ open, onOpenChange, current, canShare, onSave, busy }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("PERSONAL");
  const [asNew, setAsNew] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(current?.name ?? "");
    setScope(current?.scope ?? "PERSONAL");
    setAsNew(!current);
  }, [open, current]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact rpt-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm"><Save className="h-4 w-4" aria-hidden="true" />Salvar modelo</DialogTitle>
          <DialogDescription>Guarda colunas, filtros, período, agrupamentos, totais e ordenação — nunca os dados.</DialogDescription>
        </DialogHeader>
        <div className="rpt-dialog__form">
          <Label htmlFor="rpt-template-name">Nome do modelo</Label>
          <Input id="rpt-template-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ex.: GMD da engorda" />
          <fieldset className="rpt-dialog__scope">
            <legend>Visibilidade</legend>
            <label className="rpt-dialog__check"><input type="radio" name="rpt-scope" checked={scope === "PERSONAL"} onChange={() => setScope("PERSONAL")} /> Pessoal (só você)</label>
            <label className={`rpt-dialog__check${canShare ? "" : " is-disabled"}`} title={canShare ? undefined : "Seu perfil não compartilha modelos"}>
              <input type="radio" name="rpt-scope" disabled={!canShare} checked={scope === "SHARED"} onChange={() => setScope("SHARED")} /> Compartilhado com a empresa
            </label>
          </fieldset>
          {current ? (
            <label className="rpt-dialog__check"><input type="checkbox" checked={asNew} onChange={(event) => setAsNew(event.target.checked)} /> Salvar como novo modelo (não altera “{current.name}”)</label>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><X className="h-3.5 w-3.5" aria-hidden="true" />Cancelar</Button>
          <Button type="button" className="emp-toolbar-btn-save" disabled={busy || !name.trim()} onClick={() => onSave({ id: asNew ? undefined : current?.id, name: name.trim(), scope })}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
