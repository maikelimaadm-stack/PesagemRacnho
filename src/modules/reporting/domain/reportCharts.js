// E1G — gráficos dos relatórios (docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B). Puro: roda na tela, na
// impressão/PDF, no XLSX e no Node dos gates.
//
// REGRA DE OURO: todo número sai do MESMO view model do runReport (rows = população final da folha; resolve =
// as mesmas colunas), pelo MESMO groupRows/computeAggregates e com os MESMOS specs da folha (peso médio avg; GMD
// weightedGmd = Σganho ÷ Σdias só com pares válidos; ganho sum; @ = ganho ÷ divisor; cabeças countDistinct) — o
// gráfico bate com a folha por construção. Texto de número = sheetNumberText (o da folha). Sem valor = ponto
// ausente e "-", nunca 0.
//
// Cores: até 7 séries com cor, na ordem fixa da paleta, pela ordem da entidade na POPULAÇÃO do relatório (antes
// dos filtros da pessoa) — filtrar não repinta. Passando de 7: as 7 com mais cabeças + "Demais", calculado sobre
// a UNIÃO das linhas (nunca média de médias). "Não informado" sempre cinza e por último.
import { CHART_KINDS, FAIXAS_GMD, chartColumnIds, defineCharts } from './chartDefinition.js';
import { groupRows } from './groupEngine.js';
import { computeAggregates } from './reportAggregates.js';
import { aggregateValueColumn } from './aggregateLabels.js';
import { avg, countDistinct, toFiniteNumber } from './aggregateEngine.js';
import { sheetNumberText } from './reportDocument.js';
import { canRunReport, canSeeColumn } from './reportPermissions.js';
import { dayNumber } from './chartScale.js';
import { compareWeighingEvents, measuredWeightOf } from '../../weighing/domain/weighingSeries.js';
import { entersGmdMath } from './gmdColumns.js';
import { arrobaKindOf, viewModelArrobaLabel } from './arrobaColumns.js';

export { CHART_KINDS, FAIXAS_GMD, chartColumnIds, defineCharts };

export const CHART_SLOTS = Object.freeze({ DEMAIS: 'demais', NAO_INFORMADO: 'nao-informado', POS: 'pos', NEG: 'neg', NEUTRO: 'neutro' });
export const CHART_MAX_COLORS = 7;
export const DEMAIS_KEY = '__demais__';
// Larguras de faixa do histograma no "auto": a menor que dá até 14 faixas (≈ 8–14 com o peso de um rebanho).
export const AUTO_BAND_WIDTHS = Object.freeze([10, 20, 25, 50, 100, 200, 500]);
const AUTO_MAX_BANDS = 14;

const INTEGER = Object.freeze({ type: 'integer' });
const intText = (value) => sheetNumberText(INTEGER, value);
const cabText = (value) => (value == null ? '-' : `${intText(value)} cab.`);
const brDate = (iso) => String(iso ?? '').slice(0, 10).split('-').reverse().join('/');
// E1G etapa 2: gráfico de GMD sem nenhum valor diz o porquê (nunca um gráfico em branco calado).
export const TEXTO_SEM_GMD = 'Sem GMD neste período: precisa de uma pesagem anterior.';

function pluralOf(label) {
  const word = String(label ?? '').split(' (')[0].trim().toLowerCase();
  if (!word) return 'grupos';
  if (/ão$/.test(word)) return word.replace(/ão$/, 'ões');
  if (/l$/.test(word)) return `${word.slice(0, -1)}is`;
  if (/[rzs]$/.test(word)) return `${word}es`;
  return `${word}s`;
}

// Unidade depois do texto da folha (o kg já vem no texto do peso).
function withUnit(text, unit) {
  if (text === '-' || !unit || unit === 'kg') return text;
  return `${text} ${unit}`;
}

/** Os gráficos da definição que o papel vê (defesa: nenhum cita coluna que o papel não vê). */
export function chartsOf(definition, role) {
  if (!definition?.charts?.length || !canRunReport(definition, role)) return [];
  const byId = new Map(definition.columns.map((column) => [column.id, column]));
  return definition.charts.filter((chart) => chart.columnIds.every((id) => byId.has(id) && canSeeColumn(byId.get(id), role)));
}

/**
 * Configuração dos gráficos da tela/modelo só com o que a definição declara: { [chartId]: { serie?, eixo?,
 * metrica?, faixa?, oculto?: [chaves] } }. Gráfico, controle ou opção desconhecidos saem com aviso. Valor igual ao
 * padrão continua (a pessoa escolheu); quem grava decide omitir a chave quando o objeto fica vazio.
 * @returns {{ config: object, warnings: { code, message, chartId?, key? }[] }}
 */
