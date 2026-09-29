// E1D — o que a tela de relatório (ReportView) faz com a população do tipo quando a pessoa sai dele, e o que
// ela grava em modelo e último estado. Funções puras: a tela e o gate reports:vendas-por-comprador usam o
// MESMO código (a tela em React não roda nos gates; o que decide população e gravação fica aqui).
import { REPORT_MODES } from './reportDefinition.js';
import { serializeFilters } from './filterEngine.js';
import { withoutHiddenColumns } from './reportPermissions.js';
import { getReportView } from './reportViews.js';

/**
 * Controle genérico (Agrupar por, Níveis, Resumido/Detalhado) tira a tela do tipo ("Personalizado", contrato
 * §3), mas a POPULAÇÃO do tipo (Vendas = Saída por Venda) não sai junto: continua como condição fixa, com
 * cadeado (`typePopulation`) — filtro da pessoa só restringe. Sem isso, "Resumido" ou "Agrupar por Marca" em
 * Vendas somavam cadastros e manejos debaixo das colunas e dos totais de Vendas. Já fora do tipo, a condição
 * herdada continua; escolher um tipo a solta (com tipo, vale só a população dele — ver screenFixedFilters).
 * @returns {{ view: null, matrix: null, typePopulation: object|null }} patch do estado da tela
 */
export function leaveViewPatch(definition, state = {}) {
  const carried = state.view
    ? serializeFilters(getReportView(definition, state.view)?.population ?? {})
    : (state.typePopulation ?? {});
  return { view: null, matrix: null, typePopulation: Object.keys(carried).length ? carried : null };
}

/**
 * Condições fixas que a tela manda ao serviço e ao modelo: as do modelo + a população herdada do tipo (na
 * mesma coluna, a do tipo prevalece, como no serviço). Com tipo escolhido, a herdada não vale: o serviço
 * aplica a população do próprio tipo.
 */
export function screenFixedFilters(state = {}) {
  const fixed = { ...(state.fixedFilters ?? {}) };
  return state.view ? fixed : { ...fixed, ...(state.typePopulation ?? {}) };
}

function periodOf(definition, state) {
  const periodParam = definition.params.find((param) => param.type === 'period');
  return {
    period: periodParam ? state.params?.[periodParam.id] ?? {} : null,
    params: Object.fromEntries(Object.entries(state.params ?? {}).filter(([key]) => key !== periodParam?.id)),
  };
}

/**
 * Modelo salvo pela tela ("Salvar modelo"). Só as colunas e os totais que o autor vê: Vendas traz Valor @ e
 * Valor total por padrão, e o serviço recusa inteiro o modelo com coluna que o autor não vê (OPERADOR e
 * CONSULTA não salvariam nada em Vendas). Condições fixas com a população herdada do tipo (o modelo reabre
 * com o mesmo cadeado). O detalhe de um grupo é passageiro: o modelo guarda o Resumido de onde ele saiu.
 */
export function templatePayload(definition, state, role) {
  const visible = withoutHiddenColumns(definition, role, { columns: state.columns, aggregates: state.aggregates });
  const { period, params } = periodOf(definition, state);
  return {
    baseReportId: definition.id,
    columns: visible.columns, filters: state.uiFilters, fixedFilters: screenFixedFilters(state), groups: state.groups, aggregates: visible.aggregates, sort: state.sort,
    search: state.search, period, params, widths: state.widths,
    orientation: state.orientation, mode: state.drill?.length ? REPORT_MODES.RESUMIDO : state.mode, summarySort: state.summarySort,
    view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
  };
}

/**
 * Último estado (gravado a cada mudança): o mesmo recorte do que o perfil vê — senão o serviço recusa o estado
 * inteiro e a gravação falha em silêncio. Condição fixa nunca vai para o último estado (regra do serviço: o
 * relatório comum não reabre travado); a população herdada do tipo vai como filtro comum, pelo código —
 * reabrir não amplia em silêncio, e o filtro aparece para a pessoa (que pode tirá-lo de propósito).
 */
export function viewStatePayload(definition, state, role) {
  const visible = withoutHiddenColumns(definition, role, { columns: state.columns, aggregates: state.aggregates });
  const { period, params } = periodOf(definition, state);
  const inherited = state.view ? {} : (state.typePopulation ?? {});
  return {
    columns: visible.columns, filters: { ...(state.uiFilters ?? {}), ...inherited }, groups: state.groups, aggregates: visible.aggregates,
    sort: state.sort, search: state.search, period, params,
    widths: state.widths, orientation: state.orientation, mode: state.drill?.length ? REPORT_MODES.RESUMIDO : state.mode, summarySort: state.summarySort,
    showEmptyColumns: state.showEmptyColumns,
    view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
  };
}
