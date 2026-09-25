// Documento de impressão/PDF (docs/reporting/EXPORT-CONTRACT.md §impressão). HTML autossuficiente,
// sem script, gerado do MESMO view model da tela (nenhuma conta nova): cabeçalho com sistema,
// relatório, organização, período, filtros e emissão; tabela com cabeçalho repetido por página;
// grupos, subtotais e total geral; rodapé com página X de Y, emissão e versão.
import { describeFilter } from '../../domain/filterEngine.js';
import { describePeriod } from '../../domain/reportPeriod.js';
import { buildReportLines, isSummaryMode } from './reportLayout.js';

export const PRINT_LIMITS = Object.freeze({
  PORTRAIT_MAX_COLUMNS: 8,
  PORTRAIT_MAX_WIDTH: 1000, // soma das larguras (px de tela) que cabe em A4 retrato a 8,5 pt
  LANDSCAPE_MAX_WIDTH: 1520, // idem A4 paisagem
  // Resumido (E1): larguras estimadas pelo conteúdo, em px impressos (96 dpi) a 8,5 pt. Área útil do
  // A4 com as margens do documento (10 mm de cada lado): 190 mm em retrato, 277 mm em paisagem.
  SUMMARY_PORTRAIT_WIDTH_PX: 718,
  SUMMARY_LANDSCAPE_WIDTH_PX: 1047,
  SUMMARY_CELL_PADDING_PX: 11, // 1,4 mm de cada lado
  SUMMARY_LABEL_MIN_PX: 60,
  SUMMARY_LABEL_MAX_PX: 200, // rótulo maior quebra linha (nunca é cortado)
  SUMMARY_METRIC_MIN_PX: 44,
});

// Largura média de caractere (px) em Arial: 8,5 pt ≈ 11,3 px; negrito e algarismos ≈ 0,55 em.
const CHAR_PX = Object.freeze({ label: 6.2, number: 6.4, header: 6.0 });
const longestWord = (text) => String(text ?? '').split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
const textLength = (text) => String(text ?? '').length;

/**
 * Larguras (px impressos) das colunas do Resumido pelo conteúdo: rótulo de grupo (quebra acima do
 * máximo), métrica = maior entre a palavra mais longa do cabeçalho (o cabeçalho quebra entre
 * palavras) e o maior número já formatado (número nunca quebra nem é cortado).
 */
export function summaryColumnWidths(summary) {
  const pad = PRINT_LIMITS.SUMMARY_CELL_PADDING_PX;
  const groupCount = summary.groupHeaders.length;
  return summary.headers.map((header, index) => {
    const cells = summary.rows.map((row) => row.cells[index]);
    if (index < groupCount) {
      const widest = Math.max(longestWord(header) * CHAR_PX.header, ...cells.map((cell) => textLength(cell) * CHAR_PX.label));
      return Math.round(Math.min(PRINT_LIMITS.SUMMARY_LABEL_MAX_PX, Math.max(PRINT_LIMITS.SUMMARY_LABEL_MIN_PX, widest + pad)));
    }
    const widest = Math.max(longestWord(header) * CHAR_PX.header, ...cells.map((cell) => textLength(cell) * CHAR_PX.number));
    return Math.round(Math.max(PRINT_LIMITS.SUMMARY_METRIC_MIN_PX, widest + pad));
  });
}

