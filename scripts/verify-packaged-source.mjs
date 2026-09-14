import { existsSync, readFileSync } from 'fs';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDirectoryName = String(process.env.RELEASE_DIR || 'release').trim();

function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

const resourcesDir = [join(root, releaseDirectoryName, 'win-unpacked', 'resources')]
  .find((d) => existsSync(join(d, 'app.asar')));
assert(resourcesDir, `app.asar do pacote não encontrado em ${releaseDirectoryName} — gere o pacote antes da verificação`);

const asarPath = join(resourcesDir, 'app.asar');
const EXPECTED_VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const asar = require('@electron/asar');
const extract = (logical) => asar.extractFile(asarPath, logical.split('/').join(sep)).toString('utf8');

// 1) O main empacotado deve ser o enxuto (sem SQLite) e com os IPCs atuais.
const main = extract('electron/main.cjs');
for (const t of ['configureAppRuntime', 'app:getDiagnosticInfo', 'app:writeUserFile', 'registerDialogIpc']) {
  assert(main.includes(t), `app.asar/electron/main.cjs deve conter "${t}"`);
}
for (const t of ['better-sqlite3', 'sqliteConnection', 'ensureDatabaseReady', 'registerMaintenanceIpc']) {
  assert(!main.includes(t), `app.asar/electron/main.cjs NÃO deve conter "${t}" (SQLite removido)`);
}

// 2) Preload expõe só diagnóstico/arquivos/diálogos.
const preload = extract('electron/preload.cjs');
for (const t of ['getDiagnosticInfo', 'writeUserFile', 'selectImportJson']) {
  assert(preload.includes(t), `preload empacotado deve conter "${t}"`);
}
assert(!preload.includes('maintenance:backup:sqlite'), 'preload NÃO deve conter canais SQLite');

// 3) Versão empacotada bate com o repo.
const pkg = JSON.parse(extract('package.json'));
assert(pkg.version === EXPECTED_VERSION, `package.json empacotado deve ser ${EXPECTED_VERSION} (obtido ${pkg.version})`);
assert(!pkg.dependencies?.['better-sqlite3'], 'package.json empacotado NÃO deve ter better-sqlite3');

// 4) Renderer empacotado contém a camada Dexie e o diagnóstico da Manutenção.
const asarBuf = readFileSync(asarPath).toString('latin1');
for (const t of ['getDiagnosticInfo', 'Armazenamento', 'pesagens-individuais-indexeddb-backup']) {
  assert(asarBuf.includes(t), `bundle do renderer deve conter "${t}"`);
}

// 5) Nenhum módulo nativo empacotado.
const unpacked = join(resourcesDir, 'app.asar.unpacked');
assert(!existsSync(join(unpacked, 'node_modules', 'better-sqlite3')),
  'app.asar.unpacked NÃO deve conter better-sqlite3');
assert(!asarBuf.includes('better_sqlite3.node'), 'app.asar não deve referenciar better_sqlite3.node');

console.log('OK verify-packaged-source');
console.log(JSON.stringify({
  version: pkg.version,
  mainSemSqlite: true,
  preloadEnxuto: true,
  rendererDexie: true,
  moduloNativo: false,
}, null, 2));
