// Erros e wrapper de handlers IPC (independente de banco).
class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

function ok(data) {
  return { ok: true, data };
}

function toIpcError(err) {
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message, details: err.details || {} } };
  }
  return { ok: false, error: { code: 'IPC_001', message: 'Erro interno', details: {} } };
}

function wrapIpcHandler(fn) {
  return async (...args) => {
    try {
      return ok(await fn(...args));
    } catch (err) {
      console.error('[ipc]', err);
      return toIpcError(err);
    }
  };
}

module.exports = { AppError, ok, toIpcError, wrapIpcHandler };
