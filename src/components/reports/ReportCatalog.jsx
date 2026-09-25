import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, FileText, History, Lock, Search, Star, Trash2, Users } from "lucide-react";
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from "@/components/modelobase1";
import { Input } from "@/components/ui/input";
import { fmtDateBR } from "@/components/common/formatNumber";
import { REPORT_FAMILIES } from "@/modules/reporting/domain/reportDefinition";
import { normalizeText } from "@/modules/reporting/domain/filterEngine";
import { LEGACY_REPORT_ALIASES, getLegacyAlias } from "@/modules/reporting/definitions/legacyAliases";
import { getReportDefinition } from "@/modules/reporting/definitions/reportCatalog";
import { listReports } from "@/modules/reporting/application/reportService";
import { deleteTemplate, favoriteKey, getFavorites, getRecents, listTemplates, parseFavoriteKey, toggleFavorite } from "@/modules/reporting/application/reportTemplateService";
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
  "weighing.read": "Pesagens",
  "animal.read": "Animais",
  "registry.read": "Cadastros",
  "shipment.read": "Embarques",
  "session.close": "Fechamento",
};

// Nomes dos relatórios antigos que cada relatório novo absorveu (a busca por "mortes" acha "Saídas").
const OLD_TITLES = Object.values(LEGACY_REPORT_ALIASES).reduce((acc, alias) => {
  acc[alias.id] = `${acc[alias.id] ?? ""} ${alias.title}`;
  return acc;
}, {});

