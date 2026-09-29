// "Ordenar por" fixo do relatório (E1D: as 8 opções do MAKGESTAO em Pesagens — definition.sortChoices).
// Uma opção vira a seleção equivalente do TIPO atual (contrato em docs/evidence/e1d/CONTRATOS-AGENTES.md §5):
//   Detalhado (Analítico, Vendas) → ordem das linhas (dentro de cada grupo; grupos na ordem natural);
//   Resumido                      → ordem das linhas dentro de cada seção pela métrica equivalente
//                                   (e a direção do nível de data, quando o tipo tem um);
//   Matriz                        → peso/GMD ordenam as linhas (eixo Y) pelo total da linha; data inverte o Mês;
//   Personalizado (sem tipo)      → linhas pela opção; no Resumido a métrica equivalente se estiver nos totais.
// Nenhuma conta nova: só sort / summarySort / direção de grupo, que o motor da E1 já aplica (ausentes sempre
// por último, desempate estável — sortEngine; "2" antes de "10" — collator numérico).
import { REPORT_MODES, VIEW_LAYOUTS } from './reportDefinition.js';
import { aggregateSpecId } from './reportAggregates.js';

// O que cada opção ordena e em que direção (ids de PESAGENS_SORT_CHOICES, com os rótulos do antigo).
export const SORT_CHOICE_RULES = Object.freeze({
  data_desc: Object.freeze({ kind: 'data', direction: 'desc' }),
  data_asc: Object.freeze({ kind: 'data', direction: 'asc' }),
  peso_desc: Object.freeze({ kind: 'peso', direction: 'desc' }),
  peso_asc: Object.freeze({ kind: 'peso', direction: 'asc' }),
  gmd_desc: Object.freeze({ kind: 'gmd', direction: 'desc' }),
  gmd_asc: Object.freeze({ kind: 'gmd', direction: 'asc' }),
  animal_asc: Object.freeze({ kind: 'animal', direction: 'asc' }),
  lote_asc: Object.freeze({ kind: 'lote', direction: 'asc' }),
});

// Ordem das linhas (grão de pesagem). Desempates fixos para a folha não mudar de uma emissão para outra:
// data → animal A-Z; peso/GMD → data mais recente, animal; animal → data mais recente; lote → data mais
// recente, animal. GMD ausente (sem pesagem anterior) fica por último, nunca como 0.
const DATE_DESC = Object.freeze({ columnId: 'data_pesagem', direction: 'desc' });
const ANIMAL_ASC = Object.freeze({ columnId: 'numero_animal', direction: 'asc' });
const ROW_SORTS = Object.freeze({
  data: (direction) => [{ columnId: 'data_pesagem', direction }, ANIMAL_ASC],
  peso: (direction) => [{ columnId: 'peso', direction }, DATE_DESC, ANIMAL_ASC],
  gmd: (direction) => [{ columnId: 'gmd', direction }, DATE_DESC, ANIMAL_ASC],
  animal: (direction) => [{ columnId: 'numero_animal', direction }, DATE_DESC],
  lote: (direction) => [{ columnId: 'nome_lote', direction }, DATE_DESC, ANIMAL_ASC],
});

// Métrica equivalente no Resumido: a MESMA agregação do motor (peso médio simples; GMD ponderado), achada
// pela operação e coluna — o id muda de um tipo para outro (peso_medio, gmd_medio, gmd_ponderado…).
const METRIC_SPECS = Object.freeze({
  peso: Object.freeze({ op: 'avg', columnId: 'peso' }),
  gmd: Object.freeze({ op: 'weightedGmd', columnId: 'gmd' }),
});

// Níveis de data (a opção "Data" vira a direção deles): a data da pesagem e o Mês da matriz.
const DATE_LEVEL_COLUMNS = new Set(['data_pesagem', 'mes_pesagem']);

/** Opção válida para a definição? (null/ausente = sem opção fixa) */
export function isKnownSortChoice(definition, choiceId) {
  return (definition?.sortChoices ?? []).some((choice) => choice.id === choiceId);
}

const ruleOf = (definition, choiceId) => (isKnownSortChoice(definition, choiceId) ? SORT_CHOICE_RULES[choiceId] ?? null : null);

