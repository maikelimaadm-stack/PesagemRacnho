// Documento de impressão/PDF (docs/reporting/EXPORT-CONTRACT.md §impressão). E1B (1.4.0): é a FOLHA do
// relatório — o mesmo documento (domain/reportDocument) e o mesmo renderizador (sheetHtml) da tela, em
// HTML autossuficiente, sem script: cabeçalho da propriedade (com logo) e rodapé que se repetem em todas
// as páginas, seções por nível, subtotais, "TOTAL POR", total geral e "Página X de Y" (margem do
// @page — o mesmo mecanismo na impressão, no PDF e no iframe de desenvolvimento). E1D item 8: sem notas e
// sem versão/código da emissão na margem (a emissão continua no manifesto do arquivo).
import { buildReportDocument, describeReportFilters, SHEET_PAGE } from '../../domain/reportDocument.js';
import { SYSTEM_NAME } from '../../../catalog/domain/propertyHeader.js';
import { SHEET_CSS, pageCss } from './sheetStyles.js';
import { escapeHtml, renderSheetBody } from './sheetHtml.js';

export { escapeHtml };

/** Largura útil do A4 com margens de 10 mm, em px impressos (base da escolha retrato/paisagem). */
export const PRINT_LIMITS = Object.freeze({
  PORTRAIT_WIDTH_PX: SHEET_PAGE.PORTRAIT_WIDTH_PX,
  LANDSCAPE_WIDTH_PX: SHEET_PAGE.LANDSCAPE_WIDTH_PX,
  MARGIN_MM: 10,
});

// A CSP do documento: nada externo, só o próprio CSS e imagem embutida (logo em data URL validado).
export const PRINT_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

/** Filtros aplicados em texto (também usado no cabeçalho do XLSX). */
export const describeFilters = describeReportFilters;

export function footerText(viewModel) {
  return `Pesagens Individuais ${viewModel.appVersion} · Emissão ${String(viewModel.emissionId).slice(0, 8)} · ${viewModel.reportName}`;
}

/** Cabeçalho mínimo quando só se conhece o nome da organização (compatibilidade com a E1). */
function organizationHeader(organization) {
  return { empty: false, propriedadeId: null, logo: null, titular: organization, fazenda: null, endereco: null, documentos: null, telefone: null };
}

/**
 * @param viewModel resultado de runReport
 * @param {{ orientation?: 'auto'|'portrait'|'landscape', header?: object|null, organization?: string,
 *   showEmptyColumns?: boolean, widths?: object }} options header = buildPropertyHeader(...) já resolvido
 * @returns {{ html: string, layout: object, stats: object, document: object }}
 */
export function buildPrintDocument(viewModel, options = {}) {
  const header = options.header ?? (options.organization ? organizationHeader(options.organization) : null);
  const doc = buildReportDocument(viewModel, {
    header,
    orientation: options.orientation ?? 'auto',
    showEmptyColumns: Boolean(options.showEmptyColumns),
    widths: options.widths ?? {},
  });
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">
<title>${escapeHtml(doc.title)}</title>
<style>
${SHEET_CSS}
${pageCss({ orientation: doc.print.orientation })}
</style>
</head>
<body>
${renderSheetBody(doc, { mode: 'print' })}
</body>
</html>`;
  const layout = {
    orientation: doc.print.orientation,
    fits: doc.print.fits,
    sizeClass: doc.print.sizeClass,
    columnCount: doc.print.columnCount,
    totalWidth: doc.print.totalWidth,
    widths: doc.print.widths,
    warning: doc.print.warning,
  };
  const stats = { ...doc.stats, summaryRows: doc.layout === 'summary' ? doc.stats.groupRows : 0 };
  return { html, layout, stats, document: doc, systemName: SYSTEM_NAME };
}
