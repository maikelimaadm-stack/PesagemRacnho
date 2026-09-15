// Estado técnico da migração (appSettings['migration:vN']) e bloqueio de escrita
// em memória (docs/arquitetura-produto/14-MIGRACOES.md §3 e §5, ADR-038).
export const MIGRATION_STATUS = Object.freeze({
  PENDENTE: 'PENDENTE',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  CONCLUIDA: 'CONCLUIDA',
  FALHOU: 'FALHOU',
});

export const migrationKey = (version) => `migration:v${version}`;

export class MigrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    Object.assign(this, details);
  }
}

export function emptyMigrationReport() {
  return {
    marcas: 0,
    racas: 0,
    categorias: 0,
    causasMorte: 0,
    parceiros: 0,
    propriedades: 0,
    animaisAtualizados: 0,
    identificadores: 0,
    sessoes: 0,
    lotes: 0,
    apartacoes: 0,
    payloadsLimpos: 0,
    chavesLegadasRemovidas: [],
    colisoesMarca: [],
    saidasSemMotivo: 0,
    sanidade: null,
    integridade: null,
  };
}

export function emptyMigrationState(version, extra = {}) {
  return {
    versao: version,
    status: MIGRATION_STATUS.PENDENTE,
    origem: null,
    started_at: null,
    last_checkpoint: null,
    passo: null,
    cursor: null,
    passos_concluidos: [],
    processed: 0,
    total: 0,
    finished_at: null,
    error: null,
    backup: null,
    relatorio: emptyMigrationReport(),
    ...extra,
  };
}

/** Lê o estado técnico da migração `version`; null quando nunca registrado. */
export async function readMigrationState(db, version) {
  const row = await db.table('appSettings').get(migrationKey(version));
  return row?.value && typeof row.value === 'object' ? row.value : null;
}

/** Grava (merge raso) o estado técnico e devolve o valor persistido. */
export async function writeMigrationState(db, version, patch) {
  const current = (await readMigrationState(db, version)) || emptyMigrationState(version);
  const next = { ...current, ...patch, versao: version };
  await db.table('appSettings').put({ key: migrationKey(version), value: next });
  return next;
}

// ---------------------------------------------------------------------------
// Bloqueio de escrita (flag de processo). Ativado quando a migração falha ou é
// bloqueada; os repositórios e adapters de escrita lançam MIGRATION_BLOCKED.
// ---------------------------------------------------------------------------
let writeBlock = null;

export function isWriteBlocked() {
  return writeBlock !== null;
}

export function getWriteBlock() {
  return writeBlock ? { ...writeBlock } : null;
}

export function setWriteBlocked({ code = 'MIGRATION_BLOCKED', message = 'Migração pendente ou com falha.', version = null } = {}) {
  writeBlock = { code, message, version, since: new Date().toISOString() };
  return getWriteBlock();
}

export function clearWriteBlock() {
  writeBlock = null;
}

/** Lança MIGRATION_BLOCKED enquanto a escrita estiver bloqueada. */
export function assertWritable(operation = 'Gravação') {
  if (!writeBlock) return;
  throw new MigrationError(
    'MIGRATION_BLOCKED',
    `${operation} bloqueada: a migração do banco está pendente ou falhou (${writeBlock.message}). Abra Backup e Manutenção › Migração e use "Continuar migração".`,
    { reason: writeBlock.code },
  );
}
