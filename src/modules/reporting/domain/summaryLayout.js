// Modo RESUMIDO (E1 1.4.0): uma linha por grupo com as métricas em colunas.
//
//   colunas = uma por nível de agrupamento (rótulo da coluna agrupada) + uma por métrica
//             (rótulo simples via summaryMetricLabel, formato via aggregateValueColumn);
//   linhas  = nós da árvore em profundidade (nível 1 em negrito; 2–3 recuados — o rótulo fica na
//             coluna do próprio nível), e por último o Total geral.
//
// Nenhuma conta nova: os valores são os agregados que o groupEngine já calculou sobre a população de
// cada grupo (nunca soma de filhos) e o total geral recalculado sobre a população inteira. Tela, CSV,
// XLSX, impressão/PDF e JSON leem ESTE layout — paridade por construção. (E1C: com 3 níveis o XLSX
// acrescenta o bloco "TOTAL POR" da folha — reportDocument.buildLeafTotalBlock; o CSV e o JSON não.)
import { aggregateValueColumn, summaryMetricLabels } from './aggregateLabels.js';
import { formatCell } from './reportFormatting.js';
import { compareGroupLabels } from './groupEngine.js';

export const SUMMARY_LINE_TYPES = Object.freeze({ SUMMARY: 'SUMMARY', GRAND_TOTAL: 'GRAND_TOTAL' });
export const SUMMARY_LABEL_SORT = '__label__';
export const SUMMARY_ROWS_METRIC = '__rows__';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function isMissingValue(value) {
  return value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));
}

/** Valor bruto de uma métrica do Resumido num nó (contagem de linhas quando não há totais). */
export function summaryMetricValue(node, key) {
  if (key === SUMMARY_ROWS_METRIC) return node.rowCount;
  return node.aggregates?.[key]?.value ?? null;
}

/**
 * Nós da árvore em profundidade (sem linhas de dados).
 * @param tree viewModel.tree
 * @param {{ summarySort?: { key: string, direction: 'asc'|'desc', columnId?: string } | null }} options
 *   key = id da agregação, SUMMARY_LABEL_SORT (rótulo) ou SUMMARY_ROWS_METRIC. Ordena irmãos dentro
 *   do MESMO nível (a hierarquia nunca se mistura); ausente fica sempre por último. E1D: com `columnId`,
 *   só o nível dessa coluna é reordenado (as seções acima ficam na ordem natural).
 */
