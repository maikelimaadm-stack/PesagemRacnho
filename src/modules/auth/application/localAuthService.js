// Serviço de autenticação local (ADR-035/036). Store `usuariosLocais` (Dexie v7).
// A senha nunca é persistida, logada nem devolvida: só hash/salt ficam na store e
// mesmo eles nunca saem deste módulo (listUsers e authenticate devolvem projeções).
import { createRepository } from '../../../storage/indexedDb/repositories/genericRepository.js';
import { ensureStorageReady } from '../../../storage/indexedDb/db.js';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS } from '../domain/passwordHasher.js';
import { assertCan, isProfile, PROFILES } from '../domain/accessPolicy.js';
import { defaultLoginLockout } from '../domain/loginLockout.js';
import { actorFields } from './auditContext.js';

export const EMPRESA_ID = 'local'; // ADR-029: empresa_id permanece 'local' até P-003
export const MIN_PASSWORD_LENGTH = 6;
export const TRIVIAL_PASSWORDS = Object.freeze(['123', '1234', '12345', '123456', 'admin', 'senha']);
const SECRET_FIELDS = ['senha_hash', 'senha_salt', 'senha_iteracoes', 'senha_algoritmo', 'localId'];

const users = createRepository('usuariosLocais');
let lockout = defaultLoginLockout;

