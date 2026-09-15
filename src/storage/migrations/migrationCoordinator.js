// Coordenador de migração (docs/arquitetura-produto/14-MIGRACOES.md §2; ADR-038).
//
//   detectar versão atual → backup lógico completo → SHA-256 → gravar → validar
//   → gravar o estado PENDENTE com a referência do backup (ainda na versão antiga)
//   → só então abrir na versão nova → backfill resumível → verificar
//
// Fail closed: sem backup válido o banco NÃO é aberto na versão nova. Falha no
// backfill: status FALHOU, escrita bloqueada (repositórios lançam
// MIGRATION_BLOCKED), diagnóstico disponível e retomada manual por
// runPendingBackfills (Manutenção › "Continuar migração").
import Dexie from 'dexie';
import { DB_NAME, DB_VERSION } from '../indexedDb/schema.js';
import { ensureStorageReady } from '../indexedDb/db.js';
import { recordBackupHistory } from '../indexedDb/backup/backupService.js';
import { createPreMigrationBackup } from './preMigrationBackup.js';
import {
  MIGRATION_STATUS,
  MigrationError,
  clearWriteBlock,
  getWriteBlock,
  readMigrationState,
  setWriteBlocked,
  writeMigrationState,
} from './migrationState.js';
import { V7_VERSION, dryRunV7, runV7Backfill } from './v7Backfill.js';

// Versão do app que ainda lê a store `lotes` (orientação do bloqueio MIGRATION_BLOCKED_LOTES).
export const LEGACY_LOTES_APP_VERSION = '1.1.17';

// Backfills por versão alvo. A v8 entra aqui na Fase 3.
const BACKFILLS = { [V7_VERSION]: { run: runV7Backfill, dryRun: dryRunV7 } };

async function openDynamic() {
  const probe = new Dexie(DB_NAME);
  await probe.open();
  return probe;
}

/** { exists, currentVersion, targetVersion, needsMigration, blockers[], stores[] } */
export async function inspectDatabase() {
  const targetVersion = DB_VERSION;
  const exists = await Dexie.exists(DB_NAME);
  if (!exists) return { exists: false, currentVersion: null, targetVersion, needsMigration: false, blockers: [], stores: [] };
  const probe = await openDynamic();
  try {
    const currentVersion = probe.verno;
    const stores = probe.tables.map((table) => table.name);
    const blockers = [];
    if (currentVersion < targetVersion && stores.includes('lotes')) {
      const count = await probe.table('lotes').count();
      if (count > 0) {
        blockers.push({
          code: 'MIGRATION_BLOCKED_LOTES',
          count,
          message: `A store legada "lotes" ainda tem ${count} registro(s) e o banco não foi alterado. Abra a versão anterior do aplicativo (${LEGACY_LOTES_APP_VERSION}), exporte ou limpe esses dados em Backup e Manutenção e só então atualize para a versão ${targetVersion} do banco.`,
        });
      }
    }
    return { exists, currentVersion, targetVersion, needsMigration: currentVersion < targetVersion, blockers, stores };
  } finally {
    probe.close();
  }
}

/**
 * Backup pré-migração + validação. Devolve { path, sha256, size, ... } ou
 * { skipped: true } (só desenvolvimento). Lança MIGRATION_BLOCKED_LOTES ou
 * MIGRATION_BACKUP_FAILED.
 */
export async function prepareMigration({ files = null, inspection = null } = {}) {
  const info = inspection || await inspectDatabase();
  if (info.blockers.length) {
    const blocker = info.blockers[0];
    throw new MigrationError(blocker.code, blocker.message, { blockers: info.blockers, inspection: info });
  }
  if (!info.needsMigration) return null;
  const source = await openDynamic();
  try {
    return await createPreMigrationBackup({ sourceDb: source, sourceVersion: info.currentVersion, targetVersion: info.targetVersion, files });
  } finally {
    source.close();
  }
}

/**
 * Grava o estado técnico PENDENTE com a referência do backup ANTES de abrir o
 * banco na versão nova (a store appSettings já existe na versão de origem). Fecha
 * a janela de crash entre o backup e a abertura: quem reabrir encontra o estado
 * e o backup registrados. Estado já existente sem backup é reconciliado.
 */
export async function recordPendingMigrationBeforeOpen({ backup, inspection }) {
  const probe = await openDynamic();
  try {
    if (!probe.tables.some((table) => table.name === 'appSettings')) return null;
    const previous = await readMigrationState(probe, DB_VERSION);
    if (!previous || previous.status === MIGRATION_STATUS.CONCLUIDA) {
      // await obrigatório: o finally fecha o probe e a gravação precisa ter terminado.
      return await writeMigrationState(probe, DB_VERSION, {
        status: MIGRATION_STATUS.PENDENTE,
        origem: `upgrade-v${inspection.currentVersion}`,
        backup,
        started_at: null,
        finished_at: null,
        error: null,
        passos_concluidos: [],
        processed: 0,
        total: 0,
        cursor: null,
        passo: null,
        last_checkpoint: null,
      });
    }
    if (!previous.backup && backup) return await writeMigrationState(probe, DB_VERSION, { backup });
    return previous;
  } finally {
    probe.close();
  }
}

/**
 * Reentrante: lê appSettings['migration:vN'] e continua do checkpoint.
 * Em sucesso limpa o bloqueio de escrita; em falha bloqueia e relança MIGRATION_FAILED.
 */
