// Regras de normalização compartilhadas por backfill, adapters e integridade
// (docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md §1 e §3.2).

/** nome_normalizado: trim → maiúsculas pt-BR → espaços internos únicos. */
export function normalizeName(value) {
  return String(value ?? '').trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, ' ');
}

// Motivo de saída (texto livre legado) → enum de `animais.situacao`.
// Sem acentos para tolerar grafias antigas ("Doacao", "Transferencia").
const SITUACAO_POR_MOTIVO = {
  VENDA: 'VENDIDO',
  ABATE: 'ABATIDO',
  MORTE: 'MORTO',
  DOACAO: 'DOADO',
  TRANSFERENCIA: 'TRANSFERIDO',
};

function stripAccents(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Situação do animal após uma saída definitiva. Motivo desconhecido ou ausente
 * → INATIVO (valor reservado às saídas legadas sem motivo mapeável; docs 12 §3.2).
 */
export function situacaoFromExitReason(motivo) {
  const key = stripAccents(normalizeName(motivo));
  return SITUACAO_POR_MOTIVO[key] || 'INATIVO';
}

/** Status legado de sessão ("Aberta") → enum v7 ("ABERTA"). Enum já válido é devolvido como está. */
export const SESSAO_STATUS_LEGADO = Object.freeze({ Aberta: 'ABERTA', Fechada: 'FECHADA', Cancelada: 'CANCELADA' });

export function normalizeSessionStatus(status) {
  if (status == null || status === '') return 'ABERTA';
  return SESSAO_STATUS_LEGADO[status] || String(status).toLocaleUpperCase('pt-BR');
}

export function isOpenSessionStatus(status) {
  return status === 'ABERTA' || status === 'Aberta';
}

/** Data civil (YYYY-MM-DD) a partir de um timestamp ISO; null quando inválido. */
export function civilDateFromIso(value) {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

/** Nascimento estimado: data civil de referência menos `era` em meses (ADR-028). Null quando não calculável. */
export function estimateBirth(referenceCivilDate, eraMonths) {
  const months = Number.parseInt(String(eraMonths ?? '').trim(), 10);
  if (!referenceCivilDate || !Number.isFinite(months) || months <= 0 || months > 400) return null;
  const date = new Date(`${referenceCivilDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}
