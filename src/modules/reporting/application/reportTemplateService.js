// Modelos de relatório (Modelo 2 pessoal / Modelo 3 compartilhado) em appSettings — sem store nova.
//   report-templates:<empresa_id>                   → { version: 1, templates: [...] }
//   report-favorites:<empresa_id>:<usuario_id>      → [chave]  (chave = reportId ou "reportId#idAntigo")
//   report-recents:<empresa_id>:<usuario_id>        → [{ reportId, presetId, templateId, at }]
// O modelo guarda SÓ configuração (nunca dados). Ao aplicar, tudo é revalidado contra a
// definição e o papel de quem abre: modelo nunca amplia permissão.
//
// E1 (1.4.0): o modelo guarda também `mode` (RESUMIDO|DETALHADO) e `summarySort`. Relatórios
// consolidados: favoritos, recentes e modelos com id antigo são reescritos (em tempo de execução,
// idempotente, sem esquema) para o id novo + seleção equivalente, com auditoria "relatório consolidado".
// Favorito de relatório antigo vira "idNovo#idAntigo": abre o relatório novo com a visão do antigo.
import { readAppSetting, writeAppSetting } from '../../../storage/indexedDb/repositories/index.js';
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { can, forbiddenError } from '../../auth/domain/permissionService.js';
import { getReportDefinition, resolveReportId } from '../definitions/reportCatalog.js';
import { aliasSelection, getLegacyAlias } from '../definitions/legacyAliases.js';
import { REPORT_MODES, normalizeReportMode } from '../domain/reportDefinition.js';
import { canRunReport, canSeeColumn } from '../domain/reportPermissions.js';
import { MAX_GROUP_LEVELS } from '../domain/groupEngine.js';
import { isFilterActive, serializeFilters } from '../domain/filterEngine.js';
import { PERIOD_PRESETS } from '../domain/reportPeriod.js';

export const TEMPLATE_VERSION = 1;
export const TEMPLATE_SCOPES = Object.freeze({ PERSONAL: 'PERSONAL', SHARED: 'SHARED' });
export const PREFERENCES_MIGRATION_ORIGIN = 'relatorios-consolidacao-1.4.0';
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

// ---------------------------------------------------------------------------
// Chaves de favorito: "reportId" ou "reportId#idAntigo" (visão de um relatório consolidado)
// ---------------------------------------------------------------------------

/** Chave de favorito/recente para um relatório (e, opcionalmente, a visão de um relatório antigo). */
export function favoriteKey(reportId, presetId = null) {
  return presetId ? `${reportId}#${presetId}` : reportId;
}

/** "reportId#idAntigo" → { reportId, presetId }; id antigo solto → { reportId: novo, presetId: antigo }. */
export function parseFavoriteKey(key) {
  const text = String(key ?? '');
  const [reportId, presetId = null] = text.split('#');
  if (!presetId) {
    const alias = getLegacyAlias(reportId);
    if (alias) return { reportId: alias.id, presetId: reportId };
  }
  return { reportId, presetId };
}

function validFavoriteKey(key) {
  const { reportId, presetId } = parseFavoriteKey(key);
  const resolved = resolveReportId(reportId);
  if (!resolved || resolved.aliasId) return false;
  if (!presetId) return true;
  return getLegacyAlias(presetId)?.id === reportId;
}

// ---------------------------------------------------------------------------
// Migração de preferências (relatórios consolidados na 1.4.0)
// ---------------------------------------------------------------------------

/**
 * Modelo salvo num relatório antigo → modelo do relatório novo com a seleção equivalente.
 * O que o modelo guardava prevalece; o que ele não guardava (condições fixas do relatório antigo,
 * colunas/ordem/totais padrão do antigo) vem do alias. Parâmetros extintos viram filtros.
 * Condição fixa numa coluna em que o modelo já tinha filtro próprio: as DUAS valem, como na 1.3.x —
 * o filtro do modelo fica em `filters` e a condição vai para `fixedFilters` (sempre aplicada, exibida
 * com cadeado). Sem conflito, a condição vira filtro comum, como nas visões antigas.
 * @returns {object|null} modelo migrado, ou null se o id não é antigo.
 */
