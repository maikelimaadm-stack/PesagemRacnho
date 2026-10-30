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
import { assertWritable, clearWriteBlock, getCriticalBlock, getWriteBlock, isWriteBlockExempt, isWriteBlocked } from './migrations/migrationState.js';
import { carregarBloqueioCritico } from './criticalRestoreState.js';

// R3-01: na primeira abertura do banco neste processo, o marcador durável de restauração crítica (se houver)
// reinstala o bloqueio ANTES de qualquer gravação — fechar e reabrir o app não o apaga.
let marcadorCriticoConferido = false;
async function ensureReady() {
  const db = await ensureStorageReady();
  if (!marcadorCriticoConferido) {
    marcadorCriticoConferido = true;
    await carregarBloqueioCritico(db);
  }
  return db;
}

export const storage = {
  // ciclo de vida
  ensureReady,
  getDbVersion,
  getDb,

  // bloqueio de escrita durante migração pendente/falha (ADR-038); `usuarios` e
  // `auditoria` são isentas (isWriteBlockExempt) para o login funcionar sob bloqueio.
  isWriteBlocked,
  getWriteBlock,
  getCriticalBlock,
  assertWritable,
  isWriteBlockExempt,
  clearWriteBlock,

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
  // cadastros mestres, estoque de identificadores e usuários locais (v7; store `usuarios`, ADR-043)
  marcas: repos.marcaRepository,
  racas: repos.racaRepository,
  categoriasAnimal: repos.categoriaAnimalRepository,
  parceiros: repos.parceiroRepository,
  propriedades: repos.propriedadeRepository,
  causasMorte: repos.causaMorteRepository,
  faixasIdentificadores: repos.faixaIdentificadorRepository,
  excecoesIdentificadores: repos.excecaoIdentificadorRepository,
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