/** Id da métrica equivalente (peso/gmd) na lista de totais, ou null se ela não está nos totais. */
function metricIdIn(aggregates, kind) {
  const wanted = METRIC_SPECS[kind];
  if (!wanted) return null;
  const spec = (aggregates ?? []).find((item) => item?.op === wanted.op && item.columnId === wanted.columnId);
  return spec ? aggregateSpecId(spec) : null;
}

/** Ordem das linhas da opção, só com colunas que o relatório tem e que ordenam. */
function rowSortOf(definition, rule) {
  const columns = new Map((definition?.columns ?? []).map((column) => [column.id, column]));
  return ROW_SORTS[rule.kind](rule.direction).filter((item) => columns.has(item.columnId) && columns.get(item.columnId).sortable !== false).map((item) => ({ ...item }));
}

/**
 * "Personalizado" dentro de um tipo resumido (clique no cabeçalho de uma métrica sem opção equivalente: Qtd,
 * Peso total, Média (@)…): a métrica vale só no nível folha (na matriz, nas linhas do eixo Y), como as opções —
 * senão as seções de data/apartação sairiam da ordem do tipo. O nível não fica gravado no modelo nem no último
 * estado (normalizeTemplateConfig guarda só key/direction): é aqui que ele volta. Sem tipo, como na E1.
 */
function scopedToType(definition, view, summarySort, groups) {
  if (!summarySort?.key || summarySort.columnId || !view || view.mode === REPORT_MODES.DETALHADO || !definition?.sortChoices?.length) return summarySort;
  const columnId = (view.layout === VIEW_LAYOUTS.MATRIX ? groups[0] : groups.at(-1))?.columnId;
  return columnId ? { ...summarySort, columnId } : summarySort;
}

/**
 * Seleção equivalente à opção no tipo. Sem opção (ou relatório sem sortChoices) devolve a seleção como veio —
 * exceto a métrica de um tipo resumido, que fica no nível folha (scopedToType).
 * A ordem dos resumidos vale só no nível folha (summarySort.columnId — "as linhas dentro de cada seção"; na
 * matriz, as linhas do eixo Y): as seções (apartação, data) ficam na ordem natural do tipo.
 * @param definition ReportDefinition
 * @param view tipo atual (objeto de listReportViews) ou null
 * @param {{ sort?: object[], summarySort?: object|null, groups?: object[], aggregates?: object[] }} selection
 *   aggregates = totais efetivos (os da seleção ou os padrão do tipo) — onde se procura a métrica equivalente
 * @param {string|null} choiceId id de definition.sortChoices
 * @returns {{ sort: object[], summarySort: object|null, groups: object[] }}
 */
export function applySortChoice(definition, view, selection, choiceId) {
  const base = { sort: selection.sort ?? [], summarySort: selection.summarySort ?? null, groups: selection.groups ?? [] };
  const rule = choiceId ? ruleOf(definition, choiceId) : null;
  if (!rule) return { ...base, summarySort: scopedToType(definition, view, base.summarySort, base.groups) };
  const sort = rowSortOf(definition, rule);
  const groups = base.groups.map((group) => ({ ...group }));
  const declared = new Map((view?.groups ?? []).map((group) => [group.columnId, group.direction === 'desc' ? 'desc' : 'asc']));
  const natural = (group) => declared.get(group.columnId) ?? 'asc';
  const dateDirection = (group, fallback) => (rule.kind === 'data' && DATE_LEVEL_COLUMNS.has(group.columnId) ? rule.direction : fallback);
  const metricId = metricIdIn(selection.aggregates, rule.kind);
  const scoped = (columnId) => (metricId && columnId ? { key: metricId, direction: rule.direction, columnId } : null);

  // Detalhado com tipo (Analítico, Vendas): só a ordem das linhas; os grupos na ordem natural (A-Z).
  if (view && view.mode === REPORT_MODES.DETALHADO) {
    return { sort, summarySort: null, groups: groups.map((group) => ({ ...group, direction: natural(group) })) };
  }
  // Matriz: peso/GMD ordenam as linhas (eixo Y = 1º nível) pelo total da linha; data inverte o eixo Mês.
  if (view?.layout === VIEW_LAYOUTS.MATRIX) {
    return {
      sort,
      summarySort: scoped(groups[0]?.columnId ?? null),
      groups: groups.map((group) => ({ ...group, direction: dateDirection(group, 'asc') })),
    };
  }
  const leaf = groups.at(-1)?.columnId ?? null;
  // Resumido com tipo: seções na ordem do tipo (a data na direção pedida); linhas do nível folha pela métrica.
  if (view) {
    return { sort, summarySort: scoped(leaf), groups: groups.map((group) => ({ ...group, direction: dateDirection(group, natural(group)) })) };
  }
  // Personalizado: linhas pela opção (Detalhado); no Resumido, a métrica equivalente se estiver nos totais
  // (senão ordem natural) e a opção "Data" na direção dos níveis de data. Os demais níveis ficam como vieram.
  return { sort, summarySort: scoped(leaf), groups: groups.map((group) => (rule.kind === 'data' && DATE_LEVEL_COLUMNS.has(group.columnId) ? { ...group, direction: rule.direction } : group)) };
}