/** Descrição curta de uma visão antiga: "Rebanho atual · agrupado por Raça". */
function presetDescription(report, preset) {
  const columns = getReportDefinition(report.id)?.columns ?? [];
  const label = (columnId) => columns.find((column) => column.id === columnId)?.label ?? columnId;
  const groups = preset.groups.map((group) => label(group.columnId)).join(" › ");
  const filters = Object.keys(preset.filters).map(label);
  return `${report.title}${groups ? ` · agrupado por ${groups}` : ""}${filters.length ? ` · filtro em ${filters.join(", ")}` : ""}`;
}

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
  // Modelos, favoritos e recentes de relatórios que saíram da lista na 1.4.0 (aba Controle,
  // cadastros) continuam aparecendo para abrir e desmarcar/excluir — são do usuário e não podem
  // ficar inalcançáveis. A lista "Todos" continua só com os 12.
  const offCatalogById = useMemo(() => new Map(["maintenance", "hidden"]
    .flatMap((visibility) => listReports(actor, { visibility }))
    .filter((report) => report.available)
    .map((report) => [report.id, report])), [actor]);
  const anyReport = (reportId) => byId.get(reportId) ?? offCatalogById.get(reportId);

  useEffect(() => {
    getFavorites(actor).then(setFavorites).catch(() => setFavorites([]));
    getRecents(actor).then(setRecents).catch(() => setRecents([]));
    listTemplates(actor).then(setTemplates).catch(() => setTemplates([]));
  }, [actor, refreshKey]);

  const term = normalizeText(query);
  const matches = (report, extra = "") => !term || normalizeText(`${report.title} ${report.description} ${REPORT_FAMILIES[report.family]} ${OLD_TITLES[report.id] ?? ""} ${extra}`).includes(term);
  const lastUse = (reportId) => recents.find((item) => item.reportId === reportId)?.at ?? null;

  const star = async (key) => {
    try { setFavorites(await toggleFavorite(key, actor)); } catch (err) { toast.error(err.message); }
  };

  const card = (report) => (
    <li key={report.id} className={`rpt-card${report.available ? "" : " is-blocked"}`}>
      <button type="button" className="rpt-card__main" disabled={!report.available} onClick={() => onOpen({ reportId: report.id })}>
        <span className="rpt-card__title"><FileText className="h-3.5 w-3.5" aria-hidden="true" />{report.title}</span>
        <span className="rpt-card__desc">{report.available ? report.description : `Indisponível: ${report.blockedReason}`}</span>
        <span className="rpt-card__meta">
          <span className={`rpt-badge${report.defaultMode === "RESUMIDO" ? " rpt-badge--summary" : ""}`}>{report.defaultMode === "RESUMIDO" ? "Abre resumido" : "Abre detalhado"}</span>
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

  // Favorito de uma visão antiga ("Rebanho por raça"): abre o relatório novo com a mesma seleção.
  const presetCard = (key) => {
    const { reportId, presetId } = parseFavoriteKey(key);
    const report = byId.get(reportId);
    const preset = getLegacyAlias(presetId);
    if (!report || !preset) return null;
    return (
      <li key={key} className="rpt-card">
        <button type="button" className="rpt-card__main" onClick={() => onOpen({ reportId, presetId })}>
          <span className="rpt-card__title"><History className="h-3.5 w-3.5" aria-hidden="true" />{preset.title}</span>
          <span className="rpt-card__desc">{presetDescription(report, preset)}</span>
          <span className="rpt-card__meta"><span className="rpt-badge">Visão salva de antes da 1.4.0</span></span>
        </button>
        <button type="button" className="rpt-star is-on" aria-pressed="true" aria-label={`Favorito: ${preset.title}`} onClick={() => star(key)}>
          <Star className="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    );
  };

  const favoriteCards = favorites
    .filter((key) => {
      const { reportId, presetId } = parseFavoriteKey(key);
      const report = anyReport(reportId);
      if (!report?.available) return false;
      return matches(report, presetId ? getLegacyAlias(presetId)?.title ?? "" : "");
    })
    .map((key) => (key.includes("#") ? presetCard(key) : card(anyReport(key))))
    .filter(Boolean);

  const families = (list) => FAMILY_ORDER
    .map((family) => ({ family, items: list.filter((report) => report.family === family && matches(report)) }))
    .filter((group) => group.items.length);

  let content;
  if (tab === "todos") {
    const groups = families(reports);
    content = (
      <>
        {favoriteCards.length ? (
          <section className="rpt-family rpt-family--favorites" aria-labelledby="fam-favoritos">
            <h2 id="fam-favoritos"><Star className="h-3 w-3" aria-hidden="true" /> Favoritos</h2>
            <ul className="rpt-card-list">{favoriteCards}</ul>
          </section>
        ) : null}
        {groups.length ? groups.map((group) => (
          <section key={group.family} className="rpt-family" aria-labelledby={`fam-${group.family}`}>
            <h2 id={`fam-${group.family}`}>{REPORT_FAMILIES[group.family]}</h2>
            <ul className="rpt-card-list">{group.items.map(card)}</ul>
          </section>
        )) : <p className="rpt-empty">Nenhum relatório encontrado.</p>}
      </>
    );
  } else if (tab === "favoritos") {
    content = favoriteCards.length ? <ul className="rpt-card-list">{favoriteCards}</ul> : <p className="rpt-empty">Nenhum favorito ainda. Use a estrela para marcar.</p>;
  } else if (tab === "meus") {
    const baseOf = (template) => anyReport(template.baseReportId);
    const list = templates.filter((template) => baseOf(template) && (!term || normalizeText(template.name).includes(term)));
    content = list.length ? (
      <ul className="rpt-card-list">
        {list.map((template) => {
          const base = baseOf(template);
          const canDelete = template.scope === "PERSONAL" ? template.ownerUserId === actor.id : can("reports.templates.share");
          return (
            <li key={template.id} className="rpt-card">
              <button type="button" className="rpt-card__main" onClick={() => onOpen({ reportId: template.baseReportId, template })}>
                <span className="rpt-card__title">{template.scope === "SHARED" ? <Users className="h-3.5 w-3.5" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}{template.name}</span>
                <span className="rpt-card__desc">Baseado em {base.title} · {template.scope === "SHARED" ? `compartilhado por ${template.ownerName ?? "—"}` : "pessoal"}</span>
                <span className="rpt-card__meta">
                  <span>Atualizado em {fmtDateBR(template.updatedAt)}</span>
                  {template.groups?.length ? <span>{template.groups.length} nível(is) de agrupamento</span> : null}
                  {template.mode ? <span className="rpt-badge">{template.mode === "RESUMIDO" ? "Resumido" : "Detalhado"}</span> : null}
                  {template.migratedFrom ? <span className="rpt-badge">Convertido na 1.4.0</span> : null}
                  {!byId.has(template.baseReportId) ? <span className="rpt-badge">{base.visibility === "maintenance" ? "Relatório da aba Controle" : "Relatório fora da lista"}</span> : null}
                </span>
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
    const list = recents.filter((item) => anyReport(item.reportId)?.available);
    content = list.length ? (
      <ul className="rpt-card-list">
        {list.map((item) => {
          const report = anyReport(item.reportId);
          const template = item.templateId ? templates.find((candidate) => candidate.id === item.templateId) : null;
          const preset = !template && item.presetId ? getLegacyAlias(item.presetId) : null;
          const title = template ? `${template.name} (${report.title})` : preset ? `${preset.title} (${report.title})` : report.title;
          return (
            <li key={`${favoriteKey(item.reportId, item.presetId)}-${item.templateId}-${item.at}`} className="rpt-card">
              <button type="button" className="rpt-card__main" onClick={() => onOpen({ reportId: item.reportId, template, presetId: preset ? item.presetId : null })}>
                <span className="rpt-card__title"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{title}</span>
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
      <ModeloBase1PageHeader title="Relatórios" visuallyHidden description="Catálogo de relatórios." />
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