export const AUTH_ERRORS = Object.freeze({
  AUTH_INVALID: 'Login ou senha inválidos.',
  AUTH_LOCKED: 'Muitas tentativas incorretas. Aguarde para tentar novamente.',
  AUTH_FORBIDDEN: 'Seu perfil não permite esta ação.',
  AUTH_LAST_ADMIN: 'Não é possível inativar ou rebaixar o último administrador ativo.',
  AUTH_LOGIN_EXISTS: 'Já existe um usuário com este login.',
  AUTH_WEAK_PASSWORD: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres e não pode ser trivial nem igual ao login.`,
  AUTH_SETUP_DONE: 'A configuração inicial já foi concluída.',
  AUTH_NOT_FOUND: 'Usuário não encontrado.',
  AUTH_INVALID_DATA: 'Dados do usuário inválidos.',
});

function authError(code, extra = {}) {
  const error = new Error(AUTH_ERRORS[code] || code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeLogin(login) {
  return String(login ?? '').trim().toLowerCase();
}

function normalizeName(nome) {
  return String(nome ?? '').trim().replace(/\s+/g, ' ');
}

function sanitize(row) {
  if (!row) return null;
  const safe = { ...row };
  for (const field of SECRET_FIELDS) delete safe[field];
  return safe;
}

function toAuthResult(row) {
  return { id: row.id, nome: row.nome, login: row.login, perfil: row.perfil, deve_trocar_senha: Boolean(row.deve_trocar_senha) };
}

/** Regras de senha (doc 11 §2.3): mínimo 6, nada trivial, diferente do login. */
export function validatePassword(senha, login = '') {
  if (typeof senha !== 'string' || senha.length < MIN_PASSWORD_LENGTH) throw authError('AUTH_WEAK_PASSWORD');
  const lower = senha.trim().toLowerCase();
  if (TRIVIAL_PASSWORDS.includes(lower)) throw authError('AUTH_WEAK_PASSWORD');
  if (login && lower === normalizeLogin(login)) throw authError('AUTH_WEAK_PASSWORD');
  return true;
}

function validateLogin(login) {
  const normalized = normalizeLogin(login);
  if (!normalized || /\s/.test(normalized)) throw authError('AUTH_INVALID_DATA', { field: 'login' });
  return normalized;
}

function validateProfile(perfil) {
  if (!isProfile(perfil)) throw authError('AUTH_INVALID_DATA', { field: 'perfil', allowed: [...PROFILES] });
  return perfil;
}

async function findByLogin(loginNormalizado) {
  const rows = await users.list({ login_normalizado: loginNormalizado });
  return rows[0] || null;
}

async function requireUser(id) {
  const row = await users.get(id);
  if (!row) throw authError('AUTH_NOT_FOUND');
  return row;
}

async function countActiveAdmins(excludeId = null) {
  const rows = await users.list({ perfil: 'ADMIN', ativo: true });
  return rows.filter((row) => row.id !== excludeId).length;
}

// Auditoria por usuário (ADR-036): nunca inclui hash/salt; resumo em texto curto.
async function audit({ acao, entidade_id, actor, resumo, campos_alterados = [] }) {
  const db = await ensureStorageReady();
  await db.table('auditoria').add({
    id: crypto.randomUUID(),
    entidade: 'usuariosLocais',
    entidade_id,
    acao,
    resumo,
    campos_alterados,
    ...actorFields(actor),
    created_at: nowIso(),
  });
}

async function buildPasswordFields(senha) {
  // O serviço fixa o número de iterações; o parâmetro do hasher existe só para testes.
  const record = await hashPassword(senha, { iteracoes: PBKDF2_ITERATIONS });
  return { senha_hash: record.hash, senha_salt: record.salt, senha_iteracoes: record.iteracoes, senha_algoritmo: record.algoritmo };
}

/** Usuários ativos e não excluídos. */
export async function countActiveUsers() {
  return users.count({ ativo: true });
}

/** Primeira execução: cria o ADMIN inicial. Recusado quando já existe usuário ativo (AUTH_SETUP_DONE). */
export async function createInitialAdmin({ nome, login, senha }) {
  if ((await countActiveUsers()) > 0) throw authError('AUTH_SETUP_DONE');
  const nomeLimpo = normalizeName(nome);
  if (!nomeLimpo) throw authError('AUTH_INVALID_DATA', { field: 'nome' });
  const loginNormalizado = validateLogin(login);
  validatePassword(senha, loginNormalizado);
  if (await findByLogin(loginNormalizado)) throw authError('AUTH_LOGIN_EXISTS');
  const created = await users.create({
    empresa_id: EMPRESA_ID,
    nome: nomeLimpo,
    login: String(login).trim(),
    login_normalizado: loginNormalizado,
    ...(await buildPasswordFields(senha)),
    perfil: 'ADMIN',
    ativo: true,
    deve_trocar_senha: false,
    ultimo_login_at: null,
  });
  await audit({ acao: 'CRIAR', entidade_id: created.id, actor: null, resumo: `Administrador inicial ${created.login} criado na configuração inicial.` });
  return sanitize(created);
}

/**
 * Autentica. Bloqueado → AUTH_LOCKED (com until). Inexistente, inativo ou senha errada →
 * o mesmo AUTH_INVALID (e conta como falha). Sucesso zera falhas e grava ultimo_login_at.
 */
export async function authenticate(login, senha) {
  const loginNormalizado = normalizeLogin(login);
  const lockState = lockout.isLocked(loginNormalizado);
  if (lockState.locked) throw authError('AUTH_LOCKED', { until: lockState.until, remainingMs: lockState.remainingMs });

  const row = loginNormalizado ? await findByLogin(loginNormalizado) : null;
  const ok = row && row.ativo === true && typeof senha === 'string' && (await verifyPassword(senha, row));
  if (!ok) {
    const after = lockout.registerFailure(loginNormalizado);
    throw authError('AUTH_INVALID', after.locked ? { until: after.until, remainingMs: after.remainingMs } : {});
  }
  lockout.clear(loginNormalizado);
  const updated = await users.update(row.id, { ultimo_login_at: nowIso() });
  return toAuthResult(updated || row);
}

/** Projeção segura do usuário para revalidar a sessão (null se inativo/excluído). */
export async function findActiveUser(id) {
  const row = id ? await users.get(id) : null;
  return row && row.ativo === true ? toAuthResult(row) : null;
}

export async function createUser(actor, { nome, login, senha, perfil }) {
  assertCan(actor?.perfil, 'users.manage');
  const nomeLimpo = normalizeName(nome);
  if (!nomeLimpo) throw authError('AUTH_INVALID_DATA', { field: 'nome' });
  const loginNormalizado = validateLogin(login);
  validateProfile(perfil);
  validatePassword(senha, loginNormalizado);
  if (await findByLogin(loginNormalizado)) throw authError('AUTH_LOGIN_EXISTS');
  const created = await users.create({
    empresa_id: EMPRESA_ID,
    nome: nomeLimpo,
    login: String(login).trim(),
    login_normalizado: loginNormalizado,
    ...(await buildPasswordFields(senha)),
    perfil,
    ativo: true,
    deve_trocar_senha: true,
    ultimo_login_at: null,
  });
  await audit({ acao: 'CRIAR', entidade_id: created.id, actor, resumo: `Usuário ${created.login} (${perfil}) criado.` });
  return sanitize(created);
}

/** Atualiza nome, perfil e login (único). Nunca altera senha por aqui. */
export async function updateUser(actor, id, dados = {}) {
  assertCan(actor?.perfil, 'users.manage');
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
  if (dados.perfil !== undefined) {
    validateProfile(dados.perfil);
    if (dados.perfil !== row.perfil) {
      // Rebaixar o último ADMIN ativo deixaria o sistema sem administrador (mesma regra de setActive).
      if (row.perfil === 'ADMIN' && row.ativo && (await countActiveAdmins(row.id)) === 0) throw authError('AUTH_LAST_ADMIN');
      patch.perfil = dados.perfil;
      changed.push('perfil');
    }
  }
  if (!changed.length) return sanitize(row);
  const updated = await users.update(row.id, patch);
  await audit({ acao: 'ATUALIZAR', entidade_id: row.id, actor, resumo: `Usuário ${updated.login} atualizado (${changed.join(', ')}).`, campos_alterados: changed });
  return sanitize(updated);
}

/** Ativa/inativa. Nunca apaga fisicamente; recusa inativar o último ADMIN ativo. */
export async function setActive(actor, id, ativo) {
  assertCan(actor?.perfil, 'users.manage');
  const row = await requireUser(id);
  const next = Boolean(ativo);
  if (row.ativo === next) return sanitize(row);
  if (!next && row.perfil === 'ADMIN' && (await countActiveAdmins(row.id)) === 0) throw authError('AUTH_LAST_ADMIN');
  const updated = await users.update(row.id, { ativo: next });
  await audit({ acao: next ? 'ATIVAR' : 'INATIVAR', entidade_id: row.id, actor, resumo: `Usuário ${row.login} ${next ? 'ativado' : 'inativado'}.`, campos_alterados: ['ativo'] });
  return sanitize(updated);
}

/** Redefinição administrativa: nova senha e troca obrigatória no próximo login. */
export async function resetPassword(actor, id, novaSenha) {
  assertCan(actor?.perfil, 'users.manage');
  const row = await requireUser(id);
  validatePassword(novaSenha, row.login_normalizado);
  const updated = await users.update(row.id, { ...(await buildPasswordFields(novaSenha)), deve_trocar_senha: true });
  lockout.clear(row.login_normalizado);
  await audit({ acao: 'REDEFINIR_SENHA', entidade_id: row.id, actor, resumo: `Senha do usuário ${row.login} redefinida; troca obrigatória no próximo acesso.`, campos_alterados: ['senha', 'deve_trocar_senha'] });
  return sanitize(updated);
}

/** Marca troca obrigatória sem alterar a senha atual. */
export async function forcePasswordChange(actor, id) {
  assertCan(actor?.perfil, 'users.manage');
  const row = await requireUser(id);
  if (row.deve_trocar_senha) return sanitize(row);
  const updated = await users.update(row.id, { deve_trocar_senha: true });
  await audit({ acao: 'EXIGIR_TROCA_SENHA', entidade_id: row.id, actor, resumo: `Troca de senha exigida para o usuário ${row.login}.`, campos_alterados: ['deve_trocar_senha'] });
  return sanitize(updated);
}

/** Troca da própria senha: confere a atual e libera a obrigatoriedade. */
export async function changeOwnPassword(userId, senhaAtual, novaSenha) {
  const row = await requireUser(userId);
  if (row.ativo !== true || typeof senhaAtual !== 'string' || !(await verifyPassword(senhaAtual, row))) throw authError('AUTH_INVALID');
  validatePassword(novaSenha, row.login_normalizado);
  const updated = await users.update(row.id, { ...(await buildPasswordFields(novaSenha)), deve_trocar_senha: false });
  await audit({ acao: 'TROCAR_SENHA', entidade_id: row.id, actor: { id: row.id, nome: row.nome, perfil: row.perfil }, resumo: `Usuário ${row.login} trocou a própria senha.`, campos_alterados: ['senha', 'deve_trocar_senha'] });
  return toAuthResult(updated);
}

/** Lista usuários (inclusive inativos) sem hash/salt. */
export async function listUsers(actor) {
  assertCan(actor?.perfil, 'users.manage');
  const rows = await users.list({ orderBy: 'nome' });
  return rows.map(sanitize);
}

/** Estado do bloqueio temporário de um login (para a contagem regressiva da UI). */
export function getLockState(login) {
  return lockout.isLocked(normalizeLogin(login));
}

// Somente para gates/integração: troca a instância de bloqueio (relógio injetável).
export function setLoginLockout(instance) {
  lockout = instance || defaultLoginLockout;
}
