// Tipos de relatório da E1B/E1C que saíram na E1D (docs/plano-mestre/E1D-RELATORIO-PESAGENS-INDIVIDUAIS.md,
// item 1). Modelo salvo ou último estado de antes da E1D (sem `view`) que usava um deles abre no tipo NOVO
// mais próximo — convertido em memória ao abrir (templateToRequest) e gravado uma vez, com auditoria
// "relatorios-tipos-e1d" (reportTemplateService.migrateReportPreferences).
//
// Cada tipo antigo é a seleção que a E1B aplicava, reconhecida como o seletor da E1B reconhecia
// (reportViews.matchView da 1.4.0 de então): mesmo agrupamento (coluna e direção), mesmo modo, mesmos totais
// e, no Detalhado, as mesmas colunas. O que não bate com nenhum já era "Personalizado" na E1B e continua
// Personalizado — nenhuma escolha da pessoa (totais, colunas, ordem) é jogada fora sem ela ter usado o tipo.
//
// Mapa (tipo antigo → tipo novo mais próximo):
//   "Resumo por Sessão" (o padrão gerado: Sessão, Resumido)  → "Por Apartação (Resumo por Data)"
//   "Por apartação (resumo por data)" (Apartação › Data › Lote) → "Por Apartação (Resumo por Data)"
//   "Por lote" (Lote, Resumido)                                → "Por Apartação/Lote"
//   "Por data" (Data mais recente, Resumido)                   → "Por Apartação (Resumo por Data)"
//   "Analítico por animal" (Detalhado)                         → "Analítico (Detalhado)"
// A pessoa mantém filtros, período, pesquisa, orientação e larguras; agrupamento, modo, colunas/totais e
// ordem passam a ser os do tipo novo (os padrão dele).
import { REPORT_MODES } from '../domain/reportDefinition.js';
import { aggregateSpecId } from '../domain/reportAggregates.js';
import { getReportView, viewSelection } from '../domain/reportViews.js';

const { RESUMIDO, DETALHADO } = REPORT_MODES;
const deepFreeze = (value) => {
  if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

// Seleções da E1B CONGELADAS: cópia literal de definitions/pesagens.js no commit 2d51951 (1.4.0 da E1C).
// Não importar as constantes vivas (SHEET_TOTALS, EVENT_TOTALS…): elas são dos tipos novos e podem mudar;
// se mudassem, o modelo gravado na E1B/E1C deixaria de ser reconhecido e abriria "Personalizado" sem
// conversão nem auditoria. O que está gravado no banco é isto aqui, e isto não muda mais.
const E1B_EVENT_TOTALS = [
  { id: 'registros', op: 'count' },
  { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso', op: 'avg' },
  { id: 'peso_min', columnId: 'peso', op: 'min' },
  { id: 'peso_max', columnId: 'peso', op: 'max' },
  { id: 'gmd_ponderado', columnId: 'gmd', op: 'weightedGmd' },
];
const E1B_SHEET_TOTALS = [
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
];
// "Por data" da E1B: as mesmas, sem a faixa exigida (que é do lote).
const E1B_SHEET_TOTALS_SEM_FAIXA = E1B_SHEET_TOTALS.filter((spec) => spec.id !== 'faixa_min' && spec.id !== 'faixa_max');
const E1B_ANALYTIC_COLUMNS = ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'raca', 'era', 'nome_lote', 'nome_apartacao', 'peso', 'peso_arroba', 'peso_anterior', 'dias', 'ganho', 'gmd'];

// Colunas com que a tela da E1B abria quando o modelo não gravava colunas (defaultColumns de então).
export const LEGACY_DEFAULT_COLUMNS = deepFreeze({
  pesagens: ['data_pesagem', 'tipo_manejo', 'numero_animal', 'marca', 'sexo', 'raca', 'categoria', 'peso', 'nome_lote', 'nome_apartacao', 'dias', 'ganho', 'gmd'],
});

// Os tipos da E1B como estavam declarados (e o padrão que listReportViews gerava; sem totais próprios, a
// E1B usava os defaultAggregates = EVENT_TOTALS de então).
export const LEGACY_REPORT_VIEWS = deepFreeze({
  pesagens: [
    { id: 'padrao', label: 'Resumo por Sessão', groups: [{ columnId: 'sessao' }], mode: RESUMIDO, aggregates: E1B_EVENT_TOTALS, to: 'por-apartacao-data' },
    { id: 'por-apartacao-data', label: 'Por apartação (resumo por data)', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'data_pesagem', direction: 'desc' }, { columnId: 'nome_lote' }], mode: RESUMIDO, aggregates: E1B_SHEET_TOTALS, to: 'por-apartacao-data' },
    { id: 'por-lote', label: 'Por lote', groups: [{ columnId: 'nome_lote' }], mode: RESUMIDO, aggregates: E1B_SHEET_TOTALS, to: 'por-apartacao-lote' },
    { id: 'por-data', label: 'Por data', groups: [{ columnId: 'data_pesagem', direction: 'desc' }], mode: RESUMIDO, aggregates: E1B_SHEET_TOTALS_SEM_FAIXA, to: 'por-apartacao-data' },
    { id: 'analitico', label: 'Analítico por animal', groups: [], mode: DETALHADO, aggregates: E1B_EVENT_TOTALS, columns: E1B_ANALYTIC_COLUMNS, to: 'analitico' },
  ],
});

