// Backup/export/import/restore no modelo IndexedDB/Dexie.
// Backup completo = todos os stores exportados para JSON (formato 3, docs 13 §2 e 14 §6).
// Restore = importar JSON em transação Dexie; backup de esquema anterior dispara o
// backfill resumível antes de registrar sucesso (ADR-038). Nenhum arquivo .db nativo.
import { ensureStorageReady, getDbVersion } from '../db.js';
import { BACKUP_FORMAT, MASTER_REGISTRY_STORES, PROTECTED_STORES, STORE_NAMES, USERS_STORE } from '../schema.js';
import {
  APP_VERSION,
  BACKUP_FORMAT_VERSION,
  DATA_CONTRACT_VERSION,
  UI_BUILD_ID,
} from '../../../versioning/versionInfo.js';

export { BACKUP_FORMAT_VERSION };

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// O backfill vive no coordenador de migração, que importa este módulo; a
// importação dinâmica evita o ciclo estático entre os dois.
async function migrationCoordinator() {
  return import('../../migrations/migrationCoordinator.js');
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

/**
 * Backup completo sobre uma instância Dexie qualquer (a vigente ou a dinâmica da
 * versão de origem, usada pelo backup pré-migração). Formato da versão de origem:
 * bancos até a v6 geram formato 2; a partir da v7, formato 3 com os campos de
 * versionamento (schemaVersion, dataContractVersion, uiBuildId, appVersion).
 * A v8 (ADR-049) não muda o formato: as stores vêm de STORE_NAMES/db.tables e as
 * de sanidade entram sozinhas; leitores antigos as tratam como desconhecidas.
 * `schemaVersion` descreve o esquema dos DADOS do arquivo (= dbVersion): no backup
 * pré-migração de um banco v7 aberto pelo app v8 ele vale 7, não 8.
 */
export async function createFullBackupFromDb(db, { reason = 'manual', automatic = false, dbVersion = getDbVersion(), storeNames = null } = {}) {
  const names = storeNames || db.tables.map((table) => table.name);
  const stores = {};
  // F20: todas as stores lidas na MESMA transação de leitura — snapshot coerente mesmo com pesagens sendo
  // gravadas ao mesmo tempo (o backup periódico roda com o app em uso). Gravações esperam a leitura terminar.
  const tables = names.filter((name) => db.tables.some((table) => table.name === name)).map((name) => db.table(name));
  await db.transaction('r', tables, async () => {
    for (const name of names) {
      stores[name] = db.tables.some((table) => table.name === name) ? await db.table(name).toArray() : [];
    }
  });
  const counts = Object.fromEntries(names.map((n) => [n, stores[n].length]));
  const formatVersion = dbVersion <= 6 ? 2 : BACKUP_FORMAT_VERSION;
  const createdAt = new Date().toISOString();
  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion,
    backupId: crypto.randomUUID(),
    appVersion: APP_VERSION,
    dbVersion,
    createdAt,
    reason,
    automatic,
    counts,
    stores: [...names],
    ...(formatVersion >= 3
      ? { schemaVersion: dbVersion, dataContractVersion: DATA_CONTRACT_VERSION, uiBuildId: UI_BUILD_ID }
      : {}),
  };
  const unsigned = {
    format: BACKUP_FORMAT,
    formatVersion,
    version: APP_VERSION,
    dbVersion,
    createdAt,
    manifest,
    stores,
  };
  const backup = { ...unsigned, integrity: { algorithm: 'SHA-256', sha256: await sha256(JSON.stringify(unsigned)) } };
  return { ok: true, backup, counts };
}

