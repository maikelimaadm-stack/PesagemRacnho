// Armazenamento local do app: IndexedDB/Dexie (ver src/storage/storageAdapter.js).
// O antigo proxy `db.entities` (JSON via IPC) e os caminhos de arquivo do banco
// foram removidos no cutover Dexie — não existe mais arquivo de banco para abrir.
//
// A abertura passa pelo coordenador de migração (ADR-038): backup físico
// pré-migração validado ANTES de abrir na versão nova, backfill resumível depois.
import storage from '../storage/storageAdapter.js';
import { runSaidaDerivedBackfill } from '../modules/weighing/application/weighingDerivedBackfill.js';
import { carregarBloqueioCritico } from '../storage/criticalRestoreState.js';

export const DEFAULT_EMPRESA_ID = 'local';

// Códigos que impedem a abertura do banco na versão nova (fail closed).
const PRE_OPEN_BLOCK_CODES = new Set(['MIGRATION_BLOCKED_LOTES', 'MIGRATION_BACKUP_FAILED']);

let bootstrapState = { ready: false, migrated: false, blocked: false, error: null, state: null, report: null };

export const ensureEmpresaId = () => {
  if (!localStorage.getItem('empresa_selecionada_id')) {
    localStorage.setItem('empresa_selecionada_id', DEFAULT_EMPRESA_ID);
  }
  return localStorage.getItem('empresa_selecionada_id');
};

function filesPort() {
  return typeof window !== 'undefined' ? window.pesagemApp?.files || null : null;
}

function blockedError(err) {
  const reason = err?.code || 'MIGRATION_BLOCKED';
  const detail = err?.message || 'motivo desconhecido';
  const message = reason === 'MIGRATION_BACKUP_FAILED'
    ? `Não foi possível criar o backup de segurança antes de atualizar o banco de dados. Nenhum dado foi alterado. ${detail}`
    : reason === 'MIGRATION_BLOCKED_LOTES'
      ? `A atualização do banco de dados foi bloqueada. Nenhum dado foi alterado. ${detail}`
      : `A atualização do banco de dados foi bloqueada. ${detail}`;
  const blocked = new Error(message);
  blocked.code = 'MIGRATION_BLOCKED';
  blocked.reason = reason;
  blocked.cause = err;
  return blocked;
}

/**
 * Garante o armazenamento local pronto na primeira abertura (sem configuração).
 * Lança Error(code='MIGRATION_BLOCKED', reason) quando o banco NÃO pôde ser aberto
 * na versão nova (backup pré-migração falhou ou store `lotes` com registros).
 * Falha no backfill não lança: o app abre com a escrita bloqueada e o estado
 * fica disponível em getMigrationBootstrapState() para a Manutenção retomar.
 */
export const bootstrapLocalDb = async ({ onProgress } = {}) => {
  ensureEmpresaId();
  try {
    // R3-01: o marcador em ARQUIVO de restauração crítica é lido antes de abrir o banco (nada grava antes dele); a
    // cópia em appSettings é conferida na primeira storage.ensureReady() logo abaixo.
    await carregarBloqueioCritico(null);
    const result = await storage.migration.openWithMigration({ files: filesPort(), onProgress });
    await storage.ensureReady();
    bootstrapState = {
      ready: true,
      migrated: Boolean(result.migrated),
      blocked: Boolean(result.blocked),
      error: result.error || null,
      state: result.state || null,
      report: result.report || null,
      writeBlock: result.writeBlock || null,
      backup: result.backup || null,
    };
    if (result.blocked) {
      console.warn('[storage] migração com falha; escrita bloqueada até "Continuar migração":', result.error?.message);
    } else {
      // E1G (1.4.2): passo de DADOS único (ganho e GMD das saídas com peso), guardado por marcador em
      // configurações. Nunca bloqueia a abertura: a falha fica no console e a próxima abertura tenta de novo.
      bootstrapState.dataSteps = { saidaDerived: await runSaidaDerivedBackfill() };
    }
  } catch (err) {
    if (PRE_OPEN_BLOCK_CODES.has(err?.code)) {
      bootstrapState = { ready: false, migrated: false, blocked: true, error: { code: err.code, message: err.message }, state: null, report: null, writeBlock: storage.getWriteBlock() };
      throw blockedError(err);
    }
    console.warn('[storage] ensureReady falhou:', err.message);
    bootstrapState = { ready: false, migrated: false, blocked: false, error: { code: err?.code || 'STORAGE_UNAVAILABLE', message: err.message }, state: null, report: null };
  }
  return bootstrapState;
};

/** Estado da última abertura (migrado / bloqueado / erro) para o DbBootstrap e a Manutenção. */
export const getMigrationBootstrapState = () => ({ ...bootstrapState, writeBlocked: storage.isWriteBlocked() });

/** Retomada manual da migração (Manutenção › "Continuar migração"). */
export const resumeMigration = async ({ onProgress } = {}) => {
  const result = await storage.migration.runPendingBackfills({ files: filesPort(), onProgress });
  bootstrapState = { ...bootstrapState, ready: true, blocked: !result.completed, state: result.state, report: result.state?.relatorio || null, error: result.completed ? null : bootstrapState.error };
  return result;
};

/** Abre a pasta de dados (backups/exportações) — via IPC de sistema de arquivos. */
export const openDataFolder = () => window.pesagemApp?.openDataFolder?.();

/** Limpa os dados operacionais somente com a evidência de um backup físico já validado. */
export const clearAllData = (safetyEvidence) => storage.clearOperationalData({ safetyEvidence });

ensureEmpresaId();
