// E1G — escalas e geometria dos gráficos (puro, sem DOM: roda na tela, na impressão e no Node dos gates).
// A MESMA geometria desenha o SVG (infrastructure/exporters/chartSvg.js — tela, impressão e PDF) e alimenta a
// camada de hover da tela. Regras de desenho (skill dataviz + especificação da E1G):
//   - tempo PROPORCIONAL: a distância entre dois pontos é a de dias (nunca o índice da pesagem);
//   - peso: eixo Y sem partir de 0 (folga de 5%); barras, colunas e histograma: base 0 obrigatória, negativos
//     para baixo/esquerda;
//   - barras ≤ 24 px com ponta arredondada (4 px) e base reta; linhas de 2 px; marcadores r 4 com anel da
//     superfície; grade fina;
//   - rótulo direto no fim da linha (até 4 séries), afastado sem colidir e com linha-guia quando sai do lugar;
//   - sem valor (null) = ponto ausente, nunca 0.
// Medidas em px do papel/tela: o viewBox tem a largura real (718 retrato, 1047 paisagem, ou a do cartão).

export const DAY_MS = 86400000;
export const CHART_FONT_PX = 10;
export const CHART_SIZES = Object.freeze({
  PORTRAIT: Object.freeze({ width: 718, height: 260 }),
  // Paisagem: grade 2×2, (1047 − 16 de espaço) ÷ 2.
  LANDSCAPE: Object.freeze({ width: 515, height: 230 }),
  // E1G etapa 2: cartão de paisagem com tabela de dados larga (muitos meses) ocupa a linha inteira da página.
  LANDSCAPE_WIDE: Object.freeze({ width: 1047, height: 230 }),
  SCREEN: Object.freeze({ width: 560, height: 280 }),
});
const BAR_MAX = 24;
const BAR_RADIUS = 4;
const ROW_STEP = 28;
// E1G etapa 2: altura de cada grupo nas barras horizontais e halteres (a camada de hover da tela usa a mesma).
export const CHART_ROW_STEP = ROW_STEP;
const LABEL_GAP = 12;
// Barras horizontais e halteres: a altura vem do número de grupos (28 px cada; no mínimo 3), não do cartão.
const HORIZONTAL_MIN_ROWS = 3;

// Largura estimada do texto (fonte do sistema, corpo em px): basta para reservar margem e evitar colisão.
export function textWidth(text, fontPx = CHART_FONT_PX) {
  return String(text ?? '').length * fontPx * 0.56;
}

/** Corta o texto com reticências para caber em `maxPx` (o nome inteiro vai no <title>/tooltip). */
export function fitText(text, maxPx, fontPx = CHART_FONT_PX) {
  const value = String(text ?? '');
  if (textWidth(value, fontPx) <= maxPx) return value;
  const chars = Math.max(1, Math.floor(maxPx / (fontPx * 0.56)) - 1);
  return `${value.slice(0, chars)}…`;
}

const round1 = (value) => Math.round(value * 10) / 10;

function niceNumber(range, round) {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let nice;
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return Number((nice * 10 ** exponent).toPrecision(12));
}

/**
 * Marcas "bonitas" do eixo (1, 2, 5 × 10ⁿ) cobrindo [min, max].
 * @returns {{ min: number, max: number, step: number, decimals: number, ticks: number[] }}
 */
export function niceTicks(min, max, count = 5, { integer = false } = {}) {
  let low = Number(min);
  let high = Number(max);
  if (!Number.isFinite(low) || !Number.isFinite(high)) { low = 0; high = 1; }
  if (low > high) [low, high] = [high, low];
  if (low === high) {
    const pad = Math.abs(low) * 0.1 || 1;
    low -= low === 0 ? 0 : pad;
    high += pad;
  }
  let step = niceNumber(niceNumber(high - low, false) / Math.max(1, count - 1), true);
  if (integer) step = Math.max(1, Math.round(step));
  const niceMin = Number((Math.floor(low / step + 1e-9) * step).toPrecision(12));
  const niceMax = Number((Math.ceil(high / step - 1e-9) * step).toPrecision(12));
  const decimals = Math.max(0, (String(step).split('.')[1] ?? '').length);
  const ticks = [];
  for (let index = 0; niceMin + index * step <= niceMax + step / 2; index += 1) ticks.push(Number((niceMin + index * step).toFixed(decimals)));
  return { min: niceMin, max: niceMax, step, decimals, ticks };
}

