// Layout linear do view model, comum a CSV, XLSX e impressão. Nenhuma conta nova — só percorre a
// árvore e os totais já calculados.
//   DETALHADO → GROUP / DATA / SUBTOTAL / GRAND_TOTAL (como até a 1.3.x);
//   RESUMIDO  → SUMMARY (uma por grupo, métricas em colunas) + GRAND_TOTAL (domain/summaryLayout.js).
import { aggregateLabel, aggregateValueColumn } from '../../domain/aggregateLabels.js';
import { REPORT_MODES } from '../../domain/reportDefinition.js';
import { formatCell, headerLabel } from '../../domain/reportFormatting.js';
import { NONE_GROUP_KEY } from '../../domain/groupEngine.js';
import { buildSummaryLayout, formatGroupLabel, isLeafGroupLevel, leafOnlyMetricKeys } from '../../domain/summaryLayout.js';
import { gmdCellOf, gmdWarningHeader, hasGmdQuality } from '../../domain/gmdColumns.js';

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

  const { aggregates } = viewModel;
  // M1: colunas da exportação = as da folha + "Aviso do GMD" logo após o GMD que tem algum valor em cinza.
  const exportColumns = exportDataColumns(viewModel);
  const columns = exportColumns.map((entry) => entry.column);
  // Métricas de um par que não vale neste agrupamento (hiddenMetrics) ficam fora também do Detalhado.
  const hidden = new Set(viewModel.hiddenMetrics ?? []);
  const specs = aggregates.filter((spec) => !hidden.has(spec.id));
  // Faixa do lote (par leafOnly) só no subtotal do nível folha — acima dele e no Total geral não sai.
  const leafOnly = leafOnlyMetricKeys(viewModel);
  const specsAt = (level) => specs.filter((spec) => !leafOnly.has(spec.id) || isLeafGroupLevel(viewModel, level));
  const valueColumns = viewModel.availableColumns ?? viewModel.columns;
  const lines = [];
  const empty = target === 'xlsx' || target === 'json' ? null : '';
  const missingNumber = formatCell({ type: 'gmd' }, null, target);
  const dataLine = (row, level, group) => {
    // gray = índices das células de GMD em cinza (o XLSX pinta o número; o CSV leva o aviso na coluna ao lado).
    const gray = [];
    const cells = exportColumns.map((entry, index) => {
      if (entry.aviso) return gmdCellOf(entry.definition, row)?.aviso ?? empty;
      if (!entry.definition) return formatCell(entry.column, cellRawValue(viewModel, entry.column, row), target);
      const gmd = gmdCellOf(entry.definition, row);
      if (gmd.cinza) gray.push(index);
      // SEM_GMD sai vazio (nunca 0); com número, o MESMO número da folha (cinza ou não).
      return gmd.texto === '-' ? missingNumber : formatCell(entry.column, cellRawValue(viewModel, entry.column, row), target);
    });
    return { type: LINE_TYPES.DATA, level, group, row, cells, ...(gray.length ? { gray } : {}) };
  };
  // Rótulo do total: o de curral da definição pelo id (metricLabels — o mesmo da grade e da folha, ex.:
  // Vendas "Animais", "Média (@)", "Valor total"); sem ele, o técnico ("Média simples — Peso (kg)").
  const metricLabels = viewModel.metricLabels ?? {};
  const totalLines = (type, aggregatesMap, level, group) => specsAt(level).map((spec) => {
    const result = aggregatesMap[spec.id];
    return {
      type,
      level,
      group,
      metric: (typeof metricLabels[spec.id] === 'string' && metricLabels[spec.id]) || aggregateLabel(spec, valueColumns),
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
  return { mode: REPORT_MODES.DETALHADO, headers: exportColumns.map((entry) => entry.label), lines, columns };
}

/**
 * M1: colunas de dados do Detalhado na exportação (CSV/XLSX): as visíveis da folha e, logo após cada coluna de GMD com
 * qualidade declarada que tem ALGUM valor em cinza (intervalo curto), a coluna "Aviso do GMD" com o motivo — paridade
 * com a folha (que mostra o número em cinza e o motivo). Sem GMD em cinza, as colunas são as de sempre.
 * @returns {{ column: object, label: string, definition?: object, aviso?: true }[]}
 */
export function exportDataColumns(viewModel) {
  const out = [];
  for (const column of viewModel.columns ?? []) {
    const definition = typeof viewModel.resolve === 'function' ? viewModel.resolve(column.id)?.column ?? null : null;
    const quality = hasGmdQuality(definition) ? definition : null;
    out.push({ column, label: headerLabel(column), ...(quality ? { definition: quality } : {}) });
    if (quality && (viewModel.rows ?? []).some((row) => gmdCellOf(quality, row)?.cinza)) {
      out.push({ column: { id: `${column.id}__aviso`, label: gmdWarningHeader(column), type: 'text' }, label: gmdWarningHeader(column), definition: quality, aviso: true });
    }
  }
  return out;
}
