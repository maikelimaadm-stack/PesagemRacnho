// Aliases dos relatórios consolidados na E1 (1.4.0): 61 definições viraram 12 relatórios visíveis.
// Cada id antigo aponta para o relatório novo com a MESMA seleção que o relatório antigo produzia
// (colunas, agrupamento, filtros, ordenação e totais). Condições fixas antigas viraram filtros comuns
// (removíveis), com o mesmo efeito na abertura. Favoritos, recentes, modelos salvos e links antigos
// continuam abrindo o que abriam (reportTemplateService.migrateReportPreferences).
//
// Formato: LEGACY_REPORT_ALIASES[idAntigo] = { id, title, columns, groups, filters, sort, aggregates,
//   mode, fixed, legacyParams? }
//   fixed        → colunas de `filters` que eram CONDIÇÃO do relatório antigo (lockedFilters ou recorte
//                  da fonte): um modelo salvo no relatório antigo não as guardava, então a migração do
//                  modelo as acrescenta; filtros padrão (ex.: só ativos) já vinham no próprio modelo.
//   legacyParams → parâmetros que deixaram de existir, traduzidos em filtro (> N).
//   view         → (E1E) o relatório antigo virou um TIPO do novo (Vendas/Abates/Compras do período → Comercial ›
//                  Vendas/Abates/Compras): abre nesse tipo, com a seleção dele; `legacy` guarda a seleção do
//                  relatório antigo para converter modelo salvo nele com agrupamento próprio (Personalizado).
import { REPORT_MODES } from '../domain/reportDefinition.js';
import { viewSelection } from '../domain/reportViews.js';
import { ATIVOS, CURRENT_TOTALS, REBANHO_ANALITICO_COLUMNS, REBANHO_ANALITICO_TOTALS } from './rebanho.js';
import { EVENT_TOTALS, PERIOD_EVENT_COLUMNS } from './pesagens.js';
import { PERFORMANCE_COLUMNS, PERFORMANCE_TOTALS } from './desempenho.js';
import { LOT_STAY_TOTALS, OPERATIONAL_EVENT_TOTALS } from './operacional.js';
import { COMERCIAL } from './comercial.js';

const { RESUMIDO, DETALHADO } = REPORT_MODES;
const clone = (value) => JSON.parse(JSON.stringify(value));

const alias = (id, title, selection) => Object.freeze({
  id,
  title,
  columns: selection.columns ? [...selection.columns] : undefined,
  groups: clone(selection.groups ?? []),
  filters: clone(selection.filters ?? {}),
  sort: selection.sort ? clone(selection.sort) : undefined,
  aggregates: selection.aggregates ? clone(selection.aggregates) : undefined,
  mode: selection.mode ?? ((selection.groups ?? []).length ? RESUMIDO : DETALHADO),
  fixed: Object.freeze([...(selection.fixed ?? [])]),
  legacyParams: selection.legacyParams ?? null,
});

// E1E: relatório antigo que virou TIPO do relatório novo. A seleção do alias é a do tipo (agrupamento, modo, colunas,
// totais e ordem); a população do relatório antigo é a condição fixa do tipo (view.population), então `fixed` fica vazio.
const typedAlias = (definition, viewId, title, legacy) => Object.freeze({
  ...alias(definition.id, title, viewSelection(viewId, definition)),
  view: viewId,
  legacy: Object.freeze(clone(legacy)),
});

const ANIMAL_ASC = [{ columnId: 'animal', direction: 'asc' }];
const EVENT_SORT = [{ columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'numero_animal', direction: 'asc' }];
const MORTES = { motivo_saida: { operator: 'in', values: ['Morte'] } };
const EXIT_TOTALS = [{ id: 'saidas', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }];
const DEATH_TOTALS = [{ id: 'mortes', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }];
const DEATH_COLUMNS = ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'categoria', 'causa_morte', 'nome_lote', 'observacao'];

const HERD_DIMENSIONS = [
  ['marca', 'marca', 'Rebanho por marca'],
  ['raca', 'raca', 'Rebanho por raça'],
  ['categoria', 'categoria', 'Rebanho por categoria'],
  ['sexo', 'sexo', 'Rebanho por sexo'],
  ['situacao', 'situacao', 'Rebanho por situação'],
  ['lote', 'lote_atual', 'Rebanho por lote'],
  ['apartacao', 'apartacao_atual', 'Rebanho por apartação'],
  ['faixa_peso', 'faixa_peso', 'Rebanho por faixa de peso'],
];

