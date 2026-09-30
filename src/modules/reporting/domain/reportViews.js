// "Tipo de relatório" (E1B §3): visões nomeadas de um relatório. Uma visão é só um ATALHO para a
// seleção da E1 (agrupamentos, modo, totais, colunas, ordenação) — nenhuma conta nova, nenhum segundo
// caminho de filtro. As visões declaradas na definição (`views`, validadas em defineReport) valem; sem
// nenhuma, o relatório ganha "Resumo por <agrupamento padrão>" (se tiver) e "Analítico".
// Visões NÃO são aliases antigos (LEGACY_REPORT_ALIASES) e não viram presetId no manifesto.
import { REPORT_MODES, VIEW_LAYOUTS, metricKeysOf } from './reportDefinition.js';
import { aggregateSpecId } from './reportAggregates.js';
import { isFilterActive } from './filterEngine.js';

export const DEFAULT_VIEW_ID = 'padrao';
export const ANALYTIC_VIEW_ID = 'analitico';
export const ANALYTIC_VIEW_LABEL = 'Analítico (uma linha por registro)';

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const directionOf = (group) => (group?.direction === 'desc' ? 'desc' : 'asc');

function columnLabel(definition, columnId) {
  return definition.columns?.find((column) => column.id === columnId)?.label ?? columnId;
}

/**
 * Visões do relatório, na ordem em que aparecem no seletor.
 * @param definition ReportDefinition (defineReport)
 * @returns {{ id, label, groups, mode, aggregates?, columns?, sort?, summarySort?, filters?, generated? }[]}
 */
const sameGroups = (left, right) => left.length === right.length
  && left.every((group, index) => group.columnId === right[index].columnId && directionOf(group) === directionOf(right[index]));

/** Visão "como o relatório abre" (agrupamento e modo padrão da definição), ou null sem agrupamento. */
function defaultView(definition) {
  const groups = (definition.defaultGroups ?? []).filter((group) => group?.columnId);
  if (!groups.length) return null;
  const mode = definition.defaultMode ?? REPORT_MODES.RESUMIDO;
  const labels = groups.map((group) => columnLabel(definition, group.columnId)).join(' › ');
  return {
    id: DEFAULT_VIEW_ID,
    label: mode === REPORT_MODES.RESUMIDO ? `Resumo por ${labels}` : `Lista por ${labels}`,
    groups: clone(groups),
    mode,
    generated: true,
  };
}

export function listReportViews(definition) {
  if (!definition) return [];
  // E1D: relatório com tipo padrão declarado (Pesagens) mostra exatamente os tipos declarados, na ordem.
  if (definition.defaultView && definition.views?.length) return definition.views.map((view) => ({ ...view }));
  const standard = defaultView(definition);
  if (definition.views?.length) {
    const declared = definition.views.map((view) => ({ ...view }));
    // O jeito como o relatório abre também é um tipo (senão a tela abriria em "Personalizado").
    const covered = !standard || declared.some((view) => view.mode === standard.mode && sameGroups(view.groups ?? [], standard.groups));
    return covered || declared.some((view) => view.id === DEFAULT_VIEW_ID) ? declared : [standard, ...declared];
  }
  const views = standard ? [standard] : [];
  views.push({ id: ANALYTIC_VIEW_ID, label: ANALYTIC_VIEW_LABEL, groups: [], mode: REPORT_MODES.DETALHADO, generated: true });
  return views;
}

export function getReportView(definition, viewId) {
  return listReportViews(definition).find((view) => view.id === viewId) ?? null;
}

/**
 * Seleção pronta para runReport (request.selection) a partir de uma visão: o que a visão não disser vem
 * dos padrões da definição. Cópias simples (serializáveis) — a tela pode guardar e alterar à vontade.
 * `filters` = filtros da visão (ou os padrões da definição); a tela decide se mantém os do usuário.
 * `summarySort` null = ordem natural (rótulo). `drill` sempre vazio (trocar de tipo sai do detalhe).
 * @param view objeto de listReportViews ou id da visão
 */
export function viewSelection(view, definition) {
  const resolved = typeof view === 'string' ? getReportView(definition, view) : view;
  if (!resolved) throw new Error(`relatório ${definition?.id}: visão desconhecida (${view})`);
  const aggregates = clone(resolved.aggregates ?? definition.defaultAggregates ?? []);
  const columns = [...(resolved.columns ?? definition.defaultColumns ?? [])];
  // E1D: columnChoices.defaults = o que o tipo mostra sem escolha da pessoa (colunas no Detalhado, métricas no Resumido).
  const chosen = resolved.columnChoices ? applyColumnKeys(resolved, definition, resolved.columnChoices.defaults) : null;
  return {
    // E1D: o tipo vai explícito na seleção (o serviço aplica a população e os eixos dele).
    view: resolved.generated ? null : resolved.id,
    groups: clone(resolved.groups ?? []),
    mode: resolved.mode,
    aggregates: chosen?.aggregates ?? aggregates,
    columns: chosen?.columns ?? columns,
    sort: clone(resolved.sort ?? definition.defaultSort ?? []),
    summarySort: clone(resolved.summarySort ?? null),
    filters: clone(resolved.filters ?? definition.defaultFilters ?? {}),
    matrix: resolved.matrix ? { ...resolved.matrix } : null,
    drill: [],
  };
}

