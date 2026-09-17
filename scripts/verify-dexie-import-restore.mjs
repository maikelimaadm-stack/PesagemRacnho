// Gate storage:import-restore:verify — importação de pesagens (dry-run + apply,
// hash idempotente) e restauração (backup completo → dry-run → apply), inclusive
// restore de backup formato 2 (banco v6) que dispara a cadeia de backfills v7 e v8
// (ADR-049) antes de registrar sucesso. Testes negativos: apply sem evidência física, arquivo
// repetido, restore sem evidência, payload mutado entre dry-run e apply.
import 'fake-indexeddb/auto';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { deleteDbForTests, ensureStorageReady } = await imp('src/storage/indexedDb/db.js');
const { BACKUP_FORMAT, SANITY_STORES, STORES_V6 } = await imp('src/storage/indexedDb/schema.js');
const { MIGRATION_STATUS, readMigrationState } = await imp('src/storage/migrations/migrationState.js');
const storage = (await imp('src/storage/storageAdapter.js')).default;

await deleteDbForTests();

// Estado inicial (enum v7).
await storage.animais.create({ id: 'a1', numero_animal: '1', identificacao_normalizada: '1', situacao: 'ATIVO' });
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
assert(dryR.schemaUpgradeRequired === false && dryR.ignoredStores.length === 0 && dryR.newStores.length === 0, 'backup da própria versão não exige conversão');
await storage.applyRestore(snapshot.backup).then(
  () => { throw new Error('restore sem backup físico deveria ser bloqueado'); },
  (error) => assert(/backup físico/.test(error.message), 'restauração exige evidência de backup físico'),
);
// O mesmo objeto é reutilizado entre dry-run e apply (como a tela faz): não pode ter sido mutado.
const restored = await storage.applyRestore(snapshot.backup, { safetyEvidence });
assert(restored.restored, 'restore aplicado');
assert(await storage.weighing.count() === 2, 'estado volta ao do backup (2)');
assert(!(await storage.weighing.get('p9')), 'entrada pós-backup ausente após restore');

// integridade lógica ok
const integ = await storage.logicalIntegrity();
assert(integ.ok && integ.result === 'ok', `integridade lógica ok (${JSON.stringify(integ.issues)})`);

