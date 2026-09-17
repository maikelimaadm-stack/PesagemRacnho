import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, FileText, Lock, Search, Star, Trash2, Users } from "lucide-react";
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from "@/components/modelobase1";
import { Input } from "@/components/ui/input";
import { fmtDateBR } from "@/components/common/formatNumber";
import { REPORT_FAMILIES } from "@/modules/reporting/domain/reportDefinition";
import { GRAIN_LABELS } from "@/modules/reporting/domain/reportGrain";
import { normalizeText } from "@/modules/reporting/domain/filterEngine";
import { listReports } from "@/modules/reporting/application/reportService";
import { deleteTemplate, getFavorites, getRecents, listTemplates, toggleFavorite } from "@/modules/reporting/application/reportTemplateService";
import { FAMILY_ORDER, useCan } from "./reportUi";

const TABS = [
  { id: "todos", label: "Todos" },
  { id: "favoritos", label: "Favoritos" },
  { id: "meus", label: "Meus relatórios" },
  { id: "recentes", label: "Recentes" },
];

const PERMISSION_LABELS = {
  "commercial.values": "Valores comerciais",
  "audit.read": "Auditoria",
  "users.manage": "Usuários",
  "weighing.read": "Pesagens",
  "animal.read": "Animais",
  "registry.read": "Cadastros",
  "shipment.read": "Embarques",
  "session.close": "Fechamento",
};

