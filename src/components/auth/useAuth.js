import { createContext, useContext } from 'react';

// Contexto exposto pelo AuthGate: { user, can(permission), lock, logout, switchUser, changePassword }.
export const AuthContext = createContext(null);

/** Sessão autenticada atual; null fora do AuthGate (ex.: telas de login). */
export function useAuth() {
  return useContext(AuthContext);
}
