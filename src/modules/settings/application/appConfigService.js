// Configurações da empresa em QUATRO chaves versionadas de appSettings (doc 18 do programa,
// ADR-025 rendimento com origem, ADR-033 documento na venda, ADR-045 política de sessão):
//   auth-policy:<empresa>            { versao, inactivity_lock_minutes, failed_attempt_limit, lock_minutes }
//   operational-defaults:<empresa>   { versao, marca/raca/propriedade/apartacao padrão, intervalo, rendimento }
//   sales-policy:<empresa>           { versao, exigir_documento_venda }
//   weight-warning-policy:<empresa>  { versao, faixa_peso_min/max, limite_gmd_alerta, variacao_max_percent }
// getAppConfig() devolve a visão MESCLADA (chaves planas) e updateAppConfig() distribui o
// patch pelos grupos. A chave antiga 'config:<empresa>' (revisão 1) é migrada uma vez e removida.
// Permissões (ADR-042): settings.auth (ADMIN) para auth-policy; settings.operational
// (ADMIN e GESTOR) para os demais grupos.
import storage from '../../../storage/storageAdapter.js';
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { authorize, roleOf } from '../../auth/domain/permissionService.js';
import { actorFields } from '../../auth/application/auditContext.js';

export const APP_CONFIG_VERSION = 1;
export const DEFAULT_EMPRESA_ID = 'local';
export const RENDIMENTO_ORIGENS = Object.freeze(['INFORMADO', 'PADRAO_EMPRESA', 'PADRAO_PARCEIRO']);

export const AUTH_POLICY_DEFAULTS = Object.freeze({
  inactivity_lock_minutes: 30, // 0 desliga (ADR-045)
  failed_attempt_limit: 5,
  lock_minutes: 0.5,
});

export const OPERATIONAL_DEFAULTS = Object.freeze({
  marca_padrao_id: null,
  raca_padrao_id: null,
  propriedade_padrao_id: null,
  apartacao_padrao_id: null,
  intervalo_pesagem_dias: 30,
  // Sem configuração explícita não há rendimento (decisão §8 do programa reporting): arrobas ficam
  // null ("—") até a empresa informar o padrão. Nunca um 50 % silencioso (ADR-025).
  rendimento_padrao: null,
  rendimento_padrao_origem: 'PADRAO_EMPRESA',
});

export const SALES_POLICY_DEFAULTS = Object.freeze({
  exigir_documento_venda: false,
});

export const WEIGHT_WARNING_POLICY_DEFAULTS = Object.freeze({
  faixa_peso_min: 20,
  faixa_peso_max: 1500,
  limite_gmd_alerta: 5,
  variacao_max_percent: 35,
});

// Grupo → { prefixo da chave, defaults, permissão exigida para gravar }.
export const CONFIG_GROUPS = Object.freeze({
  auth: Object.freeze({ prefix: 'auth-policy', defaults: AUTH_POLICY_DEFAULTS, permission: 'settings.auth' }),
  operational: Object.freeze({ prefix: 'operational-defaults', defaults: OPERATIONAL_DEFAULTS, permission: 'settings.operational' }),
  sales: Object.freeze({ prefix: 'sales-policy', defaults: SALES_POLICY_DEFAULTS, permission: 'settings.operational' }),
  weightWarning: Object.freeze({ prefix: 'weight-warning-policy', defaults: WEIGHT_WARNING_POLICY_DEFAULTS, permission: 'settings.operational' }),
});
const GROUP_NAMES = Object.freeze(Object.keys(CONFIG_GROUPS));

// Visão plana (mesmas chaves da revisão 1, menos `bloqueio_inatividade_minutos`, que virou
// `inactivity_lock_minutes` em auth-policy).
export const APP_CONFIG_DEFAULTS = Object.freeze({
  ...OPERATIONAL_DEFAULTS,
  ...WEIGHT_WARNING_POLICY_DEFAULTS,
  ...SALES_POLICY_DEFAULTS,
  ...AUTH_POLICY_DEFAULTS,
});
const CONFIG_KEYS = Object.freeze(Object.keys(APP_CONFIG_DEFAULTS));

// campo plano → grupo.
const GROUP_OF = Object.freeze(Object.fromEntries(
  GROUP_NAMES.flatMap((group) => Object.keys(CONFIG_GROUPS[group].defaults).map((key) => [key, group])),
));

// Campo da revisão 1 que mudou de nome (migração de 'config:<empresa>').
const LEGACY_ALIASES = Object.freeze({ bloqueio_inatividade_minutos: 'inactivity_lock_minutes' });

export function groupKey(group, empresaId = DEFAULT_EMPRESA_ID) {
  const def = CONFIG_GROUPS[group];
  if (!def) throw new Error(`Grupo de configuração desconhecido: ${group}`);
  return `${def.prefix}:${empresaId || DEFAULT_EMPRESA_ID}`;
}

