// Família PESAGENS (grão EVENT). E1 (1.4.0): "Pesagens" substitui por período, por sessão, por lote,
// por operador, por origem e "Entradas e saídas" (aliases em legacyAliases.js). O alias
// `pesagens.periodo` continua sendo o canário da arquitetura: paridade de população com a Relação de
// Pesagens (gate reports:relation-parity:verify).
import { defineReport, DATA_CLASSIFICATION } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';

export const EVENT_PERIOD_PARAM = Object.freeze({ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_30_dias' } });

export const EVENT_TOTALS = Object.freeze([
  { id: 'registros', op: 'count' },
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'peso_min', columnId: 'peso', op: 'min' },
  { id: 'peso_max', columnId: 'peso', op: 'max' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
]);

export const PERIOD_EVENT_COLUMNS = Object.freeze(['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'categoria', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd']);

export const PESAGENS = defineReport({
  id: 'pesagens',
  family: 'pesagens',
  grain: GRAINS.EVENT,
  version: 1,
  source: 'events.byPeriod',
  requires: ['reports.read', 'weighing.read'],
  title: 'Pesagens',
  description: 'Pesagens do período (cadastro, manejo e saída) — por sessão, lote, operador, tipo ou como preferir.',
  metrics: ['Pesagens', 'Cabeças', 'Peso médio', 'GMD'],
  params: [EVENT_PERIOD_PARAM],
  columns: EVENT_COLUMNS,
  animalColumnId: 'numero_animal',
  searchColumns: [...RELATION_SEARCH_COLUMN_IDS],
  defaultColumns: [...PERIOD_EVENT_COLUMNS],
  defaultSort: [{ columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'numero_animal', direction: 'asc' }],
  defaultGroups: [{ columnId: 'sessao' }],
  defaultAggregates: EVENT_TOTALS,
  quickGroups: ['sessao', 'data_pesagem', 'nome_lote', 'nome_apartacao', 'tipo_manejo', 'operador', 'origem_registro', 'marca', 'categoria'],
  quickFilters: [
    { id: 'entradas-saidas', label: 'Somente entradas e saídas', filters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Saída'] } } },
  ],
  classification: DATA_CLASSIFICATION.CANONICAL,
  notes: ['Uma linha por pesagem: um animal pesado 3 vezes aparece 3 vezes; "Cabeças" conta cada animal uma vez.'],
});

export const COMERCIAL_EVENT_CLASSIFICATION = DATA_CLASSIFICATION.LEGACY_EVENT;
