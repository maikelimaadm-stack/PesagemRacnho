// Ator da auditoria a partir da sessão local (ADR-046, docs 12 §3.2). Sem sessão
// (gates em Node, migrações, primeira execução) devolve nulos: registros antigos e
// técnicos ficam com usuario_id = null.
import { getSession, getSessionActor } from './authSession.js';

export const EMPTY_ACTOR = Object.freeze({ usuario_id: null, usuario_nome_snapshot: null });

/** Campos de auditoria: { usuario_id, usuario_nome_snapshot }. */
export function getActor() {
  const session = getSession();
  if (!session) return { ...EMPTY_ACTOR };
  return { usuario_id: session.userId, usuario_nome_snapshot: session.nome || null };
}

/** Ator para chamadas de serviço ({ id, nome, role }) ou null. */
export function getCurrentActor() {
  return getSessionActor();
}

/** Converte um ator de serviço ({ id, nome }) nos campos de auditoria; sem ator usa a sessão. */
export function actorFields(actor) {
  if (actor?.id) {
    return { usuario_id: String(actor.id), usuario_nome_snapshot: actor.nome ? String(actor.nome) : null };
  }
  return getActor();
}
