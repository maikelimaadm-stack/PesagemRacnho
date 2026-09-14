import 'fake-indexeddb/auto';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { deleteDbForTests, resetDbForTests, ensureStorageReady } = await imp('src/storage/indexedDb/db.js');
// MESMO service usado pela UI (LancamentoPesagensIndividuais → weighingService).
const weighingService = await imp('src/modules/weighing/application/weighingService.js');

// Primeira abertura: banco Dexie limpo.
await deleteDbForTests();
await ensureStorageReady();

// Criar pesagem pelo service da UI.
const created = await weighingService.createEntry({
  data_pesagem: '2026-07-20', peso: 333, animal_id: 'a1', lote_id: 'l1', observacao: 'teste UI',
});
assert(created && created.id, 'createEntry (service da UI) criou pesagem');
assert(created.peso === 333 && created.peso_kg === 333, 'view model tem peso/peso_kg');

// Fechar a conexão e reabrir (simula fechar/abrir o app).
resetDbForTests();
await ensureStorageReady();

// Listar pelo mesmo service e confirmar persistência.
const list = await weighingService.listEntries({});
assert(list.length === 1, `pesagem persistiu após reabrir (obtido ${list.length})`);
assert(list[0].id === created.id && list[0].data_pesagem === '2026-07-20', 'dados corretos após reabrir');

// Update + delete (soft) pelo service.
await weighingService.updateEntry(created.id, { peso_kg: 400, peso: 400 });
const afterUpd = await weighingService.getEntryById(created.id);
assert(afterUpd.peso === 400, 'update via service refletiu');
await weighingService.deleteEntry({ id: created.id });
const afterDel = await weighingService.listEntries({});
assert(afterDel.length === 0, 'delete (soft) removeu da listagem');

console.log('OK verify-dexie-ui-first-run-persistence');
console.log(JSON.stringify({ createdViaService: true, persistedAfterReopen: true, updateOk: true, softDeleteOk: true }, null, 2));
