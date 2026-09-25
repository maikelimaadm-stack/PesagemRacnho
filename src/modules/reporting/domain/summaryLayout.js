// Modo RESUMIDO (E1 1.4.0): uma linha por grupo com as métricas em colunas.
//
//   colunas = uma por nível de agrupamento (rótulo da coluna agrupada) + uma por métrica
//             (rótulo simples via summaryMetricLabel, formato via aggregateValueColumn);
//   linhas  = nós da árvore em profundidade (nível 1 em negrito; 2–3 recuados — o rótulo fica na
//             coluna do próprio nível), e por último o Total geral.
//
// Nenhuma conta nova: os valores são os agregados que o groupEngine já calculou sobre a população de
// cada grupo (nunca soma de filhos) e o total geral recalculado sobre a população inteira. Tela, CSV,
// XLSX, impressão/PDF e JSON leem ESTE layout — paridade por construção.
import { aggregateValueColumn, summaryMetricLabels } from './aggregateLabels.js';
import { formatCell } from './reportFormatting.js';

export const SUMMARY_LINE_TYPES = Object.freeze({ SUMMARY: 'SUMMARY', GRAND_TOTAL: 'GRAND_TOTAL' });
export const SUMMARY_LABEL_SORT = '__label__';
export const SUMMARY_ROWS_METRIC = '__rows__';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function isMissingValue(value) {
  return value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));
}

function metricValue(node, key) {
  if (key === SUMMARY_ROWS_METRIC) return node.rowCount;
  return node.aggregates?.[key]?.value ?? null;
}

/**
 * Nós da árvore em profundidade (sem linhas de dados).
 * @param tree viewModel.tree
 * @param {{ summarySort?: { key: string, direction: 'asc'|'desc' } | null }} options
 *   key = id da agregação, SUMMARY_LABEL_SORT (rótulo) ou SUMMARY_ROWS_METRIC. Ordena irmãos dentro
 *   do MESMO nível (a hierarquia nunca se mistura); ausente fica sempre por último.
 */
export function buildSummaryRows(tree, { summarySort = null } = {}) {
  const out = [];
  const direction = summarySort?.direction === 'desc' ? -1 : 1;
  const order = (nodes) => {
    if (!summarySort?.key) return nodes;
    return [...nodes].sort((left, right) => {
      if (left.missing !== right.missing) return left.missing ? 1 : -1;
      if (summarySort.key === SUMMARY_LABEL_SORT) return direction * collator.compare(left.label, right.label);
      const a = metricValue(left, summarySort.key);
      const b = metricValue(right, summarySort.key);
      const missingA = isMissingValue(a);
      const missingB = isMissingValue(b);
      if (missingA || missingB) return missingA === missingB ? collator.compare(left.label, right.label) : (missingA ? 1 : -1);
      if (typeof a === 'number' && typeof b === 'number') return a === b ? collator.compare(left.label, right.label) : direction * (a - b);
      return direction * collator.compare(String(a), String(b));
    });
  };
  const walk = (nodes) => {
    for (const node of order(nodes)) {
      out.push({
        id: node.id,
        level: node.level,
        columnId: node.columnId,
        columnLabel: node.columnLabel,
        key: node.key,
        label: node.label,
        missing: node.missing,
        path: node.path.map((part) => ({ ...part })),
        rowCount: node.rowCount,
        aggregates: node.aggregates,
      });
      if (node.children.length) walk(node.children);
    }
  };
  walk(tree || []);
  return out;
}

/** Métricas do Resumido: as agregações do relatório; sem nenhuma, a contagem de linhas. */
export function summaryMetrics(viewModel) {
  const columns = viewModel.availableColumns ?? viewModel.columns ?? [];
  const context = { grain: viewModel.grain, animalColumnId: viewModel.animalColumnId ?? null };
  if (!viewModel.aggregates?.length) {
    return [{ key: SUMMARY_ROWS_METRIC, spec: { id: SUMMARY_ROWS_METRIC, op: 'count' }, label: summaryMetricLabels([{ op: 'count' }], columns, context)[0], column: { type: 'integer' } }];
  }
  const labels = summaryMetricLabels(viewModel.aggregates, columns, context);
  return viewModel.aggregates.map((spec, index) => ({ key: spec.id, spec, label: labels[index], column: aggregateValueColumn(spec, columns) }));
}

/**
 * Layout do Resumido para um destino.
 * @param viewModel resultado de runReport (qualquer modo; usa summaryRows, ou monta a partir da árvore)
 * @param {'screen'|'print'|'csv'|'xlsx'|'json'} target
 * @returns {{ headers: string[], groupHeaders: string[], metrics: object[], rows: object[] }}
 */
export function buildSummaryLayout(viewModel, target = 'screen') {
  const levels = viewModel.groups ?? [];
  const groupHeaders = levels.length ? levels.map((level) => level.label) : ['Resumo'];
  const metrics = summaryMetrics(viewModel);
  const blank = target === 'xlsx' || target === 'json' ? null : '';
  const nodes = viewModel.summaryRows ?? buildSummaryRows(viewModel.tree, { summarySort: viewModel.summarySort });
  const format = (metric, value) => formatCell(metric.column, value ?? null, target);
  const rows = nodes.map((node) => ({
    type: SUMMARY_LINE_TYPES.SUMMARY,
    level: node.level,
    node,
    label: node.label,
    cells: [
      ...groupHeaders.map((_, index) => (index === node.level - 1 ? node.label : blank)),
      ...metrics.map((metric) => format(metric, metricValue(node, metric.key))),
    ],
    rawValues: metrics.map((metric) => metricValue(node, metric.key)),
  }));
  const totalsNode = { rowCount: viewModel.rowCount, aggregates: viewModel.totals };
  rows.push({
    type: SUMMARY_LINE_TYPES.GRAND_TOTAL,
    level: 0,
    node: null,
    label: 'Total geral',
    cells: [
      ...groupHeaders.map((_, index) => (index === 0 ? 'Total geral' : blank)),
      ...metrics.map((metric) => format(metric, metricValue(totalsNode, metric.key))),
    ],
    rawValues: metrics.map((metric) => metricValue(totalsNode, metric.key)),
  });
  return { headers: [...groupHeaders, ...metrics.map((metric) => metric.label)], groupHeaders, metrics, rows };
}
