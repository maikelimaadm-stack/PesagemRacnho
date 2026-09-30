// Família PESAGENS (grão EVENT). E1 (1.4.0): "Pesagens" substitui por período, por sessão, por lote,
// por operador, por origem e "Entradas e saídas" (aliases em legacyAliases.js). O alias
// `pesagens.periodo` continua sendo o canário da arquitetura: paridade de população com a Relação de
// Pesagens (gate reports:relation-parity:verify).
import { defineReport, DATA_CLASSIFICATION } from '../domain/reportDefinition.js';
import { GRAINS } from '../domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_SEARCH_COLUMN_IDS } from './columns/eventColumns.js';
import { VENDAS_BLOCK_TOTALS } from '../domain/vendasLayout.js';

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
// Colunas da tabela "Mostrar Detalhes" do antigo (COLUNAS_DETALHES_VENDAS), na ordem dele; as opcionais ficam
// no seletor "Colunas". "Qtd @" = @ de PESO VIVO (peso ÷ divisor de Configurações › Relatórios, 30 como o
// antigo) — não é a @ de carcaça do Comercial; "Valor @" = preço da @ digitado no lançamento; "Valor Total" =
// valor_venda_calc: o valor digitado quando > 0, senão Qtd @ × Valor @ (regra do antigo — conta no PDF da
// responsável: 40.968 kg ÷ 30 × R$ 383 = R$ 523.024,80); sem Valor @ nem valor digitado, "-" e fora da soma.
// ATENÇÃO (pergunta à responsável, REPORT da E1D): a "Estimativa comercial"/"Resumo de Vendas" do Lançamento
// usa a @ de CARCAÇA (peso × rendimento ÷ 15 × Valor @) e pode dar outro valor para a mesma venda sem valor
// digitado.
export const VENDAS_COLUMNS = Object.freeze(['comprador', 'data_pesagem', 'numero_animal', 'peso', 'peso_arroba', 'valor_arroba', 'valor_venda_calc']);
export const VENDAS_AVAILABLE_COLUMNS = Object.freeze([...VENDAS_COLUMNS, 'destino_venda', 'nome_lote', 'nome_apartacao', 'sexo', 'raca', 'era', 'marca', 'observacao']);
// Cabeçalhos do antigo (grade, folha, CSV, XLSX e seletor "Colunas").
export const VENDAS_COLUMN_LABELS = Object.freeze({ peso_arroba: 'Qtd @', valor_arroba: 'Valor @', valor_venda_calc: 'Valor Total' });
// Totais do tipo = os dos blocos do relatório de venda (domain/vendasLayout.js — Métrica/Valor, Totais por
// marca, por comprador, cartão do comprador e TOTAL GERAL leem estes ids): animais DISTINTOS (o antigo contava
// linhas), peso total, peso médio, Média (@) viva, Média valor da arroba (Valor @ ponderado pela Qtd @) e
// Valor total (soma de valor_venda_calc). Na grade/CSV/JSON são os subtotais por comprador e o total geral.
export const VENDAS_TOTALS = VENDAS_BLOCK_TOTALS;
// Rótulos de curral dos totais que só Vendas usa (Peso total/médio e Média (@) são os da folha). Grade, CSV e
// XLSX leem o mesmo rótulo pelo id (metricLabels da definição).
export const VENDAS_METRIC_LABELS = Object.freeze({ animais_vendidos: 'Animais vendidos', media_valor_arroba: 'Média valor da arroba', valor_total: 'Valor total' });

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

// ---------------------------------------------------------------------------------------------------
// E1D visual — a FOLHA dos 5 tipos (tela, impressão e PDF) "igual ao MAKGESTAO no visual, com as contas
// certas" (decisão da responsável). Só a folha: metricLabels/columnLabels continuam na grade e nas
// exportações (CSV, XLSX e JSON não mudam). Quem desenha é domain/reportDocument (estilo "makgestao").
// ---------------------------------------------------------------------------------------------------

