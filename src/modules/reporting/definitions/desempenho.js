// Família DESEMPENHO — grão ANIMAL_PERIOD: cada animal uma vez por período.
// GMD de grupo = Σ ganho ÷ Σ dias (ponderado), só animais com par válido de pesagens.
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_PERIOD_COLUMNS } from './columns/animalColumns.js';

const PERIOD_PARAM = { id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_90_dias' } };

export const PERFORMANCE_TOTALS = [
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'pesagens', columnId: 'pesagens', op: 'sum' },
  { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
  { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'gmd_simples', columnId: 'gmd', op: 'avg' },
];

const base = {
  family: 'desempenho',
  grain: GRAINS.ANIMAL_PERIOD,
  version: 1,
  source: 'animals.period',
  requires: ['reports.read', 'weighing.read'],
  params: [PERIOD_PARAM, { id: 'faixas', type: 'ranges', label: 'Faixas de peso', default: null }],
  columns: ANIMAL_PERIOD_COLUMNS,
  animalColumnId: 'animal',
  searchColumns: ['animal', 'marca', 'raca', 'lote'],
  defaultSort: [{ columnId: 'animal', direction: 'asc' }],
  defaultAggregates: PERFORMANCE_TOTALS,
  notes: [
    'Uma linha por animal com pesagem no período. Peso inicial/final = primeira/última pesagem com peso dentro do período.',
    'Ganho, dias e GMD só existem com duas ou mais pesagens com peso; sem par válido aparecem como "—" e não entram no GMD.',
    'GMD ponderado = soma dos ganhos ÷ soma dos dias; GMD simples = média dos GMD individuais.',
  ],
};

export const DESEMPENHO_INDIVIDUAL = defineReport({
  ...base,
  id: 'desempenho.individual',
  title: 'Desempenho individual',
  description: 'Peso inicial, peso final, ganho, dias e GMD de cada animal no período.',
  metrics: ['Ganho', 'GMD ponderado', 'Pesagens'],
  defaultColumns: ['animal', 'marca', 'sexo', 'categoria', 'lote', 'pesagens', 'peso_inicial', 'peso_final', 'dias', 'ganho', 'gmd'],
});

export const DESEMPENHO_POR_LOTE = defineReport({
  ...base,
  id: 'desempenho.lote',
  title: 'Desempenho por lote',
  description: 'Animais do período agrupados por apartação e lote com peso médio inicial/final, ganho e GMD ponderado.',
  metrics: ['Animais únicos', 'Peso médio inicial/final', 'GMD ponderado'],
  defaultColumns: ['animal', 'marca', 'sexo', 'peso_inicial', 'peso_final', 'dias', 'ganho', 'gmd'],
  defaultGroups: [{ columnId: 'apartacao' }, { columnId: 'lote' }],
});

const DIMENSIONS = [
  ['marca', 'Desempenho por marca'],
  ['raca', 'Desempenho por raça'],
  ['categoria', 'Desempenho por categoria'],
  ['sexo', 'Desempenho por sexo'],
  ['lote', 'Desempenho por lote (sem apartação)'],
  ['apartacao', 'Desempenho por apartação'],
];

export const DESEMPENHO_POR_DIMENSAO = DIMENSIONS.map(([columnId, title]) => defineReport({
  ...base,
  id: `desempenho.dimensao.${columnId}`,
  presetOf: 'desempenho.dimensao',
  title,
  description: `${title}: GMD ponderado, ganho e pesos médios por grupo no período.`,
  metrics: ['Animais', 'GMD ponderado', 'Ganho médio'],
  defaultColumns: ['animal', 'marca', 'sexo', 'peso_inicial', 'peso_final', 'ganho', 'gmd'].filter((id) => id !== columnId),
  defaultGroups: [{ columnId }],
}));

export const DESEMPENHO_PERDENDO_PESO = defineReport({
  ...base,
  id: 'desempenho.perdendo-peso',
  title: 'Animais perdendo peso',
  description: 'Animais com ganho negativo entre a primeira e a última pesagem com peso do período.',
  metrics: ['Animais', 'Perda total', 'GMD ponderado'],
  defaultColumns: ['animal', 'marca', 'sexo', 'lote', 'data_inicial', 'peso_inicial', 'data_final', 'peso_final', 'dias', 'ganho', 'gmd'],
  defaultSort: [{ columnId: 'ganho', direction: 'asc' }],
  lockedFilters: () => ({ ganho: { operator: 'less', value: '0' } }),
});

export const DESEMPENHO_FAIXA_PESO = defineReport({
  ...base,
  id: 'desempenho.faixa-peso',
  title: 'Distribuição por faixa de peso (período)',
  description: 'Animais do período agrupados pela faixa do peso final, com GMD ponderado por faixa.',
  metrics: ['Animais por faixa', 'Peso final médio', 'GMD ponderado'],
  defaultColumns: ['animal', 'marca', 'sexo', 'peso_final', 'ganho', 'gmd'],
  defaultGroups: [{ columnId: 'faixa_peso' }],
});
