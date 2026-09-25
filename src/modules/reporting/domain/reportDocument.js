// Documento da FOLHA do relatório (E1B 1.4.0): função pura que transforma o view model da E1 no modelo
// que a tela, a impressão e o PDF desenham (um renderizador só: infrastructure/exporters/sheetHtml.js).
//
//   Resumido  → seções por nível de agrupamento (APARTAÇÃO: … › DATA: …), tabela do nível folha, linha
//               de Subtotal por seção, bloco "TOTAL POR <nível folha> – <nível 1>" (3 níveis) e Total geral;
//   Detalhado → ("Ver como folha") seções por nível com as linhas de dados e o subtotal em linha de totais.
//
// Nenhuma conta nova: os valores são os agregados que o motor da E1 já calculou em cada nó (o pai recalcula
// sobre a própria população, nunca soma filhos) e o "TOTAL POR" é o MESMO motor (groupRows) sobre a
// população da seção de nível 1. Colunas: cada linha é gerada por columns.map — uma célula por coluna, na
// ordem do cabeçalho (o erro de colunas desalinhadas do modelo antigo fica impossível por construção).
// Coluna sem nenhum valor no relatório inteiro some (opção showEmptyColumns desliga); GMD sem pesagem
// anterior fica "—" (o motor exclui) e a nota diz com quantos animais foi calculado.
import { aggregateLabel, aggregateValueColumn } from './aggregateLabels.js';
import { describeFilter } from './filterEngine.js';
import { compareGroupLabels, groupRows, NONE_GROUP_KEY } from './groupEngine.js';
import { computeAggregates } from './reportAggregates.js';
import { REPORT_MODES } from './reportDefinition.js';
import { formatCell, headerLabel, MISSING_SCREEN } from './reportFormatting.js';
import { formatGroupLabel, summaryMetrics, SUMMARY_LABEL_SORT, SUMMARY_ROWS_METRIC } from './summaryLayout.js';

export const DOCUMENT_KIND = 'pesagens.report-document';
export const DOC_ROW_TYPES = Object.freeze({
  GROUP: 'GROUP', // um grupo do nível folha (linha da tabela da seção)
  SUBTOTAL: 'SUBTOTAL', // totais do nó da seção
  LEAF_TOTAL: 'LEAF_TOTAL', // linha do bloco "TOTAL POR <folha>" (reagrupamento da seção de nível 1)
  TOTAL: 'TOTAL', // total da seção de nível 1 no fim do bloco "TOTAL POR"
  GRAND_TOTAL: 'GRAND_TOTAL',
  DATA: 'DATA', // linha de dados (Detalhado como folha)
});
export const LABEL_COLUMN_KEY = '__label__';

// Largura útil do A4 com margens de 10 mm (px impressos a 96 dpi) e os tamanhos de fonte da folha.
export const SHEET_PAGE = Object.freeze({
  PORTRAIT_WIDTH_PX: 718,
  LANDSCAPE_WIDTH_PX: 1047,
  SIZES: Object.freeze([
    Object.freeze({ id: 'm', factor: 1 }), // 8,5 pt
    Object.freeze({ id: 's', factor: 0.894 }), // 7,6 pt
    Object.freeze({ id: 'xs', factor: 0.8 }), // 6,8 pt
  ]),
  CELL_PADDING_PX: 9,
  LABEL_MIN_PX: 64,
  LABEL_MAX_PX: 210,
  METRIC_MIN_PX: 34,
  DETAIL_PORTRAIT_MAX: 1000, // Detalhado: soma das larguras de tela das colunas (como na E1)
  DETAIL_LANDSCAPE_MAX: 1520,
});
// Largura média de caractere (px) em 8,5 pt: rótulo em Arial, número em Consolas, cabeçalho em negrito menor.
const CHAR_PX = Object.freeze({ label: 6.2, number: 6.3, header: 5.9 });

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const upper = (text) => String(text ?? '').toLocaleUpperCase('pt-BR');
const isMissingValue = (value) => value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));
const COUNT_OPS = new Set(['count', 'countValid', 'countDistinct']);

function brDate(iso) {
  return String(iso ?? '').slice(0, 10).split('-').reverse().join('/');
}

