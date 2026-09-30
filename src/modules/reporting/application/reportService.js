// Serviço de relatórios (docs/reporting/ARCHITECTURE.md).
//
//   ReportDefinition → fonte indexada → linhas canônicas → filtro → ordenação → agrupamento
//   → agregação → ReportViewModel (tela, CSV, JSON, impressão, PDF e XLSX leem ESTE objeto).
//
// Toda operação valida permissão aqui (não só na tela). O mesmo view model é a população
// única: exportadores não voltam ao banco nem refazem conta.
import { applyFilters, isFilterActive, serializeFilters } from '../domain/filterEngine.js';
import { sortRows } from '../domain/sortEngine.js';
import { groupRows, MAX_GROUP_LEVELS, NONE_GROUP_KEY, NONE_GROUP_LABEL } from '../domain/groupEngine.js';
import { aggregateSpecId, assertAggregateSpec, computeAggregates } from '../domain/reportAggregates.js';
import { REPORT_MODES, REPORT_VISIBILITY, VIEW_LAYOUTS, createColumnResolver, normalizeReportMode } from '../domain/reportDefinition.js';
import { getReportView, viewSelection } from '../domain/reportViews.js';
import { applySortChoice, isKnownSortChoice } from '../domain/sortChoices.js';
import { GRAIN_LABELS, grainHasAnimal } from '../domain/reportGrain.js';
import { describePeriod, localToday, resolvePeriod } from '../domain/reportPeriod.js';
import { assertCanRunReport, canRunReport, canSeeColumn, forbiddenColumnIds } from '../domain/reportPermissions.js';
import { SUMMARY_LABEL_SORT, SUMMARY_ROWS_METRIC, buildSummaryRows } from '../domain/summaryLayout.js';
import { can, forbiddenError } from '../../auth/domain/permissionService.js';
import { listReportDefinitions, resolveReportId } from '../definitions/reportCatalog.js';
import { aliasSelection, getLegacyAlias } from '../definitions/legacyAliases.js';
import { getReportSource } from '../infrastructure/reportSources/index.js';
import { APP_VERSION, DATA_BUILD_ID, DB_SCHEMA_VERSION } from '../../../versioning/versionInfo.js';
import { ARROBA_DIVISORS, REPORT_SETTINGS_DEFAULTS, getReportSettings } from '../../settings/application/appConfigService.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function requireActor(actor) {
  if (!actor?.role) throw forbiddenError(actor?.role ?? null, 'reports.read');
  return actor;
}

