// Ponto de encontro entre a camada de armazenamento e a autenticação local (ADR-036).
// O módulo de auth registra um provedor de ator; os adapters que gravam em
// `auditoria` chamam getActor() e anexam actor_user_id/nome/perfil.
// Sem provedor (gates em Node, migrações, primeira execução) os campos ficam nulos.
let provider = null;

export const EMPTY_ACTOR = Object.freeze({ actor_user_id: null, actor_user_name: null, actor_user_profile: null });

export function setActorProvider(fn) {
  provider = typeof fn === 'function' ? fn : null;
}

export function getActor() {
  try {
    const actor = provider ? provider() : null;
    if (!actor || !actor.actor_user_id) return { ...EMPTY_ACTOR };
    return {
      actor_user_id: String(actor.actor_user_id),
      actor_user_name: actor.actor_user_name ? String(actor.actor_user_name) : null,
      actor_user_profile: actor.actor_user_profile ? String(actor.actor_user_profile) : null,
    };
  } catch {
    return { ...EMPTY_ACTOR };
  }
}
