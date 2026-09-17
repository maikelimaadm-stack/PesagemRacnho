import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Columns3, Download, FileJson, FileSpreadsheet, FileText, Layers, Lock, Printer, RefreshCw, Save, Sigma, Star } from "lucide-react";
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
import { isFilterActive } from "@/modules/reporting/domain/filterEngine";
import { PERIOD_PRESETS, describePeriod } from "@/modules/reporting/domain/reportPeriod";
import { REPORT_FAMILIES } from "@/modules/reporting/domain/reportDefinition";
import { getReportDefinition } from "@/modules/reporting/definitions/reportCatalog";
import { runReport } from "@/modules/reporting/application/reportService";
import { emitReport } from "@/modules/reporting/application/reportExportService";
import { exportPdf, printReport } from "@/modules/reporting/application/reportPrintService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFavorites, recordRecent, saveTemplate, templateToRequest, toggleFavorite } from "@/modules/reporting/application/reportTemplateService";
import { ReportGroupingDialog, ReportSaveTemplateDialog, ReportTotalsDialog } from "./ReportDialogs";
import ReportTable from "./ReportTable";
import { pillFilterType, pillOptions, toEngineFilters, useCan } from "./reportUi";

function describeFilterValue(filter) {
  if (filter.values?.length) return filter.values.join(", ");
  if (filter.valueTo) return `${filter.value} – ${filter.valueTo}`;
  return `${filter.operator ?? ""} ${filter.value ?? ""}`.trim();
}

function initialState(definition, template, role) {
  if (template) {
    const request = templateToRequest(template, role);
    request.warnings.forEach((warning) => toast.warning(warning.message));
    return {
      params: request.params,
      uiFilters: request.selection.filters,
      columns: request.selection.columns.length ? request.selection.columns : definition.defaultColumns,
      groups: request.selection.groups,
      aggregates: request.selection.aggregates,
      sort: request.selection.sort,
      search: request.selection.search,
      widths: request.widths,
    };
  }
  const params = {};
  for (const param of definition.params) if (param.default != null) params[param.id] = param.default;
  return {
    params,
    uiFilters: definition.defaultFilters ?? {},
    columns: definition.defaultColumns,
    groups: definition.defaultGroups,
    aggregates: definition.defaultAggregates,
    sort: definition.defaultSort,
    search: "",
    widths: {},
  };
}