/**
 * Chaves do seletor "Colunas" de um tipo → seleção. Detalhado: as chaves são ids de coluna (na ordem dada).
 * Resumido: chaves de métrica → agregações do tipo na ordem dada (o par "de–até" vira as duas métricas).
 * Chave fora de columnChoices.available é ignorada; lista vazia/ausente → defaults do tipo.
 * @returns {{ columns?: string[], aggregates?: object[] }}
 */
export function applyColumnKeys(view, definition, keys) {
  const choices = view.columnChoices;
  if (!choices) return {};
  const wanted = (Array.isArray(keys) && keys.length ? keys : choices.defaults).filter((key) => choices.available.includes(key));
  const list = wanted.length ? [...new Set(wanted)] : [...choices.defaults];
  if (view.mode === REPORT_MODES.DETALHADO) return { columns: list };
  const pool = view.aggregates ?? definition.defaultAggregates ?? [];
  const pairs = definition.metricPairs ?? [];
  const aggregates = [];
  for (const key of list) {
    const pair = pairs.find((item) => item.id === key);
    const ids = pair ? [pair.from, pair.to] : [key];
    for (const id of ids) {
      const spec = pool.find((item) => aggregateSpecId(item) === id);
      if (spec && !aggregates.includes(spec)) aggregates.push(spec);
    }
  }
  return { aggregates: clone(aggregates) };
}

/** Chaves atuais do seletor "Colunas" de um tipo a partir da seleção (inverso de applyColumnKeys). */
export function columnKeysOf(view, definition, selection = {}) {
  if (!view?.columnChoices) return [];
  if (view.mode === REPORT_MODES.DETALHADO) return (selection.columns ?? []).filter((id) => view.columnChoices.available.includes(id));
  return metricKeysOf(selection.aggregates ?? [], definition.metricPairs ?? []).filter((key) => view.columnChoices.available.includes(key));
}

/**
 * Tipo atual da tela: o explícito (state.view, E1D) quando é um tipo declarado; senão o que bate pela
 * estrutura (matchView — estados e modelos de antes da E1D); nenhum → null ("Personalizado").
 */
export function resolveViewId(definition, state = {}) {
  if (state.view && getReportView(definition, state.view)) return state.view;
  if (state.view === null && definition?.defaultView) return null;
  return matchView(definition, state);
}

/**
 * Valor de uma opção de "Ordenar por" ("tipo:chave:direção") → partes. A chave pode ter ":" (total criado
 * no diálogo Totais, ex. "sum:peso"): tipo = antes do 1º ":", direção = depois do último, chave = o meio.
 * @returns {{ kind: string, key: string, direction: string }}
 */
export function parseSortChoice(value) {
  const parts = String(value ?? '').split(':');
  return { kind: parts[0], key: parts.slice(1, -1).join(':'), direction: parts.length > 1 ? parts.at(-1) : '' };
}

/**
 * Filtros da definição (ex.: Rebanho atual abre com situação = ATIVO), de uma visão ou de um modelo
 * antigo usam o CÓDIGO do enum; a tela (pílula/botão) marca e conta pelo RÓTULO exibido ("Ativo").
 * Converte código → rótulo nas colunas enum; o serviço, com match "label", aceita os dois — a população
 * não muda. Condição com match "code" (herdada de relatório antigo) fica como está.
 */
export function filtersForDisplay(filters, columns = []) {
  const out = {};
  for (const [columnId, filter] of Object.entries(filters || {})) {
    const column = columns.find((item) => item.id === columnId);
    const options = column?.type === 'enum' && Array.isArray(column.options) ? column.options : null;
    if (!options || !filter || typeof filter !== 'object' || filter.match === 'code') { out[columnId] = filter; continue; }
    const labelOf = (value) => options.find((option) => option.value === value)?.label ?? value;
    out[columnId] = {
      ...filter,
      ...(Array.isArray(filter.values) ? { values: [...new Set(filter.values.map(labelOf))] } : {}),
      ...(typeof filter.value === 'string' ? { value: labelOf(filter.value) } : {}),
    };
  }
  return out;
}

const specKey = (spec) => `${spec.id}|${spec.op}|${spec.columnId ?? ''}`;
const aggregatesKey = (list) => JSON.stringify((list ?? []).map(specKey).sort());

// E1E: os totais do estado são os do tipo — iguais aos declarados ou, num tipo resumido com "Colunas"
// (columnChoices), uma escolha não vazia dentro deles (o que o "Colunas Painel" do tipo produz; os antigos
// "Rebanho por …", "Saídas por motivo"… tinham parte dos totais do tipo novo).
function sameMetrics(definition, view, aggregates) {
  const pool = view.aggregates ?? definition?.defaultAggregates ?? [];
  if (aggregatesKey(aggregates) === aggregatesKey(pool)) return true;
  if (view.mode !== REPORT_MODES.RESUMIDO || !view.columnChoices || !aggregates.length) return false;
  const inPool = new Set(pool.map(specKey));
  return aggregates.every((spec) => inPool.has(specKey(spec)));
}

