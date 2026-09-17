// Modelos de relatório (Modelo 2 pessoal / Modelo 3 compartilhado) em appSettings — sem store nova.
//   report-templates:<empresa_id>                   → { version: 1, templates: [...] }
//   report-favorites:<empresa_id>:<usuario_id>      → [reportId]
//   report-recents:<empresa_id>:<usuario_id>        → [{ reportId, templateId, at }]
// O modelo guarda SÓ configuração (nunca dados). Ao aplicar, tudo é revalidado contra a
// definição e o papel de quem abre: modelo nunca amplia permissão.
import { readAppSetting, writeAppSetting } from '../../../storage/indexedDb/repositories/index.js';
import { can, forbiddenError } from '../../auth/domain/permissionService.js';
import { getReportDefinition } from '../definitions/reportCatalog.js';
import { canRunReport, canSeeColumn } from '../domain/reportPermissions.js';
import { MAX_GROUP_LEVELS } from '../domain/groupEngine.js';
import { serializeFilters } from '../domain/filterEngine.js';
import { PERIOD_PRESETS } from '../domain/reportPeriod.js';

export const TEMPLATE_VERSION = 1;
export const TEMPLATE_SCOPES = Object.freeze({ PERSONAL: 'PERSONAL', SHARED: 'SHARED' });
const MAX_RECENTS = 12;

const templatesKey = (empresaId) => `report-templates:${empresaId}`;
const favoritesKey = (empresaId, userId) => `report-favorites:${empresaId}:${userId}`;
const recentsKey = (empresaId, userId) => `report-recents:${empresaId}:${userId}`;

function requireActor(actor) {
  if (!actor?.id || !actor?.role) throw forbiddenError(actor?.role ?? null, 'reports.read');
  if (!can(actor.role, 'reports.read')) throw forbiddenError(actor.role, 'reports.read');
  return actor;
}

function templateError(message) {
  const error = new Error(message);
  error.code = 'REPORT_TEMPLATE_INVALID';
  return error;
}

async function readStore(empresaId) {
  const value = await readAppSetting(templatesKey(empresaId));
  if (!value || typeof value !== 'object' || !Array.isArray(value.templates)) return { version: TEMPLATE_VERSION, templates: [] };
  return value;
}

/** Visíveis ao ator: os próprios pessoais + todos os compartilhados, de relatórios que ele pode abrir. */
export async function listTemplates(actor, { empresaId = 'local', reportId = null } = {}) {
  requireActor(actor);
  const store = await readStore(empresaId);
  return store.templates.filter((template) => {
    if (reportId && template.baseReportId !== reportId) return false;
    const definition = getReportDefinition(template.baseReportId);
    if (!definition || !canRunReport(definition, actor.role)) return false;
    return template.scope === TEMPLATE_SCOPES.SHARED || template.ownerUserId === actor.id;
  }).map((template) => sanitizeTemplateFor(template, actor.role));
}

/** Cópia do modelo sem colunas, filtros, grupos, ordenação e totais que o papel não vê. */
function sanitizeTemplateFor(template, role) {
  const definition = getReportDefinition(template.baseReportId);
  const byId = new Map(definition.columns.map((column) => [column.id, column]));
  const visible = (id) => byId.has(id) && canSeeColumn(byId.get(id), role);
  return {
    ...template,
    columns: (template.columns || []).filter(visible),
    filters: Object.fromEntries(Object.entries(template.filters || {}).filter(([id]) => visible(id))),
    groups: (template.groups || []).filter((group) => visible(group.columnId)),
    sort: (template.sort || []).filter((item) => visible(item.columnId)),
    aggregates: (template.aggregates || []).filter((spec) => !spec.columnId || visible(spec.columnId)),
    widths: Object.fromEntries(Object.entries(template.widths || {}).filter(([id]) => visible(id))),
  };
}

