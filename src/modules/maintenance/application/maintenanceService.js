// Serviço de manutenção: backup, exportação, importação, restauração, limpeza,
// migração e diagnóstico. Backup/exportação/importação exigem maintenance.backup (o backup
// completo contém dados comerciais e hashes de senha); restore, limpeza, reset e migração
// manual exigem as ações ADMIN (ADR-036). Com autenticação ativa e sem sessão: recusa.
// Sem provedor de ator (gates em Node) a validação não se aplica.
import * as adapter from '../infrastructure/maintenanceDataAdapter.js';
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { can } from '../../auth/domain/permissionService.js';

export const CLEAR_CONFIRMATION_TEXT = 'LIMPAR';
export const RESET_CONFIRMATION_TEXT = 'RESET';

// Autorização pela matriz (maintenance.restore/clear/reset/migrate = ADMIN).
// getActor() só traz os campos de auditoria (sem papel): o papel vem de getCurrentActor().
// Com sessão autenticada, papel ausente ou sem a ação é recusado (falha fechada).
function requireMaintenanceAction(operation, action) {
  const actor = getCurrentActor();
  if (!actor && !hasActorProvider()) return;
  if (!actor || !can(actor.role, action)) {
    const err = new Error(`${operation}: ação não permitida para o seu perfil.`);
    err.code = 'MAINTENANCE_FORBIDDEN';
    err.action = action;
    err.role = actor?.role ?? null;
    throw err;
  }
}

function requireConfirmationText(received, expected, operation) {
  if (String(received ?? '').trim().toUpperCase() !== expected) {
    const err = new Error(`${operation}: digite ${expected} para confirmar.`);
    err.code = 'MAINTENANCE_CONFIRMATION_REQUIRED';
    throw err;
  }
}

export async function createDatabaseBackup(options) {
  requireMaintenanceAction('Backup', 'maintenance.backup');
  return adapter.createDatabaseBackup(options);
}

export async function createFullDataBackup(options) {
  requireMaintenanceAction('Backup completo', 'maintenance.backup');
  return adapter.createFullDataBackup(options);
}

/** Comando único (P19): cria e verifica o backup completo. */
export async function createBackupNow(options) {
  requireMaintenanceAction('Backup', 'maintenance.backup');
  return adapter.createBackupNow(options);
}

/** Lê o arquivo de volta e valida (P21). */
export async function verifyBackupFile(options) {
  requireMaintenanceAction('Verificar backup', 'maintenance.backup');
  return adapter.verifyBackupFile(options);
}

/**
 * Reparo geral (P04/P08/P13): reconcilia lotes, movimentos derivados e GMD de todos os animais.
 * ADMIN (maintenance.migrate). Cria e verifica um backup ANTES; sem backup verificado, não roda.
 */
export async function reconcileDerivations({ onProgress, signal } = {}) {
  requireMaintenanceAction('Reconciliar derivados', 'maintenance.migrate');
  const safety = await adapter.createBackupNow({ reason: 'pre-reconcile', automatic: true });
  const { reconcileAllAnimalDerivations } = await import('../../weighing/infrastructure/weighingDataAdapter.js');
  // R08: andamento por bloco e cancelamento entre blocos (`signal.aborted`).
  const result = await reconcileAllAnimalDerivations({ onProgress, signal });
  return { ...result, safetyBackup: { path: safety.backupPath, size: safety.size, sha256: safety.sha256 } };
}

/** Situação da proteção: último verificado × arquivos encontrados (P21). */
export async function getBackupStatus() {
  requireMaintenanceAction('Situação do backup', 'maintenance.backup');
  return adapter.getBackupStatus();
}

export async function exportWeighingJson(filters) {
  requireMaintenanceAction('Exportação JSON', 'maintenance.backup');
  return adapter.exportWeighingJson(filters);
}

export async function exportWeighingCsv(filters) {
  requireMaintenanceAction('Exportação CSV', 'maintenance.backup');
  return adapter.exportWeighingCsv(filters);
}

export async function dryRunImportWeighingJson(payload) {
  requireMaintenanceAction('Importação', 'maintenance.backup');
  return adapter.dryRunImportWeighingJson(payload);
}

export async function applyImportWeighingJson(payload, options) {
  requireMaintenanceAction('Importação', 'maintenance.backup');
  return adapter.applyImportWeighingJson(payload, options);
}

export async function dryRunRestoreBackup(backupPath) {
  requireMaintenanceAction('Restauração', 'maintenance.restore');
  return adapter.dryRunRestoreBackup(backupPath);
}

export async function applyRestoreBackup(backupPath, options = {}) {
  requireMaintenanceAction('Restauração', 'maintenance.restore');
  // R01: `aceitarAnexosAusentesNaOrigem` é a única exceção ao backup de segurança completo — para recuperar
  // anexos que JÁ sumiram do app; o pré-backup é verificado sem eles e marcado incompleto.
  // R02: `selecao` é o token do arquivo escolhido no diálogo; `aceitarAnexosFaltandoNoPacote` é a exceção
  // explícita para restaurar sem anexos AUSENTES do pacote (o resultado fica com recuperacaoCompleta = false).
  return adapter.applyRestoreBackup(backupPath, {
    selecao: options.selecao || null,
    anexosInline: Array.isArray(options.anexosInline) ? options.anexosInline : null,
    aceitarAnexosAusentesNaOrigem: options.aceitarAnexosAusentesNaOrigem === true,
    aceitarAnexosFaltandoNoPacote: options.aceitarAnexosFaltandoNoPacote === true,
  });
}

export async function runIntegrityCheck() {
  return adapter.runIntegrityCheck();
}

export async function runQuickCheck() {
  return adapter.runQuickCheck();
}

export async function getDatabaseStats() {
  return adapter.getDatabaseStats();
}

export async function listBackups() {
  return adapter.listBackups();
}

export async function isMaintenanceAvailable() {
  return adapter.isMaintenanceAvailable();
}

export async function selectImportJsonFile() {
  return adapter.selectImportJsonFile();
}

export async function selectBackupFile() {
  return adapter.selectBackupFile();
}

// --- Programa 2.0: versões, migração, limpeza em dois níveis, diagnóstico ---

export function getVersionInfo() {
  return adapter.getVersionInfo();
}

export async function getMigrationStatus() {
  return adapter.getMigrationStatus();
}

export async function dryRunMigration() {
  return adapter.dryRunMigration();
}

/** "Continuar migração" (maintenance.migrate — ADMIN). */
export async function resumeMigration(options) {
  requireMaintenanceAction('Continuar migração', 'maintenance.migrate');
  return adapter.resumeMigration(options);
}

/** "Limpar dados operacionais" (maintenance.clear — ADMIN): preserva usuários, configurações e cadastros mestres. */
export async function clearOperationalData({ confirmationText } = {}) {
  requireMaintenanceAction('Limpar dados operacionais', 'maintenance.clear');
  requireConfirmationText(confirmationText, CLEAR_CONFIRMATION_TEXT, 'Limpar dados operacionais');
  return adapter.clearOperationalData();
}

/** "Reset completo" (ADMIN): apaga tudo exceto o histórico de backups. */
export async function resetAllData({ confirmationText } = {}) {
  requireMaintenanceAction('Reset completo', 'maintenance.reset');
  requireConfirmationText(confirmationText, RESET_CONFIRMATION_TEXT, 'Reset completo');
  return adapter.resetAllData({ confirmedByAdmin: true });
}

/** Diagnóstico textual: versões, migração, estatísticas e integridade — nunca credenciais. */
export async function getDiagnosticSnapshot() {
  return adapter.getDiagnosticSnapshot();
}
