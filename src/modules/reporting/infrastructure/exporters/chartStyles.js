// E1G — estilo dos gráficos (exporters/chartSvg.js). Cores só por tokens CSS --rc-*: o SVG leva a classe do slot
// (rc-s1…rc-s7, rc-demais, rc-nao-informado, rc-pos, rc-neg, rc-neutro) e a cor clara como atributo de reserva.
//
// Paleta VALIDADA com o validador da skill dataviz (scripts/validate_palette.js), não no olho:
//   claro sobre #ffffff  #2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #4a3aa7 — faixa de luminosidade, croma,
//     separação para daltonismo (pior 9,1 protan) e piso normal (19,6) PASSAM; contraste < 3:1 em #1baf7a, #eda100 e
//     #e87ba4 (AVISO) → por isso rótulo direto, rótulo de valor em toda barra e a tabela de dados (tela e papel);
//   escuro sobre #161b22 (--mb1-bg-card)  #3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 — tudo PASSA;
//   polaridade do GMD (as cores mk-pos/mk-neg da folha): claro #059669/#dc2626 PASSA; escuro #0f9f6e/#ef4444 com
//     separação 8,0 (no limite) — tem codificação secundária: abaixo de zero e o sinal no rótulo.
// Vermelho reservado a perda de peso (nunca uma série). 8ª série em diante = "Demais" em cinza. Texto sempre na
// tinta de texto, nunca na cor da série.
//
// A impressão/PDF usa SEMPRE os tokens claros (CHART_CSS, sem nenhuma regra de tema escuro). A tela
// (CHART_SCREEN_CSS) define os tokens em .rpt-charts-host e troca no tema escuro (html.dark/.tema-escuro/.escuro,
// a mesma convenção de modelo-base1-tokens.css).

export const CHART_SLOT_NAMES = Object.freeze(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 'demais', 'nao-informado', 'pos', 'neg', 'neutro']);

export const CHART_TOKENS = Object.freeze({
  light: Object.freeze({
    s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s5: '#e87ba4', s6: '#008300', s7: '#4a3aa7',
    demais: '#94a3b8', 'nao-informado': '#64748b', pos: '#059669', neg: '#dc2626', neutro: '#94a3b8',
    grid: '#e2e8f0', axis: '#94a3b8', text: '#0f172a', muted: '#475569', ref: '#334155', surface: '#ffffff',
  }),
  dark: Object.freeze({
    s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', s5: '#d55181', s6: '#008300', s7: '#9085e9',
    demais: '#6e7681', 'nao-informado': '#8b949e', pos: '#0f9f6e', neg: '#ef4444', neutro: '#6e7681',
    grid: '#2d333b', axis: '#6e7681', text: '#e6edf3', muted: '#848d97', ref: '#adbac7', surface: '#161b22',
  }),
});

/** Cor clara de um slot (atributo de reserva no SVG: sem CSS, o gráfico ainda sai certo e claro). */
export function slotColor(slot) {
  const name = typeof slot === 'number' ? `s${slot}` : slot;
  return CHART_TOKENS.light[name] ?? CHART_TOKENS.light.demais;
}

const tokenVars = (tokens) => Object.entries(tokens).map(([name, value]) => `--rc-${name}: ${value};`).join(' ');
const slotRules = CHART_SLOT_NAMES.map((name) => `.rc-svg .rc-mark.rc-${name} { fill: var(--rc-${name}); }
.rc-svg .rc-line.rc-${name} { stroke: var(--rc-${name}); }
.rc-key.rc-${name} { background: var(--rc-${name}); }`).join('\n');