const PERFORMANCE_DIMENSIONS = [
  ['marca', 'Desempenho por marca'],
  ['raca', 'Desempenho por raça'],
  ['categoria', 'Desempenho por categoria'],
  ['sexo', 'Desempenho por sexo'],
  ['lote', 'Desempenho por lote (sem apartação)'],
  ['apartacao', 'Desempenho por apartação'],
];

const entries = [
  // ---- Rebanho → rebanho.atual ----
  // E1G (A4): o inventário abre no Analítico do Rebanho atual, que ganhou o Último GMD e o GMD desde a entrada.
  ['rebanho.inventario', alias('rebanho.atual', 'Inventário atual do rebanho', {
    columns: REBANHO_ANALITICO_COLUMNS, filters: ATIVOS, sort: ANIMAL_ASC, aggregates: REBANHO_ANALITICO_TOTALS, mode: DETALHADO,
  })],
  ...HERD_DIMENSIONS.map(([key, columnId, title]) => [`rebanho.dimensao.${key}`, alias('rebanho.atual', title, {
    columns: ['animal', 'marca', 'sexo', 'raca', 'categoria', 'lote_atual', 'ultimo_peso_kg'].filter((id) => id !== columnId),
    groups: [{ columnId }],
    // Por situação mostrava todas as situações; os demais, só ativos.
    filters: key === 'situacao' ? {} : ATIVOS,
    sort: ANIMAL_ASC,
    aggregates: CURRENT_TOTALS,
  })]),
  ['rebanho.sem-pesagem-recente', alias('rebanho.atual', 'Animais sem pesagem recente', {
    columns: ['animal', 'marca', 'sexo', 'categoria', 'lote_atual', 'ultima_pesagem_data', 'ultimo_peso_kg', 'dias_sem_pesagem'],
    filters: { ...ATIVOS, dias_sem_pesagem: { operator: 'greater', value: '30' } },
    sort: [{ columnId: 'dias_sem_pesagem', direction: 'desc' }],
    aggregates: [{ id: 'animais', columnId: 'animal', op: 'countDistinct' }, { id: 'dias_medio', columnId: 'dias_sem_pesagem', op: 'avg' }, { id: 'dias_max', columnId: 'dias_sem_pesagem', op: 'max' }],
    mode: DETALHADO,
    fixed: ['situacao', 'dias_sem_pesagem'],
    // O parâmetro "Dias sem pesagem (mais de)" virou filtro da coluna (mesma condição: > N).
    legacyParams: { dias_sem_pesagem: 'dias_sem_pesagem' },
  })],

  // ---- Pesagens → pesagens ----
  ['pesagens.periodo', alias('pesagens', 'Pesagens por período', {
    columns: PERIOD_EVENT_COLUMNS, sort: EVENT_SORT, aggregates: EVENT_TOTALS, mode: DETALHADO,
  })],
  ['pesagens.sessao', alias('pesagens', 'Pesagens por sessão', {
    columns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'peso', 'nome_lote', 'gmd', 'operador'],
    groups: [{ columnId: 'sessao' }], sort: EVENT_SORT, aggregates: EVENT_TOTALS,
  })],
  ['pesagens.lote', alias('pesagens', 'Pesagens por lote e apartação', {
    columns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'peso', 'gmd'],
    groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], sort: EVENT_SORT, aggregates: EVENT_TOTALS,
  })],
  ['pesagens.operador', alias('pesagens', 'Pesagens por operador', {
    columns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'nome_lote', 'sessao'],
    groups: [{ columnId: 'operador' }], sort: EVENT_SORT, aggregates: OPERATIONAL_EVENT_TOTALS,
  })],
  ['pesagens.origem', alias('pesagens', 'Pesagens por origem do registro', {
    columns: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'peso', 'origem_registro', 'operador'],
    groups: [{ columnId: 'origem_registro' }], sort: EVENT_SORT, aggregates: OPERATIONAL_EVENT_TOTALS,
  })],
  ['movimentacao.entradas-saidas', alias('pesagens', 'Entradas e saídas', {
    columns: ['data_pesagem', 'tipo_manejo', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso'],
    groups: [{ columnId: 'tipo_manejo' }],
    // Antes: fonte limitada a Cadastro e Saída; agora o mesmo recorte como filtro de Tipo.
    filters: { tipo_manejo: { operator: 'in', values: ['Cadastro', 'Saída'] } },
    fixed: ['tipo_manejo'],
    sort: EVENT_SORT,
    aggregates: [{ id: 'registros', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }, { id: 'peso_medio', columnId: 'peso', op: 'avg' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }],
  })],

  // ---- Desempenho → desempenho ----
  ['desempenho.individual', alias('desempenho', 'Desempenho individual', {
    columns: PERFORMANCE_COLUMNS, sort: ANIMAL_ASC, aggregates: PERFORMANCE_TOTALS, mode: DETALHADO,
  })],
  ['desempenho.lote', alias('desempenho', 'Desempenho por lote', {
    columns: ['animal', 'marca', 'sexo', 'peso_inicial', 'peso_final', 'dias', 'ganho', 'gmd'],
    groups: [{ columnId: 'apartacao' }, { columnId: 'lote' }], sort: ANIMAL_ASC, aggregates: PERFORMANCE_TOTALS,
  })],
  ...PERFORMANCE_DIMENSIONS.map(([columnId, title]) => [`desempenho.dimensao.${columnId}`, alias('desempenho', title, {
    columns: ['animal', 'marca', 'sexo', 'peso_inicial', 'peso_final', 'ganho', 'gmd'].filter((id) => id !== columnId),
    groups: [{ columnId }], sort: ANIMAL_ASC, aggregates: PERFORMANCE_TOTALS,
  })]),
  ['desempenho.perdendo-peso', alias('desempenho', 'Animais perdendo peso', {
    columns: ['animal', 'marca', 'sexo', 'lote', 'data_inicial', 'peso_inicial', 'data_final', 'peso_final', 'dias', 'ganho', 'gmd'],
    filters: { ganho: { operator: 'less', value: '0' } },
    fixed: ['ganho'],
    sort: [{ columnId: 'ganho', direction: 'asc' }],
    aggregates: PERFORMANCE_TOTALS,
    mode: DETALHADO,
  })],
  ['desempenho.faixa-peso', alias('desempenho', 'Distribuição por faixa de peso (período)', {
    columns: ['animal', 'marca', 'sexo', 'peso_final', 'ganho', 'gmd'],
    groups: [{ columnId: 'faixa_peso' }], sort: ANIMAL_ASC, aggregates: PERFORMANCE_TOTALS,
  })],

  // ---- Movimentação de lotes → movimentacao.lotes ----
  ['movimentacao.mudancas-lote', alias('movimentacao.lotes', 'Mudanças de lote', {
    columns: ['animal', 'marca', 'sexo', 'lote_origem', 'lote', 'apartacao', 'inicio', 'fim', 'dias_no_lote'],
    groups: [{ columnId: 'lote' }],
    filters: { mudanca: { operator: 'equals', value: 'sim' }, entrada_no_periodo: { operator: 'equals', value: 'sim' } },
    fixed: ['mudanca', 'entrada_no_periodo'],
    sort: [{ columnId: 'inicio', direction: 'asc' }],
    aggregates: LOT_STAY_TOTALS,
  })],
  ['movimentacao.permanencias-lote', alias('movimentacao.lotes', 'Permanência em lotes no período', {
    columns: ['animal', 'marca', 'lote', 'apartacao', 'inicio', 'fim', 'dias_no_lote', 'mudanca'],
    groups: [{ columnId: 'lote' }], sort: [{ columnId: 'inicio', direction: 'asc' }], aggregates: LOT_STAY_TOTALS,
  })],

  // ---- Saídas → saidas ----
  ['saidas.motivo', alias('saidas', 'Saídas por motivo', {
    columns: ['data_pesagem', 'motivo_saida', 'numero_animal', 'marca', 'sexo', 'categoria', 'peso', 'nome_lote'],
    groups: [{ columnId: 'motivo_saida' }], sort: EVENT_SORT, aggregates: EXIT_TOTALS,
  })],
  ['saidas.mortes', alias('saidas', 'Mortes por período', { columns: DEATH_COLUMNS, filters: MORTES, fixed: ['motivo_saida'], sort: EVENT_SORT, aggregates: DEATH_TOTALS, mode: DETALHADO })],
  ['saidas.mortes.causa', alias('saidas', 'Mortes por causa', { columns: DEATH_COLUMNS, groups: [{ columnId: 'causa_morte' }], filters: MORTES, fixed: ['motivo_saida'], sort: EVENT_SORT, aggregates: DEATH_TOTALS })],
  ['saidas.mortes.categoria', alias('saidas', 'Mortes por categoria', { columns: DEATH_COLUMNS, groups: [{ columnId: 'categoria' }], filters: MORTES, fixed: ['motivo_saida'], sort: EVENT_SORT, aggregates: DEATH_TOTALS })],
  ['saidas.mortes.lote', alias('saidas', 'Mortes por lote', { columns: DEATH_COLUMNS, groups: [{ columnId: 'nome_lote' }], filters: MORTES, fixed: ['motivo_saida'], sort: EVENT_SORT, aggregates: DEATH_TOTALS })],

  // ---- Comercial (E1E) → comercial, no tipo. `legacy` = colunas, ordem e totais padrão do relatório antigo (1.3.x a E1D).
  ['comercial.vendas', typedAlias(COMERCIAL, 'vendas', 'Vendas do período', {
    columns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'comprador', 'destino_venda', 'rendimento_carcaca', 'peso_carcaca_estimado', 'quantidade_arrobas', 'valor_arroba', 'valor_venda_total'],
    sort: EVENT_SORT,
    aggregates: [{ id: 'cabecas', op: 'count' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'arrobas', columnId: 'quantidade_arrobas', op: 'sum' }, { id: 'valor', columnId: 'valor_venda_total', op: 'sum' }, { id: 'preco_arroba', columnId: 'valor_arroba', op: 'weightedAvg' }],
  })],
  ['comercial.abates', typedAlias(COMERCIAL, 'abates', 'Abates do período', {
    columns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'frigorifico', 'rendimento_carcaca', 'peso_carcaca_estimado', 'quantidade_arrobas', 'valor_arroba_abate', 'valor_total_abate'],
    sort: EVENT_SORT,
    aggregates: [{ id: 'cabecas', op: 'count' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'arrobas', columnId: 'quantidade_arrobas', op: 'sum' }, { id: 'valor', columnId: 'valor_total_abate', op: 'sum' }, { id: 'preco_arroba', columnId: 'valor_arroba_abate', op: 'weightedAvg' }],
  })],
  ['comercial.compras', typedAlias(COMERCIAL, 'compras', 'Compras do período', {
    columns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'raca', 'peso', 'origem_animal', 'valor_pago_cabeca'],
    sort: EVENT_SORT,
    aggregates: [{ id: 'cabecas', op: 'count' }, { id: 'peso_total', columnId: 'peso', op: 'sum' }, { id: 'valor', columnId: 'valor_pago_cabeca', op: 'sum' }, { id: 'valor_medio', columnId: 'valor_pago_cabeca', op: 'avg' }],
  })],
];

