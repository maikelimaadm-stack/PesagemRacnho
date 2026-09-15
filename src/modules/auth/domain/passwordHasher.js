// Hash de senha local (ADR-035): PBKDF2-SHA256 via Web Crypto, sem módulo nativo.
// Funciona no renderer (Electron/Chromium) e no Node 24 dos gates (globalThis.crypto.subtle).
// Contrato: docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md §2.1.

export const PASSWORD_ALGORITHM = 'PBKDF2-SHA256';
export const PBKDF2_ITERATIONS = 310000;
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

async function deriveBits(password, saltBytes, iteracoes) {
  const key = await subtle().importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: iteracoes },
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
 * Gera o registro de senha: { algoritmo, salt (base64), iteracoes, hash (base64) }.
 * `iteracoes` só existe para testes rápidos; o serviço fixa PBKDF2_ITERATIONS.
 */
export async function hashPassword(password, { iteracoes = PBKDF2_ITERATIONS, salt } = {}) {
  if (typeof password !== 'string' || !password.length) throw new TypeError('Senha inválida para hash.');
  const iterations = Number(iteracoes);
  if (!Number.isInteger(iterations) || iterations < 1) throw new TypeError('Número de iterações inválido.');
  const saltBytes = salt ? fromBase64(salt) : randomBytes(SALT_BYTES);
  const hash = await deriveBits(password, saltBytes, iterations);
  return { algoritmo: PASSWORD_ALGORITHM, salt: toBase64(saltBytes), iteracoes: iterations, hash: toBase64(hash) };
}

/**
 * Confere a senha contra um registro { hash, salt, iteracoes } ou contra a linha
 * persistida { senha_hash, senha_salt, senha_iteracoes }. Nunca lança por dado ausente: devolve false.
 */
export async function verifyPassword(password, record) {
  if (typeof password !== 'string' || !record) return false;
  const hash = record.hash ?? record.senha_hash;
  const salt = record.salt ?? record.senha_salt;
  const iteracoes = Number(record.iteracoes ?? record.senha_iteracoes);
  const algoritmo = record.algoritmo ?? record.senha_algoritmo ?? PASSWORD_ALGORITHM;
  if (!hash || !salt || !Number.isInteger(iteracoes) || iteracoes < 1 || algoritmo !== PASSWORD_ALGORITHM) return false;
  let expected;
  let saltBytes;
  try {
    expected = fromBase64(hash);
    saltBytes = fromBase64(salt);
  } catch {
    return false;
  }
  const actual = await deriveBits(password, saltBytes, iteracoes);
  return constantTimeEqual(actual, expected);
}
