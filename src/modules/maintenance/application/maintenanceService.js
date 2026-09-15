// Serviço de manutenção: backup, exportação, importação, restauração, limpeza,
// migração e diagnóstico. As ações críticas (restore, limpeza, reset, migração
// manual) validam o perfil ADMIN quando existe ator autenticado (ADR-036);
// sem ator (gates em Node, primeira execução) a validação não se aplica.
import * as adapter from '../infrastructure/maintenanceDataAdapter.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';

export const CLEAR_CONFIRMATION_TEXT = 'LIMPAR';
export const RESET_CONFIRMATION_TEXT = 'RESET';

// Campos do ator: `actor_user_*` (auditActor atual) ou `usuario_id`/`role` (docs 11 rev. 2).
function actorIdentity(actor) {
  return {
    id: actor.actor_user_id ?? actor.usuario_id ?? null,
    profile: actor.actor_user_profile ?? actor.role ?? actor.perfil ?? actor.usuario_role ?? null,
  };
}

function requireAdminWhenAuthenticated(operation) {
  const { id, profile } = actorIdentity(getActor());
  if (id && profile && profile !== 'ADMIN') {
    const err = new Error(`${operation}: ação exclusiva do perfil ADMIN.`);
    err.code = 'MAINTENANCE_FORBIDDEN';
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
  return adapter.createDatabaseBackup(options);
}

export async function createFullDataBackup(options) {
  return adapter.createFullDataBackup(options);
}

export async function exportWeighingJson(filters) {
  return adapter.exportWeighingJson(filters);
}

export async function exportWeighingCsv(filters) {
  return adapter.exportWeighingCsv(filters);
}

export async function dryRunImportWeighingJson(payload) {
  return adapter.dryRunImportWeighingJson(payload);
}

export async function applyImportWeighingJson(payload, options) {
  return adapter.applyImportWeighingJson(payload, options);
}

export async function dryRunRestoreBackup(backupPath) {
  return adapter.dryRunRestoreBackup(backupPath);
}

export async function applyRestoreBackup(backupPath) {
  requireAdminWhenAuthenticated('Restauração');
  return adapter.applyRestoreBackup(backupPath);
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
  requireAdminWhenAuthenticated('Continuar migração');
  return adapter.resumeMigration(options);
}

/** "Limpar dados operacionais" (maintenance.clear — ADMIN): preserva usuários, configurações e cadastros mestres. */
export async function clearOperationalData({ confirmationText } = {}) {
  requireAdminWhenAuthenticated('Limpar dados operacionais');
  requireConfirmationText(confirmationText, CLEAR_CONFIRMATION_TEXT, 'Limpar dados operacionais');
  return adapter.clearOperationalData();
}

/** "Reset completo" (ADMIN): apaga tudo exceto o histórico de backups. */
export async function resetAllData({ confirmationText } = {}) {
  requireAdminWhenAuthenticated('Reset completo');
  requireConfirmationText(confirmationText, RESET_CONFIRMATION_TEXT, 'Reset completo');
  return adapter.resetAllData({ confirmedByAdmin: true });
}

/** Diagnóstico textual: versões, migração, estatísticas e integridade — nunca credenciais. */
export async function getDiagnosticSnapshot() {
  return adapter.getDiagnosticSnapshot();
}
