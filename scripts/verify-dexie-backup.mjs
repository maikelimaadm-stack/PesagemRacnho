// Gate storage:backup:verify — backup completo formato 3 (docs 13 §2, 14 §6),
// manifesto com schemaVersion/dataContractVersion/uiBuildId/appVersion,
// usuariosLocais no backup, dry-run com schemaUpgradeRequired/ignoredStores/newStores,
// restore de backup formato 2 (v6) → backfill v7 antes de registrar sucesso,
// limpeza em dois níveis (ADR-032). Testes negativos: SHA divergente, dbVersion
// maior que a do app, contagem divergente, restore/limpeza sem evidência física,
// reset sem confirmação do ADMIN.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { deleteDbForTests, ensureStorageReady } = await imp('src/storage/indexedDb/db.js');
const { BACKUP_FORMAT, MASTER_REGISTRY_STORES, PROTECTED_STORES, STORE_NAMES, STORES_V6 } = await imp('src/storage/indexedDb/schema.js');
const { BACKUP_FORMAT_VERSION, DATA_CONTRACT_VERSION, DB_SCHEMA_VERSION, UI_BUILD_ID, APP_VERSION } = await imp('src/versioning/versionInfo.js');
const { MIGRATION_STATUS, readMigrationState } = await imp('src/storage/migrations/migrationState.js');
const storage = (await imp('src/storage/storageAdapter.js')).default;
const USERS = STORE_NAMES.includes('usuarios') ? 'usuarios' : 'usuarios';
const HASH = USERS === 'usuarios' ? 'password_hash' : 'senha_hash';
const SALT = USERS === 'usuarios' ? 'password_salt' : 'senha_salt';
const ROLE = USERS === 'usuarios' ? 'role' : 'perfil';

const safetyEvidence = { path: 'C:\\isolated-test\\pre-operation.json', size: 1024, sha256: 'b'.repeat(64) };
const sha256 = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

await deleteDbForTests();

// Semear alguns dados (inclusive um usuário local — só hash/salt, nunca senha).
await storage.weighing.bulkCreate([
  { id: 'p1', data_pesagem: '2026-07-01', peso_kg: 300, animal_id: 'a1', lote_id: 'l1', observacao: 'com "aspas", e vírgula' },
  { id: 'p2', data_pesagem: '2026-07-02', peso_kg: 320, animal_id: 'a2', lote_id: 'l1' },
]);
await storage.apartacoes.create({ id: 'ap1', nome: 'Apartação A' });
await storage[USERS].create({ id: 'u1', nome: 'Admin', login: 'admin', login_normalizado: 'admin', [HASH]: 'aGFzaA==', [SALT]: 'c2FsdA==', [ROLE]: 'ADMIN', ativo: true });

// Backup completo (JSON de todos os stores) — formato 3.
const bak = await storage.createFullBackup();
assert.ok(bak.ok && bak.backup.format === BACKUP_FORMAT, 'backup completo tem formato correto');
assert.equal(BACKUP_FORMAT_VERSION, 3, 'formato do backup declarado em versionInfo');
assert.equal(bak.backup.formatVersion, 3, 'backup gravado no formato 3');
assert.equal(bak.backup.manifest.formatVersion, 3);
assert.equal(bak.backup.manifest.schemaVersion, DB_SCHEMA_VERSION, 'manifesto traz schemaVersion');
assert.equal(bak.backup.manifest.dataContractVersion, DATA_CONTRACT_VERSION, 'manifesto traz dataContractVersion');
assert.equal(bak.backup.manifest.uiBuildId, UI_BUILD_ID, 'manifesto traz uiBuildId');
assert.equal(bak.backup.manifest.appVersion, APP_VERSION, 'manifesto traz appVersion');
assert.equal(bak.backup.manifest.dbVersion, DB_SCHEMA_VERSION);
assert.deepEqual(bak.backup.manifest.stores, STORE_NAMES, 'todas as stores vigentes entram no backup');
assert.equal(bak.counts.pesagens, 2);
assert.equal(bak.counts.apartacoes, 1);
assert.equal(bak.counts[USERS], 1, `${USERS} entra no backup como qualquer store`);
assert.equal(bak.backup.stores[USERS][0][HASH], 'aGFzaA==', 'hash vai no backup (senha em texto nunca existe)');
assert.ok(JSON.stringify(bak.backup).length > 0, 'backup serializável para JSON');
assert.match(bak.backup.integrity.sha256, /^[a-f0-9]{64}$/);

// Export CSV / JSON.
const csv = await storage.exportPesagensCsv();
assert.ok(csv.ok && csv.count === 2, 'export CSV conta 2');
assert.ok(csv.csv.includes('data_pesagem') && csv.csv.includes('"com ""aspas"", e vírgula"'), 'CSV com header + escape correto');
const js = await storage.exportPesagensJson();
assert.ok(js.ok && js.payload.entries.length === 2 && js.payload.type === 'weighing-entries-export', 'export JSON correto');

