// Layout linear do view model, comum a CSV, XLSX e impressão: GROUP / DATA / SUBTOTAL /
// GRAND_TOTAL. Nenhuma conta nova — só percorre a árvore e os totais já calculados.
import { AGGREGATION_LABELS } from '../../domain/columnDefinition.js';
import { formatCell, headerLabel } from '../../domain/reportFormatting.js';

export const LINE_TYPES = Object.freeze({ GROUP: 'GROUP', DATA: 'DATA', SUBTOTAL: 'SUBTOTAL', GRAND_TOTAL: 'GRAND_TOTAL' });

/** Rótulo de uma agregação: "Média simples — Peso (kg)"; contagem de registros sem coluna. */
export function aggregateLabel(spec, columns) {
  if (spec.op === 'count' && !spec.columnId) return 'Registros';
  const column = columns.find((item) => item.id === spec.columnId);
  if (spec.op === 'countDistinct' && column && ['animal', 'numero_animal'].includes(column.id)) return 'Animais únicos';
  return `${AGGREGATION_LABELS[spec.op] ?? spec.op} — ${column ? headerLabel(column) : spec.columnId}`;
}

/** Coluna "virtual" para formatar o valor de uma agregação no tipo certo. */
export function aggregateValueColumn(spec, columns) {
  if (['count', 'countValid', 'countDistinct'].includes(spec.op)) return { type: 'integer' };
  const column = columns.find((item) => item.id === spec.columnId) || columns.find((item) => item.id === spec.columnId);
  if (!column) return { type: 'number' };
  if (spec.op === 'weightedGmd') return { type: 'gmd' };
  return column;
}

/** Valor bruto da célula de dados (nome para entidade). */
export function cellRawValue(viewModel, column, row) {
  const accessor = viewModel.resolve(column.id);
  return column.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row);
}

/**
 * @param viewModel resultado de runReport
 * @param {'csv'|'xlsx'|'print'|'screen'} target
 * @returns {{ headers: string[], lines: { type, level, group, metric?, value?, cells: any[], row? }[] }}
 */
export function buildReportLines(viewModel, target) {
  const { columns, aggregates } = viewModel;
  const specs = aggregates;
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
      metric: aggregateLabel(spec, columns),
      spec,
      value: formatCell(aggregateValueColumn(spec, columns), result?.value ?? null, target),
      rawValue: result?.value ?? null,
      nValid: result?.n_validos ?? null,
      nMissing: result?.n_ausentes ?? null,
      cells: columns.map(() => (target === 'xlsx' ? null : '')),
    };
  });

  if (viewModel.tree.length) {
    const walk = (node) => {
      const group = node.path.map((part) => part.label).join(' > ');
      lines.push({ type: LINE_TYPES.GROUP, level: node.level, group, label: `${node.columnLabel}: ${node.label}`, rowCount: node.rowCount, cells: columns.map(() => (target === 'xlsx' ? null : '')) });
      if (node.children.length) node.children.forEach(walk);
      else node.rows.forEach((row) => lines.push(dataLine(row, node.level, group)));
      lines.push(...totalLines(LINE_TYPES.SUBTOTAL, node.aggregates, node.level, group));
    };
    viewModel.tree.forEach(walk);
  } else {
    viewModel.rows.forEach((row) => lines.push(dataLine(row, 0, '')));
  }
  lines.push(...totalLines(LINE_TYPES.GRAND_TOTAL, viewModel.totals, 0, ''));
  return { headers: columns.map((column) => headerLabel(column)), lines };
}
