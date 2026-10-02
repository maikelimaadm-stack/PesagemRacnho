// Família DESEMPENHO — grão ANIMAL_PERIOD: cada animal uma vez por período.
// GMD de grupo = Σ ganho ÷ Σ dias (ponderado), só animais com par válido de pesagens.
// E1 (1.4.0): "Desempenho" substitui individual, por lote, as seis dimensões, "Animais perdendo peso"
// e "Distribuição por faixa de peso" (aliases em legacyAliases.js).
import { defineReport } from '../domain/reportDefinition.js';
import { FAIXAS_GMD } from '../domain/chartDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_PERIOD_COLUMNS } from './columns/animalColumns.js';
import { listaTipo, resumoTipo } from './tipos.js';

export const PERFORMANCE_PERIOD_PARAM = Object.freeze({ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_90_dias' } });

// Totais completos (usados pelos aliases dos relatórios antigos de desempenho).
export const PERFORMANCE_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'pesagens', columnId: 'pesagens', op: 'sum' },
  { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
  { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
  // E1G: dias entre o peso inicial e o final — média (somar dias de animais diferentes não diz nada).
  { id: 'dias_medio', columnId: 'dias', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'gmd_simples', columnId: 'gmd', op: 'avg' },
]);

export const PERFORMANCE_METRIC_LABELS = Object.freeze({ dias_medio: 'Dias médios' });

export const PERFORMANCE_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'categoria', 'lote', 'pesagens', 'peso_inicial', 'peso_final', 'dias', 'ganho', 'gmd']);

// E1G (A2): o peso inicial é a última pesagem ANTES do período quando existe — o GMD do período bate com o Pesagens.
export const PERFORMANCE_NOTES = Object.freeze([
  'Uma linha por animal com pesagem no período. Peso inicial = última pesagem com peso antes do período (a pesagem anterior da primeira pesagem do período); sem ela, a primeira pesagem com peso do período. Peso final = última pesagem com peso do período.',
  'Ganho, dias e GMD existem quando há peso inicial e final em datas diferentes; sem isso aparecem como "-" e não entram no GMD.',
  'GMD do grupo = soma dos ganhos ÷ soma dos dias (ponderado) — o mesmo GMD do relatório Pesagens no período; GMD simples = média dos GMD individuais.',
]);

