// Erros do módulo de autenticação (doc 11 rev. 2). Mensagens em pt-BR, código estável
// para a UI decidir a apresentação. Mensagens NUNCA revelam se o login existe.
export const AUTH_ERRORS = Object.freeze({
  AUTH_INVALID: 'Login ou senha inválidos.',
  AUTH_LOCKED: 'Muitas tentativas incorretas. Aguarde para tentar novamente.',
  AUTH_FORBIDDEN: 'Seu papel não permite esta ação.',
  AUTH_LAST_ADMIN: 'Não é possível inativar ou rebaixar o último administrador ativo.',
  AUTH_LOGIN_EXISTS: 'Já existe um usuário com este login.',
  AUTH_WEAK_PASSWORD: 'A senha deve ter pelo menos 6 caracteres e não pode ser trivial nem igual ao login.',
  AUTH_SETUP_DONE: 'A configuração inicial já foi concluída.',
  AUTH_NOT_FOUND: 'Usuário não encontrado.',
  AUTH_INVALID_DATA: 'Dados do usuário inválidos.',
  AUTH_RECOVERY_INVALID: 'Login ou chave de recuperação inválidos.',
});

export function authError(code, extra = {}) {
  const error = new Error(AUTH_ERRORS[code] || code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

/** true quando o erro é o bloqueio de escrita da migração (ADR-038) — gravações best-effort o toleram. */
export function isMigrationBlocked(error) {
  return Boolean(error) && (error.code === 'MIGRATION_BLOCKED' || error.reason === 'MIGRATION_BLOCKED');
}
