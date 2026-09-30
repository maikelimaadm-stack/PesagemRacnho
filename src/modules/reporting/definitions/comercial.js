// Família COMERCIAL (grão EVENT). E1E (1.4.0, docs/plano-mestre/E1E-TODOS-RELATORIOS-ESTILO-MAKGESTAO.md item 5):
// "Vendas do período", "Abates do período" e "Compras do período" viram UM relatório, "Comercial", com os tipos
// Vendas, Abates e Compras — os três no desenho do relatório de venda do MAKGESTAO (PDF da W3, sheetLayout →
// domain/vendasLayout). Os ids antigos (comercial.vendas/abates/compras) continuam abrindo como alias deste
// relatório, já no tipo certo (legacyAliases.js); modelos, favoritos, recentes e último estado são convertidos com
// auditoria "relatorios-comercial-e1e" (reportTemplateService.migrateReportPreferences).
//
// Cada tipo tem população FIXA (population, com cadeado — nenhum controle amplia) e as contas de domain/vendasLayout:
//   Vendas   Saída por Venda, por comprador — as MESMAS contas de Pesagens › Vendas (E1D): Valor total = digitado,
//            senão peso ÷ divisor da @ × Valor @; Média valor da arroba ponderada pela @ viva;
//   Abates   Saída por Abate, por frigorífico — só o que o lançamento grava: @ de carcaça (quantidade_arrobas,
//            carcaça ÷ 15 com o rendimento), rendimento, Valor @ do abate (ponderado pela @ de carcaça) e o valor do
//            abate digitado; sem valor digitado a venda fica "-" e fora da soma (nenhuma conta inventada);
//   Compras  Cadastro com valor pago por cabeça, por origem/vendedor (texto do lançamento): Valor total = soma do valor
//            por cabeça; Valor médio por cabeça = média dele.
// Comprador, frigorífico e origem são o texto gravado no lançamento (DADOS LEGADOS/POR EVENTO; na E5 viram parceiros).
// Só abre quem tem commercial.values (OPERADOR e CONSULTA nem veem o relatório).
import { DATA_CLASSIFICATION, REPORT_MODES, defineReport } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { ABATES_BLOCK_TOTALS, COMPRAS_BLOCK_TOTALS, VENDAS_BLOCK_TOTALS } from '../domain/vendasLayout.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';
import { PESAGENS_SORT_CHOICES, VENDAS_AVAILABLE_COLUMNS, VENDAS_COLUMN_LABELS, VENDAS_COLUMNS, VENDAS_METRIC_LABELS, VENDAS_POPULATION } from './pesagens.js';

const { DETALHADO } = REPORT_MODES;
const pelo = (values) => ({ operator: 'in', values, match: 'code' });

// Abates: saídas por abate (a mesma população de "Abates do período"). Detalhe = frigorífico, data, animal, peso e as
// contas gravadas no lançamento; as opcionais ficam no seletor "Colunas".
export const ABATES_POPULATION = Object.freeze({ tipo_manejo: pelo(['Saída']), motivo_saida: pelo(['Abate']) });
export const ABATES_COLUMNS = Object.freeze(['frigorifico', 'data_pesagem', 'numero_animal', 'peso', 'rendimento_carcaca', 'quantidade_arrobas', 'valor_arroba_abate', 'valor_total_abate']);
export const ABATES_AVAILABLE_COLUMNS = Object.freeze([...ABATES_COLUMNS, 'peso_carcaca_estimado', 'marca', 'sexo', 'raca', 'era', 'nome_lote', 'nome_apartacao', 'embarque_nome', 'documento_numero', 'observacao']);
export const ABATES_COLUMN_LABELS = Object.freeze({ rendimento_carcaca: 'Rendimento', quantidade_arrobas: '@ Carcaça', valor_arroba_abate: 'Valor @', valor_total_abate: 'Valor Total' });

// Compras: cadastros com valor pago por cabeça (a mesma população de "Compras do período"), por origem/vendedor.
export const COMPRAS_POPULATION = Object.freeze({ tipo_manejo: pelo(['Cadastro']), valor_pago_cabeca: { operator: 'not_empty' } });
export const COMPRAS_COLUMNS = Object.freeze(['origem_animal', 'data_pesagem', 'numero_animal', 'peso', 'valor_pago_cabeca']);
export const COMPRAS_AVAILABLE_COLUMNS = Object.freeze([...COMPRAS_COLUMNS, 'marca', 'sexo', 'raca', 'era', 'nome_lote', 'nome_apartacao', 'compra_gta', 'compra_nfe', 'compra_frete', 'observacao']);
export const COMPRAS_COLUMN_LABELS = Object.freeze({ valor_pago_cabeca: 'Valor/Cabeça' });

