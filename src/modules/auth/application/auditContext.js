// Ator da auditoria a partir da sessão local (ADR-036). Sem sessão (gates em Node,
// migrações, primeira execução) devolve nulos: registros antigos e técnicos ficam sem ator.
import { getSession, getSessionActor } from './authSession.js';

export const EMPTY_ACTOR = Object.freeze({ actor_user_id: null, actor_user_name: null, actor_user_profile: null });

/** Campos de auditoria: { actor_user_id, actor_user_name, actor_user_profile }. */
export function getActor() {
  const session = getSession();
  if (!session) return { ...EMPTY_ACTOR };
  return {
    actor_user_id: session.userId,
    actor_user_name: session.nome || null,
    actor_user_profile: session.perfil || null,
  };
}

/** Ator para chamadas de serviço ({ id, nome, perfil }) ou null. */
export function getCurrentActor() {
  return getSessionActor();
}

/** Converte um ator de serviço ({ id, nome, perfil }) nos campos de auditoria; sem ator usa a sessão. */
export function actorFields(actor) {
  if (actor?.id) {
    return {
      actor_user_id: String(actor.id),
      actor_user_name: actor.nome ? String(actor.nome) : null,
      actor_user_profile: actor.perfil ? String(actor.perfil) : null,
    };
  }
  return getActor();
}