export function normalizeChartConfig(definition, config) {
  const warnings = [];
  const out = {};
  if (config == null) return { config: out, warnings };
  if (typeof config !== 'object' || Array.isArray(config)) {
    warnings.push({ code: 'CHART_CONFIG_INVALID', message: 'Configuração dos gráficos ignorada (formato inválido)' });
    return { config: out, warnings };
  }
  const byId = new Map((definition?.charts ?? []).map((chart) => [chart.id, chart]));
  for (const [chartId, value] of Object.entries(config)) {
    const chart = byId.get(chartId);
    if (!chart) { warnings.push({ code: 'CHART_UNKNOWN', message: `Gráfico desconhecido ignorado (${chartId})`, chartId }); continue; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { warnings.push({ code: 'CHART_CONFIG_INVALID', message: `Configuração do gráfico "${chart.title}" ignorada`, chartId }); continue; }
    const entry = {};
    for (const [key, choice] of Object.entries(value)) {
      if (key === 'oculto') {
        if (!Array.isArray(choice)) { warnings.push({ code: 'CHART_OPTION_INVALID', message: `Séries ocultas do gráfico "${chart.title}" ignoradas`, chartId, key }); continue; }
        const keys = [...new Set(choice.filter((item) => typeof item === 'string' && item && item.length <= 200))].slice(0, 50);
        if (keys.length) entry.oculto = keys;
        continue;
      }
      const control = chart.controls[key];
      if (!control) { warnings.push({ code: 'CHART_OPTION_UNKNOWN', message: `Opção "${key}" do gráfico "${chart.title}" ignorada`, chartId, key }); continue; }
      if (!control.choices.some((item) => item.id === choice)) { warnings.push({ code: 'CHART_CHOICE_UNKNOWN', message: `${control.label} "${choice}" não existe no gráfico "${chart.title}"`, chartId, key }); continue; }
      entry[key] = choice;
    }
    if (Object.keys(entry).length) out[chartId] = entry;
  }
  return { config: out, warnings };
}

/**
 * Opções em uso de um gráfico: as da configuração; sem escolha, a "Série/Agrupar por" segue o 1º nível de
 * agrupamento do tipo da folha quando ele está entre as opções (Desempenho "Por Categoria" → GMD por categoria);
 * senão, o padrão declarado.
 */
export function chartOptionsOf(chart, config = {}, viewModel = null) {
  const saved = config?.[chart.id] ?? {};
  const options = {};
  for (const [id, control] of Object.entries(chart.controls)) {
    let choice = control.choices.find((item) => item.id === saved[id]) ?? null;
    if (!choice && id === 'serie') {
      const first = viewModel?.groups?.[0]?.columnId ?? null;
      choice = control.choices.find((item) => item.columnId && item.columnId === first) ?? null;
    }
    options[id] = choice ?? control.choices.find((item) => item.id === control.default);
  }
  options.oculto = Array.isArray(saved.oculto) ? saved.oculto.map(String) : [];
  return options;
}

// Ordem das entidades na população do relatório (antes dos filtros da pessoa): base das cores.
const populationOrders = new WeakMap();
function populationOrder(viewModel, columnId) {
  const population = viewModel.population ?? viewModel.rows ?? [];
  let byColumn = populationOrders.get(population);
  if (!byColumn) { byColumn = new Map(); populationOrders.set(population, byColumn); }
  if (!byColumn.has(columnId)) {
    const nodes = groupRows(population, [{ columnId }], viewModel.resolve).nodes.filter((node) => !node.missing);
    byColumn.set(columnId, new Map(nodes.map((node, index) => [node.key, index])));
  }
  return byColumn.get(columnId);
}

/**
 * Cor de cada série: slot 1..7 pela ordem da entidade na população (colisão entre séries visíveis desce para o
 * próximo slot livre); "Demais" e "Não informado" em cinza.
 */
function assignSlots(entries, order) {
  const used = new Set();
  const rank = (entry) => order.get(entry.key) ?? order.size + entries.indexOf(entry);
  for (const entry of [...entries].sort((left, right) => rank(left) - rank(right))) {
    if (entry.missing) { entry.slot = CHART_SLOTS.NAO_INFORMADO; continue; }
    if (entry.demais) { entry.slot = CHART_SLOTS.DEMAIS; continue; }
    let slot = (rank(entry) % CHART_MAX_COLORS) + 1;
    for (let tries = 0; used.has(slot) && tries < CHART_MAX_COLORS; tries += 1) slot = (slot % CHART_MAX_COLORS) + 1;
    used.add(slot);
    entry.slot = slot;
  }
}

/** Mais de `max` grupos: os `max` com mais cabeças ficam; o resto vira "Demais". "Não informado" à parte. */
function limitSeries(nodes, cabId, max, order) {
  const present = nodes.filter((node) => !node.missing);
  const missing = nodes.find((node) => node.missing) ?? null;
  if (present.length <= max) return { kept: present, rest: [], missing };
  const byOrder = (node) => order.get(node.key) ?? Number.MAX_SAFE_INTEGER;
  const ranked = [...present].sort((left, right) => (right.aggregates[cabId]?.value ?? 0) - (left.aggregates[cabId]?.value ?? 0) || byOrder(left) - byOrder(right));
  const kept = ranked.slice(0, max).sort((left, right) => byOrder(left) - byOrder(right));
  return { kept, rest: ranked.slice(max), missing };
}

const columnOf = (viewModel, columnId) => viewModel.resolve(columnId)?.column ?? null;
// M1 §5: {@} de um rótulo do gráfico ("@ produzidas por mês ({@})") = a marca da arroba da coluna do valor, com o divisor
// do view model ("(@ vivo ÷30)") — o gráfico de @ diz qual arroba é, como a folha.
const arrobaText = (viewModel, text, spec) => viewModelArrobaLabel(viewModel, text, spec?.columnId);
// Título do eixo da unidade: "@" sozinho não diz qual arroba é — vai a marca da coluna ("@ vivo ÷30").
const axisUnit = (unit, valueColumn) => (unit === '@' && arrobaKindOf(valueColumn) ? valueColumn.arrobaTag ?? unit : unit);
const valueColumnOf = (viewModel, spec) => aggregateValueColumn(spec, spec.columnId ? [columnOf(viewModel, spec.columnId)].filter(Boolean) : []);

function periodText(viewModel) {
  if (viewModel.period?.from && viewModel.period?.to) return `${brDate(viewModel.period.from)} a ${brDate(viewModel.period.to)}`;
  return viewModel.period ? null : 'Situação de hoje';
}

// "GMD de 28 de 32 cab.": quantos animais têm o valor, entre os do gráfico.
function coverageOf(prefix, validos, total, texto = null) {
  if (validos == null || total == null) return null;
  return { validos, total, texto: texto ?? `${prefix} de ${intText(validos)} de ${intText(total)} cab.` };
}

const valueOfNode = (node, spec) => node?.aggregates?.[spec.id]?.value ?? null;

/**
 * Última pesagem COM PESO de cada animal (ordem canônica do histórico: data → tipo → gravação → id). A pesagem
 * sem peso (Saída por morte sem balança) é ignorada — o animal entra com a última que tem peso.
 * @returns {{ key: string, row: object, value: number }[]}
 */
export function ultimaPesagemPorAnimal(rows, resolve, animalColumnId, valueColumnId = 'peso') {
  const animal = resolve(animalColumnId);
  const value = resolve(valueColumnId);
  if (!animal || !value) throw new Error(`gráficos: colunas desconhecidas (${animalColumnId}/${valueColumnId})`);
  const best = new Map();
  for (const row of rows) {
    const weight = measuredWeightOf({ peso: value.valueOf(row) });
    if (weight === null) continue;
    const key = animal.groupKeyOf(row);
    if (key === null || key === undefined || key === '') continue;
    const current = best.get(String(key));
    if (!current || compareWeighingEvents(current.row, row) < 0) best.set(String(key), { key: String(key), row, value: weight });
  }
  return [...best.values()];
}

/**
 * Faixas semiabertas [a, b) de largura fixa cobrindo os valores (a de baixo começa no múltiplo da largura).
 * `largura` 'auto' = a menor de AUTO_BAND_WIDTHS com até 14 faixas.
 * @returns {{ key, label, short, lo, hi }[]}
 */
export function faixasDePeso(values, largura = 'auto', unit = 'kg') {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [];
  let low = Infinity;
  let high = -Infinity;
  for (const value of finite) { if (value < low) low = value; if (value > high) high = value; }
  const count = (width) => Math.floor((high - Math.floor(low / width) * width) / width) + 1;
  const width = largura === 'auto' ? AUTO_BAND_WIDTHS.find((item) => count(item) <= AUTO_MAX_BANDS) ?? AUTO_BAND_WIDTHS.at(-1) : Number(largura);
  const start = Math.floor(low / width) * width;
  const format = (value) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return Array.from({ length: count(width) }, (_, index) => {
    const lo = start + index * width;
    const hi = lo + width;
    return { key: `${lo}-${hi}`, label: `${format(lo)}–${format(hi)} ${unit}`, short: `${format(lo)}–${format(hi)}`, lo, hi };
  });
}

/** Faixa [lo, hi) de um valor (lo/hi null = aberta). */
export function faixaDe(value, bands) {
  return bands.find((band) => (band.lo == null || value >= band.lo) && (band.hi == null || value < band.hi)) ?? null;
}

// ---------------------------------------------------------------------------------------------------------
// Construção por tipo
// ---------------------------------------------------------------------------------------------------------

/** A série entra na legenda? (tem algum valor desenhado, ou está oculta pela pessoa). */
export function inLegend(series) {
  return Boolean(series.oculto) || series.points.some((point) => point.y != null);
}

function baseChart(viewModel, chart, options, extra) {
  const controls = Object.entries(chart.controls).map(([id, control]) => ({ id, label: control.label, value: options[id]?.id ?? null, choices: control.choices.map((choice) => ({ id: choice.id, label: arrobaText(viewModel, choice.label, choice.valor) })) }));
  const config = Object.fromEntries(Object.keys(chart.controls).map((id) => [id, options[id]?.id ?? null]));
  if (options.oculto.length) config.oculto = [...options.oculto];
  const out = {
    id: chart.id, kind: chart.kind, title: options.metrica?.titulo ? arrobaText(viewModel, options.metrica.titulo, options.metrica.valor) : arrobaText(viewModel, chart.title, chart.valor),
    config, controls, notas: [...chart.notas], referencia: null, cobertura: null, semValor: null,
    ...extra,
  };
  const series = out.series ?? [];
  // Legenda com 2 séries ou mais que aparecem (série sem nenhum valor fica só na tabela; a oculta continua,
  // para a pessoa ligar de volta).
  out.legenda = series.filter(inLegend).length >= 2;
  // E1G etapa 2: o histograma sem nenhum animal contado também é vazio (colunas de 0 não dizem nada).
  out.vazio = extra.vazio ?? !series.some((item) => item.points.some((point) => point.y != null));
  out.textoVazio = out.vazio ? (extra.textoVazio ?? 'Nenhum valor para mostrar com o período e os filtros aplicados.') : null;
  out.subtitle = [periodText(viewModel), extra.subtitle ?? chart.subtitle, out.cobertura?.texto].filter(Boolean).join(' · ');
  return out;
}

// Evolução no tempo (linha) e colunas por mês: série × eixo pelo motor da folha.
function buildTimeChart(viewModel, chart, options) {
  const { rows, resolve } = viewModel;
  const eixo = options.eixo;
  const metrica = options.metrica;
  const serie = options.serie?.columnId ? options.serie : null;
  const valor = metrica.valor;
  const cab = chart.cab;
  const cobertura = metrica.cobertura ?? null;
  const specs = [valor, cab, ...(cobertura ? [cobertura] : [])];
  const valueColumn = valueColumnOf(viewModel, valor);
  const unit = metrica.unidade ?? chart.unidade ?? null;
  const fmt = (value) => sheetNumberText(valueColumn, value, { op: valor.op });
  const totals = computeAggregates(rows, specs, resolve);
  const byX = groupRows(rows, [{ columnId: eixo.columnId }], resolve, { aggregates: specs }).nodes;
  const xOf = (node) => {
    if (node.missing) return null;
    if (eixo.tempo === 'mes' || eixo.tempo === 'data') return dayNumber(node.key);
    // Sessão: a data da sessão = a primeira data de pesagem dela.
    let first = null;
    for (const row of node.rows) { const day = dayNumber(row.data_pesagem); if (day !== null && (first === null || day < first)) first = day; }
    return first;
  };
  const xLabelOf = (node) => (eixo.tempo === 'data' ? brDate(node.key) : node.label);
  const categorias = byX.filter((node) => !node.missing).map((node) => ({ key: node.key, label: xLabelOf(node), x: xOf(node) }));

  const entries = [];
  let order = new Map();
  if (!serie) {
    entries.push({ key: 'todos', label: 'Todos', slot: 1, node: { aggregates: totals }, children: byX, drill: true });
  } else {
    const nodes = groupRows(rows, [{ columnId: serie.columnId }, { columnId: eixo.columnId }], resolve, { aggregates: specs }).nodes;
    order = populationOrder(viewModel, serie.columnId);
    const { kept, rest, missing } = limitSeries(nodes, cab.id, chart.maxSeries ?? CHART_MAX_COLORS, order);
    for (const node of kept) entries.push({ key: node.key, label: node.label, node, children: node.children, drill: true });
    if (rest.length) {
      // "Demais": o motor sobre a UNIÃO das linhas dos grupos que sobraram (nunca a média das médias).
      // Revisão E1G: sobrando UM grupo só, os pontos são os dele (caminho série × eixo) — o clique abre a folha
      // daquele grupo naquele x, e não o x de todos os grupos.
      const union = rest.flatMap((node) => node.rows);
      entries.push({
        key: rest.length === 1 ? rest[0].key : DEMAIS_KEY,
        label: rest.length === 1 ? rest[0].label : `Demais (${rest.length} ${pluralOf(serie.label)})`,
        demais: true, members: rest.map((node) => node.key), drill: rest.length === 1,
        node: rest.length === 1 ? rest[0] : { aggregates: computeAggregates(union, specs, resolve) },
        children: rest.length === 1 ? rest[0].children : groupRows(union, [{ columnId: eixo.columnId }], resolve, { aggregates: specs }).nodes,
      });
    }
    if (missing) entries.push({ key: missing.key, label: missing.label, missing: true, node: missing, children: missing.children, drill: true });
    assignSlots(entries, order);
  }
  const single = entries.length === 1;
  const series = entries.map((entry) => {
    const points = entry.children.filter((child) => !child.missing).map((child) => {
      const y = valueOfNode(child, valor);
      const text = fmt(y);
      const cabValue = valueOfNode(child, cab);
      const coverage = cobertura ? { validos: valueOfNode(child, cobertura), total: cabValue } : null;
      const tone = chart.kind === CHART_KINDS.COLUNAS && single ? (y != null && y < 0 ? CHART_SLOTS.NEG : CHART_SLOTS.POS) : undefined;
      return {
        xKey: child.key, x: xOf(child), xLabel: xLabelOf(child), y, text, cab: cabValue, cobertura: coverage,
        barLabel: withUnit(text, unit === 'kg/dia' ? null : unit),
        tooltip: `${entry.label} · ${xLabelOf(child)}: ${withUnit(text, unit)} · ${cabText(cabValue)}${coverage?.validos != null && valueColumn.type === 'gmd' ? ` · GMD de ${intText(coverage.validos)}` : ''}`,
        drill: entry.drill && child.path?.length ? child.path.map(({ columnId, key, label }) => ({ columnId, key, label })) : null,
        ...(tone ? { tone } : {}),
      };
    });
    return { key: entry.key, label: entry.label, slot: entry.slot, oculto: options.oculto.includes(entry.key), cab: valueOfNode(entry.node, cab), points, ...(entry.members ? { membros: entry.members } : {}) };
  });

  // Tabela de dados (a mesma da matriz Série × Eixo com a coluna do período): texto da folha em cada célula.
  const cabecalho = [serie ? serie.label : 'Série', ...categorias.map((category) => category.label), 'No período'];
  const linhas = [];
  const valores = [];
  const rowOf = (label, children, node) => {
    const byKey = new Map(children.map((child) => [child.key, child]));
    const cells = categorias.map((category) => (byKey.has(category.key) ? valueOfNode(byKey.get(category.key), valor) : undefined));
    linhas.push([label, ...cells.map((value) => (value === undefined ? '' : fmt(value))), fmt(valueOfNode(node, valor))]);
    valores.push([null, ...cells.map((value) => (value === undefined ? null : value)), valueOfNode(node, valor)]);
  };
  for (const entry of entries) rowOf(entry.label, entry.children, entry.node);
  if (serie) rowOf('Todos', byX, { aggregates: totals });
  const total = valueOfNode({ aggregates: totals }, valor);
  // "GMD de 2 de 4 cab." / "Ganho de 2 de 4 cab.": o nome da coluna de valor (sem "em arrobas").
  const prefix = valueColumn.type === 'gmd' ? 'GMD' : String(columnOf(viewModel, valor.columnId)?.label ?? metrica.label).split(' ')[0];
  const nota = metrica.nota ? metrica.nota.replace('{divisor}', String(viewModel.arrobaDivisor ?? 30)) : null;
  return baseChart(viewModel, chart, options, {
    unit, valueColumn: valor.columnId, xType: chart.kind === CHART_KINDS.LINHA ? 'tempo' : 'categoria', yZero: chart.kind !== CHART_KINDS.LINHA || metrica.yZero,
    eixos: { x: { titulo: eixo.label, categorias }, y: { titulo: axisUnit(unit, valueColumn) } },
    series,
    referencia: chart.kind === CHART_KINDS.LINHA && total != null ? { label: 'Média geral', valor: total, text: fmt(total) } : null,
    total: { valor: total, text: fmt(total), cab: valueOfNode({ aggregates: totals }, cab) },
    cobertura: cobertura ? coverageOf(prefix, valueOfNode({ aggregates: totals }, cobertura), valueOfNode({ aggregates: totals }, cab)) : null,
    notas: [...(nota ? [nota] : []), ...chart.notas],
    tabela: { cabecalho, linhas, valores, formatos: [null, ...categorias.map(() => valueColumn), valueColumn] },
    ...(valueColumn.type === 'gmd' ? { textoVazio: TEXTO_SEM_GMD } : {}),
  });
}

// GMD (ou outro valor) por grupo: barras horizontais do maior para o menor; grupo sem valor fica em texto.
function buildBarChart(viewModel, chart, options) {
  const { rows, resolve } = viewModel;
  const dimension = options.serie;
  const valor = chart.valor;
  const cab = chart.cab;
  const cobertura = chart.cobertura ?? null;
  const specs = [valor, cab, ...(cobertura ? [cobertura] : [])];
  const valueColumn = valueColumnOf(viewModel, valor);
  const unit = chart.unidade ?? (valueColumn.type === 'gmd' ? 'kg/dia' : null);
  const fmt = (value) => sheetNumberText(valueColumn, value, { op: valor.op });
  const validOf = (node) => (cobertura ? valueOfNode(node, cobertura) : node.aggregates[valor.id]?.n_validos ?? null);
  const nodes = groupRows(rows, [{ columnId: dimension.columnId }], resolve, { aggregates: specs }).nodes;
  const totals = computeAggregates(rows, specs, resolve);
  const prefix = valueColumn.type === 'gmd' ? 'GMD' : 'Valor';
  const withValue = nodes.filter((node) => valueOfNode(node, valor) != null);
  const natural = new Map(nodes.map((node, index) => [node.key, index]));
  withValue.sort((left, right) => valueOfNode(right, valor) - valueOfNode(left, valor) || natural.get(left.key) - natural.get(right.key));
  const without = nodes.filter((node) => valueOfNode(node, valor) == null);
  const points = withValue.map((node) => {
    const y = valueOfNode(node, valor);
    const text = fmt(y);
    const cabValue = valueOfNode(node, cab);
    const validos = validOf(node);
    const rotulo = [withUnit(text, unit), cabText(cabValue), validos != null && validos !== cabValue ? `${prefix} de ${intText(validos)}` : null].filter(Boolean).join(' · ');
    return {
      xKey: node.key, x: null, xLabel: node.label, y, text, cab: cabValue, cobertura: { validos, total: cabValue },
      tone: y < 0 ? CHART_SLOTS.NEG : CHART_SLOTS.POS, barLabel: rotulo, rotulo,
      tooltip: `${node.label} — ${prefix} ${withUnit(text, unit)} · ${cabText(cabValue)} · ${prefix} de ${intText(validos ?? 0)} cab.`,
      drill: node.path.map(({ columnId, key, label }) => ({ columnId, key, label })),
    };
  });
  const semValorItems = without.map((node) => ({ key: node.key, label: node.label, cab: valueOfNode(node, cab) }));
  const total = valueOfNode({ aggregates: totals }, valor);
  const linhas = [];
  const valores = [];
  for (const node of [...withValue, ...without]) {
    linhas.push([node.label, fmt(valueOfNode(node, valor)), intText(valueOfNode(node, cab)), intText(validOf(node))]);
    valores.push([null, valueOfNode(node, valor), valueOfNode(node, cab), validOf(node)]);
  }
  linhas.push(['Todos', fmt(total), intText(valueOfNode({ aggregates: totals }, cab)), intText(validOf({ aggregates: totals }))]);
  valores.push([null, total, valueOfNode({ aggregates: totals }, cab), validOf({ aggregates: totals })]);
  return baseChart(viewModel, chart, options, {
    unit, valueColumn: valor.columnId, xType: 'categoria', yZero: true,
    eixos: { x: { titulo: axisUnit(unit, valueColumn) }, y: { titulo: dimension.label, categorias: points.map((point) => ({ key: point.xKey, label: point.xLabel })) } },
    series: [{ key: 'barras', label: chart.title, slot: CHART_SLOTS.POS, oculto: false, cab: valueOfNode({ aggregates: totals }, cab), points }],
    referencia: total != null ? { label: `${prefix} geral`, valor: total, text: fmt(total) } : null,
    total: { valor: total, text: fmt(total), cab: valueOfNode({ aggregates: totals }, cab) },
    cobertura: coverageOf(prefix, validOf({ aggregates: totals }), valueOfNode({ aggregates: totals }, cab)),
    semValor: semValorItems.length ? { texto: `${chart.semValor ?? `Sem ${prefix}`}: ${semValorItems.map((item) => `${item.label} (${cabText(item.cab)})`).join(', ')}`, itens: semValorItems } : null,
    tabela: { cabecalho: [dimension.label, withUnit(prefix, unit ? `(${unit})` : null), 'Cab.', `Com ${prefix}`], linhas, valores, formatos: [null, valueColumn, INTEGER, INTEGER] },
    ...(valueColumn.type === 'gmd' ? { textoVazio: TEXTO_SEM_GMD } : {}),
  });
}

// Histograma: um valor por ANIMAL, faixas semiabertas [a, b); a soma das contagens = cabeças com valor.
function buildHistogram(viewModel, chart, options) {
  const { rows, resolve } = viewModel;
  const animalColumnId = viewModel.animalColumnId;
  const valueColumn = columnOf(viewModel, chart.valorAnimal);
  const isWeight = valueColumn?.type === 'weight';
  const unit = chart.unidade ?? valueColumn?.unit ?? null;
  const accessor = resolve(chart.valorAnimal);
  let items;
  if (chart.porAnimal === 'ultima') {
    items = ultimaPesagemPorAnimal(rows, resolve, animalColumnId, chart.valorAnimal);
  } else {
    items = [];
    for (const row of rows) {
      // M1: faixas de GMD só com o GMD CONFIAVEL — o do intervalo curto fica fora (conta como "Sem GMD").
      if (!entersGmdMath(valueColumn, row)) continue;
      const raw = accessor.valueOf(row);
      const value = isWeight ? measuredWeightOf({ peso: raw }) : toFiniteNumber(raw);
      if (value !== null) items.push({ key: row.id ?? String(items.length), row, value });
    }
  }
  const animal = animalColumnId ? resolve(animalColumnId) : null;
  const animals = animal ? countDistinct(rows, (row) => animal.groupKeyOf(row)).value : rows.length;
  const largura = options.faixa?.largura ?? null;
  let bands;
  let counts;
  if (largura === 'categorias') {
    // Faixas das categorias = a coluna "Faixa de peso" do relatório (mesmo recorte do tipo "Por Faixa de Peso").
    const nodes = groupRows(items.map((item) => item.row), [{ columnId: 'faixa_peso' }], resolve).nodes;
    // E1G etapa 2: a faixa da categoria é um grupo da folha — o clique abre o detalhe dela (mesma chave).
    bands = nodes.map((node) => ({ key: node.key, label: node.label, short: node.label.split(' (')[0], lo: null, hi: null, drill: node.path.map(({ columnId, key, label }) => ({ columnId, key, label })) }));
    counts = new Map(nodes.map((node) => [node.key, node.rowCount]));
  } else {
    bands = chart.faixasFixas ? chart.faixasFixas.map((band) => ({ ...band, short: band.short ?? band.label })) : faixasDePeso(items.map((item) => item.value), largura ?? 'auto', unit ?? '');
    counts = new Map(bands.map((band) => [band.key, 0]));
    for (const item of items) {
      const band = faixaDe(item.value, bands);
      if (band) counts.set(band.key, counts.get(band.key) + 1);
    }
  }
  const points = bands.map((band, index) => {
    const count = counts.get(band.key) ?? 0;
    return {
      xKey: band.key, x: index, xLabel: band.label, lo: band.lo, hi: band.hi, y: count, text: intText(count), cab: count,
      barLabel: count ? intText(count) : '', rotulo: cabText(count), tooltip: `${band.label}: ${cabText(count)}`,
      faixa: band.lo != null || band.hi != null ? { columnId: chart.valorAnimal, lo: band.lo, hi: band.hi } : null,
      ...(band.tone ? { tone: band.tone } : {}),
      ...(band.drill ? { drill: band.drill } : {}),
    };
  });
  const counted = points.reduce((sum, point) => sum + point.y, 0);
  const mean = isWeight && items.length ? avg(items, (item) => item.value).value : null;
  const meanColumn = isWeight ? aggregateValueColumn({ op: 'avg', columnId: valueColumn.id }, [valueColumn]) : null;
  const prefix = valueColumn?.type === 'gmd' ? 'GMD' : 'Peso';
  const missingCount = animals - items.length;
  return baseChart(viewModel, chart, options, {
    unit: 'cab.', valueColumn: chart.valorAnimal, xType: 'faixa', yZero: true,
    eixos: { x: { titulo: unit, categorias: bands.map((band) => ({ key: band.key, label: band.label, short: band.short, lo: band.lo, hi: band.hi })) }, y: { titulo: 'cab.' } },
    series: [{ key: 'cabecas', label: 'Cabeças', slot: 1, oculto: false, cab: counted, points }],
    referencia: mean != null && largura !== 'categorias' ? { label: chart.porAnimal === 'ultima' ? 'Peso médio (última pesagem)' : 'Peso médio', valor: mean, text: sheetNumberText(meanColumn, mean, { op: 'avg' }) } : null,
    total: { valor: counted, text: intText(counted), cab: counted },
    cobertura: coverageOf(prefix, items.length, animals),
    semValor: missingCount > 0 ? { texto: `${chart.semValor ?? `Sem ${prefix}`}: ${cabText(missingCount)}`, itens: [{ key: 'sem-valor', label: `Sem ${prefix}`, cab: missingCount }] } : null,
    vazio: counted === 0,
    textoVazio: valueColumn?.type === 'gmd' ? TEXTO_SEM_GMD : `Nenhum animal com ${prefix.toLowerCase()} ${viewModel.period ? 'no período e nos filtros aplicados' : 'nos filtros aplicados'}.`,
    tabela: {
      cabecalho: ['Faixa', 'Cab.'],
      linhas: [...points.map((point) => [point.xLabel, point.text]), ['Total', intText(counted)]],
      valores: [...points.map((point) => [null, point.y]), [null, counted]],
      formatos: [null, INTEGER],
    },
  });
}

// Halteres: peso inicial × final por grupo, só animais com par válido (ganho ≠ vazio) — final − inicial = ganho médio.
function buildDumbbell(viewModel, chart, options) {
  const { rows, resolve } = viewModel;
  const dimension = options.serie;
  const { inicio, fim, ganho, gmd, cab } = chart;
  const specs = [inicio, fim, ganho, gmd, cab];
  const gain = resolve(ganho.columnId);
  const valid = rows.filter((row) => toFiniteNumber(gain.valueOf(row)) !== null);
  const nodes = groupRows(valid, [{ columnId: dimension.columnId }], resolve, { aggregates: specs }).nodes;
  const totals = computeAggregates(valid, specs, resolve);
  const weightColumn = valueColumnOf(viewModel, inicio);
  const gainColumn = valueColumnOf(viewModel, ganho);
  const gmdColumn = valueColumnOf(viewModel, gmd);
  const kg = (value, spec) => sheetNumberText(weightColumn, value, { op: spec.op });
  const signed = (value) => { const text = sheetNumberText(gainColumn, value, { op: ganho.op }); return value > 0 ? `+${text}` : text; };
  const rotuloOf = (node) => `${signed(valueOfNode(node, ganho))} · ${withUnit(sheetNumberText(gmdColumn, valueOfNode(node, gmd), { op: gmd.op }), 'kg/dia')} · ${cabText(valueOfNode(node, cab))}`;
  const startPoints = nodes.map((node) => ({ xKey: node.key, x: null, xLabel: node.label, y: valueOfNode(node, inicio), text: kg(valueOfNode(node, inicio), inicio), cab: valueOfNode(node, cab) }));
  const endPoints = nodes.map((node) => {
    const from = valueOfNode(node, inicio);
    const to = valueOfNode(node, fim);
    return {
      xKey: node.key, x: null, xLabel: node.label, y: to, text: kg(to, fim), cab: valueOfNode(node, cab), rotulo: rotuloOf(node),
      tone: to != null && from != null && to < from ? CHART_SLOTS.NEG : undefined,
      tooltip: `${node.label}: ${kg(from, inicio)} → ${kg(to, fim)} · ${rotuloOf(node)}`,
      drill: node.path.map(({ columnId, key, label }) => ({ columnId, key, label })),
    };
  });
  for (const point of endPoints) if (point.tone === undefined) delete point.tone;
  const all = groupRows(rows, [{ columnId: dimension.columnId }], resolve, { aggregates: [cab] }).nodes;
  const present = new Set(nodes.map((node) => node.key));
  const semPar = all.filter((node) => !present.has(node.key)).map((node) => ({ key: node.key, label: node.label, cab: valueOfNode(node, cab) }));
  const row = (label, node) => [label, kg(valueOfNode(node, inicio), inicio), kg(valueOfNode(node, fim), fim), signed(valueOfNode(node, ganho)), sheetNumberText(gmdColumn, valueOfNode(node, gmd), { op: gmd.op }), intText(valueOfNode(node, cab))];
  const raw = (node) => [null, valueOfNode(node, inicio), valueOfNode(node, fim), valueOfNode(node, ganho), valueOfNode(node, gmd), valueOfNode(node, cab)];
  const allAnimals = computeAggregates(rows, [cab], resolve);
  return baseChart(viewModel, chart, options, {
    unit: 'kg', valueColumn: fim.columnId, xType: 'categoria', yZero: false,
    eixos: { x: { titulo: 'kg' }, y: { titulo: dimension.label, categorias: nodes.map((node) => ({ key: node.key, label: node.label })) } },
    series: [
      { key: 'inicial', label: 'Peso inicial', slot: CHART_SLOTS.NEUTRO, oculto: false, cab: null, points: startPoints },
      { key: 'final', label: 'Peso final', slot: 1, oculto: false, cab: valueOfNode({ aggregates: totals }, cab), points: endPoints },
    ],
    total: { valor: valueOfNode({ aggregates: totals }, ganho), text: signed(valueOfNode({ aggregates: totals }, ganho)), cab: valueOfNode({ aggregates: totals }, cab) },
    cobertura: coverageOf(null, valueOfNode({ aggregates: totals }, cab) ?? 0, valueOfNode({ aggregates: allAnimals }, cab), `${intText(valueOfNode({ aggregates: totals }, cab) ?? 0)} de ${intText(valueOfNode({ aggregates: allAnimals }, cab))} cab. com duas pesagens`),
    semValor: semPar.length ? { texto: `${chart.semValor ?? 'Sem duas pesagens'}: ${semPar.map((item) => `${item.label} (${cabText(item.cab)})`).join(', ')}`, itens: semPar } : null,
    tabela: {
      cabecalho: [dimension.label, 'Peso inicial', 'Peso final', 'Ganho médio', 'GMD (kg/dia)', 'Cab.'],
      linhas: [...nodes.map((node) => row(node.label, node)), row('Todos', { aggregates: totals })],
      valores: [...nodes.map(raw), raw({ aggregates: totals })],
      formatos: [null, weightColumn, weightColumn, gainColumn, gmdColumn, INTEGER],
    },
  });
}

/** Um gráfico com as opções já resolvidas (chartOptionsOf). */
export function buildReportChart(viewModel, chart, options) {
  if (chart.kind === CHART_KINDS.LINHA || chart.kind === CHART_KINDS.COLUNAS) return buildTimeChart(viewModel, chart, options);
  if (chart.kind === CHART_KINDS.BARRAS) return buildBarChart(viewModel, chart, options);
  if (chart.kind === CHART_KINDS.HISTOGRAMA) return buildHistogram(viewModel, chart, options);
  if (chart.kind === CHART_KINDS.HALTERES) return buildDumbbell(viewModel, chart, options);
  throw new Error(`gráficos: tipo desconhecido (${chart.kind})`);
}

/**
 * Gráficos do relatório calculados sobre o view model JÁ carregado (tela, impressão/PDF e XLSX chamam esta
 * mesma função — nenhuma volta ao banco).
 * @param viewModel resultado de runReport (rows, resolve, population, totals, arrobaDivisor)
 * @param definition a definição do relatório (definition.charts)
 * @param config { [chartId]: { serie?, eixo?, metrica?, faixa?, oculto? } } (normalizeChartConfig)
 * @param role papel de quem vê (chartsOf)
 * @returns {object[]} ChartData[]
 */
export function buildReportCharts(viewModel, definition, config = {}, role = viewModel?.emittedBy?.role ?? null) {
  if (!viewModel || typeof viewModel.resolve !== 'function') throw new Error('gráficos: view model sem resolve (use o resultado de runReport)');
  if (definition?.id && viewModel.reportId && definition.id !== viewModel.reportId) throw new Error(`gráficos: definição ${definition.id} não é a do view model (${viewModel.reportId})`);
  const { config: normalized } = normalizeChartConfig(definition, config);
  return chartsOf(definition, role).map((chart) => buildReportChart(viewModel, chart, chartOptionsOf(chart, normalized, viewModel)));
}

// ---------------------------------------------------------------------------------------------------------
// E1G etapa 2 — estado da tela: vista "Folha | Gráficos" e configuração dos gráficos (modelos, último estado)
// ---------------------------------------------------------------------------------------------------------

export const CHART_DISPLAYS = Object.freeze({ FOLHA: 'folha', GRAFICOS: 'graficos' });
export const DEFAULT_DISPLAY = CHART_DISPLAYS.FOLHA;

/** A vista que vale: "Gráficos" só num relatório com gráficos que o papel vê; qualquer outra coisa é a folha. */
export function displayOf(definition, display, role = null) {
  if (display !== CHART_DISPLAYS.GRAFICOS) return CHART_DISPLAYS.FOLHA;
  return (role ? chartsOf(definition, role) : definition?.charts ?? []).length ? CHART_DISPLAYS.GRAFICOS : CHART_DISPLAYS.FOLHA;
}

/**
 * display/charts de um modelo ou do último estado, SÓ quando diferentes do padrão (modelo sem gráficos guarda
 * exatamente as chaves de antes — verify-reports-templates). Vista desconhecida, "Gráficos" num relatório sem
 * gráficos, gráfico/opção desconhecidos: ficam fora, com aviso (quem grava decide se o aviso vira erro).
 * @returns {{ values: { display?: 'graficos', charts?: object }, warnings: { code, message }[] }}
 */
export function chartsStateOf(definition, { display, charts } = {}) {
  const warnings = [];
  const values = {};
  if (display != null && display !== '' && !Object.values(CHART_DISPLAYS).includes(display)) {
    warnings.push({ code: 'CHART_DISPLAY_INVALID', message: `Vista "${display}" não existe: o relatório abre na folha` });
  } else if (display === CHART_DISPLAYS.GRAFICOS) {
    if (definition?.charts?.length) values.display = CHART_DISPLAYS.GRAFICOS;
    else warnings.push({ code: 'CHART_DISPLAY_UNAVAILABLE', message: 'Este relatório não tem gráficos: ele abre na folha' });
  }
  const normalized = normalizeChartConfig(definition, charts);
  warnings.push(...normalized.warnings);
  if (Object.keys(normalized.config).length) values.charts = normalized.config;
  return { values, warnings };
}

function withChartEntry(config, chartId, entry) {
  const next = { ...(config ?? {}) };
  if (entry && Object.keys(entry).length) next[chartId] = entry;
  else delete next[chartId];
  return next;
}

/**
 * Configuração depois de uma escolha num controle do gráfico. A chave sai quando a escolha é a que o gráfico já
 * usaria sem ela (padrão; "Série" que segue o 1º nível do tipo) — voltar ao padrão não deixa o relatório
 * "alterado". Gráfico, controle ou opção desconhecidos: nada muda.
 */
export function chartConfigWith(definition, config, chartId, key, value, viewModel = null) {
  const chart = definition?.charts?.find((item) => item.id === chartId);
  const control = chart?.controls?.[key];
  if (!control || !control.choices.some((choice) => choice.id === value)) return config ?? {};
  const entry = { ...(config?.[chartId] ?? {}) };
  delete entry[key];
  const fallback = chartOptionsOf(chart, { [chartId]: entry }, viewModel)[key]?.id ?? null;
  if (value !== fallback) entry[key] = value;
  return withChartEntry(config, chartId, entry);
}

/** Legenda: esconde/mostra uma série (lista `oculto` do gráfico). */
export function chartConfigToggleSeries(config, chartId, seriesKey) {
  const entry = { ...(config?.[chartId] ?? {}) };
  const hidden = new Set(Array.isArray(entry.oculto) ? entry.oculto.map(String) : []);
  const key = String(seriesKey);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);
  if (hidden.size) entry.oculto = [...hidden];
  else delete entry.oculto;
  return withChartEntry(config, chartId, entry);
}

