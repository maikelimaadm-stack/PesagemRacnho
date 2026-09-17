// JSON profissional: { manifest, definition, parameters, filters, groups, columns, aggregates,
// data, tree, totals }. Valores canônicos (sem arredondar). Integridade: manifest.contentSha256 é
// o SHA-256 do JSON do corpo (tudo exceto o manifesto), recalculável por quem recebe o arquivo.
import { formatCell } from '../../domain/reportFormatting.js';
import { cellRawValue } from './reportLayout.js';

function projectRow(viewModel, row) {
  const out = { _id: row.id ?? null };
  for (const column of viewModel.columns) out[column.id] = formatCell(column, cellRawValue(viewModel, column, row), 'json');
  return out;
}

function projectNode(viewModel, node) {
  return {
    id: node.id,
    level: node.level,
    columnId: node.columnId,
    key: node.key,
    label: node.label,
    missing: node.missing,
    rowCount: node.rowCount,
    rowIds: node.children.length ? [] : node.rows.map((row) => row.id ?? null),
    aggregates: node.aggregates,
    children: node.children.map((child) => projectNode(viewModel, child)),
  };
}

/** Corpo do JSON (sem manifesto) — objeto puro, serializável, determinístico. */
export function buildJsonBody(viewModel) {
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
    parameters: viewModel.params,
    period: viewModel.period,
    filters: viewModel.filters,
    lockedFilters: viewModel.lockedFilters,
    search: viewModel.search,
    sort: viewModel.sort,
    groups: viewModel.groups,
    columns: viewModel.columns.map(({ id, label, type, unit, source, sensitive }) => ({ id, label, type, unit, source, sensitive })),
    aggregates: viewModel.aggregates,
    data: viewModel.rows.map((row) => projectRow(viewModel, row)),
    tree: viewModel.tree.map((node) => projectNode(viewModel, node)),
    totals: viewModel.totals,
    recordCount: viewModel.rowCount,
    uniqueAnimalCount: viewModel.uniqueAnimalCount,
  };
}
