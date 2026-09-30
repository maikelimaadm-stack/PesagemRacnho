import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Columns3, Eye, EyeOff, FileJson, FileSpreadsheet, FileText, Layers, Lock, MoreHorizontal, Printer, RefreshCw, Save, ScrollText, SearchCheck, Sigma, Star, Table2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import MakColumnConfigDialog from "@/components/mak/MakColumnConfigDialog";
import MakFilterPill from "@/components/mak/MakFilterPill";
import MakFilterRail from "@/components/mak/MakFilterRail";
import MgTablePanelStrip from "@/components/mak/MgTablePanelStrip";
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from "@/components/modelobase1";
import { describeFilter, isFilterActive, normalizeFilter } from "@/modules/reporting/domain/filterEngine";
import { describePeriod } from "@/modules/reporting/domain/reportPeriod";
import { REPORT_FAMILIES, REPORT_MODES, VIEW_LAYOUTS } from "@/modules/reporting/domain/reportDefinition";
import { SUMMARY_LABEL_SORT, formatGroupLabel, summaryMetrics } from "@/modules/reporting/domain/summaryLayout";
import { NONE_GROUP_KEY } from "@/modules/reporting/domain/groupEngine";
import { canSeeColumn } from "@/modules/reporting/domain/reportPermissions";
import { leaveViewPatch, screenFixedFilters, screenModePatch, templatePayload, viewStatePayload } from "@/modules/reporting/domain/reportScreenState";
import { applyColumnKeys, columnKeysOf, getReportView, listReportViews, parseSortChoice, resolveViewId } from "@/modules/reporting/domain/reportViews";
import { applySortChoice, sortChoiceForColumn, sortChoiceForMetric } from "@/modules/reporting/domain/sortChoices";
import { hasTypeColumns, typeColumnOptions } from "@/modules/reporting/domain/typeColumns";
import { getReportDefinition } from "@/modules/reporting/definitions/reportCatalog";
import { getLegacyAlias } from "@/modules/reporting/definitions/legacyAliases";
import { buildInitialReportState, typedViewSelection } from "@/modules/reporting/application/reportInitialState";
import { runReport } from "@/modules/reporting/application/reportService";
import { emitReport } from "@/modules/reporting/application/reportExportService";
import { exportPdf, printReport } from "@/modules/reporting/application/reportPrintService";
import { loadReportHeader } from "@/modules/catalog/application/propertyHeaderService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteTemplate, favoriteKey, getFavorites, listTemplates, recordRecent, saveReportViewState, saveTemplate, saveTypeColumnPrefs, toggleFavorite } from "@/modules/reporting/application/reportTemplateService";
import { PREVIOUS_COLUMN, filterButtonsOf, integerParamsOf, isPesagensScreen, quickFiltersOf } from "@/modules/reporting/application/reportScreenModel";
import AnalyticGroupButtons from "./AnalyticGroupButtons";
import { ReportGroupingDialog, ReportSaveTemplateDialog, ReportTotalsDialog } from "./ReportDialogs";
import ReportFilterBar from "./ReportFilterBar";
import MatrixAxisControls from "./MatrixAxisControls";
import { MakgestaoColumnsButton, MakgestaoFilterButton, MakgestaoFilterCard, MakgestaoTopBar, makOrientation } from "./MakgestaoScreen";
import ReportSheetView from "./ReportSheetView";
import ReportTable from "./ReportTable";
import { pillFilterType, pillOptions, toDisplayFilters, toServiceFilters, useCan } from "./reportUi";

const NO_GROUP = "__nenhum__";
const CUSTOM_GROUP = "__personalizado__";
// Botões de filtro (E1B §3, linha 2; Pesagens: a lista da E1D), Pesagem Anterior, parâmetros e filtros
// rápidos de cada relatório: application/reportScreenModel.js (o gate reports:tela-unica confere).

