// Controle de acesso por perfis fixos (ADR-036). Mapa estático: não existe store
// de permissões nem editor. A UI esconde o que o perfil não pode; o serviço valida.
// Tabela: docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md §2.2.

export const PROFILES = Object.freeze(['ADMIN', 'GESTOR', 'OPERADOR']);

export const PROFILE_LABELS = Object.freeze({
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
});

const ALL = Object.freeze(['ADMIN', 'GESTOR', 'OPERADOR']);
const ADMIN_GESTOR = Object.freeze(['ADMIN', 'GESTOR']);
const ADMIN_ONLY = Object.freeze(['ADMIN']);

// permissão → perfis autorizados (exatamente a tabela do documento 11 §2.2).
const PERMISSION_TABLE = Object.freeze({
  'launch.use': ALL,
  'weighing.read': ALL,
  'weighing.write': ALL,
  'weighing.edit': ALL, // OPERADOR: só o próprio dia (regra futura no serviço de pesagens)
  'animal.read': ALL,
  'animal.write': ALL, // OPERADOR: cadastro rápido
  'registry.read': ALL,
  'registry.write': ADMIN_GESTOR,
  'commercial.read': ADMIN_GESTOR,
  'commercial.write': ADMIN_GESTOR,
  'shipment.read': ADMIN_GESTOR,
  'shipment.write': ADMIN_GESTOR,
  'session.close': ADMIN_GESTOR,
  'session.reopen': ADMIN_GESTOR,
  'reports.read': ADMIN_GESTOR,
  'maintenance.backup': ADMIN_GESTOR,
  'maintenance.restore': ADMIN_ONLY,
  'maintenance.clear': ADMIN_ONLY,
  'maintenance.migrate': ADMIN_ONLY,
  'users.manage': ADMIN_ONLY,
  'settings.manage': ADMIN_ONLY,
});

export const ALL_PERMISSIONS = Object.freeze(Object.keys(PERMISSION_TABLE));

// perfil → lista de permissões (visão por perfil da mesma tabela).
export const PERMISSIONS = Object.freeze(
  Object.fromEntries(
    PROFILES.map((profile) => [
      profile,
      Object.freeze(ALL_PERMISSIONS.filter((permission) => PERMISSION_TABLE[permission].includes(profile))),
    ]),
  ),
);

export function isProfile(profile) {
  return PROFILES.includes(profile);
}

export function profileLabel(profile) {
  return PROFILE_LABELS[profile] || String(profile || 'Sem perfil');
}

/** true somente quando perfil e permissão existem e a tabela autoriza. */
export function can(profile, permission) {
  const allowed = PERMISSION_TABLE[permission];
  if (!allowed || !isProfile(profile)) return false;
  return allowed.includes(profile);
}

export function forbiddenError(profile, permission) {
  const error = new Error(`Acesso não permitido: o perfil ${profileLabel(profile)} não possui a permissão ${permission}.`);
  error.code = 'AUTH_FORBIDDEN';
  error.profile = profile ?? null;
  error.permission = permission;
  return error;
}

/** Lança erro com code AUTH_FORBIDDEN quando o perfil não tem a permissão. */
export function assertCan(profile, permission) {
  if (!can(profile, permission)) throw forbiddenError(profile, permission);
  return true;
}

export function listPermissions(profile) {
  return isProfile(profile) ? [...PERMISSIONS[profile]] : [];
}
