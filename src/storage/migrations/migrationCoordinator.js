// Coordenador de migração (docs/arquitetura-produto/14-MIGRACOES.md §2; ADR-038).
//
//   detectar versão atual → backup lógico completo → SHA-256 → gravar → validar
//   → gravar o estado PENDENTE com a referência do backup (ainda na versão antiga)
//   → só então abrir na versão nova → backfills resumíveis EM CADEIA → verificar
//
// Cadeia (ADR-049): cada versão com backfill tem estado próprio
// (appSettings['migration:vN']) e os backfills pendentes rodam em ordem
// crescente (v7 e depois v8). Banco novo, upgrade v6 → v8, v7 → v8, restore de
// backup de versão anterior e reset percorrem a mesma cadeia; a primeira falha
// para a cadeia e bloqueia a escrita.
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
import { V8_VERSION, dryRunV8, runV8Backfill } from './v8Backfill.js';

// Versão do app que ainda lê a store `lotes` (orientação do bloqueio MIGRATION_BLOCKED_LOTES).
export const LEGACY_LOTES_APP_VERSION = '1.1.17';

// Backfills por versão alvo. Versão nova com backfill entra aqui e na cadeia.
const BACKFILLS = {
  [V7_VERSION]: { run: runV7Backfill, dryRun: dryRunV7 },
  [V8_VERSION]: { run: runV8Backfill, dryRun: dryRunV8 },
};

/** Versões com backfill até a vigente, em ordem crescente. */
export const MIGRATION_CHAIN = Object.freeze(
  Object.keys(BACKFILLS).map(Number).filter((version) => version <= DB_VERSION).sort((left, right) => left - right),
);

/** Versões da cadeia posteriores à versão de origem (banco instalado ou backup). */
export function chainVersionsAfter(sourceVersion) {
  const source = Number(sourceVersion) || 0;
  return MIGRATION_CHAIN.filter((version) => version > source);
}

/** { [versao]: estado | null } de toda a cadeia. */
export async function readChainStates(db) {
  const states = {};
  for (const version of MIGRATION_CHAIN) states[version] = await readMigrationState(db, version);
  return states;
}

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

// Estado PENDENTE de uma versão da cadeia com a referência do backup pré-migração.
function pendingPatch({ backup, inspection }) {
  return {
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
  };
}

// PENDENTE para toda versão da cadeia posterior à instalada. Estado anterior não
// concluído (ex.: v8 interrompida) é preservado — só completa a referência do backup.
async function markChainPending(db, { backup, inspection }) {
  const states = {};
  for (const version of chainVersionsAfter(inspection.currentVersion)) {
    const previous = await readMigrationState(db, version);
    if (!previous || previous.status === MIGRATION_STATUS.CONCLUIDA) {
      states[version] = await writeMigrationState(db, version, pendingPatch({ backup, inspection }));
    } else if (!previous.backup && backup) {
      states[version] = await writeMigrationState(db, version, { backup });
    } else {
      states[version] = previous;
    }
  }
  return states;
}

/**
 * Grava o estado técnico PENDENTE (de cada versão da cadeia posterior à
 * instalada) com a referência do backup ANTES de abrir o banco na versão nova (a
 * store appSettings já existe na versão de origem). Fecha a janela de crash entre
 * o backup e a abertura: quem reabrir encontra o estado e o backup registrados.
 * Devolve { [versao]: estado } ou null quando a origem não tem appSettings.
 */
export async function recordPendingMigrationBeforeOpen({ backup, inspection }) {
  const probe = await openDynamic();
  try {
    if (!probe.tables.some((table) => table.name === 'appSettings')) return null;
    // await obrigatório: o finally fecha o probe e a gravação precisa ter terminado.
    return await markChainPending(probe, { backup, inspection });
  } finally {
    probe.close();
  }
}

/**
 * Reentrante: percorre a cadeia em ordem e continua cada backfill do seu
 * checkpoint (versões CONCLUIDA devolvem alreadyDone). Para na primeira versão
 * que não concluiu (maxBatches) ou falhou. Só com a cadeia inteira concluída a
 * escrita é liberada; em falha bloqueia e relança MIGRATION_FAILED (err.versao).
 * Devolve { completed, alreadyDone, versao, state, states, results[] }: `state` é
 * o da última versão processada (a vigente quando completed).
 */
export async function runPendingBackfills({ onProgress, maxBatches, files = null, hooks = null, origem = null } = {}) {
  const db = await ensureStorageReady();
  const states = {};
  const results = [];
  let current = null;
  try {
    for (const version of MIGRATION_CHAIN) {
      current = version;
      const result = await BACKFILLS[version].run(db, { onProgress, maxBatches, files, hooks, origem });
      states[version] = result.state;
      results.push({ versao: version, completed: result.completed, alreadyDone: Boolean(result.alreadyDone) });
      if (!result.completed) {
        return { completed: false, alreadyDone: false, versao: version, state: result.state, states, results };
      }
      if (!result.alreadyDone) {
        await recordBackupHistory(`migration-v${version}`, { relatorio: result.state?.relatorio || null, finished_at: result.state?.finished_at || null });
      }
    }
  } catch (err) {
    if (err && typeof err === 'object' && err.versao == null) err.versao = current;
    setWriteBlocked({ code: 'MIGRATION_FAILED', message: err.message, version: current });
    throw err;
  }
  clearWriteBlock();
  const last = MIGRATION_CHAIN.at(-1) ?? DB_VERSION;
  return {
    completed: true,
    alreadyDone: results.every((item) => item.alreadyDone),
    versao: last,
    state: states[last] ?? null,
    states,
    results,
  };
}