// ---- RESTORE CRUZADO: backup formato 2 (banco v6, sem SHA) → grava e roda o backfill v7 ----
const TS = '2026-01-10T12:00:00.000Z';
const v6Stores = Object.fromEntries(Object.keys(STORES_V6).map((name) => [name, []]));
v6Stores.animais = [
  { id: 'v6-a1', empresa_id: 'local', numero_animal: '1', identificacao_normalizada: '1', marca: 'ALFA', raca: 'Nelore', era: '12', situacao: 'Ativo', created_at: TS, updated_at: TS, deleted_at: null },
  { id: 'v6-a2', empresa_id: 'local', numero_animal: '2', identificacao_normalizada: '2', marca: 'alfa', raca: 'Angus', era: '18', situacao: 'Inativo', motivo_saida: 'Abate', data_saida: '2026-01-20', created_at: TS, updated_at: TS, deleted_at: null },
];
v6Stores.animalIdentificadores = v6Stores.animais.map((a) => ({ id: `v6-i-${a.id}`, animal_id: a.id, tipo: 'visual_marca', valor: a.numero_animal, valor_normalizado: `${a.numero_animal}::${a.marca.toUpperCase()}`, marca: a.marca, ativo: true, created_at: TS, updated_at: TS, deleted_at: null }));
v6Stores.sessoesPesagem = [{ id: 'v6-s1', data: '2026-01-10', status: 'Fechada', operador: 'LOCAL', created_at: TS, updated_at: TS, deleted_at: null }];
v6Stores.loteApartacoes = [{ id: 'v6-l1', apartacao_id: 'v6-ap1', nome_lote: 'L1', fechado: true, created_at: TS, updated_at: TS, deleted_at: null }];
v6Stores.apartacoes = [{ id: 'v6-ap1', nome_apartacao: 'A', created_at: TS, updated_at: TS, deleted_at: null }];
v6Stores.pesagens = v6Stores.animais.map((a) => ({ id: `v6-p-${a.id}`, data_pesagem: '2026-01-10', peso_kg: 200, animal_id: a.id, sessao_id: 'v6-s1', tipo_pesagem: 'Cadastro', legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: a.numero_animal, marca: a.marca, peso: 200, status_animal: 'Ativo', created_date: TS, updated_date: TS }, created_at: TS, updated_at: TS, deleted_at: null }));
v6Stores.lotes = [];
const v2Backup = {
  format: BACKUP_FORMAT, formatVersion: 2, version: '1.1.17', dbVersion: 6, createdAt: TS,
  manifest: { format: BACKUP_FORMAT, formatVersion: 2, backupId: 'legacy-v2', appVersion: '1.1.17', dbVersion: 6, createdAt: TS, reason: 'manual', automatic: false, counts: Object.fromEntries(Object.entries(v6Stores).map(([k, v]) => [k, v.length])), stores: Object.keys(v6Stores) },
  stores: v6Stores,
};
const dryV2 = await storage.dryRunRestore(v2Backup);
assert(dryV2.restorable && dryV2.integrity === 'backup legado sem SHA-256', 'backup v2 sem SHA é restaurável (legado)');
assert(dryV2.schemaUpgradeRequired === true && dryV2.ignoredStores.includes('lotes') && dryV2.newStores.includes('marcas'), 'dry-run explica a conversão v6 → v7');
const restoredV2 = await storage.applyRestore(v2Backup, { safetyEvidence });
assert(restoredV2.restored && restoredV2.schemaUpgradeRequired, 'restore v2 aplicado com conversão');
assert(restoredV2.backfill?.status === MIGRATION_STATUS.CONCLUIDA, 'backfill concluído antes de registrar sucesso');
const db = await ensureStorageReady();
assert((await readMigrationState(db, 7)).status === MIGRATION_STATUS.CONCLUIDA, 'estado técnico CONCLUIDA');
assert((await readMigrationState(db, 8))?.status === MIGRATION_STATUS.CONCLUIDA, 'cadeia: v8 concluída após a v7 no restore cruzado');
assert(SANITY_STORES.every((name) => dryV2.newStores.includes(name)), 'dry-run lista as stores de sanidade como novas (vazias)');
const animais = await db.table('animais').toArray();
assert(animais.length === 2 && animais.every((a) => a.marca_id) && new Set(animais.map((a) => a.marca_id)).size === 1, 'ALFA/alfa fundidas em uma marca_id');
assert(animais.find((a) => a.id === 'v6-a2').situacao === 'ABATIDO', 'situacao derivada do motivo (Abate → ABATIDO)');
assert((await db.table('animalIdentificadores').toArray()).every((i) => i.tipo === 'VISUAL' && !i.valor_normalizado.includes('::') && i.marca_id), 'identificadores convertidos');
assert((await db.table('sessoesPesagem').where('id').equals('v6-s1').first()).status === 'FECHADA', 'sessão convertida');
assert((await db.table('loteApartacoes').where('id').equals('v6-l1').first()).situacao === 'FECHADO', 'lote convertido');
assert((await db.table('pesagens').toArray()).every((p) => !('status_animal' in p.legacy_payload) && !('created_date' in p.legacy_payload)), 'payload limpo');
assert(!db.tables.some((t) => t.name === 'lotes'), 'store lotes não volta');
assert(await db.table('categoriasAnimal').count() === 7, 'seeds criados');
const integV2 = await storage.logicalIntegrity();
assert(integV2.ok && integV2.v7Contract === true, `integridade v7 após restore cruzado (${JSON.stringify(integV2.issues)})`);
const history = (await db.table('backupHistory').toArray()).map((h) => h.tipo);
assert(history.includes('restore') && history.includes('backfill-v7') && history.includes('backfill-v8'), `histórico: ${history.join(',')}`);

// Teste negativo: restore de backup da própria versão (sem conversão) não dispara
// backfill. O restore é integral: backupHistory e appSettings voltam ao snapshot,
// então só o registro 'restore' novo aparece.
await storage.applyRestore(snapshot.backup, { safetyEvidence });
const afterHistory = (await db.table('backupHistory').toArray()).map((h) => h.tipo);
assert(!afterHistory.includes('backfill-v7') && !afterHistory.includes('backfill-v8') && afterHistory.at(-1) === 'restore', `restore da própria versão não roda backfill (${afterHistory.join(',')})`);
assert((await readMigrationState(db, 7)) === null, 'estado técnico do snapshot (inexistente) é restaurado como está');

await deleteDbForTests();
console.log('OK verify-dexie-import-restore');
console.log(JSON.stringify({ import: applied.inserted, afterImport: 2, restore: 'ok', afterRestore: 2, integrity: integ.result, restoreV2: { backfill: restoredV2.backfill?.status, marcas: 1, situacaoDerivada: 'ABATIDO' }, negativeTests: ['import sem evidência', 'arquivo repetido', 'restore sem evidência', 'payload reutilizado entre dry-run e apply', 'restore sem conversão não repete backfill'] }, null, 2));
