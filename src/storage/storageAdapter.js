// Facade único de armazenamento (IndexedDB/Dexie).
//   UI → service → storageAdapter → Dexie
// Não usa IPC para banco (Dexie roda no renderer). IPC segue só para dialogs de
// arquivo, salvar export em disco, abrir pasta e diagnóstico local.
import { ensureStorageReady, getDbVersion, getDb } from './indexedDb/db.js';
import * as repos from './indexedDb/repositories/index.js';
import * as backup from './indexedDb/backup/backupService.js';
import { logicalIntegrity, databaseStats } from './indexedDb/health/health.js';

export const storage = {
  // ciclo de vida
  ensureReady: ensureStorageReady,
  getDbVersion,
  getDb,

  // repositórios de domínio
  weighing: repos.weighing,
  apartacoes: repos.apartacaoRepository,
  loteApartacoes: repos.loteApartacaoRepository,
  embarques: repos.shipmentRepository,
  documentosEmbarque: repos.shipmentDocumentRepository,
  animais: repos.animalRepository,
  animalIdentificadores: repos.animalIdentifierRepository,
  movimentosAnimais: repos.animalMovementRepository,
  animalLotes: repos.animalLotRepository,
  sessoesPesagem: repos.weighingSessionRepository,
  auditoria: repos.auditRepository,
  importacoes: repos.importRepository,
  settings: { get: repos.readAppSetting, set: repos.writeAppSetting },

  // manutenção
  createFullBackup: backup.createFullBackup,
  recordBackupHistory: backup.recordBackupHistory,
  exportPesagensCsv: backup.exportPesagensCsv,
  exportPesagensJson: backup.exportPesagensJson,
  dryRunImportPesagens: backup.dryRunImportPesagens,
  applyImportPesagens: backup.applyImportPesagens,
  dryRunRestore: backup.dryRunRestore,
  applyRestore: backup.applyRestore,
  clearAllData: backup.clearAllData,
  logicalIntegrity,
  databaseStats,
};

export default storage;