// Dry-run de um backup da própria versão: sem conversão, sem stores ignoradas/novas.
const dryCurrent = await storage.dryRunRestore(bak.backup);
assert.equal(dryCurrent.schemaUpgradeRequired, false);
assert.deepEqual(dryCurrent.ignoredStores, []);
assert.deepEqual(dryCurrent.newStores, []);
assert.equal(dryCurrent.formatVersion, 3);
assert.equal(dryCurrent.usuarios, 1);

// Negativos: SHA divergente; banco mais novo; contagem divergente.
const tampered = structuredClone(bak.backup);
tampered.manifest.reason = 'alterado';
await assert.rejects(storage.dryRunRestore(tampered), /SHA-256 divergente/, 'teste negativo: adulteração é recusada');
const newer = structuredClone(bak.backup);
newer.manifest.dbVersion = 99;
delete newer.integrity;
await assert.rejects(storage.dryRunRestore(newer), /banco mais novo/, 'teste negativo: backup de versão futura é recusado');
const wrongCount = structuredClone(bak.backup);
wrongCount.manifest.counts.pesagens = 5;
delete wrongCount.integrity;
await assert.rejects(storage.dryRunRestore(wrongCount), /contagem divergente/, 'teste negativo: contagem divergente é recusada');

// Backup formato 2 (banco v6): stores da v6 (com `lotes`), valores legados, sem SHA (legado).
const v6Stores = Object.fromEntries(Object.keys(STORES_V6).map((name) => [name, []]));
v6Stores.animais = [{ id: 'v6-a1', empresa_id: 'local', numero_animal: '1', identificacao_normalizada: '1', marca: 'ALFA', raca: 'Nelore', era: '12', situacao: 'Ativo', created_at: '2026-01-10T12:00:00.000Z', updated_at: '2026-01-10T12:00:00.000Z', deleted_at: null }];
v6Stores.animalIdentificadores = [{ id: 'v6-i1', animal_id: 'v6-a1', tipo: 'visual_marca', valor: '1', valor_normalizado: '1::ALFA', marca: 'ALFA', ativo: true, created_at: '2026-01-10T12:00:00.000Z', updated_at: '2026-01-10T12:00:00.000Z', deleted_at: null }];
v6Stores.sessoesPesagem = [{ id: 'v6-s1', data: '2026-01-10', status: 'Aberta', operador: 'LOCAL', created_at: '2026-01-10T12:00:00.000Z', updated_at: '2026-01-10T12:00:00.000Z', deleted_at: null }];
v6Stores.pesagens = [{ id: 'v6-p1', data_pesagem: '2026-01-10', peso_kg: 200, animal_id: 'v6-a1', sessao_id: 'v6-s1', tipo_pesagem: 'Cadastro', legacy_payload: { tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'ALFA', peso: 200, status_animal: 'Ativo', created_date: 'x', _localId: 1, peso_kg: 200 }, created_at: '2026-01-10T12:00:00.000Z', updated_at: '2026-01-10T12:00:00.000Z', deleted_at: null }];
v6Stores.lotes = [{ id: 'lote-v6', nome: 'X' }];
v6Stores.appSettings = [{ key: 'cadastros-auxiliares:mortalidade:local', value: { causasMorte: [{ id: 'c1', nome: 'Acidente' }] } }];
const v2Unsigned = {
  format: BACKUP_FORMAT, formatVersion: 2, version: '1.1.17', dbVersion: 6, createdAt: '2026-01-11T00:00:00.000Z',
  manifest: { format: BACKUP_FORMAT, formatVersion: 2, backupId: 'v2-backup', appVersion: '1.1.17', dbVersion: 6, createdAt: '2026-01-11T00:00:00.000Z', reason: 'manual', automatic: false, counts: Object.fromEntries(Object.entries(v6Stores).map(([k, v]) => [k, v.length])), stores: Object.keys(v6Stores) },
  stores: v6Stores,
};
const v2Backup = { ...v2Unsigned, integrity: { algorithm: 'SHA-256', sha256: await sha256(JSON.stringify(v2Unsigned)) } };
const dryV2 = await storage.dryRunRestore(v2Backup);
assert.equal(dryV2.restorable, true, 'backup formato 2 continua restaurável');
assert.equal(dryV2.formatVersion, 2);
assert.equal(dryV2.sourceDbVersion, 6);
assert.equal(dryV2.schemaUpgradeRequired, true, 'dry-run avisa conversão de esquema');
assert.deepEqual(dryV2.ignoredStores, ['lotes'], 'store removida é listada como ignorada');
assert.ok(dryV2.newStores.includes('marcas') && dryV2.newStores.includes(USERS), `stores novas listadas (${dryV2.newStores.join(',')})`);
await assert.rejects(storage.applyRestore(v2Backup), /backup físico/, 'teste negativo: restore exige evidência física');

