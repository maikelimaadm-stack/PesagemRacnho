// CSS ÚNICO da folha do relatório (E1B 1.4.0): a MESMA marcação e o MESMO estilo na tela (pré-visualização
// em papel), na impressão e no PDF. Tudo sob `.rpt-sheet` para não herdar nem vazar regras do app.
// Medidas em mm/pt (papel A4, margens de 10 mm). Números em fonte monoespaçada, alinhados à direita.
// A folha é sempre "papel branco", também no tema escuro (é a pré-visualização do que sai na impressora).

export const SHEET_CSS = `
.rpt-sheet { --sheet-text: #1f2328; --sheet-muted: #6b7280; --sheet-line: #d8dde3; --sheet-strong-line: #9aa3ad; --sheet-head: #f3f4f6; --sheet-sub: #f6f8fa; --sheet-total: #eef7f1; --sheet-total-text: #0b3b1f; --sheet-accent: #0f5132;
  background: #fff; color: var(--sheet-text); font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; line-height: 1.25; text-align: left; box-sizing: border-box; }
.rpt-sheet *, .rpt-sheet *::before, .rpt-sheet *::after { box-sizing: border-box; }
.rpt-sheet.sheet-size-s { font-size: 7.6pt; }
.rpt-sheet.sheet-size-xs { font-size: 6.8pt; }
.rpt-sheet table { border-collapse: collapse; }
.rpt-sheet .sheet-page { width: 100%; }
.rpt-sheet .sheet-page > thead { display: table-header-group; }
.rpt-sheet .sheet-page > tfoot { display: table-footer-group; }
.rpt-sheet .sheet-page > thead > tr > td, .rpt-sheet .sheet-page > tfoot > tr > td, .rpt-sheet .sheet-page > tbody > tr > td { padding: 0; border: 0; background: none; vertical-align: top; }
.rpt-sheet .sheet-page > tbody > tr { break-inside: auto; page-break-inside: auto; }

.rpt-sheet .sheet-header { display: grid; grid-template-columns: 46mm minmax(0, 1fr) 46mm; align-items: center; gap: 3mm; padding-bottom: 2mm; }
.rpt-sheet .sheet-header__logo { display: flex; align-items: center; justify-content: flex-start; min-height: 12mm; }
.rpt-sheet .sheet-logo { display: block; max-width: 32mm; max-height: 16mm; width: auto; height: auto; object-fit: contain; }
.rpt-sheet .sheet-header__id { text-align: center; min-width: 0; }
.rpt-sheet .sheet-titular { font-size: 1.35em; font-weight: 700; letter-spacing: .01em; overflow-wrap: anywhere; }
.rpt-sheet .sheet-fazenda, .rpt-sheet .sheet-endereco, .rpt-sheet .sheet-docs { font-size: .95em; overflow-wrap: anywhere; }
.rpt-sheet .sheet-header--system .sheet-titular { font-size: 1.2em; color: var(--sheet-accent); text-transform: uppercase; letter-spacing: .06em; }
.rpt-sheet .sheet-header__meta { text-align: right; font-size: .86em; color: var(--sheet-muted); white-space: nowrap; }
.rpt-sheet .sheet-header__meta div + div { margin-top: .6mm; }

.rpt-sheet .sheet-title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; border-bottom: 1.4pt solid var(--sheet-text); padding-bottom: 1mm; margin: 1mm 0 2.5mm; }
.rpt-sheet .sheet-title { margin: 0; font-size: 1.3em; font-weight: 700; }
.rpt-sheet .sheet-title-side { font-size: .86em; color: var(--sheet-muted); text-align: right; }

.rpt-sheet .sheet-sec-title { margin: 0; font-weight: 700; text-transform: uppercase; break-after: avoid; page-break-after: avoid; }
.rpt-sheet .sheet-sec-title--1 { font-size: 1.1em; margin: 3.5mm 0 1.5mm; padding-bottom: .8mm; border-bottom: .6pt solid var(--sheet-line); }
.rpt-sheet .sheet-sec-title--2 { font-size: .95em; color: #374151; margin: 2.5mm 0 1.2mm; }
.rpt-sheet .sheet-sec-title--3 { font-size: .9em; color: #4b5563; margin: 2mm 0 1mm; }
.rpt-sheet .sheet-sec-title--total { font-size: .95em; margin: 3mm 0 1.2mm; }
.rpt-sheet .sheet-sec--1:first-child > .sheet-sec-title--1 { margin-top: 1mm; }
.rpt-sheet .sheet-sec--1.sheet-keep { break-inside: avoid; page-break-inside: avoid; }

.rpt-sheet .sheet-table { width: 100%; table-layout: fixed; margin: 0 0 1mm; }
.rpt-sheet .sheet-table > thead { display: table-header-group; }
.rpt-sheet .sheet-table tr { break-inside: avoid; page-break-inside: avoid; }
.rpt-sheet .sheet-table th { background: var(--sheet-head); color: #374151; font-weight: 700; font-size: .88em; text-align: right; vertical-align: bottom; padding: 1.1mm 1.1mm; border-bottom: .7pt solid var(--sheet-strong-line); white-space: normal; overflow-wrap: normal; word-break: normal; hyphens: none; }
.rpt-sheet .sheet-table td { padding: .85mm 1.1mm; border-bottom: .3pt solid var(--sheet-line); vertical-align: top; text-align: right; }
.rpt-sheet .sheet-table .lbl { text-align: left; overflow-wrap: anywhere; }
.rpt-sheet .sheet-table .num { font-family: Consolas, "Courier New", monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rpt-sheet .sheet-table .txt { text-align: left; overflow-wrap: anywhere; }
.rpt-sheet .sheet-table tbody tr.sheet-row:nth-child(even) td { background: #fafbfc; }
.rpt-sheet .sheet-table tr.sheet-subtotal td { background: var(--sheet-sub); font-weight: 700; border-top: .6pt solid var(--sheet-strong-line); border-bottom: .6pt solid var(--sheet-strong-line); }
.rpt-sheet .sheet-table tr.sheet-total td { background: var(--sheet-total); color: var(--sheet-total-text); font-weight: 700; border-top: .8pt solid var(--sheet-accent); }
.rpt-sheet .sheet-table tr.sheet-grand td { background: var(--sheet-total); color: var(--sheet-total-text); font-weight: 700; border-top: 1.6pt double var(--sheet-accent); border-bottom: 1pt solid var(--sheet-accent); }
.rpt-sheet .sheet-table tr.sheet-grand .lbl { text-transform: uppercase; letter-spacing: .04em; }
.rpt-sheet .sheet-table td.sheet-chips { text-align: left; white-space: normal; }
.rpt-sheet .sheet-chip { display: inline-block; margin-right: 3.5mm; white-space: nowrap; }
.rpt-sheet .sheet-chip b { font-family: Consolas, "Courier New", monospace; }
/* Valor calculado só com parte das linhas: marca pontilhada com dica na tela; no papel, sem marca (sem dica). */
.rpt-sheet.rpt-sheet--screen .sheet-partial { text-decoration: underline dotted; text-underline-offset: 2px; cursor: help; }
.rpt-sheet .sheet-grand-block { margin-top: 3.5mm; }

.rpt-sheet .sheet-empty { padding: 6mm 0; text-align: center; color: var(--sheet-muted); }
.rpt-sheet .sheet-notes { margin: 2mm 0 0; padding-left: 4mm; font-size: .84em; color: #444; }
.rpt-sheet .sheet-notes li + li { margin-top: .4mm; }
.rpt-sheet .sheet-footer { margin-top: 2.5mm; padding-top: 1.2mm; border-top: .6pt solid var(--sheet-line); font-size: .82em; color: var(--sheet-muted); }
.rpt-sheet .sheet-footer span + span::before { content: " · "; }
.rpt-sheet .sheet-footer .sheet-footer__pages { display: none; }

/* Tela: a folha como papel (largura da página escolhida), interativa (clique no grupo abre o Detalhado). */
.rpt-sheet.rpt-sheet--screen { margin: 0 auto 24px; padding: 10mm; box-shadow: 0 1px 3px rgba(15, 23, 42, .12), 0 8px 24px rgba(15, 23, 42, .08); border: 1px solid #e5e7eb; border-radius: 4px; }
.rpt-sheet.rpt-sheet--screen.sheet--portrait { width: 210mm; }
.rpt-sheet.rpt-sheet--screen.sheet--landscape { width: 297mm; }
.rpt-sheet.rpt-sheet--screen .sheet-footer .sheet-footer__pages { display: inline; }
.rpt-sheet .sheet-drill { all: unset; cursor: pointer; color: inherit; font: inherit; text-align: inherit; border-radius: 2px; }
.rpt-sheet .sheet-drill:hover { text-decoration: underline; color: var(--sheet-accent); }
.rpt-sheet .sheet-drill:focus-visible { outline: 2px solid var(--sheet-accent); outline-offset: 1px; }
.rpt-sheet .sheet-sort { all: unset; cursor: pointer; color: inherit; font: inherit; text-align: inherit; display: inline; }
.rpt-sheet .sheet-sort:hover, .rpt-sheet .sheet-sort:focus-visible { text-decoration: underline; }
.rpt-sheet .sheet-sort[aria-sort="ascending"]::after { content: " ▲"; font-size: .8em; }
.rpt-sheet .sheet-sort[aria-sort="descending"]::after { content: " ▼"; font-size: .8em; }

/* Pré-visualização do cabeçalho na ficha da Propriedade ("Assim vai sair nos relatórios"). */
.rpt-sheet.rpt-sheet--preview { padding: 5mm 6mm; border: 1px dashed #cbd5e1; border-radius: 6px; }
`;

/** Estilo de impressão (só no documento impresso/PDF): página A4, margens de 10 mm e "Página X de Y". */
export function pageCss({ orientation = 'portrait', pageFooter = '' } = {}) {
  return `@page { size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm 10mm 12mm 10mm;
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7pt Arial, sans-serif; color: #555; }
  @bottom-left { content: "${cssString(pageFooter)}"; font: 7pt Arial, sans-serif; color: #555; } }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
}

/**
 * Texto seguro dentro de uma string CSS (`content: "…"`): escapeHtml NÃO serve aqui (dentro de <style> as
 * entidades saem literais). Escapa \, ", quebras de linha e < (evita fechar o <style>).
 */
export function cssString(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\5C ')
    .replace(/"/g, '\\22 ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '\\3C ')
    .replace(/>/g, '\\3E ');
}
