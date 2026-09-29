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

// E1B "Analítico por animal" (até a E1C): uma linha por pesagem com os dados da conferência no curral.
// Continua exportado para a conversão de modelos da E1B (reportTemplateService) e para os gates.
export const ANALYTIC_EVENT_COLUMNS = Object.freeze(['data_pesagem', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'nome_lote', 'nome_apartacao', 'peso', 'peso_arroba', 'peso_anterior', 'dias', 'ganho', 'gmd']);

// ---------------------------------------------------------------------------------------------------
// E1D — "Relatório de Pesagens Individuais" igual ao MAKGESTAO (docs/plano-mestre/E1D-...md): os 5 tipos,
// com os nomes e a ordem do antigo, e as contas corretas do motor atual (animais distintos, GMD ponderado).
// Contratos entre as partes: docs/evidence/e1d/CONTRATOS-AGENTES.md.
// ---------------------------------------------------------------------------------------------------

// Chaves de coluna das tabelas por lote ("Colunas" dos tipos resumidos), na ordem do painel do antigo. A
// coluna Lote (rótulo) está sempre na folha; "faixa" é o par Faixa exigida (faixa_min + faixa_max).
export const SHEET_COLUMN_KEYS = Object.freeze(['qtd', 'faixa', 'menor', 'maior', 'peso_medio', 'media_arroba', 'peso_total', 'total_arroba', 'ganho_medio', 'ganho_medio_arroba', 'ganho_total', 'ganho_total_arroba', 'dias_medios', 'gmd_medio', 'machos', 'femeas']);
// Visíveis por padrão (item 5): Lote, Qtd, Faixa exigida, Menor, Maior, Peso médio, Média (@), Peso total,
// GMD médio, Machos, Fêmeas. As demais ficam no seletor "Colunas".
export const SHEET_DEFAULT_KEYS = Object.freeze(['qtd', 'faixa', 'menor', 'maior', 'peso_medio', 'media_arroba', 'peso_total', 'gmd_medio', 'machos', 'femeas']);

