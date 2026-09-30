// E1G — renderizador ÚNICO dos gráficos (string), no padrão da folha (sheetHtml): a MESMA marcação na tela, na
// impressão e no PDF — para o mesmo tamanho, o SVG da tela e o do papel são a mesma string. SVG INLINE (nunca
// <img src=data:…>: a CSP do PDF e o "um <img> só, o logo" continuam), sem script, sem foreignObject, sem href
// externo, fonte do sistema. Todo texto passa por escapeHtml (nome de lote/raça/marca é texto do usuário); os ids
// são gerados (rc-<n>), nunca vêm do usuário. Geometria: domain/chartScale.chartGeometry (a mesma do hover).
import { escapeHtml } from './sheetHtml.js';
import { CHART_SIZES, chartGeometry } from '../../domain/chartScale.js';
import { inLegend } from '../../domain/reportCharts.js';
import { slotColor } from './chartStyles.js';

const slotName = (slot) => (typeof slot === 'number' ? `s${slot}` : String(slot ?? 'demais'));
const safeId = (value) => String(value ?? 'rc').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'rc';
const attr = (value) => escapeHtml(value);
// <title> por marca só com poucas marcas (centenas de datas não viram centenas de <title>).
const MAX_MARK_TITLES = 80;
// Paisagem: tabela de dados com mais colunas que isto não cabe na metade da página (515 px).
export const WIDE_TABLE_COLUMNS = 8;
// Revisão E1G: gráfico com valores e todas as séries desligadas na legenda.
export const TEXTO_TODAS_ESCONDIDAS = 'Todas as séries estão escondidas: ligue uma na legenda.';