/** Texto de uma marca do eixo em pt-BR ("1.200", "0,25"). */
export function formatTick(value, decimals = 0) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Data civil → número do dia (UTC, sem fuso). "aaaa-mm" = dia 15 do mês (o ponto do Mês fica no meio). */
export function dayNumber(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(value ?? ''));
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, match[3] ? Number(match[3]) : 15) / DAY_MS);
}

/** Escala linear domínio → px (domínio de um ponto só = meio da faixa). */
export function linearScale(d0, d1, r0, r1) {
  const scale = (value) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0));
  scale.domain = [d0, d1];
  scale.range = [r0, r1];
  return scale;
}

/** Escala de tempo proporcional: dias (dayNumber) → px. */
export function timeScale(days, r0, r1) {
  const values = days.filter(Number.isFinite);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (!values.length) { low = 0; high = 1; }
  if (low === high) { low -= 15; high += 15; }
  return linearScale(low, high, r0, r1);
}

/** Faixas iguais para n categorias em [r0, r1]: início, centro e largura da faixa. */
export function bandScale(count, r0, r1) {
  const step = count > 0 ? (r1 - r0) / count : r1 - r0;
  return { step, start: (index) => r0 + index * step, center: (index) => r0 + (index + 0.5) * step };
}

// Barra vertical com ponta arredondada no lado do valor e base reta (skill dataviz).
function columnPath(x0, x1, yBase, yEnd) {
  const r = Math.min(BAR_RADIUS, Math.abs(yEnd - yBase), (x1 - x0) / 2);
  if (Math.abs(yEnd - yBase) < 0.05) return `M${round1(x0)} ${round1(yBase)}H${round1(x1)}`;
  const up = yEnd < yBase;
  const inner = up ? yEnd + r : yEnd - r;
  return `M${round1(x0)} ${round1(yBase)}V${round1(inner)}Q${round1(x0)} ${round1(yEnd)} ${round1(x0 + r)} ${round1(yEnd)}H${round1(x1 - r)}Q${round1(x1)} ${round1(yEnd)} ${round1(x1)} ${round1(inner)}V${round1(yBase)}Z`;
}

// Barra horizontal: base reta no zero, ponta arredondada no valor (negativo para a esquerda).
function barPath(xBase, xEnd, y0, y1) {
  const r = Math.min(BAR_RADIUS, Math.abs(xEnd - xBase), (y1 - y0) / 2);
  if (Math.abs(xEnd - xBase) < 0.05) return `M${round1(xBase)} ${round1(y0)}V${round1(y1)}`;
  const right = xEnd > xBase;
  const inner = right ? xEnd - r : xEnd + r;
  return `M${round1(xBase)} ${round1(y0)}H${round1(inner)}Q${round1(xEnd)} ${round1(y0)} ${round1(xEnd)} ${round1(y0 + r)}V${round1(y1 - r)}Q${round1(xEnd)} ${round1(y1)} ${round1(inner)} ${round1(y1)}H${round1(xBase)}Z`;
}

// Marcas do eixo sem sobrepor texto: da esquerda para a direita, pula a que encostaria na anterior.
function thinTicks(ticks, fontPx = CHART_FONT_PX) {
  const out = [];
  let lastRight = -Infinity;
  for (const tick of ticks) {
    const half = textWidth(tick.label, fontPx) / 2;
    if (tick.pos - half < lastRight + 6) continue;
    out.push(tick);
    lastRight = tick.pos + half;
  }
  return out;
}

/** Rótulos diretos sem colidir: mantém a ordem vertical e afasta no mínimo `gap` px dentro de [top, bottom]. */
export function spreadLabels(items, { top, bottom, gap = LABEL_GAP }) {
  const sorted = [...items].sort((left, right) => left.want - right.want);
  for (let index = 0; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    sorted[index].y = Math.max(sorted[index].want, previous ? previous.y + gap : top);
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const next = sorted[index + 1];
    sorted[index].y = Math.min(sorted[index].y, next ? next.y - gap : bottom);
  }
  for (const item of sorted) item.y = Math.max(top, item.y);
  return sorted;
}