// Regras dos gráficos (só tokens; valem na tela e no papel).
const CHART_RULES = `
.rc-block { color: var(--rc-text); }
.rc-block__title { margin: 0 0 6px; font-size: 1.1667em; font-weight: 700; }
.rc-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.rc-block--landscape .rc-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.rc-block--landscape .rc-card--wide { grid-column: 1 / -1; }
.rc-card { margin: 0; min-width: 0; break-inside: avoid; page-break-inside: avoid; }
.rc-card__head { display: block; margin: 0 0 4px; }
.rc-card__title { display: block; font-weight: 700; font-size: 1.0833em; }
.rc-card__sub { display: block; color: var(--rc-muted); font-size: .9167em; }
.rc-svg { display: block; max-width: 100%; height: auto; font-family: inherit; }
.rc-svg text { fill: var(--rc-text); font-size: 10px; }
.rc-svg .rc-tick, .rc-svg .rc-axis-title { fill: var(--rc-muted); }
.rc-svg .rc-value { font-size: 9px; }
.rc-svg :is(.rc-value, .rc-direct, .rc-ref-label, .rc-cat) { paint-order: stroke; stroke: var(--rc-surface); stroke-width: 3px; stroke-linejoin: round; }
.rc-svg .rc-empty { fill: var(--rc-muted); font-size: 11px; }
.rc-svg .rc-grid { stroke: var(--rc-grid); stroke-width: 1; }
.rc-svg .rc-zero { stroke: var(--rc-axis); stroke-width: 1; }
.rc-svg .rc-ref { stroke: var(--rc-ref); stroke-width: 1; stroke-dasharray: 4 3; }
.rc-svg .rc-ref-label { fill: var(--rc-ref); font-size: 9px; }
.rc-svg .rc-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.rc-svg .rc-dot { stroke: var(--rc-surface); stroke-width: 2; }
.rc-svg .rc-leader { stroke: var(--rc-axis); stroke-width: 1; }
.rc-svg .rc-halter { stroke: var(--rc-neutro); stroke-width: 2; stroke-linecap: round; }
${slotRules}
.rc-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 4px 0 0; padding: 0; list-style: none; font-size: .9167em; }
.rc-legend__item { display: inline-flex; align-items: center; gap: 5px; }
.rc-legend__item.is-off { opacity: .45; text-decoration: line-through; }
.rc-key { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
.rc-key--line { height: 3px; width: 14px; border-radius: 2px; }
.rc-key--dot { border-radius: 50%; }
.rc-semvalor { margin: 4px 0 0; font-size: .9167em; }
.rc-notes { margin: 3px 0 0; padding: 0 0 0 14px; color: var(--rc-muted); font-size: .8333em; }
.rc-table { width: 100%; margin: 6px 0 0; border-collapse: collapse; font-size: .8333em; }
.rc-table th, .rc-table td { padding: 2px 5px; border-bottom: 1px solid var(--rc-grid); text-align: right; white-space: nowrap; }
.rc-table th { color: var(--rc-muted); font-weight: 700; }
.rc-table th:first-child, .rc-table td:first-child { text-align: left; white-space: normal; }
.rc-table tbody tr:last-child td { font-weight: 700; }
.rc-none { margin: 0; color: var(--rc-muted); }
`;

/**
 * Documento impresso/PDF: tokens CLAROS fixos e as regras de quebra de página (cartão inteiro na página; a folha
 * começa em página nova depois do bloco de gráficos). Nenhuma regra de tema escuro — o PDF nunca sai escuro.
 */
export const CHART_CSS = `
/* ---- Gráficos (E1G) ---- */
.rc-block--print { ${tokenVars(CHART_TOKENS.light)} font-size: 8pt; }
.rc-block--print.rc-break { break-after: page; page-break-after: always; }
${CHART_RULES}`;

// E1G etapa 2 — camada de hover/foco da TELA (components/reports/ChartPlot): cruz vertical, anel nos pontos, faixa
// da barra sob o mouse e a dica. Só tokens (segue o tema); nunca vai para a impressão.
const hoverRings = CHART_SLOT_NAMES.map((name) => `.rc-hover__ring.rc-${name} { stroke: var(--rc-${name}); }`).join('\n');
const CHART_HOVER_RULES = `
.rc-plot { position: relative; line-height: 0; }
.rc-hover { position: absolute; left: 0; top: 0; max-width: 100%; height: auto; overflow: visible; }
.rc-hit { fill: transparent; pointer-events: all; outline: none; }
.rc-hit.is-drill { cursor: pointer; }
.rc-hit:focus-visible { stroke: var(--rc-text); stroke-width: 1.5; stroke-dasharray: 3 2; }
.rc-hover__cross line { stroke: var(--rc-muted); stroke-width: 1; }
.rc-hover__ring { fill: none; stroke-width: 2; pointer-events: none; }
${hoverRings}
.rc-hover__band { fill: var(--rc-text); opacity: .07; pointer-events: none; }
.rc-tip { position: absolute; z-index: 6; box-sizing: border-box; min-width: 140px; max-width: 300px; padding: 6px 9px; border: 1px solid var(--rc-grid); border-radius: 6px; background: var(--rc-surface); color: var(--rc-text); box-shadow: 0 4px 14px rgb(0 0 0 / .14); font-size: 12px; line-height: 17px; pointer-events: none; }
.rc-tip__title { display: flex; align-items: center; gap: 6px; margin: 0 0 2px; font-weight: 700; }
.rc-tip__row, .rc-tip__line { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.rc-tip__row b { font-weight: 600; font-variant-numeric: tabular-nums; }
.rc-tip__hint { display: block; margin-top: 3px; color: var(--rc-muted); font-size: 11px; }
.rc-tip .rc-key { flex: 0 0 auto; }
`;

/** Tela: os mesmos gráficos sobre o fundo do app, seguindo o tema (claro/escuro). */
export const CHART_SCREEN_CSS = `
.rpt-charts-host { ${tokenVars(CHART_TOKENS.light)} }
html.dark .rpt-charts-host, html.tema-escuro .rpt-charts-host, html.escuro .rpt-charts-host { ${tokenVars(CHART_TOKENS.dark)} }
${CHART_RULES}
${CHART_HOVER_RULES}`;
