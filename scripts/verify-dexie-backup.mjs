import 'fake-indexeddb/auto';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { deleteDbForTests } = await imp('src/storage/indexedDb/db.js');
const { BACKUP_FORMAT } = await imp('src/storage/indexedDb/schema.js');
const storage = (await imp('src/storage/storageAdapter.js')).default;

await deleteDbForTests();

// Semear alguns dados.
await storage.weighing.bulkCreate([
  { id: 'p1', data_pesagem: '2026-07-01', peso_kg: 300, animal_id: 'a1', lote_id: 'l1', observacao: 'com "aspas", e vírgula' },
  { id: 'p2', data_pesagem: '2026-07-02', peso_kg: 320, animal_id: 'a2', lote_id: 'l1' },
]);
await storage.apartacoes.create({ id: 'ap1', nome: 'Apartação A' });

// Backup completo (JSON de todos os stores).
const bak = await storage.createFullBackup();
assert(bak.ok && bak.backup.format === BACKUP_FORMAT, 'backup completo tem formato correto');
assert(bak.counts.pesagens === 2 && bak.counts.apartacoes === 1, 'backup contém contagens corretas');
assert(JSON.stringify(bak.backup).length > 0, 'backup serializável para JSON');

// Export CSV.
const csv = await storage.exportPesagensCsv();
assert(csv.ok && csv.count === 2, 'export CSV conta 2');
assert(csv.csv.includes('data_pesagem') && csv.csv.includes('"com ""aspas"", e vírgula"'), 'CSV com header + escape correto');

// Export JSON.
const js = await storage.exportPesagensJson();
assert(js.ok && js.payload.entries.length === 2 && js.payload.type === 'weighing-entries-export', 'export JSON correto');

console.log('OK verify-dexie-backup');
console.log(JSON.stringify({ backupCounts: bak.counts, csvCount: csv.count, jsonCount: js.count }, null, 2));
