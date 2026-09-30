// Famílias PESAGENS (complementos), MOVIMENTAÇÃO, SAÍDAS e EMBARQUES (romaneio); COMERCIAL está em
// comercial.js (E1E). E1 (1.4.0): "Movimentação de lotes" substitui mudanças e permanências; "Saídas"
// substitui saídas por motivo e as quatro de mortes; "Pendências de pesagem" passou para a aba Controle
// da Manutenção; o Fechamento do dia passou para a família Pesagens.
import { REPORT_VISIBILITY, defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';
import { LOT_COLUMNS, LOT_STAY_COLUMNS } from './columns/controlColumns.js';

const PERIOD = (preset = 'ultimos_30_dias') => ({ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset } });
export const OPERATIONAL_EVENT_TOTALS = Object.freeze([
  { id: 'registros', op: 'count' },
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
]);

const eventBase = (overrides) => ({
  grain: GRAINS.EVENT,
  version: 1,
  source: 'events.byPeriod',
  requires: ['reports.read', 'weighing.read'],
  params: [PERIOD()],
  columns: EVENT_COLUMNS,
  animalColumnId: 'numero_animal',
  searchColumns: [...RELATION_SEARCH_COLUMN_IDS],
  defaultSort: [{ columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'numero_animal', direction: 'asc' }],
  defaultAggregates: OPERATIONAL_EVENT_TOTALS,
  ...overrides,
});

// ---- Pesagens (complementos) ----
export const PESAGENS_PENDENCIAS = defineReport(eventBase({
  id: 'pesagens.pendencias', family: 'pesagens', title: 'Pendências de pesagem', visibility: REPORT_VISIBILITY.MAINTENANCE,
  description: 'Lançamentos com GMD negativo, sem lote ou saída sem documento exigido — as mesmas regras do Fechamento do Dia.',
  metrics: ['Pendências por tipo', 'Animais afetados'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'peso', 'gmd', 'nome_lote', 'pendencias'],
  defaultGroups: [{ columnId: 'pendencias' }],
  // Na Manutenção a lista de lançamentos é o que se corrige: abre no Detalhado.
  defaultMode: 'DETALHADO',
  lockedFilters: () => ({ pendencias: { operator: 'not_empty' } }),
  defaultAggregates: [{ id: 'registros', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }],
}));

export const FECHAMENTO_DIA = defineReport(eventBase({
  id: 'controle.fechamento-dia', family: 'pesagens', title: 'Fechamento do dia (imprimível)',
  description: 'Lançamentos de um dia agrupados por sessão, com pendências e totais — mesmas regras da tela Fechamento do Dia.',
  requires: ['reports.read', 'session.close'],
  params: [PERIOD('hoje')],
  metrics: ['Lançamentos', 'Cabeças', 'Peso médio', 'GMD', 'Pendências'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'gmd', 'nome_apartacao', 'nome_lote', 'pendencias', 'observacao'],
  defaultGroups: [{ columnId: 'sessao' }],
  // O fechamento é conferência linha a linha: abre no Detalhado (o Resumido fica a um clique).
  defaultMode: 'DETALHADO',
  defaultAggregates: [...OPERATIONAL_EVENT_TOTALS, { id: 'peso_total', columnId: 'peso', op: 'sum' }],
  notes: ['Pendências: Peso (GMD negativo), Lote (sem lote fora de saída), Doc (saída sem documento quando exigido).'],
}));

// ---- Movimentação ----
export const LOT_STAY_TOTALS = Object.freeze([
  { id: 'permanencias', op: 'count' },
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'dias_medio', columnId: 'dias_no_lote', op: 'avg' },
]);

export const LOT_STAY_NOTE = 'Fonte: projeção animalLotes, recalculada a cada edição de pesagem (não usa movimentosAnimais, que não acompanha edições).';

export const MOV_LOTES = defineReport({
  id: 'movimentacao.lotes', family: 'movimentacao', grain: GRAINS.LOT_STAY, version: 1, source: 'lotStays.byPeriod',
  requires: ['reports.read', 'animal.read'], params: [PERIOD()], columns: LOT_STAY_COLUMNS, animalColumnId: 'animal',
  title: 'Movimentação de lotes',
  description: 'Quem passou por cada lote no período, quantos dias ficou e quem mudou de lote.',
  metrics: ['Permanências', 'Cabeças', 'Dias no lote'],
  searchColumns: ['animal', 'marca', 'lote'],
  defaultColumns: ['animal', 'marca', 'lote', 'apartacao', 'inicio', 'fim', 'dias_no_lote', 'mudanca'],
  defaultSort: [{ columnId: 'inicio', direction: 'asc' }],
  defaultGroups: [{ columnId: 'lote' }],
  defaultAggregates: LOT_STAY_TOTALS,
  quickGroups: ['lote', 'apartacao', 'lote_origem', 'marca', 'sexo'],
  quickFilters: [
    { id: 'mudancas-no-periodo', label: 'Somente mudanças de lote no período', filters: { mudanca: { operator: 'equals', value: 'sim' }, entrada_no_periodo: { operator: 'equals', value: 'sim' } } },
  ],
  periodExemption: 'LOT_STAY usa o período como interseção',
  notes: [LOT_STAY_NOTE],
});