// Cabeçalhos do antigo (Title Case, sem unidade entre parênteses — o "kg" vai em cada número).
export const PESAGENS_SHEET_HEADERS = Object.freeze({
  // Tabelas por lote (COLUNAS_PAINEL_APARTACAO do antigo), por id de total; "faixa" = o par Faixa exigida.
  metrics: Object.freeze({
    qtd: 'Qtd', faixa: 'Faixa Exigida', menor: 'Menor', maior: 'Maior', peso_medio: 'Peso Médio', media_arroba: 'Média (@)',
    peso_total: 'Peso Total', total_arroba: 'Total (@)', ganho_medio: 'Ganho Médio', ganho_medio_arroba: 'Ganho Médio (@)',
    ganho_total: 'Ganho Total', ganho_total_arroba: 'Ganho Total (@)', dias_medios: 'Dias Médios', gmd_medio: 'GMD Médio',
    machos: 'Machos', femeas: 'Fêmeas',
  }),
  // Colunas de dados do Analítico do antigo (também no detalhe de um grupo).
  columns: Object.freeze({
    data_pesagem: 'Data', numero_animal: 'Animal', sexo: 'Sexo', raca: 'Raça', peso: 'Peso', nome_lote: 'Lote',
    nome_apartacao: 'Apartação', data_anterior: 'Dt.Ant.', peso_anterior: 'Peso Ant.', dias: 'Dias', ganho: 'Ganho',
    gmd: 'GMD', observacao: 'Obs', era: 'Era', marca: 'Marca', tipo_manejo: 'Tipo', motivo_saida: 'Motivo',
  }),
  // Vendas (COLUNAS_DETALHES_VENDAS do antigo): "Peso (kg)" com a unidade no cabeçalho, como lá.
  vendas: Object.freeze({
    comprador: 'Comprador', data_pesagem: 'Data', numero_animal: 'Animal', peso: 'Peso (kg)', peso_arroba: 'Qtd @',
    valor_arroba: 'Valor @', valor_venda_total: 'Valor Total', destino_venda: 'Destino', nome_lote: 'Lote',
    nome_apartacao: 'Apartação', sexo: 'Sexo', raca: 'Raça', era: 'Era', marca: 'Marca', observacao: 'Obs',
  }),
  // Sintético (Matriz): "Valores: Qtd / Peso Médio / GMD Médio".
  matrix: Object.freeze({ qtd: 'Qtd', peso_medio: 'Peso Médio', gmd_medio: 'GMD Médio' }),
});

