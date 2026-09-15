// Erro de domínio dos cadastros mestres. `code` é estável para a UI e os gates:
// REGISTRY_INVALID, REGISTRY_DUPLICATE, REGISTRY_NOT_FOUND, REGISTRY_IN_USE,
// REGISTRY_UNSUPPORTED. Falta de permissão vem da política oficial de acesso
// (AUTH_FORBIDDEN, src/modules/auth/domain/accessPolicy.js).
export class RegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.details = details;
  }
}
