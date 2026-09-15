// Serviço de autenticação local (ADR-041…046, doc 11 rev. 2). Store `usuarios` (Dexie v7).
// A senha nunca é persistida, logada nem devolvida: só password_hash/salt ficam na store
// e mesmo eles nunca saem deste módulo (toda saída passa por sanitize/toAuthResult).
// Bloqueio de tentativas PERSISTIDO no registro (failed_login_count/locked_until); limite
// e duração vêm de auth-policy. Recovery Key do ADMIN de bootstrap (ADR-044).
import { createRepository } from '../../../storage/indexedDb/repositories/genericRepository.js';
import { USERS_STORE } from '../../../storage/indexedDb/schema.js';
import { dummyPasswordRecord, hashPassword, toPasswordFields, verifyPassword } from '../domain/passwordHasher.js';
import {
  generateTemporaryPassword,
  getPasswordIterations,
  needsRehash,
  normalizeLogin,
  validatePassword,
} from '../domain/passwordPolicy.js';
import { generateRecoveryKey, hashRecoveryKey, toRecoveryFields, verifyRecoveryKey } from '../domain/recoveryKey.js';
import { ROLES, authorize, isRole, roleOf } from '../domain/permissionService.js';
import { AUTH_ERRORS, authError, isMigrationBlocked } from '../domain/authErrors.js';
import { ACCESS_EVENTS, tryRecordAccessEvent } from './authAudit.js';
import { AUTH_POLICY_DEFAULTS, getAuthPolicy } from '../../settings/application/appConfigService.js';

export { AUTH_ERRORS, normalizeLogin, validatePassword, ROLES };
export const EMPRESA_ID = 'local'; // ADR-029: empresa_id permanece 'local' até P-003
export const USERS_MANAGE_ACTION = 'users.manage';

const SECRET_PREFIXES = ['password_', 'recovery_'];
const users = createRepository(USERS_STORE);
let clock = () => Date.now();

const nowIso = () => new Date(clock()).toISOString();

function normalizeName(nome) {
  return String(nome ?? '').trim().replace(/\s+/g, ' ');
}

/** Projeção pública: nunca devolve password_*/recovery_*/localId. */
export function sanitize(row) {
  if (!row) return null;
  const safe = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'localId' || SECRET_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    safe[key] = value;
  }
  // `perfil` = alias somente-leitura de `role` para módulos que ainda leem actor.perfil
  // (catalog/registryAccess, maintenance). Remover quando esses módulos lerem `role`.
  safe.perfil = row.role ?? null;
  return safe;
}

/** Projeção mínima usada pela sessão/telas de acesso. */
export function toAuthResult(row) {
  return {
    id: row.id,
    nome: row.nome,
    login: row.login,
    role: row.role,
    perfil: row.role, // alias de compatibilidade (ver sanitize)
    must_change_password: Boolean(row.must_change_password),
  };
}

function selfActor(row) {
  return { id: row.id, nome: row.nome, role: row.role };
}

function validateLogin(login) {
  const normalized = normalizeLogin(login);
  if (!normalized || normalized.length > 60 || /\s/.test(normalized)) throw authError('AUTH_INVALID_DATA', { field: 'login' });
  return normalized;
}

function validateRole(role) {
  if (!isRole(role)) throw authError('AUTH_INVALID_DATA', { field: 'role', allowed: [...ROLES] });
  return role;
}

async function findByLogin(loginNormalizado) {
  const rows = await users.list({ login_normalizado: loginNormalizado });
  return rows[0] || null;
}

async function requireUser(id) {
  const row = id ? await users.get(id) : null;
  if (!row) throw authError('AUTH_NOT_FOUND');
  return row;
}

async function countActiveAdmins(excludeId = null) {
  const rows = await users.list({ role: 'ADMIN', ativo: true });
  return rows.filter((row) => row.id !== excludeId).length;
}

async function buildPasswordFields(senha) {
  return toPasswordFields(await hashPassword(senha));
}

async function buildRecoveryFields() {
  const recoveryKey = generateRecoveryKey();
  const fields = toRecoveryFields(await hashRecoveryKey(recoveryKey));
  return { recoveryKey, fields };
}