/** Backup completo do banco vigente (todos os stores, inclusive `usuarios` — hash/salt, nunca senha). */
export async function createFullBackup({ reason = 'manual', automatic = false } = {}) {
  const db = await ensureStorageReady();
  return createFullBackupFromDb(db, { reason, automatic, dbVersion: getDbVersion(), storeNames: STORE_NAMES });
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
  // P24: exportação de pesagens não é backup — dizer isso em vez de "formato não reconhecido".
  if (b && b.type === 'weighing-entries-export') {
    const err = new Error('Este arquivo é uma EXPORTAÇÃO DE PESAGENS, não um backup completo: ele não traz animais, cadastros, usuários nem configurações. Para restaurar, escolha um arquivo backup-completo-….json.');
    err.code = 'DEXIE_BACKUP_007';
    throw err;
  }
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
  // Stores acrescentadas por versões posteriores nascem vazias ao restaurar um
  // backup íntegro de versão anterior (newStores). Stores que deixaram de existir
  // (ex.: `lotes` da v6) são ignoradas (ignoredStores) — o dry-run lista ambas.
  // O payload do chamador NÃO é alterado: a UI reutiliza o mesmo objeto entre o
  // dry-run e o apply, e qualquer mutação invalidaria o SHA-256 na segunda leitura.
  const newStores = [...missingStores];
  const ignoredStores = Object.keys(b.stores).filter((name) => !STORE_NAMES.includes(name));
  const stores = { ...b.stores };
  for (const name of missingStores) stores[name] = [];
  const sourceDbVersion = Number(b.manifest?.dbVersion ?? b.dbVersion) || 0;
  return { backup: { ...b, stores }, newStores, ignoredStores, sourceDbVersion, schemaUpgradeRequired: sourceDbVersion < getDbVersion() };
}

function requireDurableSafetyEvidence(safetyEvidence, operation) {
  const valid = safetyEvidence
    && typeof safetyEvidence.path === 'string' && safetyEvidence.path.trim()
    && Number.isFinite(safetyEvidence.size) && safetyEvidence.size > 0
    && /^[a-f0-9]{64}$/i.test(String(safetyEvidence.sha256 || ''));
  if (!valid) throw new Error(`${operation} bloqueada: crie e valide um backup físico antes de continuar.`);
}

/** Dry-run de restauração: valida formato, conta registros e informa conversão de esquema. */
export async function dryRunRestore(payload) {
  const { backup: b, newStores, ignoredStores, sourceDbVersion, schemaUpgradeRequired } = await readBackup(payload);
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
    sourceDbVersion,
    targetDbVersion: getDbVersion(),
    schemaUpgradeRequired,
    ignoredStores,
    newStores,
    // Usuários trazidos pelo backup (docs 11 §9): > 0 → o restore encerra a sessão.
    usuarios: counts[USERS_STORE] || 0,
  };
}

/**
 * Restore: substitui o conteúdo de todos os stores em transação. Exige evidência
 * de backup físico. Backup de esquema anterior (dbVersion < atual): grava e
 * executa o backfill na sequência; só então registra sucesso. Backup da própria
 * versão com migração CONCLUIDA (ou sem estado técnico) limpa o bloqueio de
 * escrita ao final — o banco restaurado é íntegro por definição.
 * Devolve `usuarios` (quantidade restaurada) para o serviço encerrar a sessão.
 */
export async function applyRestore(payload, { safetyEvidence = null, files = null } = {}) {
  const { backup: b, ignoredStores, newStores, sourceDbVersion, schemaUpgradeRequired } = await readBackup(payload);
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
  const { runPendingBackfills, MIGRATION_CHAIN, chainVersionsAfter } = await migrationCoordinator();
  const { readMigrationState, writeMigrationState, MIGRATION_STATUS, clearWriteBlock } = await import('../../migrations/migrationState.js');
  let backfill = null;
  if (schemaUpgradeRequired) {
    // Cadeia (ADR-049): toda versão posterior à do backup recomeça PENDENTE — o
    // estado restaurado dessas versões (se houver) pertence ao banco antigo. Backup
    // v6 → v7 e v8; backup v7 → só v8 (o migration:v7 restaurado é mantido).
    for (const version of chainVersionsAfter(sourceDbVersion)) {
      await writeMigrationState(db, version, {
        status: MIGRATION_STATUS.PENDENTE, origem: `restore-v${sourceDbVersion}`, started_at: null, finished_at: null,
        error: null, passos_concluidos: [], processed: 0, total: 0, cursor: null, passo: null, last_checkpoint: null,
      });
    }
  }
  // Backfill quando o backup é de esquema anterior ou quando algum estado restaurado
  // da cadeia ficou pendente/em andamento/com falha (retomada). Backup da própria
  // versão sem estado técnico (banco de gate) não dispara nada.
  let pendingRestored = false;
  for (const version of MIGRATION_CHAIN) {
    const restoredState = await readMigrationState(db, version);
    if (restoredState && restoredState.status !== MIGRATION_STATUS.CONCLUIDA) pendingRestored = true;
  }
  if (schemaUpgradeRequired || pendingRestored) {
    backfill = await runPendingBackfills({ files, origem: `restore-v${sourceDbVersion}` });
  } else {
    // Backup da versão vigente CONCLUIDA (ou sem estado técnico): nada a migrar → libera a escrita.
    clearWriteBlock();
  }
  const usuariosRestaurados = Array.isArray(b.stores[USERS_STORE]) ? b.stores[USERS_STORE].length : 0;
  await recordBackupHistory('restore', {
    restoredFormat: b.format,
    restoredFormatVersion: b.formatVersion || 1,
    restoredDbVersion: sourceDbVersion,
    restoredBackupId: b.manifest?.backupId || null,
    durableSafetyBackup: safetyEvidence || null,
    ignoredStores,
    newStores,
    usuarios: usuariosRestaurados,
    backfill: backfill ? { completed: backfill.completed, relatorio: backfill.state?.relatorio || null } : null,
  });
  for (const item of backfill?.results || []) {
    if (!item.alreadyDone) await recordBackupHistory(`backfill-v${item.versao}`, { origem: 'restore', relatorio: backfill.states?.[item.versao]?.relatorio || null });
  }
  return { ok: true, restored: true, preRestoreBackup: safetyEvidence, schemaUpgradeRequired, ignoredStores, newStores, usuarios: usuariosRestaurados, backfill: backfill ? backfill.state : null };
}

