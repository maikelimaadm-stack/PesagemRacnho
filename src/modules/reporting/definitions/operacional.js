// Famílias PESAGENS (complementos), MOVIMENTAÇÃO, SAÍDAS e COMERCIAL (dados legados por evento).
import { DATA_CLASSIFICATION, defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';
import { LOT_COLUMNS, LOT_STAY_COLUMNS } from './columns/controlColumns.js';

const PERIOD = (preset = 'ultimos_30_dias') => ({ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset } });
const EVENT_TOTALS = [
  { id: 'registros', op: 'count' },
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
];

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
  defaultAggregates: EVENT_TOTALS,
  ...overrides,
});

// ---- Pesagens (complementos) ----
export const PESAGENS_POR_OPERADOR = defineReport(eventBase({
  id: 'pesagens.operador', family: 'pesagens', title: 'Pesagens por operador',
  description: 'Lançamentos do período agrupados pelo usuário que gravou (registros antigos sem usuário aparecem como “Não informado”).',
  metrics: ['Registros por operador', 'Animais únicos'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'nome_lote', 'sessao'],
  defaultGroups: [{ columnId: 'operador' }],
}));

export const PESAGENS_PENDENCIAS = defineReport(eventBase({
  id: 'pesagens.pendencias', family: 'pesagens', title: 'Pendências de pesagem',
  description: 'Lançamentos com GMD negativo, sem lote ou saída sem documento exigido — as mesmas regras do Fechamento do Dia.',
  metrics: ['Pendências por tipo', 'Animais afetados'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'peso', 'gmd', 'nome_lote', 'pendencias'],
  defaultGroups: [{ columnId: 'pendencias' }],
  lockedFilters: () => ({ pendencias: { operator: 'not_empty' } }),
  defaultAggregates: [{ id: 'registros', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }],
}));

export const PESAGENS_ORIGEM = defineReport(eventBase({
  id: 'pesagens.origem', family: 'pesagens', title: 'Pesagens por origem do registro',
  description: 'Lançamentos manuais × importados no período.',
  metrics: ['Registros por origem'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'origem_registro', 'operador'],
  defaultGroups: [{ columnId: 'origem_registro' }],
}));

export const FECHAMENTO_DIA = defineReport(eventBase({
  id: 'controle.fechamento-dia', family: 'controle', title: 'Fechamento do dia (imprimível)',
  description: 'Lançamentos de um dia agrupados por sessão, com pendências e totais — mesmas regras da tela Fechamento do Dia.',
  requires: ['reports.read', 'session.close'],
  params: [PERIOD('hoje')],
  metrics: ['Lançamentos', 'Animais únicos', 'Peso médio', 'GMD ponderado', 'Pendências'],
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'gmd', 'nome_apartacao', 'nome_lote', 'pendencias', 'observacao'],
  defaultGroups: [{ columnId: 'sessao' }],
  defaultAggregates: [...EVENT_TOTALS, { id: 'peso_total', columnId: 'peso', op: 'sum' }],
  notes: ['Pendências: Peso (GMD negativo), Lote (sem lote fora de saída), Doc (saída sem documento quando exigido).'],
}));

// ---- Movimentação ----
export const MOV_ENTRADAS_SAIDAS = defineReport(eventBase({
  id: 'movimentacao.entradas-saidas', family: 'movimentacao', title: 'Entradas e saídas',
  description: 'Cadastros (entradas) e saídas definitivas do período, com quantidade e peso.',
  metrics: ['Entradas', 'Saídas', 'Peso médio'],
  sourceOptions: { tipos: ['Cadastro', 'Saída'] },
  defaultColumns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso'],
  defaultGroups: [{ columnId: 'tipo_manejo' }],
  defaultAggregates: [{ id: 'registros', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }],
}));

const lotStayBase = {
  family: 'movimentacao', grain: GRAINS.LOT_STAY, version: 1, source: 'lotStays.byPeriod',
  requires: ['reports.read', 'animal.read'], params: [PERIOD()], columns: LOT_STAY_COLUMNS, animalColumnId: 'animal',
  searchColumns: ['animal', 'marca', 'lote'], defaultSort: [{ columnId: 'inicio', direction: 'asc' }],
  defaultAggregates: [{ id: 'permanencias', op: 'count' }, { id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'dias_medio', columnId: 'dias_no_lote', op: 'avg' }],
  periodExemption: 'LOT_STAY usa o período como interseção',
};

export const MOV_MUDANCAS_LOTE = defineReport({
  ...lotStayBase,
  id: 'movimentacao.mudancas-lote', title: 'Mudanças de lote',
  description: 'Entradas em lote vindas de outro lote no período (permanências reconstruídas a partir das pesagens).',
  metrics: ['Mudanças', 'Animais', 'Dias no lote'],
  defaultColumns: ['animal', 'marca', 'sexo', 'lote_origem', 'lote', 'apartacao', 'inicio', 'fim', 'dias_no_lote'],
  defaultGroups: [{ columnId: 'lote' }],
  lockedFilters: (params) => ({ mudanca: { operator: 'equals', value: true }, inicio: { operator: 'between', value: params.periodo.from, valueTo: params.periodo.to } }),
  notes: ['Fonte: projeção animalLotes, recalculada a cada edição de pesagem (não usa movimentosAnimais, que não acompanha edições).'],
});

