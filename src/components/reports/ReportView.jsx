import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Columns3, Download, FileJson, FileSpreadsheet, FileText, Layers, Lock, Printer, RefreshCw, Save, SearchCheck, Sigma, Star, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import MakColumnConfigDialog from "@/components/mak/MakColumnConfigDialog";
import MakFilterPill from "@/components/mak/MakFilterPill";
import MakFilterRail from "@/components/mak/MakFilterRail";
import MgTablePanelStrip from "@/components/mak/MgTablePanelStrip";
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from "@/components/modelobase1";
import { describeFilter, isFilterActive, normalizeFilter } from "@/modules/reporting/domain/filterEngine";
import { PERIOD_PRESETS, describePeriod } from "@/modules/reporting/domain/reportPeriod";
import { REPORT_FAMILIES, REPORT_MODES } from "@/modules/reporting/domain/reportDefinition";
import { formatGroupLabel } from "@/modules/reporting/domain/summaryLayout";
import { NONE_GROUP_KEY } from "@/modules/reporting/domain/groupEngine";
import { canSeeColumn } from "@/modules/reporting/domain/reportPermissions";
import { getReportDefinition } from "@/modules/reporting/definitions/reportCatalog";
import { aliasSelection, getLegacyAlias } from "@/modules/reporting/definitions/legacyAliases";
import { runReport } from "@/modules/reporting/application/reportService";
import { emitReport } from "@/modules/reporting/application/reportExportService";
import { exportPdf, printReport } from "@/modules/reporting/application/reportPrintService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { favoriteKey, getFavorites, recordRecent, saveTemplate, templateToRequest, toggleFavorite } from "@/modules/reporting/application/reportTemplateService";
import { ReportGroupingDialog, ReportSaveTemplateDialog, ReportTotalsDialog } from "./ReportDialogs";
import ReportSummaryTable from "./ReportSummaryTable";
import ReportTable from "./ReportTable";
import { pillFilterType, pillOptions, toServiceFilters, useCan } from "./reportUi";

const NO_GROUP = "__nenhum__";
const CUSTOM_GROUP = "__personalizado__";

function initialState(definition, template, preset, role) {
  if (template) {
    const request = templateToRequest(template, role);
    request.warnings.forEach((warning) => toast.warning(warning.message));
    return {
      params: request.params,
      uiFilters: request.selection.filters,
      fixedFilters: request.selection.fixedFilters,
      columns: request.selection.columns.length ? request.selection.columns : definition.defaultColumns,
      groups: request.selection.groups,
      aggregates: request.selection.aggregates,
      sort: request.selection.sort,
      search: request.selection.search,
      widths: request.widths,
      mode: request.selection.mode,
      summarySort: request.selection.summarySort,
      drill: [],
    };
  }
  const params = {};
  for (const param of definition.params) if (param.default != null) params[param.id] = param.default;
  // Visão de um relatório antigo (favorito, recente ou link de antes da 1.4.0): mesma seleção.
  const legacy = preset ? aliasSelection(preset) : null;
  // Condições que eram fixas no relatório antigo comparavam o código (motivo = Morte, tipo
  // Cadastro/Saída): continuam por código, não pelo rótulo exibido — mesma população do relatório antigo.
  const legacyFilters = legacy
    ? Object.fromEntries(Object.entries(legacy.filters).map(([columnId, filter]) => [columnId, preset.fixed.includes(columnId) ? { ...filter, match: "code" } : filter]))
    : null;
  return {
    params,
    uiFilters: legacyFilters ?? definition.defaultFilters ?? {},
    fixedFilters: {},
    columns: legacy?.columns ?? definition.defaultColumns,
    groups: legacy?.groups ?? definition.defaultGroups,
    aggregates: legacy?.aggregates ?? definition.defaultAggregates,
    sort: legacy?.sort ?? definition.defaultSort,
    search: "",
    widths: {},
    mode: legacy?.mode ?? definition.defaultMode,
    summarySort: null,
    drill: [],
  };
}