/** Chave da revisão 1 (só para migração). */
export function configKey(empresaId = DEFAULT_EMPRESA_ID) {
  return `config:${empresaId || DEFAULT_EMPRESA_ID}`;
}

export function configError(message, field) {
  const error = new Error(message);
  error.code = 'CONFIG_INVALID';
  error.field = field;
  return error;
}

function idOrNull(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw configError(`Campo ${field} deve ser um id ou nulo.`, field);
  return value;
}

function integerAtLeast(value, min, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw configError(`Campo ${field} deve ser um inteiro maior ou igual a ${min}.`, field);
  return number;
}

function positiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw configError(`Campo ${field} deve ser um número maior que zero.`, field);
  return number;
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') throw configError(`Campo ${field} deve ser verdadeiro ou falso.`, field);
  return value;
}

// Validação por grupo (defaults + persistido + patch já mesclados).
const NORMALIZERS = {
  auth(raw) {
    return {
      inactivity_lock_minutes: integerAtLeast(raw.inactivity_lock_minutes, 0, 'inactivity_lock_minutes'),
      failed_attempt_limit: integerAtLeast(raw.failed_attempt_limit, 1, 'failed_attempt_limit'),
      lock_minutes: positiveNumber(raw.lock_minutes, 'lock_minutes'),
    };
  },
  operational(raw) {
    const config = {
      marca_padrao_id: idOrNull(raw.marca_padrao_id, 'marca_padrao_id'),
      raca_padrao_id: idOrNull(raw.raca_padrao_id, 'raca_padrao_id'),
      propriedade_padrao_id: idOrNull(raw.propriedade_padrao_id, 'propriedade_padrao_id'),
      apartacao_padrao_id: idOrNull(raw.apartacao_padrao_id, 'apartacao_padrao_id'),
      intervalo_pesagem_dias: integerAtLeast(raw.intervalo_pesagem_dias, 1, 'intervalo_pesagem_dias'),
      rendimento_padrao: raw.rendimento_padrao === null || raw.rendimento_padrao === undefined || raw.rendimento_padrao === '' ? null : positiveNumber(raw.rendimento_padrao, 'rendimento_padrao'),
      rendimento_padrao_origem: raw.rendimento_padrao_origem,
    };
    if (config.rendimento_padrao !== null && config.rendimento_padrao > 100) throw configError('rendimento_padrao deve estar entre 0 e 100.', 'rendimento_padrao');
    if (!RENDIMENTO_ORIGENS.includes(config.rendimento_padrao_origem)) throw configError('rendimento_padrao_origem inválida.', 'rendimento_padrao_origem');
    return config;
  },
  sales(raw) {
    return { exigir_documento_venda: booleanValue(raw.exigir_documento_venda, 'exigir_documento_venda') };
  },
  weightWarning(raw) {
    const config = {
      faixa_peso_min: positiveNumber(raw.faixa_peso_min, 'faixa_peso_min'),
      faixa_peso_max: positiveNumber(raw.faixa_peso_max, 'faixa_peso_max'),
      limite_gmd_alerta: positiveNumber(raw.limite_gmd_alerta, 'limite_gmd_alerta'),
      variacao_max_percent: positiveNumber(raw.variacao_max_percent, 'variacao_max_percent'),
    };
    if (config.faixa_peso_min >= config.faixa_peso_max) throw configError('faixa_peso_min deve ser menor que faixa_peso_max.', 'faixa_peso_min');
    return config;
  },
};

