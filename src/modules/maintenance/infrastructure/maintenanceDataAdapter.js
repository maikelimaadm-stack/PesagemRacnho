// D.16 cutover: Manutenção agora usa IndexedDB/Dexie (storageAdapter).
// Backup/export são gerados no renderer (Dexie) e persistidos em disco via IPC
// de arquivo (app:writeUserFile). Import/restore leem JSON via dialog e aplicam
// em transação Dexie. Nenhum CRUD de banco passa por IPC.
//
// Programa 2.0: versões em cinco eixos (ADR-037), estado da migração (ADR-038),
// limpeza em dois níveis (ADR-032) e diagnóstico sem credenciais (ADR-035).
import storage from '../../../storage/storageAdapter.js';
import { describeVersions } from '../../../versioning/versionInfo.js';
import { runSaidaDerivedBackfill } from '../../weighing/application/weighingDerivedBackfill.js';

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

function safetyEvidenceOf(saved) {
  return { path: saved.path, size: saved.size, sha256: saved.sha256 };
}

export async function isMaintenanceAvailable() {
  try { await storage.ensureReady(); return true; } catch { return false; }
}

// --- Verificação de backup (P21): ler de volta, conferir SHA do arquivo e validar o conteúdo ---

async function readUserFile(subdir, filename) {
  if (!files()?.readUserFile) throw new Error('Leitura de arquivo indisponível (abra pelo aplicativo desktop).');
  return unwrapDialog(await files().readUserFile({ subdir, filename }));
}

const baseName = (fullPath) => String(fullPath || '').split(/[\\/]/).pop();

/**
 * Lê o backup de volta do disco e valida: SHA-256 do arquivo (contra o gravado, quando conhecido),
 * JSON, formato, SHA-256 do conteúdo, contagens e esquema (dryRunRestore). Registra o resultado no
 * histórico ('verify'): "verificado" só existe com essa leitura de volta — arquivo encontrado não basta.
 */
export async function verifyBackupFile({ name, expectedFileSha256 = null } = {}) {
  const startedAt = new Date().toISOString();
  let read = null;
  try {
    read = await readUserFile('backups', name);
    if (expectedFileSha256 && read.sha256 !== expectedFileSha256) {
      throw Object.assign(new Error('O arquivo no disco não é o mesmo que foi gravado (SHA-256 diferente).'), { code: 'BACKUP_VERIFY_SHA' });
    }
    let payload;
    try { payload = JSON.parse(read.content); } catch {
      throw Object.assign(new Error('Arquivo truncado ou corrompido: não é um JSON válido.'), { code: 'BACKUP_VERIFY_JSON' });
    }
    const dry = await storage.dryRunRestore(payload);
    const result = {
      ok: true, path: read.path, name: baseName(read.path), size: read.size, fileSha256: read.sha256,
      payloadSha256: payload?.integrity?.sha256 || null, backupId: payload?.manifest?.backupId || null,
      createdAt: payload?.manifest?.createdAt || payload?.createdAt || null, reason: payload?.manifest?.reason || null,
      automatic: Boolean(payload?.manifest?.automatic), dbVersion: dry.sourceDbVersion, counts: dry.counts, verifiedAt: startedAt,
    };
    await storage.recordBackupHistory('verify', result);
    return result;
  } catch (err) {
    const failure = { ok: false, path: read?.path || null, name: name || null, size: read?.size ?? null, fileSha256: read?.sha256 || null, error: err.message, code: err.code || null, verifiedAt: startedAt };
    await storage.recordBackupHistory('verify', failure);
    return failure;
  }
}

/**
 * Comando ÚNICO de backup (P19): cria o backup completo e o verifica lendo de volta do disco.
 * Só devolve ok com a verificação aprovada; se a verificação falhar, o erro diz por quê.
 */
export async function createBackupNow({ reason = 'manual-ui', automatic = false } = {}) {
  const saved = await persistFullBackup({ reason, automatic });
  const verification = await verifyBackupFile({ name: baseName(saved.path), expectedFileSha256: saved.sha256 });
  if (!verification.ok) {
    throw Object.assign(new Error(`O backup foi gravado, mas a verificação falhou: ${verification.error}`), { code: 'BACKUP_VERIFY_FAILED', backupPath: saved.path });
  }
  return { ok: true, backupPath: saved.path, counts: saved.counts, size: saved.size, sha256: saved.sha256, verified: true, verifiedAt: verification.verifiedAt };
}

