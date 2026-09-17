// Serviço de relatórios (docs/reporting/ARCHITECTURE.md).
//
//   ReportDefinition → fonte indexada → linhas canônicas → filtro → ordenação → agrupamento
//   → agregação → ReportViewModel (tela, CSV, JSON, impressão, PDF e XLSX leem ESTE objeto).
//
// Toda operação valida permissão aqui (não só na tela). O mesmo view model é a população
// única: exportadores não voltam ao banco nem refazem conta.
import { applyFilters, serializeFilters } from '../domain/filterEngine.js';
import { sortRows } from '../domain/sortEngine.js';
import { groupRows, MAX_GROUP_LEVELS } from '../domain/groupEngine.js';
import { aggregateSpecId, assertAggregateSpec, computeAggregates } from '../domain/reportAggregates.js';
import { createColumnResolver } from '../domain/reportDefinition.js';
import { GRAIN_LABELS, grainHasAnimal } from '../domain/reportGrain.js';
import { describePeriod, localToday, resolvePeriod } from '../domain/reportPeriod.js';
import { assertCanRunReport, canRunReport, canSeeColumn, forbiddenColumnIds } from '../domain/reportPermissions.js';
import { forbiddenError } from '../../auth/domain/permissionService.js';
import { getReportDefinition, listReportDefinitions } from '../definitions/reportCatalog.js';
import { getReportSource } from '../infrastructure/reportSources/index.js';
import { APP_VERSION, DATA_BUILD_ID, DB_SCHEMA_VERSION } from '../../../versioning/versionInfo.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function requireActor(actor) {
  if (!actor?.role) throw forbiddenError(actor?.role ?? null, 'reports.read');
  return actor;
}

