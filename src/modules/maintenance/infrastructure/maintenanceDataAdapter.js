// D.16 cutover: Manutenção agora usa IndexedDB/Dexie (storageAdapter).
// Backup/export são gerados no renderer (Dexie) e persistidos em disco via IPC
// de arquivo (app:writeUserFile). Import/restore leem JSON via dialog e aplicam
// em transação Dexie. Nenhum CRUD de banco passa por IPC.
import storage from '../../../storage/storageAdapter.js';

function files() {
  return window.pesagemApp?.files || null;
}
function getDialogs() {
  return window.pesagemApp?.dialogs || null;
}
function unwrapDialog(result) {
  if (result?.ok === false) {
    const err = new Error(result.error?.message || 'Operação de arquivo falhou');
    err.code = result.error?.code;
    throw err;
  }
  return result?.data ?? result;
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
async function saveFile(subdir, filename, content) {
  if (!files()?.writeUserFile) {
    throw new Error('Salvar arquivo indisponível (abra pelo aplicativo desktop).');
  }
  const res = await files().writeUserFile({ subdir, filename, content });
  const saved = res?.data ?? res;
  if (!saved?.path || !saved?.sha256 || !Number.isFinite(saved?.size)) {
    throw new Error('O arquivo foi gravado, mas não foi possível validar tamanho e SHA-256.');
  }
  return saved;
}

async function persistFullBackup({ reason, automatic = false } = {}) {
  const { backup, counts } = await storage.createFullBackup({ reason, automatic });
  const saved = await saveFile('backups', `backup-completo-${stamp()}.json`, JSON.stringify(backup, null, 2));
  await storage.recordBackupHistory('full-durable', {
    backupId: backup.manifest?.backupId,
    reason,
    automatic,
    path: saved.path,
    size: saved.size,
    fileSha256: saved.sha256,
    payloadSha256: backup.integrity?.sha256,
    counts,
  });
  return { backup, counts, ...saved };
}

export async function isMaintenanceAvailable() {
  try { await storage.ensureReady(); return true; } catch { return false; }
}

// Backup completo do banco (todos os stores Dexie) → JSON em disco.
export async function createDatabaseBackup() {
  const saved = await persistFullBackup({ reason: 'manual-ui' });
  return { ok: true, backupPath: saved.path, counts: saved.counts, size: saved.size, sha256: saved.sha256 };
}
// No modelo Dexie, "backup completo" = mesmo backup de todos os stores.
export async function createFullDataBackup() {
  const saved = await persistFullBackup({ reason: 'manual-ui' });
  return { ok: true, backupPath: saved.path, backupDir: saved.path, files: Object.keys(saved.counts), counts: saved.counts, size: saved.size, sha256: saved.sha256 };
}

export async function exportWeighingCsv() {
  const { csv, count } = await storage.exportPesagensCsv();
  const saved = await saveFile('exports', `pesagens-${stamp()}.csv`, csv);
  return { ok: true, filePath: saved.path, count, size: saved.size, sha256: saved.sha256 };
}
export async function exportWeighingJson() {
  const { payload, count } = await storage.exportPesagensJson();
  const saved = await saveFile('exports', `pesagens-${stamp()}.json`, JSON.stringify(payload, null, 2));
  return { ok: true, filePath: saved.path, count, size: saved.size, sha256: saved.sha256 };
}

export async function runIntegrityCheck() {
  const r = await storage.logicalIntegrity();
  return { ok: r.ok, result: r.result, issues: r.issues };
}
export async function runQuickCheck() {
  const r = await storage.logicalIntegrity();
  return { ok: r.ok, result: r.result };
}
export async function getDatabaseStats() {
  return storage.databaseStats();
}
export async function listBackups() {
  if (!files()?.listUserFiles) return { full: [], unavailable: true };
  const result = unwrapDialog(await files().listUserFiles({ subdir: 'backups', extension: '.json' }));
  return { full: result?.files || [] };
}

// Import de pesagens (JSON) — seleção via dialog, dry-run/apply em Dexie.
export async function selectImportJsonFile() {
  const d = getDialogs();
  if (!d?.selectImportJson) throw new Error('Seleção de arquivo indisponível (abra o app desktop)');
  return unwrapDialog(await d.selectImportJson());
}
export async function dryRunImportWeighingJson(payload) {
  return storage.dryRunImportPesagens(payload);
}
export async function applyImportWeighingJson(payload) {
  const safety = await persistFullBackup({ reason: 'pre-import', automatic: true });
  const safetyEvidence = { path: safety.path, size: safety.size, sha256: safety.sha256 };
  const result = await storage.applyImportPesagens(payload, { safetyEvidence });
  return { ...result, safetyBackup: { path: safety.path, size: safety.size, sha256: safety.sha256 } };
}

// Restore — seleção do backup JSON via dialog; dry-run/apply em Dexie.
export async function selectBackupFile() {
  const d = getDialogs();
  if (!d?.selectImportJson) throw new Error('Seleção de arquivo indisponível (abra o app desktop)');
  const selected = unwrapDialog(await d.selectImportJson());
  return selected; // { canceled?, fileName, payload }
}
export async function dryRunRestoreBackup(backup) {
  return storage.dryRunRestore(backup);
}
export async function applyRestoreBackup(backup) {
  const safety = await persistFullBackup({ reason: 'pre-restore', automatic: true });
  return storage.applyRestore(backup, {
    safetyEvidence: { path: safety.path, size: safety.size, sha256: safety.sha256 },
  });
}
