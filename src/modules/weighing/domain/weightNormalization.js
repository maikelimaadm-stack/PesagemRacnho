// Regra ÚNICA de normalização do peso lançado (R07, auditoria corretiva R1). Decisão de produto vigente (P15):
// o peso gravado no lançamento é INTEIRO, por TRUNCAMENTO — monitor 58,5 → 58; 328,99 → 328. Vale igual para o
// peso digitado, para a leitura da balança S3 e para os itens das operações (Entradas/Saídas). O valor bruto da
// balança continua guardado na leitura (balanca_leitura). Pesos antigos não são recalculados.
import { parseBrazilianNumber } from './brazilianValues.js';

export const REGRA_PESO_LANCAMENTO = 'INTEIRO_TRUNCADO';

/**
 * @param {number|string|null|undefined} raw peso digitado ("328,4", "1.234,5") ou lido (328.4)
 * @returns {{ ok: true, kg: number|null, vazio: boolean, bruto: number|null } | { ok: false, erro: string, codigo: string, bruto: number|null }}
 *   vazio (null/''): ok com kg null — quem chama decide se o peso é obrigatório.
 */
export function normalizeLaunchWeight(raw) {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, kg: null, vazio: true, bruto: null };
  const bruto = typeof raw === 'number' ? raw : parseBrazilianNumber(raw);
  if (bruto === null || !Number.isFinite(bruto)) return { ok: false, codigo: 'PESO_INVALIDO', erro: 'Peso inválido: use só números (ex.: 328 ou 328,4).', bruto: null };
  if (bruto <= 0) return { ok: false, codigo: 'PESO_NAO_POSITIVO', erro: 'Peso deve ser maior que zero.', bruto };
  const kg = Math.floor(bruto);
  if (kg <= 0) return { ok: false, codigo: 'PESO_NAO_POSITIVO', erro: 'Peso abaixo de 1 kg: deve ser maior que zero.', bruto };
  return { ok: true, kg, vazio: false, bruto };
}

/** Atalho: kg inteiro ou null (vazio ou inválido). */
export function launchWeightKg(raw) {
  const r = normalizeLaunchWeight(raw);
  return r.ok ? r.kg : null;
}