// Unidade do eixo horizontal: à esquerda da primeira marca, sem encostar nela (sem espaço, fica só no subtítulo).
function unitBeforeFirstTick(ticks, title, plot) {
  if (!title || !ticks.length) return null;
  const first = ticks[0];
  const x = first.pos - textWidth(first.label) / 2 - 6;
  if (x - textWidth(title) < 2) return null;
  return { x: round1(x), y: round1(plot.y + plot.h + 14), anchor: 'end' };
}
const withUnit = (ticks, title, plot) => ({ ticks, title, titleAt: unitBeforeFirstTick(ticks, title, plot) });

function yAxisOf(ticks, scale) {
  return ticks.ticks.map((value) => ({ value, pos: round1(scale(value)), label: formatTick(value, ticks.decimals) }));
}

function emptyGeometry(chart, width, height) {
  return { width, height, kind: chart.kind, empty: true, plot: { x: 0, y: 0, w: width, h: height }, xAxis: { ticks: [], title: null }, yAxis: { ticks: [], title: null }, gridX: [], gridY: [], zero: null, lines: [], bars: [], dumbbells: [], categoryLabels: [], directLabels: [], referencia: null, hover: { mode: 'none', columns: [] } };
}

const visibleSeries = (chart) => (chart.series ?? []).filter((series) => !series.oculto);

/**
 * Geometria em px de um gráfico (ChartData de reportCharts.buildReportCharts).
 * Barras horizontais e halteres: a altura vem do número de grupos (28 px por grupo), não de `height`.
 * @param {{ width?: number, height?: number }} size
 */
export function chartGeometry(chart, { width = CHART_SIZES.PORTRAIT.width, height = CHART_SIZES.PORTRAIT.height } = {}) {
  const W = Math.max(240, Math.round(width));
  const H = Math.max(140, Math.round(height));
  if (!chart || chart.vazio || !visibleSeries(chart).some((series) => series.points.some((point) => point.y != null))) return emptyGeometry(chart ?? { kind: null }, W, H);
  if (chart.kind === 'linha') return lineGeometry(chart, W, H);
  if (chart.kind === 'colunas') return columnGeometry(chart, W, H, { touching: false });
  if (chart.kind === 'histograma') return columnGeometry(chart, W, H, { touching: true });
  if (chart.kind === 'barras') return barGeometry(chart, W);
  if (chart.kind === 'halteres') return dumbbellGeometry(chart, W);
  return emptyGeometry(chart, W, H);
}

