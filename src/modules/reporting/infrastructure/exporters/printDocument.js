// Documento de impressão/PDF (docs/reporting/EXPORT-CONTRACT.md §impressão). HTML autossuficiente,
// sem script, gerado do MESMO view model da tela (nenhuma conta nova): cabeçalho com sistema,
// relatório, organização, período, filtros e emissão; tabela com cabeçalho repetido por página;
// grupos, subtotais e total geral; rodapé com página X de Y, emissão e versão.
import { describePeriod } from '../../domain/reportPeriod.js';
import { buildReportLines } from './reportLayout.js';

export const PRINT_LIMITS = Object.freeze({
  PORTRAIT_MAX_COLUMNS: 8,
  PORTRAIT_MAX_WIDTH: 1000, // soma das larguras (px de tela) que cabe em A4 retrato a 8,5 pt
  LANDSCAPE_MAX_WIDTH: 1520, // idem A4 paisagem
});

const OPERATOR_LABELS = {
  contains: 'contém', not_contains: 'não contém', equals: '=', not_equals: '≠', starts_with: 'começa com', ends_with: 'termina com',
  greater: '>', greater_equal: '≥', less: '<', less_equal: '≤', between: 'entre', not_between: 'fora de', in: 'em', not_in: 'fora de',
  empty: 'vazio', not_empty: 'preenchido', before: 'antes de', after: 'depois de', on_or_before: 'até', on_or_after: 'a partir de',
};

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

function describeFilters(viewModel) {
  const label = (columnId) => viewModel.availableColumns.find((column) => column.id === columnId)?.label ?? columnId;
  const text = (filter) => {
    if (filter.values?.length) return `${OPERATOR_LABELS[filter.operator] ?? 'em'} ${filter.values.join(', ')}`;
    if (['empty', 'not_empty'].includes(filter.operator)) return OPERATOR_LABELS[filter.operator];
    if (filter.valueTo) return `${OPERATOR_LABELS[filter.operator] ?? ''} ${filter.value} e ${filter.valueTo}`;
    return `${OPERATOR_LABELS[filter.operator] ?? filter.operator ?? ''} ${filter.value}`;
  };
  const parts = [
    ...Object.entries(viewModel.lockedFilters || {}).map(([id, filter]) => `${label(id)} ${text(filter)} (fixo)`),
    ...Object.entries(viewModel.filters || {}).map(([id, filter]) => `${label(id)} ${text(filter)}`),
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

/**
 * @param viewModel resultado de runReport
 * @param {{ orientation?: 'auto'|'portrait'|'landscape', widths?: object, organization?: string, pageNumbersInCss?: boolean }} options
 * @returns {{ html: string, layout: object, stats: { dataRows: number, groupRows: number, subtotalRows: number, totalRows: number } }}
 */
export function buildPrintDocument(viewModel, options = {}) {
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
th { background: #eef2f5; border-bottom: .8pt solid #666; padding: 1.2mm 1.4mm; text-align: left; font-size: 7.6pt; font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
td { padding: .9mm 1.4mm; border-bottom: .3pt solid #d8dde3; vertical-align: top; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
<table>
  <colgroup>${colWidths.map((width) => `<col style="width:${((width / widthSum) * 100).toFixed(2)}%">`).join('')}</colgroup>
  <thead><tr>${headers.map((header, index) => `<th class="${columns[index].align === 'right' ? 'num' : ''}">${escapeHtml(header)}</th>`).join('')}</tr></thead>
  <tbody>
${body.join('\n')}
  </tbody>
</table>
${(viewModel.notes || []).length ? `<ul class="notes">${viewModel.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
${viewModel.hiddenByPermission?.length ? `<p class="doc-end">${viewModel.hiddenByPermission.length} coluna(s) omitida(s) pelo perfil do emissor.</p>` : ''}
<p class="doc-end">Ausentes são exibidos como “—” e não entram em médias e somas. Total geral recalculado sobre toda a população filtrada.</p>
</body>
</html>`;
  return { html, layout, stats };
}