// Compatibilidade: os dois nomes antigos são o MESMO backup completo (antes dois botões sugeriam
// formatos diferentes — P19). Ambos passam pelo comando único, com verificação.
export async function createDatabaseBackup(options = {}) {
  return createBackupNow({ reason: options.reason || 'manual-ui' });
}
export async function createFullDataBackup(options = {}) {
  const r = await createBackupNow({ reason: options.reason || 'manual-ui' });
  return { ...r, backupDir: r.backupPath, files: Object.keys(r.counts || {}) };
}

function parseHistory(row) {
  let detalhes = {};
  try { detalhes = JSON.parse(row.detalhes || '{}'); } catch { detalhes = {}; }
  return { tipo: row.tipo, created_at: row.created_at, ...detalhes };
}

/**
 * Situação da proteção (P21): último backup criado, último VERIFICADO (leitura de volta ok) e os
 * arquivos da pasta com o estado de cada um — verificado, falhou na verificação ou não verificado.
 */
export async function getBackupStatus() {
  const db = await storage.ensureReady();
  const history = (await db.table('backupHistory').toArray()).map(parseHistory)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const created = history.filter((h) => h.tipo === 'full-durable');
  const verifies = history.filter((h) => h.tipo === 'verify');
  const lastVerified = verifies.find((h) => h.ok) || null;
  let filesList = [];
  let unavailable = false;
  try {
    filesList = (await listBackups()).full || [];
    unavailable = !files()?.listUserFiles;
  } catch { unavailable = true; }
  const catalog = filesList.map((file) => {
    const verify = verifies.find((h) => h.path === file.path && h.size === file.size);
    const origin = created.find((h) => h.path === file.path);
    return {
      ...file,
      reason: origin?.reason || verify?.reason || null,
      automatic: origin?.automatic ?? verify?.automatic ?? null,
      estado: verify ? (verify.ok ? 'VERIFICADO' : 'FALHOU') : 'NAO_VERIFICADO',
      verifiedAt: verify?.verifiedAt || null,
      erro: verify && !verify.ok ? verify.error : null,
    };
  });
  const protecao = lastVerified ? 'VERIFICADO' : (catalog.length ? 'NAO_VERIFICADO' : 'SEM_BACKUP');
  return { protecao, lastCreated: created[0] || null, lastVerified, files: catalog, unavailable };
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
  const result = await storage.applyImportPesagens(payload, { safetyEvidence: safetyEvidenceOf(safety) });
  return { ...result, safetyBackup: safetyEvidenceOf(safety) };
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
  const result = await storage.applyRestore(backup, { safetyEvidence: safetyEvidenceOf(safety), files: files() });
  // E1G (1.4.2): backup de antes da 1.4.2 volta sem o marcador 'derivados-saida-v1' — o GMD das saídas com peso é
  // recalculado já, sem esperar a próxima abertura (nunca lança; com o marcador, não faz nada).
  await runSaidaDerivedBackfill();
  return result;
}

// --- Versões, migração, limpeza em dois níveis, diagnóstico ---

export function getVersionInfo() {
  return describeVersions();
}

export async function getMigrationStatus() {
  return storage.migration.getMigrationState();
}

export async function dryRunMigration() {
  return storage.migration.dryRunBackfill();
}

export async function resumeMigration({ onProgress } = {}) {
  const result = await storage.migration.runPendingBackfills({ files: files(), onProgress });
  // E1G (1.4.2): com a migração concluída, roda o passo de dados que a abertura adiou (escrita bloqueada).
  if (result?.completed) await runSaidaDerivedBackfill();
  return result;
}

export async function clearOperationalData() {
  const safety = await persistFullBackup({ reason: 'pre-clear-operational', automatic: true });
  const result = await storage.clearOperationalData({ safetyEvidence: safetyEvidenceOf(safety) });
  return { ...result, backupPath: safety.path, safetyBackup: safetyEvidenceOf(safety) };
}

export async function resetAllData({ confirmedByAdmin = false } = {}) {
  const safety = await persistFullBackup({ reason: 'pre-reset-all', automatic: true });
  const result = await storage.resetAllData({ safetyEvidence: safetyEvidenceOf(safety), confirmedByAdmin, files: files() });
  return { ...result, backupPath: safety.path, safetyBackup: safetyEvidenceOf(safety) };
}

