// E1G — declaração e validação dos GRÁFICOS de um relatório (docs/plano-mestre/E1G-GMD-E-GRAFICOS.md, Parte B).
// Módulo separado de reportCharts.js de propósito: defineReport (reportDefinition.js) chama defineCharts, e o
// cálculo dos gráficos (reportCharts.js) lê o formatador da folha (reportDocument.js), que importa as definições —
// juntos, os dois formariam um ciclo de import que quebra a carga das definições. reportCharts.js reexporta tudo.
//
// Um gráfico declara só SELEÇÃO sobre colunas do relatório (nenhuma conta nova): os números saem do mesmo motor
// da folha (groupRows/computeAggregates) com os mesmos specs { id, columnId, op }. Regras (lançam Error):
//   - ids únicos; tipo conhecido; título;
//   - toda coluna citada existe no grão do relatório; série/eixo/grupo em coluna agrupável;
//   - operação permitida na coluna (column.aggregations);
//   - NENHUMA coluna sensível (valor, preço, carcaça) — gráfico é para todo perfil que abre o relatório.
// Gráfico `opcional` cuja coluna ainda não existe no grão fica FORA, com aviso em definition.chartsSkipped
// (ex.: GMD do Rebanho atual, que vem da trilha GMD da E1G — o merge funciona nas duas ordens).
import { grainHasAnimal } from './reportGrain.js';

export const CHART_KINDS = Object.freeze({ LINHA: 'linha', BARRAS: 'barras', COLUNAS: 'colunas', HISTOGRAMA: 'histograma', HALTERES: 'halteres' });

// Controles de um gráfico (mesmos ids no estado da tela, nos modelos e no manifesto):
//   serie   Série (linha/colunas) ou "Agrupar por" (barras/halteres) — { id, label, columnId|null }
//   eixo    eixo de tempo — { id, label, columnId, tempo: 'mes'|'data'|'sessao' }
//   metrica o que o gráfico mostra — { id, label, valor: spec, cobertura?: spec, unidade, titulo?, nota?, yZero? }
//   faixa   largura das faixas do histograma — { id, label, largura: número (kg) | 'auto' | 'categorias' }
export const CHART_CONTROL_IDS = Object.freeze(['serie', 'eixo', 'metrica', 'faixa']);
export const CHART_TIME_AXES = Object.freeze(['mes', 'data', 'sessao']);
export const CHART_UNITS = Object.freeze(['kg', '@', 'kg/dia', 'cab.']);

// Faixas de GMD de curral (kg/dia) do gráfico "Animais por faixa de GMD": [lo, hi), abertas nas pontas; a de
// perda de peso usa o vermelho reservado (tone 'neg').
export const FAIXAS_GMD = Object.freeze([
  Object.freeze({ key: 'menor-0', label: 'Menos de 0 (perdendo peso)', short: '< 0', lo: null, hi: 0, tone: 'neg' }),
  Object.freeze({ key: '0-0,3', label: '0 a 0,3 kg/dia', short: '0–0,3', lo: 0, hi: 0.3 }),
  Object.freeze({ key: '0,3-0,6', label: '0,3 a 0,6 kg/dia', short: '0,3–0,6', lo: 0.3, hi: 0.6 }),
  Object.freeze({ key: '0,6-0,9', label: '0,6 a 0,9 kg/dia', short: '0,6–0,9', lo: 0.6, hi: 0.9 }),
  Object.freeze({ key: '0,9-1,2', label: '0,9 a 1,2 kg/dia', short: '0,9–1,2', lo: 0.9, hi: 1.2 }),
  Object.freeze({ key: '1,2-mais', label: '1,2 kg/dia ou mais', short: '≥ 1,2', lo: 1.2, hi: null }),
]);

const CHART_KEYS = new Set(['id', 'kind', 'title', 'subtitle', 'controls', 'valor', 'cab', 'cobertura', 'valorAnimal', 'porAnimal', 'faixasFixas', 'inicio', 'fim', 'ganho', 'gmd', 'notas', 'opcional', 'semValor', 'maxSeries', 'unidade']);
const CHOICE_KEYS = new Set(['id', 'label', 'columnId', 'tempo', 'valor', 'cobertura', 'unidade', 'titulo', 'nota', 'yZero', 'largura']);
const POR_ANIMAL = new Set(['ultima', 'linha']);
const REQUIRED_CONTROLS = Object.freeze({
  linha: ['serie', 'eixo', 'metrica'],
  colunas: ['eixo', 'metrica'],
  barras: ['serie'],
  histograma: [],
  halteres: ['serie'],
});

