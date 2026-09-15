// Checagem de permissão dos cadastros mestres (ADR-042/046): escrita exige
// `registry.write` pela tabela oficial de src/modules/auth/domain/accessPolicy.js
// (fachada mantida pelo módulo de auth). O papel vem do ator informado na
// chamada (perfil/role) ou, quando o chamador não informa, da sessão
// (getActorRole). Só sem sessão E sem ator (gates em Node, migração, seeds) a
// escrita é liberada — nesses contextos a auditoria fica com ator nulo (docs 11 §7).
import { getActorRole } from '../../../storage/indexedDb/auditActor.js';
import { assertCan } from '../../auth/domain/accessPolicy.js';

export const REGISTRY_WRITE_PERMISSION = 'registry.write';

const upper = (value) => String(value).trim().toLocaleUpperCase('pt-BR');

/** Papel efetivo para autorização: informado pelo chamador → sessão → null. */
export function resolveWriterRole(actor) {
  const informado = actor?.perfil ?? actor?.role ?? actor?.actor_user_profile ?? null;
  if (informado) return upper(informado);
  const sessao = getActorRole();
  return sessao ? upper(sessao) : null;
}

// Lança AUTH_FORBIDDEN (erro oficial da política) quando o papel não pode
// escrever; OPERADOR e CONSULTA são recusados. Ator identificado sem papel
// conhecido também é recusado: só a ausência total de ator e sessão libera.
export function assertRegistryWrite(actor) {
  const role = resolveWriterRole(actor);
  if (!role && !actor?.id) return true;
  assertCan(role, REGISTRY_WRITE_PERMISSION);
  return true;
}
