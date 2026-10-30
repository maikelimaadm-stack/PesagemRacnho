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

// Relatório por versão: cada backfill tem o seu (o da v7 descreve a conversão dos
// cadastros; o da v8 só as contagens das stores de sanidade criadas, ADR-049).
export function emptyMigrationReport(version = 7) {
  if (Number(version) >= 9) return emptyMigrationReportV9();
  if (Number(version) >= 8) return emptyMigrationReportV8();
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

/** v8 aditiva: nada é convertido; o relatório registra as stores novas e suas contagens. */
export function emptyMigrationReportV8() {
  return {
    storesCriadas: [],
    programasSanidade: 0,
    medicamentos: 0,
    aplicacoesSanidade: 0,
  };
}

/** v9 aditiva (17-MODELO-DADOS-V9): stores novas, natureza dos movimentos e operações legadas. */
export function emptyMigrationReportV9() {
  return {
    storesCriadas: [],
    movimentosComNatureza: 0,
    movimentosSemNatureza: 0,
    operacoesLegadasEntrada: 0,
    operacoesLegadasSaida: 0,
    itensLegados: 0,
    pesagensJaConvertidas: 0,
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
    relatorio: emptyMigrationReport(version),
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
//
// Isenção (docs 11 §5, ADR-045): a store `usuarios` e a `auditoria` continuam
// graváveis sob bloqueio — sem isso o ADMIN não consegue autenticar (o login
// grava last_login_at/failed_login_count) nem registrar o evento de acesso, e
// nunca chegaria a "Continuar migração". Dados operacionais permanecem bloqueados.
// ---------------------------------------------------------------------------
export const WRITE_BLOCK_EXEMPT_STORES = Object.freeze(['usuarios', 'auditoria']);

let writeBlock = null;

/** Códigos de erro dos dois bloqueios de escrita (migração e restauração crítica). */
export const WRITE_BLOCK_ERROR_CODES = Object.freeze(['MIGRATION_BLOCKED', 'RESTAURACAO_CRITICA']);
/** true quando o erro é um bloqueio de escrita — gravações best-effort (login, auditoria de acesso) o toleram. */
export function isWriteBlockError(error) {
  return Boolean(error) && (WRITE_BLOCK_ERROR_CODES.includes(error.code) || WRITE_BLOCK_ERROR_CODES.includes(error.reason));
}
// Avisa a tela (faixa global) quando um bloqueio entra ou sai. Fora do navegador (gates em Node) não faz nada.
function avisarMudanca() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') window.dispatchEvent(new Event('pesagens:bloqueio-escrita'));
  } catch { /* só aviso de tela */ }
}
// R3-01: bloqueio CRÍTICO de restauração em espaço próprio. A migração (`setWriteBlocked`/`clearWriteBlock`) e a
// restauração comum nunca o desfazem; só `clearCriticalBlock` — chamado depois de uma restauração conferida — e um
// novo processo só o perde se o marcador durável (fora do banco) também não existir.
let criticalBlock = null;

export function isWriteBlocked() {
  return writeBlock !== null || criticalBlock !== null;
}

export function getWriteBlock() {
  if (criticalBlock) return { ...criticalBlock };
  return writeBlock ? { ...writeBlock } : null;
}

export function setCriticalBlock({ message = 'restauração falhou e a volta automática também', fase = null, backupNome = null, backupSha256 = null, persistido = null } = {}) {
  criticalBlock = { code: 'RESTAURACAO_CRITICA', message, fase, backupNome, backupSha256, persistido, since: new Date().toISOString() };
  avisarMudanca();
  return { ...criticalBlock };
}

export function getCriticalBlock() {
  return criticalBlock ? { ...criticalBlock } : null;
}

export function clearCriticalBlock() {
  criticalBlock = null;
  avisarMudanca();
}

export function setWriteBlocked({ code = 'MIGRATION_BLOCKED', message = 'Migração pendente ou com falha.', version = null } = {}) {
  writeBlock = { code, message, version, since: new Date().toISOString() };
  avisarMudanca();
  return getWriteBlock();
}

/** Libera só o bloqueio de MIGRAÇÃO; o crítico de restauração (R3-01) não é afetado. */
export function clearWriteBlock() {
  writeBlock = null;
  avisarMudanca();
}

/** true quando a store pode ser gravada mesmo com o bloqueio ativo (usuarios, auditoria). */
export function isWriteBlockExempt(storeName) {
  return WRITE_BLOCK_EXEMPT_STORES.includes(String(storeName || ''));
}

/**
 * Lança MIGRATION_BLOCKED enquanto a escrita estiver bloqueada.
 * `options.store` (ou uma string no segundo argumento) identifica a store: as
 * isentas (usuarios, auditoria) nunca lançam.
 */
export function assertWritable(operation = 'Gravação', options = {}) {
  if (!writeBlock && !criticalBlock) return;
  const store = typeof options === 'string' ? options : options?.store;
  if (store && isWriteBlockExempt(store)) return;
  // R2-02/R3-01: restauração que falhou sem conseguir voltar — a orientação é restaurar, não migrar.
  if (criticalBlock) {
    throw new MigrationError('RESTAURACAO_CRITICA', `${operation} bloqueada: a última restauração falhou e a volta automática também (${criticalBlock.message}). Abra Sistema › Backup e Restauração e restaure o backup de segurança${criticalBlock.backupNome ? ` ${criticalBlock.backupNome}` : ' indicado'}.`, { reason: criticalBlock.code });
  }
  throw new MigrationError(
    'MIGRATION_BLOCKED',
    `${operation} bloqueada: a migração do banco está pendente ou falhou (${writeBlock.message}). Abra Backup e Manutenção › Migração e use "Continuar migração".`,
    { reason: writeBlock.code },
  );
}
