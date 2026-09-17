// Backup físico pré-migração (ADR-038, docs 14 §2): mesmo formato do backup
// completo, gerado sobre a instância dinâmica do banco na versão de origem,
// gravado pela porta de arquivos (window.pesagemApp.files no app; injetável nos
// gates) e validado por tamanho e SHA-256 relidos. Sem a porta de arquivos (sistema
// aberto no navegador/desenvolvimento), o backup vai para um banco IndexedDB
// separado (BROWSER_BACKUP_DB) e é relido e validado do mesmo jeito antes de migrar.
// Fail closed: se nenhuma das duas gravações puder ser validada, a migração é bloqueada.
import { createFullBackupFromDb } from '../indexedDb/backup/backupService.js';
import { MigrationError } from './migrationState.js';

export const DEV_UNSAFE_MIGRATION_FLAG = 'pesagens.dev.allowUnsafeMigration';

const pad = (n) => String(n).padStart(2, '0');

export function preMigrationFileName(targetVersion, date = new Date()) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `pre-migration-v${targetVersion}-${stamp}.json`;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Só no navegador de desenvolvimento; nunca no pacote (não existe localStorage nos gates). */
export function devUnsafeMigrationAllowed() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DEV_UNSAFE_MIGRATION_FLAG) === '1';
  } catch {
    return false;
  }
}

// Cópia de segurança no navegador: banco próprio, fora do banco que será migrado.
export const BROWSER_BACKUP_DB = 'pesagens-individuais-backups';
const BROWSER_BACKUP_STORE = 'backups';
const BROWSER_BACKUPS_KEPT = 3;

function browserStorageAvailable() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('falha no IndexedDB'));
  });
}

function openBackupDbAt(version) {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(BROWSER_BACKUP_DB, version) : indexedDB.open(BROWSER_BACKUP_DB);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(BROWSER_BACKUP_STORE)) request.result.createObjectStore(BROWSER_BACKUP_STORE, { keyPath: 'filename' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('não foi possível abrir o banco de backups'));
    request.onblocked = () => reject(new Error('banco de backups bloqueado por outra aba'));
  });
}

/**
 * Abre o banco de backups garantindo a store. Um banco já existente SEM a store (versão antiga,
 * criação parcial ou limpeza) não dispara upgrade ao abrir na mesma versão: aí reabrimos uma
 * versão acima para criá-la, em vez de falhar e bloquear a migração para sempre.
 */
async function openBrowserBackupDb() {
  const db = await openBackupDbAt(null);
  if (db.objectStoreNames.contains(BROWSER_BACKUP_STORE)) return db;
  const proximaVersao = db.version + 1;
  db.close();
  const upgraded = await openBackupDbAt(proximaVersao);
  if (!upgraded.objectStoreNames.contains(BROWSER_BACKUP_STORE)) {
    upgraded.close();
    throw new Error('não foi possível criar a área de backups do navegador');
  }
  return upgraded;
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('transação de backup falhou'));
    tx.onabort = () => reject(tx.error || new Error('transação de backup abortada (espaço insuficiente?)'));
  });
}

/** Grava, relê e devolve { path, size, sha256 } medidos sobre o conteúdo RELIDO. Mantém os últimos backups. */
async function writeBrowserBackup({ filename, content, createdAt }) {
  const db = await openBrowserBackupDb();
  try {
    const writeTx = db.transaction(BROWSER_BACKUP_STORE, 'readwrite');
    writeTx.objectStore(BROWSER_BACKUP_STORE).put({ filename, content, createdAt });
    await transactionDone(writeTx);

    const readTx = db.transaction(BROWSER_BACKUP_STORE, 'readonly');
    const stored = await idbRequest(readTx.objectStore(BROWSER_BACKUP_STORE).get(filename));
    const reread = typeof stored?.content === 'string' ? stored.content : '';

    const pruneTx = db.transaction(BROWSER_BACKUP_STORE, 'readwrite');
    const store = pruneTx.objectStore(BROWSER_BACKUP_STORE);
    const keys = (await idbRequest(store.getAllKeys())).map(String).sort();
    for (const key of keys.slice(0, Math.max(0, keys.length - BROWSER_BACKUPS_KEPT))) {
      if (key !== filename) store.delete(key);
    }
    await transactionDone(pruneTx);

    return { path: `indexeddb://${BROWSER_BACKUP_DB}/${filename}`, size: new TextEncoder().encode(reread).length, sha256: await sha256Hex(reread) };
  } finally {
    db.close();
  }
}

