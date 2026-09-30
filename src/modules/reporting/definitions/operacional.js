// Famílias PESAGENS (complementos), MOVIMENTAÇÃO, SAÍDAS e EMBARQUES (romaneio); COMERCIAL está em
// comercial.js (E1E). E1 (1.4.0): "Movimentação de lotes" substitui mudanças e permanências; "Saídas"
// substitui saídas por motivo e as quatro de mortes; "Pendências de pesagem" passou para a aba Controle
// da Manutenção; o Fechamento do dia passou para a família Pesagens.
import { REPORT_VISIBILITY, defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';
import { LOT_COLUMNS, LOT_STAY_COLUMNS } from './columns/controlColumns.js';
import { listaTipo, resumoTipo } from './tipos.js';

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

// E1E "Tipo Relatório" (definitions/tipos.js): os tipos de cada relatório abaixo. Totais = os de hoje (os dos
// antigos relatórios separados, aliases da E1), na ordem da folha. Relatórios com versão 2 ganharam os tipos
// (ver rebanho.js).
const FECHAMENTO_COLUMNS = Object.freeze(['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'gmd', 'nome_apartacao', 'nome_lote', 'pendencias', 'observacao']);
const FECHAMENTO_TOTALS = Object.freeze([...OPERATIONAL_EVENT_TOTALS, { id: 'peso_total', columnId: 'peso', op: 'sum' }]);
const FECHAMENTO_TYPE_TOTALS = Object.freeze(['animais', 'registros', 'peso_medio', 'peso_total', 'gmd_ponderado'].map((id) => FECHAMENTO_TOTALS.find((spec) => spec.id === id)));
// "Com Pendências": só os lançamentos com pendência (as mesmas regras da tela), por tipo de pendência.
const COM_PENDENCIAS = Object.freeze({ pendencias: { operator: 'not_empty' } });
export const FECHAMENTO_VIEWS = Object.freeze([
  // O fechamento é conferência linha a linha: abre na lista por sessão (o resumo fica a um clique).
  listaTipo('por-sessao', 'Por Sessão (Lista)', { from: EVENT_COLUMNS, groups: ['sessao'], columns: FECHAMENTO_COLUMNS, aggregates: FECHAMENTO_TYPE_TOTALS }),
  resumoTipo('resumo-por-sessao', 'Resumo por Sessão', ['sessao'], FECHAMENTO_TYPE_TOTALS),
  resumoTipo('por-apartacao-lote', 'Por Apartação/Lote', ['nome_apartacao', 'nome_lote'], FECHAMENTO_TYPE_TOTALS),
  listaTipo('com-pendencias', 'Com Pendências', { from: EVENT_COLUMNS, groups: ['pendencias'], columns: FECHAMENTO_COLUMNS, aggregates: FECHAMENTO_TYPE_TOTALS, population: COM_PENDENCIAS }),
  listaTipo('analitico', 'Analítico (Lista do Dia)', { from: EVENT_COLUMNS, columns: FECHAMENTO_COLUMNS, aggregates: FECHAMENTO_TYPE_TOTALS }),
]);

export const FECHAMENTO_DIA = defineReport(eventBase({
  id: 'controle.fechamento-dia', family: 'pesagens', title: 'Fechamento do dia (imprimível)', sheetTitle: 'Fechamento do Dia', version: 2,
  description: 'Lançamentos de um dia agrupados por sessão, com pendências e totais — mesmas regras da tela Fechamento do Dia.',
  requires: ['reports.read', 'session.close'],
  params: [PERIOD('hoje')],
  metrics: ['Lançamentos', 'Cabeças', 'Peso médio', 'GMD', 'Pendências'],
  defaultColumns: [...FECHAMENTO_COLUMNS],
  defaultGroups: [{ columnId: 'sessao' }],
  // O fechamento é conferência linha a linha: abre no Detalhado (o Resumido fica a um clique).
  defaultMode: 'DETALHADO',
  defaultAggregates: [...FECHAMENTO_TOTALS],
  views: FECHAMENTO_VIEWS,
  defaultView: 'por-sessao',
  notes: ['Pendências: Peso (GMD negativo), Lote (sem lote fora de saída), Doc (saída sem documento quando exigido).'],
}));

// ---- Movimentação ----
export const LOT_STAY_TOTALS = Object.freeze([
  { id: 'permanencias', op: 'count' },
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'dias_medio', columnId: 'dias_no_lote', op: 'avg' },
]);

export const LOT_STAY_NOTE = 'Fonte: projeção animalLotes, recalculada a cada edição de pesagem (não usa movimentosAnimais, que não acompanha edições).';

const MOV_COLUMNS = Object.freeze(['animal', 'marca', 'lote', 'apartacao', 'inicio', 'fim', 'dias_no_lote', 'mudanca']);
const MOV_TYPE_TOTALS = Object.freeze(['animais', 'permanencias', 'dias_medio'].map((id) => LOT_STAY_TOTALS.find((spec) => spec.id === id)));
// "Mudanças de Lote" = o antigo "Mudanças de lote": só quem veio de outro lote e entrou no período (população).
export const MUDANCAS_POPULATION = Object.freeze({ mudanca: { operator: 'equals', value: 'sim' }, entrada_no_periodo: { operator: 'equals', value: 'sim' } });
export const MOV_LOTES_VIEWS = Object.freeze([
  // = o antigo "Permanência em lotes no período".
  resumoTipo('por-lote', 'Por Lote', ['lote'], MOV_TYPE_TOTALS),
  resumoTipo('por-apartacao-lote', 'Por Apartação/Lote', ['apartacao', 'lote'], MOV_TYPE_TOTALS),
  resumoTipo('mudancas-lote', 'Mudanças de Lote', ['lote'], MOV_TYPE_TOTALS, { population: MUDANCAS_POPULATION }),
  resumoTipo('por-lote-anterior', 'Por Lote Anterior', ['lote_origem'], MOV_TYPE_TOTALS),
  resumoTipo('por-marca', 'Por Marca', ['marca'], MOV_TYPE_TOTALS),
  resumoTipo('por-sexo', 'Por Sexo', ['sexo'], MOV_TYPE_TOTALS),
  listaTipo('analitico', 'Analítico (Lista de Permanências)', { from: LOT_STAY_COLUMNS, columns: MOV_COLUMNS, aggregates: MOV_TYPE_TOTALS, sort: [{ columnId: 'inicio', direction: 'asc' }] }),
]);

export const MOV_LOTES = defineReport({
  id: 'movimentacao.lotes', family: 'movimentacao', grain: GRAINS.LOT_STAY, version: 2, source: 'lotStays.byPeriod',
  requires: ['reports.read', 'animal.read'], params: [PERIOD()], columns: LOT_STAY_COLUMNS, animalColumnId: 'animal',
  title: 'Movimentação de lotes',
  description: 'Quem passou por cada lote no período, quantos dias ficou e quem mudou de lote.',
  metrics: ['Permanências', 'Cabeças', 'Dias no lote'],
  searchColumns: ['animal', 'marca', 'lote'],
  defaultColumns: [...MOV_COLUMNS],
  defaultSort: [{ columnId: 'inicio', direction: 'asc' }],
  defaultGroups: [{ columnId: 'lote' }],
  defaultAggregates: LOT_STAY_TOTALS,
  quickGroups: ['lote', 'apartacao', 'lote_origem', 'marca', 'sexo'],
  quickFilters: [
    { id: 'mudancas-no-periodo', label: 'Somente mudanças de lote no período', filters: { mudanca: { operator: 'equals', value: 'sim' }, entrada_no_periodo: { operator: 'equals', value: 'sim' } } },
  ],
  views: MOV_LOTES_VIEWS,
  defaultView: 'por-lote',
  periodExemption: 'LOT_STAY usa o período como interseção',
  notes: [LOT_STAY_NOTE],
});

const OCUPACAO_COLUMNS = Object.freeze(['apartacao', 'lote', 'situacao_lote', 'capacidade', 'animais', 'ocupacao', 'peso_medio_atual']);
const OCUPACAO_TOTALS = Object.freeze([{ id: 'lotes', op: 'count' }, { id: 'animais', columnId: 'animais', op: 'sum' }, { id: 'capacidade', columnId: 'capacidade', op: 'sum' }, { id: 'ocupacao', columnId: 'ocupacao', op: 'ratio' }, { id: 'peso_medio', columnId: 'peso_medio_atual', op: 'weightedAvg' }]);
export const LOTES_OCUPACAO_VIEWS = Object.freeze([
  resumoTipo('por-apartacao', 'Por Apartação', ['apartacao'], OCUPACAO_TOTALS),
  resumoTipo('por-apartacao-lote', 'Por Apartação/Lote', ['apartacao', 'lote'], OCUPACAO_TOTALS),
  listaTipo('analitico', 'Analítico (Lista de Lotes)', { from: LOT_COLUMNS, columns: OCUPACAO_COLUMNS, aggregates: OCUPACAO_TOTALS, sort: [{ columnId: 'lote', direction: 'asc' }] }),
]);

export const LOTES_OCUPACAO = defineReport({
  id: 'rebanho.ocupacao-lotes', family: 'rebanho', grain: GRAINS.LOT, version: 2, source: 'lots.current',
  requires: ['reports.read', 'animal.read'], columns: LOT_COLUMNS, title: 'Ocupação de lotes',
  description: 'Animais ativos por lote contra a capacidade, com peso médio atual.',
  metrics: ['Animais', 'Capacidade', 'Ocupação'],
  defaultColumns: [...OCUPACAO_COLUMNS],
  defaultGroups: [{ columnId: 'apartacao' }],
  defaultSort: [{ columnId: 'lote', direction: 'asc' }],
  defaultAggregates: [...OCUPACAO_TOTALS],
  views: LOTES_OCUPACAO_VIEWS,
  defaultView: 'por-apartacao',
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

const SAIDAS_COLUMNS = Object.freeze(['data_pesagem', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso', 'nome_lote', 'causa_morte']);
// E1G (A1): o Analítico das saídas mostra o GMD da saída com peso (contra a pesagem anterior) no padrão; Dias e
// Ganho ficam em "Colunas" (todas as colunas do relatório, como nos demais tipos lista).
const SAIDAS_ANALITICO_COLUMNS = Object.freeze(['data_pesagem', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso', 'gmd', 'nome_lote', 'causa_morte']);
// Totais das saídas (os de "Saídas por motivo") + peso total; "Saídas" (= linhas) fica só no "Colunas Painel".
const SAIDAS_TYPE_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'saidas', op: 'count' },
]);
const SAIDAS_TYPE_DEFAULTS = Object.freeze(['animais', 'peso_medio', 'peso_total']);
// Na lista só os totais padrão (a contagem de linhas repetiria as Cabeças no subtotal).
const SAIDAS_LIST_TOTALS = Object.freeze(SAIDAS_TYPE_TOTALS.filter((spec) => SAIDAS_TYPE_DEFAULTS.includes(spec.id)));
// Mortes (os antigos "Mortes por período/causa/categoria/lote"): motivo = Morte é condição do tipo (população,
// pelo código, com cadeado); colunas e totais deles.
export const MORTES_POPULATION = Object.freeze({ motivo_saida: { operator: 'in', values: ['Morte'], match: 'code' } });
const MORTES_COLUMNS = Object.freeze(['data_pesagem', 'numero_animal', 'marca', 'sexo', 'categoria', 'causa_morte', 'nome_lote', 'observacao']);
const MORTES_TOTALS = Object.freeze([{ id: 'mortes', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }]);
const saidas = (id, label, groups) => resumoTipo(id, label, groups, SAIDAS_TYPE_TOTALS, { defaults: SAIDAS_TYPE_DEFAULTS });
const mortes = (id, label, groups) => resumoTipo(id, label, groups, MORTES_TOTALS, { population: MORTES_POPULATION });
export const SAIDAS_VIEWS = Object.freeze([
  saidas('por-motivo', 'Por Motivo', ['motivo_saida']),
  saidas('por-lote', 'Por Lote', ['nome_lote']),
  saidas('por-categoria', 'Por Categoria', ['categoria']),
  saidas('por-marca', 'Por Marca', ['marca']),
  saidas('por-data', 'Por Data', ['data_pesagem']),
  mortes('mortes-por-causa', 'Mortes por Causa', ['causa_morte']),
  mortes('mortes-por-lote', 'Mortes por Lote', ['nome_lote']),
  mortes('mortes-por-categoria', 'Mortes por Categoria', ['categoria']),
  listaTipo('analitico', 'Analítico (Lista de Saídas)', { from: EVENT_COLUMNS, columns: SAIDAS_ANALITICO_COLUMNS, aggregates: SAIDAS_LIST_TOTALS }),
  listaTipo('mortes', 'Mortes (Lista)', { from: EVENT_COLUMNS, columns: MORTES_COLUMNS, aggregates: MORTES_TOTALS, population: MORTES_POPULATION }),
]);

export const SAIDAS = defineReport(exitBase({
  id: 'saidas', title: 'Saídas', version: 2,
  description: 'Saídas definitivas do período (venda, abate, morte, doação, transferência) — por motivo, causa da morte, lote ou categoria.',
  metrics: ['Saídas por motivo', 'Cabeças', 'Peso médio'],
  defaultColumns: [...SAIDAS_COLUMNS],
  defaultGroups: [{ columnId: 'motivo_saida' }],
  quickGroups: ['motivo_saida', 'causa_morte', 'nome_lote', 'categoria', 'marca', 'data_pesagem'],
  quickFilters: [
    { id: 'somente-mortes', label: 'Somente mortes', filters: { motivo_saida: { operator: 'in', values: ['Morte'] } } },
  ],
  views: SAIDAS_VIEWS,
  defaultView: 'por-motivo',
  notes: [...MORTALITY_NOTES],
}));

// ---- Comercial ----
// E1E: "Vendas do período", "Abates do período" e "Compras do período" viraram os tipos do relatório
// "Comercial" (comercial.js); os ids antigos são aliases (legacyAliases.js).

// ---- Embarques ----
const ROMANEIO_COLUMNS = Object.freeze(['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'nome_lote', 'nome_apartacao', 'motivo_saida', 'embarque_nome', 'documento_tipo', 'documento_numero', 'destino_venda', 'frigorifico']);
const ROMANEIO_TOTALS = Object.freeze([{ id: 'cabecas', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }]);
const ROMANEIO_TYPE_TOTALS = Object.freeze(['animais', 'peso_medio', 'peso_total', 'cabecas'].map((id) => ROMANEIO_TOTALS.find((spec) => spec.id === id)));
const ROMANEIO_TYPE_DEFAULTS = Object.freeze(['animais', 'peso_medio', 'peso_total']);
const EMBARQUE_DOCUMENTO = Object.freeze(['embarque_nome', 'documento_numero']);
// Nas listas só os totais padrão (a contagem de linhas repetiria as Cabeças no subtotal).
const ROMANEIO_LIST_TOTALS = Object.freeze(ROMANEIO_TYPE_TOTALS.filter((spec) => ROMANEIO_TYPE_DEFAULTS.includes(spec.id)));
export const ROMANEIO_VIEWS = Object.freeze([
  resumoTipo('por-embarque-documento', 'Por Embarque/Documento', EMBARQUE_DOCUMENTO, ROMANEIO_TYPE_TOTALS, { defaults: ROMANEIO_TYPE_DEFAULTS }),
  resumoTipo('por-embarque', 'Por Embarque', ['embarque_nome'], ROMANEIO_TYPE_TOTALS, { defaults: ROMANEIO_TYPE_DEFAULTS }),
  // O romaneio de papel: os animais de cada documento, com subtotal por documento e por embarque (embarque e nº
  // do documento já estão no título de cada grupo).
  listaTipo('romaneio-lista', 'Romaneio (Lista por Documento)', { from: EVENT_COLUMNS, groups: EMBARQUE_DOCUMENTO, columns: ROMANEIO_COLUMNS.filter((id) => !EMBARQUE_DOCUMENTO.includes(id)), aggregates: ROMANEIO_LIST_TOTALS }),
  listaTipo('analitico', 'Analítico (Lista de Animais)', { from: EVENT_COLUMNS, columns: ROMANEIO_COLUMNS, aggregates: ROMANEIO_LIST_TOTALS }),
]);

export const EMBARQUES_ROMANEIO = defineReport(exitBase({
  id: 'embarques.romaneio', family: 'embarques', title: 'Romaneio de embarque', version: 2,
  description: 'Animais de saída vinculados a embarque/documento, agrupados por documento.',
  requires: ['reports.read', 'weighing.read', 'shipment.read'],
  metrics: ['Cabeças por documento', 'Peso embarcado'],
  defaultColumns: [...ROMANEIO_COLUMNS],
  defaultGroups: [{ columnId: 'embarque_nome' }, { columnId: 'documento_numero' }],
  lockedFilters: () => ({ embarque_vinculado: { operator: 'equals', value: true } }),
  defaultAggregates: [...ROMANEIO_TOTALS],
  // E1F: a contagem de linhas é "Saídas" sempre — no seletor "Colunas Painel", na folha e no XLSX, com ou sem
  // "Cabeças" (animais distintos) ao lado; o rótulo automático dizia "Cabeças" quando ela vinha sozinha.
  metricLabels: { cabecas: 'Saídas' },
  views: ROMANEIO_VIEWS,
  defaultView: 'por-embarque-documento',
}));
