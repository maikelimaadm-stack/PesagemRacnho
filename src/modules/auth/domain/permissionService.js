// Autorização central (ADR-042/046): quatro papéis fixos e ações nomeadas.
// A UI esconde o que o papel não pode; o SERVIÇO chama authorize(role, action)
// antes de gravar. Nenhum `if (role === …)` fora deste arquivo.
// Tabela: docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md §4 (revisão 2).

export const ROLES = Object.freeze(['ADMIN', 'GESTOR', 'OPERADOR', 'CONSULTA']);

export const ROLE_LABELS = Object.freeze({
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  OPERADOR: 'Operador',
  CONSULTA: 'Consulta',
});

const row = (admin, gestor, operador, consulta) => Object.freeze({ ADMIN: admin, GESTOR: gestor, OPERADOR: operador, CONSULTA: consulta });

// ação → { ADMIN, GESTOR, OPERADOR, CONSULTA } exatamente como a tabela do documento 11 §4.
export const MATRIX = Object.freeze({
  'launch.use': row(true, true, true, false),
  'weighing.read': row(true, true, true, true),
  'weighing.write': row(true, true, true, false),
  'weighing.edit': row(true, true, true, false),
  'animal.read': row(true, true, true, true),
  'animal.write': row(true, true, true, false), // cadastro rápido
  'registry.read': row(true, true, true, true),
  'registry.write': row(true, true, false, false),
  'commercial.read': row(true, true, false, true), // CONSULTA: sem valores (ver commercial.values)
  'commercial.write': row(true, true, false, false),
  'commercial.values': row(true, true, false, false), // ver preços
  'shipment.read': row(true, true, true, true),
  'shipment.write': row(true, true, false, false),
  'session.close': row(true, true, false, false),
  'session.reopen': row(true, true, false, false),
  // Relatórios (programa reporting 1.3.0): permissões genéricas, nunca uma por relatório.
  'reports.read': row(true, true, true, true),
  'reports.export': row(true, true, false, true), // CONSULTA exporta só relatórios não sensíveis
  'reports.templates.share': row(true, true, false, false),
  'maintenance.backup': row(true, true, false, false),
  'maintenance.restore': row(true, false, false, false),
  'maintenance.clear': row(true, false, false, false),
  'maintenance.reset': row(true, false, false, false),
  'maintenance.migrate': row(true, false, false, false),
  'users.manage': row(true, false, false, false),
  'settings.operational': row(true, true, false, false),
  'settings.auth': row(true, false, false, false),
  'settings.manage': row(true, false, false, false),
  'audit.read': row(true, true, false, false),
});

export const ACTIONS = Object.freeze(Object.keys(MATRIX));

export function isRole(role) {
  return ROLES.includes(role);
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || String(role || 'Sem papel');
}

/** true somente quando papel e ação existem e a matriz autoriza. */
export function can(role, action) {
  const cell = MATRIX[action];
  if (!cell || !isRole(role)) return false;
  return cell[role] === true;
}

export function forbiddenError(role, action) {
  const error = new Error(`Acesso não permitido: o papel ${roleLabel(role)} não possui a permissão ${action}.`);
  error.code = 'AUTH_FORBIDDEN';
  error.role = role ?? null;
  error.action = action;
  // Aliases da revisão 1 (leitores antigos do erro).
  error.profile = error.role;
  error.permission = action;
  return error;
}

/** Lança Error com code AUTH_FORBIDDEN (role/action) quando o papel não tem a ação. */
export function authorize(role, action) {
  if (!can(role, action)) throw forbiddenError(role, action);
  return true;
}

export function listActions(role) {
  return isRole(role) ? ACTIONS.filter((action) => MATRIX[action][role]) : [];
}

/** Papel de um ator de serviço ({ role } na rev. 2; { perfil } na rev. 1) ou null. */
export function roleOf(actor) {
  const role = actor?.role ?? actor?.perfil ?? actor?.actor_user_profile ?? null;
  return role ? String(role) : null;
}
