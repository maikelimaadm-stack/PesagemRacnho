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

// E1B §4: métricas da FOLHA de pesagens (ids fixos, nesta ordem — a folha, os rótulos e os gates usam
// estes ids). Tudo pelo motor da E1: @ viva = colunas peso_arroba/ganho_arroba (kg ÷ divisor da linha);
// Machos/Fêmeas = animais distintos por sexo; faixa = min/max da faixa do cadastro do lote.
export const SHEET_TOTALS = Object.freeze([
  { id: 'qtd', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'faixa_min', columnId: 'lote_peso_minimo', op: 'min' },
  { id: 'faixa_max', columnId: 'lote_peso_maximo', op: 'max' },
  { id: 'menor', columnId: 'peso', op: 'min' },
  { id: 'maior', columnId: 'peso', op: 'max' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'media_arroba', columnId: 'peso_arroba', op: 'avg' },
  { id: 'peso_total', columnId: 'peso', op: 'sum' },
  { id: 'total_arroba', columnId: 'peso_arroba', op: 'sum' },
  { id: 'ganho_medio', columnId: 'ganho', op: 'avg' },
  { id: 'ganho_medio_arroba', columnId: 'ganho_arroba', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'ganho_total_arroba', columnId: 'ganho_arroba', op: 'sum' },
  { id: 'dias_medios', columnId: 'dias', op: 'avg' },
  { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'machos', columnId: 'animais_machos', op: 'countDistinct' },
  { id: 'femeas', columnId: 'animais_femeas', op: 'countDistinct' },
]);

// "Por data" não tem nível de lote: a faixa exigida (que é do lote) não entra (min/max de lotes
// diferentes inventaria uma faixa que ninguém exige).
export const SHEET_TOTALS_SEM_FAIXA = Object.freeze(SHEET_TOTALS.filter((spec) => !['faixa_min', 'faixa_max'].includes(spec.id)));

// Rótulos de curral da folha (cabeçalho do Resumido quando a métrica com o id está na seleção).
export const SHEET_METRIC_LABELS = Object.freeze({
  qtd: 'Qtd',
  menor: 'Menor (kg)',
  maior: 'Maior (kg)',
  peso_medio: 'Peso médio (kg)',
  media_arroba: 'Média (@)',
  peso_total: 'Peso total (kg)',
  total_arroba: 'Total (@)',
  ganho_medio: 'Ganho médio (kg)',
  ganho_medio_arroba: 'Ganho médio (@)',
  ganho_total: 'Ganho total (kg)',
  ganho_total_arroba: 'Ganho total (@)',
  dias_medios: 'Dias médios',
  gmd_medio: 'GMD médio (kg/dia)',
  machos: 'Machos',
  femeas: 'Fêmeas',
});

// "Analítico por animal": uma linha por pesagem com os dados úteis da conferência no curral.
export const ANALYTIC_EVENT_COLUMNS = Object.freeze(['data_pesagem', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'nome_lote', 'nome_apartacao', 'peso', 'peso_arroba', 'peso_anterior', 'dias', 'ganho', 'gmd']);

export const PESAGENS = defineReport({
  id: 'pesagens',
  family: 'pesagens',
  grain: GRAINS.EVENT,
  version: 1,
  source: 'events.byPeriod',
  requires: ['reports.read', 'weighing.read'],
  title: 'Pesagens',
  // Folha: "Relatório de Pesagens Individuais (Sintético|Analítico)" (resposta 11 ao REPORT da E1B).
  sheetTitle: 'Pesagens Individuais',
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
  // E1B "Tipo de relatório": atalhos para agrupamentos/modo da E1 (não mudam defaultGroups/Aggregates).
  views: [
    { id: 'por-apartacao-data', label: 'Por apartação (resumo por data)', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem', direction: 'desc' }, { columnId: 'nome_lote' }], mode: 'RESUMIDO', aggregates: SHEET_TOTALS },
    { id: 'por-lote', label: 'Por lote', groups: [{ columnId: 'nome_lote' }], mode: 'RESUMIDO', aggregates: SHEET_TOTALS },
    { id: 'por-data', label: 'Por data', groups: [{ columnId: 'data_pesagem', direction: 'desc' }], mode: 'RESUMIDO', aggregates: SHEET_TOTALS_SEM_FAIXA },
    { id: 'analitico', label: 'Analítico por animal', groups: [], mode: 'DETALHADO', columns: [...ANALYTIC_EVENT_COLUMNS] },
  ],
  metricLabels: SHEET_METRIC_LABELS,
  // A faixa exigida é do LOTE: só aparece quando o último nível de agrupamento é o lote (e no "TOTAL POR
  // LOTE"); em qualquer outro agrupamento as duas métricas saem da folha e das exportações.
  metricPairs: [{ id: 'faixa', label: 'Faixa exigida (kg)', from: 'faixa_min', to: 'faixa_max', leafOnly: true, leafColumnId: 'nome_lote', unit: 'kg' }],
  classification: DATA_CLASSIFICATION.CANONICAL,
  notes: ['Uma linha por pesagem: um animal pesado 3 vezes aparece 3 vezes; "Cabeças" conta cada animal uma vez.'],
});

export const COMERCIAL_EVENT_CLASSIFICATION = DATA_CLASSIFICATION.LEGACY_EVENT;
