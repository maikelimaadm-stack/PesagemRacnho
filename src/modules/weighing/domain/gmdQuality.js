// M1 (1.5.0) — Qualidade do GMD. CONTRATO CONGELADO (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §1.1):
// só o integrador da etapa muda este arquivo. Função pura, sem Dexie e sem React.
//
// O FATO gravado não muda (pesagens.gmd continua com o valor calculado): a qualidade é DERIVADA na leitura,
// a partir dos dias do intervalo e do mínimo de Configurações › Relatórios (gmd_dias_minimos).
//
// | Situação                             | gmdQualidade  | gmd       | Exibição                         | Média/agregado |
// | sem pesagem anterior com peso        | SEM_GMD       | null      | "-"                              | não            |
// | dias entre 1 e diasMinimos − 1       | NAO_CONFIAVEL | calculado | cinza + "intervalo curto (N dias)" | NÃO          |
// | dias >= diasMinimos                  | CONFIAVEL     | calculado | normal                           | sim            |

export const GMD_QUALIDADE = Object.freeze({
  CONFIAVEL: 'CONFIAVEL',
  NAO_CONFIAVEL: 'NAO_CONFIAVEL',
  SEM_GMD: 'SEM_GMD',
});

/** Opções de "Intervalo mínimo do GMD" em Configurações › Relatórios (gmd_dias_minimos). */
export const GMD_DIAS_MINIMOS_OPCOES = Object.freeze([7, 14, 21, 28]);
export const GMD_DIAS_MINIMOS_PADRAO = 21;

export const GMD_MOTIVO_SEM_ANTERIOR = 'sem pesagem anterior';

/** "intervalo curto (1 dia)" / "intervalo curto (12 dias)". */
export function gmdMotivoIntervaloCurto(dias) {
  return `intervalo curto (${dias} ${dias === 1 ? 'dia' : 'dias'})`;
}

/** Mínimo válido (7, 14, 21 ou 28); ausente ou inválido → 21. */
export function normalizeGmdDiasMinimos(value) {
  const number = Number(value);
  return GMD_DIAS_MINIMOS_OPCOES.includes(number) ? number : GMD_DIAS_MINIMOS_PADRAO;
}

const finite = (value) => (value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null));

/**
 * Qualidade de um GMD a partir dos dias do intervalo e do valor.
 * @param {{ dias?: number|null, gmd?: number|null }} intervalo
 * @param {number} [diasMinimos] gmd_dias_minimos (normalizado aqui)
 * @returns {{ gmdQualidade: 'CONFIAVEL'|'NAO_CONFIAVEL'|'SEM_GMD', gmdMotivo: string|null }}
 */
export function classifyGmd({ dias, gmd } = {}, diasMinimos = GMD_DIAS_MINIMOS_PADRAO) {
  const days = finite(dias);
  const value = finite(gmd);
  if (days === null || value === null || days < 1) return { gmdQualidade: GMD_QUALIDADE.SEM_GMD, gmdMotivo: GMD_MOTIVO_SEM_ANTERIOR };
  if (days < normalizeGmdDiasMinimos(diasMinimos)) return { gmdQualidade: GMD_QUALIDADE.NAO_CONFIAVEL, gmdMotivo: gmdMotivoIntervaloCurto(days) };
  return { gmdQualidade: GMD_QUALIDADE.CONFIAVEL, gmdMotivo: null };
}

/** Entra em média, soma ponderada, mínimo/máximo, gráfico e contagem "GMD de N de M"? Só o CONFIAVEL. */
export function isGmdConfiavel(gmdQualidade) {
  return gmdQualidade === GMD_QUALIDADE.CONFIAVEL;
}

const GMD_FORMAT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Número do GMD como a folha mostra (3 casas, vírgula); sem valor → "-". */
export function formatGmdNumber(gmd) {
  const value = finite(gmd);
  return value === null ? '-' : GMD_FORMAT.format(value);
}

/**
 * FORMATADOR COMPARTILHADO — como um GMD aparece em qualquer lugar (folha, ficha, Lançamento, CSV, XLSX, PDF).
 * @param {{ gmd?: number|null, gmdQualidade?: string, gmdMotivo?: string|null }} gmd já classificado
 * @param {{ format?: (value:number)=>string }} [options] formatador de número da camada (padrão: 3 casas pt-BR)
 * @returns {{ texto: string, cinza: boolean, aviso: string|null, entraNaMedia: boolean }}
 *   texto  "0,850" | "-" (SEM_GMD)
 *   cinza  true só no NAO_CONFIAVEL (o número aparece, mas apagado)
 *   aviso  o motivo (ex.: "intervalo curto (3 dias)") no NAO_CONFIAVEL; null nos outros
 */
export function gmdExibicao({ gmd, gmdQualidade, gmdMotivo } = {}, { format = formatGmdNumber } = {}) {
  if (gmdQualidade === GMD_QUALIDADE.SEM_GMD || finite(gmd) === null) return { texto: '-', cinza: false, aviso: null, entraNaMedia: false };
  if (gmdQualidade === GMD_QUALIDADE.NAO_CONFIAVEL) return { texto: format(Number(gmd)), cinza: true, aviso: gmdMotivo ?? null, entraNaMedia: false };
  return { texto: format(Number(gmd)), cinza: false, aviso: null, entraNaMedia: true };
}