function lineGeometry(chart, W, H) {
  const series = visibleSeries(chart);
  const placed = series.map((item) => ({ series: item, points: item.points.filter((point) => Number.isFinite(point.x)).sort((a, b) => a.x - b.x) }));
  const drawn = placed.flatMap((item) => item.points.filter((point) => point.y != null));
  const values = drawn.map((point) => point.y);
  const reference = chart.referencia?.valor ?? null;
  if (reference != null) values.push(reference);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (chart.yZero) { low = Math.min(0, low); high = Math.max(0, high); } else {
    // Peso: o eixo não parte de 0 — folga de 5% da amplitude (ou do valor, com um ponto só).
    const pad = (high - low) * 0.05 || Math.abs(high) * 0.05 || 1;
    low -= pad;
    high += pad;
  }
  const ticks = niceTicks(low, high, 5);
  const yTickLabels = ticks.ticks.map((value) => formatTick(value, ticks.decimals));
  const left = Math.ceil(Math.max(...yTickLabels.map((label) => textWidth(label)), textWidth(chart.eixos?.y?.titulo ?? '') - 4) + 12);
  // Rótulo direto no fim de cada linha com até 4 séries (uma série só: só o valor).
  const labeled = series.length <= 4
    ? placed.map((item) => ({ item, last: [...item.points].reverse().find((point) => point.y != null) ?? null })).filter((entry) => entry.last)
    : [];
  const labelText = (entry) => (series.length === 1 ? entry.last.text : `${entry.item.series.label} ${entry.last.text}`);
  const right = labeled.length ? Math.min(Math.ceil(Math.max(...labeled.map((entry) => textWidth(labelText(entry)))) * 1.08) + 18, Math.round(W * 0.32)) : 16;
  const top = 18;
  const bottom = 26;
  const plot = { x: left, y: top, w: W - left - right, h: H - top - bottom };
  const inset = 8; // marcador inteiro dentro da área
  const xScale = timeScale(placed.flatMap((item) => item.points.map((point) => point.x)), plot.x + inset, plot.x + plot.w - inset);
  const yScale = linearScale(ticks.min, ticks.max, plot.y + plot.h, plot.y);
  const lines = placed.map(({ series: item, points }) => {
    const coords = points.filter((point) => point.y != null).map((point) => ({ x: round1(xScale(point.x)), y: round1(yScale(point.y)), key: point.xKey, text: point.text, label: point.xLabel, tooltip: point.tooltip ?? `${item.label} · ${point.xLabel}: ${point.text}` }));
    return { key: item.key, label: item.label, slot: item.slot, d: coords.length > 1 ? `M${coords.map((point) => `${point.x} ${point.y}`).join('L')}` : null, points: coords };
  });
  // Muitas datas (centenas de pesagens): marcador só no último ponto de cada série; o hover mostra o resto.
  const allMarkers = drawn.length <= 150;
  for (const line of lines) line.markers = allMarkers ? line.points : line.points.slice(-1);
  // Marcas do eixo X nos próprios pontos (proporcionais ao tempo), sem texto encavalado.
  const xKeys = new Map();
  for (const { points } of placed) for (const point of points) if (!xKeys.has(point.xKey)) xKeys.set(point.xKey, { key: point.xKey, pos: round1(xScale(point.x)), label: point.xLabel, x: point.x });
  const xTicks = thinTicks([...xKeys.values()].sort((a, b) => a.x - b.x));
  const want = labeled.map((entry) => ({ key: entry.item.series.key, want: yScale(entry.last.y), text: fitText(labelText(entry), right - 14), full: labelText(entry), from: { x: xScale(entry.last.x), y: yScale(entry.last.y) } }));
  // Série que termina na borda direita: rótulo na margem, afastado sem colidir (linha-guia se saiu do lugar).
  // Série que termina antes: rótulo ao lado do próprio último ponto (uma guia atravessando o gráfico pareceria dado).
  const atEdge = (label) => label.from.x >= plot.x + plot.w - inset - 1;
  const directLabels = [
    ...spreadLabels(want.filter(atEdge), { top: plot.y + 4, bottom: plot.y + plot.h }).map((label) => {
      const x = plot.x + plot.w + 6;
      const moved = Math.abs(label.y - label.want) > 3;
      return { key: label.key, x: round1(x), y: round1(label.y + 3.5), text: label.text, full: label.full, anchor: 'start', leader: moved ? { x1: round1(label.from.x + 6), y1: round1(label.from.y), x2: round1(x - 2), y2: round1(label.y) } : null };
    }),
    ...want.filter((label) => !atEdge(label)).map((label) => {
      const fits = label.from.x + 8 + textWidth(label.full) <= W - 2;
      const text = fits ? label.full : label.text;
      // Não encavala no rótulo da "Média geral" (canto esquerdo, acima da linha tracejada): desce para baixo do ponto.
      const x0 = fits ? label.from.x + 8 : label.from.x - 8 - textWidth(text);
      const refY = reference != null ? yScale(reference) - 4 : null;
      const refRight = plot.x + 4 + textWidth(`${chart.referencia?.label ?? ''} ${chart.referencia?.text ?? ''}`, 9);
      const hitsReference = refY != null && x0 < refRight && Math.abs(label.from.y - 6 - refY) < 12;
      return { key: label.key, x: round1(fits ? label.from.x + 8 : label.from.x - 8), y: round1(hitsReference ? label.from.y + 14 : label.from.y - 6), text, full: label.full, anchor: fits ? 'start' : 'end', leader: null };
    }),
  ];
  const referencia = reference != null ? {
    x1: plot.x, x2: plot.x + plot.w, y1: round1(yScale(reference)), y2: round1(yScale(reference)),
    label: { x: plot.x + 4, y: round1(yScale(reference) - 4), text: `${chart.referencia.label} ${chart.referencia.text}`, anchor: 'start' },
  } : null;
  const columns = [...xKeys.values()].sort((a, b) => a.x - b.x).map((tick) => ({
    x: tick.pos, xKey: tick.key, xLabel: tick.label,
    items: lines.map((line) => ({ key: line.key, label: line.label, slot: line.slot, point: line.points.find((point) => point.key === tick.key) ?? null })).filter((entry) => entry.point),
  }));
  return {
    width: W, height: H, kind: chart.kind, empty: false, plot,
    xAxis: { ticks: xTicks, title: chart.eixos?.x?.titulo ?? null },
    yAxis: { ticks: yAxisOf(ticks, yScale), title: chart.eixos?.y?.titulo ?? null },
    gridX: [], gridY: ticks.ticks.map((value) => round1(yScale(value))),
    zero: chart.yZero && ticks.min < 0 ? { x1: plot.x, x2: plot.x + plot.w, y1: round1(yScale(0)), y2: round1(yScale(0)) } : null,
    lines, bars: [], dumbbells: [], categoryLabels: [], directLabels, referencia,
    hover: { mode: 'x', columns },
  };
}