// Filtro comparável: operador e valores (sem diferença de caixa; em coluna enum, código e rótulo são o mesmo).
function filterKey(filter, column) {
  const options = column?.type === 'enum' && Array.isArray(column.options) ? column.options : [];
  const text = (value) => String(options.find((option) => option.value === value)?.label ?? value ?? '').trim().toLocaleLowerCase('pt-BR');
  const values = Array.isArray(filter?.values) ? [...new Set(filter.values.map(text))].sort() : [];
  return JSON.stringify([filter?.operator ?? null, text(filter?.value), text(filter?.valueTo), values]);
}

/** A população do tipo já está nos filtros do estado (mesma condição em cada coluna dela)? */
function populationIn(definition, population, filters) {
  return Object.entries(population).every(([columnId, condition]) => {
    const filter = filters?.[columnId];
    const column = definition?.columns?.find((item) => item.id === columnId);
    return filter && typeof filter === 'object' && isFilterActive(filter) && filterKey(filter, column) === filterKey(condition, column);
  });
}

// E1D: a matriz declara groups vazio (os níveis vêm dos eixos); pela estrutura ela é Linhas › Colunas nos
// eixos padrão. Sem isto um Resumido sem agrupamento (só o Total geral) passaria por "Sintético (Matriz)".
function structuralGroups(definition, view) {
  if (view.layout !== VIEW_LAYOUTS.MATRIX) return view.groups ?? [];
  const axes = definition?.matrixAxes ?? [];
  return [view.matrix?.eixoY, view.matrix?.eixoX].map((id) => axes.find((axis) => axis.id === id)).filter(Boolean).map((axis) => ({ columnId: axis.columnId }));
}

/**
 * Qual visão bate com o estado da tela: mesmas colunas de agrupamento (na mesma ordem e direção) e mesmo
 * modo; quando o estado informa `aggregates`, os mesmos totais; no Detalhado, quando informa `columns`,
 * as mesmas colunas. Nenhuma → null ("Personalizado") — assim o seletor nunca mostra um tipo que não está
 * aplicado de fato (e escolhê-lo de novo reaplica a visão).
 * E1E: quando o estado informa `filters` (filtros da pessoa + condições fixas), um tipo com população (Mortes,
 * Perdendo Peso, Sem Pesagem Recente…) só bate se os filtros já trazem exatamente a população dele — senão o
 * tipo estreitaria o estado em silêncio (ex.: "sem pesagem há mais de 15 dias" não vira o tipo dos 30) — e,
 * batendo, ele vence o tipo genérico de mesma estrutura ("Mudanças de Lote" × "Por Lote").
 * @param {{ groups?: { columnId, direction? }[], mode?: string, aggregates?: object[], columns?: string[], filters?: object }} state
 */
export function matchView(definition, state = {}) {
  const groups = (state.groups ?? definition?.defaultGroups ?? []).filter((group) => group?.columnId);
  const mode = state.mode ?? definition?.defaultMode ?? REPORT_MODES.DETALHADO;
  const candidates = listReportViews(definition).filter((view) => {
    if (view.mode !== mode || !sameGroups(structuralGroups(definition, view), groups)) return false;
    if (Array.isArray(state.aggregates) && !sameMetrics(definition, view, state.aggregates)) return false;
    if (mode === REPORT_MODES.DETALHADO && Array.isArray(state.columns)) {
      const expected = view.columns ?? definition.defaultColumns ?? [];
      if (state.columns.join('|') !== expected.join('|')) return false;
    }
    return true;
  });
  if (!state.filters || typeof state.filters !== 'object') return candidates[0]?.id ?? null;
  const covered = candidates.find((view) => view.population && populationIn(definition, view.population, state.filters));
  return (covered ?? candidates.find((view) => !view.population))?.id ?? null;
}

/**
 * Abas Resumido/Detalhado → mudança do estado da tela. Trocar o modo sai do tipo ("Personalizado", view
 * null — contrato E1D §3), EXCETO no detalhe de um grupo (clique na folha): voltar ao modo do tipo é só
 * sair do detalhe, como o X da pílula, e o tipo fica. Sem isso a matriz — que não guarda grupos no estado
 * (os eixos viram grupos no serviço) — virava Personalizado sem agrupamento e só sobrava o Total geral.
 * @param {{ view?: string|null, mode?: string, drill?: object[] }} state estado da tela
 * @returns {object} o que muda no estado (update)
 */
export function modeChangePatch(definition, state, mode) {
  const drill = state?.drill ?? [];
  const typeMode = state?.view ? getReportView(definition, state.view)?.mode ?? null : null;
  if (drill.length && typeMode && mode === typeMode) return { mode, drill: [] };
  return { mode, drill: mode === REPORT_MODES.RESUMIDO ? [] : drill, ...(mode === state?.mode ? {} : { view: null, matrix: null }) };
}