export default function ReportView({ reportId, template, actor, onBack, onTemplateSaved, initialPeriod = null }) {
  const can = useCan();
  const definition = getReportDefinition(reportId);
  const [state, setState] = useState(() => {
    const initial = initialState(definition, template, actor.role);
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

  useEffect(() => {
    recordRecent(reportId, actor, { templateId: template?.id ?? null }).catch(() => {});
    getFavorites(actor).then((ids) => setFavorite(ids.includes(reportId))).catch(() => {});
  }, [reportId, template?.id, actor]);

  const engineFilters = useMemo(
    () => toEngineFilters(state.uiFilters, lastViewModel.current, definition.columns),
    [state.uiFilters, definition],
  );

  const execute = useCallback(async () => {
    const seq = ++runSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await runReport(reportId, {
        params: state.params,
        selection: { columns: state.columns, filters: engineFilters, groups: state.groups, aggregates: state.aggregates, sort: state.sort, search: state.search },
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
  }, [reportId, state, engineFilters, actor]);

  useEffect(() => {
    const timer = setTimeout(execute, 200);
    return () => clearTimeout(timer);
  }, [execute]);

  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  const periodParam = definition.params.find((param) => param.type === "period");
  const period = periodParam ? state.params[periodParam.id] ?? {} : null;
  const setPeriod = (next) => update({ params: { ...state.params, [periodParam.id]: next } });
  const visibleColumns = viewModel?.columns ?? [];
  const available = viewModel?.availableColumns ?? [];

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

  const exportAs = async (format) => {
    if (!viewModel) return;
    try {
      const result = await emitReport(viewModel, format, actor);
      if (result.canceled) return;
      toast.success(`${format.toUpperCase()} gerado: ${result.written.location}`, { description: `SHA-256 ${result.manifest.sha256.slice(0, 16)}… · ${result.manifest.recordCount} registros` });
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode exportar este relatório." : `Falha ao exportar: ${err.message}`);
    }
  };

  // Impressão/PDF: se as colunas não couberem, pergunta (paisagem, reduzir colunas ou exportar) — nunca corta em silêncio.
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
      const saved = await saveTemplate({
        id, name, scope, baseReportId: reportId,
        columns: state.columns, filters: state.uiFilters, groups: state.groups, aggregates: state.aggregates, sort: state.sort,
        search: state.search, period, params: Object.fromEntries(Object.entries(state.params).filter(([key]) => key !== periodParam?.id)), widths: state.widths,
      }, actor);
      setCurrentTemplate(saved);
      setDialog(null);
      toast.success(`Modelo “${saved.name}” salvo (${saved.scope === "SHARED" ? "compartilhado" : "pessoal"}).`);
      onTemplateSaved?.(saved);
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode salvar este modelo." : err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const filterPills = visibleColumns.map((column) => (
    <MakFilterPill
      key={column.id}
      label={column.label}
      value={state.uiFilters[column.id] || null}
      filterType={pillFilterType(column)}
      listOptions={pillOptions(viewModel, column)}
      onChange={(value) => onFilter(column.id, value)}
    />
  ));
  const hasActiveFilters = Object.values(state.uiFilters).some(isFilterActive) || Boolean(state.search);
  const lockedEntries = Object.entries(viewModel?.lockedFilters ?? {});

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope rpt-page">
      <ModeloBase1PageHeader title={definition.title} visuallyHidden description={definition.description} />

      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center rpt-toolbar" style={{ background: "var(--bg-card)" }}>
          <div className="mg-action-bar__actions flex min-w-0 items-center rpt-toolbar__left">
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={onBack} title="Voltar ao catálogo">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Relatórios
            </button>
            <span className="rpt-breadcrumb" aria-label="Relatório atual">
              <span>{REPORT_FAMILIES[definition.family]}</span> › <strong>{definition.title}</strong>
              {currentTemplate ? <em> · modelo “{currentTemplate.name}”</em> : null}
            </span>
            <button type="button" className={`rpt-star${favorite ? " is-on" : ""}`} aria-pressed={favorite} title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={async () => setFavorite((await toggleFavorite(reportId, actor)).includes(reportId))}>
              <Star className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mg-action-bar__end rpt-toolbar__right">
            {periodParam ? (
              <div className="rpt-period" role="group" aria-label="Período">
                <Select value={period?.preset ?? "ultimos_30_dias"} onValueChange={(preset) => setPeriod(preset === "personalizado" ? { preset, from: viewModel?.period?.from, to: viewModel?.period?.to } : { preset })}>
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
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => setDialog("groups")}><Layers className="h-3.5 w-3.5" aria-hidden="true" />Agrupar</button>
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => setDialog("totals")}><Sigma className="h-3.5 w-3.5" aria-hidden="true" />Totais</button>
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => setDialog("columns")}><Columns3 className="h-3.5 w-3.5" aria-hidden="true" />Colunas</button>
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={execute} title="Atualizar"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Atualizar</button>
            <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" onClick={() => setDialog("save")}><Save className="h-3.5 w-3.5" aria-hidden="true" />Salvar modelo</button>
            {can("reports.export") ? <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" disabled={!viewModel || loading} onClick={() => emitDocument("print")}><Printer className="h-3.5 w-3.5" aria-hidden="true" />Imprimir</button> : null}
            {can("reports.export") ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green" disabled={!viewModel || loading}><Download className="h-3.5 w-3.5" aria-hidden="true" />Exportar</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Mesma população e totais da tela</DropdownMenuLabel>
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
        <MgTablePanelStrip onConfigColumns={() => setDialog("columns")}>
          <MakFilterRail hasActiveFilters={hasActiveFilters} onClear={() => update({ uiFilters: {}, search: "" })}>
            {lockedEntries.map(([columnId, filter]) => (
              <span key={`locked-${columnId}`} className="rpt-locked-pill" title="Condição fixa do relatório">
                <Lock className="h-3 w-3" aria-hidden="true" />{available.find((column) => column.id === columnId)?.label ?? columnId}: {describeFilterValue(filter)}
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
          <span><strong>Período:</strong> {viewModel?.period ? describePeriod(viewModel.period) : "—"}</span>
          <span><strong>Grão:</strong> {viewModel?.grainLabel ?? "—"}</span>
          {viewModel?.classification && viewModel.classification !== "CANÔNICO" ? <span className="rpt-legacy">{viewModel.classification}</span> : null}
          {viewModel?.groups?.length ? <span><strong>Agrupado por:</strong> {viewModel.groups.map((group) => group.label).join(" › ")}</span> : null}
          {loading ? <span className="rpt-loading">Calculando…</span> : viewModel ? <span className="rpt-timing">{Math.round(viewModel.stats.timings.total)} ms · {viewModel.stats.strategy}</span> : null}
        </div>
        {(viewModel?.warnings ?? []).map((warning) => (
          <div key={warning.code} className="rpt-warning" role="status"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{warning.message}</div>
        ))}
        {(definition.notes ?? []).length ? <ul className="rpt-notes">{definition.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        {error ? <div className="rpt-error" role="alert">{error.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode abrir este relatório." : error.message}</div> : null}
          </div>
            {viewModel ? (
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
            ) : <div className="rpt-empty">{loading ? "Calculando o relatório…" : "—"}</div>}
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
      <ReportGroupingDialog open={dialog === "groups"} onOpenChange={(open) => !open && setDialog(null)} columns={available} groups={state.groups} onApply={(groups) => update({ groups })} />
      <ReportTotalsDialog open={dialog === "totals"} onOpenChange={(open) => !open && setDialog(null)} columns={available} aggregates={state.aggregates} animalColumnId={definition.animalColumnId} onApply={(aggregates) => update({ aggregates })} />
      <ReportSaveTemplateDialog open={dialog === "save"} onOpenChange={(open) => !open && setDialog(null)} current={currentTemplate && (currentTemplate.ownerUserId === actor.id || can("reports.templates.share")) ? currentTemplate : null} canShare={can("reports.templates.share")} onSave={saveAsTemplate} busy={savingTemplate} />
      <Dialog open={Boolean(printPrompt)} onOpenChange={(open) => !open && setPrintPrompt(null)}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact rpt-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />Este relatório possui muitas colunas para impressão.</DialogTitle>
            <DialogDescription>{printPrompt ? `${printPrompt.layout.columnCount} colunas não cabem em A4 ${printPrompt.layout.orientation === "landscape" ? "paisagem" : "retrato"}. Nenhuma coluna é escondida automaticamente.` : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="rpt-print-options">
            {printPrompt?.layout.orientation === "portrait" ? <Button type="button" variant="outline" onClick={() => { setOrientation("landscape"); emitDocument(printPrompt.kind, { orientation: "landscape" }); }}>Usar paisagem</Button> : null}
            <Button type="button" variant="outline" onClick={() => { setPrintPrompt(null); setDialog("columns"); }}>Reduzir colunas</Button>
            {can("reports.export") ? <Button type="button" variant="outline" onClick={() => { setPrintPrompt(null); exportAs("csv"); }}>Exportar CSV</Button> : null}
            <Button type="button" className="emp-toolbar-btn-save" onClick={() => emitDocument(printPrompt.kind, { acceptTooWide: true })}>Continuar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModeloBase1PageContainer>
  );
}
