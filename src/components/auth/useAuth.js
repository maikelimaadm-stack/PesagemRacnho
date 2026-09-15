import { createContext, useContext } from 'react';

// Contexto exposto pelo AuthGate: { user ({ id, nome, login, role, must_change_password }),
// role, can(action), lock, logout, switchUser, changePassword }. Decisões de UI usam can()/
// RequirePermission — nunca `if (role === …)` (ADR-042).
export const AuthContext = createContext(null);

/** Sessão autenticada atual; null fora do AuthGate (ex.: telas de login). */
export function useAuth() {
  return useContext(AuthContext);
}