export function migrateLegacyTemplate(template) {
  const alias = getLegacyAlias(template?.baseReportId);
  if (!alias) return null;
  const definition = getReportDefinition(alias.id);
  const preset = aliasSelection(alias, template.params || {});
  const own = template.filters || {};
  const filters = { ...own };
  const fixedFilters = { ...(template.fixedFilters || {}) };
  for (const id of alias.fixed || []) {
    if (!preset.filters[id]) continue;
    if (isFilterActive(own[id])) fixedFilters[id] = preset.filters[id];
    // Pelo código, como a condição do relatório antigo (a tela não troca por rótulo).
    else filters[id] = { ...preset.filters[id], match: 'code' };
  }
  const params = { ...(template.params || {}) };
  for (const param of Object.keys(alias.legacyParams || {})) delete params[param];
  const groups = Array.isArray(template.groups) ? template.groups : preset.groups;
  return {
    ...template,
    baseReportId: alias.id,
    baseReportVersion: definition.version,
    migratedFrom: template.baseReportId,
    // Colunas e ordenação vazias já significavam "as do relatório" (o antigo = o alias).
    columns: template.columns?.length ? template.columns : (preset.columns ?? []),
    filters,
    ...(Object.keys(fixedFilters).length ? { fixedFilters } : {}),
    groups,
    sort: template.sort?.length ? template.sort : (preset.sort ?? []),
    // Totais vazios eram escolha do usuário (modelo sem totais): só herda do alias se o campo não existe.
    aggregates: Array.isArray(template.aggregates) ? template.aggregates : (preset.aggregates ?? []),
    params,
    // O relatório antigo não tinha modo: agrupado abre Resumido, lista abre Detalhado.
    mode: template.mode ?? (groups.length ? REPORT_MODES.RESUMIDO : REPORT_MODES.DETALHADO),
  };
}

const templateNameKey = (template) => [template.baseReportId, template.scope, template.scope === TEMPLATE_SCOPES.SHARED ? '' : template.ownerUserId, String(template.name ?? '').toLowerCase()].join('|');

/**
 * Dois modelos de mesmo nome em relatórios antigos que viraram um só colidiriam no relatório novo
 * (saveTemplate recusa nome repetido): o convertido ganha o nome da visão antiga entre parênteses.
 */
