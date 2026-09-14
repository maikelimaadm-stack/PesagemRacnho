import * as adapter from '../infrastructure/maintenanceDataAdapter.js';

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