/**
 * O mesmo gráfico com outras séries ocultas, SEM recalcular (a tela liga/desliga séries na legenda sem voltar ao
 * motor; as cores não mudam — o slot é da entidade). Igual a buildReportChart com essas séries em `oculto`.
 */
export function withHiddenSeries(chart, oculto = []) {
  const hidden = [...new Set((oculto ?? []).map(String))];
  const series = chart.series.map((item) => ({ ...item, oculto: hidden.includes(item.key) }));
  const { oculto: _previous, ...config } = chart.config ?? {};
  return { ...chart, series, config: hidden.length ? { ...config, oculto: hidden } : config, legenda: series.filter(inLegend).length >= 2 };
}

/** Texto de um ponto na dica da tela: valor com unidade, cabeças e, no GMD, quantos têm GMD (texto da folha). */
export function chartPointText(chart, point) {
  if (!point) return '-';
  const unit = chart.kind === CHART_KINDS.HISTOGRAMA ? null : chart.unit;
  const parts = [withUnit(point.text, unit)];
  if (chart.kind !== CHART_KINDS.HISTOGRAMA && point.cab != null) parts.push(cabText(point.cab));
  if (unit === 'kg/dia' && point.cobertura?.validos != null && point.cobertura.validos !== point.cab) parts.push(`GMD de ${intText(point.cobertura.validos)}`);
  return parts.join(' · ');
}