function renameCollisions(templates, migratedIds) {
  const taken = new Set(templates.filter((template) => !migratedIds.has(template.id)).map(templateNameKey));
  return templates.map((template) => {
    if (!migratedIds.has(template.id)) return template;
    let next = template;
    if (taken.has(templateNameKey(next))) {
      const suffix = ` (${getLegacyAlias(template.migratedFrom)?.title ?? template.migratedFrom})`;
      let name = `${String(template.name).slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
      for (let n = 2; taken.has(templateNameKey({ ...template, name })); n += 1) name = `${String(template.name).slice(0, Math.max(1, 80 - suffix.length - 4))}${suffix} ${n}`;
      next = { ...template, name, renamedFrom: template.name };
    }
    taken.add(templateNameKey(next));
    return next;
  });
}

function migrateFavoriteList(list) {
  const out = [];
  const changes = [];
  for (const key of Array.isArray(list) ? list : []) {
    const text = String(key);
    let next = text;
    if (!text.includes('#')) {
      const alias = getLegacyAlias(text);
      if (alias) { next = favoriteKey(alias.id, text); changes.push({ from: text, to: alias.id }); }
    }
    if (!out.includes(next)) out.push(next);
  }
  return { list: out, changes };
}

function migrateRecentList(list) {
  const changes = [];
  const out = (Array.isArray(list) ? list : []).map((item) => {
    const alias = getLegacyAlias(item?.reportId);
    if (!alias) return item;
    changes.push({ from: item.reportId, to: alias.id });
    // Recente de modelo: o modelo convertido já leva a seleção da visão antiga (sem presetId, o
    // mesmo modelo aberto de novo substitui esta entrada em vez de duplicá-la).
    return { ...item, reportId: alias.id, presetId: item.templateId ? null : item.presetId ?? item.reportId };
  });
  return { list: out, changes };
}

async function auditConsolidation(key, changes, actor, kind) {
  if (!changes.length) return;
  const db = await ensureStorageReady();
  const ts = new Date().toISOString();
  for (const change of changes) {
    await db.table('auditoria').add({
      id: globalThis.crypto.randomUUID(),
      entidade: 'appSettings',
      entidade_id: key,
      acao: 'ATUALIZAR',
      origem: PREFERENCES_MIGRATION_ORIGIN,
      resumo: `Relatório consolidado: ${change.from} → ${change.to} (${kind}${change.detail ? ` ${change.detail}` : ''}).`,
      campos_alterados: ['reportId'],
      usuario_id: actor?.id ?? null,
      usuario_nome_snapshot: actor?.nome ?? null,
      created_at: ts,
    });
  }
}

// Uma conversão por empresa+usuário de cada vez: as telas leem favoritos, recentes e modelos em
// paralelo, e cada leitura converte — sem isto, cada item ganhava 2–3 auditorias iguais.
const inFlightMigrations = new Map();

/**
 * Reescreve favoritos/recentes do ator e os modelos da empresa que ainda citam relatórios antigos.
 * Idempotente (sem id antigo → nada grava). Chamadas simultâneas compartilham a mesma execução.
 * Falha de gravação (ex.: banco em somente leitura) não impede a leitura: quem chama recebe as
 * listas já convertidas em memória.
 * @returns {Promise<{ favorites: string[], recents: object[], templates: object[], migrated: number }>}
 */
export function migrateReportPreferences(actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const key = `${empresaId}|${actor.id}`;
  const running = inFlightMigrations.get(key);
  if (running) return running;
  const promise = migrateReportPreferencesOnce(actor, empresaId).finally(() => inFlightMigrations.delete(key));
  inFlightMigrations.set(key, promise);
  return promise;
}

async function migrateReportPreferencesOnce(actor, empresaId) {
  const [storedTemplates, favorites, recents] = await Promise.all([
    readAppSetting(templatesKey(empresaId)),
    readAppSetting(favoritesKey(empresaId, actor.id)),
    readAppSetting(recentsKey(empresaId, actor.id)),
  ]);
  const templateStore = storedTemplates && typeof storedTemplates === 'object' && Array.isArray(storedTemplates.templates)
    ? storedTemplates : { version: TEMPLATE_VERSION, templates: [] };
  const migratedIds = new Set();
  const converted = templateStore.templates.map((template) => {
    const migrated = migrateLegacyTemplate(template);
    if (!migrated) return template;
    migratedIds.add(template.id);
    return migrated;
  });
  const templates = renameCollisions(converted, migratedIds);
  const templateChanges = templates.filter((template) => migratedIds.has(template.id)).map((template) => ({
    from: template.migratedFrom,
    to: template.baseReportId,
    detail: `“${template.renamedFrom ?? template.name}”${template.renamedFrom ? `, agora “${template.name}”` : ''}`,
  }));
  const fav = migrateFavoriteList(favorites);
  const rec = migrateRecentList(recents);
  const migrated = templateChanges.length + fav.changes.length + rec.changes.length;
  if (migrated) {
    try {
      if (templateChanges.length) {
        await writeAppSetting(templatesKey(empresaId), { ...templateStore, templates });
        await auditConsolidation(templatesKey(empresaId), templateChanges, actor, 'modelo salvo');
      }
      if (fav.changes.length) {
        await writeAppSetting(favoritesKey(empresaId, actor.id), fav.list);
        await auditConsolidation(favoritesKey(empresaId, actor.id), fav.changes, actor, 'favorito');
      }
      if (rec.changes.length) {
        await writeAppSetting(recentsKey(empresaId, actor.id), rec.list);
        await auditConsolidation(recentsKey(empresaId, actor.id), rec.changes, actor, 'recente');
      }
    } catch {
      /* somente leitura: segue com a conversão em memória */
    }
  }
  return { favorites: fav.list, recents: rec.list, templates, migrated };
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

/** Visíveis ao ator: os próprios pessoais + todos os compartilhados, de relatórios que ele pode abrir. */
export async function listTemplates(actor, { empresaId = 'local', reportId = null } = {}) {
  requireActor(actor);
  const { templates } = await migrateReportPreferences(actor, { empresaId });
  const wanted = reportId ? getReportDefinition(reportId)?.id ?? reportId : null;
  return templates.filter((template) => {
    if (wanted && template.baseReportId !== wanted) return false;
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
  // Condições fixas herdadas de um modelo convertido na 1.4.0 (não editáveis na tela; regravadas como estão).
  const fixedFilters = serializeFilters(config.fixedFilters || {});
  const groups = (config.groups || []).filter((group) => group?.columnId).map((group) => ({ columnId: String(group.columnId), direction: group.direction === 'desc' ? 'desc' : 'asc' }));
  const aggregates = (config.aggregates || []).map((spec) => ({ ...(spec.id ? { id: String(spec.id) } : {}), op: String(spec.op), ...(spec.columnId ? { columnId: String(spec.columnId) } : {}) }));
  const sort = (config.sort || []).filter((item) => item?.columnId).map((item) => ({ columnId: String(item.columnId), direction: item.direction === 'desc' ? 'desc' : 'asc' }));
  const bad = [
    ...unknown(columns), ...unknown(Object.keys(filters)), ...unknown(Object.keys(fixedFilters)), ...unknown(groups.map((g) => g.columnId)),
    ...unknown(sort.map((s) => s.columnId)), ...unknown(aggregates.filter((a) => a.columnId).map((a) => a.columnId)),
  ];
  if (bad.length) throw templateError(`Modelo com coluna inexistente no relatório: ${[...new Set(bad)].join(', ')}`);
  if (groups.length > MAX_GROUP_LEVELS) throw templateError(`Modelo com mais de ${MAX_GROUP_LEVELS} níveis de agrupamento`);
  for (const group of groups) if (!byId.get(group.columnId).groupable) throw templateError(`Coluna ${group.columnId} não é agrupável`);
  for (const spec of aggregates) {
    if (spec.op === 'count' && !spec.columnId) continue;
    if (!spec.columnId || !byId.get(spec.columnId).aggregations.includes(spec.op)) throw templateError(`Total ${spec.op} inválido para ${spec.columnId}`);
  }
  if (config.mode != null && !Object.values(REPORT_MODES).includes(config.mode)) throw templateError(`Modo inválido (${config.mode})`);
  const mode = config.mode ? normalizeReportMode(config.mode) : null;
  const summarySort = config.summarySort?.key ? { key: String(config.summarySort.key), direction: config.summarySort.direction === 'desc' ? 'desc' : 'asc' } : null;
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
  return {
    columns, filters, ...(Object.keys(fixedFilters).length ? { fixedFilters } : {}), groups, aggregates, sort, mode, summarySort, period, params,
    search: String(config.search ?? ''), widths, orientation: ['portrait', 'landscape', 'auto'].includes(config.orientation) ? config.orientation : 'auto',
  };
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
  const hidden = [...config.columns, ...Object.keys(config.filters), ...Object.keys(config.fixedFilters ?? {}), ...config.groups.map((g) => g.columnId)]
    .filter((id) => !canSeeColumn(definition.columns.find((column) => column.id === id), actor.role));
  if (hidden.length) throw forbiddenError(actor.role, 'commercial.values');

  const { templates: current } = await migrateReportPreferences(actor, { empresaId });
  const store = { version: TEMPLATE_VERSION, templates: current };
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
  const { templates } = await migrateReportPreferences(actor, { empresaId });
  const template = templates.find((item) => item.id === templateId);
  if (!template) return false;
  const ownsPersonal = template.scope === TEMPLATE_SCOPES.PERSONAL && template.ownerUserId === actor.id;
  const canShared = template.scope === TEMPLATE_SCOPES.SHARED && can(actor.role, 'reports.templates.share');
  if (!ownsPersonal && !canShared) throw forbiddenError(actor.role, 'reports.templates.share');
  await writeAppSetting(templatesKey(empresaId), { version: TEMPLATE_VERSION, templates: templates.filter((item) => item.id !== templateId) });
  return true;
}

/**
 * Modelo salvo → seleção para runReport. Revalida contra a definição ATUAL e o papel de quem
 * abre: colunas/filtros removidos ou sem permissão saem com aviso (nunca amplia permissão).
 * Modelo sem `mode` (anterior à 1.4.0) abre no modo padrão da definição (E1 §7).
 */
export function templateToRequest(source, role) {
  const template = migrateLegacyTemplate(source) ?? source;
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
    selection: {
      columns, filters, groups, sort, aggregates, search: template.search || '',
      // Condição fixa do relatório antigo (modelo convertido): nunca some, nem por perfil.
      fixedFilters: { ...(template.fixedFilters || {}) },
      mode: normalizeReportMode(template.mode, definition.defaultMode),
      summarySort: template.summarySort ?? null,
    },
    widths: template.widths || {},
    orientation: template.orientation || 'auto',
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Favoritos e recentes
// ---------------------------------------------------------------------------

export async function getFavorites(actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const { favorites } = await migrateReportPreferences(actor, { empresaId });
  return favorites.filter(validFavoriteKey);
}

/** Marca/desmarca. `key` = reportId, "reportId#idAntigo" ou um id antigo (vira "novo#antigo"). */
export async function toggleFavorite(key, actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const { reportId, presetId } = parseFavoriteKey(key);
  const normalized = favoriteKey(reportId, presetId);
  if (!validFavoriteKey(normalized)) throw templateError('Relatório inexistente');
  const current = await getFavorites(actor, { empresaId });
  const next = current.includes(normalized) ? current.filter((id) => id !== normalized) : [...current, normalized];
  await writeAppSetting(favoritesKey(empresaId, actor.id), next);
  return next;
}

export async function getRecents(actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const { recents } = await migrateReportPreferences(actor, { empresaId });
  return recents;
}

export async function recordRecent(reportId, actor, { empresaId = 'local', templateId = null, presetId = null, now = new Date().toISOString() } = {}) {
  requireActor(actor);
  const parsed = parseFavoriteKey(presetId ? favoriteKey(reportId, presetId) : reportId);
  const current = await getRecents(actor, { empresaId });
  const entry = { reportId: parsed.reportId, presetId: parsed.presetId ?? null, templateId, at: now };
  const same = (item) => item.reportId === entry.reportId && (item.presetId ?? null) === entry.presetId && (item.templateId ?? null) === (templateId ?? null);
  const next = [entry, ...current.filter((item) => !same(item))].slice(0, MAX_RECENTS);
  await writeAppSetting(recentsKey(empresaId, actor.id), next);
  return next;
}