// E1E "Tipo Relatório" (definitions/tipos.js). Totais dos tipos = os dos antigos relatórios de desempenho
// (PERFORMANCE_TOTALS), na ordem da folha; "Pesagens" e "GMD simples" ficam só no "Colunas Painel".
const byId = (id) => PERFORMANCE_TOTALS.find((spec) => spec.id === id);
export const PERFORMANCE_TYPE_TOTALS = Object.freeze(['animais', 'peso_inicial_medio', 'peso_final_medio', 'ganho_total', 'ganho_medio', 'dias_medio', 'gmd_ponderado', 'pesagens', 'gmd_simples'].map(byId));
export const PERFORMANCE_TYPE_DEFAULTS = Object.freeze(['animais', 'peso_inicial_medio', 'peso_final_medio', 'ganho_total', 'ganho_medio', 'dias_medio', 'gmd_ponderado']);
// "Perdendo Peso" = o antigo "Animais perdendo peso": ganho < 0 é condição do tipo (população, com cadeado).
export const PERDENDO_PESO_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'lote', 'data_inicial', 'peso_inicial', 'data_final', 'peso_final', 'dias', 'ganho', 'gmd']);
export const PERDENDO_PESO_POPULATION = Object.freeze({ ganho: { operator: 'less', value: '0' } });
// E1G: padrão até a 1.4.1 (sem Dias Médios) — o último estado gravado com ele abre com o padrão de hoje.
export const PERFORMANCE_TOTALS_141 = Object.freeze(['animais', 'peso_inicial_medio', 'peso_final_medio', 'ganho_total', 'ganho_medio', 'gmd_ponderado', 'pesagens', 'gmd_simples']);
export const PERFORMANCE_TYPE_DEFAULTS_141 = Object.freeze(['animais', 'peso_inicial_medio', 'peso_final_medio', 'ganho_total', 'ganho_medio', 'gmd_ponderado']);
const perf = (id, label, groups) => resumoTipo(id, label, groups, PERFORMANCE_TYPE_TOTALS, { defaults: PERFORMANCE_TYPE_DEFAULTS, previousDefaults: [PERFORMANCE_TYPE_DEFAULTS_141] });
export const DESEMPENHO_DEFAULT_VIEW = 'por-lote';
export const DESEMPENHO_VIEWS = Object.freeze([
  perf('por-lote', 'Por Lote', ['lote']),
  // = o antigo "Desempenho por lote" (apartação › lote).
  perf('por-apartacao-lote', 'Por Apartação/Lote', ['apartacao', 'lote']),
  perf('por-apartacao', 'Por Apartação', ['apartacao']),
  perf('por-categoria', 'Por Categoria', ['categoria']),
  perf('por-raca', 'Por Raça', ['raca']),
  perf('por-marca', 'Por Marca', ['marca']),
  perf('por-sexo', 'Por Sexo', ['sexo']),
  perf('por-faixa-peso', 'Por Faixa de Peso', ['faixa_peso']),
  // = o antigo "Desempenho individual".
  listaTipo('analitico', 'Analítico (Animal por Animal)', { from: ANIMAL_PERIOD_COLUMNS, columns: PERFORMANCE_COLUMNS, aggregates: PERFORMANCE_TYPE_TOTALS, previousAggregates: [PERFORMANCE_TOTALS_141], sort: [{ columnId: 'animal', direction: 'asc' }] }),
  listaTipo('perdendo-peso', 'Perdendo Peso', { from: ANIMAL_PERIOD_COLUMNS, columns: PERDENDO_PESO_COLUMNS, aggregates: PERFORMANCE_TYPE_TOTALS, previousAggregates: [PERFORMANCE_TOTALS_141], sort: [{ columnId: 'ganho', direction: 'asc' }], population: PERDENDO_PESO_POPULATION }),
]);

// E1G — gráficos do Desempenho (domain/reportCharts): mesmos specs dos totais da folha (PERFORMANCE_TOTALS), um
// valor por animal. GMD = o gmd_ponderado da folha (soma dos ganhos ÷ soma dos dias dos animais com par).
const CHART_CAB = byId('animais');
const CHART_GROUPS = Object.freeze([
  { id: 'lote', label: 'Lote', columnId: 'lote' },
  { id: 'apartacao', label: 'Apartação', columnId: 'apartacao' },
  { id: 'sexo', label: 'Sexo', columnId: 'sexo' },
  { id: 'raca', label: 'Raça', columnId: 'raca' },
  { id: 'categoria', label: 'Categoria', columnId: 'categoria' },
  { id: 'marca', label: 'Marca', columnId: 'marca' },
  { id: 'faixa-peso', label: 'Faixa de peso', columnId: 'faixa_peso' },
]);
const CHART_BAND_WIDTHS = Object.freeze([
  { id: 'auto', label: 'Automática', largura: 'auto' },
  ...[10, 15, 20, 25, 30, 50].map((largura) => ({ id: String(largura), label: `${largura} kg`, largura })),
  { id: 'categorias', label: 'Faixas das categorias', largura: 'categorias' },
]);
const GMD_PERIODO = 'GMD do período de cada animal (ganho ÷ dias), ponderado';
export const DESEMPENHO_CHARTS = Object.freeze([
  {
    id: 'gmd-por-grupo', kind: 'barras', title: 'GMD médio por grupo', subtitle: GMD_PERIODO, unidade: 'kg/dia',
    controls: { serie: { label: 'Agrupar por', default: 'lote', choices: CHART_GROUPS } },
    valor: byId('gmd_ponderado'), cab: CHART_CAB, semValor: 'Sem GMD',
    notas: ['Sem GMD = animal sem duas pesagens com peso para comparar, ou com intervalo curto (GMD em cinza na folha, fora da média).'],
  },
  {
    id: 'peso-inicial-final', kind: 'halteres', title: 'Peso inicial × peso final', subtitle: 'Só animais com duas pesagens com peso: a diferença é o ganho médio da folha',
    controls: { serie: { label: 'Agrupar por', default: 'lote', choices: CHART_GROUPS } },
    inicio: byId('peso_inicial_medio'), fim: byId('peso_final_medio'), ganho: byId('ganho_medio'), gmd: byId('gmd_ponderado'), cab: CHART_CAB,
    semValor: 'Sem duas pesagens',
  },
  {
    id: 'faixas-gmd', kind: 'histograma', title: 'Animais por faixa de GMD', subtitle: GMD_PERIODO,
    valorAnimal: 'gmd', porAnimal: 'linha', faixasFixas: FAIXAS_GMD, unidade: 'kg/dia', semValor: 'Sem GMD',
  },
  {
    id: 'distribuicao-peso', kind: 'histograma', title: 'Distribuição do peso final', subtitle: 'Peso final (última pesagem com peso no período) de cada animal',
    valorAnimal: 'peso_final', porAnimal: 'linha', unidade: 'kg', semValor: 'Sem peso',
    controls: { faixa: { label: 'Faixa', default: 'auto', choices: CHART_BAND_WIDTHS } },
  },
]);

