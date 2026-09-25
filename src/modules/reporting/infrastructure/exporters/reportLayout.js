// Layout linear do view model, comum a CSV, XLSX e impressão. Nenhuma conta nova — só percorre a
// árvore e os totais já calculados.
//   DETALHADO → GROUP / DATA / SUBTOTAL / GRAND_TOTAL (como até a 1.3.x);
//   RESUMIDO  → SUMMARY (uma por grupo, métricas em colunas) + GRAND_TOTAL (domain/summaryLayout.js).
import { aggregateLabel, aggregateValueColumn } from '../../domain/aggregateLabels.js';
import { REPORT_MODES } from '../../domain/reportDefinition.js';
import { formatCell, headerLabel } from '../../domain/reportFormatting.js';
import { NONE_GROUP_KEY } from '../../domain/groupEngine.js';
import { buildSummaryLayout, formatGroupLabel } from '../../domain/summaryLayout.js';

export { aggregateLabel, aggregateValueColumn };

export const LINE_TYPES = Object.freeze({ GROUP: 'GROUP', DATA: 'DATA', SUBTOTAL: 'SUBTOTAL', GRAND_TOTAL: 'GRAND_TOTAL', SUMMARY: 'SUMMARY' });

/** Valor bruto da célula de dados (nome para entidade). */
export function cellRawValue(viewModel, column, row) {
  const accessor = viewModel.resolve(column.id);
  return column.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row);
}

export function isSummaryMode(viewModel) {
  return viewModel?.mode === REPORT_MODES.RESUMIDO;
}

/**
 * @param viewModel resultado de runReport
 * @param {'csv'|'xlsx'|'print'|'screen'} target
 * @returns {{ mode, headers: string[], lines: { type, level, group, metric?, value?, cells: any[], row? }[], summary? }}
 */
export function buildReportLines(viewModel, target) {
  // Rótulos de grupo de data e sim/não no formato do destino (dd/mm/aaaa, Sim/Não).
  const allColumns = viewModel.availableColumns ?? viewModel.columns ?? [];
  const columnOf = (columnId) => allColumns.find((column) => column.id === columnId) ?? null;
  const partLabel = (part) => formatGroupLabel(columnOf(part.columnId), part.label, target, part.key === NONE_GROUP_KEY);
  const pathText = (path) => path.map(partLabel).join(' > ');
  if (isSummaryMode(viewModel)) {
    const summary = buildSummaryLayout(viewModel, target);
    const lines = summary.rows.map((row) => ({
      type: row.type,
      level: row.level,
      group: row.node ? pathText(row.node.path) : '',
      label: row.label,
      rowCount: row.node ? row.node.rowCount : viewModel.rowCount,
      cells: row.cells,
      rawValues: row.rawValues,
    }));
    return { mode: REPORT_MODES.RESUMIDO, headers: summary.headers, lines, summary };
  }

  const { columns, aggregates } = viewModel;
  const specs = aggregates;
  const valueColumns = viewModel.availableColumns ?? columns;
  const lines = [];
  const dataLine = (row, level, group) => ({
    type: LINE_TYPES.DATA,
    level,
    group,
    row,
    cells: columns.map((column) => formatCell(column, cellRawValue(viewModel, column, row), target)),
  });
  const totalLines = (type, aggregatesMap, level, group) => specs.map((spec) => {
    const result = aggregatesMap[spec.id];
    return {
      type,
      level,
      group,
      metric: aggregateLabel(spec, valueColumns),
      spec,
      value: formatCell(aggregateValueColumn(spec, valueColumns), result?.value ?? null, target),
      rawValue: result?.value ?? null,
      nValid: result?.n_validos ?? null,
      nMissing: result?.n_ausentes ?? null,
      cells: columns.map(() => (target === 'xlsx' ? null : '')),
    };
  });

  if (viewModel.tree.length) {
    const walk = (node) => {
      const group = pathText(node.path);
      const label = formatGroupLabel(columnOf(node.columnId), node.label, target, node.missing);
      lines.push({ type: LINE_TYPES.GROUP, level: node.level, group, label: `${node.columnLabel}: ${label}`, rowCount: node.rowCount, cells: columns.map(() => (target === 'xlsx' ? null : '')) });
      if (node.children.length) node.children.forEach(walk);
      else node.rows.forEach((row) => lines.push(dataLine(row, node.level, group)));
      lines.push(...totalLines(LINE_TYPES.SUBTOTAL, node.aggregates, node.level, group));
    };
    viewModel.tree.forEach(walk);
  } else {
    viewModel.rows.forEach((row) => lines.push(dataLine(row, 0, '')));
  }
  lines.push(...totalLines(LINE_TYPES.GRAND_TOTAL, viewModel.totals, 0, ''));
  return { mode: REPORT_MODES.DETALHADO, headers: columns.map((column) => headerLabel(column)), lines };
}