function textEl(cls, x, y, anchor, text, title = null) {
  const hint = title && title !== text ? `<title>${escapeHtml(title)}</title>` : '';
  return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${escapeHtml(text)}${hint}</text>`;
}

/**
 * SVG de um gráfico (ChartData de domain/reportCharts).
 * @param chart ChartData
 * @param geometry chartGeometry(chart, { width, height }) — a mesma que a tela usa no hover
 * @param {{ uid?: string }} options uid = prefixo dos ids (rc-<n>); o bloco passa um por gráfico
 */
export function renderChartSvg(chart, geometry = chartGeometry(chart), { uid = `rc-${safeId(chart?.id)}` } = {}) {
  const g = geometry;
  const id = safeId(uid);
  const out = [];
  const description = [chart.subtitle, chart.semValor?.texto].filter(Boolean).join(' · ');
  out.push(`<svg class="rc-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}" role="img" aria-labelledby="${id}-t ${id}-d" data-kind="${attr(chart.kind)}">`);
  out.push(`<title id="${id}-t">${escapeHtml(chart.title)}</title><desc id="${id}-d">${escapeHtml(description)}</desc>`);
  if (g.empty) {
    // Revisão E1G: com valores, mas todas as séries escondidas na legenda — dizer isso, não "nenhum valor".
    const allHidden = !chart.vazio && (chart.series ?? []).some((series) => series.oculto);
    out.push(textEl('rc-empty', Math.round(g.width / 2), Math.round(g.height / 2), 'middle', allHidden ? TEXTO_TODAS_ESCONDIDAS : chart.textoVazio ?? 'Nenhum valor para mostrar.'));
    out.push('</svg>');
    return out.join('');
  }
  const { plot } = g;
  // Grade fina e marcas dos eixos.
  const grid = [
    ...g.gridY.map((y) => `<line class="rc-grid" x1="${plot.x}" y1="${y}" x2="${plot.x + plot.w}" y2="${y}" stroke="#e2e8f0"/>`),
    ...g.gridX.map((x) => `<line class="rc-grid" x1="${x}" y1="${plot.y}" x2="${x}" y2="${plot.y + plot.h}" stroke="#e2e8f0"/>`),
  ];
  out.push(`<g class="rc-grid-g">${grid.join('')}</g>`);
  const axis = [
    ...g.yAxis.ticks.map((tick) => textEl('rc-tick', plot.x - 6, tick.pos + 3.5, 'end', tick.label)),
    ...g.xAxis.ticks.map((tick) => textEl('rc-tick', tick.pos, plot.y + plot.h + 14, 'middle', tick.label)),
  ];
  // Unidade: no alto, à esquerda (eixo vertical de valor); embaixo, antes da primeira marca (eixo horizontal).
  if (g.yAxis.title && ['linha', 'colunas', 'histograma'].includes(g.kind)) axis.push(textEl('rc-axis-title', plot.x - 6, plot.y - 7, 'end', g.yAxis.title));
  if (g.xAxis.titleAt) axis.push(textEl('rc-axis-title', g.xAxis.titleAt.x, g.xAxis.titleAt.y, g.xAxis.titleAt.anchor, g.xAxis.title));
  out.push(`<g class="rc-axis-g">${axis.join('')}</g>`);
  if (g.zero) out.push(`<line class="rc-zero" x1="${g.zero.x1}" y1="${g.zero.y1}" x2="${g.zero.x2}" y2="${g.zero.y2}" stroke="#94a3b8"/>`);
  if (g.referencia) {
    const ref = g.referencia;
    // E1G etapa 2: só a linha aqui; o rótulo da referência vai com os outros rótulos, por cima das linhas (legível).
    out.push(`<g class="rc-ref-g"><line class="rc-ref" x1="${ref.x1}" y1="${ref.y1}" x2="${ref.x2}" y2="${ref.y2}" stroke="#334155" stroke-dasharray="4 3"/></g>`);
  }
  const marks = [];
  const markCount = g.bars.length + g.dumbbells.length + g.lines.reduce((sum, line) => sum + line.markers.length, 0);
  const withTitle = (tooltip) => (markCount <= MAX_MARK_TITLES && tooltip ? `<title>${escapeHtml(tooltip)}</title>` : '');
  for (const line of g.lines) {
    const name = slotName(line.slot);
    if (line.d) marks.push(`<path class="rc-line rc-${name}" d="${line.d}" fill="none" stroke="${slotColor(line.slot)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" data-series="${attr(line.key)}"/>`);
    for (const point of line.markers) {
      marks.push(`<circle class="rc-mark rc-dot rc-${name}" cx="${point.x}" cy="${point.y}" r="4" fill="${slotColor(line.slot)}" stroke="#ffffff" stroke-width="2" data-series="${attr(line.key)}" data-x="${attr(point.key)}">${withTitle(point.tooltip)}</circle>`);
    }
  }
  for (const bar of g.bars) {
    marks.push(`<path class="rc-mark rc-bar rc-${slotName(bar.slot)}" d="${bar.d}" fill="${slotColor(bar.slot)}" data-series="${attr(bar.key)}" data-x="${attr(bar.xKey)}">${withTitle(bar.tooltip)}</path>`);
  }
  for (const item of g.dumbbells) {
    const end = slotName(item.slot);
    marks.push(`<g class="rc-dumbbell" data-x="${attr(item.xKey)}">${withTitle(item.tooltip)}<line class="rc-halter" x1="${item.x1}" y1="${item.y}" x2="${item.x2}" y2="${item.y}" stroke="#94a3b8" stroke-width="2"/><circle class="rc-mark rc-dot rc-${slotName(item.startSlot)}" cx="${item.x1}" cy="${item.y}" r="4.5" fill="${slotColor(item.startSlot)}" stroke="#ffffff" stroke-width="2"/><circle class="rc-mark rc-dot rc-${end}" cx="${item.x2}" cy="${item.y}" r="5" fill="${slotColor(item.slot)}" stroke="#ffffff" stroke-width="2"/></g>`);
  }
  out.push(`<g class="rc-marks">${marks.join('')}</g>`);
  // Rótulos: categorias à esquerda, valor em toda barra, fim de cada linha (com linha-guia quando saiu do lugar).
  const labels = [
    ...(g.referencia ? [textEl('rc-ref-label', g.referencia.label.x, g.referencia.label.y, g.referencia.label.anchor, g.referencia.label.text)] : []),
    ...g.categoryLabels.map((label) => textEl('rc-cat', label.x, label.y, label.anchor, label.text, label.full)),
    ...g.bars.filter((bar) => bar.label?.text).map((bar) => textEl('rc-value', bar.label.x, bar.label.y, bar.label.anchor, bar.label.text)),
    ...g.dumbbells.filter((item) => item.label?.text).map((item) => textEl('rc-value', item.label.x, item.label.y, item.label.anchor, item.label.text)),
    ...g.directLabels.map((label) => `${label.leader ? `<line class="rc-leader" x1="${label.leader.x1}" y1="${label.leader.y1}" x2="${label.leader.x2}" y2="${label.leader.y2}" stroke="#94a3b8"/>` : ''}${textEl('rc-direct', label.x, label.y, label.anchor, label.text, label.full)}`),
  ];
  out.push(`<g class="rc-labels">${labels.join('')}</g>`);
  out.push('</svg>');
  return out.join('');
}

/** Legenda (2 séries ou mais): marca colorida ao lado do nome; o texto fica na tinta de texto. */
export function renderChartLegend(chart) {
  if (!chart.legenda) return '';
  const shape = chart.kind === 'linha' ? 'rc-key--line' : chart.kind === 'halteres' ? 'rc-key--dot' : '';
  const items = chart.series.filter(inLegend).map((series) => `<li class="rc-legend__item${series.oculto ? ' is-off' : ''}" data-key="${attr(series.key)}"><span class="rc-key ${shape} rc-${slotName(series.slot)}" aria-hidden="true"></span>${escapeHtml(series.label)}</li>`);
  return `<ul class="rc-legend">${items.join('')}</ul>`;
}

/** Tabela de dados do gráfico (os mesmos textos da folha): "Ver tabela" na tela e sempre no papel. */
export function renderChartTable(chart) {
  const table = chart.tabela;
  if (!table?.linhas?.length) return '';
  const head = `<tr>${table.cabecalho.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join('')}</tr>`;
  const body = table.linhas.map((row) => `<tr>${row.map((cell, index) => (index === 0 ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`)).join('')}</tr>`).join('');
  return `<table class="rc-table" data-chart-id="${attr(chart.id)}"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/**
 * Cartão de um gráfico: título, subtítulo (período, definição, cobertura), SVG, legenda, grupos sem valor, notas e
 * a tabela de dados.
 * @param {{ width?: number, height?: number, uid?: string, table?: boolean }} options
 */
export function renderChartCard(chart, { width = CHART_SIZES.PORTRAIT.width, height = CHART_SIZES.PORTRAIT.height, uid, table = true, wide = false } = {}) {
  const geometry = chartGeometry(chart, { width, height });
  return [
    `<figure class="rc-card${wide ? ' rc-card--wide' : ''}" data-chart-id="${attr(chart.id)}" data-kind="${attr(chart.kind)}">`,
    `<figcaption class="rc-card__head"><span class="rc-card__title">${escapeHtml(chart.title)}</span>${chart.subtitle ? `<span class="rc-card__sub">${escapeHtml(chart.subtitle)}</span>` : ''}</figcaption>`,
    renderChartSvg(chart, geometry, { uid }),
    renderChartLegend(chart),
    chart.semValor?.texto ? `<p class="rc-semvalor">${escapeHtml(chart.semValor.texto)}</p>` : '',
    chart.notas?.length ? `<ul class="rc-notes">${chart.notas.map((nota) => `<li>${escapeHtml(nota)}</li>`).join('')}</ul>` : '',
    table ? renderChartTable(chart) : '',
    '</figure>',
  ].filter(Boolean).join('\n');
}

/**
 * Bloco de gráficos da impressão/PDF (entra ANTES da folha, no mesmo documento — sheetHtml.renderSheetBody
 * `prelude`). Retrato: 1 gráfico por linha, 718 × 260; paisagem: grade 2 × 2, 515 × 230. No papel não há hover:
 * rótulo de valor em toda barra, rótulo no fim de cada linha e a tabela de dados embaixo de cada gráfico.
 * @param {{ orientation?: 'portrait'|'landscape', mode?: 'print'|'screen', breakAfter?: boolean, table?: boolean }} options
 *   breakAfter = a folha vem depois (começa em página nova); false em "só os gráficos".
 */
export function renderChartsBlock(charts = [], { orientation = 'portrait', mode = 'print', breakAfter = true, table = true } = {}) {
  const size = orientation === 'landscape' ? CHART_SIZES.LANDSCAPE : CHART_SIZES.PORTRAIT;
  const classes = ['rc-block', `rc-block--${mode === 'screen' ? 'screen' : 'print'}`, `rc-block--${orientation === 'landscape' ? 'landscape' : 'portrait'}`, breakAfter ? 'rc-break' : ''].filter(Boolean).join(' ');
  // E1G etapa 2: em paisagem, o gráfico com tabela de dados larga (mais de WIDE_TABLE_COLUMNS colunas — ex.: um ano
  // de meses) ocupa a linha inteira; na metade da página a tabela vazava do cartão.
  const wideOf = (chart) => orientation === 'landscape' && table && (chart.tabela?.cabecalho?.length ?? 0) > WIDE_TABLE_COLUMNS;
  const cards = charts.length
    ? `<div class="rc-cards">\n${charts.map((chart, index) => renderChartCard(chart, { ...(wideOf(chart) ? CHART_SIZES.LANDSCAPE_WIDE : size), uid: `rc-${index}`, table, wide: wideOf(chart) })).join('\n')}\n</div>`
    : '<p class="rc-none">Este relatório não tem gráficos.</p>';
  return `<section class="${classes}" data-charts="${charts.length}">\n<h2 class="rc-block__title">Gráficos</h2>\n${cards}\n</section>`;
}
