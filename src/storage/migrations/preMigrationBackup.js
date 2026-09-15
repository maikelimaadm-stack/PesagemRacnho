// Backup físico pré-migração (ADR-038, docs 14 §2): mesmo formato do backup
// completo, gerado sobre a instância dinâmica do banco na versão de origem,
// gravado pela porta de arquivos (window.pesagemApp.files no app; injetável nos
// gates) e validado por tamanho e SHA-256 relidos. Fail closed: sem porta e sem
// a chave de desenvolvimento, a migração é bloqueada.
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

function backupFailed(message, details) {
  return new MigrationError('MIGRATION_BACKUP_FAILED', `Migração bloqueada: ${message}`, details);
}

/**
 * Gera e grava o backup pré-migração. Devolve { path, sha256, size, filename,
 * backupId, counts } ou { skipped: true, reason } (somente em desenvolvimento).
 * Lança MIGRATION_BACKUP_FAILED em qualquer falha de gravação ou validação.
 */
export async function createPreMigrationBackup({ sourceDb, sourceVersion, targetVersion, files, now = new Date() }) {
  if (!files || typeof files.writeUserFile !== 'function') {
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
    const res = await files.writeUserFile({ subdir: 'backups', filename, content });
    saved = res?.data ?? res;
    if (res?.ok === false) throw new Error(res.error?.message || 'gravação recusada');
  } catch (err) {
    throw backupFailed(`falha ao gravar o backup pré-migração (${err.message}).`, { cause: err });
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
    sourceVersion,
    targetVersion,
    counts: backup.manifest?.counts || {},
    createdAt: backup.createdAt,
  };
}
