// Família DESEMPENHO — grão ANIMAL_PERIOD: cada animal uma vez por período.
// GMD de grupo = Σ ganho ÷ Σ dias (ponderado), só animais com par válido de pesagens.
// E1 (1.4.0): "Desempenho" substitui individual, por lote, as seis dimensões, "Animais perdendo peso"
// e "Distribuição por faixa de peso" (aliases em legacyAliases.js).
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_PERIOD_COLUMNS } from './columns/animalColumns.js';

export const PERFORMANCE_PERIOD_PARAM = Object.freeze({ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_90_dias' } });

// Totais completos (usados pelos aliases dos relatórios antigos de desempenho).
export const PERFORMANCE_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'pesagens', columnId: 'pesagens', op: 'sum' },
  { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
  { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'gmd_simples', columnId: 'gmd', op: 'avg' },
]);

export const PERFORMANCE_COLUMNS = Object.freeze(['animal', 'marca', 'sexo', 'categoria', 'lote', 'pesagens', 'peso_inicial', 'peso_final', 'dias', 'ganho', 'gmd']);

export const PERFORMANCE_NOTES = Object.freeze([
  'Uma linha por animal com pesagem no período. Peso inicial/final = primeira/última pesagem com peso dentro do período.',
  'Ganho, dias e GMD só existem com duas ou mais pesagens com peso; sem par válido aparecem como "—" e não entram no GMD.',
  'GMD do grupo = soma dos ganhos ÷ soma dos dias (ponderado); GMD simples = média dos GMD individuais.',
]);

export const DESEMPENHO = defineReport({
  id: 'desempenho',
  family: 'desempenho',
  grain: GRAINS.ANIMAL_PERIOD,
  version: 1,
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
  // Ordem = colunas do Resumido: Lote | Cabeças | Peso inicial médio | Peso final médio | Ganho total | Ganho médio | GMD.
  defaultAggregates: [
    { id: 'animais', columnId: 'animal', op: 'countDistinct' },
    { id: 'peso_inicial_medio', columnId: 'peso_inicial', op: 'avg' },
    { id: 'peso_final_medio', columnId: 'peso_final', op: 'avg' },
    { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
    { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
    { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
  ],
  quickGroups: ['lote', 'apartacao', 'categoria', 'raca', 'marca', 'sexo', 'faixa_peso'],
  quickFilters: [
    { id: 'perdendo-peso', label: 'Somente perdendo peso', filters: { ganho: { operator: 'less', value: '0' } } },
  ],
  notes: [...PERFORMANCE_NOTES],
});
