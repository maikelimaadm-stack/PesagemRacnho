// Família REBANHO — grão ANIMAL_CURRENT (projeção `animais`; não reconstrói histórico).
// E1 (1.4.0): "Rebanho atual" substitui o inventário, os oito "Rebanho por …" e "Animais sem
// pesagem recente" — os ids antigos viraram aliases (legacyAliases.js) com a mesma seleção.
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_CURRENT_COLUMNS } from './columns/animalColumns.js';
import { listaTipo, resumoTipo } from './tipos.js';

export const ATIVOS = Object.freeze({ situacao: { operator: 'in', values: ['ATIVO'] } });

// Totais completos (usados pelos aliases do inventário e dos "Rebanho por …").
export const CURRENT_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'peso_total', columnId: 'ultimo_peso_kg', op: 'sum' },
  { id: 'peso_medio', columnId: 'ultimo_peso_kg', op: 'avg' },
  { id: 'peso_min', columnId: 'ultimo_peso_kg', op: 'min' },
  { id: 'peso_max', columnId: 'ultimo_peso_kg', op: 'max' },
]);

export const INVENTORY_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'raca', 'categoria', 'situacao', 'lote_atual', 'apartacao_atual', 'ultima_pesagem_data', 'ultimo_peso_kg', 'dias_sem_pesagem']);

// E1G (A4): GMD dos resumos, ponderado (Σ ganho ÷ Σ dias): "GMD médio" = o da última pesagem de cada animal (como o
// "GMD Médio" do aparte no Pesagens) — no padrão; "GMD desde a entrada" fica no "Colunas Painel".
export const HERD_GMD_TOTALS = Object.freeze([
  { id: 'gmd_medio', columnId: 'ultimo_gmd', op: 'weightedGmd' },
  { id: 'gmd_entrada_medio', columnId: 'gmd_entrada', op: 'weightedGmd' },
]);
export const HERD_METRIC_LABELS = Object.freeze({ gmd_medio: 'GMD médio (kg/dia)', gmd_entrada_medio: 'GMD desde a entrada (kg/dia)' });

// E1E "Tipo Relatório" (definitions/tipos.js). Totais dos resumidos = os dos antigos "Rebanho por …"
// (CURRENT_TOTALS), na ordem da folha: Cabeças | Menor | Maior | Peso médio | Peso total | (E1G) GMD médio.
export const HERD_TYPE_TOTALS = Object.freeze([CURRENT_TOTALS[0], CURRENT_TOTALS[3], CURRENT_TOTALS[4], CURRENT_TOTALS[2], CURRENT_TOTALS[1], ...HERD_GMD_TOTALS]);
export const HERD_TYPE_DEFAULTS = Object.freeze(['animais', 'peso_min', 'peso_max', 'peso_medio', 'peso_total', 'gmd_medio']);
// E1G (A4): o Analítico mostra o Último GMD e o GMD desde a entrada no padrão; entrada e ganho ficam em "Colunas".
export const REBANHO_ANALITICO_COLUMNS = Object.freeze([...INVENTORY_COLUMNS, 'ultimo_gmd', 'gmd_entrada']);
export const REBANHO_ANALITICO_TOTALS = Object.freeze(HERD_TYPE_TOTALS.filter((spec) => HERD_TYPE_DEFAULTS.includes(spec.id)));
// "Sem Pesagem Recente" = o antigo "Animais sem pesagem recente" (colunas, totais e ordem dele). Os 30 dias são
// condição do tipo (população, com cadeado): para outro número, Analítico + filtro "Dias sem pesagem".
export const SEM_PESAGEM_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'categoria', 'lote_atual', 'ultima_pesagem_data', 'ultimo_peso_kg', 'dias_sem_pesagem']);
export const SEM_PESAGEM_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'dias_medio', columnId: 'dias_sem_pesagem', op: 'avg' },
  { id: 'dias_max', columnId: 'dias_sem_pesagem', op: 'max' },
]);
export const SEM_PESAGEM_POPULATION = Object.freeze({ dias_sem_pesagem: { operator: 'greater', value: '30' } });
// Os tipos são do rebanho ATIVO (como os antigos): escolher um deles volta o filtro "só ativos"; "Por Situação"
// (o antigo mostrava todas as situações) tira esse filtro — filtro vazio, que o serviço ignora.
const TODAS_SITUACOES = Object.freeze({ situacao: { operator: 'in', values: [] } });
const herd = (id, label, groups, extra = {}) => resumoTipo(id, label, groups, HERD_TYPE_TOTALS, { defaults: HERD_TYPE_DEFAULTS, filters: ATIVOS, ...extra });
export const REBANHO_DEFAULT_VIEW = 'por-lote';
export const REBANHO_VIEWS = Object.freeze([
  herd('por-lote', 'Por Lote', ['lote_atual']),
  herd('por-apartacao-lote', 'Por Apartação/Lote', ['apartacao_atual', 'lote_atual']),
  herd('por-apartacao', 'Por Apartação', ['apartacao_atual']),
  herd('por-categoria', 'Por Categoria', ['categoria']),
  herd('por-raca', 'Por Raça', ['raca']),
  herd('por-marca', 'Por Marca', ['marca']),
  herd('por-sexo', 'Por Sexo', ['sexo']),
  herd('por-situacao', 'Por Situação', ['situacao'], { filters: TODAS_SITUACOES }),
  herd('por-faixa-peso', 'Por Faixa de Peso', ['faixa_peso']),
  // = o antigo "Inventário atual do rebanho".
  listaTipo('analitico', 'Analítico (Lista de Animais)', { from: ANIMAL_CURRENT_COLUMNS, columns: REBANHO_ANALITICO_COLUMNS, aggregates: REBANHO_ANALITICO_TOTALS, sort: [{ columnId: 'animal', direction: 'asc' }], filters: ATIVOS }),
  listaTipo('sem-pesagem-recente', 'Sem Pesagem Recente', { from: ANIMAL_CURRENT_COLUMNS,
    columns: SEM_PESAGEM_COLUMNS, aggregates: SEM_PESAGEM_TOTALS, sort: [{ columnId: 'dias_sem_pesagem', direction: 'desc' }], filters: ATIVOS, population: SEM_PESAGEM_POPULATION,
  }),
]);

