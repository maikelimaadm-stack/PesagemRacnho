// Família REBANHO — grão ANIMAL_CURRENT (projeção `animais`; não reconstrói histórico).
// E1 (1.4.0): "Rebanho atual" substitui o inventário, os oito "Rebanho por …" e "Animais sem
// pesagem recente" — os ids antigos viraram aliases (legacyAliases.js) com a mesma seleção.
import { defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ANIMAL_CURRENT_COLUMNS } from './columns/animalColumns.js';

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

export const REBANHO_ATUAL = defineReport({
  id: 'rebanho.atual',
  family: 'rebanho',
  grain: GRAINS.ANIMAL_CURRENT,
  version: 1,
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
  quickGroups: ['lote_atual', 'apartacao_atual', 'categoria', 'raca', 'marca', 'sexo', 'faixa_peso', 'situacao'],
  quickFilters: [
    { id: 'sem-pesagem-30', label: 'Sem pesagem há mais de 30 dias', filters: { dias_sem_pesagem: { operator: 'greater', value: '30' } } },
  ],
  notes: ['Estado ATUAL de cada animal (uma linha por animal). Peso atual = última pesagem com peso.'],
});