export async function runPendingBackfills({ onProgress, maxBatches, files = null, hooks = null, origem = null } = {}) {
  const db = await ensureStorageReady();
  const backfill = BACKFILLS[DB_VERSION];
  if (!backfill) return { completed: true, state: null, alreadyDone: true };
  try {
    const result = await backfill.run(db, { onProgress, maxBatches, files, hooks, origem });
    if (result.completed) {
      clearWriteBlock();
      if (!result.alreadyDone) await recordBackupHistory(`migration-v${DB_VERSION}`, { relatorio: result.state?.relatorio || null, finished_at: result.state?.finished_at || null });
    }
    return result;
  } catch (err) {
    setWriteBlocked({ code: 'MIGRATION_FAILED', message: err.message, version: DB_VERSION });
    throw err;
  }
}

// Só é alcançado se a gravação pré-abertura não pôde acontecer (sem appSettings na origem).
async function recordPendingMigrationBeforeOpenFallback(db, { backup, inspection }) {
  return writeMigrationState(db, DB_VERSION, {
    status: MIGRATION_STATUS.PENDENTE,
    origem: `upgrade-v${inspection.currentVersion}`,
    backup,
    started_at: null,
    finished_at: null,
    error: null,
    passos_concluidos: [],
    processed: 0,
    total: 0,
  });
}

/** Estado técnico + bloqueio de escrita em memória (Manutenção e diagnóstico). */
export async function getMigrationState(version = DB_VERSION) {
  const db = await ensureStorageReady();
  const state = await readMigrationState(db, version);
  return { versao: version, state, writeBlock: getWriteBlock(), blocked: getWriteBlock() !== null };
}

/** Relatório sem gravação (Manutenção e evidência). */
export async function dryRunBackfill(version = DB_VERSION) {
  const backfill = BACKFILLS[version];
  if (!backfill) throw new MigrationError('MIGRATION_UNKNOWN_VERSION', `Não há migração registrada para a versão ${version}.`);
  const db = await ensureStorageReady();
  return backfill.dryRun(db);
}

/**
 * inspect → prepare (se necessário) → estado PENDENTE + backup gravados na versão
 * antiga → open → runPendingBackfills.
 * Devolve { migrated, report, state, blocked, error, inspection, backup }.
 * Lança (fail closed, banco não aberto na versão nova): MIGRATION_BLOCKED_LOTES,
 * MIGRATION_BACKUP_FAILED. Falha no backfill NÃO lança: devolve blocked=true com
 * a escrita bloqueada, para que Manutenção possa continuar a migração.
 * `hooks.beforeOpen({ inspection, backup })` (gates) roda depois de gravar o
 * estado e antes de abrir na versão nova.
 */
export async function openWithMigration({ files = null, onProgress, hooks = null } = {}) {
  const inspection = await inspectDatabase();
  if (inspection.blockers.length) {
    const blocker = inspection.blockers[0];
    setWriteBlocked({ code: blocker.code, message: blocker.message, version: DB_VERSION });
    throw new MigrationError(blocker.code, blocker.message, { blockers: inspection.blockers, inspection });
  }
  let backup = null;
  const migrated = inspection.needsMigration;
  if (migrated) {
    try {
      backup = await prepareMigration({ files, inspection });
    } catch (err) {
      setWriteBlocked({ code: err.code || 'MIGRATION_BACKUP_FAILED', message: err.message, version: DB_VERSION });
      throw err;
    }
  }
  if (migrated) {
    await recordPendingMigrationBeforeOpen({ backup, inspection });
    if (hooks?.beforeOpen) await hooks.beforeOpen({ inspection, backup });
  }
  const db = await ensureStorageReady();
  if (migrated) {
    // Reconciliação pós-abertura: o estado já existe (gravado antes do upgrade);
    // só completa a referência do backup se por algum motivo estiver nula.
    const previous = await readMigrationState(db, DB_VERSION);
    if (!previous || previous.status === MIGRATION_STATUS.CONCLUIDA) {
      await recordPendingMigrationBeforeOpenFallback(db, { backup, inspection });
    } else if (!previous.backup && backup) {
      await writeMigrationState(db, DB_VERSION, { backup });
    }
    if (backup && !backup.skipped) await recordBackupHistory('pre-migration', backup);
  }
  const current = await readMigrationState(db, DB_VERSION);
  if (current?.status === MIGRATION_STATUS.FALHOU) {
    // Retomada é manual (docs 14 §5): o app abre em modo somente leitura.
    const block = setWriteBlocked({ code: 'MIGRATION_FAILED', message: current.error?.message || 'Migração anterior falhou.', version: DB_VERSION });
    return { migrated, report: current.relatorio || null, state: current, blocked: true, error: current.error || null, writeBlock: block, inspection, backup };
  }
  try {
    const result = await runPendingBackfills({ onProgress, files, hooks, origem: inspection.exists ? `upgrade-v${inspection.currentVersion}` : 'fresh' });
    return { migrated, report: result.state?.relatorio || null, state: result.state, blocked: false, error: null, writeBlock: null, inspection, backup };
  } catch (err) {
    const state = await readMigrationState(db, DB_VERSION);
    return { migrated, report: state?.relatorio || null, state, blocked: true, error: state?.error || { code: err.code, message: err.message }, writeBlock: getWriteBlock(), inspection, backup };
  }
}