// Colunas no tempo (agrupadas por série) e histograma (colunas encostadas com 2 px de folga).
function columnGeometry(chart, W, H, { touching }) {
  const series = visibleSeries(chart);
  const categories = chart.eixos?.x?.categorias ?? [];
  const values = series.flatMap((item) => item.points.filter((point) => point.y != null).map((point) => point.y));
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  // Folga de 12% acima (e abaixo, com negativos) para o rótulo de valor no topo da coluna.
  const ticks = niceTicks(low * 1.12, high * 1.12, 5, { integer: touching });
  const left = Math.ceil(Math.max(...ticks.ticks.map((value) => textWidth(formatTick(value, ticks.decimals))), textWidth(chart.eixos?.y?.titulo ?? '') - 4) + 12);
  const top = 18;
  const bottom = 26;
  const plot = { x: left, y: top, w: W - left - 12, h: H - top - bottom };
  const yScale = linearScale(ticks.min, ticks.max, plot.y + plot.h, plot.y);
  const band = bandScale(categories.length, plot.x, plot.x + plot.w);
  const base = yScale(0);
  const bars = [];
  const count = series.length;
  const barWidth = touching ? Math.max(1, band.step - 2) : Math.min(BAR_MAX, Math.max(2, (band.step * 0.8 - (count - 1) * 2) / count));
  const groupWidth = touching ? barWidth : count * barWidth + (count - 1) * 2;
  categories.forEach((category, index) => {
    series.forEach((item, seriesIndex) => {
      const point = item.points.find((entry) => entry.xKey === category.key);
      if (!point || point.y == null) return;
      const x0 = touching ? band.start(index) + 1 : band.center(index) - groupWidth / 2 + seriesIndex * (barWidth + 2);
      const x1 = x0 + barWidth;
      const end = yScale(point.y);
      const text = point.barLabel ?? point.text;
      // Rótulo no topo da coluna (abaixo, se negativa) — só quando cabe na largura da faixa; a tabela leva todos.
      const fits = textWidth(text, 9) <= (touching ? band.step : band.step / count) + 6;
      const showLabel = fits && !(touching && point.y === 0);
      bars.push({
        key: item.key, slot: point.tone ?? item.slot, xKey: category.key, d: columnPath(x0, x1, base, end),
        x: round1(x0), y: round1(Math.min(base, end)), w: round1(barWidth), h: round1(Math.abs(end - base)),
        label: showLabel ? { x: round1((x0 + x1) / 2), y: round1(point.y < 0 ? end + 11 : end - 4), text, anchor: 'middle' } : null,
        tooltip: point.tooltip ?? `${category.label}: ${point.text}`, drill: point.drill ?? null, value: point.y,
      });
    });
  });
  const xTicks = thinTicks(categories.map((category, index) => ({ key: category.key, pos: round1(band.center(index)), label: category.short ?? category.label })));
  // Histograma: marca da média (peso médio) dentro da faixa em que ela cai (interpolada; faixa aberta = centro).
  let referencia = null;
  if (chart.referencia?.valor != null && touching) {
    const value = chart.referencia.valor;
    const index = categories.findIndex((category) => (category.lo == null || value >= category.lo) && (category.hi == null || value < category.hi));
    if (index >= 0) {
      const category = categories[index];
      const fraction = category.lo != null && category.hi != null ? (value - category.lo) / (category.hi - category.lo) : 0.5;
      const x = round1(band.start(index) + fraction * band.step);
      referencia = { x1: x, x2: x, y1: plot.y - 4, y2: plot.y + plot.h, label: { x: Math.min(Math.max(x, plot.x + 60), plot.x + plot.w - 60), y: plot.y - 7, text: `${chart.referencia.label} ${chart.referencia.text}`, anchor: 'middle' } };
    }
  }
  return {
    width: W, height: H, kind: chart.kind, empty: false, plot,
    xAxis: { ticks: xTicks, title: chart.eixos?.x?.titulo ?? null, titleAt: touching ? unitBeforeFirstTick(xTicks, chart.eixos?.x?.titulo, plot) : null },
    yAxis: { ticks: yAxisOf(ticks, yScale), title: chart.eixos?.y?.titulo ?? null },
    gridX: [], gridY: ticks.ticks.map((value) => round1(yScale(value))),
    zero: { x1: plot.x, x2: plot.x + plot.w, y1: round1(base), y2: round1(base) },
    lines: [], bars, dumbbells: [], categoryLabels: [], directLabels: [], referencia,
    hover: { mode: 'mark', columns: [] },
  };
}

