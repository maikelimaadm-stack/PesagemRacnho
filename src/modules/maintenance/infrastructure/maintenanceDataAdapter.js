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
import { attachmentObjects } from '../../documents/domain/documentRules.js';

function files() {
  return window.pesagemApp?.files || null;
}
function getDialogs() {
  return window.pesagemApp?.dialogs || null;
}
// F16: anexos dos documentos (pasta de dados do usuário, fora do IndexedDB).
function attachments() {
  return window.pesagemApp?.attachments || null;
}
/** Objetos de anexo (sha256 + ext) de um backup (todos os documentos com arquivo, inclusive cancelados). */
function backupAttachmentObjects(backup) {
  return attachmentObjects(backup?.stores?.documentos || []);
}
const anexosResumo = (r) => (r ? { total: r.total, ok: r.ok, faltando: r.faltando || [], corrompidos: r.corrompidos || [], pasta: r.pasta || null } : null);
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
  // F16: pacote = JSON + pasta "<backup>.anexos" com cada anexo conferido pelo SHA-256.
  const objetos = backupAttachmentObjects(backup);
  let anexos = { total: 0, ok: 0, faltando: [], corrompidos: [], pasta: null };
  if (objetos.length) {
    anexos = attachments()?.snapshot
      ? anexosResumo(unwrapDialog(await attachments().snapshot({ backupFile: baseName(saved.path), objects: objetos })))
      : { total: objetos.length, ok: 0, faltando: objetos.map((o) => o.sha256), corrompidos: [], pasta: null };
  }
  await storage.recordBackupHistory('full-durable', {
    anexos,
    backupId: backup.manifest?.backupId,
    reason,
    automatic,
    path: saved.path,
    size: saved.size,
    fileSha256: saved.sha256,
    payloadSha256: backup.integrity?.sha256,
    counts,
  });
  return { backup, counts, anexos, ...saved };
}

