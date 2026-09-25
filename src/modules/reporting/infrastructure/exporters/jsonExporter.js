// JSON profissional: { manifest, definition, parameters, filters, groups, columns, aggregates,
// data, tree, totals }. Valores canônicos (sem arredondar). Integridade: manifest.contentSha256 é
// o SHA-256 do JSON do corpo (tudo exceto o manifesto), recalculável por quem recebe o arquivo.
// E1 (1.4.0): `mode`. No RESUMIDO o corpo leva `summary` (as mesmas linhas da tela, valores
// canônicos) e `data` vazio — o Resumido não exporta linha de animal/pesagem.
import { formatCell } from '../../domain/reportFormatting.js';
import { REPORT_MODES } from '../../domain/reportDefinition.js';
import { buildSummaryLayout } from '../../domain/summaryLayout.js';
import { cellRawValue } from './reportLayout.js';

function projectRow(viewModel, row) {
  const out = { _id: row.id ?? null };
  for (const column of viewModel.columns) out[column.id] = formatCell(column, cellRawValue(viewModel, column, row), 'json');
  return out;
}

function projectNode(viewModel, node, { includeRowIds = true } = {}) {
  return {
    id: node.id,
    level: node.level,
    columnId: node.columnId,
    key: node.key,
    label: node.label,
    missing: node.missing,
    rowCount: node.rowCount,
    rowIds: includeRowIds && !node.children.length ? node.rows.map((row) => row.id ?? null) : [],
    aggregates: node.aggregates,
    children: node.children.map((child) => projectNode(viewModel, child, { includeRowIds })),
  };
}

function projectSummary(viewModel) {
  const layout = buildSummaryLayout(viewModel, 'json');
  return {
    headers: layout.headers,
    metrics: layout.metrics.map((metric) => ({ key: metric.key, label: metric.label, op: metric.spec.op, columnId: metric.spec.columnId ?? null })),
    rows: layout.rows.map((row) => ({
      type: row.type,
      level: row.level,
      path: row.node ? row.node.path.map(({ columnId, key, label }) => ({ columnId, key, label })) : [],
      label: row.label,
      rowCount: row.node ? row.node.rowCount : viewModel.rowCount,
      cells: row.cells,
      values: Object.fromEntries(layout.metrics.map((metric, index) => [metric.key, row.rawValues[index]])),
    })),
  };
}

/** Corpo do JSON (sem manifesto) — objeto puro, serializável, determinístico. */
export function buildJsonBody(viewModel) {
  const summary = viewModel.mode === REPORT_MODES.RESUMIDO;
  return {
    definition: {
      id: viewModel.reportId,
      version: viewModel.reportDefinitionVersion,
      title: viewModel.reportName,
      family: viewModel.family,
      grain: viewModel.grain,
      grainLabel: viewModel.grainLabel,
      classification: viewModel.classification,
      notes: viewModel.notes,
    },
    mode: viewModel.mode ?? REPORT_MODES.DETALHADO,
    parameters: viewModel.params,
    period: viewModel.period,
    filters: viewModel.filters,
    lockedFilters: viewModel.lockedFilters,
    drill: viewModel.drill ?? [],
    search: viewModel.search,
    sort: viewModel.sort,
    groups: viewModel.groups,
    columns: viewModel.columns.map(({ id, label, type, unit, source, sensitive }) => ({ id, label, type, unit, source, sensitive })),
    aggregates: viewModel.aggregates,
    data: summary ? [] : viewModel.rows.map((row) => projectRow(viewModel, row)),
    ...(summary ? { summary: projectSummary(viewModel) } : {}),
    tree: viewModel.tree.map((node) => projectNode(viewModel, node, { includeRowIds: !summary })),
    totals: viewModel.totals,
    recordCount: viewModel.rowCount,
    uniqueAnimalCount: viewModel.uniqueAnimalCount,
  };
}
