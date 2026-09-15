// Políticas operacionais consumidas pelo Lançamento, pela Relação (importação)
// e pelo Fechamento do Dia (ADR-025 rendimento com origem; ADR-033 documento na
// venda; APPSETTINGS-AUDIT §3 política de avisos).
//
// Fonte: appConfigService. Os getters por grupo (getOperationalDefaults,
// getSalesPolicy, getWeightWarningPolicy) estão sendo criados pelo agente de
// autenticação nesta onda; até existirem, getAppConfig() devolve as chaves
// planas. O import é tolerante: usa o getter quando existe e cai no plano
// quando não.
import * as appConfigService from '../../settings/application/appConfigService.js';
import { buildWeightWarningPolicy, DEFAULT_WEIGHT_WARNING_POLICY } from '../../weighing/domain/weighingWarnings.js';

export const DEFAULT_EMPRESA_ID = appConfigService.DEFAULT_EMPRESA_ID ?? 'local';

// Origem do rendimento de carcaça usada pelo lançamento (docs 12 §4).
export const RENDIMENTO_ORIGEM_INFORMADO = 'INFORMADO';
export const RENDIMENTO_ORIGEM_PADRAO_EMPRESA = 'PADRAO_EMPRESA';

const isFn = (value) => typeof value === 'function';
const idOrNull = (value) => (value === undefined || value === null || value === '' ? null : String(value));
const positive = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

async function readFlatConfig(empresaId) {
  if (!isFn(appConfigService.getAppConfig)) return {};
  try {
    const config = await appConfigService.getAppConfig(empresaId);
    return config && typeof config === 'object' ? config : {};
  } catch {
    return {};
  }
}

async function readGroup(getterName, empresaId) {
  const getter = appConfigService[getterName];
  if (!isFn(getter)) return null;
  try {
    const value = await getter(empresaId);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

/** Padrões de cadastro/operação: ids ou null. */
export function normalizeOperationalDefaults(source = {}) {
  return {
    marca_padrao_id: idOrNull(source.marca_padrao_id),
    raca_padrao_id: idOrNull(source.raca_padrao_id),
    propriedade_padrao_id: idOrNull(source.propriedade_padrao_id),
    apartacao_padrao_id: idOrNull(source.apartacao_padrao_id),
  };
}

/** Política comercial: documento na venda e rendimento padrão (nunca um 50 silencioso). */
export function normalizeSalesPolicy(source = {}) {
  const rendimento = positive(source.rendimento_padrao, null);
  return {
    exigir_documento_venda: source.exigir_documento_venda === true,
    rendimento_padrao: rendimento !== null && rendimento <= 100 ? rendimento : null,
    rendimento_padrao_origem: source.rendimento_padrao_origem || RENDIMENTO_ORIGEM_PADRAO_EMPRESA,
  };
}

/** Política de avisos de conferência (faixa de peso, GMD e variação %), com fallback nos defaults do domínio. */
export function normalizeWeightWarningPolicy(source = {}) {
  return {
    faixa_peso_min: positive(source.faixa_peso_min, DEFAULT_WEIGHT_WARNING_POLICY.minimumWeightKg),
    faixa_peso_max: positive(source.faixa_peso_max, DEFAULT_WEIGHT_WARNING_POLICY.maximumWeightKg),
    limite_gmd_alerta: positive(source.limite_gmd_alerta, DEFAULT_WEIGHT_WARNING_POLICY.maximumAbsoluteGmdKg),
    variacao_max_percent: positive(source.variacao_max_percent, DEFAULT_WEIGHT_WARNING_POLICY.maximumWeightChangePercent),
  };
}

/**
 * loadOperationalPolicies(empresaId) →
 * { defaults, sales, weightWarnings, weightWarningPolicy }
 * `weightWarningPolicy` já está no formato de evaluateWeighingWarnings.
 */
export async function loadOperationalPolicies(empresaId = DEFAULT_EMPRESA_ID) {
  const [defaultsGroup, salesGroup, warningsGroup] = await Promise.all([
    readGroup('getOperationalDefaults', empresaId),
    readGroup('getSalesPolicy', empresaId),
    readGroup('getWeightWarningPolicy', empresaId),
  ]);
  const flat = defaultsGroup && salesGroup && warningsGroup ? {} : await readFlatConfig(empresaId);
  const defaults = normalizeOperationalDefaults(defaultsGroup ?? flat);
  // `exigir_documento_venda` vive em sales-policy; `rendimento_padrao` e a sua
  // origem vivem em operational-defaults (appConfigService.CONFIG_GROUPS). A
  // política comercial consumida pelas telas junta os dois grupos.
  const sales = normalizeSalesPolicy({ ...(defaultsGroup ?? flat), ...(salesGroup ?? flat) });
  const weightWarnings = normalizeWeightWarningPolicy(warningsGroup ?? flat);
  return { defaults, sales, weightWarnings, weightWarningPolicy: buildWeightWarningPolicy(weightWarnings) };
}

/**
 * Registro padrão de um cadastro: o id configurado (quando existe e está ativo
 * na lista), senão o marcado `padrao=true`, senão null. Nunca inventa.
 */
export function resolveDefaultRegistry(rows = [], preferredId = null) {
  const ativos = rows.filter((row) => row && row.ativo !== false && !row.deleted_at);
  if (preferredId) {
    const preferido = ativos.find((row) => String(row.id) === String(preferredId));
    if (preferido) return preferido;
  }
  return ativos.find((row) => row.padrao === true) ?? null;
}

/**
 * Documento de saída obrigatório (ADR-033): Abate exige sempre embarque +
 * documento; Venda só quando a política `exigir_documento_venda` está ligada.
 * Demais motivos (Morte, Doação, Transferência, Outros) nunca exigem.
 */
export function exitRequiresDocument(motivoSaida, salesPolicy = {}) {
  const motivo = String(motivoSaida ?? '').trim();
  if (motivo === 'Abate') return true;
  if (motivo === 'Venda') return salesPolicy?.exigir_documento_venda === true;
  return false;
}

/** Texto do rendimento para o campo (pt-BR): 52.5 → "52,5"; null → "". */
export function formatRendimento(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).replace('.', ',');
}