/** Política de bloqueio (auth-policy) com defaults quando o banco não responde. */
async function readAuthPolicy() {
  try {
    const policy = await getAuthPolicy(EMPRESA_ID);
    return { ...AUTH_POLICY_DEFAULTS, ...policy };
  } catch {
    return { ...AUTH_POLICY_DEFAULTS };
  }
}

/** Gravação tolerante ao bloqueio de migração (ADR-038): devolve null quando bloqueada. */
async function bestEffortUpdate(id, patch) {
  try {
    return await users.update(id, patch);
  } catch (err) {
    if (isMigrationBlocked(err)) return null;
    throw err;
  }
}

function lockStateOf(row, now = clock()) {
  const until = row?.locked_until ? Date.parse(row.locked_until) : NaN;
  const failures = Number(row?.failed_login_count) || 0;
  if (!Number.isFinite(until)) return { locked: false, until: null, remainingMs: 0, failures, expired: false };
  if (now >= until) return { locked: false, until: null, remainingMs: 0, failures: 0, expired: true };
  return { locked: true, until, remainingMs: until - now, failures, expired: false };
}

/** Registra uma falha de credencial no registro; bloqueia ao atingir o limite. */
async function registerFailure(row, policy, now) {
  const before = lockStateOf(row, now);
  const count = (before.expired ? 0 : before.failures) + 1;
  const patch = { failed_login_count: count, locked_until: before.expired ? null : row.locked_until ?? null };
  const limit = Math.max(1, Number(policy.failed_attempt_limit) || AUTH_POLICY_DEFAULTS.failed_attempt_limit);
  const lockMs = Math.max(1000, (Number(policy.lock_minutes) || AUTH_POLICY_DEFAULTS.lock_minutes) * 60000);
  let lockedUntil = null;
  if (count >= limit) {
    lockedUntil = now + lockMs;
    patch.locked_until = new Date(lockedUntil).toISOString();
  }
  await bestEffortUpdate(row.id, patch);
  if (lockedUntil) {
    await tryRecordAccessEvent({
      acao: ACCESS_EVENTS.BLOQUEIO,
      usuario: row,
      actor: selfActor(row),
      resumo: `Login ${row.login} bloqueado temporariamente após ${count} tentativas incorretas.`,
      detalhes: { tentativas: count, bloqueado_ate: patch.locked_until },
    });
    return { locked: true, until: lockedUntil, remainingMs: lockedUntil - now, failures: count };
  }
  return { locked: false, until: null, remainingMs: 0, failures: count };
}

/** Oráculo de tempo: login inexistente/inativo custa o mesmo que uma senha errada. */
async function burnDummyVerification(senha, iterations) {
  await verifyPassword(typeof senha === 'string' ? senha : '', dummyPasswordRecord(iterations || getPasswordIterations()));
}

// ---------------------------------------------------------------------------
// Bootstrap e autenticação
// ---------------------------------------------------------------------------

/** Usuários ativos e não excluídos. */
export async function countActiveUsers() {
  return users.count({ ativo: true });
}

/**
 * Primeira execução (ADR-044): cria o ADMIN inicial e devolve { user, recoveryKey }.
 * A key só existe nesta resposta; o banco guarda recovery_hash/recovery_salt.
 * Recusado quando já existe usuário ativo (AUTH_SETUP_DONE) — backup restaurado não faz bootstrap.
 */
export async function bootstrapFirstAdmin({ nome, login, senha }) {
  if ((await countActiveUsers()) > 0) throw authError('AUTH_SETUP_DONE');
  const nomeLimpo = normalizeName(nome);
  if (!nomeLimpo) throw authError('AUTH_INVALID_DATA', { field: 'nome' });
  const loginNormalizado = validateLogin(login);
  validatePassword(senha, loginNormalizado);
  if (await findByLogin(loginNormalizado)) throw authError('AUTH_LOGIN_EXISTS');
  const { recoveryKey, fields: recoveryFields } = await buildRecoveryFields();
  const created = await users.create({
    empresa_id: EMPRESA_ID,
    nome: nomeLimpo,
    login: String(login).trim(),
    login_normalizado: loginNormalizado,
    role: 'ADMIN',
    ativo: true,
    ...(await buildPasswordFields(senha)),
    must_change_password: false,
    ...recoveryFields,
    failed_login_count: 0,
    locked_until: null,
    last_login_at: null,
  });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.ALTERACAO_USUARIO,
    usuario: created,
    actor: null,
    resumo: `Administrador inicial ${created.login} criado na configuração inicial (chave de recuperação gerada).`,
    campos_alterados: ['nome', 'login', 'role', 'ativo'],
  });
  return { user: sanitize(created), recoveryKey };
}

