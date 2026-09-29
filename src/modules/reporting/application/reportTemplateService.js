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
//
// E1B (1.4.0): último estado do relatório por usuário (a tela volta como a pessoa deixou):
//   report-view-state:<empresa_id>:<usuario_id>     → { version: 1, reports: { [reportId]: config } }
// config tem o MESMO formato validado de um modelo (período, filtros, agrupamento, modo, ordem,
// orientação…) + showEmptyColumns; nunca dados. Ao ler, passa pela mesma revalidação do modelo
// (templateToRequest): estado antigo com coluna que sumiu ou que o papel não vê é filtrado, sem erro.
//
// E1D (1.4.0): os tipos da E1B que saíram de Pesagens ("Resumo por Sessão", "Por lote", "Por data",
// "Analítico por animal"…) — modelos e último estado sem `view` que usavam um deles abrem no tipo novo mais
// próximo (definitions/legacyViews.js): em memória ao abrir e gravado uma vez, com auditoria própria
// ("relatorios-tipos-e1d"), no mesmo passo idempotente da consolidação da E1.
import { readAppSetting, writeAppSetting } from '../../../storage/indexedDb/repositories/index.js';
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { can, forbiddenError } from '../../auth/domain/permissionService.js';
import { getReportDefinition, resolveReportId } from '../definitions/reportCatalog.js';
import { aliasSelection, getLegacyAlias } from '../definitions/legacyAliases.js';
import { convertLegacyViewConfig } from '../definitions/legacyViews.js';
import { REPORT_MODES, normalizeReportMode } from '../domain/reportDefinition.js';
import { canRunReport, canSeeColumn } from '../domain/reportPermissions.js';
import { MAX_GROUP_LEVELS } from '../domain/groupEngine.js';
import { isFilterActive, serializeFilters } from '../domain/filterEngine.js';
import { PERIOD_PRESETS } from '../domain/reportPeriod.js';
import { getReportView } from '../domain/reportViews.js';
import { isKnownSortChoice } from '../domain/sortChoices.js';

export const TEMPLATE_VERSION = 1;
export const TEMPLATE_SCOPES = Object.freeze({ PERSONAL: 'PERSONAL', SHARED: 'SHARED' });
export const PREFERENCES_MIGRATION_ORIGIN = 'relatorios-consolidacao-1.4.0';
export const VIEW_TYPES_MIGRATION_ORIGIN = 'relatorios-tipos-e1d';
const MAX_RECENTS = 12;

const templatesKey = (empresaId) => `report-templates:${empresaId}`;
const favoritesKey = (empresaId, userId) => `report-favorites:${empresaId}:${userId}`;
const recentsKey = (empresaId, userId) => `report-recents:${empresaId}:${userId}`;
const viewStateKey = (empresaId, userId) => `report-view-state:${empresaId}:${userId}`;
export const VIEW_STATE_VERSION = 1;

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

// Consolidação da E1 (padrão) ou conversão de tipo da E1D (origem, título e campos próprios).
const CONSOLIDATION_AUDIT = Object.freeze({ origin: PREFERENCES_MIGRATION_ORIGIN, title: 'Relatório consolidado', fields: ['reportId'] });
const VIEW_TYPES_AUDIT = Object.freeze({ origin: VIEW_TYPES_MIGRATION_ORIGIN, title: 'Tipo de relatório convertido', fields: ['view', 'groups', 'mode', 'columns', 'aggregates', 'sort', 'sortChoice'] });

async function auditConsolidation(key, changes, actor, kind, { origin, title, fields } = CONSOLIDATION_AUDIT) {
  if (!changes.length) return;
  const db = await ensureStorageReady();
  const ts = new Date().toISOString();
  for (const change of changes) {
    await db.table('auditoria').add({
      id: globalThis.crypto.randomUUID(),
      entidade: 'appSettings',
      entidade_id: key,
      acao: 'ATUALIZAR',
      origem: origin,
      resumo: `${title}: ${change.from} → ${change.to} (${kind}${change.detail ? ` ${change.detail}` : ''}).`,
      campos_alterados: [...fields],
      usuario_id: actor?.id ?? null,
      usuario_nome_snapshot: actor?.nome ?? null,
      created_at: ts,
    });
  }
}

