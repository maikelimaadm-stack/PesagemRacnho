// Central de Backup e Restauração (F19–F23; fecha P14, P22, P26). Reúne o comando único de backup verificado
// (maintenance), o backup periódico com o app aberto, a cópia para destino independente, a retenção segura, o
// backup protegido por senha e os passos da restauração guiada.
//
// Permissões (matriz existente): ver e criar backup = maintenance.backup; política = settings.manage;
// restaurar = maintenance.restore. O backup PERIÓDICO é tarefa do sistema: roda com qualquer sessão aberta
// (inclusive OPERADOR), sem ação do usuário — é o mesmo backup verificado do botão.
import storage from '../../../storage/storageAdapter.js';
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import { attachmentObjects } from '../../documents/domain/documentRules.js';
import * as maintenanceAdapter from '../../maintenance/infrastructure/maintenanceDataAdapter.js';
import {
  BACKUP_POLICY_DEFAULTS,
  BACKUP_POLICY_KEY,
  coverage,
  normalizePolicy,
  planRetention,
  shouldRunPeriodic,
} from '../domain/backupPolicy.js';
import { assertPassword, decryptBackup, encryptBackup, isProtectedEnvelope } from '../domain/protectedBackup.js';

export { BACKUP_POLICY_DEFAULTS, coverage } from '../domain/backupPolicy.js';
export { isProtectedEnvelope } from '../domain/protectedBackup.js';

const MAX_ANEXOS_PROTEGIDO = 200 * 1024 * 1024;
export const CONFIRMACAO_RESTAURAR = 'RESTAURAR';

function requirePermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

const app = () => (typeof window !== 'undefined' ? window.pesagemApp ?? null : null);
const unwrap = (r) => {
  if (r?.ok === false) throw Object.assign(new Error(r.error?.message || 'Falha na operação de arquivo.'), { code: r.error?.code });
  return r?.data ?? r;
};
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

