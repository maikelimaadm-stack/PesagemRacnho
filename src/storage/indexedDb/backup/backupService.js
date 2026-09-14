// Backup/export/import/restore no modelo IndexedDB/Dexie.
// Backup completo = todos os stores exportados para JSON. Restore = importar JSON
// em transação Dexie. Nenhum arquivo .db nativo; portabilidade via JSON.
import { ensureStorageReady, getDbVersion } from '../db.js';
import { BACKUP_FORMAT, STORE_NAMES } from '../schema.js';
import { APP_VERSION } from '../../../lib/appVersion.js';

const BACKUP_FORMAT_VERSION = 2;

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function recordBackupHistory(tipo, detalhes) {
  const db = await ensureStorageReady();
  try {
    await db.table('backupHistory').add({
      id: crypto.randomUUID(),
      tipo,
      detalhes: JSON.stringify(detalhes || {}),
      created_at: new Date().toISOString(),
    });
  } catch { /* best-effort */ }
}

/** Backup completo: exporta todos os stores para um objeto JSON. */
export async function createFullBackup({ reason = 'manual', automatic = false } = {}) {
  const db = await ensureStorageReady();
  const stores = {};
  for (const name of STORE_NAMES) {
    stores[name] = await db.table(name).toArray();
  }
  const counts = Object.fromEntries(STORE_NAMES.map((n) => [n, stores[n].length]));
  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId: crypto.randomUUID(),
    appVersion: APP_VERSION,
    dbVersion: getDbVersion(),
    createdAt: new Date().toISOString(),
    reason,
    automatic,
    counts,
    stores: [...STORE_NAMES],
  };
  const unsigned = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    version: APP_VERSION,
    dbVersion: getDbVersion(),
    createdAt: manifest.createdAt,
    manifest,
    stores,
  };
  const backup = { ...unsigned, integrity: { algorithm: 'SHA-256', sha256: await sha256(JSON.stringify(unsigned)) } };
  return { ok: true, backup, counts };
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta pesagens para CSV (string). */
export async function exportPesagensCsv() {
  const db = await ensureStorageReady();
  const rows = (await db.table('pesagens').toArray()).filter((r) => !r.deleted_at);
  const headers = ['id', 'data_pesagem', 'peso_kg', 'animal_id', 'lote_id', 'tipo_pesagem', 'operador', 'origem', 'observacao', 'created_at', 'updated_at'];
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  return { ok: true, csv: `﻿${lines.join('\n')}`, count: rows.length };
}

/** Exporta pesagens para JSON (payload de export). */
export async function exportPesagensJson() {
  const db = await ensureStorageReady();
  const rows = (await db.table('pesagens').toArray()).filter((r) => !r.deleted_at);
  return {
    ok: true,
    payload: {
      type: 'weighing-entries-export',
      createdAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      count: rows.length,
      entries: rows,
    },
    count: rows.length,
  };
}

async function readBackup(payload, { allowLegacy = true } = {}) {
  const b = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!b || b.format !== BACKUP_FORMAT || !b.stores) {
    const err = new Error('Backup inválido (formato não reconhecido)');
    err.code = 'DEXIE_BACKUP_001';
    throw err;
  }
  if (b.integrity?.sha256) {
    const { integrity: _integrity, ...unsigned } = b;
    const actual = await sha256(JSON.stringify(unsigned));
    if (actual !== b.integrity.sha256) {
      const err = new Error('Backup corrompido: SHA-256 divergente');
      err.code = 'DEXIE_BACKUP_003';
      throw err;
    }
  } else if (!allowLegacy) {
    const err = new Error('Backup sem verificação de integridade');
    err.code = 'DEXIE_BACKUP_004';
    throw err;
  }
  const missingStores = STORE_NAMES.filter((name) => !Array.isArray(b.stores[name]));
  if (missingStores.length && !allowLegacy) {
    const err = new Error(`Backup incompleto: stores ausentes (${missingStores.join(', ')})`);
    err.code = 'DEXIE_BACKUP_002';
    throw err;
  }
  // Stores acrescentadas por versões posteriores nascem vazias ao restaurar
  // um backup íntegro de versão anterior. Nenhuma store existente é descartada.
  for (const name of missingStores) b.stores[name] = [];
  if (b.manifest?.dbVersion > getDbVersion()) {
    const err = new Error(`Backup criado por banco mais novo (versão ${b.manifest.dbVersion}). Atualize o aplicativo antes de restaurar.`);
    err.code = 'DEXIE_BACKUP_005';
    throw err;
  }
  for (const [name, expected] of Object.entries(b.manifest?.counts || {})) {
    if (Array.isArray(b.stores[name]) && Number(expected) !== b.stores[name].length) {
      const err = new Error(`Backup inconsistente: contagem divergente em ${name}`);
      err.code = 'DEXIE_BACKUP_006';
      throw err;
    }
  }
  return b;
}

function requireDurableSafetyEvidence(safetyEvidence, operation) {
  const valid = safetyEvidence
    && typeof safetyEvidence.path === 'string' && safetyEvidence.path.trim()
    && Number.isFinite(safetyEvidence.size) && safetyEvidence.size > 0
    && /^[a-f0-9]{64}$/i.test(String(safetyEvidence.sha256 || ''));
  if (!valid) throw new Error(`${operation} bloqueada: crie e valide um backup físico antes de continuar.`);
}