/** E1D: tipo da E1B que saiu → tipo novo, num modelo (null = nada a converter). */
function convertTemplateType(template) {
  const definition = getReportDefinition(template?.baseReportId);
  return definition ? convertLegacyViewConfig(definition, template) : null;
}

/** E1D: último estado do ator com tipo da E1B → tipo novo (por relatório). */
function convertViewStateTypes(stored) {
  const reports = stored && typeof stored === 'object' && stored.reports && typeof stored.reports === 'object' ? stored.reports : null;
  if (!reports) return { value: stored, changes: [] };
  const changes = [];
  const next = { ...reports };
  for (const [reportId, state] of Object.entries(reports)) {
    const definition = getReportDefinition(reportId);
    const converted = definition && state && typeof state === 'object' ? convertLegacyViewConfig(definition, state) : null;
    if (!converted) continue;
    next[reportId] = converted.config;
    changes.push({ from: `${definition.title} › ${converted.from.label}`, to: converted.to.label, detail: '' });
  }
  return { value: changes.length ? { ...stored, reports: next } : stored, changes };
}

// Uma conversão por empresa+usuário de cada vez: as telas leem favoritos, recentes e modelos em
// paralelo, e cada leitura converte — sem isto, cada item ganhava 2–3 auditorias iguais.
const inFlightMigrations = new Map();

/**
 * Reescreve favoritos/recentes do ator e os modelos da empresa que ainda citam relatórios antigos (E1) e
 * converte o tipo da E1B que saiu (E1D) nos modelos da empresa e no último estado do ator.
 * Idempotente (sem id antigo nem tipo antigo → nada grava). Chamadas simultâneas compartilham a mesma execução.
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
  const [storedTemplates, favorites, recents, storedViewState] = await Promise.all([
    readAppSetting(templatesKey(empresaId)),
    readAppSetting(favoritesKey(empresaId, actor.id)),
    readAppSetting(recentsKey(empresaId, actor.id)),
    readAppSetting(viewStateKey(empresaId, actor.id)),
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
  const consolidated = renameCollisions(converted, migratedIds);
  const templateChanges = consolidated.filter((template) => migratedIds.has(template.id)).map((template) => ({
    from: template.migratedFrom,
    to: template.baseReportId,
    detail: `“${template.renamedFrom ?? template.name}”${template.renamedFrom ? `, agora “${template.name}”` : ''}`,
  }));
  // E1D: tipo da E1B que saiu → tipo novo mais próximo (modelos da empresa e último estado do ator). Modelo
  // recém-consolidado da E1 (migratedFrom) não entra: abre a seleção do relatório antigo, como os links.
  const typeChanges = [];
  const templates = consolidated.map((template) => {
    const typed = convertTemplateType(template);
    if (!typed) return template;
    typeChanges.push({ from: `${getReportDefinition(template.baseReportId).title} › ${typed.from.label}`, to: typed.to.label, detail: `“${template.name}”` });
    return typed.config;
  });
  const viewState = convertViewStateTypes(storedViewState);
  const fav = migrateFavoriteList(favorites);
  const rec = migrateRecentList(recents);
  const migrated = templateChanges.length + typeChanges.length + viewState.changes.length + fav.changes.length + rec.changes.length;
  if (migrated) {
    try {
      if (templateChanges.length || typeChanges.length) {
        await writeAppSetting(templatesKey(empresaId), { ...templateStore, templates });
        await auditConsolidation(templatesKey(empresaId), templateChanges, actor, 'modelo salvo');
        await auditConsolidation(templatesKey(empresaId), typeChanges, actor, 'modelo salvo', VIEW_TYPES_AUDIT);
      }
      if (viewState.changes.length) {
        await writeAppSetting(viewStateKey(empresaId, actor.id), viewState.value);
        await auditConsolidation(viewStateKey(empresaId, actor.id), viewState.changes, actor, 'último estado', VIEW_TYPES_AUDIT);
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
  // E1D: tipo explícito, eixos da matriz e opção fixa de "Ordenar por" (contrato §2). Ausentes = como antes.
  const typed = normalizeTypedConfig(definition, config);
  return {
    columns, filters, ...(Object.keys(fixedFilters).length ? { fixedFilters } : {}), groups, aggregates, sort, mode, summarySort, period, params,
    search: String(config.search ?? ''), widths, orientation: ['portrait', 'landscape', 'auto'].includes(config.orientation) ? config.orientation : 'auto',
    ...typed,
  };
}

/**
 * view/matrix/sortChoice de um modelo ou do último estado (E1D). Tipo desconhecido, eixos desconhecidos ou
 * iguais e opção de ordenação desconhecida são erro ao salvar (ao abrir, templateToRequest descarta com aviso).
 * @returns {{ view?: string|null, matrix?: { eixoY, eixoX }|null, sortChoice?: string|null }}
 */
