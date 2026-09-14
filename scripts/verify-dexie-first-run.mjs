import 'fake-indexeddb/auto';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { deleteDbForTests, ensureStorageReady, resetDbForTests } = await imp('src/storage/indexedDb/db.js');
const { DB_NAME, STORE_NAMES } = await imp('src/storage/indexedDb/schema.js');
const storage = (await imp('src/storage/storageAdapter.js')).default;

// Primeira abertura: nenhum banco existe ainda.
await deleteDbForTests();
const existedBefore = (await indexedDB.databases?.() || []).some((d) => d.name === DB_NAME);
assert(!existedBefore, 'pré-condição: banco IndexedDB não existe');

// Sem configuração manual: só abrir garante o banco pronto.
const db = await ensureStorageReady();
assert(db.isOpen(), 'banco criado/aberto automaticamente na primeira abertura');
assert(db.tables.length === STORE_NAMES.length, 'todos os stores criados');

// Uso imediato sem configurar nada.
const created = await storage.weighing.create({ data_pesagem: '2026-07-20', peso_kg: 310, animal_id: 'a1' });
assert(created.id, 'CRUD funciona logo após a primeira abertura');
const stats = await storage.databaseStats();
assert(stats.dbType === 'IndexedDB/Dexie' && stats.weighingEntries === 1, 'stats reporta 1 pesagem');

// Segunda "abertura" (idempotência): reabrir mantém dados.
resetDbForTests();
const db2 = await ensureStorageReady();
const stats2 = await (await imp('src/storage/indexedDb/health/health.js')).databaseStats();
assert(db2.isOpen() && stats2.weighingEntries === 1, 'dados persistem ao reabrir (mesma origem)');

console.log('OK verify-dexie-first-run');
console.log(JSON.stringify({
  firstRunAuto: true,
  userMustConfigure: false,
  userMustInstallSqlite: false,
  nativeModule: false,
  stores: db.tables.length,
}, null, 2));