/**
 * Estado técnico + bloqueio de escrita em memória (Manutenção e diagnóstico).
 * Sem versão: foca a primeira versão da cadeia ainda não concluída (a que exige
 * atenção) ou, com tudo concluído, a vigente. `cadeia` lista o status de todas.
 */
export async function getMigrationState(version = null) {
  const db = await ensureStorageReady();
  const states = await readChainStates(db);
  const cadeia = MIGRATION_CHAIN.map((versao) => ({ versao, status: states[versao]?.status || null }));
  let versao;
  if (version != null) {
    versao = Number(version);
  } else {
    versao = MIGRATION_CHAIN.find((item) => states[item]?.status !== MIGRATION_STATUS.CONCLUIDA) ?? MIGRATION_CHAIN.at(-1) ?? DB_VERSION;
  }
  const state = versao in states ? states[versao] : await readMigrationState(db, versao);
  return { versao, state, cadeia, writeBlock: getWriteBlock(), blocked: getWriteBlock() !== null };
}

/**
 * Relatório sem gravação (Manutenção e evidência). Com versão: o dry-run daquele
 * backfill. Sem versão: a cadeia inteira — a forma histórica do relatório v7 fica
 * no topo (é a única versão que converte dados; a tela a exibe), com `versao`,
 * `status` e `pendente` da cadeia, `cadeia` e o dry-run de cada versão em `versoes`.
 */
export async function dryRunBackfill(version = null) {
  if (version != null) {
    const backfill = BACKFILLS[version];
    if (!backfill) throw new MigrationError('MIGRATION_UNKNOWN_VERSION', `Não há migração registrada para a versão ${version}.`);
    const db = await ensureStorageReady();
    return backfill.dryRun(db);
  }
  const db = await ensureStorageReady();
  const versoes = {};
  for (const item of MIGRATION_CHAIN) versoes[item] = await BACKFILLS[item].dryRun(db);
  const cadeia = MIGRATION_CHAIN.map((item) => ({ versao: item, status: versoes[item].status, pendente: versoes[item].pendente }));
  const foco = cadeia.find((item) => item.pendente) || cadeia.at(-1);
  return {
    ...(versoes[V7_VERSION] || {}),
    versao: foco?.versao ?? DB_VERSION,
    status: foco?.status ?? null,
    pendente: cadeia.some((item) => item.pendente),
    cadeia,
    versoes,
  };
}

// Primeira versão da cadeia com estado FALHOU (retomada manual).
function firstFailed(states) {
  const versao = MIGRATION_CHAIN.find((item) => states[item]?.status === MIGRATION_STATUS.FALHOU);
  return versao == null ? null : { versao, state: states[versao] };
}

/**
 * inspect → prepare (se necessário) → estado PENDENTE + backup gravados na versão
 * antiga → open → runPendingBackfills (cadeia).
 * Devolve { migrated, report, state, states, blocked, error, inspection, backup }:
 * `state`/`report` da versão vigente (ou da versão que falhou); `states` com o
 * estado de cada versão da cadeia.
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
    // Reconciliação pós-abertura: os estados já existem (gravados antes do upgrade);
    // só são recriados/completados se por algum motivo faltarem (origem sem appSettings).
    await markChainPending(db, { backup, inspection });
    if (backup && !backup.skipped) await recordBackupHistory('pre-migration', backup);
  }
  const failed = firstFailed(await readChainStates(db));
  if (failed) {
    // Retomada é manual (docs 14 §5): o app abre em modo somente leitura.
    const block = setWriteBlocked({ code: 'MIGRATION_FAILED', message: failed.state.error?.message || 'Migração anterior falhou.', version: failed.versao });
    return { migrated, report: failed.state.relatorio || null, state: failed.state, states: await readChainStates(db), blocked: true, error: failed.state.error || null, writeBlock: block, inspection, backup };
  }
  try {
    const result = await runPendingBackfills({ onProgress, files, hooks, origem: inspection.exists ? `upgrade-v${inspection.currentVersion}` : 'fresh' });
    return { migrated, report: result.state?.relatorio || null, state: result.state, states: await readChainStates(db), blocked: false, error: null, writeBlock: null, inspection, backup };
  } catch (err) {
    const versao = err?.versao ?? getWriteBlock()?.version ?? DB_VERSION;
    const state = await readMigrationState(db, versao);
    return { migrated, report: state?.relatorio || null, state, states: await readChainStates(db), blocked: true, error: state?.error || { code: err.code, message: err.message }, writeBlock: getWriteBlock(), inspection, backup };
  }
}