const cloneFrozen = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozen));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneFrozen(item)])));
  return value;
};

// Coluna ausente num gráfico opcional: não é erro de declaração, o gráfico só fica fora (com aviso).
class MissingChartColumn extends Error {
  constructor(message, columnId, motivo = null) {
    super(message);
    this.columnId = columnId;
    this.motivo = motivo;
  }
}

/**
 * Valida as declarações de gráficos de um relatório.
 * @param charts lista declarada na definição (ou null)
 * @param byId Map id → coluna do relatório (indexColumns)
 * @param {{ context: string, grain: string, aggregates?: object[] }} options aggregates = totais da definição e
 *   dos tipos — o spec sem columnId ({ op: 'weightedGmd' }) usa o total da FOLHA com essa operação (mesmo id).
 * @returns {{ charts: object[], skipped: { id: string, motivo: string }[] }}
 */
export function defineCharts(charts, byId, { context = 'relatório', grain = null, aggregates = [] } = {}) {
  if (charts == null) return { charts: Object.freeze([]), skipped: Object.freeze([]) };
  if (!Array.isArray(charts)) throw new Error(`${context}: charts deve ser lista`);
  const seen = new Set();
  const out = [];
  const skipped = [];
  for (const chart of charts) {
    if (!chart?.id || typeof chart.id !== 'string') throw new Error(`${context}: gráfico sem id`);
    const where = `${context} gráfico ${chart.id}`;
    if (seen.has(chart.id)) throw new Error(`${context}: gráfico duplicado (${chart.id})`);
    seen.add(chart.id);
    try {
      out.push(defineChart(chart, byId, { where, grain, aggregates }));
    } catch (error) {
      if (!(error instanceof MissingChartColumn) || !chart.opcional) throw error;
      skipped.push(Object.freeze({ id: chart.id, motivo: `${error.motivo ?? `coluna ${error.columnId} ainda não existe neste relatório`} — gráfico "${chart.title}" fora` }));
    }
  }
  return { charts: Object.freeze(out), skipped: Object.freeze(skipped) };
}