// Filtro rápido "ligado": compara a forma normalizada (modelo salvo e pílula guardam valueTo/values
// vazios e match, o atalho não).
const sameFilter = (left, right) => {
  const plain = (filter) => {
    const { match: _match, ...rest } = normalizeFilter(filter);
    return JSON.stringify(rest);
  };
  return plain(left) === plain(right);
};

/**
 * @param allowPreferences false quando aberto fora de Relatórios (aba Controle da Manutenção): sem
 *   estrela, sem "Salvar modelo" e sem recente — só Relatórios lista favoritos, modelos e recentes.
 */
export default function ReportView({ reportId, presetId = null, template, actor, onBack, backLabel = "Relatórios", onTemplateSaved, initialPeriod = null, allowPreferences = true }) {
  const can = useCan();
  const definition = getReportDefinition(reportId);
  const preset = presetId ? getLegacyAlias(presetId) : null;
  const [state, setState] = useState(() => {
    const initial = initialState(definition, template, preset, actor.role);
    const periodParam = definition.params.find((param) => param.type === "period");
    return initialPeriod && periodParam ? { ...initial, params: { ...initial.params, [periodParam.id]: initialPeriod } } : initial;
  });
  const [viewModel, setViewModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(template ?? null);
  const [printPrompt, setPrintPrompt] = useState(null);
  const [orientation, setOrientation] = useState(template?.orientation ?? "auto");
  const lastViewModel = useRef(null);
  const runSeq = useRef(0);
  const favKey = favoriteKey(definition.id, preset ? presetId : null);

  useEffect(() => {
    if (!allowPreferences) return;
    recordRecent(definition.id, actor, { templateId: template?.id ?? null, presetId: preset ? presetId : null }).catch(() => {});
    getFavorites(actor).then((keys) => setFavorite(keys.includes(favKey))).catch(() => {});
  }, [definition.id, template?.id, presetId, preset, favKey, actor, allowPreferences]);

  const serviceFilters = useMemo(() => toServiceFilters(state.uiFilters, definition.columns), [state.uiFilters, definition]);

  // reload=false: mudou só seleção (filtro, coluna, grupo, total, modo) → reaproveita as linhas já
  // lidas se os parâmetros forem os mesmos. "Atualizar" sempre relê o banco.
  const execute = useCallback(async ({ reload = false } = {}) => {
    const seq = ++runSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await runReport(definition.id, {
        params: state.params,
        selection: {
          columns: state.columns, filters: serviceFilters, fixedFilters: state.fixedFilters, groups: state.groups, aggregates: state.aggregates, sort: state.sort, search: state.search,
          mode: state.mode, summarySort: state.summarySort, drill: state.drill,
        },
        reuse: reload ? null : lastViewModel.current,
        // Visão antiga (favorito/link de antes da 1.4.0): vai para o manifesto das emissões.
        presetId: preset && !template ? presetId : null,
      }, actor);
      if (seq !== runSeq.current) return;
      lastViewModel.current = result;
      setViewModel(result);
    } catch (err) {
      if (seq !== runSeq.current) return;
      setError(err);
    } finally {
      if (seq === runSeq.current) setLoading(false);
    }
  }, [definition.id, state, serviceFilters, actor, preset, presetId, template]);

  useEffect(() => {
    const timer = setTimeout(() => execute(), 200);
    return () => clearTimeout(timer);
  }, [execute]);

  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  const periodParam = definition.params.find((param) => param.type === "period");
  const period = periodParam ? state.params[periodParam.id] ?? {} : null;
  const setPeriod = (next) => update({ params: { ...state.params, [periodParam.id]: next } });
  const visibleColumns = viewModel?.columns ?? [];
  const available = viewModel?.availableColumns ?? [];
  const summaryMode = (viewModel?.mode ?? state.mode) === REPORT_MODES.RESUMIDO;

  // Agrupar por (rápido): colunas mais usadas do relatório; mais níveis pelo diálogo.
  const quickGroupOptions = useMemo(() => {
    // Antes do primeiro cálculo as colunas vêm da definição (filtradas pelo perfil): o seletor nunca
    // mostra o id técnico enquanto carrega.
    const source = available.length ? available : definition.columns.filter((column) => canSeeColumn(column, actor.role));
    const groupable = source.filter((column) => column.groupable);
    // O agrupamento padrão do relatório está sempre entre as opções (ex.: Sessão no Fechamento do dia).
    const quick = definition.quickGroups?.length ? definition.quickGroups : groupable.slice(0, 8).map((column) => column.id);
    const ids = [...new Set([...(definition.defaultGroups ?? []).map((group) => group.columnId), ...quick])];
    return ids.map((id) => groupable.find((column) => column.id === id)).filter(Boolean);
  }, [available, definition, actor.role]);
  const columnLabel = (columnId) => (available.find((column) => column.id === columnId) ?? definition.columns.find((column) => column.id === columnId))?.label ?? columnId;
  const quickGroupValue = state.groups.length === 0 ? NO_GROUP
    : state.groups.length === 1 && quickGroupOptions.some((column) => column.id === state.groups[0].columnId) ? state.groups[0].columnId : CUSTOM_GROUP;
  const setGroups = (groups) => update({ groups, drill: [] });
  const setMode = (mode) => update({ mode, drill: mode === REPORT_MODES.RESUMIDO ? [] : state.drill });

  // Filtros rápidos: ligados quando todos os filtros do atalho estão aplicados como definidos.
  const quickActive = (quick) => Object.entries(quick.filters).every(([columnId, filter]) => state.uiFilters[columnId] && sameFilter(state.uiFilters[columnId], filter));
  const toggleQuick = (quick) => {
    const next = { ...state.uiFilters };
    if (quickActive(quick)) for (const columnId of Object.keys(quick.filters)) delete next[columnId];
    else Object.assign(next, JSON.parse(JSON.stringify(quick.filters)));
    update({ uiFilters: next });
  };

  const onSort = (columnId) => {
    const currentSort = state.sort.find((item) => item.columnId === columnId);
    const direction = currentSort?.direction === "asc" ? "desc" : "asc";
    update({ sort: [{ columnId, direction }] });
  };
  const onFilter = (columnId, value) => {
    const next = { ...state.uiFilters };
    if (value && isFilterActive(value)) next[columnId] = value;
    else delete next[columnId];
    update({ uiFilters: next });
  };
  // Clique num grupo do Resumido: Detalhado só daquele grupo (recorte exato pela chave do grupo).
  const onDrill = (node) => update({
    mode: REPORT_MODES.DETALHADO,
    drill: node.path.map((part) => ({ columnId: part.columnId, key: part.key, label: formatGroupLabel(definition.columns.find((column) => column.id === part.columnId), part.label, "screen", part.key === NONE_GROUP_KEY) })),
  });

  const exportAs = async (format) => {
    if (!viewModel) return;
    try {
      const result = await emitReport(viewModel, format, actor);
      if (result.canceled) return;
      toast.success(`${format.toUpperCase()} gerado: ${result.written.location}`, { description: `SHA-256 ${result.manifest.sha256.slice(0, 16)}… · ${viewModel.mode === REPORT_MODES.RESUMIDO ? `Resumido · ${viewModel.summaryRows.length} grupo(s)` : `${result.manifest.recordCount} registros`}` });
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode exportar este relatório." : `Falha ao exportar: ${err.message}`);
    }
  };

  // Impressão/PDF: se as colunas não couberem, pergunta (paisagem, reduzir colunas/totais ou exportar) — nunca corta em silêncio.
  const emitDocument = async (kind, overrides = {}) => {
    if (!viewModel) return;
    const options = { orientation: overrides.orientation ?? orientation, widths: state.widths, acceptTooWide: overrides.acceptTooWide ?? false };
    try {
      const result = kind === "pdf" ? await exportPdf(viewModel, actor, options) : await printReport(viewModel, actor, options);
      if (result.blocked) { setPrintPrompt({ kind, layout: result.layout }); return; }
      setPrintPrompt(null);
      if (kind === "pdf" && result.path) toast.success(`PDF gerado: ${result.path}`, { description: `SHA-256 ${result.sha256.slice(0, 16)}… · ${result.layout.orientation === "landscape" ? "paisagem" : "retrato"}` });
      if (kind === "pdf" && result.fallback) toast.info("Sem o aplicativo desktop: use “Salvar como PDF” na janela de impressão.");
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode imprimir ou exportar este relatório." : `Falha na emissão: ${err.message}`);
    }
  };
  const saveAsTemplate = async ({ id, name, scope }) => {
    setSavingTemplate(true);
    try {
      // O detalhe de um grupo é passageiro: o modelo guarda a visão de onde ele saiu (o Resumido).
      const drilling = state.drill.length > 0;
      const saved = await saveTemplate({
        id, name, scope, baseReportId: definition.id,
        columns: state.columns, filters: state.uiFilters, fixedFilters: state.fixedFilters, groups: state.groups, aggregates: state.aggregates, sort: state.sort,
        search: state.search, period, params: Object.fromEntries(Object.entries(state.params).filter(([key]) => key !== periodParam?.id)), widths: state.widths,
        orientation, mode: drilling ? REPORT_MODES.RESUMIDO : state.mode, summarySort: state.summarySort,
      }, actor);
      setCurrentTemplate(saved);
      setDialog(null);
      toast.success(`Modelo “${saved.name}” salvo (${saved.scope === "SHARED" ? "compartilhado" : "pessoal"}).`, drilling ? { description: "O detalhe do grupo não fica no modelo: ele abre no Resumido." } : undefined);
      onTemplateSaved?.(saved);
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode salvar este modelo." : err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Pílulas: colunas visíveis + colunas ocultas que ainda filtram (um filtro nunca fica invisível).
  const pillColumns = [
    ...visibleColumns,
    ...available.filter((column) => !visibleColumns.some((item) => item.id === column.id) && isFilterActive(state.uiFilters[column.id])),
  ];
  const filterPills = pillColumns.map((column) => (
    <MakFilterPill
      key={column.id}
      label={visibleColumns.some((item) => item.id === column.id) ? column.label : `${column.label} (coluna oculta)`}
      value={state.uiFilters[column.id] || null}
      filterType={pillFilterType(column)}
      listOptions={() => pillOptions(viewModel, column)}
      onChange={(value) => onFilter(column.id, value)}
    />
  ));
  const hasActiveFilters = Object.values(state.uiFilters).some(isFilterActive) || Boolean(state.search);
  const lockedEntries = Object.entries(viewModel?.lockedFilters ?? {});
  const drillParts = viewModel?.drill ?? [];

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope rpt-page">
      <ModeloBase1PageHeader title={definition.title} visuallyHidden description={definition.description} />

      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center rpt-toolbar" style={{ background: "var(--bg-card)" }}>
          <div className="mg-action-bar__actions flex min-w-0 items-center rpt-toolbar__left">
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={onBack} title={`Voltar para ${backLabel}`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />{backLabel}
            </button>
            <span className="rpt-breadcrumb" aria-label="Relatório atual">
              <span>{REPORT_FAMILIES[definition.family]}</span> › <strong>{definition.title}</strong>
              {currentTemplate ? <em> · modelo “{currentTemplate.name}”</em> : preset ? <em> · visão “{preset.title}”</em> : null}
            </span>
            {allowPreferences ? (
              <button type="button" className={`rpt-star${favorite ? " is-on" : ""}`} aria-pressed={favorite} title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={async () => setFavorite((await toggleFavorite(favKey, actor)).includes(favKey))}>
                <Star className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="mg-action-bar__end rpt-toolbar__right">
            {periodParam ? (
              <div className="rpt-period" role="group" aria-label="Período">
                <Select value={period?.preset ?? "ultimos_30_dias"} onValueChange={(presetValue) => setPeriod(presetValue === "personalizado" ? { preset: presetValue, from: viewModel?.period?.from, to: viewModel?.period?.to } : { preset: presetValue })}>
                  <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PERIOD_PRESETS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                {period?.preset === "personalizado" ? (
                  <>
                    <Input type="date" aria-label="Data inicial" value={period.from ?? ""} onChange={(event) => setPeriod({ ...period, from: event.target.value })} />
                    <Input type="date" aria-label="Data final" value={period.to ?? ""} onChange={(event) => setPeriod({ ...period, to: event.target.value })} />
                  </>
                ) : null}
              </div>
            ) : null}
            {definition.params.filter((param) => param.type === "integer").map((param) => (
              <label key={param.id} className="rpt-param">
                <span>{param.label}</span>
                <Input type="number" min={param.min ?? undefined} value={state.params[param.id] ?? ""} onChange={(event) => update({ params: { ...state.params, [param.id]: event.target.value === "" ? param.default : Number(event.target.value) } })} />
              </label>
            ))}
            <div className="rpt-tabs rpt-mode" role="group" aria-label="Modo do relatório">
              {[[REPORT_MODES.RESUMIDO, "Resumido", "Uma linha por grupo, com os totais em colunas"], [REPORT_MODES.DETALHADO, "Detalhado", "Todas as linhas, com subtotais por grupo"]].map(([mode, label, title]) => (
                <button key={mode} type="button" className={`rpt-tab${state.mode === mode ? " is-active" : ""}`} aria-pressed={state.mode === mode} title={title} onClick={() => setMode(mode)}>{label}</button>
              ))}
            </div>
            <div className="rpt-group-quick" role="group" aria-label="Agrupar por">
              <span>Agrupar por</span>
              <Select value={quickGroupValue} onValueChange={(value) => (value === CUSTOM_GROUP ? setDialog("groups") : setGroups(value === NO_GROUP ? [] : [{ columnId: value }]))}>
                <SelectTrigger aria-label="Agrupar por"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>Sem agrupamento</SelectItem>
                  {quickGroupOptions.map((column) => <SelectItem key={column.id} value={column.id}>{column.label}</SelectItem>)}
                  <SelectItem value={CUSTOM_GROUP}>{quickGroupValue === CUSTOM_GROUP ? state.groups.map((group) => columnLabel(group.columnId)).join(" › ") : "Mais níveis…"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("groups")} title="Níveis de agrupamento (até 3)" aria-label="Níveis de agrupamento"><Layers className="h-3.5 w-3.5" aria-hidden="true" /></button>
            <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("totals")} title="Totais (métricas do Resumido e dos subtotais)" aria-label="Totais"><Sigma className="h-3.5 w-3.5" aria-hidden="true" /></button>
            {!summaryMode ? <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("columns")} title="Colunas" aria-label="Colunas"><Columns3 className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
            <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => execute({ reload: true })} title="Atualizar (reler os dados do banco)" aria-label="Atualizar"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /></button>
            {allowPreferences ? <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("save")} title="Salvar modelo" aria-label="Salvar modelo"><Save className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
            {can("reports.export") ? <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" disabled={!viewModel || loading} onClick={() => emitDocument("print")} title="Imprimir (A4)" aria-label="Imprimir"><Printer className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
            {can("reports.export") ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green" disabled={!viewModel || loading}><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">{summaryMode ? "Mesma tabela resumida da tela" : "Mesma população e totais da tela"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs" onClick={() => exportAs("csv")}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />CSV (Excel pt-BR)</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => exportAs("xlsx")}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />XLSX (Excel)</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => exportAs("json")}><FileJson className="h-3.5 w-3.5" aria-hidden="true" />JSON com manifesto</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs" onClick={() => emitDocument("pdf")}><FileText className="h-3.5 w-3.5" aria-hidden="true" />PDF (A4)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Orientação: {orientation === "auto" ? "automática" : orientation === "landscape" ? "paisagem" : "retrato"}</DropdownMenuLabel>
                  {["auto", "portrait", "landscape"].map((value) => <DropdownMenuItem key={value} className="text-xs" onClick={() => setOrientation(value)}>{value === "auto" ? "Automática" : value === "landscape" ? "Paisagem" : "Retrato"}{orientation === value ? " ✓" : ""}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
        <MgTablePanelStrip onConfigColumns={() => setDialog(summaryMode ? "totals" : "columns")}>
          <MakFilterRail hasActiveFilters={hasActiveFilters} onClear={() => update({ uiFilters: {}, search: "" })}>
            <Input type="search" className="rpt-search" aria-label="Pesquisar no relatório" placeholder="Pesquisar…" value={state.search} onChange={(event) => update({ search: event.target.value })} />
            {drillParts.length ? (
              <span className="rpt-drill-pill" title="Detalhe de um grupo do Resumido">
                <SearchCheck className="h-3 w-3" aria-hidden="true" />
                Detalhe: {drillParts.map((part) => `${part.columnLabel}: ${part.label}`).join(" › ")}
                <button type="button" aria-label="Voltar ao Resumido" title="Voltar ao Resumido" onClick={() => update({ drill: [], mode: REPORT_MODES.RESUMIDO })}><X className="h-3 w-3" aria-hidden="true" /></button>
              </span>
            ) : null}
            {(definition.quickFilters ?? []).map((quick) => (
              <button key={quick.id} type="button" className={`rpt-quick-filter${quickActive(quick) ? " is-on" : ""}`} aria-pressed={quickActive(quick)} onClick={() => toggleQuick(quick)}>
                {quick.label}
              </button>
            ))}
            {lockedEntries.map(([columnId, filter]) => (
              <span key={`locked-${columnId}`} className="rpt-locked-pill" title="Condição fixa do relatório">
                <Lock className="h-3 w-3" aria-hidden="true" />{available.find((column) => column.id === columnId)?.label ?? columnId} {describeFilter(filter, available.find((column) => column.id === columnId))}
              </span>
            ))}
            {filterPills}
          </MakFilterRail>
        </MgTablePanelStrip>
      </div>

      <div className="d17b-list-body">
        <Card className="d17b-table-card">
          <CardContent className="p-0 rpt-card-content">
          <div className="rpt-card-head">
        <div className="rpt-context" aria-live="polite">
          <span><strong>Período:</strong> {viewModel?.period ? describePeriod(viewModel.period) : periodParam ? "—" : "estado atual (hoje)"}</span>
          <span>{summaryMode ? "Resumido: uma linha por grupo" : viewModel?.grainLabel ? viewModel.grainLabel.charAt(0).toUpperCase() + viewModel.grainLabel.slice(1) : "—"}</span>
          {viewModel?.classification && viewModel.classification !== "CANÔNICO" ? <span className="rpt-legacy">{viewModel.classification}</span> : null}
          {viewModel?.groups?.length ? <span><strong>Agrupado por:</strong> {viewModel.groups.map((group) => group.label).join(" › ")}</span> : null}
          {loading ? <span className="rpt-loading">Calculando…</span> : viewModel ? <span className="rpt-timing" title={`Leitura: ${viewModel.stats.strategy}`}>{viewModel.rowCount.toLocaleString("pt-BR")} registro(s) · {Math.round(viewModel.stats.timings.total)} ms</span> : null}
        </div>
        {(viewModel?.warnings ?? []).map((warning) => (
          <div key={warning.code} className="rpt-warning" role="status"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{warning.message}</div>
        ))}
        {(definition.notes ?? []).length ? <ul className="rpt-notes">{definition.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        {error ? <div className="rpt-error" role="alert">{error.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode abrir este relatório." : error.message}</div> : null}
          </div>
            {viewModel ? (summaryMode && viewModel.mode === REPORT_MODES.RESUMIDO ? (
              <ReportSummaryTable
                viewModel={viewModel}
                summarySort={state.summarySort}
                onSummarySort={(summarySort) => update({ summarySort })}
                onDrill={onDrill}
                onChooseGrouping={() => setDialog("groups")}
              />
            ) : (
              <ReportTable
                viewModel={viewModel}
                sort={state.sort}
                onSort={onSort}
                widths={state.widths}
                filters={state.uiFilters}
                onFilter={onFilter}
                onHide={(columnId) => update({ columns: state.columns.filter((id) => id !== columnId) })}
                optionsFor={(column) => pillOptions(viewModel, column)}
                filterTypeFor={pillFilterType}
              />
            )) : <div className="rpt-empty">{loading ? "Calculando o relatório…" : "—"}</div>}
          </CardContent>
        </Card>
      </div>

      {dialog === "columns" && viewModel ? (
        <MakColumnConfigDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          columns={available.map((column) => ({ id: column.id, label: column.label, default: definition.defaultColumns.includes(column.id) }))}
          order={[...state.columns, ...available.map((column) => column.id).filter((id) => !state.columns.includes(id))]}
          visible={state.columns}
          onApply={({ order, visible }) => { update({ columns: order.filter((id) => visible.includes(id)) }); setDialog(null); }}
        />
      ) : null}
      <ReportGroupingDialog open={dialog === "groups"} onOpenChange={(open) => !open && setDialog(null)} columns={available} groups={state.groups} onApply={setGroups} />
      <ReportTotalsDialog open={dialog === "totals"} onOpenChange={(open) => !open && setDialog(null)} columns={available} aggregates={state.aggregates} animalColumnId={definition.animalColumnId} onApply={(aggregates) => update({ aggregates, summarySort: aggregates.some((spec) => spec.id === state.summarySort?.key) ? state.summarySort : null })} />
      <ReportSaveTemplateDialog open={dialog === "save"} onOpenChange={(open) => !open && setDialog(null)} current={currentTemplate && (currentTemplate.ownerUserId === actor.id || can("reports.templates.share")) ? currentTemplate : null} canShare={can("reports.templates.share")} onSave={saveAsTemplate} busy={savingTemplate} />
      <Dialog open={Boolean(printPrompt)} onOpenChange={(open) => !open && setPrintPrompt(null)}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact rpt-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />Este relatório possui muitas colunas para impressão.</DialogTitle>
            <DialogDescription>{printPrompt ? `${printPrompt.layout.columnCount} colunas não cabem em A4 ${printPrompt.layout.orientation === "landscape" ? "paisagem" : "retrato"}. Nenhuma coluna é escondida automaticamente.` : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="rpt-print-options">
            {printPrompt?.layout.warning?.options?.includes("paisagem") ? <Button type="button" variant="outline" onClick={() => { setOrientation("landscape"); emitDocument(printPrompt.kind, { orientation: "landscape" }); }}>Usar paisagem</Button> : null}
            <Button type="button" variant="outline" onClick={() => { setPrintPrompt(null); setDialog(summaryMode ? "totals" : "columns"); }}>{summaryMode ? "Reduzir totais" : "Reduzir colunas"}</Button>
            {can("reports.export") ? <Button type="button" variant="outline" onClick={() => { setPrintPrompt(null); exportAs("csv"); }}>Exportar CSV</Button> : null}
            <Button type="button" className="emp-toolbar-btn-save" onClick={() => emitDocument(printPrompt.kind, { acceptTooWide: true })}>Continuar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModeloBase1PageContainer>
  );
}