/** Normaliza e valida a configuração contra a definição (ids desconhecidos são erro ao salvar). */
export function normalizeTemplateConfig(definition, config = {}) {
  const ids = new Set(definition.columns.map((column) => column.id));
  const byId = new Map(definition.columns.map((column) => [column.id, column]));
  const unknown = (list) => list.filter((id) => !ids.has(id));
  const columns = Array.isArray(config.columns) ? config.columns.map(String) : [];
  const filters = serializeFilters(config.filters || {});
  const groups = (config.groups || []).filter((group) => group?.columnId).map((group) => ({ columnId: String(group.columnId), direction: group.direction === 'desc' ? 'desc' : 'asc' }));
  const aggregates = (config.aggregates || []).map((spec) => ({ ...(spec.id ? { id: String(spec.id) } : {}), op: String(spec.op), ...(spec.columnId ? { columnId: String(spec.columnId) } : {}) }));
  const sort = (config.sort || []).filter((item) => item?.columnId).map((item) => ({ columnId: String(item.columnId), direction: item.direction === 'desc' ? 'desc' : 'asc' }));
  const bad = [
    ...unknown(columns), ...unknown(Object.keys(filters)), ...unknown(groups.map((g) => g.columnId)),
    ...unknown(sort.map((s) => s.columnId)), ...unknown(aggregates.filter((a) => a.columnId).map((a) => a.columnId)),
  ];
  if (bad.length) throw templateError(`Modelo com coluna inexistente no relatório: ${[...new Set(bad)].join(', ')}`);
  if (groups.length > MAX_GROUP_LEVELS) throw templateError(`Modelo com mais de ${MAX_GROUP_LEVELS} níveis de agrupamento`);
  for (const group of groups) if (!byId.get(group.columnId).groupable) throw templateError(`Coluna ${group.columnId} não é agrupável`);
  for (const spec of aggregates) {
    if (spec.op === 'count' && !spec.columnId) continue;
    if (!spec.columnId || !byId.get(spec.columnId).aggregations.includes(spec.op)) throw templateError(`Total ${spec.op} inválido para ${spec.columnId}`);
  }
  let period = null;
  if (config.period) {
    const preset = config.period.preset || 'personalizado';
    if (!PERIOD_PRESETS[preset]) throw templateError(`Período inválido (${preset})`);
    period = preset === 'personalizado' ? { preset, from: config.period.from ?? null, to: config.period.to ?? null } : { preset };
  }
  const params = {};
  for (const param of definition.params) {
    if (param.type === 'integer' && config.params?.[param.id] != null) params[param.id] = Number(config.params[param.id]);
    if (param.type === 'ranges' && Array.isArray(config.params?.[param.id])) {
      params[param.id] = config.params[param.id].map((band) => ({ label: String(band.label), min: band.min ?? null, max: band.max ?? null }));
    }
  }
  const widths = {};
  for (const [id, width] of Object.entries(config.widths || {})) if (ids.has(id) && Number.isFinite(Number(width))) widths[id] = Math.max(60, Math.min(600, Number(width)));
  return { columns, filters, groups, aggregates, sort, period, params, search: String(config.search ?? ''), widths, orientation: ['portrait', 'landscape', 'auto'].includes(config.orientation) ? config.orientation : 'auto' };
}

/** Cria ou atualiza. PERSONAL: só o dono edita. SHARED: exige reports.templates.share. */
export async function saveTemplate(input, actor, { empresaId = 'local', now = new Date().toISOString() } = {}) {
  requireActor(actor);
  const definition = getReportDefinition(input?.baseReportId);
  if (!definition) throw templateError('Relatório base inexistente');
  if (!canRunReport(definition, actor.role)) throw forbiddenError(actor.role, definition.requires.find((action) => !can(actor.role, action)) || 'reports.read');
  const name = String(input.name ?? '').trim();
  if (!name) throw templateError('Informe o nome do modelo');
  if (name.length > 80) throw templateError('Nome do modelo com mais de 80 caracteres');
  const scope = input.scope === TEMPLATE_SCOPES.SHARED ? TEMPLATE_SCOPES.SHARED : TEMPLATE_SCOPES.PERSONAL;
  if (scope === TEMPLATE_SCOPES.SHARED && !can(actor.role, 'reports.templates.share')) throw forbiddenError(actor.role, 'reports.templates.share');
  const config = normalizeTemplateConfig(definition, input);
  // Modelo não pode carregar colunas/filtros que o autor não vê.
  const hidden = [...config.columns, ...Object.keys(config.filters), ...config.groups.map((g) => g.columnId)]
    .filter((id) => !canSeeColumn(definition.columns.find((column) => column.id === id), actor.role));
  if (hidden.length) throw forbiddenError(actor.role, 'commercial.values');

  const store = await readStore(empresaId);
  const existingIndex = input.id ? store.templates.findIndex((template) => template.id === input.id) : -1;
  if (existingIndex >= 0) {
    const existing = store.templates[existingIndex];
    const ownsPersonal = existing.scope === TEMPLATE_SCOPES.PERSONAL && existing.ownerUserId === actor.id;
    const canEditShared = existing.scope === TEMPLATE_SCOPES.SHARED && can(actor.role, 'reports.templates.share');
    if (!ownsPersonal && !canEditShared) throw forbiddenError(actor.role, 'reports.templates.share');
  }
  if (store.templates.some((template, index) => index !== existingIndex && template.baseReportId === definition.id && template.scope === scope
    && (scope === TEMPLATE_SCOPES.SHARED || template.ownerUserId === actor.id) && template.name.toLowerCase() === name.toLowerCase())) {
    throw templateError('Já existe um modelo com esse nome neste relatório');
  }
  const previous = existingIndex >= 0 ? store.templates[existingIndex] : null;
  const template = {
    version: TEMPLATE_VERSION,
    id: previous?.id ?? globalThis.crypto.randomUUID(),
    name,
    baseReportId: definition.id,
    baseReportVersion: definition.version,
    scope,
    ownerUserId: previous?.ownerUserId ?? actor.id,
    ownerName: previous?.ownerName ?? actor.nome ?? null,
    ...config,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    updatedBy: actor.id,
  };
  const templates = [...store.templates];
  if (existingIndex >= 0) templates[existingIndex] = template;
  else templates.push(template);
  await writeAppSetting(templatesKey(empresaId), { version: TEMPLATE_VERSION, templates });
  return template;
}