// Relatório resumido por versão: v7 descreve a conversão dos cadastros; v8
// (ADR-049) só as contagens das stores de sanidade criadas; v9 a natureza dos
// movimentos e as operações legadas (17-MODELO-DADOS-V9.md).
function reportSummary(relatorio) {
  if (!relatorio) return null;
  if (relatorio.operacoesLegadasEntrada !== undefined) {
    return {
      storesCriadas: relatorio.storesCriadas || [],
      movimentosComNatureza: relatorio.movimentosComNatureza, movimentosSemNatureza: relatorio.movimentosSemNatureza,
      operacoesLegadasEntrada: relatorio.operacoesLegadasEntrada, operacoesLegadasSaida: relatorio.operacoesLegadasSaida,
      itensLegados: relatorio.itensLegados, pesagensJaConvertidas: relatorio.pesagensJaConvertidas,
    };
  }
  if (relatorio.storesCriadas !== undefined) {
    return {
      storesCriadas: relatorio.storesCriadas || [],
      programasSanidade: relatorio.programasSanidade, medicamentos: relatorio.medicamentos, aplicacoesSanidade: relatorio.aplicacoesSanidade,
    };
  }
  return {
    marcas: relatorio.marcas, racas: relatorio.racas, categorias: relatorio.categorias,
    causasMorte: relatorio.causasMorte, parceiros: relatorio.parceiros, propriedades: relatorio.propriedades,
    animaisAtualizados: relatorio.animaisAtualizados, identificadores: relatorio.identificadores,
    payloadsLimpos: relatorio.payloadsLimpos, colisoesMarca: (relatorio.colisoesMarca || []).length,
    saidasSemMotivo: relatorio.saidasSemMotivo, chavesLegadasRemovidas: (relatorio.chavesLegadasRemovidas || []).length,
    integridade: relatorio.integridade ? { ok: relatorio.integridade.ok, total: relatorio.integridade.total } : null,
  };
}

// Resumo do estado da migração sem dados de usuário. `versao` é a versão em foco
// (a primeira da cadeia não concluída ou a vigente); `cadeia` lista todas.
function migrationSummary(status) {
  const state = status?.state || null;
  return {
    versao: status?.versao ?? null,
    cadeia: (status?.cadeia || []).map((item) => ({ versao: item.versao, status: item.status || 'SEM_REGISTRO' })),
    status: state?.status || 'SEM_REGISTRO',
    origem: state?.origem || null,
    started_at: state?.started_at || null,
    finished_at: state?.finished_at || null,
    last_checkpoint: state?.last_checkpoint || null,
    processed: state?.processed ?? null,
    total: state?.total ?? null,
    error: state?.error || null,
    backup: state?.backup ? { path: state.backup.path || null, size: state.backup.size ?? null, sha256: state.backup.sha256 || null, skipped: Boolean(state.backup.skipped) } : null,
    relatorio: reportSummary(state?.relatorio),
    writeBlocked: Boolean(status?.blocked),
    writeBlock: status?.writeBlock || null,
  };
}

/**
 * Diagnóstico para "Copiar diagnóstico": versões (cinco eixos), estado da
 * migração, estatísticas por store e integridade. Nunca inclui usuários locais,
 * hash ou salt — só contagens.
 */
export async function getDiagnosticSnapshot() {
  const versions = describeVersions();
  const [stats, integrity, migration] = await Promise.all([
    storage.databaseStats().catch((err) => ({ error: err.message })),
    storage.logicalIntegrity().catch((err) => ({ ok: false, result: 'erro', issues: [err.message] })),
    storage.migration.getMigrationState().catch((err) => ({ state: null, blocked: false, error: err.message })),
  ]);
  return {
    geradoEm: new Date().toISOString(),
    versoes: versions,
    migracao: migrationSummary(migration),
    armazenamento: { tipo: stats?.dbType || 'IndexedDB/Dexie', versao: stats?.dbVersion ?? versions.dbSchema, contagens: stats?.counts || null },
    integridade: { ok: integrity?.ok !== false, resultado: integrity?.result || 'desconhecido', problemas: (integrity?.issues || []).slice(0, 50), total: (integrity?.issues || []).length },
    escritaBloqueada: storage.isWriteBlocked(),
  };
}
