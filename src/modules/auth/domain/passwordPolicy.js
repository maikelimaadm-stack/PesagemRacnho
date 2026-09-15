// Política de senha e parâmetros de custo (doc 11 rev. 2 §2/§3, ADR-043).
// Tudo o que define "quão caro" é um hash fica aqui, versionado: mudar o custo
// (ou o algoritmo) incrementa PASSWORD_VERSION e o login faz o rehash transparente.
import { authError } from './authErrors.js';

export const PASSWORD_ALGORITHM = 'PBKDF2-SHA256';
export const PBKDF2_ITERATIONS = 310000;
export const PASSWORD_VERSION = 1;
export const MIN_PASSWORD_LENGTH = 6;
export const TRIVIAL_PASSWORDS = Object.freeze(['123', '1234', '12345', '123456', '1234567', '12345678', 'admin', 'senha', 'password', '000000', '111111', 'abcdef', 'qwerty']);

// Alfabeto sem caracteres ambíguos (0/O, 1/I/l) para senhas temporárias ditadas ou anotadas.
export const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export const TEMPORARY_PASSWORD_LENGTH = 8;

// Override exclusivo dos gates (PBKDF2 a 310 000 iterações leva centenas de ms por chamada).
let iterationsOverride = null;

/** Iterações que o serviço grava em senhas novas (política atual). */
export function getPasswordIterations() {
  return iterationsOverride ?? PBKDF2_ITERATIONS;
}

export function setPasswordPolicyForTests({ iterations } = {}) {
  const value = Number(iterations);
  iterationsOverride = Number.isInteger(value) && value >= 1 ? value : null;
  return getPasswordIterations();
}

export function normalizeLogin(login) {
  return String(login ?? '').trim().toLowerCase();
}

/** Regras de senha (doc 11 §1): mínimo 6, nada trivial, diferente do login. Lança AUTH_WEAK_PASSWORD. */
export function validatePassword(senha, login = '') {
  if (typeof senha !== 'string' || senha.length < MIN_PASSWORD_LENGTH) throw authError('AUTH_WEAK_PASSWORD');
  const lower = senha.trim().toLowerCase();
  if (TRIVIAL_PASSWORDS.includes(lower)) throw authError('AUTH_WEAK_PASSWORD');
  if (login && lower === normalizeLogin(login)) throw authError('AUTH_WEAK_PASSWORD');
  return true;
}

/**
 * Um registro persistido precisa de rehash quando ficou abaixo da política atual
 * (menos iterações, versão anterior ou algoritmo diferente). Só se aplica após a
 * senha ter sido verificada com sucesso — o rehash nunca "conserta" um hash inválido.
 */
export function needsRehash(record) {
  if (!record) return false;
  const iterations = Number(record.password_iterations ?? record.iterations);
  const version = Number(record.password_version ?? record.version ?? 0);
  const algorithm = record.password_algorithm ?? record.algorithm;
  return algorithm !== PASSWORD_ALGORITHM
    || !Number.isInteger(iterations)
    || iterations < getPasswordIterations()
    || !Number.isInteger(version)
    || version < PASSWORD_VERSION;
}

function randomIndexes(count, modulo) {
  const bytes = new Uint8Array(count);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte % modulo);
}

/** Senha temporária legível (8 caracteres), sempre válida pela própria política. */
export function generateTemporaryPassword(length = TEMPORARY_PASSWORD_LENGTH) {
  const size = Math.max(MIN_PASSWORD_LENGTH, Number(length) || TEMPORARY_PASSWORD_LENGTH);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomIndexes(size, TEMPORARY_PASSWORD_ALPHABET.length).map((i) => TEMPORARY_PASSWORD_ALPHABET[i]).join('');
    try {
      validatePassword(candidate);
      return candidate;
    } catch {
      // Colisão improvável com a lista trivial: sorteia de novo.
    }
  }
  throw new Error('Não foi possível gerar uma senha temporária.');
}
