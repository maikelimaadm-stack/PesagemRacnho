// Recovery Key do ADMIN de bootstrap (ADR-044). Texto legível em 5 grupos de 5
// caracteres sem ambiguidade (sem 0/O e 1/I/L). O banco guarda só o verificador
// (recovery_hash + recovery_salt, PBKDF2 com salt próprio); a key existe apenas na
// resposta do bootstrap/recuperação e nunca vai para auditoria, log ou storage.
import { constantTimeEqual, deriveBits, fromBase64, toBase64 } from './passwordHasher.js';
import { PASSWORD_ALGORITHM, getPasswordIterations } from './passwordPolicy.js';

export const RECOVERY_KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const RECOVERY_KEY_GROUPS = 5;
export const RECOVERY_KEY_GROUP_SIZE = 5;
export const RECOVERY_KEY_SEPARATOR = '-';
export const RECOVERY_SALT_BYTES = 16;

const KEY_LENGTH = RECOVERY_KEY_GROUPS * RECOVERY_KEY_GROUP_SIZE;

function randomChars(count) {
  // Rejeição de amostras para não enviesar o alfabeto (31 símbolos não dividem 256).
  const out = [];
  const limit = 256 - (256 % RECOVERY_KEY_ALPHABET.length);
  while (out.length < count) {
    const bytes = new Uint8Array(count * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit) out.push(RECOVERY_KEY_ALPHABET[byte % RECOVERY_KEY_ALPHABET.length]);
      if (out.length === count) break;
    }
  }
  return out.join('');
}

export function formatRecoveryKey(raw) {
  const groups = [];
  for (let i = 0; i < raw.length; i += RECOVERY_KEY_GROUP_SIZE) groups.push(raw.slice(i, i + RECOVERY_KEY_GROUP_SIZE));
  return groups.join(RECOVERY_KEY_SEPARATOR);
}

/** Ex.: "7KQ2M-XT9RA-BC4HN-P8WVD-3GZJ5". */
export function generateRecoveryKey() {
  return formatRecoveryKey(randomChars(KEY_LENGTH));
}

/**
 * Forma canônica digitada pelo usuário: maiúsculas, sem espaços/hífens, O→0 e I/L→1
 * corrigidos para o alfabeto (0 e 1 não existem nele: devolve null quando inválida).
 */
export function normalizeRecoveryKey(text) {
  const compact = String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length !== KEY_LENGTH) return null;
  for (const char of compact) if (!RECOVERY_KEY_ALPHABET.includes(char)) return null;
  return compact;
}

export function isRecoveryKeyFormat(text) {
  return normalizeRecoveryKey(text) !== null;
}

/** Verificador da key: { hash, salt, iterations, algorithm } (PBKDF2, salt próprio de 16 bytes). */
export async function hashRecoveryKey(key, { iterations = getPasswordIterations(), salt } = {}) {
  const normalized = normalizeRecoveryKey(key);
  if (!normalized) throw new TypeError('Chave de recuperação inválida para hash.');
  const saltBytes = salt ? fromBase64(salt) : (() => {
    const bytes = new Uint8Array(RECOVERY_SALT_BYTES);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  })();
  const hash = await deriveBits(normalized, saltBytes, iterations);
  return { algorithm: PASSWORD_ALGORITHM, salt: toBase64(saltBytes), iterations, hash: toBase64(hash) };
}

/** Campos persistidos no ADMIN de bootstrap (doc 11 §2). */
export function toRecoveryFields(record) {
  return { recovery_hash: record.hash, recovery_salt: record.salt, recovery_iterations: record.iterations };
}

/**
 * Confere a key contra { hash, salt, iterations } ou contra a linha persistida
 * { recovery_hash, recovery_salt, recovery_iterations }. Nunca lança: devolve false.
 */
export async function verifyRecoveryKey(key, record) {
  const normalized = normalizeRecoveryKey(key);
  if (!normalized || !record) return false;
  const hash = record.hash ?? record.recovery_hash;
  const salt = record.salt ?? record.recovery_salt;
  const iterations = Number(record.iterations ?? record.recovery_iterations ?? getPasswordIterations());
  if (!hash || !salt || !Number.isInteger(iterations) || iterations < 1) return false;
  let expected;
  let saltBytes;
  try {
    expected = fromBase64(hash);
    saltBytes = fromBase64(salt);
  } catch {
    return false;
  }
  const actual = await deriveBits(normalized, saltBytes, iterations);
  return constantTimeEqual(actual, expected);
}