// Os 3 tipos, nesta ordem (ids estáveis: vão para último estado, modelos, aliases e manifesto). Abre em Vendas.
export const COMERCIAL_VIEW_IDS = Object.freeze(['vendas', 'abates', 'compras']);
export const COMERCIAL_DEFAULT_VIEW = 'vendas';
const typeOf = (id, label, groupColumn, population, columns, available, aggregates, columnLabels) => ({
  id, label, mode: DETALHADO, titleKind: 'Sintético', sheetLayout: id,
  groups: [{ columnId: groupColumn }], population, columns: [...columns], aggregates,
  columnChoices: { available: [...available], defaults: [...columns] }, columnLabels,
});
export const COMERCIAL_VIEWS = Object.freeze([
  typeOf('vendas', 'Vendas', 'comprador', VENDAS_POPULATION, VENDAS_COLUMNS, VENDAS_AVAILABLE_COLUMNS, VENDAS_BLOCK_TOTALS, VENDAS_COLUMN_LABELS),
  typeOf('abates', 'Abates', 'frigorifico', ABATES_POPULATION, ABATES_COLUMNS, ABATES_AVAILABLE_COLUMNS, ABATES_BLOCK_TOTALS, ABATES_COLUMN_LABELS),
  typeOf('compras', 'Compras', 'origem_animal', COMPRAS_POPULATION, COMPRAS_COLUMNS, COMPRAS_AVAILABLE_COLUMNS, COMPRAS_BLOCK_TOTALS, COMPRAS_COLUMN_LABELS),
]);

// "Ordenar por": as do MAKGESTAO que fazem sentido em venda/abate/compra (sem GMD). Ordena os lançamentos dentro de
// cada grupo (domain/sortChoices — Detalhado com tipo).
export const COMERCIAL_SORT_CHOICES = Object.freeze(PESAGENS_SORT_CHOICES.filter((choice) => !choice.id.startsWith('gmd_')));

// Rótulos de curral dos totais (grade, CSV e XLSX do Detalhado leem pelo id; o mesmo id tem o mesmo rótulo nos 3 tipos).
export const COMERCIAL_METRIC_LABELS = Object.freeze({
  ...VENDAS_METRIC_LABELS,
  peso_total: 'Peso total (kg)',
  peso_medio: 'Peso médio (kg)',
  media_arroba: 'Média (@)',
  animais_abatidos: 'Animais abatidos',
  rendimento_medio: 'Rendimento médio (%)',
  arrobas_carcaca: 'Total @ carcaça',
  media_arroba_carcaca: 'Média @ carcaça',
  animais_comprados: 'Animais comprados',
  valor_medio_cabeca: 'Valor médio por cabeça',
});

export const COMERCIAL = defineReport({
  id: 'comercial',
  family: 'comercial',
  title: 'Comercial',
  // Folha e tela: "Relatório de Vendas, Abates e Compras" (o tipo aparece nos blocos: TOTAIS POR FRIGORÍFICO…).
  sheetTitle: 'Vendas, Abates e Compras',
  grain: GRAINS.EVENT,
  version: 1,
  source: 'events.byPeriod',
  // Só o que os 3 tipos usam: saídas (vendas e abates) e cadastros (compras). A população de cada tipo é a condição fixa dele.
  sourceOptions: { tipos: ['Saída', 'Cadastro'] },
  requires: ['reports.read', 'weighing.read', 'commercial.values'],
  classification: DATA_CLASSIFICATION.LEGACY_EVENT,
  description: 'Vendas por comprador, abates por frigorífico e compras por origem no período, no desenho do relatório de venda do MAKGESTAO.',
  metrics: ['Cabeças', 'Peso', 'Arrobas', 'Valor', 'Média valor da arroba'],
  params: [{ id: 'periodo', type: 'period', label: 'Período', required: true, default: { preset: 'ultimos_90_dias' } }],
  columns: EVENT_COLUMNS,
  animalColumnId: 'numero_animal',
  searchColumns: [...RELATION_SEARCH_COLUMN_IDS],
  defaultColumns: [...VENDAS_COLUMNS],
  defaultSort: [{ columnId: 'data_pesagem', direction: 'asc' }, { columnId: 'numero_animal', direction: 'asc' }],
  // Sem tipo (Personalizado) a lista, sem agrupamento (Detalhado); os tipos agrupam pelo grupo do desenho.
  defaultGroups: [],
  defaultAggregates: VENDAS_BLOCK_TOTALS,
  quickGroups: ['comprador', 'frigorifico', 'origem_animal', 'destino_venda', 'data_pesagem', 'marca', 'embarque_nome'],
  views: COMERCIAL_VIEWS,
  defaultView: COMERCIAL_DEFAULT_VIEW,
  sortChoices: COMERCIAL_SORT_CHOICES,
  defaultSortChoice: 'data_desc',
  metricLabels: COMERCIAL_METRIC_LABELS,
  notes: [
    'COMERCIAL — DADOS LEGADOS/POR EVENTO: valores e parceiros vêm do texto gravado em cada lançamento; não há vínculo canônico por parceiro nem operação comercial agregada.',
    'Vendas: @ = peso vivo ÷ divisor; Valor total = digitado, senão @ viva × Valor @. Abates: @ de carcaça gravada (÷ 15 com rendimento) e valor do abate digitado. Compras: valor pago por cabeça.',
  ],
});