/** Orientação do Resumido: retrato sempre que couber (E1 §1.8: "Resumido cabe em A4 retrato"). */
export function decideSummaryPrintLayout(summary, { orientation = 'auto' } = {}) {
  const widths = summaryColumnWidths(summary);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const count = widths.length;
  const fitsPortrait = totalWidth <= PRINT_LIMITS.SUMMARY_PORTRAIT_WIDTH_PX;
  const fitsLandscape = totalWidth <= PRINT_LIMITS.SUMMARY_LANDSCAPE_WIDTH_PX;
  const chosen = orientation === 'auto' ? (fitsPortrait ? 'portrait' : 'landscape') : orientation;
  const fits = chosen === 'portrait' ? fitsPortrait : fitsLandscape;
  return {
    orientation: chosen,
    fits,
    totalWidth,
    columnCount: count,
    widths,
    warning: fits ? null : {
      code: 'PRINT_TOO_WIDE',
      message: 'Este relatório possui muitas colunas para impressão.',
      options: chosen === 'portrait' && fitsLandscape ? ['paisagem', 'reduzir totais', 'exportar XLSX/CSV'] : ['reduzir totais', 'exportar XLSX/CSV'],
    },
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Orientação: retrato até 8 colunas que caibam; senão paisagem. Se nem paisagem couber, avisa
 * (nunca esconde coluna em silêncio) e sugere reduzir colunas ou exportar CSV/XLSX.
 */
export function decidePrintLayout(viewModel, { orientation = 'auto', widths = {} } = {}) {
  const totalWidth = viewModel.columns.reduce((sum, column) => sum + (widths[column.id] || column.defaultWidth || 120), 0);
  const count = viewModel.columns.length;
  const fitsPortrait = count <= PRINT_LIMITS.PORTRAIT_MAX_COLUMNS && totalWidth <= PRINT_LIMITS.PORTRAIT_MAX_WIDTH;
  const fitsLandscape = totalWidth <= PRINT_LIMITS.LANDSCAPE_MAX_WIDTH;
  const chosen = orientation === 'auto' ? (fitsPortrait ? 'portrait' : 'landscape') : orientation;
  const fits = chosen === 'portrait' ? fitsPortrait : fitsLandscape;
  return {
    orientation: chosen,
    fits,
    totalWidth,
    columnCount: count,
    warning: fits ? null : {
      code: 'PRINT_TOO_WIDE',
      message: 'Este relatório possui muitas colunas para impressão.',
      options: chosen === 'portrait' && fitsLandscape ? ['paisagem', 'reduzir colunas', 'exportar XLSX/CSV'] : ['reduzir colunas', 'exportar XLSX/CSV'],
    },
  };
}

export function describeFilters(viewModel) {
  const columnOf = (columnId) => viewModel.availableColumns.find((column) => column.id === columnId) ?? null;
  const label = (columnId) => columnOf(columnId)?.label ?? columnId;
  const parts = [
    ...Object.entries(viewModel.lockedFilters || {}).map(([id, filter]) => `${label(id)} ${describeFilter(filter, columnOf(id))} (fixo)`),
    ...Object.entries(viewModel.filters || {}).map(([id, filter]) => `${label(id)} ${describeFilter(filter, columnOf(id))}`),
    ...(viewModel.drill || []).map((part) => `${part.columnLabel ?? label(part.columnId)} = ${part.label ?? part.key} (detalhe do grupo)`),
  ];
  if (viewModel.search) parts.push(`pesquisa “${viewModel.search}”`);
  return parts.length ? parts.join(' · ') : 'Nenhum';
}

function formatEmittedAt(iso) {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function footerText(viewModel) {
  return `Pesagens Individuais ${viewModel.appVersion} · Emissão ${String(viewModel.emissionId).slice(0, 8)} · ${viewModel.reportName}`;
}

/** Resumido: uma linha por grupo (rótulo na coluna do próprio nível) + Total geral. */
function buildSummaryTable(viewModel, options) {
  const { headers, lines, summary } = buildReportLines(viewModel, 'print');
  const layout = decideSummaryPrintLayout(summary, options);
  const groupCount = summary.groupHeaders.length;
  const widthSum = layout.widths.reduce((sum, width) => sum + width, 0) || 1;
  const stats = { dataRows: 0, groupRows: 0, subtotalRows: 0, totalRows: 0, summaryRows: 0 };
  const body = lines.map((line) => {
    const grand = line.type === 'GRAND_TOTAL';
    if (grand) stats.totalRows += 1; else { stats.summaryRows += 1; stats.groupRows += 1; }
    const cells = line.cells.map((cell, index) => `<td class="${index >= groupCount ? 'num' : `lbl${index === line.level - 1 ? ' own' : ''}`}">${escapeHtml(cell)}</td>`).join('');
    return `<tr class="${grand ? 'grand sumtotal' : `sum lvl${line.level}`}">${cells}</tr>`;
  });
  const table = `<table class="summary">
  <colgroup>${layout.widths.map((width) => `<col style="width:${((width / widthSum) * 100).toFixed(2)}%">`).join('')}</colgroup>
  <thead><tr>${headers.map((header, index) => `<th class="${index >= groupCount ? 'num' : ''}">${escapeHtml(header)}</th>`).join('')}</tr></thead>
  <tbody>
${body.join('\n')}
  </tbody>
</table>`;
  return { table, layout, stats };
}

/** Detalhado: grupos, linhas de dados, subtotais e total geral (como até a 1.3.x). */
function buildDetailedTable(viewModel, options) {
  const layout = decidePrintLayout(viewModel, options);
  const { headers, lines } = buildReportLines(viewModel, 'print');
  const columns = viewModel.columns;
  const colWidths = columns.map((column) => options.widths?.[column.id] || column.defaultWidth || 120);
  const widthSum = colWidths.reduce((sum, width) => sum + width, 0) || 1;
  const stats = { dataRows: 0, groupRows: 0, subtotalRows: 0, totalRows: 0 };
  const body = [];
  let pendingTotals = null;
  const flushTotals = () => {
    if (!pendingTotals) return;
    const { type, level, group, items } = pendingTotals;
    const chips = items.map((item) => `<span class="chip">${escapeHtml(item.metric)}: <b>${escapeHtml(item.value)}</b>${item.nMissing > 0 && !['count', 'countDistinct'].includes(item.spec.op) ? ` <i>(${item.nValid} de ${item.nValid + item.nMissing})</i>` : ''}</span>`).join('');
    const title = type === 'GRAND_TOTAL' ? 'Total geral' : `Subtotal · ${escapeHtml(group.split(' > ').at(-1))}`;
    body.push(`<tr class="${type === 'GRAND_TOTAL' ? 'grand' : `subtotal lvl${level}`}"><td colspan="${columns.length}"><span class="tl">${title}</span>${chips}</td></tr>`);
    if (type === 'GRAND_TOTAL') stats.totalRows += 1; else stats.subtotalRows += 1;
    pendingTotals = null;
  };
  for (const line of lines) {
    if (line.type === 'SUBTOTAL' || line.type === 'GRAND_TOTAL') {
      if (pendingTotals && (pendingTotals.type !== line.type || pendingTotals.group !== line.group || pendingTotals.level !== line.level)) flushTotals();
      if (!pendingTotals) pendingTotals = { type: line.type, level: line.level, group: line.group, items: [] };
      pendingTotals.items.push(line);
      continue;
    }
    flushTotals();
    if (line.type === 'GROUP') {
      body.push(`<tr class="group lvl${line.level}"><td colspan="${columns.length}">${escapeHtml(line.label)} <span class="count">${line.rowCount} registro(s)</span></td></tr>`);
      stats.groupRows += 1;
    } else {
      body.push(`<tr class="data">${line.cells.map((cell, index) => `<td class="${columns[index].align === 'right' ? 'num' : ''}">${escapeHtml(cell)}</td>`).join('')}</tr>`);
      stats.dataRows += 1;
    }
  }
  flushTotals();
  if (!viewModel.aggregates.length) {
    body.push(`<tr class="grand"><td colspan="${columns.length}"><span class="tl">Total geral</span><span class="chip">Registros: <b>${viewModel.rowCount}</b></span></td></tr>`);
    stats.totalRows += 1;
  }
  const table = `<table>
  <colgroup>${colWidths.map((width) => `<col style="width:${((width / widthSum) * 100).toFixed(2)}%">`).join('')}</colgroup>
  <thead><tr>${headers.map((header, index) => `<th class="${columns[index].align === 'right' ? 'num' : ''}">${escapeHtml(header)}</th>`).join('')}</tr></thead>
  <tbody>
${body.join('\n')}
  </tbody>
</table>`;
  return { table, layout, stats };
}

/**
 * @param viewModel resultado de runReport
 * @param {{ orientation?: 'auto'|'portrait'|'landscape', widths?: object, organization?: string, pageNumbersInCss?: boolean }} options
 * @returns {{ html: string, layout: object, stats: object }}
 */
export function buildPrintDocument(viewModel, options = {}) {
  const summary = isSummaryMode(viewModel);
  const { table, layout, stats } = summary ? buildSummaryTable(viewModel, options) : buildDetailedTable(viewModel, options);
  const size = layout.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const periodText = viewModel.period ? describePeriod(viewModel.period) : 'Sem período (estado atual)';
  const emitted = `${formatEmittedAt(viewModel.generatedAt)} por ${viewModel.emittedBy.nome ?? viewModel.emittedBy.id ?? '—'} (${viewModel.emittedBy.role})`;
  const pageCounter = options.pageNumbersInCss === false ? '' : `@page { @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Arial, sans-serif; color: #555; } @bottom-left { content: "${escapeHtml(footerText(viewModel)).replace(/"/g, '\\"')}"; font: 7.5pt Arial, sans-serif; color: #555; } }`;
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(viewModel.reportName)}</title>
<style>
@page { size: ${size}; margin: 12mm 10mm 14mm 10mm; }
${pageCounter}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; font: 8.5pt Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.doc-header { display: grid; grid-template-columns: 1fr auto; gap: 2mm 6mm; padding-bottom: 2.5mm; margin-bottom: 3mm; border-bottom: 1.2pt solid #0f5132; }
.doc-header h1 { margin: 0; font-size: 13pt; }
.doc-header .system { font-size: 7.5pt; color: #0f5132; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
.doc-header dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: .6mm 3mm; font-size: 7.8pt; }
.doc-header dt { color: #555; font-weight: 700; }
.doc-header dd { margin: 0; }
.doc-header .right { text-align: right; font-size: 7.8pt; color: #333; }
.legacy { display: inline-block; margin-top: 1mm; padding: .3mm 2mm; border: .6pt solid #b26a00; color: #8a5300; font-weight: 700; font-size: 7pt; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
th { background: #eef2f5; border-bottom: .8pt solid #666; padding: 1.2mm 1.4mm; text-align: left; font-size: 7.6pt; font-weight: 700; overflow-wrap: anywhere; }
th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; overflow-wrap: normal; }
td { padding: .9mm 1.4mm; border-bottom: .3pt solid #d8dde3; vertical-align: top; overflow-wrap: anywhere; white-space: normal; }
tr { page-break-inside: avoid; break-inside: avoid; }
tr.data:nth-child(even) td { background: #fafbfc; }
tr.group td { background: #e7edf2; font-weight: 700; border-top: .6pt solid #9aa7b3; white-space: normal; }
tr.group.lvl2 td { background: #eff3f6; padding-left: 5mm; }
tr.group.lvl3 td { background: #f5f7f9; padding-left: 9mm; }
tr.group .count { font-weight: 400; color: #555; margin-left: 3mm; }
tr.subtotal td { background: #eef7f1; color: #0f3d22; white-space: normal; border-bottom: .6pt solid #9cc5ad; }
tr.subtotal.lvl2 td { padding-left: 5mm; } tr.subtotal.lvl3 td { padding-left: 9mm; }
tr.grand td { background: #dff0e5; color: #0b3b1f; white-space: normal; border-top: 1.6pt double #0f5132; border-bottom: 1pt solid #0f5132; }
.tl { font-weight: 700; margin-right: 3mm; text-transform: none; }
tr.grand .tl { text-transform: uppercase; letter-spacing: .04em; }
.chip { display: inline-block; margin-right: 3.5mm; white-space: nowrap; }
.chip i { font-style: normal; color: #555; }
.notes { margin: 2mm 0 0; padding-left: 4mm; font-size: 7pt; color: #444; }
.doc-end { margin-top: 3mm; font-size: 7pt; color: #555; }
table.summary th { white-space: normal; overflow-wrap: normal; word-break: normal; vertical-align: bottom; }
table.summary td.lbl { white-space: normal; overflow-wrap: anywhere; }
table.summary td.num { white-space: nowrap; }
tr.sum:nth-child(even) td { background: #fafbfc; }
tr.sum.lvl1 td { font-weight: 700; border-top: .5pt solid #b7c2cc; }
tr.sum.lvl2 td.own { padding-left: 4mm; }
tr.sum.lvl3 td.own { padding-left: 7mm; }
tr.sumtotal td { font-weight: 700; }
</style>
</head>
<body>
<header class="doc-header">
  <div>
    <div class="system">Pesagens Individuais${options.organization ? ` · ${escapeHtml(options.organization)}` : ''}</div>
    <h1>${escapeHtml(viewModel.reportName)}</h1>
    <dl>
      <dt>Período</dt><dd>${escapeHtml(periodText)}</dd>
      <dt>Grão</dt><dd>${escapeHtml(viewModel.grainLabel)}</dd>
      <dt>Filtros</dt><dd>${escapeHtml(describeFilters(viewModel))}</dd>
      ${viewModel.groups.length ? `<dt>Agrupado por</dt><dd>${escapeHtml(viewModel.groups.map((group) => group.label).join(' › '))}</dd>` : ''}
      <dt>Modo</dt><dd>${summary ? 'Resumido (uma linha por grupo)' : 'Detalhado'}</dd>
    </dl>
    ${viewModel.classification && viewModel.classification !== 'CANÔNICO' ? `<span class="legacy">${escapeHtml(viewModel.classification)}</span>` : ''}
  </div>
  <div class="right">
    <div>Emitido em ${escapeHtml(emitted)}</div>
    <div>Registros: ${viewModel.rowCount}${viewModel.uniqueAnimalCount !== null ? ` · Animais únicos: ${viewModel.uniqueAnimalCount}` : ''}</div>
    <div>Versão ${escapeHtml(viewModel.appVersion)} · esquema ${escapeHtml(viewModel.schemaVersion)}</div>
    <div>Emissão ${escapeHtml(String(viewModel.emissionId).slice(0, 8))}</div>
  </div>
</header>
${table}
${(viewModel.notes || []).length ? `<ul class="notes">${viewModel.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
${viewModel.hiddenByPermission?.length ? `<p class="doc-end">${viewModel.hiddenByPermission.length} coluna(s) omitida(s) pelo perfil do emissor.</p>` : ''}
<p class="doc-end">Ausentes são exibidos como “—” e não entram em médias e somas. Total geral recalculado sobre toda a população filtrada.</p>
</body>
</html>`;
  return { html, layout, stats };
}