export const LOTES_OCUPACAO = defineReport({
  id: 'rebanho.ocupacao-lotes', family: 'rebanho', grain: GRAINS.LOT, version: 1, source: 'lots.current',
  requires: ['reports.read', 'animal.read'], columns: LOT_COLUMNS, title: 'Ocupação de lotes',
  description: 'Animais ativos por lote contra a capacidade, com peso médio atual.',
  metrics: ['Animais', 'Capacidade', 'Ocupação'],
  defaultColumns: ['apartacao', 'lote', 'situacao_lote', 'capacidade', 'animais', 'ocupacao', 'peso_medio_atual'],
  defaultGroups: [{ columnId: 'apartacao' }],
  defaultSort: [{ columnId: 'lote', direction: 'asc' }],
  defaultAggregates: [{ id: 'lotes', op: 'count' }, { id: 'animais', columnId: 'animais', op: 'sum' }, { id: 'capacidade', columnId: 'capacidade', op: 'sum' }, { id: 'ocupacao', columnId: 'ocupacao', op: 'ratio' }, { id: 'peso_medio', columnId: 'peso_medio_atual', op: 'weightedAvg' }],
  notes: ['Ocupação do grupo = soma dos animais ÷ soma das capacidades (lotes sem capacidade não entram).'],
});

// ---- Saídas e mortalidade ----
const exitBase = (overrides) => eventBase({
  grain: GRAINS.EXIT, family: 'saidas', sourceOptions: { tipos: ['Saída'] }, params: [PERIOD('ultimos_90_dias')],
  defaultAggregates: [{ id: 'saidas', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }],
  ...overrides,
});

export const MORTALITY_NOTES = Object.freeze([
  'Quantidade de mortes. Taxa de mortalidade não é calculada: o denominador (estoque médio × animais-dia) ainda não foi definido.',
  'Causa da morte é o texto gravado no lançamento.',
]);

export const SAIDAS = defineReport(exitBase({
  id: 'saidas', title: 'Saídas',
  description: 'Saídas definitivas do período (venda, abate, morte, doação, transferência) — por motivo, causa da morte, lote ou categoria.',
  metrics: ['Saídas por motivo', 'Cabeças', 'Peso médio'],
  defaultColumns: ['data_pesagem', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso', 'nome_lote', 'causa_morte'],
  defaultGroups: [{ columnId: 'motivo_saida' }],
  quickGroups: ['motivo_saida', 'causa_morte', 'nome_lote', 'categoria', 'marca', 'data_pesagem'],
  quickFilters: [
    { id: 'somente-mortes', label: 'Somente mortes', filters: { motivo_saida: { operator: 'in', values: ['Morte'] } } },
  ],
  notes: [...MORTALITY_NOTES],
}));

// ---- Comercial ----
// E1E: "Vendas do período", "Abates do período" e "Compras do período" viraram os tipos do relatório
// "Comercial" (comercial.js); os ids antigos são aliases (legacyAliases.js).

// ---- Embarques ----
export const EMBARQUES_ROMANEIO = defineReport(exitBase({
  id: 'embarques.romaneio', family: 'embarques', title: 'Romaneio de embarque',
  description: 'Animais de saída vinculados a embarque/documento, agrupados por documento.',
  requires: ['reports.read', 'weighing.read', 'shipment.read'],
  metrics: ['Cabeças por documento', 'Peso embarcado'],
  defaultColumns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'nome_lote', 'nome_apartacao', 'motivo_saida', 'embarque_nome', 'documento_tipo', 'documento_numero', 'destino_venda', 'frigorifico'],
  defaultGroups: [{ columnId: 'embarque_nome' }, { columnId: 'documento_numero' }],
  lockedFilters: () => ({ embarque_vinculado: { operator: 'equals', value: true } }),
  defaultAggregates: [{ id: 'cabecas', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }],
}));