function newEmissionId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `em-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Catálogo filtrado pelo papel (relatórios bloqueados aparecem só como indisponíveis). */
export function listReports(actor) {
  const { role } = requireActor(actor);
  return listReportDefinitions().map((definition) => ({
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
    presetOf: definition.presetOf ?? null,
  })).filter((item) => item.status === 'blocked' || item.available);
}

/**
 * Normaliza a seleção do usuário (modelo salvo ou tela) contra a definição e o papel.
 * Colunas sem permissão são removidas com aviso; ids desconhecidos são erro.
 */
export function resolveSelection(definition, selection = {}, role) {
  const resolve = createColumnResolver(definition.columns);
  const warnings = [];
  const requestedColumns = selection.columns?.length ? selection.columns : definition.defaultColumns;
  for (const id of requestedColumns) if (!resolve(id)) throw new Error(`relatório ${definition.id}: coluna desconhecida (${id})`);
  const hiddenByPermission = forbiddenColumnIds(definition, role, requestedColumns);
  if (hiddenByPermission.length) warnings.push({ code: 'COLUMNS_HIDDEN_BY_PERMISSION', message: `${hiddenByPermission.length} coluna(s) oculta(s) pelo seu perfil`, columns: hiddenByPermission });
  const columns = requestedColumns.filter((id) => !hiddenByPermission.includes(id));

  const filters = serializeFilters(selection.filters ?? definition.defaultFilters ?? {});
  for (const id of Object.keys(filters)) {
    const accessor = resolve(id);
    if (!accessor) throw new Error(`relatório ${definition.id}: filtro em coluna desconhecida (${id})`);
    if (!canSeeColumn(accessor.column, role)) {
      delete filters[id];
      warnings.push({ code: 'FILTER_REMOVED_BY_PERMISSION', message: `Filtro em ${accessor.column.label} removido pelo seu perfil`, columns: [id] });
    }
  }

  const sort = (selection.sort?.length ? selection.sort : definition.defaultSort).filter((item) => {
    const accessor = resolve(item.columnId);
    if (!accessor) throw new Error(`relatório ${definition.id}: ordenação em coluna desconhecida (${item.columnId})`);
    return canSeeColumn(accessor.column, role);
  });

  const groups = (selection.groups ?? definition.defaultGroups).filter((item) => item?.columnId);
  if (groups.length > MAX_GROUP_LEVELS) throw new Error(`relatório ${definition.id}: no máximo ${MAX_GROUP_LEVELS} níveis de agrupamento`);
  for (const group of groups) {
    const accessor = resolve(group.columnId);
    if (!accessor) throw new Error(`relatório ${definition.id}: agrupamento em coluna desconhecida (${group.columnId})`);
    if (!accessor.column.groupable) throw new Error(`relatório ${definition.id}: ${group.columnId} não é agrupável`);
    if (!canSeeColumn(accessor.column, role)) throw forbiddenError(role, 'commercial.values');
  }

  const aggregates = (selection.aggregates ?? definition.defaultAggregates).filter((spec) => {
    assertAggregateSpec(spec, resolve);
    if (!spec.columnId) return true;
    return canSeeColumn(resolve(spec.columnId).column, role);
  });

  const searchColumnIds = definition.searchColumns.filter((id) => canSeeColumn(resolve(id).column, role));
  return { resolve, columns, filters, search: String(selection.search ?? '').trim(), searchColumnIds, sort, groups, aggregates, warnings, hiddenByPermission };
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
  };
}

/**
 * Executa um relatório.
 * @param {string|object} definitionOrId
 * @param {{ params?: object, selection?: object, empresaId?: string, today?: string, reuse?: object }} request
 *   reuse: view model anterior da MESMA tela. Se relatório, parâmetros, empresa e dia forem iguais,
 *   as linhas canônicas já carregadas são reaproveitadas (mudou só filtro/coluna/grupo/total).
 *   Não é cache persistido: vive só no objeto que a tela já segura.
 * @param {{ id: string, nome?: string, role: string }} actor
 */
export async function runReport(definitionOrId, request = {}, actor) {
  const { role } = requireActor(actor);
  const definition = typeof definitionOrId === 'string' ? getReportDefinition(definitionOrId) : definitionOrId;
  if (!definition) throw new Error(`relatório desconhecido (${definitionOrId})`);
  assertCanRunReport(definition, role);
  const startedAt = now();
  const today = request.today || localToday();
  const params = resolveParams(definition, request.params, today);
  const selection = resolveSelection(definition, request.selection, role);
  // Condição fixa do relatório (ex.: ganho < 0 em "perdendo peso"): sempre aplicada, sempre exibida.
  const lockedFilters = definition.lockedFilters ? serializeFilters(definition.lockedFilters(params)) : {};
  const source = getReportSource(definition.source);
  const empresaId = request.empresaId ?? 'local';
  const sourceKey = JSON.stringify([definition.id, definition.version, empresaId, today, params, role]);

  const reusable = request.reuse && request.reuse.sourceKey === sourceKey && request.reuse.sourceLoaded;
  const loaded = reusable
    ? { ...request.reuse.sourceLoaded, strategy: `${request.reuse.sourceLoaded.strategy}+reuse`, timings: { query: 0, transform: 0 } }
    : await source({ definition, params, empresaId, today, deps: request.deps });
  const afterLoad = now();
  const locked = Object.keys(lockedFilters).length ? applyFilters(loaded.rows, { filters: lockedFilters }, selection.resolve) : loaded.rows;
  const filtered = applyFilters(locked, { search: selection.search, searchColumnIds: selection.searchColumnIds, filters: selection.filters }, selection.resolve);
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
  return {
    kind: 'pesagens.report-view-model',
    version: 1,
    emissionId: newEmissionId(),
    reportId: definition.id,
    reportName: definition.title,
    reportDefinitionVersion: definition.version,
    family: definition.family,
    grain: definition.grain,
    grainLabel: GRAIN_LABELS[definition.grain],
    classification: definition.classification,
    notes: definition.notes,
    generatedAt: new Date().toISOString(),
    emittedBy: { id: actor.id ?? null, nome: actor.nome ?? null, role },
    appVersion: APP_VERSION,
    schemaVersion: DB_SCHEMA_VERSION,
    dataBuildId: DATA_BUILD_ID,
    params,
    period,
    periodDescription: period ? describePeriod(period) : null,
    columns: selection.columns.map((id) => publicColumn(selection.resolve(id))),
    availableColumns: definition.columns.filter((column) => canSeeColumn(column, role)).map((column) => publicColumn(selection.resolve(column.id))),
    hiddenByPermission: selection.hiddenByPermission,
    search: selection.search,
    filters: selection.filters,
    lockedFilters,
    sort: selection.sort,
    groups: tree.levels,
    aggregates: selection.aggregates.map((spec) => ({ id: aggregateSpecId(spec), columnId: spec.columnId ?? null, op: spec.op })),
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