export function buildSummaryRows(tree, { summarySort = null } = {}) {
  const out = [];
  const direction = summarySort?.direction === 'desc' ? -1 : 1;
  const order = (nodes) => {
    if (!summarySort?.key) return nodes;
    if (summarySort.columnId && nodes[0]?.columnId !== summarySort.columnId) return nodes;
    return [...nodes].sort((left, right) => {
      if (left.missing !== right.missing) return left.missing ? 1 : -1;
      if (summarySort.key === SUMMARY_LABEL_SORT) return direction * compareGroupLabels(left, right);
      const a = summaryMetricValue(left, summarySort.key);
      const b = summaryMetricValue(right, summarySort.key);
      const missingA = isMissingValue(a);
      const missingB = isMissingValue(b);
      if (missingA || missingB) return missingA === missingB ? compareGroupLabels(left, right) : (missingA ? 1 : -1);
      if (typeof a === 'number' && typeof b === 'number') return a === b ? compareGroupLabels(left, right) : direction * (a - b);
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

/**
 * Métricas do Resumido: as agregações do relatório; sem nenhuma, a contagem de linhas.
 * E1B: viewModel.metricLabels (da definição) troca o rótulo automático pelo rótulo de curral da folha.
 */
export function summaryMetrics(viewModel) {
  const columns = viewModel.availableColumns ?? viewModel.columns ?? [];
  const context = { grain: viewModel.grain, animalColumnId: viewModel.animalColumnId ?? null, metricLabels: viewModel.metricLabels ?? null };
  if (!viewModel.aggregates?.length) {
    return [{ key: SUMMARY_ROWS_METRIC, spec: { id: SUMMARY_ROWS_METRIC, op: 'count' }, label: summaryMetricLabels([{ op: 'count' }], columns, context)[0], column: { type: 'integer' } }];
  }
  const labels = summaryMetricLabels(viewModel.aggregates, columns, context);
  // hiddenMetrics: métricas de um par "de–até" que não vale neste agrupamento (faixa do lote agrupando por data).
  const hidden = new Set(viewModel.hiddenMetrics ?? []);
  return viewModel.aggregates
    .map((spec, index) => ({ key: spec.id, spec, label: labels[index], column: aggregateValueColumn(spec, columns) }))
    .filter((metric) => !hidden.has(metric.key));
}

/**
 * Métricas de um par "de–até" que só valem no nível folha (leafOnly — a faixa exigida é do LOTE): acima
 * dele e no Total geral a célula fica vazia em todos os canais (folha, CSV, XLSX, grade), porque a menor
 * mínima e a maior máxima de lotes diferentes não são a faixa de ninguém. O JSON mantém os agregados brutos.
 */
export function leafOnlyMetricKeys(viewModel) {
  return new Set((viewModel.metricPairs ?? []).filter((pair) => pair.leafOnly).flatMap((pair) => [pair.from, pair.to]));
}

/** O nível (1..n; 0 = Total geral) é o nível folha do agrupamento? */
export function isLeafGroupLevel(viewModel, level) {
  const depth = (viewModel.groups ?? []).length;
  return depth > 0 && level === depth;
}

const FORMATTED_LABEL_TYPES = new Set(['date', 'datetime', 'boolean']);

/**
 * Rótulo de grupo no formato do destino: data vira dd/mm/aaaa e sim/não vira "Sim"/"Não" (a chave
 * ISO continua sendo a da ordenação). JSON leva o rótulo canônico.
 * @param column coluna do nível (availableColumns) ou null
 */
export function formatGroupLabel(column, label, target, missing = false) {
  if (missing || target === 'json' || !column || !FORMATTED_LABEL_TYPES.has(column.type)) return label;
  return formatCell(column, label, target) ?? label;
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
  const columns = viewModel.availableColumns ?? viewModel.columns ?? [];
  const levelColumns = levels.map((level) => columns.find((column) => column.id === level.columnId) ?? null);
  const leafOnly = leafOnlyMetricKeys(viewModel);
  const shown = (metric, level) => !leafOnly.has(metric.key) || isLeafGroupLevel(viewModel, level);
  const rows = nodes.map((node) => {
    const label = formatGroupLabel(levelColumns[node.level - 1], node.label, target, node.missing);
    return {
      type: SUMMARY_LINE_TYPES.SUMMARY,
      level: node.level,
      node,
      label,
      cells: [
        ...groupHeaders.map((_, index) => (index === node.level - 1 ? label : blank)),
        ...metrics.map((metric) => (shown(metric, node.level) ? format(metric, summaryMetricValue(node, metric.key)) : blank)),
      ],
      rawValues: metrics.map((metric) => (shown(metric, node.level) ? summaryMetricValue(node, metric.key) : null)),
    };
  });
  const totalsNode = { rowCount: viewModel.rowCount, aggregates: viewModel.totals };
  rows.push({
    type: SUMMARY_LINE_TYPES.GRAND_TOTAL,
    level: 0,
    node: null,
    label: 'Total geral',
    cells: [
      ...groupHeaders.map((_, index) => (index === 0 ? 'Total geral' : blank)),
      ...metrics.map((metric) => (shown(metric, 0) ? format(metric, summaryMetricValue(totalsNode, metric.key)) : blank)),
    ],
    rawValues: metrics.map((metric) => (shown(metric, 0) ? summaryMetricValue(totalsNode, metric.key) : null)),
  });
  return { headers: [...groupHeaders, ...metrics.map((metric) => metric.label)], groupHeaders, metrics, rows };
}