/**
 * "Limpar dados operacionais" (ADR-032): preserva usuários, configurações,
 * histórico de backups e cadastros mestres — inclusive programas de sanidade e
 * medicamentos; as aplicações de sanidade são operacionais e são apagadas
 * (ADR-049). Exige evidência de backup físico.
 */
export async function clearOperationalData({ safetyEvidence = null } = {}) {
  requireDurableSafetyEvidence(safetyEvidence, 'Limpeza');
  const db = await ensureStorageReady();
  const preserved = new Set([...MASTER_REGISTRY_STORES, ...PROTECTED_STORES]);
  const operational = STORE_NAMES.filter((n) => !preserved.has(n));
  await db.transaction('rw', operational.map((n) => db.table(n)), async () => {
    for (const name of operational) await db.table(name).clear();
  });
  await recordBackupHistory('clear-operational', { durableSafetyBackup: safetyEvidence, cleared: operational });
  return { ok: true, cleared: operational, preserved: [...preserved], preClearBackup: safetyEvidence };
}

/** Alias histórico: "limpar tudo" da 1.1.x agora é a limpeza operacional. */
export const clearAllData = clearOperationalData;

/**
 * "Reset completo" (ADR-032): apaga tudo exceto backupHistory — inclusive
 * `usuarios`, por isso o app volta ao FIRST-RUN ADMIN SETUP (ADR-044). Exclusivo
 * do ADMIN com a senha reverificada (validados no serviço de manutenção); aqui
 * exige evidência de backup físico mais a confirmação explícita. Recria o estado
 * técnico da cadeia (v7 com os seeds, depois v8) em seguida.
 */
export async function resetAllData({ safetyEvidence = null, confirmedByAdmin = false, files = null } = {}) {
  requireDurableSafetyEvidence(safetyEvidence, 'Reset completo');
  if (confirmedByAdmin !== true) {
    const err = new Error('Reset completo bloqueado: exige confirmação explícita do ADMIN.');
    err.code = 'MAINTENANCE_RESET_NOT_CONFIRMED';
    throw err;
  }
  const db = await ensureStorageReady();
  const targets = STORE_NAMES.filter((n) => n !== 'backupHistory');
  await db.transaction('rw', targets.map((n) => db.table(n)), async () => {
    for (const name of targets) await db.table(name).clear();
  });
  const { runPendingBackfills } = await migrationCoordinator();
  const backfill = await runPendingBackfills({ files, origem: 'reset' });
  await recordBackupHistory('reset-all', { durableSafetyBackup: safetyEvidence, cleared: targets });
  return { ok: true, cleared: targets, preserved: ['backupHistory'], preResetBackup: safetyEvidence, backfill: backfill.state };
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