export async function deleteTemplate(templateId, actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const store = await readStore(empresaId);
  const template = store.templates.find((item) => item.id === templateId);
  if (!template) return false;
  const ownsPersonal = template.scope === TEMPLATE_SCOPES.PERSONAL && template.ownerUserId === actor.id;
  const canShared = template.scope === TEMPLATE_SCOPES.SHARED && can(actor.role, 'reports.templates.share');
  if (!ownsPersonal && !canShared) throw forbiddenError(actor.role, 'reports.templates.share');
  await writeAppSetting(templatesKey(empresaId), { version: TEMPLATE_VERSION, templates: store.templates.filter((item) => item.id !== templateId) });
  return true;
}

/**
 * Modelo salvo → seleção para runReport. Revalida contra a definição ATUAL e o papel de quem
 * abre: colunas/filtros removidos ou sem permissão saem com aviso (nunca amplia permissão).
 */
export function templateToRequest(template, role) {
  const definition = getReportDefinition(template.baseReportId);
  if (!definition) throw templateError('Relatório base do modelo não existe mais');
  const warnings = [];
  const known = new Map(definition.columns.map((column) => [column.id, column]));
  const visible = (id) => known.has(id) && canSeeColumn(known.get(id), role);
  const dropped = new Set();
  const keep = (id) => { if (visible(id)) return true; dropped.add(id); return false; };
  const columns = (template.columns || []).filter(keep);
  const filters = Object.fromEntries(Object.entries(template.filters || {}).filter(([id]) => keep(id)));
  const groups = (template.groups || []).filter((group) => keep(group.columnId) && known.get(group.columnId).groupable).slice(0, MAX_GROUP_LEVELS);
  const sort = (template.sort || []).filter((item) => keep(item.columnId));
  const aggregates = (template.aggregates || []).filter((spec) => (!spec.columnId ? spec.op === 'count' : keep(spec.columnId) && known.get(spec.columnId).aggregations.includes(spec.op)));
  if (dropped.size) warnings.push({ code: 'TEMPLATE_COLUMNS_REMOVED', message: `${dropped.size} coluna(s) do modelo não estão disponíveis para você ou deixaram de existir`, columns: [...dropped] });
  if (template.baseReportVersion && template.baseReportVersion > definition.version) warnings.push({ code: 'TEMPLATE_NEWER', message: 'Modelo criado em versão mais nova do relatório' });
  return {
    reportId: definition.id,
    params: { ...(template.period ? { periodo: template.period } : {}), ...(template.params || {}) },
    selection: { columns, filters, groups, sort, aggregates, search: template.search || '' },
    widths: template.widths || {},
    orientation: template.orientation || 'auto',
    warnings,
  };
}

export async function getFavorites(actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const value = await readAppSetting(favoritesKey(empresaId, actor.id));
  return Array.isArray(value) ? value : [];
}

export async function toggleFavorite(reportId, actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  if (!getReportDefinition(reportId)) throw templateError('Relatório inexistente');
  const current = await getFavorites(actor, { empresaId });
  const next = current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId];
  await writeAppSetting(favoritesKey(empresaId, actor.id), next);
  return next;
}

export async function getRecents(actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const value = await readAppSetting(recentsKey(empresaId, actor.id));
  return Array.isArray(value) ? value : [];
}

export async function recordRecent(reportId, actor, { empresaId = 'local', templateId = null, now = new Date().toISOString() } = {}) {
  requireActor(actor);
  const current = await getRecents(actor, { empresaId });
  const next = [{ reportId, templateId, at: now }, ...current.filter((item) => !(item.reportId === reportId && item.templateId === templateId))].slice(0, MAX_RECENTS);
  await writeAppSetting(recentsKey(empresaId, actor.id), next);
  return next;
}
