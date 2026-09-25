// "Tipo de relatório" (E1B §3): visões nomeadas de um relatório. Uma visão é só um ATALHO para a
// seleção da E1 (agrupamentos, modo, totais, colunas, ordenação) — nenhuma conta nova, nenhum segundo
// caminho de filtro. As visões declaradas na definição (`views`, validadas em defineReport) valem; sem
// nenhuma, o relatório ganha "Resumo por <agrupamento padrão>" (se tiver) e "Analítico".
// Visões NÃO são aliases antigos (LEGACY_REPORT_ALIASES) e não viram presetId no manifesto.
import { REPORT_MODES } from './reportDefinition.js';

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
  return {
    groups: clone(resolved.groups ?? []),
    mode: resolved.mode,
    aggregates: clone(resolved.aggregates ?? definition.defaultAggregates ?? []),
    columns: [...(resolved.columns ?? definition.defaultColumns ?? [])],
    sort: clone(resolved.sort ?? definition.defaultSort ?? []),
    summarySort: clone(resolved.summarySort ?? null),
    filters: clone(resolved.filters ?? definition.defaultFilters ?? {}),
    drill: [],
  };
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

const aggregatesKey = (list) => JSON.stringify((list ?? []).map((spec) => `${spec.id}|${spec.op}|${spec.columnId ?? ''}`).sort());

/**
 * Qual visão bate com o estado da tela: mesmas colunas de agrupamento (na mesma ordem e direção) e mesmo
 * modo; quando o estado informa `aggregates`, os mesmos totais; no Detalhado, quando informa `columns`,
 * as mesmas colunas. Nenhuma → null ("Personalizado") — assim o seletor nunca mostra um tipo que não está
 * aplicado de fato (e escolhê-lo de novo reaplica a visão).
 * @param {{ groups?: { columnId, direction? }[], mode?: string, aggregates?: object[], columns?: string[] }} state
 */
export function matchView(definition, state = {}) {
  const groups = (state.groups ?? definition?.defaultGroups ?? []).filter((group) => group?.columnId);
  const mode = state.mode ?? definition?.defaultMode ?? REPORT_MODES.DETALHADO;
  const found = listReportViews(definition).find((view) => {
    if (view.mode !== mode || !sameGroups(view.groups, groups)) return false;
    if (Array.isArray(state.aggregates) && aggregatesKey(state.aggregates) !== aggregatesKey(view.aggregates ?? definition.defaultAggregates)) return false;
    if (mode === REPORT_MODES.DETALHADO && Array.isArray(state.columns)) {
      const expected = view.columns ?? definition.defaultColumns ?? [];
      if (state.columns.join('|') !== expected.join('|')) return false;
    }
    return true;
  });
  return found?.id ?? null;
}
