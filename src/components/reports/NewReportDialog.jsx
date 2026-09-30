import React, { useEffect, useState } from "react";
import { FilePlus2, PencilLine, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPORT_NAME_MAX, reportNameError } from "@/modules/reporting/application/customReports";

// E1F: diálogo de "Meus relatórios", no padrão dos diálogos de relatório (ReportDialogs.jsx):
//  - "new": ➕ Novo relatório… do seletor — Nome, Base (catálogo do perfil, por assunto) e Quem vê;
//  - "saveAs": Salvar como… (⋯) — Nome e Quem vê; a base é a do relatório aberto;
//  - "rename": Renomear… (⋯) — só o Nome.
// "A empresa" só com reports.templates.share. O nome é conferido aqui (obrigatório, até 80, único na base e no
// escopo) e de novo no serviço, que é quem manda.
const MODES = {
  new: { title: "Novo relatório", Icon: FilePlus2, submit: "Criar", busy: "Criando…", description: "Começa com o padrão da base (tipo, colunas e período). Depois ajuste pelos filtros e pelo cabeçalho e use “Salvar alterações”." },
  saveAs: { title: "Salvar como…", Icon: Save, submit: "Salvar", busy: "Salvando…", description: "Cria outro relatório com o que está na tela agora. O relatório aberto não muda." },
  rename: { title: "Renomear relatório", Icon: PencilLine, submit: "Renomear", busy: "Renomeando…", description: "Só o nome muda; o relatório continua como está salvo." },
};

/**
 * @param bases grupos { family, label, items: [{ value, label }] } (customReports.newReportBases) — só no "new"
 * @param baseReportId base fixa (saveAs/rename) ou a pré-escolhida no "new"
 * @param templates relatórios que o ator vê (para o nome único); exceptId = o próprio (rename)
 * @param onSubmit({ name, baseReportId, scope }) — a tela chama o serviço e fecha
 */
export default function NewReportDialog({
  open, mode = "new", onOpenChange, bases = [], baseReportId = null, baseLabel = null, initialName = "", initialScope = "PERSONAL",
  canShare = false, templates = [], actor = null, ownerUserId, exceptId = null, busy = false, onSubmit,
}) {
  const texts = MODES[mode] ?? MODES.new;
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [scope, setScope] = useState("PERSONAL");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(initialName ?? "");
    setBase(baseReportId ?? bases[0]?.items?.[0]?.value ?? "");
    setScope(canShare && initialScope === "SHARED" ? "SHARED" : "PERSONAL");
    setTouched(false);
    // Só ao abrir: o que a pessoa digita não volta ao inicial a cada renderização.
  }, [open]);
  const error = reportNameError(name, { templates, baseReportId: base, scope, actor, ownerUserId: ownerUserId ?? actor?.id, exceptId });
  const submit = () => {
    setTouched(true);
    if (error || !base || busy) return;
    onSubmit({ name: name.trim(), baseReportId: base, scope });
  };
  const { Icon } = texts;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact rpt-dialog rpt-new-report">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" aria-hidden="true" />{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        <form className="rpt-dialog__form d17b-standard-dialog__body" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <Label htmlFor="rpt-new-report-name">Nome</Label>
          <Input
            id="rpt-new-report-name"
            value={name}
            maxLength={REPORT_NAME_MAX}
            autoFocus
            aria-invalid={Boolean(touched && error)}
            aria-describedby="rpt-new-report-error"
            onChange={(event) => { setName(event.target.value); setTouched(true); }}
            placeholder="Ex.: Machos do Lote 01"
          />
          {mode === "new" ? (
            <>
              <Label htmlFor="rpt-new-report-base">Base</Label>
              <Select value={base} onValueChange={setBase}>
                <SelectTrigger id="rpt-new-report-base" aria-label="Base do relatório"><SelectValue placeholder="Escolha a base" /></SelectTrigger>
                <SelectContent className="rpt-mak-report-list">
                  {bases.map((group) => (
                    <SelectGroup key={group.family}>
                      <SelectLabel className="rpt-mak-report-list__family">{group.label}</SelectLabel>
                      {group.items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : baseLabel ? <p className="rpt-new-report__base">Base: <strong>{baseLabel}</strong></p> : null}
          {mode !== "rename" ? (
            <fieldset className="rpt-dialog__scope">
              <legend>Quem vê</legend>
              <label className="rpt-dialog__check"><input type="radio" name="rpt-new-report-scope" checked={scope === "PERSONAL"} onChange={() => setScope("PERSONAL")} /> Só eu</label>
              <label className={`rpt-dialog__check${canShare ? "" : " is-disabled"}`} title={canShare ? undefined : "Só ADMIN e GESTOR compartilham relatórios com a empresa"}>
                <input type="radio" name="rpt-new-report-scope" disabled={!canShare} checked={scope === "SHARED"} onChange={() => setScope("SHARED")} /> A empresa
              </label>
            </fieldset>
          ) : null}
          <p id="rpt-new-report-error" className="rpt-new-report__error" role={touched && error ? "alert" : undefined}>{touched && error ? error : ""}</p>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><X className="h-3.5 w-3.5" aria-hidden="true" />Cancelar</Button>
          <Button type="button" className="emp-toolbar-btn-save" disabled={busy || Boolean(error) || !base} onClick={submit}>{busy ? texts.busy : texts.submit}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