export const MOV_PERMANENCIAS = defineReport({
  ...lotStayBase,
  id: 'movimentacao.permanencias-lote', title: 'Permanência em lotes no período',
  description: 'Cada período de permanência de animal em lote que toca o intervalo, com dias no lote.',
  metrics: ['Permanências', 'Animais', 'Dias médios'],
  defaultColumns: ['animal', 'marca', 'lote', 'apartacao', 'inicio', 'fim', 'dias_no_lote', 'mudanca'],
  defaultGroups: [{ columnId: 'lote' }],
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

export const SAIDAS_MOTIVO = defineReport(exitBase({
  id: 'saidas.motivo', title: 'Saídas por motivo',
  description: 'Saídas definitivas do período agrupadas por motivo (venda, abate, morte, doação, transferência).',
  metrics: ['Saídas por motivo', 'Peso médio'],
  defaultColumns: ['data_pesagem', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso', 'nome_lote'],
  defaultGroups: [{ columnId: 'motivo_saida' }],
}));

const MORTES = () => ({ motivo_saida: { operator: 'in', values: ['Morte'] } });
const deathPreset = (key, title, groupColumn, description) => defineReport(exitBase({
  id: `saidas.mortes${key ? `.${key}` : ''}`, title, description, presetOf: 'saidas.mortes',
  metrics: ['Mortes', 'Animais'],
  defaultColumns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'categoria', 'causa_morte', 'nome_lote', 'observacao'],
  defaultGroups: groupColumn ? [{ columnId: groupColumn }] : [],
  lockedFilters: MORTES,
  defaultAggregates: [{ id: 'mortes', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }],
  notes: ['Quantidade de mortes. Taxa de mortalidade não é calculada: o denominador (estoque médio × animais-dia) ainda não foi definido.', 'Causa da morte é o texto gravado no lançamento.'],
}));

export const MORTES_PERIODO = deathPreset('', 'Mortes por período', null, 'Lista das mortes do período.');
export const MORTES_CAUSA = deathPreset('causa', 'Mortes por causa', 'causa_morte', 'Mortes do período agrupadas pela causa informada.');
export const MORTES_CATEGORIA = deathPreset('categoria', 'Mortes por categoria', 'categoria', 'Mortes do período agrupadas pela categoria gravada na pesagem de saída.');
export const MORTES_LOTE = deathPreset('lote', 'Mortes por lote', 'nome_lote', 'Mortes do período agrupadas pelo lote.');

// ---- Comercial (dados legados por evento) ----
const commercialBase = (overrides) => exitBase({
  family: 'comercial', requires: ['reports.read', 'weighing.read', 'commercial.values'], classification: DATA_CLASSIFICATION.LEGACY_EVENT,
  notes: ['COMERCIAL — DADOS LEGADOS/POR EVENTO: valores e parceiros vêm do texto gravado em cada lançamento; não há vínculo canônico por parceiro nem operação comercial agregada.', 'Arrobas = carcaça ÷ 15 com o rendimento gravado no lançamento; sem rendimento, arrobas ausentes.'],
  ...overrides,
});

export const COMERCIAL_VENDAS = defineReport(commercialBase({
  id: 'comercial.vendas', title: 'Vendas do período',
  description: 'Saídas por venda com peso, arrobas estimadas, preço por arroba e valor informado.',
  metrics: ['Cabeças', 'Peso', 'Arrobas', 'Valor', 'Preço médio da @ (ponderado)'],
  defaultColumns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'comprador', 'destino_venda', 'rendimento_carcaca', 'peso_carcaca_estimado', 'quantidade_arrobas', 'valor_arroba', 'valor_venda_total'],
  lockedFilters: () => ({ motivo_saida: { operator: 'in', values: ['Venda'] } }),
  defaultAggregates: [{ id: 'cabecas', op: 'count' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'arrobas', columnId: 'quantidade_arrobas', op: 'sum' }, { id: 'valor', columnId: 'valor_venda_total', op: 'sum' }, { id: 'preco_arroba', columnId: 'valor_arroba', op: 'weightedAvg' }],
}));

export const COMERCIAL_ABATES = defineReport(commercialBase({
  id: 'comercial.abates', title: 'Abates do período',
  description: 'Saídas por abate com frigorífico (texto), rendimento, arrobas, preço por arroba e valor.',
  metrics: ['Cabeças', 'Arrobas', 'Valor', 'Preço médio da @ (ponderado)'],
  defaultColumns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'frigorifico', 'rendimento_carcaca', 'peso_carcaca_estimado', 'quantidade_arrobas', 'valor_arroba_abate', 'valor_total_abate'],
  lockedFilters: () => ({ motivo_saida: { operator: 'in', values: ['Abate'] } }),
  defaultAggregates: [{ id: 'cabecas', op: 'count' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'arrobas', columnId: 'quantidade_arrobas', op: 'sum' }, { id: 'valor', columnId: 'valor_total_abate', op: 'sum' }, { id: 'preco_arroba', columnId: 'valor_arroba_abate', op: 'weightedAvg' }],
}));

export const COMERCIAL_COMPRAS = defineReport(commercialBase({
  id: 'comercial.compras', title: 'Compras do período', grain: GRAINS.EVENT,
  description: 'Cadastros com valor pago por cabeça informado, com origem/vendedor em texto.',
  metrics: ['Cabeças', 'Valor total', 'Valor médio por cabeça'],
  sourceOptions: { tipos: ['Cadastro'] },
  defaultColumns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'raca', 'peso', 'origem_animal', 'valor_pago_cabeca'],
  lockedFilters: () => ({ valor_pago_cabeca: { operator: 'not_empty' } }),
  defaultAggregates: [{ id: 'cabecas', op: 'count' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'valor', columnId: 'valor_pago_cabeca', op: 'sum' }, { id: 'valor_medio', columnId: 'valor_pago_cabeca', op: 'avg' }],
}));

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