// Analítico (Detalhado): colunas do antigo, na ordem dele (item 4); as 3 opcionais ficam no seletor.
export const ANALITICO_COLUMNS = Object.freeze(['data_pesagem', 'numero_animal', 'sexo', 'raca', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd']);
export const ANALITICO_AVAILABLE_COLUMNS = Object.freeze(['data_pesagem', 'numero_animal', 'sexo', 'raca', 'peso', 'nome_lote', 'nome_apartacao', 'data_anterior', 'peso_anterior', 'dias', 'ganho', 'gmd', 'observacao']);
// Subtotal por grupo e total geral do Analítico: animais (distintos), peso médio, GMD médio (ponderado).
export const ANALITICO_TOTALS = Object.freeze([
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' },
]);
// Botões "Agrupar por" do Analítico (em ordem de clique, até 3 níveis).
export const ANALITICO_GROUP_CHOICES = Object.freeze(['nome_lote', 'nome_apartacao', 'sexo', 'raca']);

// Sintético (Matriz): eixos e célula (Qtd = animais distintos, Peso médio, GMD médio ponderado).
export const MATRIX_AXES = Object.freeze([
  { id: 'lote', label: 'Lote', columnId: 'nome_lote' },
  { id: 'apartacao', label: 'Apartação', columnId: 'nome_apartacao' },
  { id: 'sexo', label: 'Sexo', columnId: 'sexo' },
  { id: 'raca', label: 'Raça', columnId: 'raca' },
  { id: 'mes', label: 'Mês', columnId: 'mes_pesagem' },
]);
export const MATRIX_TOTALS = Object.freeze([
  { id: 'qtd', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'gmd_medio', columnId: 'gmd', op: 'weightedGmd' },
]);

// Vendas (Detalhado): só saídas por venda (condição FIXA do tipo, pelo código — a mesma população de
// "Vendas do período": Saída + motivo Venda), agrupadas por comprador (texto do lançamento; na E5 vira o
// parceiro). Comprador em branco cai no grupo "Não informado", sempre por último (motor de agrupamento).
export const VENDAS_POPULATION = Object.freeze({
  tipo_manejo: { operator: 'in', values: ['Saída'], match: 'code' },
  motivo_saida: { operator: 'in', values: ['Venda'], match: 'code' },
});
export const VENDAS_COLUMNS = Object.freeze(['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba', 'valor_arroba', 'valor_venda_total']);
export const VENDAS_AVAILABLE_COLUMNS = Object.freeze([...VENDAS_COLUMNS, 'destino_venda', 'nome_lote', 'nome_apartacao', 'sexo', 'raca', 'era', 'marca', 'observacao']);
// Cabeçalhos do antigo (grade, folha, CSV, XLSX e seletor "Colunas"). "Qtd @" = @ de PESO VIVO (peso ÷
// divisor de Configurações › Relatórios, 30 como o antigo) — não é a @ de carcaça do Comercial; "Valor @" =
// preço da @ digitado no lançamento; "Valor total" = o valor digitado no lançamento. Sem valor digitado a
// célula fica "—" e fora da soma: o antigo inventava peso ÷ 30 × valor @, e o Lançamento de hoje não grava
// conta nenhuma no valor total. ATENÇÃO (pergunta à responsável, REPORT da E1D): o painel "Resumo de Vendas"
// do Lançamento MOSTRA um "Valor total (R$)" que, sem valor digitado (ou com 0), soma a estimativa pela @ de
// carcaça (peso × rendimento ÷ 15 × Valor @) — nesse caso o relatório e o Resumo do dia dão valores
// diferentes. Um 0 digitado é gravado e aqui conta como R$ 0,00 digitado (o Resumo trata 0 como não
// informado). O "(n de m)" de valor digitado sai na tela e na folha; no CSV/XLSX vai só a soma do digitado.
export const VENDAS_COLUMN_LABELS = Object.freeze({ peso_arroba: 'Qtd @', valor_arroba: 'Valor @', valor_venda_total: 'Valor total' });
// Subtotal por comprador e total geral (item 3): animais, peso total, peso médio, @ e valor total — a @ em
// total e média (o antigo mostrava a "Média (@)"). Animais DISTINTOS (o antigo contava linhas); @ = soma/
// média da @ viva de cada linha; valor = soma só do que foi digitado (o chip diz "n de m" quando falta).
// Ids próprios para animais/valor: o rótulo de curral deles (metricLabels) não muda os outros tipos.
export const VENDAS_TOTALS = Object.freeze([
  { id: 'animais_vendidos', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_total', columnId: 'peso', op: 'sum' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'total_arroba', columnId: 'peso_arroba', op: 'sum' },
  { id: 'media_arroba', columnId: 'peso_arroba', op: 'avg' },
  { id: 'valor_total', columnId: 'valor_venda_total', op: 'sum' },
]);
// Rótulos dos totais que só Vendas usa (Peso total/médio e Total/Média (@) são os da folha). Grade, folha,
// CSV e XLSX leem o mesmo rótulo pelo id (metricLabels da definição).
export const VENDAS_METRIC_LABELS = Object.freeze({ animais_vendidos: 'Animais', valor_total: 'Valor total' });

// "Ordenar por": exatamente as 8 opções do antigo (item 6), com os rótulos dele. A tradução de cada uma
// para a seleção de cada tipo fica em domain/sortChoices.js.
export const PESAGENS_SORT_CHOICES = Object.freeze([
  { id: 'data_desc', label: 'Data (Mais Recente)' },
  { id: 'data_asc', label: 'Data (Mais Antiga)' },
  { id: 'peso_desc', label: 'Peso (Maior)' },
  { id: 'peso_asc', label: 'Peso (Menor)' },
  { id: 'gmd_desc', label: 'GMD (Maior)' },
  { id: 'gmd_asc', label: 'GMD (Menor)' },
  { id: 'animal_asc', label: 'Animal (A-Z)' },
  { id: 'lote_asc', label: 'Lote (A-Z)' },
]);

// Os 5 tipos, nesta ordem (item 1). Ids estáveis: vão para o último estado, os modelos e o manifesto.
export const PESAGENS_VIEW_IDS = Object.freeze(['analitico', 'sintetico-matriz', 'por-apartacao-lote', 'por-apartacao-data', 'vendas']);
export const PESAGENS_DEFAULT_VIEW = 'por-apartacao-data';
const SHEET_CHOICES = { available: [...SHEET_COLUMN_KEYS], defaults: [...SHEET_DEFAULT_KEYS] };
export const PESAGENS_VIEWS = Object.freeze([
  {
    id: 'analitico', label: 'Analítico (Detalhado)', mode: 'DETALHADO', groups: [], titleKind: 'Analítico',
    groupChoices: [...ANALITICO_GROUP_CHOICES], columns: [...ANALITICO_COLUMNS], aggregates: ANALITICO_TOTALS,
    columnChoices: { available: [...ANALITICO_AVAILABLE_COLUMNS], defaults: [...ANALITICO_COLUMNS] },
  },
  {
    id: 'sintetico-matriz', label: 'Sintético (Matriz)', mode: 'RESUMIDO', groups: [], titleKind: 'Sintético',
    layout: 'matrix', matrix: { eixoY: 'sexo', eixoX: 'lote' }, aggregates: MATRIX_TOTALS,
  },
  {
    id: 'por-apartacao-lote', label: 'Por Apartação/Lote', mode: 'RESUMIDO', titleKind: 'Sintético',
    groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], aggregates: SHEET_TOTALS, columnChoices: SHEET_CHOICES,
  },
  {
    id: 'por-apartacao-data', label: 'Por Apartação (Resumo por Data)', mode: 'RESUMIDO', titleKind: 'Sintético',
    groups: [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem', direction: 'desc' }, { columnId: 'nome_lote' }], aggregates: SHEET_TOTALS, columnChoices: SHEET_CHOICES,
  },
  {
    id: 'vendas', label: 'Vendas (Detalhado)', mode: 'DETALHADO', titleKind: 'Sintético',
    groups: [{ columnId: 'comprador' }], population: VENDAS_POPULATION, columns: [...VENDAS_COLUMNS], aggregates: VENDAS_TOTALS,
    columnChoices: { available: [...VENDAS_AVAILABLE_COLUMNS], defaults: [...VENDAS_COLUMNS] }, columnLabels: VENDAS_COLUMN_LABELS,
  },
]);

export const PESAGENS = defineReport({
  id: 'pesagens',
  family: 'pesagens',
  // E1D (visual): tela "como o MAKGESTAO" (components/reports/MakgestaoScreen) — só Pesagens; só a tela.
  screen: 'makgestao',
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
  // E1D "Tipo de relatório": os 5 tipos do MAKGESTAO (não mudam defaultGroups/Aggregates, que continuam
  // servindo aos links e modelos antigos). Abre em "Por Apartação (Resumo por Data)".
  views: PESAGENS_VIEWS,
  defaultView: PESAGENS_DEFAULT_VIEW,
  matrixAxes: MATRIX_AXES,
  sortChoices: PESAGENS_SORT_CHOICES,
  defaultSortChoice: 'data_desc',
  metricLabels: { ...SHEET_METRIC_LABELS, ...VENDAS_METRIC_LABELS },
  // A faixa exigida é do LOTE: só aparece quando o último nível de agrupamento é o lote (e no "TOTAL POR
  // LOTE"); em qualquer outro agrupamento as duas métricas saem da folha e das exportações.
  metricPairs: [{ id: 'faixa', label: 'Faixa exigida (kg)', from: 'faixa_min', to: 'faixa_max', leafOnly: true, leafColumnId: 'nome_lote', unit: 'kg' }],
  classification: DATA_CLASSIFICATION.CANONICAL,
  notes: ['Uma linha por pesagem: um animal pesado 3 vezes aparece 3 vezes; "Cabeças" conta cada animal uma vez.'],
});

export const COMERCIAL_EVENT_CLASSIFICATION = DATA_CLASSIFICATION.LEGACY_EVENT;
