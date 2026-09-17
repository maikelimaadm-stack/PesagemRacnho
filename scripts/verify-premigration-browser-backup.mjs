// Gate migration:browser-backup:verify — sistema aberto sem a porta de arquivos (navegador/
// desenvolvimento): o backup pré-migração vai para um banco IndexedDB separado, é relido e
// validado por tamanho e SHA-256 antes de migrar. Negativos: gravação que falha bloqueia
// (fail closed) e, sem navegador nem porta (Node), continua bloqueando como antes.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { BROWSER_BACKUP_DB, createPreMigrationBackup, sha256Hex } from '../src/storage/migrations/preMigrationBackup.js';

const source = new Dexie('gate-premigration-source');
source.version(1).stores({ pesagens: '++localId, id', animais: '++localId, &id' });
await source.open();
await source.table('pesagens').bulkAdd([{ id: 'p1', peso_kg: 300 }, { id: 'p2', peso_kg: 320 }]);
await source.table('animais').add({ id: 'a1', numero_animal: '101' });

// 1. Node puro (sem window) e sem porta: bloqueia como sempre.
await assert.rejects(
  createPreMigrationBackup({ sourceDb: source, sourceVersion: 7, targetVersion: 8, files: null }),
  (err) => err.code === 'MIGRATION_BACKUP_FAILED' && err.reason === 'NO_FILES_PORT',
);

// 2. Navegador sem porta: grava no banco de backups, relê e valida.
globalThis.window = {};
const result = await createPreMigrationBackup({ sourceDb: source, sourceVersion: 7, targetVersion: 8, files: null, now: new Date(2026, 8, 17, 10, 0, 0) });
assert.equal(result.storage, 'navegador');
assert.equal(result.path, `indexeddb://${BROWSER_BACKUP_DB}/pre-migration-v8-20260917-100000.json`);
assert.deepEqual(result.counts, { pesagens: 2, animais: 1 });
const backups = new Dexie(BROWSER_BACKUP_DB);
await backups.open();
const stored = await backups.table('backups').get('pre-migration-v8-20260917-100000.json');
assert.equal(await sha256Hex(stored.content), result.sha256, 'SHA-256 do conteúdo relido confere');
assert.equal(JSON.parse(stored.content).manifest.counts.pesagens, 2, 'backup completo com os dados');
backups.close();

// 3. Retenção: mantém só os últimos 3.
for (const minute of [1, 2, 3, 4]) {
  await createPreMigrationBackup({ sourceDb: source, sourceVersion: 7, targetVersion: 8, files: null, now: new Date(2026, 8, 17, 10, minute, 0) });
}
const reopened = new Dexie(BROWSER_BACKUP_DB);
await reopened.open();
assert.deepEqual((await reopened.table('backups').toCollection().primaryKeys()).sort(), [
  'pre-migration-v8-20260917-100200.json', 'pre-migration-v8-20260917-100300.json', 'pre-migration-v8-20260917-100400.json',
]);
reopened.close();

// 3b. Banco de backups já existente SEM a store (limpeza/criação parcial): a store é criada.
{
  const quebrado = new Dexie(BROWSER_BACKUP_DB);
  quebrado.close();
  await Dexie.delete(BROWSER_BACKUP_DB);
  await new Promise((resolve, reject) => { const r = indexedDB.open(BROWSER_BACKUP_DB, 1); r.onupgradeneeded = () => {}; r.onsuccess = () => { r.result.close(); resolve(); }; r.onerror = () => reject(r.error); });
  const recuperado = await createPreMigrationBackup({ sourceDb: source, sourceVersion: 7, targetVersion: 8, files: null, now: new Date(2026, 8, 17, 11, 0, 0) });
  assert.equal(recuperado.storage, 'navegador', 'banco sem a store é recuperado em vez de bloquear');
  assert.ok(recuperado.sha256);
}

// 4. Falha de gravação (ex.: sem espaço) bloqueia a migração.
const realOpen = indexedDB.open.bind(indexedDB);
indexedDB.open = (name, version) => {
  if (name === BROWSER_BACKUP_DB) throw new Error('QuotaExceededError');
  return realOpen(name, version);
};
await assert.rejects(
  createPreMigrationBackup({ sourceDb: source, sourceVersion: 7, targetVersion: 8, files: null }),
  (err) => err.code === 'MIGRATION_BACKUP_FAILED' && err.reason === 'BROWSER_BACKUP_FAILED' && /navegador/.test(err.message),
);
indexedDB.open = realOpen;

// 5. Com a porta de arquivos (app desktop) o caminho em arquivo continua o único usado.
let written = null;
const files = { writeUserFile: async ({ filename, content }) => { written = filename; return { ok: true, data: { path: `C:/dados/backups/${filename}`, size: new TextEncoder().encode(content).length, sha256: await sha256Hex(content) } }; } };
const desktop = await createPreMigrationBackup({ sourceDb: source, sourceVersion: 7, targetVersion: 8, files });
assert.equal(desktop.storage, 'arquivo');
assert.ok(written && desktop.path.startsWith('C:/dados/backups/'));

source.close();
delete globalThis.window;
console.log(JSON.stringify({ gate: 'migration:browser-backup:verify', ok: true }, null, 2));