/**
 * Autentica. Bloqueado → AUTH_LOCKED (until/remainingMs). Inexistente, inativo ou senha
 * errada → o mesmo AUTH_INVALID (inexistente/inativo pagam um verifyPassword fictício).
 * Sucesso zera falhas, faz rehash transparente se a política subiu e grava last_login_at
 * + LOGIN_SUCESSO (ambos best-effort sob bloqueio de migração).
 */
export async function authenticate(login, senha) {
  const loginNormalizado = normalizeLogin(login);
  const row = loginNormalizado ? await findByLogin(loginNormalizado) : null;
  if (!row || row.ativo !== true) {
    await burnDummyVerification(senha, row?.password_iterations);
    throw authError('AUTH_INVALID');
  }
  const now = clock();
  const lock = lockStateOf(row, now);
  if (lock.locked) throw authError('AUTH_LOCKED', { until: lock.until, remainingMs: lock.remainingMs });

  const ok = typeof senha === 'string' && (await verifyPassword(senha, row));
  if (!ok) {
    const after = await registerFailure(row, await readAuthPolicy(), now);
    throw authError('AUTH_INVALID', after.locked ? { until: after.until, remainingMs: after.remainingMs } : {});
  }

  const patch = { failed_login_count: 0, locked_until: null, last_login_at: new Date(now).toISOString() };
  if (needsRehash(row)) Object.assign(patch, await buildPasswordFields(senha));
  const updated = await bestEffortUpdate(row.id, patch);
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.LOGIN_SUCESSO,
    usuario: row,
    actor: selfActor(row),
    resumo: `Login de ${row.login} (${row.role}).`,
  });
  return toAuthResult(updated || { ...row, ...patch });
}

/** Projeção segura do usuário para revalidar a sessão (null se inativo/excluído). */
export async function findActiveUser(id) {
  const row = id ? await users.get(id) : null;
  return row && row.ativo === true ? toAuthResult(row) : null;
}

/** Estado do bloqueio temporário de um login (fonte: o registro no banco). */
export async function getLockState(login) {
  const row = await findByLogin(normalizeLogin(login));
  const state = lockStateOf(row, clock());
  return { locked: state.locked, until: state.until, remainingMs: state.remainingMs, failures: state.failures };
}

/** Encerramento de sessão (Sair / Trocar usuário): evento LOGOUT best-effort. */
export async function registerLogout(user, { motivo = 'SAIR' } = {}) {
  if (!user?.id) return null;
  return tryRecordAccessEvent({
    acao: ACCESS_EVENTS.LOGOUT,
    usuario: user,
    actor: { id: user.id, nome: user.nome },
    resumo: motivo === 'TROCAR_USUARIO' ? `Usuário ${user.login || user.nome} trocou de usuário.` : `Usuário ${user.login || user.nome} saiu.`,
  }, { swallowAll: true });
}

// ---------------------------------------------------------------------------
// Gestão de usuários (users.manage)
// ---------------------------------------------------------------------------

export async function createUser(actor, { nome, login, senha, role, perfil }) {
  authorize(roleOf(actor), USERS_MANAGE_ACTION);
  const nomeLimpo = normalizeName(nome);
  if (!nomeLimpo) throw authError('AUTH_INVALID_DATA', { field: 'nome' });
  const loginNormalizado = validateLogin(login);
  const papel = validateRole(role ?? perfil);
  validatePassword(senha, loginNormalizado);
  if (await findByLogin(loginNormalizado)) throw authError('AUTH_LOGIN_EXISTS');
  const created = await users.create({
    empresa_id: EMPRESA_ID,
    nome: nomeLimpo,
    login: String(login).trim(),
    login_normalizado: loginNormalizado,
    role: papel,
    ativo: true,
    ...(await buildPasswordFields(senha)),
    must_change_password: true,
    failed_login_count: 0,
    locked_until: null,
    last_login_at: null,
  });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.ALTERACAO_USUARIO,
    usuario: created,
    actor,
    resumo: `Usuário ${created.login} (${papel}) criado; troca de senha exigida no primeiro acesso.`,
    campos_alterados: ['nome', 'login', 'role', 'ativo', 'must_change_password'],
  });
  return sanitize(created);
}

