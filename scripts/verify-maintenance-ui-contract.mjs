// Gate maintenance:ui:verify — contrato textual da tela Backup e Manutenção
// (cartões de status com as cinco versões + migração, cartão de migração com
// dry-run e "Continuar migração", limpeza em dois níveis com confirmação textual,
// "Copiar diagnóstico" sem credenciais) e do serviço/adapter de manutenção.
// Testes negativos: a tela não pode conter IPC cru, vocabulário de credenciais
// nem expor usuários no diagnóstico; o adapter não pode ler senha/hash.
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function assert(c, m) {
  if (!c) {
    console.error('FAIL:', m);
    process.exit(1);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = join(root, 'src/pages/ManutencaoSistema.jsx');
const layout = join(root, 'src/Layout.jsx');
const pagesConfig = join(root, 'src/pages.config.js');
const service = join(root, 'src/modules/maintenance/application/maintenanceService.js');
const adapter = join(root, 'src/modules/maintenance/infrastructure/maintenanceDataAdapter.js');

assert(existsSync(page), 'ManutencaoSistema.jsx exists');
const pageSrc = readFileSync(page, 'utf8');
assert(pageSrc.includes('maintenanceService'), 'page uses maintenanceService');
// P19 (missão pesagens-integrada): um comando só de backup, gravado e verificado.
assert(pageSrc.includes('Criar backup agora'), 'single backup button');
assert(!pageSrc.includes('Criar backup do banco') && !pageSrc.includes('Criar backup completo'), 'no duplicated backup buttons');
assert(pageSrc.includes('Exportar pesagens em CSV'), 'export csv');
assert(pageSrc.includes('Exportar pesagens em JSON'), 'export json');
assert(pageSrc.includes('Importar dados'), 'import apply');
assert(pageSrc.includes('Restaurar backup'), 'restore apply');
assert(pageSrc.includes('Verificar integridade'), 'integrity');
assert(pageSrc.includes('Status do banco'), 'status section');
assert(!pageSrc.includes('login'), 'no login');
assert(!/permiss[aã]o|RBAC|senha|autentic/i.test(pageSrc), 'no permissions/auth');
assert(!pageSrc.includes('ipcRenderer'), 'no raw ipcRenderer in page');

// Programa 2.0 — Status: cinco eixos de versão (ADR-037) + estado da migração.
for (const label of ['Aplicativo:', 'Banco:', 'Backup:', 'Build UI:', 'Build dados:', 'Contrato UI:', 'Contrato dados:', 'Migração:']) {
  assert(pageSrc.includes(label), `status card shows "${label}"`);
}
assert(pageSrc.includes('maintenanceService.getVersionInfo'), 'page reads describeVersions via service');
assert(pageSrc.includes('maintenanceService.getMigrationStatus'), 'page reads migration state via service');

// Programa 2.0 — Migração: dry-run, continuar, relatório.
assert(pageSrc.includes('Simular migração (dry-run)'), 'migration dry-run button');
assert(pageSrc.includes('Continuar migração'), 'migration resume button');
assert(pageSrc.includes('Relatório da migração'), 'migration report block');
assert(pageSrc.includes('maintenanceService.dryRunMigration') && pageSrc.includes('maintenanceService.resumeMigration'), 'page calls migration service functions');
assert(pageSrc.includes('Backup de esquema anterior'), 'restore dry-run explains schema conversion');

// Programa 2.0 — Limpeza em dois níveis com confirmação textual (ADR-032).
assert(pageSrc.includes('Limpar dados operacionais'), 'clear operational command');
assert(pageSrc.includes('Reset completo (ADMIN)'), 'reset command');
assert(pageSrc.includes('CLEAR_CONFIRMATION_TEXT') && pageSrc.includes('RESET_CONFIRMATION_TEXT'), 'commands require typed confirmation');
assert(pageSrc.includes('maintenanceService.clearOperationalData') && pageSrc.includes('maintenanceService.resetAllData'), 'page calls the two distinct commands');

// Programa 2.0 — Diagnóstico: versões + migração, nunca credenciais.
assert(pageSrc.includes('Copiar diagnóstico'), 'copy diagnostic button');
assert(pageSrc.includes('maintenanceService.getDiagnosticSnapshot'), 'diagnostic comes from the service snapshot');
assert(!/senha_hash|senha_salt|password_hash|password_salt|usuariosLocais|usuarios\b/.test(pageSrc), 'teste negativo: page never references credential fields or the users store');

const layoutSrc = readFileSync(layout, 'utf8');
assert(layoutSrc.includes('ManutencaoSistema'), 'nav has ManutencaoSistema');
assert(layoutSrc.includes('Manutenção'), 'nav label Manutenção');

const cfg = readFileSync(pagesConfig, 'utf8');
assert(cfg.includes('ManutencaoSistema'), 'pages.config registers page');

const svc = readFileSync(service, 'utf8');
assert(svc.includes('createDatabaseBackup'), 'service backup');
assert(svc.includes('dryRunImportWeighingJson'), 'service import dry-run');
assert(svc.includes('applyRestoreBackup'), 'service restore');
for (const fn of ['getVersionInfo', 'getMigrationStatus', 'dryRunMigration', 'resumeMigration', 'clearOperationalData', 'resetAllData', 'getDiagnosticSnapshot']) {
  assert(new RegExp(`export (async )?function ${fn}\\b`).test(svc), `service exports ${fn}`);
}
assert(svc.includes("CLEAR_CONFIRMATION_TEXT = 'LIMPAR'") && svc.includes("RESET_CONFIRMATION_TEXT = 'RESET'"), 'confirmation texts declared in the service');
// Desde 9349a8f a autorização é pela matriz de permissões (ADR-042/046), não pelo texto
// antigo `profile !== 'ADMIN'`: requireMaintenanceAction consulta can(role, action) com o
// ator de getCurrentActor() e falha fechada com provedor de ator e sem sessão.
assert(/function requireMaintenanceAction\(operation, action\)/.test(svc), 'service authorizes through requireMaintenanceAction');
assert(/can\(actor\.role, action\)/.test(svc) && svc.includes('auth/domain/permissionService.js'), 'service checks the permission matrix (permissionService.can)');
assert(/getCurrentActor\(\)/.test(svc) && /hasActorProvider\(\)/.test(svc) && svc.includes("storage/indexedDb/auditActor.js"), 'service reads the actor via auditActor.getCurrentActor and fails closed with hasActorProvider');
assert(!/profile !== 'ADMIN'|role === 'ADMIN'/.test(svc), 'teste negativo: no hard-coded role comparison in the service');
for (const [operation, action] of [
  ['Restauração', 'maintenance.restore'],
  ['Continuar migração', 'maintenance.migrate'],
  ['Limpar dados operacionais', 'maintenance.clear'],
  ['Reset completo', 'maintenance.reset'],
  ['Backup completo', 'maintenance.backup'],
]) {
  assert(svc.includes(`requireMaintenanceAction('${operation}', '${action}')`), `service requires ${action} for ${operation}`);
}

const adp = readFileSync(adapter, 'utf8');
assert(adp.includes('describeVersions'), 'adapter uses describeVersions from versionInfo');
assert(adp.includes('storage.migration.getMigrationState') && adp.includes('storage.migration.runPendingBackfills') && adp.includes('storage.migration.dryRunBackfill'), 'adapter delegates migration to the storage facade');
assert(adp.includes('storage.clearOperationalData') && adp.includes('storage.resetAllData'), 'adapter delegates the two clear commands');
assert(!/senha_hash|senha_salt|password_hash|password_salt|table\('usuarios(Locais)?'\)/.test(adp), 'teste negativo: adapter never reads credential fields');

console.log('OK verify-maintenance-ui-contract');
console.log(JSON.stringify({ statusVersions: 7, migrationCard: true, twoLevelClear: true, diagnosticWithoutCredentials: true }, null, 2));
