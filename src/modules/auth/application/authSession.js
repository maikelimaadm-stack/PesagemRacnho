// Sessão autenticada (ADR-035): estado em memória + espelho em sessionStorage
// ('pesagens.auth.session') para sobreviver à recarga da janela, não ao fechamento do app.
// Registra o provedor de ator da auditoria (storage/indexedDb/auditActor.js).
import { setActorProvider } from '../../../storage/indexedDb/auditActor.js';

export const SESSION_STORAGE_KEY = 'pesagens.auth.session';
export const TOUCH_THROTTLE_MS = 30000;
export const DEFAULT_INACTIVITY_MINUTES = 60;

let state = null; // { userId, nome, perfil, loginAt, lastActivityAt, locked }
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

function emit() {
  const snapshot = getSession();
  for (const listener of listeners) {
    try { listener(snapshot); } catch { /* ouvinte não pode derrubar a sessão */ }
  }
}

function commit(next) {
  state = next;
  persist();
  emit();
}

setActorProvider(() => (state
  ? { actor_user_id: state.userId, actor_user_name: state.nome, actor_user_profile: state.perfil }
  : null));

/** Inicia a sessão após autenticação bem-sucedida. */
export function startSession({ id, nome, perfil }) {
  if (!id) throw new Error('Sessão exige o id do usuário.');
  const now = new Date(clock()).toISOString();
  commit({ userId: String(id), nome: nome || '', perfil: perfil || null, loginAt: now, lastActivityAt: now, locked: false });
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

/** Ator para os serviços ({ id, nome, perfil }) ou null. */
export function getSessionActor() {
  return state ? { id: state.userId, nome: state.nome, perfil: state.perfil } : null;
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
  commit({ ...state, locked: true });
}

/** Chamar somente após verificar a senha do mesmo usuário. */
export function unlock() {
  if (!state) return;
  commit({ ...state, locked: false, lastActivityAt: new Date(clock()).toISOString() });
}

export function logout() {
  if (!state) return;
  commit(null);
}

/** Recupera a sessão espelhada após recarga da janela. */
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
      perfil: parsed.perfil || null,
      loginAt: parsed.loginAt || new Date(clock()).toISOString(),
      lastActivityAt: parsed.lastActivityAt || new Date(clock()).toISOString(),
      locked: Boolean(parsed.locked),
    };
    emit();
    return getSession();
  } catch {
    return null;
  }
}

/** Ouve mudanças da sessão (login, bloqueio, saída). Devolve a função de cancelamento. */
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
