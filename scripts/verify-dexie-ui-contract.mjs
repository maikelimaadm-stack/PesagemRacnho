import 'fake-indexeddb/auto';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const storage = (await imp('src/storage/storageAdapter.js')).default;

// Contrato do facade de armazenamento que a UI/serviços consomem.
const requiredRepos = ['weighing', 'apartacoes', 'loteApartacoes', 'embarques', 'documentosEmbarque', 'animais', 'lotes'];
for (const r of requiredRepos) {
  assert(storage[r] && typeof storage[r].list === 'function' && typeof storage[r].create === 'function',
    `storageAdapter.${r} tem list/create`);
}
for (const m of ['createFullBackup', 'exportPesagensCsv', 'exportPesagensJson',
  'dryRunImportPesagens', 'applyImportPesagens', 'dryRunRestore', 'applyRestore',
  'logicalIntegrity', 'databaseStats', 'ensureReady']) {
  assert(typeof storage[m] === 'function', `storageAdapter.${m} existe`);
}

// Chamada real através do facade (como um service faria): UI → service → storageAdapter → Dexie.
const { deleteDbForTests } = await imp('src/storage/indexedDb/db.js');
await deleteDbForTests();
await storage.ensureReady();
const created = await storage.weighing.create({ data_pesagem: '2026-07-20', peso_kg: 333 });
const stats = await storage.databaseStats();
assert(created.id && stats.weighingEntries === 1, 'fluxo service→adapter→Dexie funciona');

// storageAdapter é o SSOT (não usa IPC de banco nem window.pesagemApp para dados).
const adapterSrc = read('src/storage/storageAdapter.js');
assert(!/pesagemApp/.test(adapterSrc) && !/ipcRenderer/.test(adapterSrc),
  'storageAdapter não usa IPC/pesagemApp para dados (Dexie no renderer)');

console.log('OK verify-dexie-ui-contract');
console.log('contrato do storageAdapter (UI → service → Dexie): OK');
