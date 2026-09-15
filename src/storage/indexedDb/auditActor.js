// Ponto de encontro entre a camada de armazenamento e a autenticação local (ADR-046).
// O módulo de auth registra um provedor de ator; os adapters que gravam em
// `auditoria` chamam getActor() e anexam usuario_id + usuario_nome_snapshot.
// Sem provedor (gates em Node, migrações, primeira execução) os campos ficam nulos.
//
// Contrato do provedor: () => { id, nome, role } | null
// (aceita também o formato da revisão 1: { actor_user_id, actor_user_name, actor_user_profile }).
let provider = null;

export const EMPTY_ACTOR = Object.freeze({ usuario_id: null, usuario_nome_snapshot: null });

export function setActorProvider(fn) {
  provider = typeof fn === 'function' ? fn : null;
}

function readProvider() {
  try {
    const actor = provider ? provider() : null;
    if (!actor) return null;
    const id = actor.id ?? actor.userId ?? actor.usuario_id ?? actor.actor_user_id ?? null;
    if (!id) return null;
    return {
      id: String(id),
      nome: actor.nome ?? actor.usuario_nome_snapshot ?? actor.actor_user_name ?? null,
      role: actor.role ?? actor.perfil ?? actor.actor_user_profile ?? null,
    };
  } catch {
    return null;
  }
}

/** Campos de auditoria do ator atual (docs 12 §3.2). */
export function getActor() {
  const actor = readProvider();
  if (!actor) return { ...EMPTY_ACTOR };
  return {
    usuario_id: actor.id,
    usuario_nome_snapshot: actor.nome ? String(actor.nome) : null,
  };
}

/** Papel do ator atual para autorização no serviço (ADR-042/046); null sem sessão. */
export function getActorRole() {
  const actor = readProvider();
  return actor?.role ? String(actor.role) : null;
}

/** Ator completo { id, nome, role } | null — para serviços que precisam dos três. */
export function getCurrentActor() {
  return readProvider();
}
