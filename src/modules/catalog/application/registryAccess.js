// Checagem de permissão dos cadastros mestres (ADR-036): escrita exige
// `registry.write` pela tabela oficial de src/modules/auth/domain/accessPolicy.js.
// Sem ator/perfil (gates em Node, migração, seeds) a escrita é permitida: não há
// sessão nesses contextos e a auditoria fica com ator nulo (docs 11 §2.4).
import { assertCan } from '../../auth/domain/accessPolicy.js';

export const REGISTRY_WRITE_PERMISSION = 'registry.write';

// Lança AUTH_FORBIDDEN (erro oficial da política) quando o perfil não pode escrever.
export function assertRegistryWrite(actor) {
  const perfil = actor?.perfil ?? actor?.actor_user_profile ?? null;
  if (!perfil) return;
  assertCan(String(perfil).toLocaleUpperCase('pt-BR'), REGISTRY_WRITE_PERMISSION);
}
