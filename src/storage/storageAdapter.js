// Facade único de armazenamento (IndexedDB/Dexie).
//   UI → service → storageAdapter → Dexie
// Não usa IPC para banco (Dexie roda no renderer). IPC segue só para dialogs de
// arquivo, salvar export em disco, abrir pasta e diagnóstico local — a ponte de
// arquivos é injetada pelos chamadores (src/api/db.js, maintenanceDataAdapter).
import { ensureStorageReady, getDbVersion, getDb } from './indexedDb/db.js';
import * as repos from './indexedDb/repositories/index.js';
import * as backup from './indexedDb/backup/backupService.js';
import { logicalIntegrity, databaseStats } from './indexedDb/health/health.js';
import * as migration from './migrations/migrationCoordinator.js';
import { assertWritable, getWriteBlock, isWriteBlocked } from './migrations/migrationState.js';

export const storage = {
  // ciclo de vida
  ensureReady: ensureStorageReady,
  getDbVersion,
  getDb,

  // bloqueio de escrita durante migração pendente/falha (ADR-038)
  isWriteBlocked,
  getWriteBlock,
  assertWritable,

  // migrações (docs 14 §2)
  migration: {
    inspectDatabase: migration.inspectDatabase,
    prepareMigration: migration.prepareMigration,
    openWithMigration: migration.openWithMigration,
    runPendingBackfills: migration.runPendingBackfills,
    getMigrationState: migration.getMigrationState,
    dryRunBackfill: migration.dryRunBackfill,
  },

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
  // cadastros mestres, estoque de identificadores e usuários locais (v7)
  marcas: repos.marcaRepository,
  racas: repos.racaRepository,
  categoriasAnimal: repos.categoriaAnimalRepository,
  parceiros: repos.parceiroRepository,
  propriedades: repos.propriedadeRepository,
  causasMorte: repos.causaMorteRepository,
  faixasIdentificadores: repos.faixaIdentificadorRepository,
  excecoesIdentificadores: repos.excecaoIdentificadorRepository,
  usuariosLocais: repos.usuarioLocalRepository,
  usuarios: repos.usuarioRepository,
  usersStore: repos.USERS_STORE,
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
  clearOperationalData: backup.clearOperationalData,
  resetAllData: backup.resetAllData,
  clearAllData: backup.clearAllData,
  logicalIntegrity,
  databaseStats,
};

export default storage;