/**
 * "Ordenar por" de um modelo/último estado/visão antiga SEM sortChoice (de antes da E1D). Com ordem própria
 * (linhas numa ordem que não é a padrão do relatório, ou métrica/rótulo no Resumido) → null: abre em
 * "Personalizado" com a ordem dele. Sem ela, a opção que mostra os níveis como o estado mostrava: a padrão ou,
 * quando a data está na outra direção (o "Data (mais antiga)" da E1B gravava só a direção do nível), a Data
 * nessa direção; se nenhuma reproduz, null. Assim nada abre invertido sem aviso.
 * @param view tipo que bate com o estado (objeto de listReportViews) ou null
 * @param {{ sort?: object[], summarySort?: object|null, groups?: object[], aggregates?: object[] }} state
 * @returns {string|null}
 */
export function legacySortChoice(definition, view, state = {}) {
  const fallback = definition?.defaultSortChoice ?? null;
  if (!fallback) return null;
  const ownSort = Array.isArray(state.sort) && state.sort.length > 0 && JSON.stringify(state.sort) !== JSON.stringify(definition.defaultSort);
  if (ownSort || state.summarySort?.key) return null;
  const groups = (state.groups ?? definition.defaultGroups ?? []).filter((group) => group?.columnId);
  const directions = (list) => list.map((group) => `${group.columnId}:${group.direction === 'desc' ? 'desc' : 'asc'}`).join('|');
  const shown = directions(groups);
  const dateChoices = (definition.sortChoices ?? []).map((choice) => choice.id).filter((id) => SORT_CHOICE_RULES[id]?.kind === 'data');
  const shows = (choiceId) => directions(applySortChoice(definition, view, { sort: state.sort, summarySort: null, groups, aggregates: state.aggregates }, choiceId).groups) === shown;
  return [fallback, ...dateChoices].find(shows) ?? null;
}

/**
 * Clique no cabeçalho da GRADE (Detalhado) num relatório com opções fixas: a opção cuja coluna principal e
 * direção são essas (ex.: Peso crescente → "Peso (Menor)"), ou null (a tela passa a "Personalizado").
 */
export function sortChoiceForColumn(definition, columnId, direction) {
  const wanted = direction === 'desc' ? 'desc' : 'asc';
  const choice = (definition?.sortChoices ?? []).find((item) => {
    const rule = SORT_CHOICE_RULES[item.id];
    return rule && rule.direction === wanted && ROW_SORTS[rule.kind](wanted)[0].columnId === columnId;
  });
  return choice?.id ?? null;
}

/**
 * Clique no cabeçalho de uma métrica da FOLHA (Resumido): a opção equivalente quando a métrica é o peso médio
 * ou o GMD (ex.: "GMD médio" maior primeiro → "GMD (Maior)"), ou null (a tela passa a "Personalizado").
 */
export function sortChoiceForMetric(definition, aggregates, key, direction) {
  const spec = (aggregates ?? []).find((item) => aggregateSpecId(item) === key);
  if (!spec) return null;
  const kind = Object.keys(METRIC_SPECS).find((item) => METRIC_SPECS[item].op === spec.op && METRIC_SPECS[item].columnId === spec.columnId);
  if (!kind) return null;
  const wanted = direction === 'desc' ? 'desc' : 'asc';
  return (definition?.sortChoices ?? []).find((item) => SORT_CHOICE_RULES[item.id]?.kind === kind && SORT_CHOICE_RULES[item.id].direction === wanted)?.id ?? null;
}

/** Opção de "Ordenar por" que a métrica/coluna tem hoje (para o clique alternar a direção). */
export function sortChoiceRule(definition, choiceId) {
  return ruleOf(definition, choiceId);
}
