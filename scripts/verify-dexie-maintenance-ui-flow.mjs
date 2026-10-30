import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// Contrato do fluxo de Manutenção após o cutover:
// ManutencaoSistema → maintenanceService → maintenanceDataAdapter → storageAdapter (Dexie).
// Falha se a Manutenção ainda chamar SQLite/IPC de banco.

const ui = read('src/pages/ManutencaoSistema.jsx');
assert(/from ["']@\/modules\/maintenance\/application\/maintenanceService["']/.test(ui),
  'ManutencaoSistema importa maintenanceService');
// F19/F24: o backup saiu da Manutenção avançada para a página Backup e Restauração (mesmo comando único).
const backupPage = read('src/pages/BackupRestauracao.jsx');
const backupCenter = read('src/modules/backup/application/backupCenterService.js');
assert(/maintenanceAdapter\.createBackupNow/.test(backupCenter) && /center\.createBackupNow\(/.test(backupPage) && /maintenanceService\.getDatabaseStats/.test(ui),
  'UI chama maintenanceService (backup/stats)');
assert(!/maintenance:backup:sqlite/.test(ui) && !/window\.pesagemApp\?\.maintenance/.test(ui),
  'UI NÃO chama IPC de manutenção SQLite diretamente');

const service = read('src/modules/maintenance/application/maintenanceService.js');
assert(/maintenanceDataAdapter/.test(service), 'maintenanceService usa maintenanceDataAdapter');

const adapter = read('src/modules/maintenance/infrastructure/maintenanceDataAdapter.js');
assert(/storageAdapter/.test(adapter), 'maintenanceDataAdapter usa storageAdapter (Dexie)');
assert(/storage\.createFullBackup/.test(adapter) && /storage\.exportPesagensCsv/.test(adapter)
  && /storage\.dryRunImportPesagens/.test(adapter) && /storage\.applyRestore/.test(adapter),
  'adapter chama backup/export/import/restore Dexie');
assert(!/window\.pesagemApp\?\.maintenance/.test(adapter),
  'maintenanceDataAdapter NÃO usa IPC de manutenção SQLite');
// IPC permitido só p/ arquivos/dialogs.
assert(/window\.pesagemApp\?\.files/.test(adapter) && /window\.pesagemApp\?\.dialogs/.test(adapter),
  'adapter usa IPC apenas para arquivos/dialogs');

console.log('OK verify-dexie-maintenance-ui-flow');
console.log('fluxo Manutenção → maintenanceService → adapter → Dexie: CONTRATO OK');
