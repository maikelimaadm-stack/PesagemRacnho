// Sessão autenticada (ADR-045): estado em memória + espelho em sessionStorage
// ('pesagens.auth.session') SOMENTE para a recarga técnica do renderer — nunca em
// localStorage, nunca sobrevive ao fechamento do app. Sem senha nem token.
// Registra o provedor de ator da auditoria (storage/indexedDb/auditActor.js):
// () => { id, nome, role } | null.
import { setActorProvider } from '../../../storage/indexedDb/auditActor.js';

export const SESSION_STORAGE_KEY = 'pesagens.auth.session';
export const TOUCH_THROTTLE_MS = 30000;
export const DEFAULT_INACTIVITY_MINUTES = 30; // auth-policy.inactivity_lock_minutes (0 desliga)

let state = null; // { userId, nome, login, role, loginAt, lastActivityAt, locked }
let inactivityMinutes = DEFAULT_INACTIVITY_MINUTES;
let clock = () => Date.now();
const listeners = new Set();

function storage() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null; // acesso bloqueado (ex.: iframe restrito)
  }
}

function persist() {
  const store = storage();
  if (!store) return;
  try {
    if (state) store.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
    else store.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Sem espelho: a sessão continua válida em memória.
  }
}

function emit(reason) {
  const snapshot = getSession();
  for (const listener of listeners) {
    try { listener(snapshot, reason); } catch { /* ouvinte não pode derrubar a sessão */ }
  }
}

function commit(next, reason) {
  state = next;
  persist();
  emit(reason);
}

/** Ator para o storage/auditoria: { id, nome, role } ou null (sem sessão). */
export function getSessionActor() {
  return state ? { id: state.userId, nome: state.nome, role: state.role } : null;
}

setActorProvider(getSessionActor);

/** Inicia a sessão após autenticação bem-sucedida. Aceita { id, nome, login, role } (ou perfil, rev. 1). */
export function startSession({ id, nome, login, role, perfil }) {
  if (!id) throw new Error('Sessão exige o id do usuário.');
  const now = new Date(clock()).toISOString();
  commit({
    userId: String(id),
    nome: nome || '',
    login: login || '',
    role: role || perfil || null,
    loginAt: now,
    lastActivityAt: now,
    locked: false,
  }, 'login');
  return getSession();
}

export function getSession() {
  return state ? { ...state } : null;
}

export function hasSession() {
  return Boolean(state);
}

export function isLocked() {
  return Boolean(state?.locked);
}

/** Ressincroniza nome/papel/login com o banco (após restaurar a sessão ou editar o usuário). */
export function updateSessionUser({ nome, login, role } = {}) {
  if (!state) return null;
  const next = { ...state };
  if (nome !== undefined) next.nome = nome || '';
  if (login !== undefined) next.login = login || '';
  if (role !== undefined) next.role = role || null;
  commit(next, 'update');
  return getSession();
}

/** Atualiza lastActivityAt com throttle de 30 s (force ignora o throttle). */
export function touch({ force = false } = {}) {
  if (!state || state.locked) return false;
  const now = clock();
  const last = Date.parse(state.lastActivityAt) || 0;
  if (!force && now - last < TOUCH_THROTTLE_MS) return false;
  state = { ...state, lastActivityAt: new Date(now).toISOString() };
  persist();
  return true;
}

export function setInactivityMinutes(minutes) {
  const value = Number(minutes);
  inactivityMinutes = Number.isFinite(value) && value >= 0 ? value : DEFAULT_INACTIVITY_MINUTES;
  return inactivityMinutes;
}

export function getInactivityMinutes() {
  return inactivityMinutes;
}

/** Bloqueia por inatividade quando o limite foi atingido (0 desliga). Devolve o estado de bloqueio. */
export function checkInactivity() {
  if (!state) return false;
  if (state.locked) return true;
  if (!inactivityMinutes) return false;
  const last = Date.parse(state.lastActivityAt) || 0;
  if (clock() - last >= inactivityMinutes * 60000) {
    lock();
    return true;
  }
  return false;
}

export function lock() {
  if (!state || state.locked) return;
  commit({ ...state, locked: true }, 'lock');
}

/** Chamar somente após verificar a senha do mesmo usuário. */
export function unlock() {
  if (!state) return;
  commit({ ...state, locked: false, lastActivityAt: new Date(clock()).toISOString() }, 'unlock');
}

export function logout() {
  if (!state) return;
  commit(null, 'logout');
}

/** Trocar usuário: encerra a sessão atual e volta ao login (o motivo chega aos assinantes). */
export function switchUser() {
  if (!state) return;
  commit(null, 'switch-user');
}

/** Recupera a sessão espelhada após recarga da janela (o AuthGate a ressincroniza com o banco). */
export function restoreSession() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId) {
      store.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    state = {
      userId: String(parsed.userId),
      nome: parsed.nome || '',
      login: parsed.login || '',
      role: parsed.role || parsed.perfil || null,
      loginAt: parsed.loginAt || new Date(clock()).toISOString(),
      lastActivityAt: parsed.lastActivityAt || new Date(clock()).toISOString(),
      locked: Boolean(parsed.locked),
    };
    emit('restore');
    return getSession();
  } catch {
    return null;
  }
}

/** Ouve mudanças da sessão: listener(snapshot | null, reason). Devolve a função de cancelamento. */
export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Somente para gates: relógio injetável e limpeza total.
export function setSessionClockForTests(fn) {
  clock = typeof fn === 'function' ? fn : () => Date.now();
}

export function resetSessionForTests() {
  state = null;
  inactivityMinutes = DEFAULT_INACTIVITY_MINUTES;
  clock = () => Date.now();
  listeners.clear();
  persist();
}