export const LEGACY_REPORT_ALIASES = Object.freeze(Object.fromEntries(entries));

export function getLegacyAlias(id) {
  return Object.prototype.hasOwnProperty.call(LEGACY_REPORT_ALIASES, id) ? LEGACY_REPORT_ALIASES[id] : null;
}

/**
 * Seleção equivalente do alias (cópia), com parâmetros antigos traduzidos em filtros.
 * @param {object} aliasEntry item de LEGACY_REPORT_ALIASES
 * @param {object} legacyParamValues parâmetros do relatório antigo (ex.: { dias_sem_pesagem: 4 })
 */
export function aliasSelection(aliasEntry, legacyParamValues = {}) {
  const filters = clone(aliasEntry.filters);
  for (const [param, columnId] of Object.entries(aliasEntry.legacyParams || {})) {
    const value = legacyParamValues?.[param];
    if (value === null || value === undefined || value === '') continue;
    filters[columnId] = { operator: 'greater', value: String(value) };
  }
  return {
    // E1E: alias que virou tipo leva o tipo explícito (o serviço aplica a população dele).
    ...(aliasEntry.view ? { view: aliasEntry.view } : {}),
    ...(aliasEntry.columns ? { columns: [...aliasEntry.columns] } : {}),
    groups: clone(aliasEntry.groups),
    filters,
    ...(aliasEntry.sort ? { sort: clone(aliasEntry.sort) } : {}),
    ...(aliasEntry.aggregates ? { aggregates: clone(aliasEntry.aggregates) } : {}),
    mode: aliasEntry.mode,
  };
}
