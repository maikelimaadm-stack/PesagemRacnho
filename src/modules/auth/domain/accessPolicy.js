// Fachada de compatibilidade (revisão 1) sobre o permissionService (revisão 2, ADR-042).
// Mantida porque outros módulos importam `assertCan` daqui
// (ex.: src/modules/catalog/application/registryAccess.js). Toda decisão vem da MATRIX.
import {
  ACTIONS,
  MATRIX,
  ROLES,
  ROLE_LABELS,
  authorize,
  can,
  forbiddenError,
  isRole,
  listActions,
  roleLabel,
} from './permissionService.js';

export { can, forbiddenError };

export const PROFILES = ROLES;
export const PROFILE_LABELS = ROLE_LABELS;
export const ALL_PERMISSIONS = ACTIONS;

// perfil → lista de permissões (visão por papel da mesma matriz).
export const PERMISSIONS = Object.freeze(
  Object.fromEntries(ROLES.map((role) => [role, Object.freeze(ACTIONS.filter((action) => MATRIX[action][role]))])),
);

export function isProfile(profile) {
  return isRole(profile);
}

export function profileLabel(profile) {
  return roleLabel(profile);
}

/** Lança erro com code AUTH_FORBIDDEN quando o papel não tem a permissão (= authorize). */
export function assertCan(profile, permission) {
  return authorize(profile, permission);
}

export function listPermissions(profile) {
  return listActions(profile);
}