export function normalizeTypedConfig(definition, config = {}) {
  const out = {};
  if (config.view !== undefined) {
    const view = config.view === null || config.view === '' ? null : getReportView(definition, String(config.view));
    if (config.view !== null && config.view !== '' && (!view || view.generated)) throw templateError(`Tipo de relatório inexistente (${config.view})`);
    out.view = view ? view.id : null;
  }
  if (config.matrix !== undefined) {
    if (config.matrix === null) out.matrix = null;
    else {
      const axes = (definition.matrixAxes ?? []).map((axis) => axis.id);
      const eixoY = String(config.matrix?.eixoY ?? '');
      const eixoX = String(config.matrix?.eixoX ?? '');
      if (!axes.includes(eixoY) || !axes.includes(eixoX)) throw templateError(`Eixo da matriz inexistente (${eixoY} × ${eixoX})`);
      if (eixoY === eixoX) throw templateError('Linhas e Colunas da matriz não podem ser o mesmo eixo');
      out.matrix = { eixoY, eixoX };
    }
  }
  if (config.sortChoice !== undefined) {
    if (config.sortChoice !== null && config.sortChoice !== '' && !isKnownSortChoice(definition, String(config.sortChoice))) throw templateError(`Ordenação inexistente (${config.sortChoice})`);
    out.sortChoice = config.sortChoice ? String(config.sortChoice) : null;
  }
  return out;
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
 * Modelo sem `mode` (anterior à 1.4.0) abre Resumido se tem agrupamento, Detalhado se não tem
 * (E1 §7 ajustada pela responsável em 25/09/2026).
 */
export function templateToRequest(source, role) {
  const consolidated = migrateLegacyTemplate(source) ?? source;
  const definition = getReportDefinition(consolidated.baseReportId);
  if (!definition) throw templateError('Relatório base do modelo não existe mais');
  // E1D: tipo da E1B que saiu → tipo novo mais próximo (em memória; gravar e auditar é com
  // migrateReportPreferences). Relatório de tipos fixos sem tipo e sem conversão → "Personalizado"
  // explícito: nunca vira um tipo só porque a estrutura coincide.
  const conversion = convertLegacyViewConfig(definition, consolidated);
  const template = conversion ? conversion.config : (definition.defaultView && consolidated.view === undefined ? { ...consolidated, view: null } : consolidated);
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
  // E1D: tipo/eixos/ordenação guardados; o que deixou de existir sai com aviso (nunca erro ao abrir).
  let typed = {};
  try {
    typed = normalizeTypedConfig(definition, { view: template.view, matrix: template.matrix, sortChoice: template.sortChoice });
  } catch (error) {
    warnings.push({ code: 'TEMPLATE_TYPE_REMOVED', message: `${error.message}: o modelo abre sem ele` });
  }
  return {
    reportId: definition.id,
    params: { ...(template.period ? { periodo: template.period } : {}), ...(template.params || {}) },
    selection: {
      columns, filters, groups, sort, aggregates, search: template.search || '',
      // Condição fixa do relatório antigo (modelo convertido): nunca some, nem por perfil.
      fixedFilters: { ...(template.fixedFilters || {}) },
      // Modelo de antes da 1.4.0 (sem modo) — resposta 3 da responsável ao REPORT da E1: abre Resumido
      // só se tiver agrupamento; salvo como lista abre Detalhado (nunca um Resumido só com o Total geral).
      mode: template.mode ? normalizeReportMode(template.mode, definition.defaultMode) : (groups.length ? REPORT_MODES.RESUMIDO : REPORT_MODES.DETALHADO),
      summarySort: template.summarySort ?? null,
      // E1D (ausentes em modelos anteriores: a tela identifica o tipo pela estrutura — reportViews.resolveViewId).
      ...(typed.view !== undefined ? { view: typed.view } : {}),
      ...(typed.matrix !== undefined ? { matrix: typed.matrix } : {}),
      ...(typed.sortChoice !== undefined ? { sortChoice: typed.sortChoice } : {}),
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

// ---------------------------------------------------------------------------
// Último estado do relatório por usuário (E1B)
// ---------------------------------------------------------------------------

/**
 * Grava como a pessoa deixou o relatório (período, tipo/agrupamento, filtros, modo, ordem, orientação,
 * colunas vazias). Validado como um modelo (ids desconhecidos são erro); sem auditoria, como favoritos.
 */
export async function saveReportViewState(reportId, config, actor, { empresaId = 'local', now = new Date().toISOString() } = {}) {
  requireActor(actor);
  const definition = getReportDefinition(reportId);
  if (!definition || resolveReportId(reportId)?.aliasId) throw templateError('Relatório inexistente');
  if (!canRunReport(definition, actor.role)) throw forbiddenError(actor.role, definition.requires.find((action) => !can(actor.role, action)) || 'reports.read');
  // Condição fixa (de modelo convertido ou visão antiga) é do modelo/visão, nunca do último estado: se
  // entrasse aqui, o relatório comum reabriria travado numa condição que nenhum controle tira.
  const { fixedFilters: _fixed, ...normalized } = normalizeTemplateConfig(definition, { ...config, fixedFilters: {} });
  const hidden = [...normalized.columns, ...Object.keys(normalized.filters), ...normalized.groups.map((group) => group.columnId)]
    .filter((id) => !canSeeColumn(definition.columns.find((column) => column.id === id), actor.role));
  if (hidden.length) throw forbiddenError(actor.role, 'commercial.values');
  const stored = await readAppSetting(viewStateKey(empresaId, actor.id));
  const reports = stored && typeof stored === 'object' && stored.reports && typeof stored.reports === 'object' ? { ...stored.reports } : {};
  reports[definition.id] = {
    ...normalized,
    baseReportId: definition.id,
    baseReportVersion: definition.version,
    showEmptyColumns: config?.showEmptyColumns === true,
    updatedAt: now,
  };
  await writeAppSetting(viewStateKey(empresaId, actor.id), { version: VIEW_STATE_VERSION, reports });
  return reports[definition.id];
}

/**
 * Último estado → pedido pronto para a tela ({ params, selection, orientation, showEmptyColumns,
 * warnings }), revalidado contra a definição atual e o papel (nunca amplia permissão). Sem estado, ou
 * estado ilegível, devolve null (a tela abre no padrão do relatório).
 */
export async function getReportViewState(reportId, actor, { empresaId = 'local' } = {}) {
  requireActor(actor);
  const definition = getReportDefinition(reportId);
  if (!definition || !canRunReport(definition, actor.role)) return null;
  // E1D: converte (e audita) o tipo da E1B do último estado antes de ler — a tela abre já no tipo novo e
  // a auditoria não depende de qual tela chegou primeiro. Falha aqui não impede a leitura (templateToRequest
  // converte em memória do mesmo jeito).
  await migrateReportPreferences(actor, { empresaId }).catch(() => null);
  const stored = await readAppSetting(viewStateKey(empresaId, actor.id));
  const state = stored?.reports?.[definition.id];
  if (!state || typeof state !== 'object') return null;
  try {
    // Estado gravado por versão anterior pode trazer fixedFilters: descartado (ver saveReportViewState).
    const { fixedFilters: _fixed, ...clean } = state;
    const request = templateToRequest({ ...clean, baseReportId: definition.id }, actor.role);
    const { fixedFilters: _requestFixed, ...selection } = request.selection;
    return { ...request, selection, showEmptyColumns: state.showEmptyColumns === true, updatedAt: state.updatedAt ?? null };
  } catch {
    return null;
  }
}