function safetyEvidenceOf(saved) {
  return { path: saved.path, size: saved.size, sha256: saved.sha256, verified: saved.verified === true, verifiedAt: saved.verifiedAt || null };
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
export async function verifyBackupFile({ name, expectedFileSha256 = null, anexosAusentesNaOrigem = [] } = {}) {
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
    // F16: backup só é COMPLETO com todos os anexos presentes e íntegros na pasta dele.
    // R01: anexos que JÁ faltavam no app quando o backup de segurança foi feito (exceção explícita da
    // restauração) não entram na conferência — e o resultado diz que o pacote está incompleto.
    const ausentes = new Set(anexosAusentesNaOrigem || []);
    const objetos = backupAttachmentObjects(payload).filter((o) => !ausentes.has(o.sha256));
    let anexos = { total: 0, ok: 0, faltando: [], corrompidos: [], pasta: null };
    if (objetos.length) {
      if (!attachments()?.verifyBackup) throw Object.assign(new Error('Não foi possível conferir os anexos do backup (abra pelo aplicativo desktop).'), { code: 'BACKUP_VERIFY_ANEXOS' });
      anexos = anexosResumo(unwrapDialog(await attachments().verifyBackup({ backupFile: baseName(read.path), objects: objetos })));
      if (anexos.faltando.length || anexos.corrompidos.length) {
        throw Object.assign(new Error(`Backup incompleto: ${anexos.faltando.length} anexo(s) faltando e ${anexos.corrompidos.length} corrompido(s) na pasta ${anexos.pasta}.`), { code: 'BACKUP_VERIFY_ANEXOS' });
      }
    }
    const result = {
      anexos,
      incompleto: ausentes.size > 0,
      anexosAusentesNaOrigem: [...ausentes],
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
export async function createBackupNow({ reason = 'manual-ui', automatic = false, aceitarAnexosAusentesNaOrigem = false } = {}) {
  const saved = await persistFullBackup({ reason, automatic });
  // Exceção explícita (só a restauração a usa): anexo que JÁ falta no app não tem como ser perdido pela
  // operação; o backup de segurança é conferido sem ele e marcado incompleto. Corrompido nunca é aceito.
  const toleraAusentes = aceitarAnexosAusentesNaOrigem && saved.anexos.faltando.length > 0 && saved.anexos.corrompidos.length === 0;
  if (!toleraAusentes && (saved.anexos.faltando.length || saved.anexos.corrompidos.length)) {
    await storage.recordBackupHistory('verify', { ok: false, path: saved.path, name: baseName(saved.path), size: saved.size, fileSha256: saved.sha256, error: 'Anexos faltando na origem: backup incompleto.', code: 'BACKUP_ANEXOS_INCOMPLETO', verifiedAt: new Date().toISOString() });
    throw Object.assign(new Error(`O backup foi gravado, mas NÃO está completo: ${saved.anexos.faltando.length} anexo(s) não encontrado(s) na pasta de anexos e ${saved.anexos.corrompidos.length} corrompido(s). Confira em Documentos.`), { code: 'BACKUP_ANEXOS_INCOMPLETO', backupPath: saved.path, anexos: saved.anexos });
  }
  const verification = await verifyBackupFile({ name: baseName(saved.path), expectedFileSha256: saved.sha256, anexosAusentesNaOrigem: toleraAusentes ? saved.anexos.faltando : [] });
  if (!verification.ok) {
    throw Object.assign(new Error(`O backup foi gravado, mas a verificação falhou: ${verification.error}`), { code: 'BACKUP_VERIFY_FAILED', backupPath: saved.path });
  }
  // R01: o arquivo lido de volta tem de ser o MESMO backup gerado em memória (conteúdo e contagens), não só um
  // JSON válido — uma gravação trocada/truncada que ainda parseia é recusada aqui.
  if (verification.payloadSha256 !== saved.backup?.integrity?.sha256) {
    await storage.recordBackupHistory('verify', { ok: false, path: saved.path, name: baseName(saved.path), error: 'Conteúdo lido de volta difere do backup gerado.', code: 'BACKUP_VERIFY_CONTEUDO', verifiedAt: new Date().toISOString() });
    throw Object.assign(new Error('O backup foi gravado, mas o conteúdo lido de volta não é o que foi gerado (SHA-256 do conteúdo diferente).'), { code: 'BACKUP_VERIFY_FAILED', backupPath: saved.path });
  }
  for (const [store, n] of Object.entries(saved.counts || {})) {
    if ((verification.counts?.[store] ?? 0) !== n) {
      throw Object.assign(new Error(`O backup foi gravado, mas a contagem de ${store} lida de volta (${verification.counts?.[store] ?? 0}) difere da gerada (${n}).`), { code: 'BACKUP_VERIFY_FAILED', backupPath: saved.path });
    }
  }
  return { ok: true, backupPath: saved.path, counts: saved.counts, size: saved.size, sha256: saved.sha256, verified: true, verifiedAt: verification.verifiedAt, anexos: saved.anexos, reason, incompleto: toleraAusentes, anexosAusentesNaOrigem: toleraAusentes ? saved.anexos.faltando : [] };
}

/**
 * R01: backup de SEGURANÇA antes de operação destrutiva (importar, restaurar, limpar, reset) — o MESMO caminho
 * verificado do botão (gravação + leitura de volta + SHA-256 do arquivo e do conteúdo + contagens + anexos).
 * Qualquer falha impede a operação: o erro BACKUP_PRE_OPERACAO_FALHOU sobe antes de qualquer escrita destrutiva.
 * A evidência entregue ao motor é a do arquivo conferido.
 */
export async function persistVerifiedSafetyBackup({ reason, aceitarAnexosAusentesNaOrigem = false }) {
  try {
    const r = await createBackupNow({ reason, automatic: true, aceitarAnexosAusentesNaOrigem });
    return { path: r.backupPath, size: r.size, sha256: r.sha256, verified: true, verifiedAt: r.verifiedAt, reason, anexos: r.anexos, incompleto: r.incompleto, anexosAusentesNaOrigem: r.anexosAusentesNaOrigem };
  } catch (err) {
    await storage.recordBackupHistory('safety-failed', { reason, error: err.message, code: err.code || null, causa: err.code === 'BACKUP_ANEXOS_INCOMPLETO' ? 'ANEXOS_AUSENTES_NA_ORIGEM' : null });
    throw Object.assign(new Error(`Operação cancelada: o backup de segurança não pôde ser verificado (${err.message}). Nada foi alterado.`), { code: 'BACKUP_PRE_OPERACAO_FALHOU', causa: err.code || null, anexosAusentes: err.anexos?.faltando || [], cause: err });
  }
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
/**
 * Situação do backup local (R03). Separa o que foi VERIFICADO (histórico, com data) do que vale AGORA:
 *   • disponível agora — o arquivo verificado está na pasta, com o mesmo nome e tamanho e sem modificação
 *     posterior à verificação;
 *   • íntegro agora — relido do disco: SHA-256 igual ao verificado e anexos da pasta ".anexos" conferidos.
 * `lastVerified` só aponta para um backup íntegro agora (é o que a cobertura, o agendador, a cópia externa e a
 * retenção usam): registro antigo de arquivo apagado, renomeado, truncado ou alterado com o mesmo tamanho não
 * conta como proteção nem adia o backup periódico. Pasta inacessível = INDISPONIVEL (não "sem backup").
 */
const TOLERANCIA_MTIME_MS = 2000;
const MAX_CANDIDATOS_CONFERIDOS = 3;

async function conferirAgora(verify) {
  try {
    const lido = await readUserFile('backups', verify.name || baseName(verify.path));
    if (verify.fileSha256 && lido.sha256 !== verify.fileSha256) return { ok: false, motivo: 'Conteúdo do arquivo mudou depois da verificação (SHA-256 diferente).' };
    let payload;
    try { payload = JSON.parse(lido.content); } catch { return { ok: false, motivo: 'Arquivo não é mais um JSON válido.' }; }
    if (verify.payloadSha256 && payload?.integrity?.sha256 !== verify.payloadSha256) return { ok: false, motivo: 'Conteúdo do backup difere do verificado.' };
    const ausentes = new Set(verify.anexosAusentesNaOrigem || []);
    const objetos = backupAttachmentObjects(payload).filter((o) => !ausentes.has(o.sha256));
    if (objetos.length) {
      if (!attachments()?.verifyBackup) return { ok: false, motivo: 'Não foi possível conferir os anexos agora.' };
      const r = anexosResumo(unwrapDialog(await attachments().verifyBackup({ backupFile: baseName(lido.path), objects: objetos })));
      if (r.faltando.length || r.corrompidos.length) return { ok: false, motivo: `Anexos do backup: ${r.faltando.length} faltando e ${r.corrompidos.length} corrompido(s) agora.` };
    }
    return { ok: true, motivo: null };
  } catch (err) {
    return { ok: false, motivo: `Não foi possível reler o arquivo agora (${err.message}).` };
  }
}

export async function getBackupStatus({ conferir = true } = {}) {
  const db = await storage.ensureReady();
  const history = (await db.table('backupHistory').toArray()).map(parseHistory)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const created = history.filter((h) => h.tipo === 'full-durable');
  const verifies = history.filter((h) => h.tipo === 'verify');
  // R2-01: verificação de backup PARCIAL (exceção da restauração: anexos que já faltavam no app ficaram fora) é
  // guardada no histórico, mas não é "backup verificado" nem proteção completa.
  const parcial = (h) => Boolean(h?.ok && (h.incompleto || (h.anexosAusentesNaOrigem || []).length));
  const ultimaVerificacao = verifies.find((h) => h.ok && !parcial(h)) || null; // histórico: "Verificado em [data]"
  const ultimoParcial = verifies.find((h) => parcial(h)) || null;
  let filesList = [];
  let unavailable = false;
  let erroPasta = null;
  if (!files()?.listUserFiles) {
    unavailable = true;
  } else {
    try { filesList = (await listBackups()).full || []; } catch (err) { unavailable = true; erroPasta = err.message; }
  }
  const catalog = filesList.map((file) => {
    const verify = verifies.find((h) => h.path === file.path) || null; // a verificação mais recente DESTE arquivo
    const origin = created.find((h) => h.path === file.path);
    const alterado = Boolean(verify?.ok) && (verify.size !== file.size
      || (file.modifiedAt && verify.verifiedAt && Date.parse(file.modifiedAt) > Date.parse(verify.verifiedAt) + TOLERANCIA_MTIME_MS));
    return {
      ...file,
      reason: origin?.reason || verify?.reason || null,
      automatic: origin?.automatic ?? verify?.automatic ?? null,
      estado: !verify ? 'NAO_VERIFICADO' : !verify.ok ? 'FALHOU' : alterado ? 'ALTERADO' : parcial(verify) ? 'PARCIAL' : 'VERIFICADO',
      verifiedAt: verify?.verifiedAt || null,
      erro: verify && !verify.ok ? verify.error : alterado ? 'Arquivo modificado depois da verificação.' : parcial(verify) ? `Backup PARCIAL: ${(verify.anexosAusentesNaOrigem || []).length} anexo(s) já faltavam no app — não é proteção completa.` : null,
      _verify: verify,
    };
  });
  const ultimoArquivo = ultimaVerificacao ? catalog.find((c) => c.path === ultimaVerificacao.path) : null;
  // Disponível agora: o último verificado está na pasta, mesmo nome e tamanho, sem modificação posterior.
  const disponivelAgora = Boolean(ultimoArquivo && ultimoArquivo.estado === 'VERIFICADO');
  // Íntegro agora: os mais novos VERIFICADOS são relidos até achar um que confere.
  let lastVerified = null;
  let conferencia = null;
  const candidatos = catalog.filter((c) => c.estado === 'VERIFICADO').sort((x, y) => String(y.verifiedAt).localeCompare(String(x.verifiedAt)));
  // R2-06: a releitura é limitada aos mais novos (custo); se nenhum deles confere e há outros não relidos, o
  // resultado diz isso — "sem proteção" seria uma certeza que a conferência não tem.
  const conferidos = candidatos.slice(0, conferir ? MAX_CANDIDATOS_CONFERIDOS : 1);
  const naoConferidos = candidatos.length - conferidos.length;
  for (const c of conferidos) {
    const r = conferir ? await conferirAgora(c._verify) : { ok: true, motivo: null, naoConferido: true };
    if (r.ok) { lastVerified = c._verify; conferencia = { em: new Date().toISOString(), ok: true, name: c.name, naoConferido: Boolean(r.naoConferido) }; break; }
    c.estado = 'ALTERADO';
    c.erro = r.motivo;
    conferencia = conferencia || { em: new Date().toISOString(), ok: false, name: c.name, motivo: r.motivo };
  }
  let protecao;
  if (lastVerified) protecao = 'VERIFICADO';
  else if (unavailable && files()?.listUserFiles) protecao = 'INDISPONIVEL';
  else if (ultimaVerificacao) protecao = 'ALTERADO';
  else if (ultimoParcial && catalog.some((c) => c.estado === 'PARCIAL')) protecao = 'PARCIAL';
  else protecao = catalog.length ? 'NAO_VERIFICADO' : 'SEM_BACKUP';
  let motivo = null;
  if (protecao === 'INDISPONIVEL') motivo = `Pasta de backups inacessível agora${erroPasta ? ` (${erroPasta})` : ''}.`;
  else if (protecao === 'ALTERADO') motivo = !ultimoArquivo ? `O backup verificado em ${ultimaVerificacao.verifiedAt} não está mais na pasta (apagado ou renomeado).` : (conferencia?.motivo || ultimoArquivo.erro || 'O backup verificado mudou depois da verificação.');
  else if (protecao === 'PARCIAL') motivo = 'Só há backup PARCIAL (anexos que já faltavam no app ficaram fora): não é proteção completa. Crie um backup completo.';
  if (!lastVerified && naoConferidos > 0) motivo = `${motivo || 'Nenhum dos backups mais novos confere agora.'} Outros ${naoConferidos} backup(s) verificado(s) antes não foram relidos agora (limite de ${MAX_CANDIDATOS_CONFERIDOS}): use Verificar neles.`;
  return {
    protecao,
    motivo,
    lastCreated: created[0] || null,
    lastVerified,
    ultimaVerificacao,
    ultimoParcial,
    conferenciaLimitada: !lastVerified && naoConferidos > 0 ? { conferidos: conferidos.length, naoConferidos } : null,
    disponivelAgora,
    integroAgora: Boolean(lastVerified) && !conferencia?.naoConferido,
    conferencia,
    files: catalog.map(({ _verify, ...rest }) => rest),
    unavailable,
    erroPasta,
  };
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
  const safety = await persistVerifiedSafetyBackup({ reason: 'pre-import' });
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
const falhaRestauracao = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

/**
 * R02 — restauração em fases, com a base intocada até tudo estar conferido:
 *   1. CONFERIR: anexos do pacote (pasta "<backup>.anexos" do arquivo EXATO selecionado — token `selecao`,
 *      relido e conferido pelo SHA-256 no processo principal) ou do envelope protegido (`anexosInline`).
 *      Faltando/corrompido/arquivo trocado → recusa, nada muda.
 *   2. BACKUP DE SEGURANÇA verificado (R01).
 *   3. PREPARAR: anexos copiados e conferidos numa pasta de preparo; falha → preparo descartado, nada muda.
 *   4. BANCO: substituição atômica (Dexie). Falha → preparo descartado.
 *   5. EFETIVAR anexos (preparo → pasta de anexos). Falha → COMPENSAÇÃO: o banco volta ao backup de segurança.
 *   6. CONFERIR DE NOVO banco + anexos: `recuperacaoCompleta` só com tudo íntegro.
 * Exceção explícita (ADMIN): `aceitarAnexosFaltandoNoPacote` restaura sem os anexos AUSENTES do pacote (nunca os
 * corrompidos) — o resultado sai com recuperacaoCompleta = false e a lista dos que faltam.
 */
export async function applyRestoreBackup(backup, { selecao = null, anexosInline = null, aceitarAnexosAusentesNaOrigem = false, aceitarAnexosFaltandoNoPacote = false } = {}) {
  const objetos = backupAttachmentObjects(backup);
  const api = attachments();
  // 1. Conferir.
  let faltandoNoPacote = [];
  if (objetos.length) {
    let pre;
    if (Array.isArray(anexosInline)) {
      const presentes = new Set(anexosInline.map((a) => a?.sha256));
      pre = { total: objetos.length, faltando: objetos.filter((o) => !presentes.has(o.sha256)).map((o) => o.sha256), corrompidos: [] };
    } else {
      if (!api?.preflightSelected) throw falhaRestauracao('BACKUP_ANEXOS_PREFLIGHT', 'Não foi possível conferir os anexos do backup (abra pelo aplicativo desktop). Nada foi alterado.');
      if (!selecao) throw falhaRestauracao('BACKUP_SELECAO_INVALIDA', 'Restauração sem a seleção do arquivo: selecione e inspecione o backup de novo. Nada foi alterado.');
      pre = anexosResumo(unwrapDialog(await api.preflightSelected({ selecao, objects: objetos })));
    }
    if (pre.corrompidos.length || (pre.faltando.length && !aceitarAnexosFaltandoNoPacote)) {
      throw falhaRestauracao('BACKUP_ANEXOS_PREFLIGHT', `Restauração cancelada antes de alterar qualquer dado: ${pre.faltando.length} anexo(s) faltando e ${pre.corrompidos.length} corrompido(s) no backup${pre.pasta ? ` (pasta ${pre.pasta})` : ''}.`, { faltando: pre.faltando, corrompidos: pre.corrompidos });
    }
    faltandoNoPacote = pre.faltando;
  }
  // 2. Backup de segurança verificado.
  const safety = await persistVerifiedSafetyBackup({ reason: 'pre-restore', aceitarAnexosAusentesNaOrigem });
  // 3. Preparar.
  const ausentes = new Set(faltandoNoPacote);
  const aPreparar = objetos.filter((o) => !ausentes.has(o.sha256));
  let stageId = null;
  if (aPreparar.length) {
    const inline = Array.isArray(anexosInline) ? anexosInline.filter((a) => aPreparar.some((o) => o.sha256 === a?.sha256)) : null;
    try {
      stageId = unwrapDialog(await api.stage(inline ? { inline } : { selecao, objects: aPreparar })).stageId;
    } catch (err) {
      throw falhaRestauracao('BACKUP_ANEXOS_PREPARO', `Restauração cancelada: ${err.message}`, { causa: err.code || null, safetyBackup: safetyEvidenceOf(safety) });
    }
  }
  const descartar = async () => { if (stageId) { try { unwrapDialog(await api.discardStage({ stageId })); } catch { /* pasta de preparo fica para limpeza; banco e anexos intactos */ } } };
  // 4. Banco.
  let result;
  try {
    result = await storage.applyRestore(backup, { safetyEvidence: safetyEvidenceOf(safety), files: files() });
  } catch (err) {
    await descartar();
    throw err;
  }
  // 5. Efetivar anexos; se falhar, compensar o banco com o backup de segurança.
  let efetivado = null;
  if (stageId) {
    try {
      efetivado = anexosResumo(unwrapDialog(await api.commitStage({ stageId, objects: aPreparar })));
      if (efetivado.faltando.length || efetivado.corrompidos.length) throw falhaRestauracao('ANEXO_EFETIVAR', `${efetivado.faltando.length} faltando e ${efetivado.corrompidos.length} corrompido(s) após mover os anexos.`);
    } catch (err) {
      const compensacao = await compensarRestauracao(safety);
      await storage.recordBackupHistory('restore-compensated', { error: err.message, code: err.code || null, compensado: compensacao.ok, safetyPath: safety.path });
      throw falhaRestauracao(compensacao.ok ? 'BACKUP_RESTAURACAO_REVERTIDA' : 'BACKUP_RESTAURACAO_INCOMPLETA',
        compensacao.ok
          ? `Os anexos não puderam ser gravados (${err.message}). O banco foi devolvido ao estado anterior pelo backup de segurança; nada do backup escolhido ficou aplicado.`
          : `Os anexos não puderam ser gravados (${err.message}) e a volta automática também falhou (${compensacao.error}). Restaure manualmente o backup de segurança ${baseName(safety.path)}.`,
        { compensado: compensacao.ok, safetyBackup: safetyEvidenceOf(safety), recuperacaoCompleta: false });
    }
  }
  // E1G (1.4.2): backup de antes da 1.4.2 volta sem o marcador 'derivados-saida-v1' — o GMD das saídas com peso é
  // recalculado já, sem esperar a próxima abertura (nunca lança; com o marcador, não faz nada).
  await runSaidaDerivedBackfill();
  // 6. Conferir de novo: contagens do banco e anexos na pasta do app.
  // (Histórico de backup e configurações técnicas recebem registros da própria restauração; backup de esquema
  // anterior passa pela migração, que cria derivados — nesses casos vale a contagem conferida na transação.)
  const db = await storage.ensureReady();
  const esperado = result.schemaUpgradeRequired ? {} : (await storage.dryRunRestore(backup)).counts || {};
  const contagensDivergentes = [];
  for (const [store, n] of Object.entries(esperado)) {
    if (store === 'backupHistory' || store === 'appSettings' || !db.tables.some((t) => t.name === store)) continue;
    const atual = await db.table(store).count();
    if (atual !== n) contagensDivergentes.push({ store, esperado: n, atual });
  }
  if (objetos.length) {
    const pos = api?.verify ? anexosResumo(unwrapDialog(await api.verify({ objects: objetos }))) : { total: objetos.length, ok: 0, faltando: objetos.map((o) => o.sha256), corrompidos: [], pasta: null };
    result.anexos = { ...pos, pasta: efetivado?.pasta ?? null };
  }
  result.contagensDivergentes = contagensDivergentes;
  result.recuperacaoCompleta = contagensDivergentes.length === 0 && (!result.anexos || (result.anexos.ok === result.anexos.total && !result.anexos.faltando.length && !result.anexos.corrompidos.length));
  result.safetyBackup = safetyEvidenceOf(safety);
  return result;
}

/** Compensação pós-commit: devolve o banco ao conteúdo do backup de segurança (já verificado). */
async function compensarRestauracao(safety) {
  try {
    const lido = await readUserFile('backups', baseName(safety.path));
    if (lido.sha256 !== safety.sha256) throw new Error('backup de segurança mudou no disco');
    await storage.applyRestore(JSON.parse(lido.content), { safetyEvidence: safetyEvidenceOf(safety), files: files() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
  const safety = await persistVerifiedSafetyBackup({ reason: 'pre-clear-operational' });
  const result = await storage.clearOperationalData({ safetyEvidence: safetyEvidenceOf(safety) });
  return { ...result, backupPath: safety.path, safetyBackup: safetyEvidenceOf(safety) };
}

export async function resetAllData({ confirmedByAdmin = false } = {}) {
  const safety = await persistVerifiedSafetyBackup({ reason: 'pre-reset-all' });
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
