import 'fake-indexeddb/auto';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { deleteDbForTests } = await imp('src/storage/indexedDb/db.js');
const storage = (await imp('src/storage/storageAdapter.js')).default;

await deleteDbForTests();

// Estado inicial.
await storage.animais.create({ id: 'a1', numero_animal: '1', identificacao_normalizada: '1', situacao: 'Ativo' });
await storage.weighing.bulkCreate([
  { id: 'p1', data_pesagem: '2026-07-01', peso_kg: 300, animal_id: 'a1' },
]);

// ---- IMPORT (dry-run obrigatório + apply) ----
const importPayload = {
  type: 'weighing-entries-export',
  entries: [
    { id: 'p1', data_pesagem: '2026-07-01', peso_kg: 300 }, // duplicado
    { id: 'p2', data_pesagem: '2026-07-05', peso_kg: 410 }, // novo
    { data_pesagem: '', peso_kg: 0 },                        // inválido
  ],
};
const dry = await storage.dryRunImportPesagens(importPayload);
assert(dry.totalRecords === 3 && dry.toInsert === 1 && dry.duplicates === 1 && dry.invalidRecords === 1, `dry-run import (${JSON.stringify(dry)})`);
const safetyEvidence = { path: 'C:\\isolated-test\\pre-operation.json', size: 1024, sha256: 'b'.repeat(64) };
await storage.applyImportPesagens(importPayload).then(
  () => { throw new Error('importação sem backup físico deveria ser bloqueada'); },
  (error) => assert(/backup físico/.test(error.message), 'importação exige evidência de backup físico'),
);
const applied = await storage.applyImportPesagens(importPayload, { safetyEvidence });
assert(applied.inserted === 1, 'apply import inseriu só o novo');
assert(await storage.weighing.count() === 2, 'total após import = 2');
await storage.applyImportPesagens(importPayload, { safetyEvidence }).then(
  () => { throw new Error('arquivo repetido deveria ser bloqueado'); },
  (error) => assert(/Arquivo já importado/.test(error.message), 'hash idempotente bloqueia o mesmo JSON'),
);
assert(await storage.weighing.count() === 2, 'repetição não altera o banco');

// ---- RESTORE (backup completo → dry-run → apply) ----
const snapshot = await storage.createFullBackup();
// muda o estado depois do backup
await storage.weighing.create({ id: 'p9', data_pesagem: '2026-07-09', peso_kg: 999 });
assert(await storage.weighing.count() === 3, 'estado alterado após backup (3)');

const dryR = await storage.dryRunRestore(snapshot.backup);
assert(dryR.restorable && dryR.counts.pesagens === 2, 'dry-run restore reporta 2 pesagens do backup');
await storage.applyRestore(snapshot.backup).then(
  () => { throw new Error('restore sem backup físico deveria ser bloqueado'); },
  (error) => assert(/backup físico/.test(error.message), 'restauração exige evidência de backup físico'),
);
const restored = await storage.applyRestore(snapshot.backup, { safetyEvidence });
assert(restored.restored, 'restore aplicado');
assert(await storage.weighing.count() === 2, 'estado volta ao do backup (2)');
assert(!(await storage.weighing.get('p9')), 'entrada pós-backup ausente após restore');

// integridade lógica ok
const integ = await storage.logicalIntegrity();
assert(integ.ok && integ.result === 'ok', `integridade lógica ok (${JSON.stringify(integ.issues)})`);

console.log('OK verify-dexie-import-restore');
console.log(JSON.stringify({ import: applied.inserted, afterImport: 2, restore: 'ok', afterRestore: 2, integrity: integ.result }, null, 2));