export default function ReportCatalog({ actor, onOpen, refreshKey = 0 }) {
  const can = useCan();
  const [tab, setTab] = useState("todos");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [recents, setRecents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const reports = useMemo(() => listReports(actor), [actor]);
  const byId = useMemo(() => new Map(reports.map((report) => [report.id, report])), [reports]);

  useEffect(() => {
    getFavorites(actor).then(setFavorites).catch(() => setFavorites([]));
    getRecents(actor).then(setRecents).catch(() => setRecents([]));
    listTemplates(actor).then(setTemplates).catch(() => setTemplates([]));
  }, [actor, refreshKey]);

  const term = normalizeText(query);
  const matches = (report) => !term || normalizeText(`${report.title} ${report.description} ${REPORT_FAMILIES[report.family]}`).includes(term);
  const lastUse = (reportId) => recents.find((item) => item.reportId === reportId)?.at ?? null;

  const star = async (reportId) => {
    try { setFavorites(await toggleFavorite(reportId, actor)); } catch (err) { toast.error(err.message); }
  };

  const card = (report) => (
    <li key={report.id} className={`rpt-card${report.available ? "" : " is-blocked"}`}>
      <button type="button" className="rpt-card__main" disabled={!report.available} onClick={() => onOpen({ reportId: report.id })}>
        <span className="rpt-card__title"><FileText className="h-3.5 w-3.5" aria-hidden="true" />{report.title}</span>
        <span className="rpt-card__desc">{report.available ? report.description : `Indisponível: ${report.blockedReason}`}</span>
        <span className="rpt-card__meta">
          <span>{GRAIN_LABELS[report.grain]}</span>
          {report.metrics?.length ? <span>{report.metrics.join(" · ")}</span> : null}
          {report.requires.filter((action) => PERMISSION_LABELS[action] && action !== "weighing.read" && action !== "animal.read").map((action) => <span key={action} className="rpt-badge"><Lock className="h-3 w-3" aria-hidden="true" />{PERMISSION_LABELS[action]}</span>)}
          {report.classification && report.classification !== "CANÔNICO" ? <span className="rpt-badge rpt-badge--legacy">{report.classification}</span> : null}
          {lastUse(report.id) ? <span><Clock className="h-3 w-3" aria-hidden="true" /> {fmtDateBR(lastUse(report.id))}</span> : null}
        </span>
      </button>
      {report.available ? (
        <button type="button" className={`rpt-star${favorites.includes(report.id) ? " is-on" : ""}`} aria-pressed={favorites.includes(report.id)} aria-label={`Favorito: ${report.title}`} onClick={() => star(report.id)}>
          <Star className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );

  const families = (list) => FAMILY_ORDER
    .map((family) => ({ family, items: list.filter((report) => report.family === family && matches(report)) }))
    .filter((group) => group.items.length);

  let content;
  if (tab === "todos" || tab === "favoritos") {
    const list = tab === "favoritos" ? reports.filter((report) => favorites.includes(report.id)) : reports;
    const groups = families(list);
    content = groups.length ? groups.map((group) => (
      <section key={group.family} className="rpt-family" aria-labelledby={`fam-${group.family}`}>
        <h2 id={`fam-${group.family}`}>{REPORT_FAMILIES[group.family]}</h2>
        <ul className="rpt-card-list">{group.items.map(card)}</ul>
      </section>
    )) : <p className="rpt-empty">{tab === "favoritos" ? "Nenhum favorito ainda. Use a estrela para marcar." : "Nenhum relatório encontrado."}</p>;
  } else if (tab === "meus") {
    const list = templates.filter((template) => byId.has(template.baseReportId) && (!term || normalizeText(template.name).includes(term)));
    content = list.length ? (
      <ul className="rpt-card-list">
        {list.map((template) => {
          const base = byId.get(template.baseReportId);
          const canDelete = template.scope === "PERSONAL" ? template.ownerUserId === actor.id : can("reports.templates.share");
          return (
            <li key={template.id} className="rpt-card">
              <button type="button" className="rpt-card__main" onClick={() => onOpen({ reportId: template.baseReportId, template })}>
                <span className="rpt-card__title">{template.scope === "SHARED" ? <Users className="h-3.5 w-3.5" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}{template.name}</span>
                <span className="rpt-card__desc">Baseado em {base.title} · {template.scope === "SHARED" ? `compartilhado por ${template.ownerName ?? "—"}` : "pessoal"}</span>
                <span className="rpt-card__meta"><span>Atualizado em {fmtDateBR(template.updatedAt)}</span>{template.groups?.length ? <span>{template.groups.length} nível(is) de agrupamento</span> : null}</span>
              </button>
              {canDelete && pendingDelete !== template.id ? (
                <button type="button" className="rpt-star" aria-label={`Excluir modelo ${template.name}`} title="Excluir modelo" onClick={() => setPendingDelete(template.id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              ) : null}
              {canDelete && pendingDelete === template.id ? (
                <span className="rpt-confirm" role="group" aria-label={`Confirmar exclusão do modelo ${template.name}`}>
                  <span>{template.scope === "SHARED" ? "Excluir para todos?" : "Excluir modelo?"}</span>
                  <button type="button" className="ios-btn tb-btn tb-btn-ghost" onClick={() => setPendingDelete(null)}>Cancelar</button>
                  <button type="button" className="ios-btn tb-btn tb-btn-danger" onClick={async () => {
                    setPendingDelete(null);
                    try { await deleteTemplate(template.id, actor); setTemplates(await listTemplates(actor)); toast.success("Modelo excluído."); } catch (err) { toast.error(err.message); }
                  }}>Excluir</button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    ) : <p className="rpt-empty">Nenhum modelo salvo. Abra um relatório e use “Salvar modelo”.</p>;
  } else {
    const list = recents.filter((item) => byId.get(item.reportId)?.available);
    content = list.length ? (
      <ul className="rpt-card-list">
        {list.map((item) => {
          const report = byId.get(item.reportId);
          const template = item.templateId ? templates.find((candidate) => candidate.id === item.templateId) : null;
          return (
            <li key={`${item.reportId}-${item.templateId}-${item.at}`} className="rpt-card">
              <button type="button" className="rpt-card__main" onClick={() => onOpen({ reportId: item.reportId, template })}>
                <span className="rpt-card__title"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{template ? `${template.name} (${report.title})` : report.title}</span>
                <span className="rpt-card__desc">Aberto em {fmtDateBR(item.at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    ) : <p className="rpt-empty">Nenhum relatório aberto recentemente.</p>;
  }

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page d17b-list-page cadastro-emp-scope mg-empresas-scope rpt-page rpt-catalog">
      <ModeloBase1PageHeader title="Relatórios" visuallyHidden description="Catálogo de relatórios profissionais." />
      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center rpt-toolbar" style={{ background: "var(--bg-card)" }}>
          <div className="rpt-tabs" role="tablist" aria-label="Visões do catálogo">
            {TABS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`rpt-tab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>
            ))}
          </div>
          <label className="rpt-search">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Procurar relatório ou modelo" aria-label="Procurar relatório ou modelo" />
          </label>
        </div>
      </div>
      <div className="d17b-list-body rpt-catalog__body">{content}</div>
    </ModeloBase1PageContainer>
  );
}