/** Atualiza nome, papel e login (único). Nunca altera senha por aqui. */
export async function updateUser(actor, id, dados = {}) {
  authorize(roleOf(actor), USERS_MANAGE_ACTION);
  const row = await requireUser(id);
  const patch = {};
  const changed = [];
  if (dados.nome !== undefined) {
    const nomeLimpo = normalizeName(dados.nome);
    if (!nomeLimpo) throw authError('AUTH_INVALID_DATA', { field: 'nome' });
    if (nomeLimpo !== row.nome) { patch.nome = nomeLimpo; changed.push('nome'); }
  }
  if (dados.login !== undefined) {
    const loginNormalizado = validateLogin(dados.login);
    if (loginNormalizado !== row.login_normalizado) {
      const existing = await findByLogin(loginNormalizado);
      if (existing && existing.id !== row.id) throw authError('AUTH_LOGIN_EXISTS');
      patch.login = String(dados.login).trim();
      patch.login_normalizado = loginNormalizado;
      changed.push('login');
    } else if (String(dados.login).trim() !== row.login) {
      patch.login = String(dados.login).trim();
      changed.push('login');
    }
  }
  const novoPapel = dados.role ?? dados.perfil;
  if (novoPapel !== undefined) {
    validateRole(novoPapel);
    if (novoPapel !== row.role) {
      // Rebaixar o último ADMIN ativo deixaria o sistema sem administrador (mesma regra de setActive).
      if (row.role === 'ADMIN' && row.ativo && (await countActiveAdmins(row.id)) === 0) throw authError('AUTH_LAST_ADMIN');
      patch.role = novoPapel;
      changed.push('role');
    }
  }
  if (!changed.length) return sanitize(row);
  const updated = await users.update(row.id, patch);
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.ALTERACAO_USUARIO,
    usuario: row,
    actor,
    resumo: `Usuário ${updated.login} atualizado (${changed.join(', ')}).`,
    campos_alterados: changed,
  });
  return sanitize(updated);
}

/** Ativa/inativa. Nunca apaga fisicamente; recusa inativar o último ADMIN ativo. */
export async function setActive(actor, id, ativo) {
  authorize(roleOf(actor), USERS_MANAGE_ACTION);
  const row = await requireUser(id);
  const next = Boolean(ativo);
  if (row.ativo === next) return sanitize(row);
  if (!next && row.role === 'ADMIN' && (await countActiveAdmins(row.id)) === 0) throw authError('AUTH_LAST_ADMIN');
  const updated = await users.update(row.id, { ativo: next });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.ALTERACAO_USUARIO,
    usuario: row,
    actor,
    resumo: `Usuário ${row.login} ${next ? 'ativado' : 'inativado'}.`,
    campos_alterados: ['ativo'],
  });
  return sanitize(updated);
}

/**
 * Redefinição administrativa: nova senha (informada pelo ADMIN ou temporária gerada) e
 * troca obrigatória no próximo login. Zera o bloqueio. Devolve { user, temporaryPassword }:
 * `temporaryPassword` só vem preenchida quando foi gerada aqui (exibida uma única vez pela UI).
 */
export async function resetPassword(actor, id, novaSenha = null) {
  authorize(roleOf(actor), USERS_MANAGE_ACTION);
  const row = await requireUser(id);
  const generated = novaSenha == null || novaSenha === '';
  const senha = generated ? generateTemporaryPassword() : novaSenha;
  validatePassword(senha, row.login_normalizado);
  const updated = await users.update(row.id, {
    ...(await buildPasswordFields(senha)),
    must_change_password: true,
    failed_login_count: 0,
    locked_until: null,
  });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.RESET_SENHA,
    usuario: row,
    actor,
    resumo: `Senha do usuário ${row.login} redefinida${generated ? ' (temporária gerada)' : ''}; troca obrigatória no próximo acesso.`,
    campos_alterados: ['senha', 'must_change_password'],
  });
  return { user: sanitize(updated), temporaryPassword: generated ? senha : null };
}