const directionOf = (group) => (group?.direction === 'desc' ? 'desc' : 'asc');
const sameGroups = (left, right) => left.length === right.length
  && left.every((group, index) => group.columnId === right[index].columnId && directionOf(group) === directionOf(right[index]));
const aggregatesKey = (list) => JSON.stringify((list ?? []).map((spec) => `${aggregateSpecId(spec)}|${spec.op}|${spec.columnId ?? ''}`).sort());

/**
 * Tipo antigo (E1B/E1C) que a configuração usava, pela estrutura — ou null.
 * @param definition ReportDefinition atual (o relatório do modelo/estado)
 * @param config modelo salvo ou último estado (formato de normalizeTemplateConfig)
 */
export function matchLegacyView(definition, config = {}) {
  const legacy = LEGACY_REPORT_VIEWS[definition?.id];
  if (!legacy) return null;
  const groups = (Array.isArray(config.groups) ? config.groups : []).filter((group) => group?.columnId);
  // Sem modo gravado (modelo anterior à 1.4.0): Resumido só com agrupamento (como templateToRequest abre).
  const mode = config.mode === RESUMIDO || config.mode === DETALHADO ? config.mode : (groups.length ? RESUMIDO : DETALHADO);
  // Sem colunas gravadas a tela da E1B abria com as padrão da definição DE ENTÃO (congeladas).
  const columns = Array.isArray(config.columns) && config.columns.length ? config.columns : LEGACY_DEFAULT_COLUMNS[definition.id] ?? [];
  return legacy.find((view) => {
    if (view.mode !== mode || !sameGroups(view.groups, groups)) return false;
    if (Array.isArray(config.aggregates) && aggregatesKey(config.aggregates) !== aggregatesKey(view.aggregates)) return false;
    if (mode === DETALHADO && view.columns && columns.join('|') !== view.columns.join('|')) return false;
    return true;
  }) ?? null;
}

/**
 * Converte um modelo/último estado de antes da E1D para o tipo novo mais próximo.
 * Não converte (null): relatório sem tipos fixos (defaultView), configuração que já tem `view` (inclusive
 * null = Personalizado escolhido depois da E1D), modelo de relatório antigo da E1 (`migratedFrom`: abre a
 * seleção do relatório antigo, como os links e favoritos das visões antigas) e estrutura que não era um tipo.
 * @returns {null | { from: object, to: object, config: object }} config = cópia com view, grupos, modo,
 *   colunas/totais, ordem e eixos do tipo novo; o resto (filtros, período, orientação…) como estava.
 */
export function convertLegacyViewConfig(definition, config) {
  if (!definition?.defaultView || !config || typeof config !== 'object') return null;
  if (config.view !== undefined || config.migratedFrom) return null;
  const from = matchLegacyView(definition, config);
  const to = from ? getReportView(definition, from.to) : null;
  if (!to) return null;
  const selection = viewSelection(to, definition);
  return {
    from,
    to,
    config: {
      ...config,
      view: to.id,
      groups: selection.groups,
      mode: selection.mode,
      aggregates: selection.aggregates,
      columns: selection.columns,
      sort: selection.sort,
      summarySort: null,
      matrix: selection.matrix,
      sortChoice: definition.defaultSortChoice ?? null,
    },
  };
}