function backupFailed(message, details) {
  return new MigrationError('MIGRATION_BACKUP_FAILED', `Migração bloqueada: ${message}`, details);
}

/**
 * Gera e grava o backup pré-migração. Devolve { path, sha256, size, filename,
 * backupId, counts } ou { skipped: true, reason } (somente em desenvolvimento).
 * Lança MIGRATION_BACKUP_FAILED em qualquer falha de gravação ou validação.
 */
export async function createPreMigrationBackup({ sourceDb, sourceVersion, targetVersion, files, now = new Date() }) {
  const hasFilesPort = Boolean(files && typeof files.writeUserFile === 'function');
  if (!hasFilesPort && !browserStorageAvailable()) {
    if (devUnsafeMigrationAllowed()) {
      return { skipped: true, reason: 'DEV_UNSAFE_MIGRATION', sourceVersion, targetVersion };
    }
    throw backupFailed(
      'não há ponte de arquivos para gravar o backup pré-migração. Abra o sistema pelo aplicativo desktop.',
      { reason: 'NO_FILES_PORT' },
    );
  }

  let backup;
  try {
    ({ backup } = await createFullBackupFromDb(sourceDb, {
      reason: 'pre-migration',
      automatic: true,
      dbVersion: sourceVersion,
    }));
  } catch (err) {
    throw backupFailed(`não foi possível ler o banco na versão ${sourceVersion} para o backup (${err.message}).`, { cause: err });
  }

  const content = JSON.stringify(backup, null, 2);
  const expectedSize = new TextEncoder().encode(content).length;
  const expectedSha = await sha256Hex(content);
  const filename = preMigrationFileName(targetVersion, now);

  let saved;
  try {
    if (hasFilesPort) {
      const res = await files.writeUserFile({ subdir: 'backups', filename, content });
      saved = res?.data ?? res;
      if (res?.ok === false) throw new Error(res.error?.message || 'gravação recusada');
    } else {
      saved = await writeBrowserBackup({ filename, content, createdAt: backup.createdAt ?? now.toISOString() });
    }
  } catch (err) {
    const where = hasFilesPort ? 'o backup pré-migração' : 'a cópia de segurança no armazenamento do navegador';
    throw backupFailed(`falha ao gravar ${where} (${err.message}).`, { cause: err, reason: hasFilesPort ? 'WRITE_FAILED' : 'BROWSER_BACKUP_FAILED' });
  }

  const savedSha = String(saved?.sha256 || '').toLowerCase();
  if (!saved?.path || !Number.isFinite(saved?.size) || saved.size !== expectedSize || savedSha !== expectedSha) {
    throw backupFailed(
      'o backup pré-migração foi gravado, mas tamanho ou SHA-256 relidos divergem do conteúdo gerado.',
      { reason: 'VALIDATION_MISMATCH', expected: { size: expectedSize, sha256: expectedSha }, actual: { size: saved?.size ?? null, sha256: savedSha || null } },
    );
  }

  return {
    path: saved.path,
    sha256: savedSha,
    size: saved.size,
    filename,
    backupId: backup.manifest?.backupId || null,
    storage: hasFilesPort ? 'arquivo' : 'navegador',
    sourceVersion,
    targetVersion,
    counts: backup.manifest?.counts || {},
    createdAt: backup.createdAt,
  };
}
