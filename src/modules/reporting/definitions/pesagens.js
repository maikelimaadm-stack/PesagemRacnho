// Família PESAGENS (grão EVENT). "Pesagens por período" é o canário da arquitetura:
// paridade de população com a Relação de Pesagens (gate reports:relation-parity:verify).
import { defineReport, DATA_CLASSIFICATION } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';

const PERIOD_PARAM = { id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_30_dias' } };

const EVENT_TOTALS = [
  { id: 'registros', op: 'count' },
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'peso_min', columnId: 'peso', op: 'min' },
  { id: 'peso_max', columnId: 'peso', op: 'max' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
];

const base = {
  family: 'pesagens',
  grain: GRAINS.EVENT,
  version: 1,
  source: 'events.byPeriod',
  requires: ['reports.read', 'weighing.read'],
  params: [PERIOD_PARAM],
  columns: EVENT_COLUMNS,
  animalColumnId: 'numero_animal',
  searchColumns: [...RELATION_SEARCH_COLUMN_IDS],
  defaultSort: [{ columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'numero_animal', direction: 'asc' }],
  defaultAggregates: EVENT_TOTALS,
  classification: DATA_CLASSIFICATION.CANONICAL,
};

export const PESAGENS_POR_PERIODO = defineReport({
  ...base,
  id: 'pesagens.periodo',
  title: 'Pesagens por período',
  description: 'Todas as pesagens (cadastro, manejo e saída) lançadas no período, com filtros, colunas e totais.',
  metrics: ['Registros', 'Animais únicos', 'Peso médio', 'GMD ponderado'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'categoria', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd'],
  notes: ['Uma linha por pesagem: um animal pesado 3 vezes aparece 3 vezes; "Animais únicos" conta cada animal uma vez.'],
});

export const PESAGENS_POR_SESSAO = defineReport({
  ...base,
  id: 'pesagens.sessao',
  title: 'Pesagens por sessão',
  description: 'Pesagens do período agrupadas pela sessão de pesagem, com subtotal por sessão.',
  metrics: ['Registros por sessão', 'Animais únicos', 'Peso médio', 'GMD ponderado'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'peso', 'nome_lote', 'gmd', 'operador'],
  defaultGroups: [{ columnId: 'sessao' }],
  defaultSort: [{ columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'numero_animal', direction: 'asc' }],
});

export const PESAGENS_POR_LOTE = defineReport({
  ...base,
  id: 'pesagens.lote',
  title: 'Pesagens por lote e apartação',
  description: 'Pesagens do período agrupadas por apartação e lote (agrupa pelo cadastro, não pelo nome).',
  metrics: ['Registros por lote', 'Animais únicos', 'Peso médio', 'GMD ponderado'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'peso', 'gmd'],
  defaultGroups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }],
});

export const COMERCIAL_EVENT_CLASSIFICATION = DATA_CLASSIFICATION.LEGACY_EVENT;
