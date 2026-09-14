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

assert(existsSync(page), 'ManutencaoSistema.jsx exists');
const pageSrc = readFileSync(page, 'utf8');
assert(pageSrc.includes('maintenanceService'), 'page uses maintenanceService');
assert(pageSrc.includes('Criar backup do banco'), 'backup sqlite button');
assert(pageSrc.includes('Criar backup completo'), 'backup full button');
assert(pageSrc.includes('Exportar pesagens em CSV'), 'export csv');
assert(pageSrc.includes('Exportar pesagens em JSON'), 'export json');
assert(pageSrc.includes('Importar dados'), 'import apply');
assert(pageSrc.includes('Restaurar backup'), 'restore apply');
assert(pageSrc.includes('Verificar integridade'), 'integrity');
assert(pageSrc.includes('Status do banco'), 'status section');
assert(!pageSrc.includes('login'), 'no login');
assert(!/permiss[aã]o|RBAC|senha|autentic/i.test(pageSrc), 'no permissions/auth');
assert(!pageSrc.includes('ipcRenderer'), 'no raw ipcRenderer in page');

const layoutSrc = readFileSync(layout, 'utf8');
assert(layoutSrc.includes('ManutencaoSistema'), 'nav has ManutencaoSistema');
assert(layoutSrc.includes('Manutenção'), 'nav label Manutenção');

const cfg = readFileSync(pagesConfig, 'utf8');
assert(cfg.includes('ManutencaoSistema'), 'pages.config registers page');

const svc = readFileSync(service, 'utf8');
assert(svc.includes('createDatabaseBackup'), 'service backup');
assert(svc.includes('dryRunImportWeighingJson'), 'service import dry-run');
assert(svc.includes('applyRestoreBackup'), 'service restore');

console.log('OK verify-maintenance-ui-contract');