/** Marca troca obrigatória sem alterar a senha atual. */
export async function forcePasswordChange(actor, id) {
  authorize(roleOf(actor), USERS_MANAGE_ACTION);
  const row = await requireUser(id);
  if (row.must_change_password) return sanitize(row);
  const updated = await users.update(row.id, { must_change_password: true });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.ALTERACAO_USUARIO,
    usuario: row,
    actor,
    resumo: `Troca de senha exigida para o usuário ${row.login}.`,
    campos_alterados: ['must_change_password'],
  });
  return sanitize(updated);
}

/** Troca da própria senha: confere a atual e libera a obrigatoriedade. */
export async function changeOwnPassword(userId, senhaAtual, novaSenha) {
  const row = await requireUser(userId);
  if (row.ativo !== true || typeof senhaAtual !== 'string' || !(await verifyPassword(senhaAtual, row))) throw authError('AUTH_INVALID');
  validatePassword(novaSenha, row.login_normalizado);
  const updated = await users.update(row.id, { ...(await buildPasswordFields(novaSenha)), must_change_password: false });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.ALTERACAO_USUARIO,
    usuario: row,
    actor: selfActor(row),
    resumo: `Usuário ${row.login} trocou a própria senha.`,
    campos_alterados: ['senha', 'must_change_password'],
  });
  return toAuthResult(updated);
}

/** Lista usuários (inclusive inativos) sem hash/salt/recovery. */
export async function listUsers(actor) {
  authorize(roleOf(actor), USERS_MANAGE_ACTION);
  const rows = await users.list({ orderBy: 'nome' });
  return rows.map(sanitize);
}

// ---------------------------------------------------------------------------
// Recuperação do ADMIN (ADR-044)
// ---------------------------------------------------------------------------

/**
 * Redefine a senha do ADMIN de bootstrap com a Recovery Key. Key inválida conta como
 * falha (mesmo bloqueio do login). Sucesso: nova senha, key anterior invalidada e uma
 * NOVA key gerada e devolvida uma única vez: { user, recoveryKey }.
 */
export async function recoverAdminPassword({ login, recoveryKey, novaSenha }) {
  const loginNormalizado = normalizeLogin(login);
  const row = loginNormalizado ? await findByLogin(loginNormalizado) : null;
  const eligible = row && row.ativo === true && row.role === 'ADMIN' && row.recovery_hash && row.recovery_salt;
  if (!eligible) {
    await burnDummyVerification(String(recoveryKey ?? ''), row?.recovery_iterations);
    throw authError('AUTH_RECOVERY_INVALID');
  }
  const now = clock();
  const lock = lockStateOf(row, now);
  if (lock.locked) throw authError('AUTH_LOCKED', { until: lock.until, remainingMs: lock.remainingMs });

  const ok = await verifyRecoveryKey(recoveryKey, row);
  if (!ok) {
    const after = await registerFailure(row, await readAuthPolicy(), now);
    throw authError('AUTH_RECOVERY_INVALID', after.locked ? { until: after.until, remainingMs: after.remainingMs } : {});
  }
  validatePassword(novaSenha, row.login_normalizado);
  const next = await buildRecoveryFields();
  const updated = await users.update(row.id, {
    ...(await buildPasswordFields(novaSenha)),
    ...next.fields,
    must_change_password: false,
    failed_login_count: 0,
    locked_until: null,
  });
  await tryRecordAccessEvent({
    acao: ACCESS_EVENTS.RESET_SENHA,
    usuario: row,
    actor: selfActor(row),
    resumo: `Senha do administrador ${row.login} redefinida pela chave de recuperação; nova chave gerada.`,
    campos_alterados: ['senha', 'recovery'],
  });
  return { user: toAuthResult(updated), recoveryKey: next.recoveryKey };
}

// Somente para gates: relógio injetável (bloqueio temporário sem esperar).
export function setAuthClockForTests(fn) {
  clock = typeof fn === 'function' ? fn : () => Date.now();
}