// Barras horizontais ordenadas (GMD por grupo): zero no eixo, negativos para a esquerda, rótulo na ponta.
function barGeometry(chart, W) {
  const points = visibleSeries(chart)[0]?.points.filter((point) => point.y != null) ?? [];
  const labels = points.map((point) => point.xLabel);
  const left = Math.min(Math.ceil(Math.max(...labels.map((label) => textWidth(label))) + 20), Math.round(W * 0.3));
  const tip = (point) => point.barLabel ?? point.text;
  const positive = points.filter((point) => point.y >= 0).map((point) => textWidth(tip(point), 9));
  const negative = points.filter((point) => point.y < 0).map((point) => textWidth(tip(point), 9));
  const right = Math.min(Math.ceil(Math.max(0, ...positive) * 1.08) + 14, Math.round(W * 0.42));
  const top = 20;
  const bottom = 24;
  const height = Math.max(HORIZONTAL_MIN_ROWS * ROW_STEP + top + bottom, top + points.length * ROW_STEP + bottom);
  const plot = { x: left, y: top, w: W - left - right, h: height - top - bottom };
  const values = points.map((point) => point.y);
  const reference = chart.referencia?.valor ?? null;
  if (reference != null) values.push(reference);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 5);
  // Rótulo de barra negativa fica à esquerda da ponta: a escala abre espaço para ele dentro da área.
  let domainMin = ticks.min;
  const negativeRoom = negative.length ? Math.max(...negative) + 10 : 0;
  if (negativeRoom && negativeRoom < plot.w * 0.5) {
    const span = ticks.max - ticks.min;
    const needed = (negativeRoom / plot.w) * span / (1 - negativeRoom / plot.w);
    domainMin = Math.min(ticks.min, Math.min(...values) - needed);
  }
  const xScale = linearScale(domainMin, ticks.max, plot.x, plot.x + plot.w);
  const base = xScale(0);
  const thickness = Math.min(BAR_MAX - 6, ROW_STEP * 0.64);
  const bars = points.map((point, index) => {
    const center = plot.y + (index + 0.5) * ROW_STEP;
    const end = xScale(point.y);
    const text = tip(point);
    return {
      key: 'barras', slot: point.tone ?? 'pos', xKey: point.xKey, d: barPath(base, end, center - thickness / 2, center + thickness / 2),
      x: round1(Math.min(base, end)), y: round1(center - thickness / 2), w: round1(Math.abs(end - base)), h: round1(thickness),
      label: { x: round1(point.y < 0 ? end - 5 : end + 5), y: round1(center + 3.5), text, anchor: point.y < 0 ? 'end' : 'start' },
      tooltip: point.tooltip ?? `${point.xLabel}: ${point.text}`, drill: point.drill ?? null, value: point.y,
    };
  });
  const categoryLabels = points.map((point, index) => ({ x: plot.x - 8, y: round1(plot.y + (index + 0.5) * ROW_STEP + 3.5), text: fitText(point.xLabel, left - 12), full: point.xLabel, anchor: 'end', key: point.xKey }));
  const visibleTicks = ticks.ticks.filter((value) => value >= domainMin - 1e-9);
  const referencia = reference != null ? {
    x1: round1(xScale(reference)), x2: round1(xScale(reference)), y1: plot.y - 4, y2: plot.y + plot.h,
    label: { x: round1(Math.min(Math.max(xScale(reference), plot.x + 50), plot.x + plot.w - 50)), y: plot.y - 8, text: `${chart.referencia.label} ${chart.referencia.text}`, anchor: 'middle' },
  } : null;
  return {
    width: W, height, kind: chart.kind, empty: false, plot,
    xAxis: withUnit(thinTicks(visibleTicks.map((value) => ({ pos: round1(xScale(value)), label: formatTick(value, ticks.decimals), value }))), chart.eixos?.x?.titulo ?? null, plot),
    yAxis: { ticks: [], title: null },
    gridX: visibleTicks.map((value) => round1(xScale(value))), gridY: [],
    zero: { x1: round1(base), x2: round1(base), y1: plot.y, y2: plot.y + plot.h },
    lines: [], bars, dumbbells: [], categoryLabels, directLabels: [], referencia,
    hover: { mode: 'mark', columns: [] },
  };
}