// Estado inicial (E1D): application/reportInitialState — o mesmo código que o gate reports:pesagens-tipos
// confere em Node (modelo > visão antiga > último estado > tipo padrão do relatório, este com a escolha de
// "Colunas" que a pessoa salvou para o tipo).
function initialState(definition, template, preset, role, savedState, typeColumns = null) {
  const { state, warnings } = buildInitialReportState(definition, { template, preset, role, savedState, typeColumns });
  warnings.forEach((warning) => toast.warning(warning.message));
  return state;
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

const lowerFirst = (text) => (text ? text.charAt(0).toLocaleLowerCase("pt-BR") + text.slice(1) : text);

/** "Ordenar por": nível de data (mais recente/antiga), nome do grupo e métricas no Resumido; colunas no Detalhado. */
function buildSortOptions({ summaryMode, groups, columnOf, metrics, visibleColumns }) {
  const options = [{ value: "padrao", label: "Padrão do relatório" }];
  if (summaryMode) {
    groups.forEach((group, index) => {
      const column = columnOf(group.columnId);
      if (column && (column.type === "date" || column.type === "datetime")) {
        options.push({ value: `nivel:${index}:desc`, label: `${column.label} (mais recente)` }, { value: `nivel:${index}:asc`, label: `${column.label} (mais antiga)` });
      }
    });
    if (groups.length) options.push({ value: "rotulo:asc", label: "Nome do grupo (A–Z)" }, { value: "rotulo:desc", label: "Nome do grupo (Z–A)" });
    for (const metric of metrics) options.push({ value: `metrica:${metric.key}:desc`, label: `Maior ${lowerFirst(metric.label)}` }, { value: `metrica:${metric.key}:asc`, label: `Menor ${lowerFirst(metric.label)}` });
  } else {
    for (const column of visibleColumns) options.push({ value: `coluna:${column.id}:asc`, label: `${column.label} (crescente)` }, { value: `coluna:${column.id}:desc`, label: `${column.label} (decrescente)` });
  }
  return options;
}

function currentSortValue({ summaryMode, state, definition, options }) {
  const has = (value) => options.some((option) => option.value === value);
  if (summaryMode) {
    if (state.summarySort?.key === SUMMARY_LABEL_SORT) return has(`rotulo:${state.summarySort.direction}`) ? `rotulo:${state.summarySort.direction}` : "custom";
    if (state.summarySort?.key) return has(`metrica:${state.summarySort.key}:${state.summarySort.direction}`) ? `metrica:${state.summarySort.key}:${state.summarySort.direction}` : "custom";
    const desc = state.groups.findIndex((group) => group.direction === "desc");
    if (desc >= 0) return has(`nivel:${desc}:desc`) ? `nivel:${desc}:desc` : "custom";
    return "padrao";
  }
  const first = state.sort?.[0];
  if (!first || JSON.stringify(state.sort) === JSON.stringify(definition.defaultSort)) return "padrao";
  return has(`coluna:${first.columnId}:${first.direction}`) ? `coluna:${first.columnId}:${first.direction}` : "custom";
}

/**
 * @param allowPreferences false quando aberto fora de Relatórios (aba Controle da Manutenção): sem
 *   estrela, sem "Salvar modelo", sem recente e sem último estado — só Relatórios guarda preferências.
 * @param savedState último estado do usuário (Relatorios.jsx lê antes de montar) ou null.
 * @param typeColumnPrefs E1D: escolha de "Colunas" de cada tipo para o usuário ({ [viewId]: [chave] }, de
 *   getTypeColumnPrefs — Relatorios.jsx lê antes de montar) ou null.
 * @param reportOptions E1E (tela única): opções do campo "Relatório" (reportScreenModel.reportSelectorOptions)
 *   com onSelectReport(id); onOpenTemplate(modelo | null) abre um modelo do menu ⋯ (null = o relatório sem
 *   modelo, depois de excluir o aberto). Sem reportOptions (aba Controle da Manutenção), a tela da 1.4.0.
 */
export default function ReportView({ reportId, presetId = null, template, savedState = null, typeColumnPrefs = null, actor, onBack = null, backLabel = "Relatórios", onTemplateSaved, initialPeriod = null, allowPreferences = true, reportOptions = null, onSelectReport = null, onOpenTemplate = null }) {
  const can = useCan();
  const definition = getReportDefinition(reportId);
  // E1E: em Relatórios (tela única, com o campo "Relatório") TODOS abrem na tela "como o MAKGESTAO"
  // (MakgestaoScreen); a aba Controle da Manutenção continua com a da 1.4.0.
  const makScreen = Boolean(reportOptions) || isPesagensScreen(definition);
  const preset = presetId ? getLegacyAlias(presetId) : null;
  // E1D: escolha de colunas por tipo (vale nesta tela ao trocar de tipo; gravada por usuário ao aplicar).
  const [typeColumns, setTypeColumns] = useState(() => (allowPreferences && typeColumnPrefs ? { ...typeColumnPrefs } : {}));
  const [state, setState] = useState(() => {
    const initial = initialState(definition, template, preset, actor.role, allowPreferences ? savedState : null, typeColumns);
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
  const [header, setHeader] = useState(null);
  // E1E: modelos deste relatório para "Abrir modelo" (menu ⋯); null = a tela não abre modelos.
  const [templates, setTemplates] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastViewModel = useRef(null);
  const runSeq = useRef(0);
  const favKey = favoriteKey(definition.id, preset ? presetId : null);
  const views = useMemo(() => listReportViews(definition), [definition]);

  useEffect(() => {
    if (!allowPreferences) return;
    recordRecent(definition.id, actor, { templateId: template?.id ?? null, presetId: preset ? presetId : null }).catch(() => {});
    getFavorites(actor).then((keys) => setFavorite(keys.includes(favKey))).catch(() => {});
  }, [definition.id, template?.id, presetId, preset, favKey, actor, allowPreferences]);

  const loadTemplates = useCallback(() => {
    if (!allowPreferences || !onOpenTemplate) return;
    listTemplates(actor, { reportId: definition.id }).then(setTemplates).catch(() => setTemplates([]));
  }, [allowPreferences, onOpenTemplate, actor, definition.id]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

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
          columns: state.columns, filters: serviceFilters, fixedFilters: screenFixedFilters(state), groups: state.groups, aggregates: state.aggregates, sort: state.sort, search: state.search,
          mode: state.mode, summarySort: state.summarySort, drill: state.drill,
          // E1D: tipo explícito, eixos da matriz e opção fixa de "Ordenar por" (o serviço aplica).
          view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
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
  }, [definition.id, state.params, state.columns, serviceFilters, state.fixedFilters, state.typePopulation, state.groups, state.aggregates, state.sort, state.search, state.mode, state.summarySort, state.drill, state.view, state.matrix, state.sortChoice, actor, preset, presetId, template]);

  useEffect(() => {
    const timer = setTimeout(() => execute(), 200);
    return () => clearTimeout(timer);
  }, [execute]);

  // Cabeçalho da folha: propriedade do filtro (quando houver uma só) ou a Padrão; sem nenhuma, o nome do sistema.
  const headerKey = JSON.stringify([viewModel?.filters ?? {}, viewModel?.lockedFilters ?? {}, viewModel?.drill ?? []]);
  useEffect(() => {
    let alive = true;
    const context = JSON.parse(headerKey);
    loadReportHeader({ filters: context[0], lockedFilters: context[1], drill: context[2] })
      .then((loaded) => { if (alive) setHeader(loaded); })
      .catch(() => { if (alive) setHeader(null); });
    return () => { alive = false; };
  }, [headerKey]);

  const update = (patch) => setState((current) => ({ ...current, ...patch }));
  // Na tela do MAKGESTAO só há Retrato/Paisagem (padrão Paisagem, como o antigo): "Automática" sai em paisagem.
  const sheetOrientation = makScreen ? makOrientation(state.orientation) : state.orientation;
  const periodParam = definition.params.find((param) => param.type === "period");
  const period = periodParam ? state.params[periodParam.id] ?? {} : null;
  const setPeriod = (next) => update({ params: { ...state.params, [periodParam.id]: next } });
  const visibleColumns = viewModel?.columns ?? [];
  const available = useMemo(
    () => (viewModel?.availableColumns?.length ? viewModel.availableColumns : definition.columns.filter((column) => canSeeColumn(column, actor.role))),
    [viewModel, definition, actor.role],
  );
  const columnOf = useCallback((columnId) => available.find((column) => column.id === columnId) ?? null, [available]);
  const summaryMode = (viewModel?.mode ?? state.mode) === REPORT_MODES.RESUMIDO;

  // Último estado do usuário: grava (com espera curta) como a pessoa deixou. Só quando o relatório foi
  // aberto "puro" — aberto por modelo ou por visão antiga, quem guarda é o modelo/visão (e as condições
  // fixas deles nunca vão para o último estado). Sair antes da espera grava na hora (desmontagem).
  // Falha de gravação (banco em somente leitura) não atrapalha a tela.
  const tracksViewState = allowPreferences && !template && !preset;
  const pendingViewState = useRef(null);
  useEffect(() => {
    if (!tracksViewState) return undefined;
    // E1D (Vendas): sem as colunas/totais de valor que o perfil não vê (senão o serviço recusa o estado inteiro).
    const payload = viewStatePayload(definition, state, actor.role);
    pendingViewState.current = payload;
    const timer = setTimeout(() => {
      pendingViewState.current = null;
      saveReportViewState(definition.id, payload, actor).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [tracksViewState, definition, state, actor]);
  useEffect(() => () => {
    const pending = pendingViewState.current;
    pendingViewState.current = null;
    if (pending) saveReportViewState(definition.id, pending, actor).catch(() => {});
  }, [definition.id, actor]);

  // Agrupar por (rápido): colunas mais usadas do relatório; mais níveis pelo diálogo.
  const quickGroupOptions = useMemo(() => {
    const groupable = available.filter((column) => column.groupable);
    // O agrupamento padrão do relatório está sempre entre as opções (ex.: Sessão no Fechamento do dia).
    const quick = definition.quickGroups?.length ? definition.quickGroups : groupable.slice(0, 8).map((column) => column.id);
    const ids = [...new Set([...(definition.defaultGroups ?? []).map((group) => group.columnId), ...quick])];
    return ids.map((id) => groupable.find((column) => column.id === id)).filter(Boolean);
  }, [available, definition]);
  const columnLabel = (columnId) => (columnOf(columnId) ?? definition.columns.find((column) => column.id === columnId))?.label ?? columnId;
  const quickGroupValue = state.groups.length === 0 ? NO_GROUP
    : state.groups.length === 1 && quickGroupOptions.some((column) => column.id === state.groups[0].columnId) ? state.groups[0].columnId : CUSTOM_GROUP;
  const groupOptions = [
    { value: NO_GROUP, label: "Sem agrupamento" },
    ...quickGroupOptions.map((column) => ({ value: column.id, label: column.label })),
    { value: CUSTOM_GROUP, label: quickGroupValue === CUSTOM_GROUP ? state.groups.map((group) => columnLabel(group.columnId)).join(" › ") : "Mais níveis…" },
  ];
  // E1D: agrupar ou trocar o modo pelos controles genéricos sai do tipo ("Personalizado", view null) — os
  // controles próprios de um tipo (botões do Analítico, eixos da matriz) mantêm o tipo. A população do tipo
  // (Vendas = Saída por Venda) continua fixa, com cadeado: nenhum controle a amplia (leaveViewPatch).
  const setGroups = (groups) => update({ groups, drill: [], ...leaveViewPatch(definition, state) });
  // Voltar do detalhe de um grupo para o modo do tipo mantém o tipo (a matriz não some) — modeChangePatch;
  // trocar o modo fora disso sai do tipo levando a população dele (leaveViewPatch).
  const setMode = (mode) => update(screenModePatch(definition, state, mode));

  // Tipo de relatório: atalho para agrupamento + modo (+ totais/colunas/ordem da visão) — nada de conta nova.
  // E1D: o tipo é explícito (state.view); estado de antes da E1D cai no que bate pela estrutura.
  const viewId = resolveViewId(definition, { view: state.view, groups: state.groups, mode: state.mode, aggregates: state.aggregates, columns: state.columns }) ?? "custom";
  const currentView = views.find((item) => item.id === viewId) ?? null;
  const applyView = (id) => {
    const view = views.find((item) => item.id === id);
    if (!view) return;
    // E1D: com as colunas que a pessoa escolheu para ESTE tipo (senão as padrão dele).
    const selection = typedViewSelection(definition, view, typeColumns);
    update({
      view: selection.view,
      matrix: selection.matrix,
      groups: selection.groups,
      mode: selection.mode,
      aggregates: selection.aggregates ?? state.aggregates,
      columns: selection.columns?.length ? selection.columns : state.columns,
      sort: selection.sort ?? state.sort,
      summarySort: selection.summarySort ?? null,
      // "Personalizado" do Ordenar por (clique num cabeçalho) era daquele tipo: o novo volta ao padrão.
      ...(definition.sortChoices?.length && !state.sortChoice ? { sortChoice: definition.defaultSortChoice ?? null } : {}),
      // Só a visão que declara filtros mexe nos filtros; os da pessoa ficam.
      ...(view.filters ? { uiFilters: { ...state.uiFilters, ...toDisplayFilters(JSON.parse(JSON.stringify(view.filters)), definition.columns) } } : {}),
      drill: [],
    });
  };
  // E1D Sintético (Matriz): trocar Linhas/Colunas mantém o tipo e sai do detalhe de uma célula (volta à matriz).
  const setMatrixAxes = (matrix) => update({ matrix, drill: [], mode: currentView?.mode ?? state.mode });

  // E1D (item 5): seletor "Colunas" do TIPO (columnChoices) — no Resumido escolhe as métricas por chave, no
  // Detalhado só as colunas disponíveis do tipo. Vale quando o tipo está no próprio modo (no detalhe de um
  // grupo do Resumido o seletor volta a ser o das colunas de dados). Aplicar grava a escolha do tipo para o
  // usuário (nunca amplia permissão: o serviço valida contra o tipo e o papel).
  const typeColumnsOn = hasTypeColumns(currentView) && currentView.mode === (viewModel?.mode ?? state.mode);
  const applyTypeColumns = (view, keys) => {
    const chosen = applyColumnKeys(view, definition, keys);
    if (view.mode === REPORT_MODES.DETALHADO) update({ columns: chosen.columns });
    else update({ aggregates: chosen.aggregates, summarySort: chosen.aggregates.some((spec) => spec.id === state.summarySort?.key) ? state.summarySort : null });
    setTypeColumns((current) => {
      const next = { ...current };
      if (keys.length) next[view.id] = [...keys];
      else delete next[view.id];
      return next;
    });
    if (allowPreferences) saveTypeColumnPrefs(definition.id, view.id, keys, actor).catch(() => {});
  };
  // Opções do seletor do tipo (só as chaves de columnChoices.available que o papel vê) e a escolha atual.
  const typeColumnDialog = typeColumnsOn
    ? { options: typeColumnOptions(definition, currentView, actor.role), current: columnKeysOf(currentView, definition, { columns: state.columns, aggregates: state.aggregates }) }
    : null;
  const hideColumn = (columnId) => {
    const next = state.columns.filter((id) => id !== columnId);
    if (typeColumnsOn && currentView.mode === REPORT_MODES.DETALHADO) applyTypeColumns(currentView, columnKeysOf(currentView, definition, { columns: next }));
    else update({ columns: next });
  };

  // E1D: controles próprios do tipo atual, no encaixe typeControls da barra (C: botões do Analítico).
  // Trocam só os grupos — o tipo continua (update sem mexer em view); o detalhe de grupo sai.
  const typeControls = currentView?.layout === VIEW_LAYOUTS.MATRIX ? (
    <MatrixAxisControls axes={definition.matrixAxes} matrix={state.matrix ?? currentView.matrix} onChange={setMatrixAxes} />
  ) : currentView?.groupChoices?.length ? (
    <AnalyticGroupButtons choices={currentView.groupChoices} groups={state.groups} labelOf={(columnId) => columnLabel(columnId)} onChange={(groups) => update({ groups, drill: [] })} />
  ) : null;

  // E1D (item 6): relatório com "Ordenar por" fixo (Pesagens: as 8 do MAKGESTAO) mostra exatamente essas
  // opções, em qualquer tipo. Escolher grava só sortChoice: o serviço traduz para a ordem do tipo atual
  // (domain/sortChoices.js). "Personalizado" só aparece depois de um clique em cabeçalho sem opção equivalente.
  const fixedSortChoices = definition.sortChoices?.length ? definition.sortChoices : null;
  const metricsForSort = useMemo(() => (viewModel && summaryMode ? summaryMetrics(viewModel) : []), [viewModel, summaryMode]);
  const sortOptions = useMemo(
    () => (fixedSortChoices ? fixedSortChoices.map((choice) => ({ value: choice.id, label: choice.label })) : buildSortOptions({ summaryMode, groups: state.groups, columnOf, metrics: metricsForSort, visibleColumns })),
    [fixedSortChoices, summaryMode, state.groups, columnOf, metricsForSort, visibleColumns],
  );
  const sortValue = fixedSortChoices ? (state.sortChoice ?? "custom") : currentSortValue({ summaryMode, state, definition, options: sortOptions });
  // Níveis como a opção atual os mostra (ex.: "Data (Mais Antiga)" inverte a data): o "Personalizado" de um
  // clique em cabeçalho parte do que a pessoa está vendo. Mesma função pura que o serviço usa.
  const shownGroups = () => (state.sortChoice
    ? applySortChoice(definition, state.view ? getReportView(definition, state.view) : null, { sort: state.sort, summarySort: state.summarySort, groups: state.groups, aggregates: state.aggregates }, state.sortChoice).groups
    : state.groups);
  const applySort = (value) => {
    if (fixedSortChoices) {
      update({ sortChoice: value });
      return;
    }
    if (value === "padrao") {
      if (summaryMode) update({ summarySort: null, groups: state.groups.map((group) => ({ columnId: group.columnId })) });
      else update({ sort: definition.defaultSort });
      return;
    }
    // tipo:chave:direção — a chave pode ter ":" (total criado no diálogo, ex. "sum:peso").
    const { kind, key, direction } = parseSortChoice(value);
    if (kind === "rotulo") update({ summarySort: { key: SUMMARY_LABEL_SORT, direction } });
    else if (kind === "nivel") update({ summarySort: null, groups: state.groups.map((group, index) => (index === Number(key) ? { ...group, direction } : group)) });
    else if (kind === "metrica") update({ summarySort: { key, direction } });
    else if (kind === "coluna") update({ sort: [{ columnId: key, direction }] });
  };

  // Filtros rápidos: ligados quando todos os filtros do atalho estão aplicados como definidos.
  const quickActive = (quick) => Object.entries(quick.filters).every(([columnId, filter]) => state.uiFilters[columnId] && sameFilter(state.uiFilters[columnId], filter));
  const toggleQuick = (quick) => {
    const next = { ...state.uiFilters };
    if (quickActive(quick)) for (const columnId of Object.keys(quick.filters)) delete next[columnId];
    else Object.assign(next, JSON.parse(JSON.stringify(quick.filters)));
    update({ uiFilters: next });
  };

  const onSort = (columnId) => {
    if (fixedSortChoices) {
      // E1D: clique no cabeçalho da grade vira a opção equivalente (Peso → "Peso (Menor)"; de novo → "Peso
      // (Maior)"); coluna sem opção (Sexo, Raça…) ordena por ela e o seletor mostra "Personalizado".
      const first = (viewModel?.sort ?? state.sort)[0];
      const direction = first?.columnId === columnId && first.direction === "asc" ? "desc" : "asc";
      const choice = sortChoiceForColumn(definition, columnId, direction);
      update(choice ? { sortChoice: choice } : { sortChoice: null, sort: [{ columnId, direction }], groups: shownGroups() });
      return;
    }
    const currentSort = state.sort.find((item) => item.columnId === columnId);
    const direction = currentSort?.direction === "asc" ? "desc" : "asc";
    update({ sort: [{ columnId, direction }] });
  };
  // Clique no cabeçalho de uma métrica da folha: maior primeiro; de novo inverte.
  const onSheetSort = (key) => {
    if (fixedSortChoices) {
      // E1D: peso médio / GMD médio viram "Peso (Maior)" / "GMD (Maior)" (de novo: Menor); outra métrica
      // ordena as linhas por ela e o seletor mostra "Personalizado". Num tipo resumido o serviço a restringe ao
      // nível folha (sortChoices.scopedToType): as seções continuam na ordem do tipo.
      const shown = viewModel?.summarySort ?? null;
      const direction = shown?.key === key && shown.direction === "desc" ? "asc" : "desc";
      const choice = sortChoiceForMetric(definition, viewModel?.aggregates ?? state.aggregates, key, direction);
      update(choice ? { sortChoice: choice } : { sortChoice: null, summarySort: { key, direction }, groups: shownGroups() });
      return;
    }
    const direction = state.summarySort?.key === key && state.summarySort.direction === "desc" ? "asc" : "desc";
    update({ summarySort: { key, direction } });
  };
  const onFilter = (columnId, value) => {
    const next = { ...state.uiFilters };
    if (value && isFilterActive(value)) next[columnId] = value;
    else delete next[columnId];
    update({ uiFilters: next });
  };
  // Clique num grupo da folha do Resumido (ou num título de seção): Detalhado só daquele grupo (recorte
  // exato pela chave). A folha do Detalhado ("Ver como folha") não repassa o clique: é só leitura.
  const onDrill = (path) => update({
    mode: REPORT_MODES.DETALHADO,
    drill: path.map((part) => ({ columnId: part.columnId, key: part.key, label: formatGroupLabel(definition.columns.find((column) => column.id === part.columnId), part.label, "screen", part.key === NONE_GROUP_KEY) })),
  });

  // Pesagem anterior (Todos/Com/Sem): filtro comum na coluna "tem pesagem anterior", pelo mesmo motor.
  const previousColumn = columnOf(PREVIOUS_COLUMN);
  const previousFilter = state.uiFilters[PREVIOUS_COLUMN];
  const previousValue = previousFilter && isFilterActive(previousFilter) ? (previousFilter.value === true || previousFilter.value === "true" ? "com" : "sem") : "todos";
  const setPrevious = (value) => onFilter(PREVIOUS_COLUMN, value === "todos" ? null : { operator: "equals", value: value === "com" });

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

  // Impressão/PDF = a folha: se as colunas não couberem nem com a fonte menor, pergunta (paisagem,
  // reduzir totais/colunas ou exportar) — nunca corta em silêncio.
  const emitDocument = async (kind, overrides = {}) => {
    if (!viewModel) return;
    // showDetails: "Mostrar Detalhes" de Vendas — a impressão e o PDF saem como a folha da tela.
    const options = { orientation: overrides.orientation ?? sheetOrientation, widths: state.widths, header, showEmptyColumns: state.showEmptyColumns, showDetails: state.showDetails === true, acceptTooWide: overrides.acceptTooWide ?? false };
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
      // E1D (Vendas): o modelo leva só o que o autor vê (Valor @ e Valor total ficam fora para CONSULTA/OPERADOR).
      const saved = await saveTemplate({ id, name, scope, ...templatePayload(definition, state, actor.role) }, actor);
      setCurrentTemplate(saved);
      setDialog(null);
      toast.success(`Modelo “${saved.name}” salvo (${saved.scope === "SHARED" ? "compartilhado" : "pessoal"}).`, drilling ? { description: "O detalhe do grupo não fica no modelo: ele abre no Resumido." } : undefined);
      onTemplateSaved?.(saved);
      loadTemplates();
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode salvar este modelo." : err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  // E1E: excluir o modelo aberto (menu ⋯) — pessoal só o dono; compartilhado com reports.templates.share
  // (o serviço confere). Depois abre o relatório sem modelo.
  const canDeleteTemplate = Boolean(allowPreferences && onOpenTemplate && currentTemplate?.id
    && (currentTemplate.scope === "SHARED" ? can("reports.templates.share") : currentTemplate.ownerUserId === actor.id));
  const removeTemplate = async () => {
    setConfirmDelete(false);
    try {
      await deleteTemplate(currentTemplate.id, actor);
      toast.success(`Modelo “${currentTemplate.name}” excluído.`);
      onOpenTemplate(null);
    } catch (err) {
      toast.error(err.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode excluir este modelo." : err.message);
    }
  };

  // Linha 2: botões padrão (com contador), depois os demais filtros ativos e, no Detalhado, as colunas
  // visíveis — um filtro nunca fica invisível e o caminho é um só (uiFilters → motor de filtros).
  const buttonColumns = filterButtonsOf(definition, available);
  const coveredIds = new Set([...buttonColumns.map((item) => item.column.id), PREVIOUS_COLUMN]);
  const pill = (column, label, showCount = false) => (
    <MakFilterPill
      key={column.id}
      label={label}
      value={state.uiFilters[column.id] || null}
      filterType={pillFilterType(column)}
      listOptions={() => pillOptions(viewModel, column)}
      onChange={(value) => onFilter(column.id, value)}
      showCount={showCount}
    />
  );
  const extraColumns = [
    // Na tela do MAKGESTAO não há pílula por coluna visível (só os botões do antigo + filtros ativos).
    ...(summaryMode || makScreen ? [] : visibleColumns.filter((column) => !coveredIds.has(column.id))),
    ...available.filter((column) => !coveredIds.has(column.id) && isFilterActive(state.uiFilters[column.id]) && (summaryMode || makScreen || !visibleColumns.some((item) => item.id === column.id))),
  ];
  const hasActiveFilters = Object.values(state.uiFilters).some(isFilterActive) || Boolean(state.search);
  const lockedEntries = Object.entries(viewModel?.lockedFilters ?? {});
  const drillParts = viewModel?.drill ?? [];
  // Tela do MAKGESTAO: sempre a folha (o antigo mostrava o papel também nos tipos detalhados).
  const showSheet = makScreen || summaryMode || state.detailSheet;

  // Diálogos (as duas telas): colunas do tipo ou de dados, níveis, totais, salvar modelo e a pergunta da impressão.
  // Na tela do MAKGESTAO o seletor de colunas tem o nome do botão do antigo; na da 1.4.0, o título padrão.
  const columnsDialogTitle = !makScreen ? undefined
    : typeColumnsOn ? (currentView.mode === REPORT_MODES.RESUMIDO ? "Colunas Painel" : currentView.groupChoices?.length ? "Colunas Visíveis" : "Colunas Detalhes")
      : "Colunas";
  const dialogs = (
    <>
      {dialog === "columns" && viewModel && typeColumnsOn ? (
        <MakColumnConfigDialog
          open
          title={columnsDialogTitle}
          onOpenChange={(open) => !open && setDialog(null)}
          columns={typeColumnDialog.options.map((option) => ({ id: option.key, label: option.label, default: option.default }))}
          order={[...typeColumnDialog.current, ...typeColumnDialog.options.map((option) => option.key).filter((key) => !typeColumnDialog.current.includes(key))]}
          visible={typeColumnDialog.current}
          onApply={({ order, visible }) => { applyTypeColumns(currentView, order.filter((key) => visible.includes(key))); setDialog(null); }}
        />
      ) : dialog === "columns" && viewModel ? (
        <MakColumnConfigDialog
          open
          title={columnsDialogTitle}
          onOpenChange={(open) => !open && setDialog(null)}
          columns={available.filter((column) => !column.metricOnly).map((column) => ({ id: column.id, label: column.label, default: definition.defaultColumns.includes(column.id) }))}
          order={[...state.columns, ...available.filter((column) => !column.metricOnly).map((column) => column.id).filter((id) => !state.columns.includes(id))]}
          visible={state.columns}
          onApply={({ order, visible }) => { update({ columns: order.filter((id) => visible.includes(id)) }); setDialog(null); }}
        />
      ) : null}
      <ReportGroupingDialog open={dialog === "groups"} onOpenChange={(open) => !open && setDialog(null)} columns={available} groups={state.groups} onApply={setGroups} />
      <ReportTotalsDialog open={dialog === "totals"} onOpenChange={(open) => !open && setDialog(null)} columns={available} aggregates={state.aggregates} animalColumnId={definition.animalColumnId} onApply={(aggregates) => update({ aggregates, summarySort: aggregates.some((spec) => spec.id === state.summarySort?.key) ? state.summarySort : null })} />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact rpt-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">{currentTemplate?.scope === "SHARED" ? "Excluir o modelo para todos?" : "Excluir o modelo?"}</DialogTitle>
            <DialogDescription>{currentTemplate ? `“${currentTemplate.name}” deixa de aparecer em “Abrir modelo”. O relatório continua.` : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={removeTemplate}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReportSaveTemplateDialog open={dialog === "save"} onOpenChange={(open) => !open && setDialog(null)} current={currentTemplate && (currentTemplate.ownerUserId === actor.id || can("reports.templates.share")) ? currentTemplate : null} canShare={can("reports.templates.share")} onSave={saveAsTemplate} busy={savingTemplate} />
      <Dialog open={Boolean(printPrompt)} onOpenChange={(open) => !open && setPrintPrompt(null)}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact rpt-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />Este relatório possui muitas colunas para impressão.</DialogTitle>
            <DialogDescription>{printPrompt ? `${printPrompt.layout.columnCount} colunas não cabem em A4 ${printPrompt.layout.orientation === "landscape" ? "paisagem" : "retrato"}, nem com a letra menor. Nenhuma coluna é escondida automaticamente.` : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="rpt-print-options">
            {printPrompt?.layout.warning?.options?.includes("paisagem") ? <Button type="button" variant="outline" onClick={() => { update({ orientation: "landscape" }); emitDocument(printPrompt.kind, { orientation: "landscape" }); }}>Usar paisagem</Button> : null}
            <Button type="button" variant="outline" onClick={() => { setPrintPrompt(null); setDialog(summaryMode && !typeColumnsOn ? "totals" : "columns"); }}>{summaryMode && !typeColumnsOn ? "Reduzir totais" : "Reduzir colunas"}</Button>
            {can("reports.export") ? <Button type="button" variant="outline" onClick={() => { setPrintPrompt(null); exportAs("csv"); }}>Exportar CSV</Button> : null}
            <Button type="button" className="emp-toolbar-btn-save" onClick={() => emitDocument(printPrompt.kind, { acceptTooWide: true })}>Continuar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (makScreen) {
    // Tela "como o MAKGESTAO" (E1D visual): mesmo estado, mesmos serviços e mesma folha — só a cara muda.
    // "Colunas" do tipo como o antigo: Analítico "Colunas" na linha de botões do cartão (L733); Apartação
    // "Colunas Painel" e Vendas "Colunas Detalhes" na área da folha (L1146, L1445); o Sintético não tem. No
    // detalhe de um grupo, as colunas de dados (também na área da folha).
    const inTypeMode = currentView && currentView.mode === (viewModel?.mode ?? state.mode);
    const makColumnsLabel = typeColumnsOn
      ? (currentView.mode === REPORT_MODES.RESUMIDO ? "Colunas Painel" : currentView.groupChoices?.length ? "Colunas" : "Colunas Detalhes")
      : inTypeMode && currentView.layout === VIEW_LAYOUTS.MATRIX ? null
        : summaryMode ? "Colunas Painel" : "Colunas";
    const makColumns = makColumnsLabel
      ? { label: makColumnsLabel, title: makColumnsLabel === "Colunas" && typeColumnsOn ? "Colunas Visíveis" : makColumnsLabel, onClick: () => setDialog(summaryMode && !typeColumnsOn ? "totals" : "columns") }
      : null;
    const columnsInCard = Boolean(makColumns && typeColumnsOn && currentView.groupChoices?.length);
    // Vendas (L1445–1466 do antigo): "Mostrar/Ocultar Detalhes" abre a lista de cada comprador; "Colunas
    // Detalhes" só aparece com ela aberta. Começa desligado, como no antigo.
    // E1E: vale em todo tipo com o desenho de venda (sheetLayout, Comercial: Vendas/Abates/Compras).
    const vendasTools = Boolean((currentView?.sheetLayout || currentView?.id === "vendas") && inTypeMode && !drillParts.length);
    const hideColumnsButton = vendasTools && !state.showDetails;
    const makNotes = [
      ...(viewModel?.warnings ?? []).map((warning) => <div key={warning.code} className="rpt-warning" role="status"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{warning.message}</div>),
      ...(error ? [<div key="erro" className="rpt-error" role="alert">{error.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode abrir este relatório." : error.message}</div>] : []),
      ...(summaryMode && viewModel && viewId === "custom" && !(viewModel.groups ?? []).length ? [<div key="dica" className="rpt-sheet-hint" role="note">Sem agrupamento a folha mostra só o Total geral. Escolha um <strong>Tipo Relatório</strong> para ver os grupos.</div>] : []),
    ];
    return (
      <ModeloBase1PageContainer variant="report" className="rpt-mak" data-report={definition.id}>
        <MakgestaoTopBar
          title={`Relatório de ${definition.sheetTitle ?? definition.title}`}
          templateName={currentTemplate?.name ?? (preset ? preset.title : null)}
          loading={loading}
          backLabel={backLabel}
          onBack={onBack}
          canExport={can("reports.export")}
          disabled={!viewModel || loading}
          onPrint={() => emitDocument("print")}
          onExcel={() => exportAs("xlsx")}
          onPdf={() => emitDocument("pdf")}
          onCsv={() => exportAs("csv")}
          onJson={() => exportAs("json")}
          menuLabel={summaryMode ? "Mesma tabela resumida da folha" : "Mesma população e totais da folha"}
          templates={onOpenTemplate ? templates : null}
          currentTemplateId={currentTemplate?.id ?? null}
          onOpenTemplate={onOpenTemplate}
          onSaveTemplate={allowPreferences ? () => setDialog("save") : null}
          onDeleteTemplate={canDeleteTemplate ? () => setConfirmDelete(true) : null}
          onRefresh={() => execute({ reload: true })}
          showEmptyColumns={state.showEmptyColumns}
          onToggleEmptyColumns={() => update({ showEmptyColumns: !state.showEmptyColumns })}
        />
        <MakgestaoFilterCard
          report={reportOptions && onSelectReport ? { value: definition.id, options: reportOptions, onChange: onSelectReport } : null}
          period={period}
          resolvedPeriod={viewModel?.period ?? null}
          onPeriod={periodParam ? setPeriod : null}
          orientation={state.orientation}
          onOrientation={(orientation) => update({ orientation })}
          views={views}
          viewId={viewId}
          onView={applyView}
          typeControls={typeControls}
          typeControlsInGrid={currentView?.layout === VIEW_LAYOUTS.MATRIX}
          sortOptions={sortOptions}
          sortValue={sortValue}
          onSort={applySort}
          previous={previousColumn ? { value: previousValue, onChange: setPrevious } : null}
          params={integerParamsOf(definition).map((param) => ({ id: param.id, label: param.label, min: param.min, value: state.params[param.id], onChange: (value) => update({ params: { ...state.params, [param.id]: value ?? param.default } }) }))}
          filterButtons={(
            <>
              {buttonColumns.map(({ button, column }) => (
                <MakgestaoFilterButton key={column.id} label={button.label} narrow={button.narrow} value={state.uiFilters[column.id] || null} filterType={pillFilterType(column)} listOptions={() => pillOptions(viewModel, column)} onChange={(value) => onFilter(column.id, value)} />
              ))}
              {/* E1E: filtros rápidos do relatório (ex.: "Somente mortes") como botões de ligar/desligar. */}
              {quickFiltersOf(definition).map((quick) => (
                <button key={quick.id} type="button" className={`rpt-mak-btn${quickActive(quick) ? " is-on" : ""}`} aria-pressed={quickActive(quick)} onClick={() => toggleQuick(quick)}>{quick.label}</button>
              ))}
            </>
          )}
          columnsButton={columnsInCard ? makColumns : null}
          onClear={() => update({ uiFilters: {}, search: "" })}
          extras={(
            <>
              {extraColumns.map((column) => (
                <MakgestaoFilterButton key={column.id} label={column.label} value={state.uiFilters[column.id] || null} filterType={pillFilterType(column)} listOptions={() => pillOptions(viewModel, column)} onChange={(value) => onFilter(column.id, value)} />
              ))}
              {state.search ? (
                <span className="rpt-mak-chip" title="Pesquisa do modelo">
                  Pesquisa: “{state.search}”
                  <button type="button" aria-label="Limpar a pesquisa" title="Limpar a pesquisa" onClick={() => update({ search: "" })}><X className="h-3 w-3" aria-hidden="true" /></button>
                </span>
              ) : null}
            </>
          )}
        />
        {/* Entre o cartão e a folha, só quando há o que dizer: detalhe de um grupo (× volta à folha do tipo),
            condição fixa do tipo (Vendas: Saída por Venda, com cadeado), avisos e erro. */}
        {drillParts.length || lockedEntries.length || makNotes.length ? (
          <div className="rpt-mak__notes">
            {drillParts.length ? (
              <span className="rpt-drill-pill" title="Detalhe de um grupo da folha">
                <SearchCheck className="h-3 w-3" aria-hidden="true" />
                Detalhe: {drillParts.map((part) => `${part.columnLabel}: ${part.label}`).join(" › ")}
                <button type="button" aria-label="Voltar à folha do tipo" title="Voltar à folha do tipo" onClick={() => update({ drill: [], mode: REPORT_MODES.RESUMIDO })}><X className="h-3 w-3" aria-hidden="true" /></button>
              </span>
            ) : null}
            {lockedEntries.map(([columnId, filter]) => (
              <span key={`locked-${columnId}`} className="rpt-locked-pill" title="Condição fixa do tipo">
                <Lock className="h-3 w-3" aria-hidden="true" />{columnOf(columnId)?.label ?? columnId} {describeFilter(filter, columnOf(columnId))}
              </span>
            ))}
            {makNotes}
          </div>
        ) : null}
        <div className="rpt-mak__paper">
          {/* "Colunas Painel/Detalhes" fora da folha (não sai na impressão), no canto da área do papel — a barra
              print:hidden do antigo ficava dentro da área de impressão. */}
          {vendasTools || (makColumns && !columnsInCard) ? (
            <div className="rpt-mak__sheet-tools" role="group" aria-label="Colunas da folha">
              {vendasTools ? (
                <button type="button" className={`rpt-mak-btn rpt-mak-btn--icon${state.showDetails ? " is-pressed" : ""}`} aria-pressed={state.showDetails === true} onClick={() => update({ showDetails: !state.showDetails })}>
                  {state.showDetails ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  {state.showDetails ? "Ocultar Detalhes" : "Mostrar Detalhes"}
                </button>
              ) : null}
              {makColumns && !columnsInCard && !hideColumnsButton ? <MakgestaoColumnsButton {...makColumns} /> : null}
            </div>
          ) : null}
          {viewModel ? (
            <ReportSheetView
              viewModel={viewModel}
              header={header}
              orientation={sheetOrientation}
              showEmptyColumns={state.showEmptyColumns}
              showDetails={state.showDetails === true}
              sort={viewModel.mode === REPORT_MODES.RESUMIDO ? (fixedSortChoices ? viewModel.summarySort : state.summarySort) : null}
              onDrill={viewModel.mode === REPORT_MODES.RESUMIDO ? onDrill : null}
              onSort={viewModel.mode === REPORT_MODES.RESUMIDO ? onSheetSort : null}
            />
          ) : <div className="rpt-empty">{loading ? "Calculando o relatório…" : "—"}</div>}
        </div>
        {dialogs}
      </ModeloBase1PageContainer>
    );
  }

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
            {definition.params.filter((param) => param.type === "integer").map((param) => (
              <label key={param.id} className="rpt-param">
                <span>{param.label}</span>
                <Input type="number" min={param.min ?? undefined} value={state.params[param.id] ?? ""} onChange={(event) => update({ params: { ...state.params, [param.id]: event.target.value === "" ? param.default : Number(event.target.value) } })} />
              </label>
            ))}
            <div className="rpt-tabs rpt-mode" role="group" aria-label="Modo do relatório">
              {[[REPORT_MODES.RESUMIDO, "Resumido", "Uma linha por grupo, com os totais em colunas (a folha)"], [REPORT_MODES.DETALHADO, "Detalhado", "Todas as linhas, com subtotais por grupo"]].map(([mode, label, title]) => (
                <button key={mode} type="button" className={`rpt-tab${state.mode === mode ? " is-active" : ""}`} aria-pressed={state.mode === mode} title={title} onClick={() => setMode(mode)}>{label}</button>
              ))}
            </div>
            {!summaryMode ? (
              <button type="button" className={`ios-btn tb-btn tb-btn-ghost tb-btn-icon${state.detailSheet ? " is-active" : ""}`} aria-pressed={state.detailSheet} onClick={() => update({ detailSheet: !state.detailSheet })} title={state.detailSheet ? "Ver como grade" : "Ver como folha (o que sai na impressão)"} aria-label={state.detailSheet ? "Ver como grade" : "Ver como folha"}>
                {state.detailSheet ? <Table2 className="h-3.5 w-3.5" aria-hidden="true" /> : <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            ) : null}
            <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("groups")} title="Níveis de agrupamento (até 3)" aria-label="Níveis de agrupamento"><Layers className="h-3.5 w-3.5" aria-hidden="true" /></button>
            <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("totals")} title="Totais (colunas da folha e dos subtotais)" aria-label="Totais"><Sigma className="h-3.5 w-3.5" aria-hidden="true" /></button>
            {!summaryMode || typeColumnsOn ? <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("columns")} title="Colunas" aria-label="Colunas"><Columns3 className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
            <button type="button" className={`ios-btn tb-btn tb-btn-ghost tb-btn-icon${state.showEmptyColumns ? " is-active" : ""}`} aria-pressed={state.showEmptyColumns} onClick={() => update({ showEmptyColumns: !state.showEmptyColumns })} title={state.showEmptyColumns ? "Esconder colunas sem nenhum valor" : "Mostrar colunas vazias (sem nenhum valor no relatório)"} aria-label="Mostrar colunas vazias">
              {state.showEmptyColumns ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
            <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => execute({ reload: true })} title="Atualizar (reler os dados do banco)" aria-label="Atualizar"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /></button>
            {allowPreferences ? <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={() => setDialog("save")} title="Salvar modelo" aria-label="Salvar modelo"><Save className="h-3.5 w-3.5" aria-hidden="true" /></button> : null}
            {can("reports.export") ? (
              <div className="rpt-emit" role="group" aria-label="Imprimir e exportar">
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green" disabled={!viewModel || loading} onClick={() => emitDocument("print")} title="Imprimir a folha (A4)"><Printer className="h-3.5 w-3.5" aria-hidden="true" />Imprimir</button>
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" disabled={!viewModel || loading} onClick={() => exportAs("xlsx")} title="Planilha Excel (XLSX) com a mesma tabela da tela"><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />Excel</button>
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" disabled={!viewModel || loading} onClick={() => emitDocument("pdf")} title="PDF A4 da folha"><FileText className="h-3.5 w-3.5" aria-hidden="true" />PDF</button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" disabled={!viewModel || loading} aria-label="Outros formatos" title="Outros formatos (CSV, JSON)"><MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="text-xs">{summaryMode ? "Mesma tabela resumida da tela" : "Mesma população e totais da tela"}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs" onClick={() => exportAs("csv")}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />CSV (Excel pt-BR)</DropdownMenuItem>
                    <DropdownMenuItem className="text-xs" onClick={() => exportAs("json")}><FileJson className="h-3.5 w-3.5" aria-hidden="true" />JSON com manifesto</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ReportFilterBar
        period={period}
        resolvedPeriod={viewModel?.period ?? null}
        onPeriod={periodParam ? setPeriod : null}
        orientation={state.orientation}
        onOrientation={(orientation) => update({ orientation })}
        views={views}
        viewId={viewId}
        onView={applyView}
        groupOptions={groupOptions}
        groupValue={quickGroupValue}
        onGroup={(value) => (value === CUSTOM_GROUP ? setDialog("groups") : setGroups(value === NO_GROUP ? [] : [{ columnId: value }]))}
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSort={applySort}
        previous={previousColumn ? { value: previousValue, onChange: setPrevious } : null}
        typeControls={typeControls}
      />

      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
        <MgTablePanelStrip onConfigColumns={() => setDialog(summaryMode && !typeColumnsOn ? "totals" : "columns")}>
          <MakFilterRail hasActiveFilters={hasActiveFilters} onClear={() => update({ uiFilters: {}, search: "" })}>
            <Input type="search" className="rpt-search" aria-label="Pesquisar no relatório" placeholder="Pesquisar…" value={state.search} onChange={(event) => update({ search: event.target.value })} />
            {drillParts.length ? (
              <span className="rpt-drill-pill" title="Detalhe de um grupo do Resumido">
                <SearchCheck className="h-3 w-3" aria-hidden="true" />
                Detalhe: {drillParts.map((part) => `${part.columnLabel}: ${part.label}`).join(" › ")}
                <button type="button" aria-label="Voltar ao Resumido" title="Voltar ao Resumido" onClick={() => update({ drill: [], mode: REPORT_MODES.RESUMIDO })}><X className="h-3 w-3" aria-hidden="true" /></button>
              </span>
            ) : null}
            {buttonColumns.map(({ button, column }) => pill(column, button.label, true))}
            {(definition.quickFilters ?? []).map((quick) => (
              <button key={quick.id} type="button" className={`rpt-quick-filter${quickActive(quick) ? " is-on" : ""}`} aria-pressed={quickActive(quick)} onClick={() => toggleQuick(quick)}>
                {quick.label}
              </button>
            ))}
            {lockedEntries.map(([columnId, filter]) => (
              <span key={`locked-${columnId}`} className="rpt-locked-pill" title="Condição fixa do relatório">
                <Lock className="h-3 w-3" aria-hidden="true" />{columnOf(columnId)?.label ?? columnId} {describeFilter(filter, columnOf(columnId))}
              </span>
            ))}
            {extraColumns.map((column) => pill(column, !summaryMode && visibleColumns.some((item) => item.id === column.id) ? column.label : `${column.label} (coluna oculta)`))}
          </MakFilterRail>
        </MgTablePanelStrip>
      </div>

      <div className="d17b-list-body">
        <Card className="d17b-table-card">
          <CardContent className="p-0 rpt-card-content">
            <div className="rpt-card-head">
              <div className="rpt-context" aria-live="polite">
                <span><strong>Período:</strong> {viewModel?.period ? describePeriod(viewModel.period) : periodParam ? "—" : "estado atual (hoje)"}</span>
                <span>{showSheet ? (summaryMode ? "Folha resumida (o que sai na impressão)" : "Folha com as linhas (o que sai na impressão)") : viewModel?.grainLabel ? viewModel.grainLabel.charAt(0).toUpperCase() + viewModel.grainLabel.slice(1) : "—"}</span>
                {viewModel?.classification && viewModel.classification !== "CANÔNICO" ? <span className="rpt-legacy">{viewModel.classification}</span> : null}
                {loading ? <span className="rpt-loading">Calculando…</span> : viewModel ? <span className="rpt-timing" title={`Leitura: ${viewModel.stats.strategy}`}>{viewModel.rowCount.toLocaleString("pt-BR")} registro(s) · {Math.round(viewModel.stats.timings.total)} ms</span> : null}
              </div>
              {(viewModel?.warnings ?? []).map((warning) => (
                <div key={warning.code} className="rpt-warning" role="status"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{warning.message}</div>
              ))}
              {summaryMode && viewModel && !(viewModel.groups ?? []).length ? (
                <div className="rpt-sheet-hint" role="note">Sem agrupamento a folha mostra só o Total geral. Escolha <strong>Agrupar por</strong> (ou um <strong>Tipo de relatório</strong>) para ver os grupos.</div>
              ) : null}
              {/* E1D: a folha não leva notas (só o essencial no rodapé); na grade, as da definição ficam aqui. */}
              {!showSheet && (definition.notes ?? []).length ? <ul className="rpt-notes">{definition.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
              {error ?<div className="rpt-error" role="alert">{error.code === "AUTH_FORBIDDEN" ? "Seu perfil não pode abrir este relatório." : error.message}</div> : null}
            </div>
            {viewModel ? (showSheet && (viewModel.mode === REPORT_MODES.RESUMIDO || state.detailSheet) ? (
              <ReportSheetView
                viewModel={viewModel}
                header={header}
                orientation={state.orientation}
                showEmptyColumns={state.showEmptyColumns}
                sort={viewModel.mode === REPORT_MODES.RESUMIDO ? (fixedSortChoices ? viewModel.summarySort : state.summarySort) : null}
                onDrill={viewModel.mode === REPORT_MODES.RESUMIDO ? onDrill : null}
                onSort={viewModel.mode === REPORT_MODES.RESUMIDO ? onSheetSort : null}
              />
            ) : (
              <ReportTable
                viewModel={viewModel}
                sort={fixedSortChoices ? viewModel.sort.slice(0, 1) : state.sort}
                onSort={onSort}
                widths={state.widths}
                filters={state.uiFilters}
                onFilter={onFilter}
                onHide={hideColumn}
                optionsFor={(column) => pillOptions(viewModel, column)}
                filterTypeFor={pillFilterType}
              />
            )) : <div className="rpt-empty">{loading ? "Calculando o relatório…" : "—"}</div>}
          </CardContent>
        </Card>
      </div>

      {dialogs}
    </ModeloBase1PageContainer>
  );
}
