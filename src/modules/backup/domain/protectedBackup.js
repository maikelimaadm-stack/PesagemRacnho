// Backup PROTEGIDO por senha (F22, P26): envelope com criptografia AUTENTICADA (AES-GCM 256) e chave derivada
// da senha (PBKDF2-SHA-256, 310.000 iterações, salt e nonce aleatórios por arquivo). A senha nunca é gravada.
// SHA-256 garante integridade, não confidencialidade: só este envelope protege o conteúdo. Senha errada ou
// arquivo alterado = falha de autenticação (nada é restaurado). Leitor dos backups JSON antigos continua igual.
export const PROTECTED_FORMAT = 'pesagens-backup-protegido';
export const PROTECTED_VERSION = 1;
export const PBKDF2_ITERATIONS = 310000;

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Criptografia indisponível neste ambiente.');
  return s;
};
const b64 = (bytes) => {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 0x8000) bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(bin);
};
const unb64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const AAD = new TextEncoder().encode(`${PROTECTED_FORMAT}:v${PROTECTED_VERSION}`);

export function assertPassword(senha) {
  const s = String(senha || '');
  if (s.length < 10) throw Object.assign(new Error('A senha do backup protegido precisa de pelo menos 10 caracteres.'), { code: 'SENHA_FRACA' });
  return s;
}

async function deriveKey(senha, salt, iterations) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function isProtectedEnvelope(obj) {
  return obj && typeof obj === 'object' && obj.format === PROTECTED_FORMAT;
}

/** Cifra { backup, anexos } com a senha. Devolve o envelope (JSON serializável). */
export async function encryptBackup(conteudo, senha, { iterations = PBKDF2_ITERATIONS } = {}) {
  assertPassword(senha);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(senha, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(conteudo));
  const cipher = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plain);
  return {
    format: PROTECTED_FORMAT,
    version: PROTECTED_VERSION,
    createdAt: new Date().toISOString(),
    kdf: { alg: 'PBKDF2-SHA256', iterations, salt: b64(salt) },
    cipher: { alg: 'AES-GCM-256', iv: b64(iv) },
    // Só o que não revela dado: quantas stores e anexos (para a tela de inspeção antes da senha).
    resumo: { stores: Object.keys(conteudo?.backup?.stores || {}).length, anexos: (conteudo?.anexos || []).length, dbVersion: conteudo?.backup?.dbVersion ?? null },
    ciphertext: b64(new Uint8Array(cipher)),
  };
}

export async function decryptBackup(envelope, senha) {
  if (!isProtectedEnvelope(envelope) || envelope.version !== PROTECTED_VERSION) throw Object.assign(new Error('Arquivo não é um backup protegido reconhecido.'), { code: 'PROTEGIDO_FORMATO' });
  const key = await deriveKey(String(senha || ''), unb64(envelope.kdf.salt), envelope.kdf.iterations);
  let plain;
  try {
    plain = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(envelope.cipher.iv), additionalData: AAD }, key, unb64(envelope.ciphertext));
  } catch {
    throw Object.assign(new Error('Senha incorreta ou arquivo alterado: nada foi restaurado.'), { code: 'PROTEGIDO_AUTENTICACAO' });
  }
  return JSON.parse(new TextDecoder().decode(plain));
}