/** Dry-run de restauração: valida formato e conta registros por store. */
export async function dryRunRestore(payload) {
  const b = await readBackup(payload);
  const counts = Object.fromEntries(STORE_NAMES.map((n) => [n, Array.isArray(b.stores[n]) ? b.stores[n].length : 0]));
  return {
    ok: true,
    restorable: true,
    format: b.format,
    formatVersion: b.formatVersion || 1,
    version: b.manifest?.appVersion || b.version,
    manifest: b.manifest || null,
    integrity: b.integrity?.sha256 ? 'SHA-256 válido' : 'backup legado sem SHA-256',
    counts,
  };
}

/** Restore: substitui o conteúdo de todos os stores em transação. Cria backup de segurança antes. */
export async function applyRestore(payload, { safetyEvidence = null } = {}) {
  const b = await readBackup(payload);
  const db = await ensureStorageReady();
  requireDurableSafetyEvidence(safetyEvidence, 'Restauração');
  await db.transaction('rw', STORE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of STORE_NAMES) {
      await db.table(name).clear();
      const rows = Array.isArray(b.stores[name]) ? b.stores[name] : [];
      if (rows.length) await db.table(name).bulkAdd(rows.map(({ localId, ...rest }) => rest));
    }
    for (const name of STORE_NAMES) {
      const restoredCount = await db.table(name).count();
      if (restoredCount !== b.stores[name].length) throw new Error(`Restauração abortada: contagem divergente em ${name}.`);
    }
  });
  await recordBackupHistory('restore', {
    restoredFormat: b.format,
    restoredBackupId: b.manifest?.backupId || null,
    durableSafetyBackup: safetyEvidence || null,
  });
  return { ok: true, restored: true, preRestoreBackup: safetyEvidence };
}

/** Limpa TODOS os dados locais (stores de domínio). Cria backup antes. */
export async function clearAllData({ safetyEvidence = null } = {}) {
  requireDurableSafetyEvidence(safetyEvidence, 'Limpeza');
  const db = await ensureStorageReady();
  const domain = STORE_NAMES.filter((n) => n !== 'appSettings' && n !== 'backupHistory');
  await db.transaction('rw', domain.map((n) => db.table(n)), async () => {
    for (const name of domain) await db.table(name).clear();
  });
  await recordBackupHistory('clear-all', { durableSafetyBackup: safetyEvidence });
  return { ok: true, cleared: domain, preClearBackup: safetyEvidence };
}

/** Dry-run de importação de pesagens (JSON export). Detecta duplicados por id. */
export async function dryRunImportPesagens(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const entries = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data?.PesagemIndividual) ? data.PesagemIndividual : []);
  const db = await ensureStorageReady();
  const existing = new Set((await db.table('pesagens').toArray()).map((r) => r.id));
  let toInsert = 0, duplicates = 0, invalid = 0;
  const seen = new Set();
  for (const e of entries) {
    if (!e || (!e.data_pesagem && !e.data)) { invalid += 1; continue; }
    const id = e.id;
    if (id && (existing.has(id) || seen.has(id))) { duplicates += 1; continue; }
    if (id) seen.add(id);
    toInsert += 1;
  }
  return { ok: true, totalRecords: entries.length, toInsert, duplicates, invalidRecords: invalid };
}

/** Apply import de pesagens (pula duplicados). Cria backup antes. */
export async function applyImportPesagens(payload, { safetyEvidence = null } = {}) {
  requireDurableSafetyEvidence(safetyEvidence, 'Importação');
  const dry = await dryRunImportPesagens(payload);
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const entries = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data?.PesagemIndividual) ? data.PesagemIndividual : []);
  const db = await ensureStorageReady();
  const existing = new Set((await db.table('pesagens').toArray()).map((r) => r.id));
  const { storageRecordToViewModel } = await import('../../../modules/weighing/domain/weighingMapper.js');
  const weighingService = await import('../../../modules/weighing/application/weighingService.js');
  const selected = [];
  for (const entry of entries) {
    if (!entry || (!entry.data_pesagem && !entry.data)) continue;
    if (entry.id && existing.has(entry.id)) continue;
    if (entry.id) existing.add(entry.id);
    selected.push(entry.legacy_payload ? storageRecordToViewModel(entry) : { ...entry, data_pesagem: entry.data_pesagem || entry.data });
  }
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const importHash = await sha256(serialized);
  const report = await weighingService.bulkCreateEntries(selected, {
    importMetadata: {
      id: crypto.randomUUID(), hash: importHash, name: data?.fileName || 'importacao-pesagens.json',
      size: new TextEncoder().encode(serialized).length, totalRows: entries.length,
      origin: 'json', operador: data?.operador || 'IMPORTACAO',
    },
  });
  await recordBackupHistory('import', { inserted: report.registros_criados, total: entries.length, hash: importHash });
  return { ok: true, inserted: report.registros_criados, report, dryRun: dry };
}