function defineChart(chart, byId, { where, grain, aggregates }) {
  for (const key of Object.keys(chart)) if (!CHART_KEYS.has(key)) throw new Error(`${where}: chave desconhecida (${key})`);
  if (!Object.values(CHART_KINDS).includes(chart.kind)) throw new Error(`${where}: tipo inválido (${chart.kind})`);
  if (!chart.title || typeof chart.title !== 'string') throw new Error(`${where}: título obrigatório`);
  if (chart.subtitle != null && typeof chart.subtitle !== 'string') throw new Error(`${where}: subtitle deve ser texto`);
  if (chart.notas != null && (!Array.isArray(chart.notas) || chart.notas.some((nota) => typeof nota !== 'string' || !nota.trim()))) throw new Error(`${where}: notas deve ser lista de textos`);
  if (chart.unidade != null && !CHART_UNITS.includes(chart.unidade)) throw new Error(`${where}: unidade inválida (${chart.unidade})`);
  if (chart.maxSeries != null && (!Number.isInteger(chart.maxSeries) || chart.maxSeries < 1 || chart.maxSeries > 7)) throw new Error(`${where}: maxSeries entre 1 e 7`);
  const columnIds = new Set();
  const column = (columnId, label) => {
    if (!columnId || typeof columnId !== 'string') throw new Error(`${where}: ${label} sem coluna`);
    const found = byId.get(columnId);
    if (!found) throw new MissingChartColumn(`${where}: ${label} em coluna desconhecida (${columnId})`, columnId);
    // Gráfico é para todo perfil que abre o relatório: nunca valor/preço/carcaça (nem por um controle).
    if (found.sensitive) throw new Error(`${where}: coluna sensível não entra em gráfico (${columnId})`);
    columnIds.add(columnId);
    return found;
  };
  const spec = (value, label, { optionalColumn = false } = {}) => {
    if (!value || typeof value !== 'object' || !value.op) throw new Error(`${where}: ${label} sem operação`);
    let resolved = { ...value };
    if (!resolved.columnId && resolved.op !== 'count') {
      // "O total da folha com esta operação" (mesmo id e coluna da folha): o gráfico bate com ela por construção.
      const fromSheet = aggregates.find((item) => item?.op === resolved.op && item.columnId && byId.has(item.columnId) && !byId.get(item.columnId).sensitive);
      if (!fromSheet) {
        if (optionalColumn) return null;
        throw new MissingChartColumn(`${where}: ${label} (${resolved.op}) sem total da folha com essa operação`, null, `a folha ainda não tem total ${resolved.op} (coluna de ${label})`);
      }
      resolved = { ...resolved, id: resolved.id ?? fromSheet.id, columnId: fromSheet.columnId };
    }
    if (resolved.op === 'count' && !resolved.columnId) return Object.freeze({ id: resolved.id ?? 'registros', op: 'count' });
    const found = column(resolved.columnId, label);
    if (resolved.op !== 'count' && !(found.aggregations ?? []).includes(resolved.op)) throw new Error(`${where}: ${label} com operação ${resolved.op} não permitida em ${found.id}`);
    if (resolved.op === 'countDistinct' && resolved.columnId === 'animal' && !grainHasAnimal(grain)) throw new Error(`${where}: animais únicos só em grãos com animal`);
    return Object.freeze({ id: resolved.id ?? `${resolved.op}:${resolved.columnId}`, columnId: resolved.columnId, op: resolved.op });
  };

  const controls = {};
  const declared = chart.controls ?? {};
  if (typeof declared !== 'object' || Array.isArray(declared)) throw new Error(`${where}: controls deve ser objeto`);
  for (const id of Object.keys(declared)) if (!CHART_CONTROL_IDS.includes(id)) throw new Error(`${where}: controle desconhecido (${id})`);
  for (const id of REQUIRED_CONTROLS[chart.kind]) if (!declared[id]) throw new Error(`${where}: o tipo ${chart.kind} exige o controle ${id}`);
  for (const [id, control] of Object.entries(declared)) {
    const at = `${where} controle ${id}`;
    if (!control?.label || !Array.isArray(control.choices) || !control.choices.length) throw new Error(`${at}: exige label e choices`);
    const ids = new Set();
    const choices = control.choices.map((choice) => {
      if (!choice?.id || !choice.label) throw new Error(`${at}: opção sem id/rótulo`);
      for (const key of Object.keys(choice)) if (!CHOICE_KEYS.has(key)) throw new Error(`${at}: opção ${choice.id} com chave desconhecida (${key})`);
      if (ids.has(choice.id)) throw new Error(`${at}: opção repetida (${choice.id})`);
      ids.add(choice.id);
      if (id === 'serie') {
        if (choice.columnId == null) {
          if (![CHART_KINDS.LINHA, CHART_KINDS.COLUNAS].includes(chart.kind)) throw new Error(`${at}: "${choice.label}" sem coluna só em linha/colunas`);
          return { id: choice.id, label: choice.label, columnId: null };
        }
        if (!column(choice.columnId, `série ${choice.id}`).groupable) throw new Error(`${at}: ${choice.columnId} não é agrupável`);
        return { id: choice.id, label: choice.label, columnId: choice.columnId };
      }
      if (id === 'eixo') {
        if (!CHART_TIME_AXES.includes(choice.tempo)) throw new Error(`${at}: eixo ${choice.id} sem tempo válido (${CHART_TIME_AXES.join('/')})`);
        if (!column(choice.columnId, `eixo ${choice.id}`).groupable) throw new Error(`${at}: ${choice.columnId} não é agrupável`);
        return { id: choice.id, label: choice.label, columnId: choice.columnId, tempo: choice.tempo };
      }
      if (id === 'metrica') {
        if (choice.unidade != null && !CHART_UNITS.includes(choice.unidade)) throw new Error(`${at}: unidade inválida (${choice.unidade})`);
        return {
          id: choice.id, label: choice.label, valor: spec(choice.valor, `valor de ${choice.id}`),
          ...(choice.cobertura ? { cobertura: spec(choice.cobertura, `cobertura de ${choice.id}`) } : {}),
          unidade: choice.unidade ?? null, titulo: choice.titulo ?? null, nota: choice.nota ?? null, yZero: Boolean(choice.yZero),
        };
      }
      // faixa
      const largura = choice.largura;
      if (!(largura === 'auto' || largura === 'categorias' || (Number.isFinite(largura) && largura > 0))) throw new Error(`${at}: largura inválida (${largura})`);
      return { id: choice.id, label: choice.label, largura };
    });
    const fallback = control.default ?? choices[0].id;
    if (!ids.has(fallback)) throw new Error(`${at}: padrão ${fallback} fora das opções`);
    controls[id] = { label: control.label, default: fallback, choices };
  }

  const result = { id: chart.id, kind: chart.kind, title: chart.title, subtitle: chart.subtitle ?? null, notas: [...(chart.notas ?? [])], opcional: Boolean(chart.opcional), unidade: chart.unidade ?? null, controls };
  if (chart.maxSeries != null) result.maxSeries = chart.maxSeries;
  if (chart.cab) result.cab = spec(chart.cab, 'cabeças');
  if (chart.valor) result.valor = spec(chart.valor, 'valor');
  if (chart.cobertura) result.cobertura = spec(chart.cobertura, 'cobertura');
  if (chart.semValor != null) {
    if (typeof chart.semValor !== 'string' || !chart.semValor.trim()) throw new Error(`${where}: semValor deve ser texto`);
    result.semValor = chart.semValor;
  }
  if ([CHART_KINDS.LINHA, CHART_KINDS.COLUNAS, CHART_KINDS.BARRAS, CHART_KINDS.HALTERES].includes(chart.kind) && !result.cab) throw new Error(`${where}: o tipo ${chart.kind} exige cab (cabeças)`);
  if (chart.kind === CHART_KINDS.BARRAS && !result.valor) throw new Error(`${where}: barras exigem valor`);
  if (chart.kind === CHART_KINDS.HISTOGRAMA) {
    const valueColumn = column(chart.valorAnimal, 'valor por animal');
    if (!['weight', 'gmd', 'number', 'integer'].includes(valueColumn.type)) throw new Error(`${where}: histograma sobre coluna numérica (${chart.valorAnimal} é ${valueColumn.type})`);
    if (!POR_ANIMAL.has(chart.porAnimal)) throw new Error(`${where}: porAnimal deve ser ${[...POR_ANIMAL].join(' ou ')}`);
    if (chart.porAnimal === 'ultima' && !grainHasAnimal(grain)) throw new Error(`${where}: última pesagem por animal exige grão com animal`);
    result.valorAnimal = chart.valorAnimal;
    result.porAnimal = chart.porAnimal;
    if (chart.faixasFixas != null) {
      if (!Array.isArray(chart.faixasFixas) || chart.faixasFixas.length < 2) throw new Error(`${where}: faixasFixas deve ter 2 ou mais faixas`);
      result.faixasFixas = chart.faixasFixas.map((band, index) => {
        if (!band?.key || !band.label) throw new Error(`${where}: faixa fixa ${index} sem key/label`);
        if (band.lo != null && band.hi != null && !(band.lo < band.hi)) throw new Error(`${where}: faixa fixa ${band.key} com lo ≥ hi`);
        return { key: band.key, label: band.label, short: band.short ?? band.label, lo: band.lo ?? null, hi: band.hi ?? null, ...(band.tone ? { tone: band.tone } : {}) };
      });
      if (controls.faixa) throw new Error(`${where}: faixasFixas não combina com o controle faixa`);
    } else if (!controls.faixa) {
      throw new Error(`${where}: histograma exige o controle faixa ou faixasFixas`);
    }
    if (controls.faixa?.choices.some((choice) => choice.largura === 'categorias') && !byId.get('faixa_peso')?.groupable) {
      throw new Error(`${where}: "faixas das categorias" exige a coluna faixa_peso`);
    }
    if (controls.faixa?.choices.some((choice) => choice.largura === 'categorias')) columnIds.add('faixa_peso');
  }
  if (chart.kind === CHART_KINDS.HALTERES) {
    result.inicio = spec(chart.inicio, 'peso inicial');
    result.fim = spec(chart.fim, 'peso final');
    result.ganho = spec(chart.ganho, 'ganho');
    result.gmd = spec(chart.gmd, 'GMD');
  }
  result.columnIds = [...columnIds];
  return cloneFrozen(result);
}

/** Colunas que os gráficos da definição citam (todas as opções): base do assertCanExport das exportações. */
export function chartColumnIds(definition) {
  return [...new Set((definition?.charts ?? []).flatMap((chart) => chart.columnIds ?? []))];
}