const restored = await storage.applyRestore(v2Backup, { safetyEvidence });
assert.equal(restored.restored, true);
assert.equal(restored.schemaUpgradeRequired, true);
assert.equal(restored.backfill?.status, MIGRATION_STATUS.CONCLUIDA, 'restore de banco anterior executa o backfill antes de concluir');
const db = await ensureStorageReady();
const migState = await readMigrationState(db, 7);
assert.equal(migState.status, MIGRATION_STATUS.CONCLUIDA);
assert.equal(migState.origem, 'restore-v6');
const animal = await db.table('animais').where('id').equals('v6-a1').first();
assert.equal(animal.situacao, 'ATIVO', 'enum convertido no restore');
assert.ok(animal.marca_id, 'marca_id preenchido pelo backfill após o restore');
assert.equal((await db.table('marcas').toArray()).length, 1);
const ident = await db.table('animalIdentificadores').where('id').equals('v6-i1').first();
assert.equal(ident.tipo, 'VISUAL');
assert.equal(ident.valor_normalizado, '1');
assert.equal((await db.table('sessoesPesagem').where('id').equals('v6-s1').first()).status, 'ABERTA');
const pes = await db.table('pesagens').where('id').equals('v6-p1').first();
assert.ok(!('status_animal' in pes.legacy_payload) && !('_localId' in pes.legacy_payload), 'payload limpo pelo backfill');
assert.equal(await db.table('causasMorte').count(), 1, 'catálogo legado do backup v6 migrado para store');
assert.equal(await db.table(USERS).count(), 0, 'backup v2 não tem usuários: store nasce vazia (docs 11 §9)');
const history = (await db.table('backupHistory').toArray()).map((h) => h.tipo);
assert.ok(history.includes('restore') && history.includes('backfill-v7'), `histórico registra restore e backfill (${history.join(',')})`);
assert.deepEqual((await storage.logicalIntegrity()).issues, [], 'integridade após restore + backfill');

// Limpeza em dois níveis (ADR-032).
await storage.marcas.create({ id: 'm-keep', nome: 'MANTIDA', nome_normalizado: 'MANTIDA', ativo: true });
await storage[USERS].create({ id: 'u2', nome: 'Gestor', login: 'gestor', login_normalizado: 'gestor', [HASH]: 'aA==', [SALT]: 'bB==', [ROLE]: 'GESTOR', ativo: true });
await assert.rejects(storage.clearOperationalData({}), /backup físico/, 'teste negativo: limpeza exige evidência física');
const cleared = await storage.clearOperationalData({ safetyEvidence });
assert.ok(cleared.ok);
for (const name of [...MASTER_REGISTRY_STORES, ...PROTECTED_STORES]) assert.ok(cleared.preserved.includes(name), `${name} preservada`);
assert.equal(await db.table('animais').count(), 0, 'dados operacionais apagados');
assert.equal(await db.table('pesagens').count(), 0);
assert.ok(await db.table('marcas').where('id').equals('m-keep').first(), 'cadastros mestres preservados');
assert.equal(await db.table(USERS).count(), 1, 'usuários preservados');
assert.ok((await readMigrationState(db, 7)).status === MIGRATION_STATUS.CONCLUIDA, 'estado técnico preservado');
assert.equal(typeof storage.clearAllData, 'function', 'clearAllData continua como alias');
assert.equal(storage.clearAllData, storage.clearOperationalData);

await assert.rejects(storage.resetAllData({ safetyEvidence }), /confirmação explícita do ADMIN/, 'teste negativo: reset exige confirmedByAdmin');
await assert.rejects(storage.resetAllData({ confirmedByAdmin: true }), /backup físico/, 'teste negativo: reset exige evidência física');
const reset = await storage.resetAllData({ safetyEvidence, confirmedByAdmin: true });
assert.ok(reset.ok);
assert.deepEqual(reset.preserved, ['backupHistory']);
assert.equal(await db.table('marcas').count(), 0, 'reset apaga cadastros');
assert.equal(await db.table(USERS).count(), 0, 'reset apaga usuários');
assert.ok((await db.table('backupHistory').count()) > 0, 'histórico de backups preservado');
assert.equal((await readMigrationState(db, 7)).status, MIGRATION_STATUS.CONCLUIDA, 'estado técnico recriado');
assert.equal(await db.table('categoriasAnimal').count(), 7, 'seeds recriados após o reset');

await deleteDbForTests();
console.log('OK verify-dexie-backup');
console.log(JSON.stringify({ formatVersion: BACKUP_FORMAT_VERSION, backupCounts: bak.counts, csvCount: csv.count, jsonCount: js.count, restoreV2: { ignoredStores: dryV2.ignoredStores, newStores: dryV2.newStores.length, backfill: restored.backfill?.status }, negativeTests: ['SHA divergente', 'dbVersion futura', 'contagem divergente', 'restore sem evidência', 'limpeza sem evidência', 'reset sem confirmação', 'reset sem evidência'] }, null, 2));