/**
 * E1G etapa 2 — alvos da camada de hover/foco da TELA, tirados da MESMA geometria que desenha o SVG (a dica cai
 * exatamente sobre o que foi desenhado):
 *   linha → uma faixa vertical por x (cruz vertical que encosta no x mais próximo; a dica lista as séries);
 *   barras/halteres → a linha inteira do grupo; colunas/histograma → a coluna na altura toda da área.
 * @returns {{ kind: 'x'|'mark', index, key?, xKey, label?, hit: {x,y,w,h}, mark?: {x,y,w,h}, anchor: {x,y},
 *   items?, tooltip?, drill? }[]}
 */
export function chartHoverTargets(geometry) {
  const g = geometry;
  if (!g || g.empty) return [];
  const { plot } = g;
  if (g.hover?.mode === 'x') {
    const columns = g.hover.columns ?? [];
    return columns.map((column, index) => {
      const left = index === 0 ? plot.x : (columns[index - 1].x + column.x) / 2;
      const right = index === columns.length - 1 ? plot.x + plot.w : (column.x + columns[index + 1].x) / 2;
      return { kind: 'x', index, xKey: column.xKey, label: column.xLabel, hit: { x: round1(left), y: plot.y, w: round1(right - left), h: plot.h }, anchor: { x: column.x, y: plot.y }, items: column.items };
    });
  }
  if (g.kind === 'barras') {
    return g.bars.map((bar, index) => ({
      kind: 'mark', index, key: bar.key, xKey: bar.xKey, hit: { x: 0, y: round1(bar.y + bar.h / 2 - ROW_STEP / 2), w: g.width, h: ROW_STEP },
      mark: { x: bar.x, y: bar.y, w: bar.w, h: bar.h }, anchor: { x: round1(bar.value < 0 ? bar.x : bar.x + bar.w), y: bar.y }, tooltip: bar.tooltip, drill: bar.drill ?? null,
    }));
  }
  if (g.kind === 'halteres') {
    return g.dumbbells.map((item, index) => ({
      kind: 'mark', index, key: 'final', xKey: item.xKey, hit: { x: 0, y: round1(item.y - ROW_STEP / 2), w: g.width, h: ROW_STEP },
      mark: { x: Math.min(item.x1, item.x2) - 6, y: item.y - 7, w: Math.abs(item.x2 - item.x1) + 12, h: 14 }, anchor: { x: Math.max(item.x1, item.x2), y: item.y - 6 }, tooltip: item.tooltip, drill: item.drill ?? null,
    }));
  }
  return g.bars.map((bar, index) => ({
    kind: 'mark', index, key: bar.key, xKey: bar.xKey, hit: { x: round1(bar.x - 1), y: plot.y, w: round1(bar.w + 2), h: plot.h },
    mark: { x: bar.x, y: bar.y, w: bar.w, h: bar.h }, anchor: { x: round1(bar.x + bar.w / 2), y: bar.value < 0 ? round1(yOfBase(g)) : bar.y }, tooltip: bar.tooltip, drill: bar.drill ?? null,
  }));
}
const yOfBase = (g) => g.zero?.y1 ?? g.plot.y + g.plot.h;