function pickGroup(group, source = {}) {
  const out = {};
  for (const key of Object.keys(CONFIG_GROUPS[group].defaults)) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

async function readKey(key) {
  const stored = await storage.settings.get(key);
  return stored && typeof stored === 'object' ? stored : null;
}

/**
 * Migra a chave 'config:<empresa>' (rev. 1) para as quatro chaves — uma única vez — e a
 * remove. Grupos já gravados na rev. 2 prevalecem. Sob bloqueio de migração (escrita
 * proibida) devolve os valores legados só em memória, sem gravar.
 */
export async function migrateLegacyConfig(empresaId = DEFAULT_EMPRESA_ID) {
  const legacy = await readKey(configKey(empresaId));
  if (!legacy) return null;
  const flat = { ...legacy };
  for (const [oldKey, newKey] of Object.entries(LEGACY_ALIASES)) {
    if (flat[oldKey] !== undefined && flat[newKey] === undefined) flat[newKey] = flat[oldKey];
    delete flat[oldKey];
  }
  const migrated = {};
  try {
    for (const group of GROUP_NAMES) {
      const key = groupKey(group, empresaId);
      if (await readKey(key)) continue;
      const values = pickGroup(group, flat);
      if (!Object.keys(values).length) continue;
      migrated[group] = { versao: APP_CONFIG_VERSION, ...values };
      await storage.settings.set(key, migrated[group]);
    }
    const db = await ensureStorageReady();
    await db.table('appSettings').delete(configKey(empresaId));
  } catch (err) {
    if (err?.code !== 'MIGRATION_BLOCKED') throw err;
  }
  return flat;
}

// Grupo efetivo: defaults + persistido (+ legado em memória quando a migração não pôde gravar).
async function readGroup(group, empresaId, legacyFlat = null) {
  const def = CONFIG_GROUPS[group];
  const stored = (await readKey(groupKey(group, empresaId))) || (legacyFlat ? pickGroup(group, legacyFlat) : {});
  const merged = { ...def.defaults, ...pickGroup(group, stored) };
  try {
    return { versao: APP_CONFIG_VERSION, ...NORMALIZERS[group](merged) };
  } catch {
    return { versao: APP_CONFIG_VERSION, ...def.defaults }; // valor persistido inválido cai no padrão
  }
}

async function readAllGroups(empresaId) {
  const legacyFlat = await migrateLegacyConfig(empresaId);
  const entries = await Promise.all(GROUP_NAMES.map(async (group) => [group, await readGroup(group, empresaId, legacyFlat)]));
  return Object.fromEntries(entries);
}

function flatten(groups) {
  const flat = { versao: APP_CONFIG_VERSION };
  for (const group of GROUP_NAMES) {
    const { versao: _versao, ...values } = groups[group];
    Object.assign(flat, values);
  }
  return flat;
}

/** Visão mesclada (chaves planas) dos quatro grupos; defaults cobrem o que faltar. */
export async function getAppConfig(empresaId = DEFAULT_EMPRESA_ID) {
  return flatten(await readAllGroups(empresaId));
}

export async function getAuthPolicy(empresaId = DEFAULT_EMPRESA_ID) {
  await migrateLegacyConfig(empresaId);
  return readGroup('auth', empresaId);
}

export async function getOperationalDefaults(empresaId = DEFAULT_EMPRESA_ID) {
  await migrateLegacyConfig(empresaId);
  return readGroup('operational', empresaId);
}

export async function getSalesPolicy(empresaId = DEFAULT_EMPRESA_ID) {
  await migrateLegacyConfig(empresaId);
  return readGroup('sales', empresaId);
}

export async function getWeightWarningPolicy(empresaId = DEFAULT_EMPRESA_ID) {
  await migrateLegacyConfig(empresaId);
  return readGroup('weightWarning', empresaId);
}

/** Atalho usado pela sessão: minutos de inatividade (0 desliga). */
export async function getInactivityMinutes(empresaId = DEFAULT_EMPRESA_ID) {
  return (await getAuthPolicy(empresaId)).inactivity_lock_minutes;
}

/**
 * Patch parcial distribuído pelos grupos. Cada grupo tocado exige a sua permissão
 * (settings.auth para auth-policy; settings.operational para os demais) — a autorização
 * acontece ANTES de qualquer gravação. Chaves desconhecidas são recusadas. Devolve a
 * visão mesclada atualizada.
 */
export async function updateAppConfig(actor, patch = {}, empresaId = DEFAULT_EMPRESA_ID) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw configError('Patch de configuração inválido.');
  const keys = Object.keys(patch);
  const unknown = keys.filter((key) => !CONFIG_KEYS.includes(key));
  if (unknown.length) throw configError(`Campos de configuração desconhecidos: ${unknown.join(', ')}.`, unknown[0]);
  const touched = [...new Set(keys.map((key) => GROUP_OF[key]))];
  const role = roleOf(actor);
  // Sem grupo tocado ainda exige a permissão mínima (ninguém sem papel "salva" configurações).
  for (const group of touched.length ? touched : ['operational']) authorize(role, CONFIG_GROUPS[group].permission);

  const current = await readAllGroups(empresaId);
  const next = { ...current };
  const changedByGroup = {};
  for (const group of touched) {
    const { versao: _versao, ...values } = current[group];
    const normalized = NORMALIZERS[group]({ ...values, ...pickGroup(group, patch) });
    const changed = Object.keys(normalized).filter((key) => normalized[key] !== values[key]);
    next[group] = { versao: APP_CONFIG_VERSION, ...normalized };
    if (changed.length) changedByGroup[group] = changed;
  }

  for (const group of Object.keys(changedByGroup)) {
    await storage.settings.set(groupKey(group, empresaId), next[group]);
  }
  if (Object.keys(changedByGroup).length) {
    const db = await ensureStorageReady();
    const ts = new Date().toISOString();
    for (const [group, changed] of Object.entries(changedByGroup)) {
      await db.table('auditoria').add({
        id: crypto.randomUUID(),
        entidade: 'appSettings',
        entidade_id: groupKey(group, empresaId),
        acao: 'ATUALIZAR',
        resumo: `Configurações (${CONFIG_GROUPS[group].prefix}) alteradas: ${changed.join(', ')}.`,
        campos_alterados: changed,
        ...actorFields(actor),
        created_at: ts,
      });
    }
  }
  return flatten(next);
}