export function formatEmittedAt(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Filtros aplicados em texto (condições fixas, filtros do usuário, detalhe do grupo e pesquisa). */
export function describeReportFilters(viewModel) {
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  const columnOf = (columnId) => available.find((column) => column.id === columnId) ?? null;
  const label = (columnId) => columnOf(columnId)?.label ?? columnId;
  const parts = [
    ...Object.entries(viewModel.lockedFilters || {}).map(([id, filter]) => `${label(id)} ${describeFilter(filter, columnOf(id))} (fixo)`),
    ...Object.entries(viewModel.filters || {}).map(([id, filter]) => `${label(id)} ${describeFilter(filter, columnOf(id))}`),
    ...(viewModel.drill || []).map((part) => `${part.columnLabel ?? label(part.columnId)} = ${part.label ?? part.key} (detalhe do grupo)`),
  ];
  if (viewModel.search) parts.push(`pesquisa “${viewModel.search}”`);
  return parts.length ? parts.join(' · ') : 'Nenhum';
}

/** Plural simples de um rótulo de nível ("Lote" → "Lotes", "Apartação" → "Apartações"). */
function pluralOf(label) {
  const word = String(label ?? '').split(' (')[0].trim();
  if (!word) return 'Grupos';
  if (/ão$/i.test(word)) return word.replace(/ão$/i, 'ões');
  if (/l$/i.test(word)) return `${word.slice(0, -1)}is`;
  if (/[rzs]$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

function metricValueOf(node, key) {
  if (key === SUMMARY_ROWS_METRIC) return node.rowCount;
  return node.aggregates?.[key]?.value ?? null;
}

/** Ordem dos irmãos: a mesma do Resumido da E1 (summarySort dentro do nível; ausente sempre por último). */
export function orderNodes(nodes, summarySort) {
  if (!summarySort?.key) return nodes;
  const direction = summarySort.direction === 'desc' ? -1 : 1;
  return [...nodes].sort((left, right) => {
    if (left.missing !== right.missing) return left.missing ? 1 : -1;
    if (summarySort.key === SUMMARY_LABEL_SORT) return direction * compareGroupLabels(left, right);
    const a = metricValueOf(left, summarySort.key);
    const b = metricValueOf(right, summarySort.key);
    const missingA = isMissingValue(a);
    const missingB = isMissingValue(b);
    if (missingA || missingB) return missingA === missingB ? compareGroupLabels(left, right) : (missingA ? 1 : -1);
    if (typeof a === 'number' && typeof b === 'number') return a === b ? compareGroupLabels(left, right) : direction * (a - b);
    return direction * collator.compare(String(a), String(b));
  });
}

function columnLookup(viewModel) {
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  return (columnId) => available.find((column) => column.id === columnId) ?? null;
}

/** Texto de uma faixa "de–até" (ex.: 250–500); inteiro sem casas, fração com 1 casa. */
/** Faixa "de–até" (150–350; ≥ 150; ≤ 350; "—"): a mesma na folha, nos totais do Detalhado e na grade. */
export function rangeText(from, to) {
  const fmt = (value) => Number(value).toLocaleString('pt-BR', Number.isInteger(Number(value)) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const hasFrom = !isMissingValue(from);
  const hasTo = !isMissingValue(to);
  if (hasFrom && hasTo) return `${fmt(from)}–${fmt(to)}`;
  if (hasFrom) return `≥ ${fmt(from)}`;
  if (hasTo) return `≤ ${fmt(to)}`;
  return MISSING_SCREEN;
}

// ---------------------------------------------------------------------------
// Colunas do Resumido
// ---------------------------------------------------------------------------

function summaryColumns(viewModel) {
  const columnOf = columnLookup(viewModel);
  const metrics = summaryMetrics(viewModel);
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const pairs = (viewModel.metricPairs || []).filter((pair) => byKey.has(pair.from) && byKey.has(pair.to));
  const paired = new Set(pairs.flatMap((pair) => [pair.from, pair.to]));
  const leafLevel = (viewModel.groups ?? []).at(-1) ?? null;
  const columns = [{ key: LABEL_COLUMN_KEY, label: leafLevel?.label ?? 'Resumo', kind: 'label', align: 'left' }];
  for (const metric of metrics) {
    const pair = pairs.find((item) => item.from === metric.key);
    if (pair) {
      columns.push({ key: `pair:${pair.id}`, label: pair.label, kind: 'pair', align: 'right', pair, from: metric, to: byKey.get(pair.to) });
      continue;
    }
    if (paired.has(metric.key)) continue;
    const source = metric.spec?.columnId ? columnOf(metric.spec.columnId) : null;
    columns.push({
      key: metric.key,
      label: metric.label,
      kind: 'metric',
      align: 'right',
      metric,
      op: metric.spec?.op ?? 'count',
      zeroAsEmpty: Boolean(source?.zeroAsEmpty),
      unit: metric.column?.unit ?? null,
    });
  }
  return columns;
}

function metricIsEmpty(column, totals) {
  if (column.kind === 'label') return false;
  if (column.kind === 'pair') return isMissingValue(totals?.[column.from.key]?.value) && isMissingValue(totals?.[column.to.key]?.value);
  const value = totals?.[column.key]?.value ?? null;
  if (isMissingValue(value)) return true;
  return column.zeroAsEmpty && value === 0;
}

function summaryCell(column, index, { node, aggregates, isLeafRow, labelText }) {
  if (column.kind === 'label') return { col: index, key: column.key, text: labelText, raw: labelText, align: 'left', kind: 'label' };
  if (column.kind === 'pair') {
    if (column.pair.leafOnly && !isLeafRow) return { col: index, key: column.key, text: '', raw: null, align: 'right', kind: 'num' };
    const from = aggregates?.[column.from.key]?.value ?? null;
    const to = aggregates?.[column.to.key]?.value ?? null;
    return { col: index, key: column.key, text: rangeText(from, to), raw: [from, to], align: 'right', kind: 'num' };
  }
  const result = column.key === SUMMARY_ROWS_METRIC ? { value: node?.rowCount ?? null } : aggregates?.[column.key];
  let value = result?.value ?? null;
  if (column.zeroAsEmpty && value === 0) value = null;
  const partial = result && !COUNT_OPS.has(column.op) && Number.isInteger(result.n_validos) && Number.isInteger(result.n_total)
    && result.n_validos > 0 && result.n_validos < result.n_total ? { nValid: result.n_validos, nTotal: result.n_total } : null;
  return { col: index, key: column.key, text: formatCell(column.metric.column, value, 'print'), raw: value, align: 'right', kind: 'num', partial };
}

// ---------------------------------------------------------------------------
// Corpo do Resumido
// ---------------------------------------------------------------------------

function buildSummaryBody(viewModel, columns) {
  const columnOf = columnLookup(viewModel);
  const levels = viewModel.groups ?? [];
  const depth = levels.length;
  const levelColumn = (level) => columnOf(levels[level - 1]?.columnId);
  const nodeLabel = (node) => formatGroupLabel(levelColumn(node.level), node.label, 'print', node.missing || node.key === NONE_GROUP_KEY);
  const stats = { sections: 0, tables: 0, groupRows: 0, subtotalRows: 0, leafTotalRows: 0, totalRows: 0, dataRows: 0, grandRows: 0 };
  const drillTargets = {};
  const specs = (viewModel.aggregates ?? []).map((spec) => ({ id: spec.id, op: spec.op, ...(spec.columnId ? { columnId: spec.columnId } : {}) }));

  const row = (type, id, cellsArgs, drill) => {
    if (drill) drillTargets[id] = drill;
    return { type, id, drill: drill ? id : null, cells: columns.map((column, index) => summaryCell(column, index, cellsArgs)) };
  };
  const groupRow = (node) => {
    stats.groupRows += 1;
    return row(DOC_ROW_TYPES.GROUP, node.id, { node, aggregates: node.aggregates, isLeafRow: node.level === depth, labelText: nodeLabel(node) }, node.path);
  };
  const subtotalRow = (node) => {
    stats.subtotalRows += 1;
    const childLevel = levels[node.level];
    const children = node.children?.length ?? 0;
    const text = `Subtotal ${nodeLabel(node)}${childLevel ? ` · ${pluralOf(childLevel.label)}: ${children}` : ''}`;
    return row(DOC_ROW_TYPES.SUBTOTAL, `${node.id}#subtotal`, { node, aggregates: node.aggregates, isLeafRow: false, labelText: text }, node.path);
  };
  const table = (id, kind, rows, title = null) => {
    stats.tables += 1;
    return { id, kind, title, rows };
  };

  const sections = [];
  let flat = null;
  if (depth === 1) {
    flat = table('flat', 'FLAT', orderNodes(viewModel.tree, viewModel.summarySort).map(groupRow));
  } else if (depth >= 2) {
    const leafLevel = levels[depth - 1];
    const buildSection = (node) => {
      stats.sections += 1;
      drillTargets[node.id] = node.path;
      const title = `${upper(node.columnLabel ?? levels[node.level - 1]?.label)}: ${upper(nodeLabel(node))}`;
      const section = { id: node.id, level: node.level, title, drill: node.id, sections: [], table: null, leafTotal: null };
      const children = orderNodes(node.children ?? [], viewModel.summarySort);
      if (node.level === depth - 1) {
        section.table = table(node.id, 'SECTION', [...children.map(groupRow), subtotalRow(node)]);
      } else {
        section.sections = children.map(buildSection);
      }
      // 3 níveis: no fim da seção de nível 1, a mesma tabela consolidada por nível folha (todas as datas).
      if (node.level === 1 && depth >= 3) {
        const regrouped = groupRows(node.rows, [{ columnId: leafLevel.columnId, direction: leafLevel.direction }], viewModel.resolve, { aggregates: specs });
        const rows = orderNodes(regrouped.nodes, viewModel.summarySort).map((child) => {
          stats.leafTotalRows += 1;
          const id = `${node.id}#total-por|${child.id}`;
          return row(DOC_ROW_TYPES.LEAF_TOTAL, id, { node: child, aggregates: child.aggregates, isLeafRow: true, labelText: formatGroupLabel(columnOf(leafLevel.columnId), child.label, 'print', child.missing) }, [...node.path, ...child.path]);
        });
        stats.totalRows += 1;
        rows.push(row(DOC_ROW_TYPES.TOTAL, `${node.id}#total`, { node, aggregates: node.aggregates, isLeafRow: false, labelText: `Total ${nodeLabel(node)}` }, node.path));
        section.leafTotal = table(`${node.id}#total-por`, 'LEAF_TOTAL', rows, `TOTAL POR ${upper(leafLevel.label)} – ${upper(nodeLabel(node))}`);
      }
      return section;
    };
    sections.push(...orderNodes(viewModel.tree, viewModel.summarySort).map(buildSection));
  }

  stats.grandRows += 1;
  const grandRow = {
    type: DOC_ROW_TYPES.GRAND_TOTAL,
    id: '#grand',
    drill: null,
    cells: columns.map((column, index) => summaryCell(column, index, { node: { rowCount: viewModel.rowCount }, aggregates: viewModel.totals, isLeafRow: false, labelText: 'Total geral' })),
  };
  if (flat) flat.rows.push(grandRow);
  const grandTotal = flat ? null : table('grand', 'GRAND', [grandRow]);
  return { sections, flat, grandTotal, stats, drillTargets };
}

// ---------------------------------------------------------------------------
// Corpo do Detalhado ("Ver como folha")
// ---------------------------------------------------------------------------

function detailColumns(viewModel) {
  const numericTypes = new Set(['integer', 'number', 'weight', 'gmd', 'money', 'percentage']);
  return (viewModel.columns ?? []).map((column) => ({
    key: column.id,
    label: headerLabel(column),
    kind: 'data',
    align: column.align === 'right' || numericTypes.has(column.type) ? 'right' : 'left',
    // Na folha, kg com 1 casa (a grade e as exportações de pesagem continuam com as casas da coluna).
    column: column.type === 'weight' && !Number.isInteger(column.decimals) ? { ...column, decimals: 1 } : column,
  }));
}

function dataCellRaw(viewModel, column, row) {
  const accessor = viewModel.resolve(column.id);
  return column.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row);
}

/**
 * Totais do Detalhado em texto. Par "de–até" (faixa do lote) = um item só, e o `leafOnly` só no subtotal
 * do nível folha — como na folha resumida (a faixa de uma data com lotes diferentes seria inventada).
 */
function detailChips(viewModel, aggregates, rowCount, { leafLevel = false } = {}) {
  const metrics = summaryMetrics(viewModel);
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  if (!(viewModel.aggregates ?? []).length) return [{ label: 'Registros', text: String(rowCount ?? 0) }];
  const byKey = new Set(metrics.map((metric) => metric.key));
  const pairs = (viewModel.metricPairs || []).filter((pair) => byKey.has(pair.from) && byKey.has(pair.to));
  const paired = new Set(pairs.flatMap((pair) => [pair.from, pair.to]));
  const items = [];
  for (const metric of metrics) {
    const pair = pairs.find((item) => item.from === metric.key);
    if (pair) {
      if (!pair.leafOnly || leafLevel) items.push({ label: pair.label, text: rangeText(aggregates?.[pair.from]?.value ?? null, aggregates?.[pair.to]?.value ?? null) });
      continue;
    }
    if (paired.has(metric.key)) continue;
    const result = aggregates?.[metric.key];
    // Contagem 0 de coluna zeroAsEmpty (Machos/Fêmeas) = "—", como nas células da folha resumida.
    const zeroAsEmpty = Boolean(available.find((column) => column.id === metric.spec?.columnId)?.zeroAsEmpty);
    const value = zeroAsEmpty && result?.value === 0 ? null : result?.value ?? null;
    const partial = result && !COUNT_OPS.has(metric.spec?.op) && result.n_validos > 0 && result.n_validos < result.n_total ? ` (${result.n_validos} de ${result.n_total})` : '';
    const label = metric.label || aggregateLabel(metric.spec, available);
    items.push({ label, text: `${formatCell(metric.column ?? aggregateValueColumn(metric.spec, available), value, 'print')}${partial}` });
  }
  return items;
}

function buildDetailBody(viewModel, columns, { maxDataRows = Infinity } = {}) {
  const columnOf = columnLookup(viewModel);
  const levels = viewModel.groups ?? [];
  const stats = { sections: 0, tables: 0, groupRows: 0, subtotalRows: 0, leafTotalRows: 0, totalRows: 0, dataRows: 0, grandRows: 0 };
  const drillTargets = {};
  let emitted = 0;
  const dataRow = (row, index) => {
    stats.dataRows += 1;
    emitted += 1;
    return {
      type: DOC_ROW_TYPES.DATA,
      id: `${row.id ?? index}`,
      drill: null,
      cells: columns.map((column, col) => {
        const text = formatCell(column.column, dataCellRaw(viewModel, column.column, row), 'print');
        return { col, key: column.key, text, raw: null, align: column.align, kind: column.align === 'right' ? 'num' : 'txt' };
      }),
    };
  };
  const chipsRow = (type, id, title, aggregates, rowCount, leafLevel = false) => ({ type, id, drill: null, chips: { title, items: detailChips(viewModel, aggregates, rowCount, { leafLevel }) } });
  const rowsOf = (population) => {
    const out = [];
    for (const [index, row] of population.entries()) {
      if (emitted >= maxDataRows) break;
      out.push(dataRow(row, index));
    }
    return out;
  };
  const nodeLabel = (node) => formatGroupLabel(columnOf(levels[node.level - 1]?.columnId), node.label, 'print', node.missing);

  const sections = [];
  let flat = null;
  if (!levels.length) {
    stats.tables += 1;
    flat = { id: 'flat', kind: 'FLAT', title: null, rows: rowsOf(viewModel.rows ?? []) };
  } else {
    const buildSection = (node) => {
      stats.sections += 1;
      drillTargets[node.id] = node.path;
      const section = { id: node.id, level: node.level, title: `${upper(node.columnLabel)}: ${upper(nodeLabel(node))}`, drill: node.id, sections: [], table: null, leafTotal: null };
      const subtotal = chipsRow(DOC_ROW_TYPES.SUBTOTAL, `${node.id}#subtotal`, `Subtotal ${nodeLabel(node)}`, node.aggregates, node.rowCount, node.level === levels.length);
      stats.subtotalRows += 1;
      stats.tables += 1;
      if (node.children?.length) {
        section.sections = node.children.map(buildSection);
        section.table = { id: `${node.id}#subtotal-table`, kind: 'SUBTOTAL', title: null, rows: [subtotal] };
      } else {
        section.table = { id: node.id, kind: 'SECTION', title: null, rows: [...rowsOf(node.rows), subtotal] };
      }
      return section;
    };
    sections.push(...(viewModel.tree ?? []).map(buildSection));
  }
  stats.grandRows += 1;
  stats.tables += 1;
  const grand = chipsRow(DOC_ROW_TYPES.GRAND_TOTAL, '#grand', 'Total geral', viewModel.totals, viewModel.rowCount);
  const grandTotal = { id: 'grand', kind: 'GRAND', title: null, rows: [grand] };
  const truncated = emitted < (viewModel.rows?.length ?? 0) ? { shown: emitted, total: viewModel.rows.length } : null;
  return { sections, flat, grandTotal, stats, drillTargets, truncated };
}

// ---------------------------------------------------------------------------
// Página: orientação, tamanho da fonte e larguras (estimadas pelo conteúdo)
// ---------------------------------------------------------------------------

function allRows(body) {
  const out = [];
  const walk = (section) => {
    if (section.table) out.push(...section.table.rows);
    section.sections.forEach(walk);
    if (section.leafTotal) out.push(...section.leafTotal.rows);
  };
  body.sections.forEach(walk);
  if (body.flat) out.push(...body.flat.rows);
  if (body.grandTotal) out.push(...body.grandTotal.rows);
  return out;
}

const longestWord = (text) => String(text ?? '').split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);

function summaryWidths(columns, rows, factor) {
  const pad = SHEET_PAGE.CELL_PADDING_PX;
  return columns.map((column, index) => {
    const texts = rows.filter((row) => row.cells).map((row) => row.cells[index]?.text ?? '');
    if (column.kind === 'label') {
      // O rótulo do subtotal ("Subtotal 02/06/2026 · Lotes: 3") quebra linha: não alarga a coluna.
      const labels = rows.filter((row) => row.cells && row.type !== 'SUBTOTAL').map((row) => row.cells[index]?.text ?? '');
      const widest = Math.max(longestWord(column.label) * CHAR_PX.header, ...labels.map((text) => Math.min(text.length, 34) * CHAR_PX.label));
      return Math.round(Math.min(SHEET_PAGE.LABEL_MAX_PX, Math.max(SHEET_PAGE.LABEL_MIN_PX, widest * factor + pad)));
    }
    const widest = Math.max(longestWord(column.label) * CHAR_PX.header, ...texts.map((text) => text.length * CHAR_PX.number));
    return Math.round(Math.max(SHEET_PAGE.METRIC_MIN_PX, widest * factor + pad));
  });
}

// Folga da página vai primeiro para o rótulo do subtotal caber numa linha (negrito ≈ 8% mais largo),
// até este teto; nunca tira largura das métricas e nunca muda o que cabe ou não na página.
const SUBTOTAL_LABEL_MAX_PX = 300;

function growLabelIntoSlack(columns, rows, widths, factor, limit) {
  const labelIndex = columns.findIndex((column) => column.kind === 'label');
  if (labelIndex < 0) return widths;
  const texts = rows.filter((row) => row.cells && row.type === 'SUBTOTAL').map((row) => row.cells[labelIndex]?.text ?? '');
  if (!texts.length) return widths;
  const need = Math.min(SUBTOTAL_LABEL_MAX_PX, Math.round(Math.max(...texts.map((text) => text.length)) * CHAR_PX.label * 1.08 * factor + SHEET_PAGE.CELL_PADDING_PX));
  const slack = limit - widths.reduce((sum, width) => sum + width, 0);
  if (need <= widths[labelIndex] || slack <= 0) return widths;
  const grown = [...widths];
  grown[labelIndex] += Math.min(need - widths[labelIndex], slack);
  return grown;
}

function detailWidths(columns, widths = {}) {
  return columns.map((column) => widths[column.key] || column.column?.defaultWidth || 120);
}

/**
 * Orientação e tamanho: "auto" tenta retrato, depois paisagem, reduzindo a fonte (8,5 → 7,6 → 6,8 pt);
 * retrato/paisagem escolhidos pela pessoa só reduzem a fonte. Se nada couber, avisa (nunca corta coluna).
 */
export function decideSheetLayout({ layout, columns, rows }, { orientation = 'auto', widths: userWidths = {} } = {}) {
  const orientations = orientation === 'auto' ? ['portrait', 'landscape'] : [orientation === 'landscape' ? 'landscape' : 'portrait'];
  const candidates = orientation === 'auto'
    ? [['portrait', 'm'], ['landscape', 'm'], ['landscape', 's'], ['landscape', 'xs']]
    : orientations.flatMap((item) => SHEET_PAGE.SIZES.map((size) => [item, size.id]));
  const factorOf = (sizeId) => SHEET_PAGE.SIZES.find((size) => size.id === sizeId).factor;
  const evaluate = ([pageOrientation, sizeId]) => {
    if (layout === 'detail') {
      const widths = detailWidths(columns, userWidths);
      const total = widths.reduce((sum, width) => sum + width, 0) * factorOf(sizeId);
      const limit = pageOrientation === 'landscape' ? SHEET_PAGE.DETAIL_LANDSCAPE_MAX : SHEET_PAGE.DETAIL_PORTRAIT_MAX;
      return { orientation: pageOrientation, sizeClass: sizeId, widths, totalWidth: Math.round(total), fits: total <= limit };
    }
    const base = summaryWidths(columns, rows, factorOf(sizeId));
    const total = base.reduce((sum, width) => sum + width, 0);
    const limit = pageOrientation === 'landscape' ? SHEET_PAGE.LANDSCAPE_WIDTH_PX : SHEET_PAGE.PORTRAIT_WIDTH_PX;
    const widths = total <= limit ? growLabelIntoSlack(columns, rows, base, factorOf(sizeId), limit) : base;
    return { orientation: pageOrientation, sizeClass: sizeId, widths, totalWidth: total, fits: total <= limit };
  };
  const tried = candidates.map(evaluate);
  const chosen = tried.find((item) => item.fits) ?? tried.at(-1);
  const landscapeFits = tried.some((item) => item.orientation === 'landscape' && item.fits) || (chosen.orientation === 'portrait' && evaluate(['landscape', 'm']).fits);
  const sum = chosen.widths.reduce((total, width) => total + width, 0) || 1;
  return {
    orientation: chosen.orientation,
    sizeClass: chosen.sizeClass,
    fits: chosen.fits,
    totalWidth: chosen.totalWidth,
    columnCount: columns.length,
    widths: chosen.widths,
    widthPercents: chosen.widths.map((width) => Number(((width / sum) * 100).toFixed(2))),
    warning: chosen.fits ? null : {
      code: 'PRINT_TOO_WIDE',
      message: 'Este relatório possui muitas colunas para impressão.',
      options: chosen.orientation === 'portrait' && landscapeFits ? ['paisagem', 'reduzir totais', 'exportar XLSX/CSV'] : ['reduzir totais', 'exportar XLSX/CSV'],
    },
  };
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

function gmdNote(viewModel, columns) {
  const gmdVisible = columns.some((column) => column.kind === 'metric' && column.op === 'weightedGmd');
  if (!gmdVisible || !viewModel.resolve) return null;
  const withPrevious = viewModel.resolve('animais_com_anterior');
  const animalColumnId = viewModel.animalColumnId ?? 'numero_animal';
  if (!withPrevious || !viewModel.resolve(animalColumnId)) return null;
  const totals = computeAggregates(viewModel.rows ?? [], [
    { id: 'n', op: 'countDistinct', columnId: 'animais_com_anterior' },
    { id: 'm', op: 'countDistinct', columnId: animalColumnId },
  ], viewModel.resolve);
  const n = totals.n?.value ?? 0;
  const m = totals.m?.value ?? 0;
  if (!m) return null;
  // Um animal entra na conta se tem ao menos uma pesagem com anterior; a pesagem sem anterior fica fora.
  return `GMD calculado com ${n} de ${m} animais: onde não há pesagem anterior aparece "—" (nunca 0,000), fora da média.`;
}

/**
 * @param viewModel resultado de runReport (Resumido → folha resumida; Detalhado → folha com linhas)
 * @param {{ header?: object|null, orientation?: 'auto'|'portrait'|'landscape', showEmptyColumns?: boolean,
 *   maxDataRows?: number }} options header = buildPropertyHeader(...) (ou null → só o nome do sistema)
 */
export function buildReportDocument(viewModel, { header = null, orientation = 'auto', showEmptyColumns = false, maxDataRows = Infinity, widths = {} } = {}) {
  const summary = viewModel.mode === REPORT_MODES.RESUMIDO;
  const levels = (viewModel.groups ?? []).map((level) => ({ columnId: level.columnId, label: level.label }));
  const allColumns = summary ? summaryColumns(viewModel) : detailColumns(viewModel);
  const hasRows = (viewModel.rowCount ?? 0) > 0;
  const isEmptyColumn = (column) => {
    if (!hasRows || showEmptyColumns || column.kind === 'label') return false;
    if (summary) return metricIsEmpty(column, viewModel.totals);
    return (viewModel.rows ?? []).every((row) => formatCell(column.column, dataCellRaw(viewModel, column.column, row), 'print') === MISSING_SCREEN);
  };
  const hiddenColumns = allColumns.filter(isEmptyColumn).map((column) => ({ key: column.key, label: column.label }));
  const hiddenKeys = new Set(hiddenColumns.map((column) => column.key));
  const columns = allColumns.filter((column) => !hiddenKeys.has(column.key)).map((column, index) => ({ ...column, index }));

  const body = summary ? buildSummaryBody(viewModel, columns) : buildDetailBody(viewModel, columns, { maxDataRows });
  const print = decideSheetLayout({ layout: summary ? 'summary' : 'detail', columns, rows: allRows(body) }, { orientation, widths });

  // Detalhado: os totais em texto também podem estar em @ (Média @, Total @) — o rodapé explica o divisor.
  const usesArroba = columns.some((column) => column.unit === '@' || column.column?.unit === '@' || column.metric?.column?.unit === '@')
    || (!summary && hasRows && (viewModel.aggregates ?? []).length > 0 && summaryMetrics(viewModel).some((metric) => metric.column?.unit === '@'));
  const divisor = viewModel.arrobaDivisor ?? 30;
  const notes = [...(viewModel.notes ?? [])];
  const gmd = summary ? gmdNote(viewModel, columns) : null;
  if (gmd) notes.push(gmd);
  if (hiddenColumns.length) notes.push(`Sem nenhum valor no relatório (colunas ocultas): ${hiddenColumns.map((column) => column.label).join(', ')}.`);
  if (viewModel.hiddenByPermission?.length) notes.push(`${viewModel.hiddenByPermission.length} coluna(s) omitida(s) pelo perfil de quem emitiu.`);
  if (body.truncated) notes.push(`Na tela aparecem ${body.truncated.shown.toLocaleString('pt-BR')} de ${body.truncated.total.toLocaleString('pt-BR')} linhas; a impressão e o PDF levam todas.`);
  notes.push('Ausentes aparecem como “—” e não entram em médias e somas. Totais recalculados sobre a população de cada grupo.');

  const emitted = formatEmittedAt(viewModel.generatedAt);
  const emitter = viewModel.emittedBy?.nome ?? viewModel.emittedBy?.id ?? '—';
  const periodText = viewModel.period ? `Período: ${brDate(viewModel.period.from)} a ${brDate(viewModel.period.to)}` : 'Estado atual (hoje)';
  const footer = {
    filtros: `Filtros: ${describeReportFilters(viewModel)}`,
    arroba: usesArroba ? `@ = peso vivo ÷ ${divisor}` : null,
    emitidoPor: `Emitido por ${emitter} em ${emitted}`,
    versao: `Pesagens Individuais v${viewModel.appVersion ?? ''}`,
    emissao: `Emissão ${String(viewModel.emissionId ?? '').slice(0, 8)}`,
  };
  return {
    kind: DOCUMENT_KIND,
    version: 1,
    mode: viewModel.mode,
    layout: summary ? 'summary' : 'detail',
    reportId: viewModel.reportId,
    title: `Relatório de ${viewModel.reportName} (${summary ? 'Sintético' : 'Analítico'})`,
    subtitle: `${summary ? 'Resumido' : 'Detalhado'}${levels.length ? ` · ${levels.map((level) => level.label).join(' › ')}` : ''}`,
    header: header ?? null,
    periodText,
    emittedText: `Emitido em ${emitted}`,
    levels,
    columns,
    hiddenColumns,
    sections: body.sections,
    flat: body.flat,
    grandTotal: body.grandTotal,
    drillTargets: body.drillTargets,
    truncated: body.truncated ?? null,
    empty: !hasRows,
    notes,
    footer,
    pageFooter: `${footer.versao} · ${footer.emissao} · ${viewModel.reportName ?? ''}`,
    print,
    stats: body.stats,
  };
}

/** Todas as linhas do documento (na ordem da folha) — base dos gates de alinhamento e de totais. */
export function documentRows(doc) {
  return allRows({ sections: doc.sections, flat: doc.flat, grandTotal: doc.grandTotal });
}