// Halteres: por grupo, peso inicial (cinza) ligado ao final (cor), numa escala só em kg.
function dumbbellGeometry(chart, W) {
  const [start, end] = chart.series ?? [];
  const groups = (chart.eixos?.y?.categorias ?? []).filter((category) => end?.points.some((point) => point.xKey === category.key && point.y != null));
  const pointOf = (series, key) => series?.points.find((point) => point.xKey === key) ?? null;
  const values = groups.flatMap((category) => [pointOf(start, category.key)?.y, pointOf(end, category.key)?.y]).filter((value) => value != null);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low) * 0.05 || Math.abs(high) * 0.05 || 1;
  const ticks = niceTicks(low - pad, high + pad, 5);
  const left = Math.min(Math.ceil(Math.max(...groups.map((category) => textWidth(category.label))) + 20), Math.round(W * 0.3));
  const labelOf = (category) => pointOf(end, category.key)?.rotulo ?? '';
  const right = Math.min(Math.ceil(Math.max(0, ...groups.map((category) => textWidth(labelOf(category), 9))) * 1.08) + 16, Math.round(W * 0.45));
  const top = 14;
  const bottom = 24;
  const height = Math.max(HORIZONTAL_MIN_ROWS * ROW_STEP + top + bottom, top + groups.length * ROW_STEP + bottom);
  const plot = { x: left, y: top, w: W - left - right, h: height - top - bottom };
  const xScale = linearScale(ticks.min, ticks.max, plot.x, plot.x + plot.w);
  const dumbbells = groups.map((category, index) => {
    const center = round1(plot.y + (index + 0.5) * ROW_STEP);
    const from = pointOf(start, category.key);
    const to = pointOf(end, category.key);
    const x1 = round1(xScale(from.y));
    const x2 = round1(xScale(to.y));
    return {
      xKey: category.key, y: center, x1, x2, slot: to.tone ?? end.slot, startSlot: start.slot,
      label: { x: round1(Math.max(x1, x2) + 9), y: round1(center + 3.5), text: labelOf(category), anchor: 'start' },
      tooltip: to.tooltip ?? `${category.label}: ${from.text} → ${to.text}`, drill: to.drill ?? null,
    };
  });
  const categoryLabels = groups.map((category, index) => ({ x: plot.x - 8, y: round1(plot.y + (index + 0.5) * ROW_STEP + 3.5), text: fitText(category.label, left - 12), full: category.label, anchor: 'end', key: category.key }));
  return {
    width: W, height, kind: chart.kind, empty: false, plot,
    xAxis: withUnit(thinTicks(ticks.ticks.map((value) => ({ pos: round1(xScale(value)), label: formatTick(value, ticks.decimals), value }))), chart.eixos?.x?.titulo ?? null, plot),
    yAxis: { ticks: [], title: null },
    gridX: ticks.ticks.map((value) => round1(xScale(value))), gridY: [],
    zero: null, lines: [], bars: [], dumbbells, categoryLabels, directLabels: [], referencia: null,
    hover: { mode: 'mark', columns: [] },
  };
}