export const CHART_DRILL_HINT = 'Clique para ver na folha';
const seriesByKey = (chart, key) => chart.series.find((series) => series.key === key) ?? null;
const pointByX = (series, xKey) => series?.points.find((point) => point.xKey === xKey) ?? null;

/**
 * Dica da tela para um alvo da camada de hover (chartScale.chartHoverTargets), com os textos do domínio (os mesmos
 * números da folha): linha → o x e uma linha por série visível; barra/coluna/faixa → o grupo e o valor.
 * @returns {{ title: string|null, slot?: number|string|null, lines?: string[], rows?: { key, slot, label, text }[] }}
 */
export function chartTargetTip(chart, target) {
  if (target.kind === 'x') {
    const rows = (target.items ?? []).map((item) => ({ key: item.key, slot: item.slot, label: item.label, text: chartPointText(chart, pointByX(seriesByKey(chart, item.key), target.xKey)) }));
    return { title: target.label, rows };
  }
  if (chart.kind === CHART_KINDS.HALTERES) {
    const start = pointByX(chart.series[0], target.xKey);
    const end = pointByX(chart.series[1], target.xKey);
    return { title: end?.xLabel ?? target.xKey, lines: [`${start?.text ?? '-'} → ${end?.text ?? '-'}`, end?.rotulo ?? ''].filter(Boolean) };
  }
  const series = seriesByKey(chart, target.key);
  const point = pointByX(series, target.xKey);
  if (!point) return { title: null, lines: [target.tooltip] };
  if (chart.kind === CHART_KINDS.BARRAS || chart.kind === CHART_KINDS.HISTOGRAMA) return { title: point.xLabel, lines: [point.rotulo ?? chartPointText(chart, point)] };
  const multi = chart.series.filter((item) => !item.oculto).length > 1;
  return { title: multi ? `${series.label} · ${point.xLabel}` : point.xLabel, slot: multi ? series.slot : null, lines: [chartPointText(chart, point)] };
}

/**
 * Caminho do detalhe de um alvo (o MESMO recorte do clique na folha — onDrill): barra/coluna/haltere → o grupo;
 * linha com uma série → o ponto (série × x); com várias → só o x. Sem caminho (faixa de peso, curva do animal) = null.
 */
export function chartTargetDrill(chart, target) {
  if (target.kind !== 'x') return target.drill?.length ? target.drill : null;
  const paths = (target.items ?? []).map((item) => pointByX(seriesByKey(chart, item.key), target.xKey)?.drill).filter((path) => path?.length);
  if (!paths.length) return null;
  return paths.length === 1 && (target.items ?? []).length === 1 ? paths[0] : paths[0].slice(-1);
}

/** Gráficos no manifesto da emissão: o que saiu (id, tipo, opções, séries e quantos pontos). */
export function chartsManifest(charts = []) {
  return charts.map((chart) => ({
    id: chart.id, kind: chart.kind, title: chart.title, config: chart.config,
    series: chart.series.map((series) => series.label),
    points: chart.series.reduce((sum, series) => sum + series.points.filter((point) => point.y != null).length, 0),
  }));
}