async function history(tipo) {
  const db = await storage.ensureReady();
  return (await db.table('backupHistory').toArray())
    .filter((row) => !tipo || row.tipo === tipo)
    .map((row) => { let d = {}; try { d = JSON.parse(row.detalhes || '{}'); } catch { d = {}; } return { tipo: row.tipo, created_at: row.created_at, ...d }; })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

// ---------------------------------------------------------------------------
// Política
// ---------------------------------------------------------------------------

export async function getPolicy() {
  const stored = await storage.settings.get(BACKUP_POLICY_KEY);
  try { return normalizePolicy(stored && typeof stored === 'object' ? stored : BACKUP_POLICY_DEFAULTS); } catch { return normalizePolicy(BACKUP_POLICY_DEFAULTS); }
}

export async function savePolicy(input) {
  requirePermission('settings.manage');
  const next = normalizePolicy(input);
  await storage.settings.set(BACKUP_POLICY_KEY, { versao: 1, ...next });
  await storage.recordBackupHistory('policy', { ...next });
  return next;
}

// ---------------------------------------------------------------------------
// Situação
// ---------------------------------------------------------------------------

export async function externalStatus() {
  const api = app()?.backup;
  if (!api?.externalStatus) return { configurado: false, disponivel: false, destino: null, indisponivelNoAmbiente: true };
  return unwrap(await api.externalStatus());
}

/** Quadro de proteção: local verificado × cópia externa × periódico. */
export async function getOverview() {
  requirePermission('maintenance.backup');
  const [status, externo, policy, copias, periodicos] = await Promise.all([
    maintenanceAdapter.getBackupStatus(), externalStatus(), getPolicy(), history('external-copy'), history('periodic'),
  ]);
  const ultimaCopiaExterna = copias.find((c) => c.ok) || null;
  // R03: cópia externa válida AGORA = a do backup íntegro agora, relida no destino e conferida pelo SHA-256.
  let copiaExterna = null;
  if (externo?.configurado && status.lastVerified?.name) {
    if (!app()?.backup?.verifyExternal) copiaExterna = { valida: false, motivo: 'Conferência da cópia externa só no aplicativo desktop.' };
    else {
      try { copiaExterna = unwrap(await app().backup.verifyExternal({ backupFile: status.lastVerified.name, sha256: status.lastVerified.fileSha256 })); } catch (err) { copiaExterna = { valida: false, motivo: err.message }; }
    }
  }
  let protegidos = [];
  let erroProtegidos = null;
  try { protegidos = unwrap(await app()?.files?.listUserFiles?.({ subdir: 'backups', extension: '.pbk' }))?.files || []; } catch (err) { protegidos = []; erroProtegidos = err.message; }
  return {
    status, externo, policy, ultimaCopiaExterna, copiaExterna, ultimaFalhaCopia: copias.find((c) => !c.ok) || null,
    periodico: { ultimo: periodicos[0] || null, proximo: shouldRunPeriodic({ agora: new Date(), ultimoOk: status.lastVerified?.verifiedAt || null, falhas: periodicos.filter((p) => !p.ok).map((p) => p.em || p.created_at), policy }) },
    cobertura: coverage({ status, externo, copiaExterna }),
    protegidos,
    erroProtegidos,
  };
}

// ---------------------------------------------------------------------------
// Criar, copiar, reter
// ---------------------------------------------------------------------------

/** Cópia do backup (padrão: o último verificado) para o destino externo, conferida lendo de volta. */
export async function copyToExternal({ backupName = null } = {}) {
  requirePermission('maintenance.backup');
  return copyToExternalInternal({ backupName });
}

async function copyToExternalInternal({ backupName = null } = {}) {
  const api = app()?.backup;
  if (!api?.copyExternal) throw new Error('Cópia externa só no aplicativo desktop.');
  const status = await maintenanceAdapter.getBackupStatus();
  const nome = backupName || status.lastVerified?.name;
  if (!nome) throw new Error('Nenhum backup verificado para copiar. Crie um backup antes.');
  try {
    const r = unwrap(await api.copyExternal({ backupFile: nome }));
    await storage.recordBackupHistory('external-copy', { ok: true, backupName: nome, destino: r.destino, sha256: r.sha256, arquivos: r.arquivos, bytes: r.bytes });
    return r;
  } catch (err) {
    await storage.recordBackupHistory('external-copy', { ok: false, backupName: nome, error: err.message, code: err.code || null });
    throw err;
  }
}

export async function selectExternalDir() {
  requirePermission('settings.manage');
  const api = app()?.backup;
  if (!api?.selectExternalDir) throw new Error('Escolher destino só no aplicativo desktop.');
  return unwrap(await api.selectExternalDir());
}

export async function clearExternalDir() {
  requirePermission('settings.manage');
  return unwrap(await app()?.backup?.clearExternalDir?.());
}

/** Retenção segura: só periódicos além dos N mais novos; nunca o último verificado nem os de segurança. */
export async function applyRetention() {
  const policy = await getPolicy();
  const status = await maintenanceAdapter.getBackupStatus();
  const catalogo = status.files.map((f) => ({ name: f.name, reason: f.reason, automatic: f.automatic, estado: f.estado, createdAt: f.modifiedAt }));
  const remover = planRetention(catalogo, { manter: policy.manter_periodicos });
  const removidos = [];
  for (const nome of remover) {
    try { unwrap(await app()?.backup?.deleteBackup?.({ backupFile: nome })); removidos.push(nome); } catch { /* fica para a próxima */ }
  }
  if (removidos.length) await storage.recordBackupHistory('retention', { removidos });
  return { removidos };
}

/** Botão "Criar backup agora" da central: backup verificado + cópia externa automática (se ligada) + retenção. */
export async function createBackupNow() {
  requirePermission('maintenance.backup');
  const r = await maintenanceAdapter.createBackupNow({ reason: 'manual-ui' });
  return { ...r, ...(await afterBackup()) };
}

async function afterBackup() {
  const policy = await getPolicy();
  const out = { copiaExterna: null };
  if (policy.copia_externa_automatica) {
    try { out.copiaExterna = { ok: true, ...(await copyToExternalInternal()) }; } catch (err) { out.copiaExterna = { ok: false, error: err.message }; }
  }
  out.retencao = await applyRetention();
  return out;
}

// Backup periódico (F20): sem duplicar — trava em memória + trava gravada com validade.
let emAndamento = false;
const LOCK_KEY = 'backup-periodic-lock';

export async function runPeriodicIfDue({ agora = new Date() } = {}) {
  // A trava em memória é tomada ANTES de qualquer await: duas chamadas simultâneas não passam juntas.
  if (emAndamento) return { run: false, motivo: 'Já em andamento.' };
  emAndamento = true;
  let travouArquivo = false;
  try {
    if (hasActorProvider() && !getCurrentActor()) return { run: false, motivo: 'Sem sessão.' };
    const policy = await getPolicy();
    const status = await maintenanceAdapter.getBackupStatus();
    const falhas = (await history('periodic')).filter((p) => !p.ok).map((p) => p.em || p.created_at);
    const decisao = shouldRunPeriodic({ agora, ultimoOk: status.lastVerified?.verifiedAt || null, falhas, policy });
    if (!decisao.run) return decisao;
    const lock = await storage.settings.get(LOCK_KEY);
    if (lock?.ate && new Date(lock.ate).getTime() > agora.getTime()) return { run: false, motivo: 'Outro backup periódico em andamento.' };
    await storage.settings.set(LOCK_KEY, { ate: new Date(agora.getTime() + 10 * 60000).toISOString() });
    travouArquivo = true;
    try {
      const r = await maintenanceAdapter.createBackupNow({ reason: 'periodico', automatic: true });
      await storage.recordBackupHistory('periodic', { ok: true, em: agora.toISOString(), backupPath: r.backupPath, sha256: r.sha256 });
      return { run: true, ok: true, ...r, ...(await afterBackup()) };
    } catch (err) {
      await storage.recordBackupHistory('periodic', { ok: false, em: agora.toISOString(), error: err.message, code: err.code || null });
      return { run: true, ok: false, error: err.message };
    }
  } finally {
    if (travouArquivo) await storage.settings.set(LOCK_KEY, { ate: null });
    emAndamento = false;
  }
}

// ---------------------------------------------------------------------------
// Backup protegido por senha (F22)
// ---------------------------------------------------------------------------

export async function exportProtectedBackup(senha) {
  requirePermission('maintenance.backup');
  assertPassword(senha);
  const { backup } = await storage.createFullBackup({ reason: 'protegido', automatic: false });
  const objetos = attachmentObjects(backup.stores.documentos || []);
  const anexos = [];
  let total = 0;
  for (const o of objetos) {
    if (!app()?.attachments?.read) throw new Error('Backup protegido com anexos só no aplicativo desktop.');
    const r = unwrap(await app().attachments.read(o));
    total += r.base64.length * 0.75;
    if (total > MAX_ANEXOS_PROTEGIDO) throw new Error('Anexos somam mais de 200 MB: use o backup completo comum (pacote) e guarde-o em local seguro.');
    anexos.push(r);
  }
  const envelope = await encryptBackup({ backup, anexos }, senha);
  const nome = `backup-protegido-${stamp()}.pbk`;
  const saved = unwrap(await app().files.writeUserFile({ subdir: 'backups', filename: nome, content: JSON.stringify(envelope) }));
  // Leitura de volta: decifra e confere o hash do conteúdo antes de chamar de pronto.
  const lido = unwrap(await app().files.readUserFile({ subdir: 'backups', filename: String(saved.path).split(/[\\/]/).pop() }));
  const conferido = await decryptBackup(JSON.parse(lido.content), senha);
  if (conferido?.backup?.integrity?.sha256 !== backup.integrity?.sha256) throw new Error('O backup protegido foi gravado, mas a leitura de volta não confere.');
  await storage.recordBackupHistory('protected', { ok: true, path: saved.path, size: saved.size, fileSha256: saved.sha256, anexos: anexos.length });
  return { ok: true, path: saved.path, size: saved.size, anexos: anexos.length };
}

// ---------------------------------------------------------------------------
// Restauração guiada (F23)
// ---------------------------------------------------------------------------

/** Passo "Inspecionar": o que há no arquivo, sem gravar nada. Envelope protegido pede a senha antes. */
export async function inspectBackup(payload, { senha = null, selecao = null } = {}) {
  requirePermission('maintenance.restore');
  let conteudo = payload;
  let anexosInline = null;
  if (isProtectedEnvelope(payload)) {
    if (!senha) return { protegido: true, precisaSenha: true, resumo: payload.resumo };
    const aberto = await decryptBackup(payload, senha);
    conteudo = aberto.backup;
    anexosInline = aberto.anexos || [];
  }
  const dry = await storage.dryRunRestore(conteudo);
  const db = await storage.ensureReady();
  const atual = Object.fromEntries(await Promise.all(Object.keys(dry.counts || {}).map(async (name) => [name, db.tables.some((t) => t.name === name) ? await db.table(name).count() : 0])));
  const docsComAnexo = attachmentObjects(conteudo?.stores?.documentos || []);
  return {
    protegido: Boolean(anexosInline),
    selecao,
    backup: conteudo,
    anexosInline,
    dry,
    criadoEm: conteudo?.manifest?.createdAt || conteudo?.createdAt || null,
    appVersion: conteudo?.manifest?.appVersion || conteudo?.version || null,
    usuarios: (conteudo?.stores?.usuarios || []).length,
    anexos: docsComAnexo.length,
    comparacao: Object.keys(dry.counts || {}).map((store) => ({ store, atual: atual[store] ?? 0, backup: dry.counts[store] })),
  };
}

/**
 * Passos "Confirmar → Restaurar → Integridade": exige digitar RESTAURAR. A restauração (maintenance, R02) confere
 * os anexos do arquivo inspecionado (token da seleção) ou do envelope protegido ANTES de tocar no banco, faz o
 * backup de segurança verificado, prepara os anexos, troca o banco de forma atômica, efetiva os anexos (com
 * volta automática se falhar) e confere tudo de novo — `recuperacaoCompleta` diz se voltou 100%. Se o backup
 * trouxe usuários, a sessão atual é encerrada (login de novo).
 */
export async function restoreGuided(inspecao, { confirmacao, onLogout, aceitarAnexosAusentesNaOrigem = false, aceitarAnexosFaltandoNoPacote = false } = {}) {
  requirePermission('maintenance.restore');
  if (confirmacao !== CONFIRMACAO_RESTAURAR) throw new Error(`Para restaurar, digite ${CONFIRMACAO_RESTAURAR}.`);
  if (!inspecao?.backup || !inspecao?.dry?.restorable) throw new Error('Backup não restaurável.');
  const result = await maintenanceAdapter.applyRestoreBackup(inspecao.backup, {
    selecao: inspecao.selecao || null,
    anexosInline: inspecao.anexosInline ? inspecao.anexosInline : null,
    aceitarAnexosAusentesNaOrigem: aceitarAnexosAusentesNaOrigem === true,
    aceitarAnexosFaltandoNoPacote: aceitarAnexosFaltandoNoPacote === true,
  });
  const integridade = await storage.logicalIntegrity();
  if (inspecao.usuarios > 0 && typeof onLogout === 'function') onLogout();
  return { ...result, integridade: { ok: integridade.ok, issues: integridade.issues || [] }, sessaoEncerrada: inspecao.usuarios > 0 };
}
