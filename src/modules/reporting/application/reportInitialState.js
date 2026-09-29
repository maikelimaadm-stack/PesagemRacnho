// Estado inicial da tela de um relatório (ReportView). E1D: saiu do componente para ser conferido em Node
// (gate reports:pesagens-tipos:verify) — é o mesmo código que a tela usa, sem React.
// Precedência (E1B): modelo > visão antiga (favorito/link de antes da 1.4.0) > último estado > padrão.
// E1D: o "padrão" de um relatório com tipo padrão (Pesagens) é esse tipo — "Por Apartação (Resumo por
// Data)" —; sem tipo padrão, o agrupamento/modo padrão da definição, como antes.
import { aliasSelection } from '../definitions/legacyAliases.js';
import { filtersForDisplay, getReportView, resolveViewId, viewSelection } from '../domain/reportViews.js';
import { templateToRequest } from './reportTemplateService.js';

// Tipo explícito no estado da tela (contrato §3). Estado sem `view` ganha o tipo que bate pela estrutura
// (resolveViewId); nenhum → null ("Personalizado").
// Só tipo DECLARADO vai para o estado (e daí para o serviço, o último estado e os modelos): o tipo gerado
// dos relatórios sem tipos declarados ("Resumo por <agrupamento padrão>", "Analítico") é só atalho, e o
// serviço recusa id gerado — sem isto Rebanho, Desempenho, Saídas… abriam com erro. O seletor continua
// mostrando o gerado pela estrutura (ReportView → resolveViewId).
export function withTypedState(definition, state) {
  const resolved = state.view !== undefined ? state.view : resolveViewId(definition, state);
  const declared = resolved ? getReportView(definition, resolved) : null;
  const view = declared && !declared.generated ? declared.id : null;
  return {
    ...state,
    view,
    matrix: state.matrix ?? (declared && view ? declared.matrix ?? null : null),
    sortChoice: state.sortChoice !== undefined ? state.sortChoice : (definition.defaultSortChoice ?? null),
  };
}

/** Pedido já revalidado (modelo ou último estado, templateToRequest) → estado da tela. */
export function stateFromRequest(definition, request, extra = {}) {
  return withTypedState(definition, {
    view: request.selection.view,
    matrix: request.selection.matrix,
    sortChoice: request.selection.sortChoice,
    params: request.params,
    uiFilters: filtersForDisplay(request.selection.filters, definition.columns),
    fixedFilters: request.selection.fixedFilters ?? {},
    columns: request.selection.columns.length ? request.selection.columns : definition.defaultColumns,
    groups: request.selection.groups,
    aggregates: request.selection.aggregates,
    sort: request.selection.sort,
    search: request.selection.search,
    widths: request.widths,
    mode: request.selection.mode,
    summarySort: request.selection.summarySort,
    drill: [],
    orientation: request.orientation ?? 'auto',
    showEmptyColumns: false,
    detailSheet: false,
    ...extra,
  });
}

/**
 * @param definition ReportDefinition
 * @param {{ template?: object|null, preset?: object|null, role?: string|null, savedState?: object|null }} source
 *   template = modelo salvo; preset = visão de relatório antigo (LEGACY_REPORT_ALIASES); savedState =
 *   último estado já revalidado (getReportViewState).
 * @returns {{ state: object, warnings: object[] }} warnings = avisos do modelo (a tela mostra em toast)
 */
export function buildInitialReportState(definition, { template = null, preset = null, role = null, savedState = null } = {}) {
  if (template) {
    const request = templateToRequest(template, role);
    return { state: stateFromRequest(definition, request), warnings: request.warnings };
  }
  if (!preset && savedState) {
    // Último estado do usuário (já revalidado pelo serviço contra a definição e o papel).
    return { state: stateFromRequest(definition, savedState, { showEmptyColumns: savedState.showEmptyColumns === true }), warnings: [] };
  }
  const params = {};
  for (const param of definition.params) if (param.default != null) params[param.id] = param.default;
  const blank = { search: '', widths: {}, drill: [], orientation: 'auto', showEmptyColumns: false, detailSheet: false, fixedFilters: {} };
  // E1D: relatório com tipo padrão (Pesagens → "Por Apartação (Resumo por Data)") abre nele.
  if (!preset && definition.defaultView) {
    const selection = viewSelection(definition.defaultView, definition);
    return {
      state: withTypedState(definition, {
        ...blank,
        view: selection.view, matrix: selection.matrix, sortChoice: definition.defaultSortChoice ?? null,
        params,
        uiFilters: filtersForDisplay(definition.defaultFilters ?? {}, definition.columns),
        columns: selection.columns, groups: selection.groups, aggregates: selection.aggregates, sort: selection.sort,
        mode: selection.mode, summarySort: selection.summarySort,
      }),
      warnings: [],
    };
  }
  // Visão de um relatório antigo (favorito, recente ou link de antes da 1.4.0): mesma seleção.
  const legacy = preset ? aliasSelection(preset) : null;
  // Condições que eram fixas no relatório antigo comparavam o código (motivo = Morte, tipo
  // Cadastro/Saída): continuam por código, não pelo rótulo exibido — mesma população do relatório antigo.
  const legacyFilters = legacy
    ? Object.fromEntries(Object.entries(legacy.filters).map(([columnId, filter]) => [columnId, preset.fixed.includes(columnId) ? { ...filter, match: 'code' } : filter]))
    : null;
  return {
    state: withTypedState(definition, {
      ...blank,
      // E1D: visão antiga num relatório de tipos fixos abre a seleção dela como "Personalizado" (nunca vira
      // um dos 5 tipos só porque a estrutura coincide).
      ...(legacy && definition.defaultView ? { view: null } : {}),
      params,
      uiFilters: filtersForDisplay(legacyFilters ?? definition.defaultFilters ?? {}, definition.columns),
      columns: legacy?.columns ?? definition.defaultColumns,
      groups: legacy?.groups ?? definition.defaultGroups,
      aggregates: legacy?.aggregates ?? definition.defaultAggregates,
      sort: legacy?.sort ?? definition.defaultSort,
      mode: legacy?.mode ?? definition.defaultMode,
      summarySort: null,
    }),
    warnings: [],
  };
}
