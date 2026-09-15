// Configurações reais da empresa (ADR-018 permite configuração em appSettings; ADR-025 exige
// rendimento com origem explícita; ADR-033 documento em venda; ADR-035 inatividade).
// Chave: appSettings['config:<empresa>'] = { versao: 1, ...campos }.
import storage from '../../../storage/storageAdapter.js';
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { assertCan } from '../../auth/domain/accessPolicy.js';
import { actorFields } from '../../auth/application/auditContext.js';

export const APP_CONFIG_VERSION = 1;
export const DEFAULT_EMPRESA_ID = 'local';
export const RENDIMENTO_ORIGENS = Object.freeze(['INFORMADO', 'PADRAO_EMPRESA', 'PADRAO_PARCEIRO']);

export const APP_CONFIG_DEFAULTS = Object.freeze({
  marca_padrao_id: null,
  raca_padrao_id: null,
  propriedade_padrao_id: null,
  apartacao_padrao_id: null,
  intervalo_pesagem_dias: 30,
  faixa_peso_min: 20,
  faixa_peso_max: 1500,
  limite_gmd_alerta: 5,
  exigir_documento_venda: false,
  rendimento_padrao: 50,
  rendimento_padrao_origem: 'PADRAO_EMPRESA', // nunca um 50 % silencioso (ADR-025)
  bloqueio_inatividade_minutos: 60,
});

const CONFIG_KEYS = Object.freeze(Object.keys(APP_CONFIG_DEFAULTS));

export function configKey(empresaId = DEFAULT_EMPRESA_ID) {
  return `config:${empresaId || DEFAULT_EMPRESA_ID}`;
}

function configError(message, field) {
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

// Valida e normaliza a configuração completa (defaults + persistido + patch).
function normalizeConfig(raw) {
  const config = {
    marca_padrao_id: idOrNull(raw.marca_padrao_id, 'marca_padrao_id'),
    raca_padrao_id: idOrNull(raw.raca_padrao_id, 'raca_padrao_id'),
    propriedade_padrao_id: idOrNull(raw.propriedade_padrao_id, 'propriedade_padrao_id'),
    apartacao_padrao_id: idOrNull(raw.apartacao_padrao_id, 'apartacao_padrao_id'),
    intervalo_pesagem_dias: integerAtLeast(raw.intervalo_pesagem_dias, 1, 'intervalo_pesagem_dias'),
    faixa_peso_min: positiveNumber(raw.faixa_peso_min, 'faixa_peso_min'),
    faixa_peso_max: positiveNumber(raw.faixa_peso_max, 'faixa_peso_max'),
    limite_gmd_alerta: positiveNumber(raw.limite_gmd_alerta, 'limite_gmd_alerta'),
    exigir_documento_venda: raw.exigir_documento_venda,
    rendimento_padrao: positiveNumber(raw.rendimento_padrao, 'rendimento_padrao'),
    rendimento_padrao_origem: raw.rendimento_padrao_origem,
    bloqueio_inatividade_minutos: integerAtLeast(raw.bloqueio_inatividade_minutos, 0, 'bloqueio_inatividade_minutos'),
  };
  if (config.faixa_peso_min >= config.faixa_peso_max) throw configError('faixa_peso_min deve ser menor que faixa_peso_max.', 'faixa_peso_min');
  if (typeof config.exigir_documento_venda !== 'boolean') throw configError('exigir_documento_venda deve ser verdadeiro ou falso.', 'exigir_documento_venda');
  if (config.rendimento_padrao > 100) throw configError('rendimento_padrao deve estar entre 0 e 100.', 'rendimento_padrao');
  if (!RENDIMENTO_ORIGENS.includes(config.rendimento_padrao_origem)) throw configError('rendimento_padrao_origem inválida.', 'rendimento_padrao_origem');
  return config;
}

async function readStored(empresaId) {
  const stored = await storage.settings.get(configKey(empresaId));
  return stored && typeof stored === 'object' ? stored : {};
}

/** Configuração efetiva (defaults cobrem chaves ausentes; valores inválidos persistidos caem no padrão). */
export async function getAppConfig(empresaId = DEFAULT_EMPRESA_ID) {
  const stored = await readStored(empresaId);
  const merged = { ...APP_CONFIG_DEFAULTS };
  for (const key of CONFIG_KEYS) if (stored[key] !== undefined) merged[key] = stored[key];
  try {
    return { versao: APP_CONFIG_VERSION, ...normalizeConfig(merged) };
  } catch {
    return { versao: APP_CONFIG_VERSION, ...APP_CONFIG_DEFAULTS };
  }
}

/** Atualiza (patch parcial) exigindo settings.manage; chaves desconhecidas são recusadas. */
export async function updateAppConfig(actor, patch = {}, empresaId = DEFAULT_EMPRESA_ID) {
  assertCan(actor?.perfil, 'settings.manage');
  if (!patch || typeof patch !== 'object') throw configError('Patch de configuração inválido.');
  const unknown = Object.keys(patch).filter((key) => !CONFIG_KEYS.includes(key));
  if (unknown.length) throw configError(`Campos de configuração desconhecidos: ${unknown.join(', ')}.`, unknown[0]);
  const current = await getAppConfig(empresaId);
  const next = normalizeConfig({ ...current, ...patch });
  const changed = CONFIG_KEYS.filter((key) => current[key] !== next[key]);
  const record = { versao: APP_CONFIG_VERSION, ...next };
  await storage.settings.set(configKey(empresaId), record);
  if (changed.length) {
    const db = await ensureStorageReady();
    await db.table('auditoria').add({
      id: crypto.randomUUID(),
      entidade: 'appSettings',
      entidade_id: configKey(empresaId),
      acao: 'ATUALIZAR',
      resumo: `Configurações alteradas (${changed.join(', ')}).`,
      campos_alterados: changed,
      ...actorFields(actor),
      created_at: new Date().toISOString(),
    });
  }
  return record;
}

/** Atalho usado pela sessão: minutos de inatividade (0 desliga). */
export async function getInactivityMinutes(empresaId = DEFAULT_EMPRESA_ID) {
  return (await getAppConfig(empresaId)).bloqueio_inatividade_minutos;
}
