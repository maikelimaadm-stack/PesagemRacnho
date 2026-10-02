// CSS ÚNICO da folha do relatório (E1B 1.4.0): a MESMA marcação e o MESMO estilo na tela (pré-visualização
// em papel), na impressão e no PDF. Tudo sob `.rpt-sheet` para não herdar nem vazar regras do app.
// Medidas em mm/pt (papel A4, margens de 10 mm). Números em fonte monoespaçada, alinhados à direita.
// A folha é sempre "papel branco", também no tema escuro (é a pré-visualização do que sai na impressora).
//
// E1D visual: a folha tem a cara da do MAKGESTAO — regras escopadas em `.rpt-sheet[data-style="makgestao"]`
// (M abaixo) e por desenho em [data-view]. E1E: vale para todos os relatórios (o resumo/lista genéricos usam
// as regras do Resumo por Data/Analítico). Medidas tiradas das classes do antigo (Tailwind + shadcn Table):
// text-xs 12 px (9 pt, a base), text-sm 14 px, text-base 16 px; TableHead h-10 px-2, TableCell p-2; cores slate/gray.

const M = '.rpt-sheet[data-style="makgestao"]';
// E1E: o resumo genérico usa o desenho do "Resumo por Data" e a lista genérica o do "Analítico" — a mesma
// regra vale para os dois data-view (views(RESUMO, '.x') = "M[data-view=resumo-data] .x, M[data-view=resumo] .x").
const RESUMO = ['resumo-data', 'resumo'];
const LISTA = ['analitico', 'lista'];
const views = (names, rest) => names.map((name) => `${M}[data-view="${name}"] ${rest}`).join(', ');
const MONO ='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const MAKGESTAO_CSS = `
/* ---- Folha no estilo do MAKGESTAO (E1D visual) ---- */
${M} { --mk-fg: #020817; --mk-muted: #64748b; --mk-line: #e2e8f0; --mk-slate-50: #f8fafc; --mk-slate-100: #f1f5f9; --mk-slate-300: #cbd5e1; --mk-slate-500: #64748b; --mk-slate-600: #475569; --mk-slate-700: #334155; --mk-slate-800: #1e293b; --mk-slate-900: #0f172a; --mk-gray-50: #f9fafb; --mk-gray-100: #f3f4f6; --mk-gray-300: #d1d5db; --mk-gray-500: #6b7280; --mk-gray-600: #4b5563; --mk-gray-700: #374151; --mk-emerald: #059669; --mk-red: #dc2626;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 9pt; line-height: 1.3333; color: var(--mk-fg); }
.rpt-sheet.sheet-size-s[data-style="makgestao"] { font-size: 8pt; }
.rpt-sheet.sheet-size-xs[data-style="makgestao"] { font-size: 7.2pt; }

/* Cabeçalho: logo 96 px à esquerda (h-24 w-24), produtor/fazenda/endereço centralizados no resto da largura;
   título + período com a linha preta de 2 px embaixo (border-b-2 border-black pb-1 mb-2). */
${M} .sheet-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 0; }
${M} .sheet-header__logo { flex: none; width: 96px; height: 96px; min-height: 0; justify-content: center; }
${M} .sheet-header__logo:empty { display: none; }
${M} .sheet-logo { width: 100%; height: 100%; max-width: none; max-height: none; object-fit: contain; }
${M} .sheet-header__id { flex: 1 1 auto; text-align: center; }
${M} .sheet-header__meta { display: none; }
${M} .sheet-titular, ${M} .sheet-header--system .sheet-titular { font-size: 1.3333em; line-height: 1.25; font-weight: 700; text-transform: uppercase; letter-spacing: 0; color: inherit; }
${M} .sheet-fazenda, ${M} .sheet-endereco, ${M} .sheet-docs { font-size: 1em; line-height: 1.25; }
${M} .sheet-title-row { display: block; border-bottom: 2px solid #000; padding: 0 0 4px; margin: 0 0 8px; }
${M} .sheet-title { font-size: 1.3333em; line-height: 1.5; font-weight: 700; }
${M} .sheet-title-side { display: block; text-align: left; font-size: 1em; line-height: 1.3333; color: var(--mk-gray-600); }

/* Tabelas (shadcn Table): cabeçalho cinza em negrito, linhas com borda fina, sem zebra. */
${M} .sheet-table { margin: 0; }
${M} .sheet-table th { background: none; color: var(--mk-muted); font-weight: 700; font-size: 1em; line-height: 1.3333; height: 40px; padding: 0 8px; vertical-align: middle; text-align: left; border-bottom: 1px solid var(--mk-line); white-space: normal; }
${M} .sheet-table td { padding: 8px; font-size: 1em; border-bottom: 1px solid var(--mk-line); vertical-align: middle; text-align: left; background: none; }
${M} .sheet-table tbody tr:last-child td { border-bottom: 0; }
${M} .sheet-table tbody tr.sheet-row:nth-child(even) td { background: none; }
${M} .sheet-table .num { font-family: inherit; }
${M} .sheet-table .al-l { text-align: left; }
${M} .sheet-table .al-c { text-align: center; }
${M} .sheet-table .al-r { text-align: right; }
${M} .sheet-table .mk-mono { font-family: ${MONO}; }
${M} .mk-bold { font-weight: 700; }
${M} .mk-semibold { font-weight: 600; }
${M} .mk-medium { font-weight: 500; }
${M} .sheet-table td.mk-pos { color: var(--mk-emerald); }
${M} .sheet-table td.mk-neg { color: var(--mk-red); }
/* M1: GMD de intervalo curto (fora da média) — o cinza que o tema já tem (gray-500); o motivo vai no title. */
${M} .sheet-table td.mk-gmd-cinza { color: var(--mk-gray-500); }
${M} .sheet-table .txt, ${M} .sheet-table .lbl { overflow-wrap: anywhere; }
/* O antigo corria as seções de página em página (só o título não fica sozinho no pé) e não marcava valor parcial. */
${M} .sheet-sec--1.sheet-keep { break-inside: auto; page-break-inside: auto; }
.rpt-sheet[data-style="makgestao"].rpt-sheet--screen .sheet-partial { text-decoration: none; cursor: default; }

/* Linha de total EM TEXTO ("Subtotal 02/06/2026: 103 animais   Peso Médio: 258,7 kg …"). */
${M} .mk-line { font-size: 1em; line-height: 1.3333; color: var(--mk-slate-700); break-inside: avoid; page-break-inside: avoid; }
${M} .mk-line strong { font-weight: 700; }
${M} .mk-line--grid { display: grid; column-gap: 16px; padding: 8px 0; border-top: 1px solid var(--mk-line); }
/* Corrida (resumo genérico com muitos totais): os itens com " | ", quebrando linha entre eles. */
${M} .mk-line--flow { padding: 8px 0; border-top: 1px solid var(--mk-line); }
${M} .mk-line--flow .mk-item { white-space: nowrap; }
${M} .mk-line--flow .mk-sep { color: var(--mk-slate-300); }
${M} .mk-line--box { margin-top: 8px; font-weight: 700; background: var(--mk-slate-50); padding: 8px 12px; border: 1px solid var(--mk-line); border-radius: 6px; }
${M} .mk-line--right { margin-top: 8px; text-align: right; font-weight: 600; color: inherit; }
${M} .mk-grand { margin-top: 24px; }
${M} .mk-grand .mk-line--grid, ${M} .mk-grand .mk-line--flow { padding: 12px 0; border-top: 2px solid var(--mk-slate-300); color: var(--mk-slate-800); }

/* Por Apartação (Resumo por Data) e resumo genérico: APARTAÇÃO (text-sm, linha dupla embaixo), DATA (xs semi),
   tabela com cabeçalho gray-50, Subtotal em texto; bloco TOTAL POR LOTE (cabeçalho gray-100, Total com 2 px). */
${views(RESUMO, '.sheet-sec--1')} { margin: 0 0 24px; }
${views(RESUMO, '.sheet-sec-title--1')} { font-size: 1.1667em; line-height: 1.4286; color: var(--mk-slate-800); border-bottom: 2px solid var(--mk-line); padding: 0 0 8px; margin: 0 0 12px; }
${views(RESUMO, '.sheet-sec--2')} { border-top: 1px solid var(--mk-line); }
${views(RESUMO, '.sheet-sec-title--2')} { font-size: 1em; line-height: 1.3333; font-weight: 600; color: var(--mk-slate-700); padding: 8px 0; margin: 0 0 4px; }
${views(RESUMO, '.sheet-table thead th')} { background: var(--mk-gray-50); }
${views(RESUMO, '.mk-block')} { margin-top: 16px; }
${views(RESUMO, '.sheet-sec-title--total')} { font-size: 1em; line-height: 1.3333; font-weight: 700; color: var(--mk-slate-700); border-bottom: 1px solid var(--mk-line); padding: 0 0 8px; margin: 0 0 8px; }
${views(RESUMO, '.sheet-table--leaf_total thead th')} { background: var(--mk-gray-100); }
${views(RESUMO, '.mk-block .mk-line--grid')}, ${views(RESUMO, '.mk-block .mk-line--flow')} { padding: 12px 0; border-top-width: 2px; margin-top: 8px; }

/* Por Apartação/Lote: título normal-case, grade com bordas (cabeçalho font-medium gray-700), tudo à esquerda. */
${M}[data-view="apartacao-lote"] .sheet-sec-title--1 { font-size: 1.1667em; line-height: 1.4286; text-transform: none; color: var(--mk-slate-800); margin: 4px 0; padding: 0; border: 0; }
${M}[data-view="apartacao-lote"] .sheet-table th { height: 40px; padding: 4px 8px; font-weight: 500; color: var(--mk-gray-700); border: 1px solid var(--mk-line); }
${M}[data-view="apartacao-lote"] .sheet-table td { padding: 4px 8px; color: var(--mk-gray-700); border: 1px solid var(--mk-gray-300); }
${M}[data-view="apartacao-lote"] .sheet-table tbody tr:last-child td { border-bottom: 1px solid var(--mk-gray-300); }
${M}[data-view="apartacao-lote"] .mk-line--grid { padding: 4px 0; border-top: 0; }
${M}[data-view="apartacao-lote"] .mk-grand .mk-line--grid { padding: 12px 0; border-top: 2px solid var(--mk-slate-300); }

/* Analítico e lista genérica: grupo (text-sm slate-700, linha embaixo), tabela, quadro do Subtotal e do TOTAL
   GERAL em negrito; na lista, o grupo de dentro (nível 2/3) um ponto menor. */
${views(LISTA, '.sheet-sec-title')} { font-size: 1.1667em; line-height: 1.4286; color: var(--mk-slate-700); border-bottom: 1px solid var(--mk-line); padding: 0 0 8px; margin: 16px 0 8px; }
${M}[data-view="lista"] .sheet-sec-title--2, ${M}[data-view="lista"] .sheet-sec-title--3 { font-size: 1em; }
${M}[data-view="lista"] .sheet-sec:first-child > .sheet-sec-title { margin-top: 0; }
${views(LISTA, '.mk-leaf')} { margin-bottom: 16px; }
${views(LISTA, '.mk-grand')} { margin-top: 16px; padding-top: 12px; border-top: 2px solid var(--mk-slate-300); }
${views(LISTA, '.mk-grand .mk-line--box')} { margin-top: 0; padding: 12px; color: var(--mk-slate-800); }

/* Vendas: quadro do comprador (slate-50, borda, cantos) com os totais ANTES da tabela; TOTAL GERAL à direita. */
${M}[data-view="vendas"] .sheet-sec--1 { margin: 0 0 24px; }
${M} .mk-box { background: var(--mk-slate-50); border: 1px solid var(--mk-line); border-radius: 6px; padding: 12px; margin: 0 0 8px; break-inside: avoid; page-break-inside: avoid; }
${M} .mk-box .sheet-sec-title { font-size: 1.1667em; line-height: 1.4286; color: var(--mk-slate-800); margin: 0 0 8px; padding: 0; border: 0; }
${M} .mk-box .mk-line--grid { padding: 0; border-top: 0; color: var(--mk-slate-600); }
${M}[data-view="vendas"] .mk-grand { margin-top: 8px; }

/* Sintético (Matriz): legenda, célula centralizada com Qtd (semi), peso (10 px slate-500) e GMD (10 px verde);
   coluna TOTAL slate-50, linha TOTAL slate-50 em negrito, canto slate-100. */
${M} .mk-legend { font-size: 1em; margin: 0 0 4px; }
${M} .mk-legend strong { font-weight: 700; }
${M}[data-view="matriz"] .sheet-table th { white-space: nowrap; }
${M}[data-view="matriz"] .sheet-table td.num { border-left: 1px solid var(--mk-slate-100); }
${M}[data-view="matriz"] .mk-v { display: block; line-height: 1.25; }
${M}[data-view="matriz"] .mk-v1 { font-weight: 600; }
${M}[data-view="matriz"] .mk-v2, ${M}[data-view="matriz"] .mk-v3 { font-size: .8333em; }
${M}[data-view="matriz"] .mk-v2 { color: var(--mk-slate-500); }
${M}[data-view="matriz"] .mk-v3 { color: var(--mk-emerald); }
${M}[data-view="matriz"] .mk-v.mk-none { color: var(--mk-slate-500); }
${M}[data-view="matriz"] .sheet-table td.mk-tcol { background: var(--mk-slate-50); border-left: 1px solid var(--mk-line); }
${M}[data-view="matriz"] td.mk-tcol .mk-v1 { font-weight: 700; color: var(--mk-slate-800); }
${M}[data-view="matriz"] td.mk-tcol .mk-v3 { color: var(--mk-slate-500); }
${M}[data-view="matriz"] .sheet-table tr.sheet-grand td { background: var(--mk-slate-50); color: inherit; font-weight: 700; border-top: 1px solid var(--mk-line); border-bottom: 0; }
${M}[data-view="matriz"] .sheet-table tr.sheet-grand .lbl { letter-spacing: 0; }
${M}[data-view="matriz"] tr.sheet-grand .mk-v1 { font-weight: 700; color: var(--mk-slate-800); }
${M}[data-view="matriz"] tr.sheet-grand .mk-v3 { color: var(--mk-slate-500); }
${M}[data-view="matriz"] .sheet-table tr.sheet-grand td.mk-tcol { background: var(--mk-slate-100); border-left: 1px solid var(--mk-line); }
${M}[data-view="matriz"] tr.sheet-grand td.mk-tcol .mk-v1 { color: var(--mk-slate-900); }
${M}[data-view="matriz"] tr.sheet-grand td.mk-tcol .mk-v2, ${M}[data-view="matriz"] tr.sheet-grand td.mk-tcol .mk-v3 { color: var(--mk-slate-600); }

/* Rodapé discreto como o "Impresso em" do antigo; folha vazia como o aviso dele. */
${M} .sheet-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid var(--mk-gray-300); text-align: center; font-size: 1em; color: var(--mk-gray-500); }
${M} .sheet-empty { padding: 48px 0; color: #94a3b8; }

/* Muitas colunas (fonte menor, decideSheetLayout): menos respiro dos lados da célula (6 px em s, 4 px em xs). */
.rpt-sheet.sheet-size-s[data-style="makgestao"] .sheet-table th, .rpt-sheet.sheet-size-s[data-style="makgestao"] .sheet-table td { padding-left: 6px; padding-right: 6px; }
.rpt-sheet.sheet-size-xs[data-style="makgestao"] .sheet-table th, .rpt-sheet.sheet-size-xs[data-style="makgestao"] .sheet-table td { padding-left: 4px; padding-right: 4px; }
`;

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
/* M1: GMD de intervalo curto (fora da média) no cinza do tema; o motivo vai no title. */
.rpt-sheet .sheet-table td.mk-gmd-cinza, .rpt-sheet .sheet-vendas td.mk-gmd-cinza { color: var(--sheet-muted); }
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

/* E1D — Vendas (Detalhado): o relatório de venda do MAKGESTAO (exporters/vendasHtml.js), com as medidas das
   classes Tailwind do antigo em em (base text-xs = 12px): tabela shadcn (cabeçalho h-10 px-2 font-bold cinza,
   células py-2 px-2, linha border-b, a última sem linha), números em fonte mono, título de bloco text-sm negrito
   com border-b slate-200 pb-2 mb-2, cartão bg-slate-50 border rounded-md p-3 com grade de 2 colunas gap-4,
   espaço de 16px entre blocos (space-y-4) e TOTAL GERAL text-xs semibold à direita. */
.rpt-sheet .sheet-vendas { --sv-text: #020817; --sv-muted: #64748b; --sv-line: #e2e8f0; --sv-strong: #1e293b; --sv-card-text: #475569; --sv-card-bg: #f8fafc;
  font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; line-height: 1.3333; color: var(--sv-text); }
.rpt-sheet.sheet-size-s .sheet-vendas { font-size: 10.7px; }
.rpt-sheet.sheet-size-xs .sheet-vendas { font-size: 9.6px; }
.rpt-sheet .sheet-vendas > * + * { margin-top: 1.3333em; }
.rpt-sheet .sheet-vendas > .sv-table--resumo:first-child { margin-top: .5em; }
.rpt-sheet .sheet-vendas .sv-table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 1em; }
.rpt-sheet .sheet-vendas .sv-table > thead { display: table-header-group; }
.rpt-sheet .sheet-vendas .sv-table tr { break-inside: avoid; page-break-inside: avoid; }
.rpt-sheet .sheet-vendas .sv-table th { height: 3.3333em; padding: .6667em; vertical-align: middle; font-weight: 700; color: var(--sv-muted); background: none; border-bottom: 1px solid var(--sv-line); white-space: nowrap; }
.rpt-sheet .sheet-vendas .sv-table td { padding: .6667em; vertical-align: middle; border-bottom: 1px solid var(--sv-line); }
.rpt-sheet .sheet-vendas .sv-table > tbody > tr:last-child > td { border-bottom: 0; }
.rpt-sheet .sheet-vendas .sv-l { text-align: left; }
.rpt-sheet .sheet-vendas .sv-r { text-align: right; }
.rpt-sheet .sheet-vendas .sv-c { text-align: center; }
.rpt-sheet .sheet-vendas .sv-num { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; white-space: nowrap; }
.rpt-sheet .sheet-vendas .sv-semibold { font-weight: 600; }
.rpt-sheet .sheet-vendas .sv-medium { font-weight: 500; }
.rpt-sheet .sheet-vendas .sv-strong > td { font-weight: 700; color: var(--sv-strong); }
.rpt-sheet .sheet-vendas .sv-title { border-bottom: 1px solid var(--sv-line); padding-bottom: .5714em; margin-bottom: .5714em; font-size: 1.1667em; line-height: 1.7143; font-weight: 700; color: var(--sv-strong); text-transform: uppercase; break-after: avoid; page-break-after: avoid; }
.rpt-sheet .sheet-vendas .sv-block--compradores > .sv-title { margin-bottom: 1.1429em; }
.rpt-sheet .sheet-vendas .sv-comprador { margin-bottom: 2em; }
.rpt-sheet .sheet-vendas .sv-card { background: var(--sv-card-bg); border: 1px solid var(--sv-line); border-radius: .5em; padding: 1em; margin-bottom: .6667em; break-inside: avoid; page-break-inside: avoid; }
.rpt-sheet .sheet-vendas .sv-comprador--detalhes .sv-card { break-after: avoid; page-break-after: avoid; }
.rpt-sheet .sheet-vendas .sv-card__title { margin: 0 0 .5714em; font-size: 1.1667em; line-height: 1.4286; font-weight: 700; color: var(--sv-strong); text-transform: uppercase; }
.rpt-sheet .sheet-vendas .sv-card__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.3333em; color: var(--sv-card-text); }
.rpt-sheet .sheet-vendas .sv-card__grid strong { font-weight: 700; }
.rpt-sheet .sheet-vendas .sv-total-geral { text-align: right; font-weight: 600; break-inside: avoid; page-break-inside: avoid; break-before: avoid; page-break-before: avoid; }
/* O TOTAL GERAL nunca sai sozinho numa página. Depois do cartão o break-before: avoid basta; depois da tabela
   de detalhe o Chromium não volta para dentro dela, então a última linha reserva o lugar do TOTAL (3,5em =
   espaço + linha; a margem negativa não muda a altura): se os dois não cabem, a linha desce junto. */
.rpt-sheet .sheet-vendas .sv-comprador:last-child .sv-table--detail > tbody > tr:last-child > td::after { content: ""; display: block; height: 3.5em; margin-bottom: -3.5em; }
${MAKGESTAO_CSS}`;

/**
 * Estilo de impressão (só no documento impresso/PDF): página A4, margens de 10 mm e "Página X de Y".
 * E1D item 8: a margem leva só "Página X de Y"; texto à esquerda só se alguém pedir (pageFooter).
 */
export function pageCss({ orientation = 'portrait', pageFooter = '' } = {}) {
  const left = pageFooter ? `\n  @bottom-left { content: "${cssString(pageFooter)}"; font: 7pt Arial, sans-serif; color: #555; }` : '';
  return `@page { size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm 10mm 12mm 10mm;
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7pt Arial, sans-serif; color: #555; }${left} }
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