function newEmissionId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `em-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const summaryOf = (definition, role, overrides = {}) => ({
  id: definition.id,
  title: definition.title,
  description: definition.description,
  family: definition.family,
  grain: definition.grain,
  classification: definition.classification,
  metrics: definition.metrics,
  requires: definition.requires,
  status: definition.status,
  blockedReason: definition.blockedReason ?? null,
  available: canRunReport(definition, role),
  defaultMode: definition.defaultMode,
  visibility: definition.visibility,
  ...overrides,
});

/**
 * Catálogo filtrado pelo papel. E1: por área da interface — `catalog` (os 12 de Relatórios, padrão)
 * ou `maintenance` (aba Controle). Bloqueados e cadastros ficam fora (visibility hidden).
 * E1B (resposta 2 da responsável): quem NÃO abre Backup e Manutenção (sem `maintenance.backup`) vê em
 * Relatórios, na família "Controle", os relatórios da aba Controle que o papel pode abrir (hoje
 * Pendências de pesagem e Qualidade dos dados para OPERADOR/CONSULTA). ADMIN/GESTOR: os 12 + aba Controle.
 */
export function listReports(actor, { visibility = REPORT_VISIBILITY.CATALOG } = {}) {
  const { role } = requireActor(actor);
  const items = listReportDefinitions({ visibility }).map((definition) => summaryOf(definition, role));
  if (visibility === REPORT_VISIBILITY.CATALOG && !can(role, 'maintenance.backup')) {
    for (const definition of listReportDefinitions({ visibility: REPORT_VISIBILITY.MAINTENANCE })) {
      if (canRunReport(definition, role)) items.push(summaryOf(definition, role, { family: 'controle', controlInCatalog: true }));
    }
  }
  return items.filter((item) => item.status === 'blocked' || item.available);
}

/**
 * Seleção efetiva quando o relatório é aberto por um id antigo (alias): a seleção equivalente do
 * relatório antigo preenche o que a chamada não informou. `params` antigos viram filtros.
 */
function mergeAliasSelection(alias, selection = {}, params = {}) {
  if (!alias) return selection;
  const preset = aliasSelection(alias, params);
  const merged = { ...selection };
  // E1E: `view` = alias que virou tipo (comercial.vendas → Comercial › Vendas).
  for (const key of ['view', 'columns', 'groups', 'filters', 'sort', 'aggregates', 'mode']) {
    if (merged[key] === undefined && preset[key] !== undefined) merged[key] = preset[key];
  }
  // A chamada trouxe filtros próprios: as condições que eram do relatório antigo (motivo = Morte,
  // ganho < 0, parâmetro de dias…) continuam valendo — como filtro comum se a coluna está livre,
  // como condição fixa se a chamada também filtra aquela coluna (as duas valem, como na 1.3.x).
  if (selection.filters !== undefined) {
    const filters = { ...selection.filters };
    const fixedFilters = { ...(selection.fixedFilters ?? {}) };
    for (const id of alias.fixed ?? []) {
      if (!preset.filters[id]) continue;
      if (isFilterActive(filters[id])) fixedFilters[id] = preset.filters[id];
      else filters[id] = preset.filters[id];
    }
    merged.filters = filters;
    if (Object.keys(fixedFilters).length) merged.fixedFilters = fixedFilters;
  }
  return merged;
}

/**
 * Normaliza a seleção do usuário (modelo salvo ou tela) contra a definição e o papel.
 * Colunas sem permissão são removidas com aviso; ids desconhecidos são erro.
 */
export function resolveSelection(definition, selection = {}, role) {
  const resolve = createColumnResolver(definition.columns);
  const warnings = [];
  // E1D: tipo explícito (view), eixos da matriz e "Ordenar por" fixo — ver resolveViewSelection. O que a
  // seleção não disser vem do tipo (colunas/totais padrão dele), e só depois da definição.
  const typed = resolveViewSelection(definition, selection);
  const typeDefaults = typed.view ? viewSelection(typed.view, definition) : null;
  const requestedColumns = selection.columns?.length ? selection.columns : (typeDefaults?.columns?.length ? typeDefaults.columns : definition.defaultColumns);
  for (const id of requestedColumns) if (!resolve(id)) throw new Error(`relatório ${definition.id}: coluna desconhecida (${id})`);
  // E1D (Vendas): as colunas padrão do tipo que o perfil não vê (Valor @, Valor total sem commercial.values)
  // também entram no aviso — modelo e último estado desse perfil já voltam sem elas, e o aviso tem de ficar.
  const typeColumns = typed.view ? (typed.view.columnChoices?.defaults ?? typed.view.columns ?? []) : [];
  const hiddenByPermission = forbiddenColumnIds(definition, role, [...new Set([...requestedColumns, ...typeColumns])]);
  if (hiddenByPermission.length) warnings.push({ code: 'COLUMNS_HIDDEN_BY_PERMISSION', message: `${hiddenByPermission.length} coluna(s) oculta(s) pelo seu perfil`, columns: hiddenByPermission });
  // Coluna só de cálculo (metricOnly: Machos, Fêmeas…) nunca vira coluna de dado nem filtro/ordenação.
  const columns = requestedColumns.filter((id) => !hiddenByPermission.includes(id) && !resolve(id).column.metricOnly);

  const filters = serializeFilters(selection.filters ?? definition.defaultFilters ?? {});
  for (const id of Object.keys(filters)) {
    const accessor = resolve(id);
    if (!accessor) throw new Error(`relatório ${definition.id}: filtro em coluna desconhecida (${id})`);
    if (accessor.column.metricOnly) { delete filters[id]; continue; }
    if (!canSeeColumn(accessor.column, role)) {
      delete filters[id];
      warnings.push({ code: 'FILTER_REMOVED_BY_PERMISSION', message: `Filtro em ${accessor.column.label} removido pelo seu perfil`, columns: [id] });
    }
  }

  const sort = (typed.sort?.length ? typed.sort : definition.defaultSort).filter((item) => {
    const accessor = resolve(item.columnId);
    if (!accessor) throw new Error(`relatório ${definition.id}: ordenação em coluna desconhecida (${item.columnId})`);
    return canSeeColumn(accessor.column, role) && !accessor.column.metricOnly;
  });

  const groups = typed.groups;
  if (groups.length > MAX_GROUP_LEVELS) throw new Error(`relatório ${definition.id}: no máximo ${MAX_GROUP_LEVELS} níveis de agrupamento`);
  for (const group of groups) {
    const accessor = resolve(group.columnId);
    if (!accessor) throw new Error(`relatório ${definition.id}: agrupamento em coluna desconhecida (${group.columnId})`);
    if (!accessor.column.groupable) throw new Error(`relatório ${definition.id}: ${group.columnId} não é agrupável`);
    if (!canSeeColumn(accessor.column, role)) throw forbiddenError(role, 'commercial.values');
  }

  const aggregates = (selection.aggregates ?? typeDefaults?.aggregates ?? definition.defaultAggregates).filter((spec) => {
    assertAggregateSpec(spec, resolve);
    if (!spec.columnId) return true;
    return canSeeColumn(resolve(spec.columnId).column, role);
  });

  // Condições fixas de um modelo convertido na 1.4.0 (a condição do relatório antigo numa coluna em
  // que o modelo também filtrava): aplicadas como as `lockedFilters` da definição. Nunca são
  // removidas por perfil — tirar uma condição ampliaria a população.
  // E1D: a população do tipo (Vendas = Saída por Venda) entra aqui também — vale na tela, nas exportações
  // e nos modelos, e nenhum controle a tira (na mesma coluna, a condição do tipo prevalece).
  const fixedFilters = { ...serializeFilters(selection.fixedFilters ?? {}), ...serializeFilters(typed.view?.population ?? {}) };
  for (const id of Object.keys(fixedFilters)) {
    const accessor = resolve(id);
    if (!accessor) throw new Error(`relatório ${definition.id}: condição fixa em coluna desconhecida (${id})`);
    if (!canSeeColumn(accessor.column, role)) throw forbiddenError(role, 'commercial.values');
  }

  const searchColumnIds = definition.searchColumns.filter((id) => canSeeColumn(resolve(id).column, role));

  // Modo: RESUMIDO | DETALHADO (padrão da definição — Resumido quando nasce agrupada). E1D: com tipo, o
  // modo é o do tipo — exceto no detalhe de um grupo (clique na folha), que é sempre o Detalhado.
  const drilling = (selection.drill ?? []).some((part) => part?.columnId);
  const mode = typed.view && !drilling ? typed.view.mode : normalizeReportMode(selection.mode, definition.defaultMode ?? REPORT_MODES.DETALHADO);

  // Detalhe de um grupo (clique no Resumido): recorte EXATO pela mesma chave do agrupamento
  // (groupKeyOf), inclusive "Não informado" — não é filtro de texto, então nunca mistura grupos.
  const drill = (selection.drill ?? []).filter((part) => part?.columnId).map((part) => {
    const accessor = resolve(part.columnId);
    if (!accessor) throw new Error(`relatório ${definition.id}: detalhe em coluna desconhecida (${part.columnId})`);
    if (!accessor.column.groupable) throw new Error(`relatório ${definition.id}: ${part.columnId} não é agrupável`);
    if (!canSeeColumn(accessor.column, role)) throw forbiddenError(role, 'commercial.values');
    return { columnId: part.columnId, key: part.key === null || part.key === undefined ? NONE_GROUP_KEY : String(part.key), label: part.label ?? null, columnLabel: accessor.column.label };
  });

  // Ordem das linhas do Resumido: por rótulo, por quantidade de linhas ou por uma métrica selecionada.
  // E1D: `columnId` restringe a ordem a um nível (as linhas dentro de cada seção — "Ordenar por" fixo);
  // nível que não está no agrupamento é ignorado (a ordem volta a valer em todos, como na E1).
  let summarySort = null;
  if (typed.summarySort?.key) {
    const key = String(typed.summarySort.key);
    const known = key === SUMMARY_LABEL_SORT || key === SUMMARY_ROWS_METRIC || aggregates.some((spec) => aggregateSpecId(spec) === key);
    const level = typed.summarySort.columnId && groups.some((group) => group.columnId === typed.summarySort.columnId) ? String(typed.summarySort.columnId) : null;
    if (known) summarySort = { key, direction: typed.summarySort.direction === 'desc' ? 'desc' : 'asc', ...(level ? { columnId: level } : {}) };
  }
  return {
    resolve, columns, filters, fixedFilters, search: String(selection.search ?? '').trim(), searchColumnIds, sort, groups, aggregates, warnings, hiddenByPermission, mode, drill, summarySort,
    view: typed.view, matrix: typed.matrix, sortChoice: typed.sortChoice,
  };
}

/**
 * E1D — tipo explícito na seleção (contrato: docs/evidence/e1d/CONTRATOS-AGENTES.md §2).
 *   selection.view        id de um tipo declarado (definition.views) ou null/ausente (Personalizado);
 *   selection.matrix      { eixoY, eixoX } — só no tipo com layout "matrix" (padrão = o do tipo);
 *   selection.sortChoice  id de definition.sortChoices (ou null) — vira sort/summarySort/direção do grupo.
 * Com tipo: na matriz os grupos SÃO os eixos (Linhas › Colunas); no tipo com groupChoices (Analítico) os
 * grupos têm de estar entre as escolhas; nos demais, as colunas de agrupamento são as do tipo (a direção
 * pode mudar — "Data (Mais Antiga)" inverte o nível de data). Fora disso é erro (a tela passa a
 * "Personalizado" — view null — quando a pessoa agrupa por outro caminho).
 * @returns {{ view: object|null, matrix: object|null, sortChoice: string|null, groups: object[], sort: object[], summarySort: object|null }}
 */
export function resolveViewSelection(definition, selection = {}) {
  let view = null;
  if (selection.view != null && selection.view !== '') {
    view = getReportView(definition, String(selection.view));
    if (!view || view.generated) throw new Error(`relatório ${definition.id}: tipo de relatório desconhecido (${selection.view})`);
  }
  // Sem grupos na seleção: os do tipo (ou os padrão da definição, sem tipo).
  const requestedGroups = (selection.groups ?? (view ? view.groups : definition.defaultGroups) ?? []).filter((item) => item?.columnId);
  let matrix = null;
  let groups = requestedGroups.map((group) => ({ ...group }));
  if (view?.layout === VIEW_LAYOUTS.MATRIX) {
    const axes = definition.matrixAxes ?? [];
    const eixoY = selection.matrix?.eixoY ?? view.matrix.eixoY;
    const eixoX = selection.matrix?.eixoX ?? view.matrix.eixoX;
    const rowAxis = axes.find((axis) => axis.id === eixoY);
    const colAxis = axes.find((axis) => axis.id === eixoX);
    if (!rowAxis || !colAxis) throw new Error(`relatório ${definition.id}: eixo da matriz desconhecido (${eixoY} × ${eixoX})`);
    if (rowAxis.id === colAxis.id) throw new Error(`relatório ${definition.id}: Linhas e Colunas da matriz não podem ser o mesmo eixo (${rowAxis.label})`);
    matrix = { eixoY: rowAxis.id, eixoX: colAxis.id, rowAxis: { ...rowAxis }, colAxis: { ...colAxis } };
    const direction = (columnId) => requestedGroups.find((group) => group.columnId === columnId)?.direction;
    groups = [rowAxis, colAxis].map((axis) => ({ columnId: axis.columnId, ...(direction(axis.columnId) ? { direction: direction(axis.columnId) } : {}) }));
  } else if (view?.groupChoices) {
    const outside = groups.filter((group) => !view.groupChoices.includes(group.columnId));
    if (outside.length) throw new Error(`relatório ${definition.id}: o tipo "${view.label}" agrupa só por ${view.groupChoices.join(', ')} (recebido ${outside.map((group) => group.columnId).join(', ')})`);
  } else if (view) {
    const expected = (view.groups ?? []).map((group) => group.columnId).join('|');
    if (groups.map((group) => group.columnId).join('|') !== expected) throw new Error(`relatório ${definition.id}: o tipo "${view.label}" agrupa por ${expected || 'nada'} (recebido ${groups.map((group) => group.columnId).join('|') || 'nada'})`);
  }
  const sortChoice = selection.sortChoice ?? null;
  if (sortChoice != null && !isKnownSortChoice(definition, sortChoice)) throw new Error(`relatório ${definition.id}: opção de ordenação desconhecida (${sortChoice})`);
  // A métrica equivalente da opção (peso médio, GMD médio) é procurada nos totais efetivos: os da seleção ou
  // os padrão do tipo (resolveSelection usa a mesma regra).
  const aggregates = selection.aggregates ?? (view ? viewSelection(view, definition).aggregates : definition.defaultAggregates) ?? [];
  const sorted = applySortChoice(definition, view, { sort: selection.sort, summarySort: selection.summarySort, groups, aggregates }, sortChoice);
  return { view, matrix, sortChoice, groups: sorted.groups, sort: sorted.sort, summarySort: sorted.summarySort };
}

function applyDrill(rows, drill, resolve) {
  if (!drill.length) return rows;
  const tests = drill.map((part) => {
    const accessor = resolve(part.columnId);
    return (row) => {
      const raw = accessor.groupKeyOf(row);
      const key = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '') ? NONE_GROUP_KEY : String(raw);
      return key === part.key;
    };
  });
  return rows.filter((row) => tests.every((test) => test(row)));
}

function resolveParams(definition, input = {}, today) {
  const params = {};
  for (const param of definition.params) {
    if (param.type === 'period') {
      const value = input[param.id] ?? param.default ?? null;
      if (!value && param.required) throw new Error(`relatório ${definition.id}: período obrigatório`);
      params[param.id] = value ? resolvePeriod(value, today) : null;
    } else if (param.type === 'integer') {
      const value = input[param.id] ?? param.default;
      const number = Number(value);
      if (!Number.isInteger(number) || (param.min != null && number < param.min)) throw new Error(`relatório ${definition.id}: ${param.label || param.id} inválido`);
      params[param.id] = number;
    } else {
      params[param.id] = input[param.id] ?? param.default ?? null;
    }
  }
  return params;
}

function publicColumn(accessor) {
  const { column } = accessor;
  return {
    id: column.id, label: column.label, type: column.type, unit: column.unit, align: column.align,
    decimals: column.decimals, sensitive: column.sensitive, source: column.source, groupable: column.groupable,
    aggregations: column.aggregations, defaultWidth: column.defaultWidth, options: column.options ?? null,
    description: column.description ?? null,
    // Só o id da coluna de peso da média ponderada (rótulo "Preço médio da @" no Resumido).
    weightedBy: typeof column.weightedBy === 'string' ? column.weightedBy : null,
    // E1B: contagem 0 aparece "—" na folha e coluna só com zeros some (Machos/Fêmeas).
    ...(column.zeroAsEmpty ? { zeroAsEmpty: true } : {}),
    // E1B: coluna só de cálculo (base de Machos/Fêmeas/nota do GMD) — a tela não a oferece como dado.
    ...(column.metricOnly ? { metricOnly: true } : {}),
  };
}

/**
 * Pares "de–até" da definição cujas duas métricas estão na seleção — e, quando o par é amarrado a um
 * nível (leafColumnId, ex.: faixa do lote), só se o último nível de agrupamento for essa coluna. As
 * métricas de um par que não vale ali saem de todos os canais (hiddenMetrics), em vez de virar um
 * "mínimo dos mínimos" sem sentido.
 */
function pairsPresent(pairs = [], aggregates = [], levels = []) {
  const ids = new Set(aggregates.map(aggregateSpecId));
  const leafColumnId = levels.at(-1)?.columnId ?? null;
  const selected = pairs.filter((pair) => ids.has(pair.from) && ids.has(pair.to));
  const active = selected.filter((pair) => !pair.leafColumnId || pair.leafColumnId === leafColumnId);
  const hiddenMetrics = selected.filter((pair) => !active.includes(pair)).flatMap((pair) => [pair.from, pair.to]);
  return { active, hiddenMetrics };
}

/**
 * Divisor da @ de peso vivo (E1B): o da chamada (15 ou 30 — testes e tela) ou o de Configurações ›
 * Relatórios; sem configuração legível, o padrão 30. Nunca a @ de carcaça (÷ 15 com rendimento).
 */
async function resolveArrobaDivisor(requested, empresaId) {
  if (requested !== undefined && requested !== null && requested !== '') {
    const number = Number(requested);
    if (!ARROBA_DIVISORS.includes(number)) throw new Error(`relatório: divisor da arroba deve ser ${ARROBA_DIVISORS.join(' ou ')} (recebido ${requested})`);
    return number;
  }
  try {
    const settings = await getReportSettings(empresaId);
    const number = Number(settings?.arroba_divisor);
    return ARROBA_DIVISORS.includes(number) ? number : REPORT_SETTINGS_DEFAULTS.arroba_divisor;
  } catch {
    return REPORT_SETTINGS_DEFAULTS.arroba_divisor;
  }
}

/**
 * Executa um relatório.
 * @param {string|object} definitionOrId
 * @param {{ params?: object, selection?: object, empresaId?: string, today?: string, reuse?: object, arrobaDivisor?: 15|30 }} request
 *   reuse: view model anterior da MESMA tela. Se relatório, parâmetros, empresa, dia e divisor da @
 *   forem iguais, as linhas canônicas já carregadas são reaproveitadas (mudou só filtro/coluna/grupo/total).
 *   Não é cache persistido: vive só no objeto que a tela já segura.
 *   arrobaDivisor (E1B): divisor da @ de peso vivo; ausente → Configurações › Relatórios (padrão 30).
 * @param {{ id: string, nome?: string, role: string }} actor
 */
export async function runReport(definitionOrId, request = {}, actor) {
  const { role } = requireActor(actor);
  const resolved = typeof definitionOrId === 'string' ? resolveReportId(definitionOrId) : { definition: definitionOrId, aliasId: null, alias: null };
  const definition = resolved?.definition ?? null;
  if (!definition) throw new Error(`relatório desconhecido (${definitionOrId})`);
  assertCanRunReport(definition, role);
  const requestedPreset = !resolved.aliasId && request.presetId ? getLegacyAlias(request.presetId) : null;
  const preset = resolved.aliasId
    ? { id: resolved.aliasId, alias: resolved.alias }
    : requestedPreset?.id === definition.id ? { id: request.presetId, alias: requestedPreset } : { id: null, alias: null };
  const startedAt = now();
  const today = request.today || localToday();
  const params = resolveParams(definition, request.params, today);
  const selection = resolveSelection(definition, mergeAliasSelection(resolved.alias, request.selection, request.params), role);
  // Condição fixa do relatório (ex.: motivo = Venda em "Vendas do período"): sempre aplicada, sempre
  // exibida. Mais as condições fixas de um modelo convertido (o catálogo garante que um relatório
  // com visões antigas de condição fixa não tem lockedFilters próprias, então as chaves não colidem).
  const lockedFilters = { ...(definition.lockedFilters ? serializeFilters(definition.lockedFilters(params)) : {}), ...selection.fixedFilters };
  const source = getReportSource(definition.source);
  const empresaId = request.empresaId ?? 'local';
  // O divisor da @ vai para as linhas (peso_arroba/ganho_arroba): entra no sourceKey para o reuse
  // nunca servir linhas calculadas com o divisor anterior.
  const arrobaDivisor = await resolveArrobaDivisor(request.arrobaDivisor, empresaId);
  const sourceKey = JSON.stringify([definition.id, definition.version, empresaId, today, params, role, arrobaDivisor]);

  const reusable = request.reuse && request.reuse.sourceKey === sourceKey && request.reuse.sourceLoaded;
  const loaded = reusable
    ? { ...request.reuse.sourceLoaded, strategy: `${request.reuse.sourceLoaded.strategy}+reuse`, timings: { query: 0, transform: 0 } }
    : await source({ definition, params, empresaId, today, arrobaDivisor, deps: request.deps });
  const afterLoad = now();
  const locked = Object.keys(lockedFilters).length ? applyFilters(loaded.rows, { filters: lockedFilters }, selection.resolve) : loaded.rows;
  const filtered = applyDrill(applyFilters(locked, { search: selection.search, searchColumnIds: selection.searchColumnIds, filters: selection.filters }, selection.resolve), selection.drill, selection.resolve);
  const afterFilter = now();
  const sorted = sortRows(filtered, selection.sort, selection.resolve);
  const afterSort = now();
  const tree = groupRows(sorted, selection.groups, selection.resolve, { aggregates: selection.aggregates });
  const afterGroup = now();
  // Total geral: SEMPRE recalculado sobre a população final (nunca soma de subtotais).
  const totals = computeAggregates(sorted, selection.aggregates, selection.resolve);
  const animalAccessor = definition.animalColumnId ? selection.resolve(definition.animalColumnId) : null;
  const uniqueAnimalCount = grainHasAnimal(definition.grain) && animalAccessor
    ? new Set(sorted.map((row) => animalAccessor.groupKeyOf(row)).filter((key) => key !== null && key !== undefined && key !== '')).size
    : null;
  const afterAggregate = now();

  const period = Object.values(params).find((value) => value && value.preset && value.from) || null;
  // E1D: cabeçalho próprio do tipo (columnLabels, ex.: Vendas "Qtd @") — o mesmo nas colunas visíveis e nas
  // disponíveis (seletor "Colunas", pílulas de filtro, rodapé "Filtros:"), para a coluna não mudar de nome.
  const typedColumn = (id) => {
    const column = publicColumn(selection.resolve(id));
    const label = selection.view?.columnLabels?.[id];
    return label ? { ...column, label } : column;
  };
  // Resumido: lista em profundidade de nós (nível, caminho, rótulo, linhas, agregados) — SEM linhas de dados.
  const summaryRows = selection.mode === REPORT_MODES.RESUMIDO ? buildSummaryRows(tree.nodes, { summarySort: selection.summarySort }) : null;
  const drill = selection.drill.map((part) => {
    if (part.label) return part;
    if (part.key === NONE_GROUP_KEY) return { ...part, label: NONE_GROUP_LABEL };
    const sample = sorted[0];
    return { ...part, label: sample ? String(selection.resolve(part.columnId).groupLabelOf(sample) ?? part.key) : part.key };
  });
  return {
    kind: 'pesagens.report-view-model',
    version: 1,
    emissionId: newEmissionId(),
    reportId: definition.id,
    reportName: definition.title,
    // Nome no título da folha (E1C: Pesagens → "Pesagens Individuais"); os demais usam o próprio nome.
    sheetTitle: definition.sheetTitle ?? definition.title,
    reportDefinitionVersion: definition.version,
    // Aberto por id antigo consolidado (favorito/modelo/link de antes da 1.4.0). A tela chama com o id
    // novo e a seleção já aplicada, e informa a visão em `request.presetId` só para rastreabilidade.
    presetId: preset.id,
    presetTitle: preset.alias?.title ?? null,
    family: definition.family,
    grain: definition.grain,
    grainLabel: GRAIN_LABELS[definition.grain],
    animalColumnId: definition.animalColumnId ?? null,
    classification: definition.classification,
    notes: definition.notes,
    mode: selection.mode,
    summarySort: selection.summarySort,
    // E1D: tipo explícito (null = Personalizado), eixos da matriz e opção fixa de "Ordenar por".
    view: selection.view ? { id: selection.view.id, label: selection.view.label, layout: selection.view.layout ?? null, titleKind: selection.view.titleKind ?? null, sheetLayout: selection.view.sheetLayout ?? null } : null,
    matrix: selection.matrix,
    sortChoice: selection.sortChoice,
    summaryRows,
    drill,
    generatedAt: new Date().toISOString(),
    emittedBy: { id: actor.id ?? null, nome: actor.nome ?? null, role },
    appVersion: APP_VERSION,
    schemaVersion: DB_SCHEMA_VERSION,
    dataBuildId: DATA_BUILD_ID,
    params,
    period,
    periodDescription: period ? describePeriod(period) : null,
    // E1D: cabeçalho próprio do tipo (columnLabels, ex.: Vendas "Qtd @") vale na tela, na folha e nas exportações.
    columns: selection.columns.map(typedColumn),
    availableColumns: definition.columns.filter((column) => canSeeColumn(column, role)).map((column) => typedColumn(column.id)),
    hiddenByPermission: selection.hiddenByPermission,
    search: selection.search,
    filters: selection.filters,
    lockedFilters,
    sort: selection.sort,
    groups: tree.levels,
    aggregates: selection.aggregates.map((spec) => ({ id: aggregateSpecId(spec), columnId: spec.columnId ?? null, op: spec.op })),
    // E1B: divisor da @ de peso vivo usado nas linhas (rodapé "@ = peso vivo ÷ N" e manifesto); rótulos
    // de curral por id de métrica e pares "de–até" da definição (só os pares com as duas métricas).
    arrobaDivisor,
    metricLabels: definition.metricLabels ?? {},
    metricPairs: pairsPresent(definition.metricPairs ?? [], selection.aggregates, tree.levels).active,
    // Métricas de um par que não vale neste agrupamento (ex.: faixa do lote agrupando por data): fora da folha e das exportações.
    hiddenMetrics: pairsPresent(definition.metricPairs ?? [], selection.aggregates, tree.levels).hiddenMetrics,
    rows: sorted,
    rowCount: sorted.length,
    uniqueAnimalCount,
    tree: tree.nodes,
    totals,
    warnings: [...selection.warnings, ...(loaded.warnings || [])],
    stats: {
      strategy: loaded.strategy,
      rowsRead: loaded.rowsRead,
      rowsLoaded: loaded.rows.length,
      rowsOut: sorted.length,
      timings: {
        query: loaded.timings?.query ?? null,
        transform: loaded.timings?.transform ?? null,
        load: afterLoad - startedAt,
        filter: afterFilter - afterLoad,
        sort: afterSort - afterFilter,
        group: afterGroup - afterSort,
        aggregate: afterAggregate - afterGroup,
        total: afterAggregate - startedAt,
      },
    },
    // Internos (não serializados): resolver de colunas e população antes dos filtros do usuário
    // (opções das pílulas de filtro). Mesma referência de objetos — nenhuma cópia do dataset.
    resolve: selection.resolve,
    population: locked,
    sourceKey,
    sourceLoaded: { rows: loaded.rows, strategy: reusable ? request.reuse.sourceLoaded.strategy : loaded.strategy, rowsRead: loaded.rowsRead, warnings: loaded.warnings },
  };
}
