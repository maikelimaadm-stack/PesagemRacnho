// Estado inicial da tela de um relatório (ReportView). E1D: saiu do componente para ser conferido em Node
// (gate reports:pesagens-tipos:verify) — é o mesmo código que a tela usa, sem React.
// Precedência (E1B): modelo > visão antiga (favorito/link de antes da 1.4.0) > último estado > padrão.
// E1D: o "padrão" de um relatório com tipo padrão (Pesagens) é esse tipo — "Por Apartação (Resumo por
// Data)" —; sem tipo padrão, o agrupamento/modo padrão da definição, como antes.
import { aliasSelection } from '../definitions/legacyAliases.js';
import { typesByStructure } from '../definitions/legacyViews.js';
import { metricKeysOf, REPORT_MODES } from '../domain/reportDefinition.js';
import { applyColumnKeys, filtersForDisplay, getReportView, isPreviousAggregates, resolveViewId, viewSelection } from '../domain/reportViews.js';
import { legacySortChoice } from '../domain/sortChoices.js';
import { DEFAULT_DISPLAY } from '../domain/reportCharts.js';
import { templateToRequest } from './reportTemplateService.js';

// Tipo explícito no estado da tela (contrato §3). Estado sem `view` ganha o tipo que bate pela estrutura
// (resolveViewId); nenhum → null ("Personalizado").
// Só tipo DECLARADO vai para o estado (e daí para o serviço, o último estado e os modelos): o tipo gerado
// dos relatórios sem tipos declarados ("Resumo por <agrupamento padrão>", "Analítico") é só atalho, e o
// serviço recusa id gerado — sem isto Rebanho, Desempenho, Saídas… abriam com erro. O seletor continua
// mostrando o gerado pela estrutura (ReportView → resolveViewId).
// Sem sortChoice (antes da E1D): a opção que mostra a ordem que ele tinha, ou "Personalizado"
// (sortChoices.legacySortChoice — nada abre invertido).
// E1E: a estrutura é conferida com os filtros do estado (filtros da pessoa + condições fixas): tipo com população
// (Mortes, Perdendo Peso…) só quando o estado já filtra exatamente essa população (reportViews.matchView).
// E1G: as chaves de totais são exatamente um padrão ANTIGO do tipo (a pessoa nunca escolheu colunas)? Então
// valem as de hoje — ex.: "Dias Médios" entrou no Desempenho e só apareceria para quem nunca abriu o relatório.
function isPreviousDefault(view, keys) {
  const previous = view?.mode === REPORT_MODES.RESUMIDO ? view.columnChoices?.previous : null;
  if (!previous?.length || !keys?.length) return false;
  const wanted = [...new Set(keys)].sort().join('|');
  return previous.some((list) => [...new Set(list)].sort().join('|') === wanted);
}

function upgradedAggregates(definition, view, aggregates) {
  if (view?.mode === REPORT_MODES.DETALHADO && isPreviousAggregates(view, aggregates)) return view.aggregates.map((spec) => ({ ...spec }));
  if (!Array.isArray(aggregates) || !isPreviousDefault(view, metricKeysOf(aggregates, definition.metricPairs ?? []))) return aggregates;
  return applyColumnKeys(view, definition, view.columnChoices.defaults).aggregates;
}

export function withTypedState(definition, state) {
  const filters = { ...(state.uiFilters ?? {}), ...(state.fixedFilters ?? {}) };
  const resolved = state.view !== undefined ? state.view : resolveViewId(definition, { ...state, filters });
  const declared = resolved ? getReportView(definition, resolved) : null;
  const view = declared && !declared.generated ? declared.id : null;
  const typed = view ? declared : null;
  return {
    ...state,
    view,
    ...(typed && Array.isArray(state.aggregates) ? { aggregates: upgradedAggregates(definition, typed, state.aggregates) } : {}),
    matrix: state.matrix ?? (typed ? typed.matrix ?? null : null),
    sortChoice: state.sortChoice !== undefined ? state.sortChoice : legacySortChoice(definition, typed, state),
  };
}

/**
 * E1D (item 5): seleção de um tipo com a escolha do seletor "Colunas" que a pessoa salvou para ELE
 * (report-type-columns); sem escolha, as colunas/totais padrão do tipo.
 * @param view objeto do tipo (listReportViews) ou id
 * @param typeColumns { [viewId]: chave[] } do usuário (getTypeColumnPrefs) ou null
 */
export function typedViewSelection(definition, view, typeColumns) {
  const resolved = typeof view === 'string' ? getReportView(definition, view) : view;
  const selection = viewSelection(resolved, definition);
  const keys = typeColumns?.[resolved.id];
  // E1G: escolha gravada igual a um padrão antigo do tipo = sem escolha (padrão de hoje).
  if (isPreviousDefault(resolved, keys)) return selection;
  return keys?.length && resolved.columnChoices ? { ...selection, ...applyColumnKeys(resolved, definition, keys) } : selection;
}

/** Tipo com que uma visão antiga abre num relatório de tipos: o declarado nela, o da estrutura (E1E) ou nenhum. */
function presetView(definition, preset) {
  const declared = preset?.view ? getReportView(definition, preset.view) : null;
  if (declared && !declared.generated) return { view: declared.id };
  return typesByStructure(definition) ? {} : { view: null };
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
    // E1G: vista "Folha | Gráficos" e configuração dos gráficos (templateToRequest só traz o que difere do padrão).
    display: request.display ?? DEFAULT_DISPLAY,
    charts: request.charts ?? {},
    ...extra,
  });
}

/**
 * @param definition ReportDefinition
 * @param {{ template?: object|null, preset?: object|null, role?: string|null, savedState?: object|null, typeColumns?: object|null }} source
 *   template = modelo salvo; preset = visão de relatório antigo (LEGACY_REPORT_ALIASES); savedState =
 *   último estado já revalidado (getReportViewState); typeColumns = escolhas de "Colunas" por tipo do usuário
 *   (lidas antes de montar: o tipo padrão abre com elas, sem piscar).
 * @returns {{ state: object, warnings: object[] }} warnings = avisos do modelo (a tela mostra em toast)
 */
export function buildInitialReportState(definition, { template = null, preset = null, role = null, savedState = null, typeColumns = null } = {}) {
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
  const blank = { search: '', widths: {}, drill: [], orientation: 'auto', showEmptyColumns: false, detailSheet: false, fixedFilters: {}, display: DEFAULT_DISPLAY, charts: {} };
  // E1D: relatório com tipo padrão (Pesagens → "Por Apartação (Resumo por Data)") abre nele, com as colunas
  // que a pessoa escolheu para esse tipo. E1E: relatório antigo que virou tipo (favorito/link de "Vendas do
  // período" → Comercial › Vendas) abre nesse tipo, do mesmo jeito.
  const startView = preset ? preset.view ?? null : definition.defaultView ?? null;
  if (startView) {
    const selection = typedViewSelection(definition, startView, typeColumns);
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
      // E1D: visão antiga em Pesagens abre a seleção dela como "Personalizado" (nunca vira um dos 5 tipos só
      // porque a estrutura coincide). E1E: nos demais relatórios os tipos SÃO as visões antigas — a seleção dela
      // abre no tipo que bate pela estrutura (legacyViews.typesByStructure); a que declara o tipo (`view`), nele.
      ...(legacy && definition.defaultView ? presetView(definition, preset) : {}),
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