// E1G — gráficos do Rebanho atual (domain/reportCharts), sobre as linhas da folha (só ativos, como os tipos).
const CHART_CAB = CURRENT_TOTALS[0];
const CHART_BAND_WIDTHS = Object.freeze([
  { id: 'auto', label: 'Automática', largura: 'auto' },
  ...[10, 15, 20, 25, 30, 50].map((largura) => ({ id: String(largura), label: `${largura} kg`, largura })),
  { id: 'categorias', label: 'Faixas das categorias', largura: 'categorias' },
]);
export const REBANHO_CHARTS = Object.freeze([
  {
    id: 'distribuicao-peso', kind: 'histograma', title: 'Distribuição do peso atual', subtitle: 'Peso atual (última pesagem com peso) de cada animal',
    valorAnimal: 'ultimo_peso_kg', porAnimal: 'linha', unidade: 'kg', semValor: 'Sem peso',
    controls: { faixa: { label: 'Faixa', default: 'auto', choices: CHART_BAND_WIDTHS } },
  },
  // GMD médio por lote: usa o GMD médio (ponderado) da FOLHA do Rebanho atual — o spec sem coluna pega o total da
  // folha com weightedGmd (colunas de GMD do Rebanho, trilha GMD da E1G). Opcional: sem essa coluna no grão o
  // gráfico fica fora com aviso em REBANHO_ATUAL.chartsSkipped (o merge funciona nas duas ordens).
  {
    id: 'gmd-por-lote', kind: 'barras', title: 'GMD médio por lote', subtitle: 'GMD médio ponderado de cada animal do rebanho de hoje', unidade: 'kg/dia', opcional: true,
    controls: {
      serie: {
        label: 'Agrupar por', default: 'lote', choices: [
          { id: 'lote', label: 'Lote', columnId: 'lote_atual' },
          { id: 'apartacao', label: 'Apartação', columnId: 'apartacao_atual' },
          { id: 'categoria', label: 'Categoria', columnId: 'categoria' },
          { id: 'raca', label: 'Raça', columnId: 'raca' },
          { id: 'marca', label: 'Marca', columnId: 'marca' },
          { id: 'sexo', label: 'Sexo', columnId: 'sexo' },
        ],
      },
    },
    valor: { op: 'weightedGmd' }, cab: CHART_CAB, semValor: 'Sem GMD',
  },
]);

export const REBANHO_ATUAL = defineReport({
  id: 'rebanho.atual',
  family: 'rebanho',
  grain: GRAINS.ANIMAL_CURRENT,
  // 2 (E1E): ganhou os tipos. Estado/modelo gravado com a versão 1 e `view: null` é de quando não havia tipo
  // declarado — abre no tipo que bate pela estrutura (reportTemplateService.templateToRequest).
  version: 2,
  source: 'animals.current',
  requires: ['reports.read', 'animal.read'],
  title: 'Rebanho atual',
  description: 'Cabeças, peso médio e peso total do rebanho de hoje — por lote, categoria, raça, marca ou como preferir.',
  metrics: ['Cabeças', 'Peso médio', 'Peso total'],
  params: [{ id: 'faixas', type: 'ranges', label: 'Faixas de peso', default: null }],
  columns: ANIMAL_CURRENT_COLUMNS,
  animalColumnId: 'animal',
  searchColumns: ['animal', 'marca', 'raca', 'lote_atual', 'apartacao_atual'],
  defaultColumns: [...INVENTORY_COLUMNS],
  defaultFilters: ATIVOS,
  defaultSort: [{ columnId: 'animal', direction: 'asc' }],
  defaultGroups: [{ columnId: 'lote_atual' }],
  // Ordem = colunas do Resumido: Lote | Cabeças | Peso médio | Peso total.
  defaultAggregates: [
    { id: 'animais', columnId: 'animal', op: 'countDistinct' },
    { id: 'peso_medio', columnId: 'ultimo_peso_kg', op: 'avg' },
    { id: 'peso_total', columnId: 'ultimo_peso_kg', op: 'sum' },
  ],
  // Sem "situação": o relatório abre só com ativos, então agrupar por situação daria uma linha "Ativo".
  // O antigo "Rebanho por situação" (favorito/link) continua abrindo sem esse filtro.
  quickGroups: ['lote_atual', 'apartacao_atual', 'categoria', 'raca', 'marca', 'sexo', 'faixa_peso'],
  quickFilters: [
    { id: 'sem-pesagem-30', label: 'Sem pesagem há mais de 30 dias', filters: { dias_sem_pesagem: { operator: 'greater', value: '30' } } },
  ],
  views: REBANHO_VIEWS,
  defaultView: REBANHO_DEFAULT_VIEW,
  metricLabels: HERD_METRIC_LABELS,
  notes: [
    'Estado ATUAL de cada animal (uma linha por animal). Peso atual = última pesagem com peso.',
    'Entrada = o Cadastro com peso. GMD desde a entrada = (peso atual − peso de entrada) ÷ dias; Último GMD = o da última pesagem, contra a anterior. GMD médio = soma dos ganhos ÷ soma dos dias.',
  ],
  // E1G: vista "Gráficos".
  charts: REBANHO_CHARTS,
});
