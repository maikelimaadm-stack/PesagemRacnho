// E1D — o que a tela de relatório (ReportView) grava em modelo e último estado. Funções puras: a tela e o
// gate reports:vendas-por-comprador usam o MESMO código (a tela em React não roda nos gates; o que decide o
// que é gravado fica aqui).
import { REPORT_MODES } from './reportDefinition.js';
import { withoutHiddenColumns } from './reportPermissions.js';

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
 * CONSULTA não salvariam nada em Vendas). O detalhe de um grupo é passageiro: o modelo guarda o Resumido de
 * onde ele saiu.
 */
export function templatePayload(definition, state, role) {
  const visible = withoutHiddenColumns(definition, role, { columns: state.columns, aggregates: state.aggregates });
  const { period, params } = periodOf(definition, state);
  return {
    baseReportId: definition.id,
    columns: visible.columns, filters: state.uiFilters, fixedFilters: state.fixedFilters, groups: state.groups, aggregates: visible.aggregates, sort: state.sort,
    search: state.search, period, params, widths: state.widths,
    orientation: state.orientation, mode: state.drill?.length ? REPORT_MODES.RESUMIDO : state.mode, summarySort: state.summarySort,
    view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
  };
}

/**
 * Último estado (gravado a cada mudança): o mesmo recorte do que o perfil vê — senão o serviço recusa o estado
 * inteiro e a gravação falha em silêncio. Sem condição fixa (regra do serviço).
 */
export function viewStatePayload(definition, state, role) {
  const visible = withoutHiddenColumns(definition, role, { columns: state.columns, aggregates: state.aggregates });
  const { period, params } = periodOf(definition, state);
  return {
    columns: visible.columns, filters: state.uiFilters, groups: state.groups, aggregates: visible.aggregates,
    sort: state.sort, search: state.search, period, params,
    widths: state.widths, orientation: state.orientation, mode: state.drill?.length ? REPORT_MODES.RESUMIDO : state.mode, summarySort: state.summarySort,
    showEmptyColumns: state.showEmptyColumns,
    view: state.view, matrix: state.matrix, sortChoice: state.sortChoice,
  };
}
