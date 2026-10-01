// M1 (1.5.0) — Pesagem suspeita (valor fora da curva). docs/plano-mestre/M1-FUNDACAO-NUMERO.md §3.
// Função pura, sem Dexie e sem React. Só APONTA: nesta etapa a pesagem suspeita continua entrando em média,
// total e gráfico (excluir exige gravar a resolução "perda real" × "erro" — campo novo, esquema — e fica na M2).
//
// Regras, NA ORDEM (a primeira que vale decide):
//   1. SUSPEITA_ERRO   — |variação| > 25 % do peso anterior; ou perda > 10 % em menos de 14 dias.
//                        "provável erro de balança ou digitação"
//   2. SUSPEITA_LOTE   — |gmd − mediana do lote| > 3,5 × 1,4826 × MAD do lote (lote com 8 animais ou mais;
//                        menos que isso não classifica). "fora da curva do lote"
//   3. PERDA_POSSIVEL  — perda de até 5 % em até 28 dias, animal presente e sem saída.
//                        "perda possível — verificar sanidade" (alerta de manejo, não é erro)
//   4. OK              — o resto.
// As porcentagens são sobre o peso ANTERIOR (o peso vivo de referência da variação).

export const CLASSE_PESAGEM = Object.freeze({
  OK: 'OK',
  SUSPEITA_ERRO: 'SUSPEITA_ERRO',
  SUSPEITA_LOTE: 'SUSPEITA_LOTE',
  PERDA_POSSIVEL: 'PERDA_POSSIVEL',
});

export const MOTIVO_PESAGEM = Object.freeze({
  SUSPEITA_ERRO: 'provável erro de balança ou digitação',
  SUSPEITA_LOTE: 'fora da curva do lote',
  PERDA_POSSIVEL: 'perda possível — verificar sanidade',
});

export const OUTLIER_LIMITES = Object.freeze({
  /** Regra 1: variação absoluta acima disto (fração do peso anterior) = provável erro. */
  variacaoMaxima: 0.25,
  /** Regra 1: perda acima disto (fração do peso anterior) ... */
  perdaRapidaMaxima: 0.10,
  /** ... em MENOS que estes dias = provável erro. */
  perdaRapidaDias: 14,
  /** Regra 2: |gmd − mediana| > fator × escala × MAD (escala 1,4826 = MAD como desvio padrão da normal). */
  madFator: 3.5,
  madEscala: 1.4826,
  /** Regra 2: lote com menos animais que isto não classifica. */
  loteMinimoAnimais: 8,
  /** Regra 3: perda de ATÉ esta fração ... */
  perdaPossivelMaxima: 0.05,
  /** ... em ATÉ estes dias, com o animal presente = perda possível. */
  perdaPossivelDias: 28,
});

const finite = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function median(sorted) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Mediana e MAD (desvio absoluto mediano) dos valores numéricos; vazio, nulo e não numérico são ignorados.
 * @param {Array<number|null>} values
 * @returns {{ mediana: number|null, mad: number|null }} null/null sem nenhum valor
 */
export function medianAbsoluteDeviation(values) {
  const clean = (Array.isArray(values) ? values : []).map(finite).filter((value) => value !== null).sort((a, b) => a - b);
  if (!clean.length) return { mediana: null, mad: null };
  const mediana = median(clean);
  const mad = median(clean.map((value) => Math.abs(value - mediana)).sort((a, b) => a - b));
  return { mediana, mad };
}

const result = (classe) => ({ classe, motivo: MOTIVO_PESAGEM[classe] ?? null });

/**
 * Classe de UMA pesagem contra a anterior do mesmo animal e contra o lote no período.
 * @param {{
 *   pesoAtual: number, pesoAnterior: number|null, dias: number|null, gmd: number|null,
 *   gmdMedianaLote?: number|null, madLote?: number|null, nLote?: number|null, presente?: boolean
 * }} pesagem
 *   gmd: o GMD que entra na comparação com o lote (quem chama passa null para GMD não confiável);
 *   nLote: animais do lote com GMD na mediana/MAD; presente: animal ativo e sem evento de saída.
 * @returns {{ classe: 'OK'|'SUSPEITA_ERRO'|'SUSPEITA_LOTE'|'PERDA_POSSIVEL', motivo: string|null }}
 */
export function classifyWeighing({ pesoAtual, pesoAnterior, dias, gmd, gmdMedianaLote, madLote, nLote, presente } = {}) {
  const atual = finite(pesoAtual);
  const anterior = finite(pesoAnterior);
  // Sem pesagem anterior com peso (ou sem peso agora) não há com o que comparar.
  if (atual === null || anterior === null || atual <= 0 || anterior <= 0) return result(CLASSE_PESAGEM.OK);
  const days = finite(dias);
  const variacao = atual - anterior;
  // Frações por divisão (não multiplicação): no limite exato (ex.: 120 de 480 = 25 %) a conta não "passa" por arredondamento.
  const variacaoRelativa = Math.abs(variacao) / anterior;
  const perdaRelativa = variacao < 0 ? -variacao / anterior : 0;

  // 1. Provável erro de balança ou digitação.
  if (variacaoRelativa > OUTLIER_LIMITES.variacaoMaxima) return result(CLASSE_PESAGEM.SUSPEITA_ERRO);
  if (perdaRelativa > OUTLIER_LIMITES.perdaRapidaMaxima && days !== null && days < OUTLIER_LIMITES.perdaRapidaDias) return result(CLASSE_PESAGEM.SUSPEITA_ERRO);

  // 2. Fora da curva do lote (MAD robusto; lote pequeno não classifica).
  const value = finite(gmd);
  const mediana = finite(gmdMedianaLote);
  const mad = finite(madLote);
  const animais = finite(nLote);
  if (value !== null && mediana !== null && mad !== null && animais !== null && animais >= OUTLIER_LIMITES.loteMinimoAnimais
    && Math.abs(value - mediana) > OUTLIER_LIMITES.madFator * OUTLIER_LIMITES.madEscala * mad) {
    return result(CLASSE_PESAGEM.SUSPEITA_LOTE);
  }

  // 3. Perda possível (alerta de manejo): perda pequena, intervalo curto, animal no rebanho.
  if (presente === true && perdaRelativa > 0 && perdaRelativa <= OUTLIER_LIMITES.perdaPossivelMaxima
    && days !== null && days >= 1 && days <= OUTLIER_LIMITES.perdaPossivelDias) {
    return result(CLASSE_PESAGEM.PERDA_POSSIVEL);
  }
  return result(CLASSE_PESAGEM.OK);
}

/** Pesagem que vai para a lista "Pesagens para conferir"? (toda classe diferente de OK). */
export function isPesagemParaConferir(classe) {
  return Boolean(classe) && classe !== CLASSE_PESAGEM.OK;
}
