import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

function walk(dir, filter = (p) => p.endsWith('.js') || p.endsWith('.jsx')) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

// 1) A camada de armazenamento Dexie não pode reintroduzir o backend removido.
const storageFiles = walk(join(root, 'src', 'storage'));
assert(storageFiles.length >= 6, `camada Dexie tem arquivos (${storageFiles.length})`);
const sqliteTokens = ['better-sqlite3', 'sqliteConnection', 'databaseReady.cjs', 'databaseRuntime', 'ensureDatabaseReady'];
for (const f of storageFiles) {
  const src = readFileSync(f, 'utf8');
  for (const t of sqliteTokens) assert(!src.includes(t), `${f.replace(root, '')} não pode conter "${t}"`);
}

// 2) Fluxo operacional do renderer NÃO pode usar SQLite nem IPC de banco.
const operational = [
  ...walk(join(root, 'src', 'modules'), (p) => /(DataAdapter|Service)\.js$/.test(p)),
  join(root, 'src', 'api', 'db.js'),
  join(root, 'src', 'pages', 'ManutencaoSistema.jsx'),
].filter(existsSync);

// Acesso a DADOS via IPC é proibido; files/dialogs/getReleaseInfo/getDiagnosticInfo são permitidos.
const forbiddenData = [
  /pesagemApp\.(weighing|entities|apartacoes|loteApartacoes|shipments|shipmentDocuments|database|maintenance)\b/,
  /maintenance:backup:sqlite/,
  /ipcRenderer\.invoke\(['"]db:/,
];
const offenders = [];
for (const f of operational) {
  const src = readFileSync(f, 'utf8');
  for (const t of sqliteTokens) if (src.includes(t)) offenders.push(`${f.replace(root, '')}: ${t}`);
  for (const re of forbiddenData) if (re.test(src)) offenders.push(`${f.replace(root, '')}: ${re}`);
}
assert(offenders.length === 0, `fluxo operacional deve permanecer independente de backends removidos e IPC de dados. Achados: ${offenders.join(' | ')}`);

// 3) Os adapters operacionais devem usar o storageAdapter (Dexie).
const dataAdapters = walk(join(root, 'src', 'modules'), (p) => /DataAdapter\.js$/.test(p));
for (const f of dataAdapters) {
  const src = readFileSync(f, 'utf8');
  assert(/storageAdapter/.test(src), `${f.replace(root, '')} deve importar storageAdapter (Dexie)`);
}

console.log('OK verify-no-legacy-storage');
console.log(JSON.stringify({
  storageFiles: storageFiles.length,
  operationalFilesChecked: operational.length,
  dataAdapters: dataAdapters.length,
  sqliteOrIpcOffenders: offenders.length,
}, null, 2));