export const DESEMPENHO = defineReport({
  id: 'desempenho',
  family: 'desempenho',
  grain: GRAINS.ANIMAL_PERIOD,
  // 2 (E1E): ganhou os tipos (ver rebanho.js).
  version: 2,
  // E1G: padrões dos tipos, revisão 2 = "Dias médios". Estado/modelo gravado sem essa marca (1.4.0/1.4.1, modelos
  // 1.3.x convertidos) com o padrão antigo abre com o novo (reportTemplateService.upgradedTypeAggregates).
  defaultsVersion: 2,
  source: 'animals.period',
  requires: ['reports.read', 'weighing.read'],
  title: 'Desempenho',
  description: 'Peso inicial e final, ganho e GMD do período — por lote, categoria, raça, marca ou animal por animal.',
  metrics: ['Cabeças', 'Peso inicial/final', 'Ganho', 'GMD'],
  params: [PERFORMANCE_PERIOD_PARAM, { id: 'faixas', type: 'ranges', label: 'Faixas de peso', default: null }],
  columns: ANIMAL_PERIOD_COLUMNS,
  animalColumnId: 'animal',
  searchColumns: ['animal', 'marca', 'raca', 'lote'],
  defaultColumns: [...PERFORMANCE_COLUMNS],
  defaultSort: [{ columnId: 'animal', direction: 'asc' }],
  defaultGroups: [{ columnId: 'lote' }],
  // Ordem = colunas do Resumido: Lote | Cabeças | Peso inicial médio | Peso final médio | Ganho total | Ganho médio | Dias médios | GMD.
  defaultAggregates: [
    { id: 'animais', columnId: 'animal', op: 'countDistinct' },
    { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
    { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
    { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
    { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
    { id: 'dias_medio', columnId: 'dias', op: 'avg' },
    { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  ],
  metricLabels: PERFORMANCE_METRIC_LABELS,
  quickGroups: ['lote', 'apartacao', 'categoria', 'raca', 'marca', 'sexo', 'faixa_peso'],
  quickFilters: [
    { id: 'perdendo-peso', label: 'Somente perdendo peso', filters: { ganho: { operator: 'less', value: '0' } } },
  ],
  views: DESEMPENHO_VIEWS,
  defaultView: DESEMPENHO_DEFAULT_VIEW,
  // E1G: vista "Gráficos".
  charts: DESEMPENHO_CHARTS,
  notes: [...PERFORMANCE_NOTES],
});
