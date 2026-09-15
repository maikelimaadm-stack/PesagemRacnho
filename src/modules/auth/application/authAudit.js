// Auditoria de acesso (ADR-046, doc 11 §7): eventos resumidos na store `auditoria`
// com entidade 'usuarios' e acao ∈ ACCESS_EVENTS. Nunca grava senha, hash, salt ou
// recovery key — a linha é montada só com campos explícitos e ainda passa por um
// filtro de segredos. Gravações são best-effort quando a escrita está bloqueada
// pela migração (MIGRATION_BLOCKED): o login prossegue e o evento é descartado.
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { assertWritable } from '../../../storage/migrations/migrationState.js';
import { isMigrationBlocked } from '../domain/authErrors.js';
import { actorFields } from './auditContext.js';

export const AUDIT_ENTITY = 'usuarios';

export const ACCESS_EVENTS = Object.freeze({
  LOGIN_SUCESSO: 'LOGIN_SUCESSO',
  LOGOUT: 'LOGOUT',
  BLOQUEIO: 'BLOQUEIO',
  RESET_SENHA: 'RESET_SENHA',
  ALTERACAO_USUARIO: 'ALTERACAO_USUARIO',
});

const SECRET_KEY = /^(password_|recovery_|senha_)|^(senha|password|hash|salt|recovery_key|recoveryKey|temporaryPassword)$/i;

/** Remove qualquer nome de campo sigiloso de campos_alterados (fica o nome lógico, ex.: 'senha' → 'senha' é permitido só como rótulo). */
export function sanitizeChangedFields(fields = []) {
  return [...new Set(fields.map((field) => String(field)).map((field) => (SECRET_KEY.test(field) && field !== 'senha' ? 'senha' : field)))];
}

function assertNoSecrets(row) {
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_KEY.test(key)) throw new Error(`Auditoria de acesso não pode conter o campo ${key}.`);
    if (value && typeof value === 'object' && !Array.isArray(value)) assertNoSecrets(value);
  }
}

/**
 * Grava um evento de acesso. `usuario` é o alvo (entidade_id); `actor` é quem agiu
 * ({ id, nome }); sem ator usa a sessão atual (getActor) — sem sessão fica nulo.
 */
export async function recordAccessEvent({ acao, usuario, actor, resumo, campos_alterados = [], detalhes }) {
  if (!Object.values(ACCESS_EVENTS).includes(acao)) throw new Error(`Evento de acesso desconhecido: ${acao}`);
  const row = {
    id: crypto.randomUUID(),
    entidade: AUDIT_ENTITY,
    entidade_id: usuario?.id ? String(usuario.id) : null,
    acao,
    resumo: String(resumo || '').slice(0, 200),
    campos_alterados: sanitizeChangedFields(campos_alterados),
    ...actorFields(actor),
    created_at: new Date().toISOString(),
  };
  if (detalhes && typeof detalhes === 'object') row.detalhes = { ...detalhes };
  assertNoSecrets(row);
  assertWritable(`Auditoria de acesso (${acao})`);
  const db = await ensureStorageReady();
  await db.table('auditoria').add(row);
  return row;
}

/**
 * Best-effort: MIGRATION_BLOCKED nunca impede o fluxo (devolve null). Com
 * `swallowAll`, qualquer falha é tolerada (usado no logout, que não pode travar).
 */
export async function tryRecordAccessEvent(event, { swallowAll = false } = {}) {
  try {
    return await recordAccessEvent(event);
  } catch (err) {
    if (swallowAll || isMigrationBlocked(err)) return null;
    throw err;
  }
}