// Linhas de total EM TEXTO do antigo ("Subtotal 02/06/2026: 103 animais   Peso Médio: 258,7 kg …"), itens na
// ordem dele. Cada número é um agregado do motor (spec = o total da folha): a folha lê o do view model quando
// o tipo já o calcula (mesmo número da grade e do XLSX) e, se a pessoa tirou a coluna em "Colunas", o motor
// calcula sobre a MESMA população do grupo (nunca coluna que o perfil não vê — Valor total da CONSULTA).
// unit: 'animais' | 'kg' | 'kg/dia' | '@' | null; lotes = quantos lotes a seção tem (Lotes: N).
const specById = (list, id) => list.find((spec) => spec.id === id);
const lineItem = (label, spec, unit) => Object.freeze({ key: spec.id, label, spec: Object.freeze({ ...spec }), unit });
const ANIMAIS = lineItem(null, specById(SHEET_TOTALS, 'qtd'), 'animais');
const PESO_MEDIO = lineItem('Peso Médio', specById(SHEET_TOTALS, 'peso_medio'), 'kg');
const PESO_TOTAL = lineItem('Peso Total', specById(SHEET_TOTALS, 'peso_total'), 'kg');
const GMD_MEDIO = lineItem('GMD Médio', specById(SHEET_TOTALS, 'gmd_medio'), 'kg/dia');
const LOTES = Object.freeze({ key: 'lotes', label: 'Lotes', lotes: true });
export const PESAGENS_SHEET_LINES = Object.freeze({
  'por-apartacao-data': Object.freeze([ANIMAIS, PESO_MEDIO, PESO_TOTAL, GMD_MEDIO, LOTES]),
  'por-apartacao-lote': Object.freeze([ANIMAIS, PESO_MEDIO, lineItem('Média (@)', specById(SHEET_TOTALS, 'media_arroba'), '@'), PESO_TOTAL, lineItem('Total (@)', specById(SHEET_TOTALS, 'total_arroba'), '@'), LOTES]),
  // Analítico (e detalhe de um grupo): subtotal e TOTAL GERAL (o antigo somava também o ganho no TOTAL GERAL).
  analitico: Object.freeze({
    subtotal: Object.freeze([ANIMAIS, PESO_MEDIO, GMD_MEDIO]),
    total: Object.freeze([ANIMAIS, PESO_MEDIO, GMD_MEDIO, lineItem('Ganho Total', specById(SHEET_TOTALS, 'ganho_total'), 'kg')]),
  }),
  // Vendas: por comprador (acima da tabela) e TOTAL GERAL; a Média (@) sem unidade, como no antigo.
  vendas: Object.freeze({
    subtotal: Object.freeze([lineItem(null, specById(VENDAS_TOTALS, 'animais_vendidos'), 'animais'), PESO_MEDIO, PESO_TOTAL, lineItem('Média (@)', specById(VENDAS_TOTALS, 'media_arroba'), null), lineItem('Valor Total', specById(VENDAS_TOTALS, 'valor_total'), null)]),
    total: Object.freeze([lineItem(null, specById(VENDAS_TOTALS, 'animais_vendidos'), 'animais'), PESO_TOTAL, PESO_MEDIO, lineItem('Média (@)', specById(VENDAS_TOTALS, 'media_arroba'), null), lineItem('Valor Total', specById(VENDAS_TOTALS, 'valor_total'), null)]),
  }),
});
// ---------------------------------------------------------------------------------------------------
// E1G — gráficos de Pesagens (domain/reportCharts; vista "Gráficos" da tela, impressão/PDF e aba do Excel).
// Os números são os da folha: os MESMOS specs de SHEET_TOTALS (Qtd, Peso médio, GMD médio ponderado, Ganho
// total em kg e em @) sobre as MESMAS linhas — Lote × Mês = as células do Sintético (Matriz).
// ---------------------------------------------------------------------------------------------------
const CHART_CAB = specById(SHEET_TOTALS, 'qtd');
// Cobertura do GMD: animais com ao menos uma pesagem com anterior válida (a base da nota "GMD de N de M cab.").
const CHART_COM_GMD = Object.freeze({ id: 'com_gmd', columnId: 'animais_com_anterior', op: 'countDistinct' });
const CHART_SERIES = Object.freeze([
  { id: 'todos', label: 'Todos', columnId: null },
  { id: 'lote', label: 'Lote', columnId: 'nome_lote' },
  { id: 'apartacao', label: 'Apartação', columnId: 'nome_apartacao' },
  { id: 'sexo', label: 'Sexo', columnId: 'sexo' },
  { id: 'raca', label: 'Raça', columnId: 'raca' },
  { id: 'marca', label: 'Marca', columnId: 'marca' },
]);
// Categoria fica fora da evolução do peso: a categoria dela É faixa de peso (automática por sexo + peso).
const CHART_GROUPS = Object.freeze([
  { id: 'lote', label: 'Lote', columnId: 'nome_lote' },
  { id: 'apartacao', label: 'Apartação', columnId: 'nome_apartacao' },
  { id: 'sexo', label: 'Sexo', columnId: 'sexo' },
  { id: 'raca', label: 'Raça', columnId: 'raca' },
  { id: 'categoria', label: 'Categoria', columnId: 'categoria' },
  { id: 'marca', label: 'Marca', columnId: 'marca' },
]);
const CHART_TIME_AXES = Object.freeze([
  { id: 'mes', label: 'Mês', columnId: 'mes_pesagem', tempo: 'mes' },
  { id: 'data', label: 'Data', columnId: 'data_pesagem', tempo: 'data' },
  { id: 'sessao', label: 'Sessão', columnId: 'sessao', tempo: 'sessao' },
]);
export const CHART_BAND_WIDTHS = Object.freeze([
  { id: 'auto', label: 'Automática', largura: 'auto' },
  ...[10, 15, 20, 25, 30, 50].map((largura) => ({ id: String(largura), label: `${largura} kg`, largura })),
]);
const GMD_PESAGENS = 'GMD das pesagens contra a pesagem anterior (soma dos ganhos ÷ soma dos dias)';
export const PESAGENS_CHARTS = Object.freeze([
  {
    id: 'evolucao-peso', kind: 'linha', title: 'Evolução do peso médio', cab: CHART_CAB,
    controls: {
      serie: { label: 'Série', default: 'lote', choices: CHART_SERIES },
      eixo: { label: 'Eixo', default: 'mes', choices: CHART_TIME_AXES },
      metrica: {
        label: 'Mostrar', default: 'peso', choices: [
          { id: 'peso', label: 'Peso médio', valor: specById(SHEET_TOTALS, 'peso_medio'), unidade: 'kg', titulo: 'Evolução do peso médio', nota: 'Peso médio das pesagens de cada ponto: ele cai quando animais pesados saem do lote (veja as cabeças de cada ponto). O GMD médio mostra o ganho sem esse efeito.' },
          { id: 'gmd', label: 'GMD médio', valor: specById(SHEET_TOTALS, 'gmd_medio'), cobertura: CHART_COM_GMD, unidade: 'kg/dia', yZero: true, titulo: 'Evolução do GMD médio', nota: `${GMD_PESAGENS}.` },
        ],
      },
    },
  },
  {
    id: 'gmd-por-grupo', kind: 'barras', title: 'GMD médio por grupo', subtitle: GMD_PESAGENS, unidade: 'kg/dia',
    controls: { serie: { label: 'Agrupar por', default: 'lote', choices: CHART_GROUPS } },
    valor: specById(SHEET_TOTALS, 'gmd_medio'), cab: CHART_CAB, cobertura: CHART_COM_GMD, semValor: 'Sem GMD',
    notas: ['Sem GMD = nenhuma pesagem do grupo tem uma pesagem anterior com peso para comparar.'],
  },
  {
    id: 'ganho-por-mes', kind: 'colunas', title: 'Ganho de peso por mês', cab: CHART_CAB, maxSeries: 3,
    controls: {
      eixo: { label: 'Eixo', default: 'mes', choices: [CHART_TIME_AXES[0]] },
      metrica: {
        label: 'Medida', default: 'kg', choices: [
          { id: 'kg', label: 'kg', valor: specById(SHEET_TOTALS, 'ganho_total'), cobertura: CHART_COM_GMD, unidade: 'kg', titulo: 'Ganho de peso por mês' },
          { id: 'arroba', label: '@', valor: specById(SHEET_TOTALS, 'ganho_total_arroba'), cobertura: CHART_COM_GMD, unidade: '@', titulo: '@ produzidas por mês', nota: '@ = peso vivo ÷ {divisor} (Configurações › Relatórios).' },
        ],
      },
      serie: { label: 'Série', default: 'todos', choices: [CHART_SERIES[0], CHART_SERIES[1]] },
    },
    notas: ['O ganho de cada pesagem conta no mês em que o animal foi pesado; ele cobre o intervalo desde a pesagem anterior.'],
  },
  {
    id: 'distribuicao-peso', kind: 'histograma', title: 'Distribuição do peso', subtitle: 'Última pesagem com peso de cada animal no período',
    valorAnimal: 'peso', porAnimal: 'ultima', unidade: 'kg', semValor: 'Sem peso no período',
    controls: { faixa: { label: 'Faixa', default: 'auto', choices: CHART_BAND_WIDTHS } },
  },
]);

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
    id: 'vendas', label: 'Vendas (Detalhado)', mode: 'DETALHADO', titleKind: 'Sintético', sheetLayout: 'vendas',
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
  // E1G: vista "Gráficos".
  charts: PESAGENS_CHARTS,
  classification: DATA_CLASSIFICATION.CANONICAL,
  notes: ['Uma linha por pesagem: um animal pesado 3 vezes aparece 3 vezes; "Cabeças" conta cada animal uma vez.'],
});

export const COMERCIAL_EVENT_CLASSIFICATION = DATA_CLASSIFICATION.LEGACY_EVENT;
