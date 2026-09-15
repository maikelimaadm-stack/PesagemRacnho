// Bloqueio temporário de login (ADR-035): 5 falhas → 30 s, somente em memória de runtime.
// O relógio é injetável para os gates avançarem o tempo sem esperar.

export const MAX_FAILURES = 5;
export const LOCK_MS = 30000;

function keyOf(login) {
  return String(login ?? '').trim().toLowerCase();
}

export function createLoginLockout({ maxFailures = MAX_FAILURES, lockMs = LOCK_MS, now = () => Date.now() } = {}) {
  const entries = new Map(); // login normalizado → { failures, until }

  function state(login) {
    const key = keyOf(login);
    const entry = entries.get(key);
    if (!entry || !entry.until) return { locked: false, until: null, remainingMs: 0, failures: entry?.failures || 0 };
    const current = now();
    if (current >= entry.until) {
      // Bloqueio expirado: o contador recomeça do zero.
      entries.delete(key);
      return { locked: false, until: null, remainingMs: 0, failures: 0 };
    }
    return { locked: true, until: entry.until, remainingMs: entry.until - current, failures: entry.failures };
  }

  return {
    maxFailures,
    lockMs,
    isLocked(login) {
      return state(login);
    },
    registerFailure(login) {
      const key = keyOf(login);
      const before = state(login);
      if (before.locked) return before;
      const entry = entries.get(key) || { failures: 0, until: null };
      entry.failures += 1;
      if (entry.failures >= maxFailures) entry.until = now() + lockMs;
      entries.set(key, entry);
      return state(login);
    },
    clear(login) {
      entries.delete(keyOf(login));
    },
    reset() {
      entries.clear();
    },
  };
}

// Instância padrão do processo (renderer). Os gates criam instâncias próprias com relógio falso.
export const defaultLoginLockout = createLoginLockout();

export function registerFailure(login) {
  return defaultLoginLockout.registerFailure(login);
}

export function isLocked(login) {
  return defaultLoginLockout.isLocked(login);
}

export function clearFailures(login) {
  defaultLoginLockout.clear(login);
}
