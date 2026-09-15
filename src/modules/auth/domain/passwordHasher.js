// Hash de senha local (ADR-043): PBKDF2-HMAC-SHA-256 via Web Crypto, sem módulo nativo.
// Funciona no renderer (Electron/Chromium) e no Node dos gates (globalThis.crypto.subtle).
// Contrato: docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md §3 (passwordHasher.js).
import { PASSWORD_ALGORITHM, PASSWORD_VERSION, PBKDF2_ITERATIONS, getPasswordIterations } from './passwordPolicy.js';

export { PASSWORD_ALGORITHM, PASSWORD_VERSION, PBKDF2_ITERATIONS };
export const SALT_BYTES = 16;
export const HASH_BYTES = 32;

const textEncoder = new TextEncoder();

function subtle() {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('Web Crypto (crypto.subtle) indisponível neste ambiente.');
  return api;
}

function randomBytes(size) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text) {
  const binary = atob(String(text || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveBits(secret, saltBytes, iterations) {
  const key = await subtle().importKey('raw', textEncoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

// Comparação em tempo constante: percorre sempre o maior comprimento e acumula por XOR.
export function constantTimeEqual(a, b) {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Gera o registro de senha: { algorithm, salt (base64), iterations, hash (base64), version }.
 * `iterations` só existe para testes; o serviço usa getPasswordIterations() (política).
 */
export async function hashPassword(password, { iterations = getPasswordIterations(), salt } = {}) {
  if (typeof password !== 'string' || !password.length) throw new TypeError('Senha inválida para hash.');
  const count = Number(iterations);
  if (!Number.isInteger(count) || count < 1) throw new TypeError('Número de iterações inválido.');
  const saltBytes = salt ? fromBase64(salt) : randomBytes(SALT_BYTES);
  const hash = await deriveBits(password, saltBytes, count);
  return { algorithm: PASSWORD_ALGORITHM, salt: toBase64(saltBytes), iterations: count, hash: toBase64(hash), version: PASSWORD_VERSION };
}

/** Converte o registro do hasher nos campos persistidos da store `usuarios`. */
export function toPasswordFields(record) {
  return {
    password_hash: record.hash,
    password_salt: record.salt,
    password_algorithm: record.algorithm,
    password_iterations: record.iterations,
    password_version: record.version,
  };
}

/**
 * Confere a senha contra { hash, salt, iterations, algorithm } ou contra a linha
 * persistida { password_hash, password_salt, password_iterations, password_algorithm }.
 * Nunca lança por dado ausente: devolve false.
 */
export async function verifyPassword(password, record) {
  if (typeof password !== 'string' || !record) return false;
  const hash = record.hash ?? record.password_hash;
  const salt = record.salt ?? record.password_salt;
  const iterations = Number(record.iterations ?? record.password_iterations);
  const algorithm = record.algorithm ?? record.password_algorithm ?? PASSWORD_ALGORITHM;
  if (!hash || !salt || !Number.isInteger(iterations) || iterations < 1 || algorithm !== PASSWORD_ALGORITHM) return false;
  let expected;
  let saltBytes;
  try {
    expected = fromBase64(hash);
    saltBytes = fromBase64(salt);
  } catch {
    return false;
  }
  const actual = await deriveBits(password, saltBytes, iterations);
  return constantTimeEqual(actual, expected);
}

/**
 * Registro fictício FIXO usado quando o login não existe ou está inativo: o serviço
 * executa verifyPassword contra ele antes de responder AUTH_INVALID, para que o tempo
 * de resposta não revele se o login existe (oráculo de tempo). Nenhuma senha real
 * corresponde a este hash (hash arbitrário, não derivado de senha).
 */
export function dummyPasswordRecord(iterations = getPasswordIterations()) {
  return {
    hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    salt: 'cGVzYWdlbnMtZHVtbXktc2FsdA==', // "pesagens-dummy-salt" fixo
    iterations,
    algorithm: PASSWORD_ALGORITHM,
  };
}
