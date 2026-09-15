import 'fake-indexeddb/auto';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Dexie from 'dexie';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }
const imp = (rel) => import(pathToFileURL(join(root, rel)).href);

const { ensureStorageReady, deleteDbForTests } = await imp('src/storage/indexedDb/db.js');
const { DB_NAME, DB_VERSION, STORE_NAMES, STORES_V5, STORES_V6, SESSAO_STATUS, LOTE_SITUACOES, MASTER_REGISTRY_STORES } = await imp('src/storage/indexedDb/schema.js');
const repos = await imp('src/storage/indexedDb/repositories/index.js');
const { clearWriteBlock, setWriteBlocked, isWriteBlocked } = await imp('src/storage/migrations/migrationState.js');

await deleteDbForTests();

// Migração v5 -> v6 -> v7: preserva o domínio operacional e elimina integralmente
// as três stores da funcionalidade retirada.
const legacyDb = new Dexie(DB_NAME);
legacyDb.version(5).stores(STORES_V5);
await legacyDb.open();
await legacyDb.table('pesagens').add({
  id: 'preservada-v5',
  data_pesagem: '2026-07-19',
  peso_kg: 300,
  legacy_payload: { numero_animal: '1', sanidade_ids: ['removida-v6'], sanidades: [{ id: 'removida-v6' }] },
});
await legacyDb.table('configuracoesSanidade').add({ id: 'removida-v6', nome: 'Legada' });
legacyDb.close();
const upgradedDb = await ensureStorageReady();
const upgradedTables = upgradedDb.tables.map((table) => table.name);
for (const removedStore of ['configuracoesSanidade', 'itensSanidade', 'sanidadesAnimal']) {
  assert(!upgradedTables.includes(removedStore), `store removida na v6: ${removedStore}`);
}
assert(await upgradedDb.table('pesagens').where('id').equals('preservada-v5').count() === 1, 'migração preserva pesagens existentes');
const preservedEntry = await upgradedDb.table('pesagens').where('id').equals('preservada-v5').first();
assert(!('sanidade_ids' in preservedEntry.legacy_payload) && !('sanidades' in preservedEntry.legacy_payload), 'migração remove dados sanitários embutidos em pesagens antigas');
await deleteDbForTests();

// Migração v6 -> v7 (upgrade estrutural do Dexie, sem o coordenador): `lotes`
// removida, stores novas criadas, enums leves convertidos, dados preservados.
const v6Db = new Dexie(DB_NAME);
v6Db.version(6).stores(STORES_V6);
await v6Db.open();
assert(v6Db.tables.some((t) => t.name === 'lotes'), 'pré-condição: v6 tem a store lotes');
await v6Db.table('sessoesPesagem').bulkAdd([
  { id: 's-aberta', data: '2026-07-01', status: 'Aberta', operador: 'LOCAL', created_at: 'x', updated_at: 'x', deleted_at: null },
  { id: 's-fechada', data: '2026-07-02', status: 'Fechada', operador: 'LOCAL', created_at: 'x', updated_at: 'x', deleted_at: null },
]);
await v6Db.table('loteApartacoes').bulkAdd([
  { id: 'l-aberto', apartacao_id: 'ap', nome_lote: 'A', fechado: false, created_at: 'x', updated_at: 'x', deleted_at: null },
  { id: 'l-fechado', apartacao_id: 'ap', nome_lote: 'B', fechado: true, created_at: 'x', updated_at: 'x', deleted_at: null },
]);
await v6Db.table('apartacoes').add({ id: 'ap', nome_apartacao: 'Recria', created_at: 'x', updated_at: 'x', deleted_at: null });
await v6Db.table('animais').add({ id: 'a-v6', numero_animal: '1', identificacao_normalizada: '1', marca: 'ALFA', situacao: 'Ativo', created_at: 'x', updated_at: 'x', deleted_at: null });
v6Db.close();
const v7Db = await ensureStorageReady();
assert(v7Db.verno === DB_VERSION && DB_VERSION === 7, `banco aberto na v7 (verno=${v7Db.verno})`);
const v7Tables = v7Db.tables.map((t) => t.name);
assert(!v7Tables.includes('lotes'), 'store lotes removida na v7 (ADR-023)');
for (const name of [...MASTER_REGISTRY_STORES, 'usuariosLocais']) assert(v7Tables.includes(name), `store nova criada: ${name}`);
const sessions = await v7Db.table('sessoesPesagem').toArray();
assert(sessions.find((s) => s.id === 's-aberta').status === 'ABERTA', 'upgrade converte Aberta → ABERTA');
assert(sessions.find((s) => s.id === 's-fechada').status === 'FECHADA', 'upgrade converte Fechada → FECHADA');
assert(sessions.every((s) => SESSAO_STATUS.includes(s.status) && s.local === null), 'sessões dentro do enum com local nulo');
const lots = await v7Db.table('loteApartacoes').toArray();
assert(lots.find((l) => l.id === 'l-aberto').situacao === 'ABERTO' && lots.find((l) => l.id === 'l-fechado').situacao === 'FECHADO', 'upgrade converte fechado → situacao');
assert(lots.every((l) => LOTE_SITUACOES.includes(l.situacao) && l.ativo === true), 'lotes dentro do enum e ativos');
assert((await v7Db.table('apartacoes').toArray()).every((a) => a.ativo === true), 'apartações ganham ativo');
assert(await v7Db.table('animais').where('id').equals('a-v6').count() === 1, 'animais preservados no upgrade (o backfill pesado fica para o coordenador)');
await deleteDbForTests();

// Dexie abre automaticamente e cria todos os stores.
const db = await ensureStorageReady();
assert(db.isOpen(), 'Dexie abriu automaticamente');
const tables = db.tables.map((t) => t.name);
for (const s of STORE_NAMES) assert(tables.includes(s), `store existe: ${s}`);

// CRUD no repositório de pesagens.
const created = await repos.weighingRepository.create({ data_pesagem: '2026-07-20', peso_kg: 321, animal_id: 'a1', lote_id: 'l1' });
assert(created.id && created.localId, 'create retornou id + localId');
const got = await repos.weighingRepository.get(created.id);
assert(got && got.peso_kg === 321, 'get por id');
const upd = await repos.weighingRepository.update(created.id, { peso_kg: 350 });
assert(upd.peso_kg === 350, 'update aplicou');
assert(await repos.weighingRepository.count() === 1, 'count = 1');
await repos.weighingRepository.remove(created.id);
assert(await repos.weighingRepository.count() === 1 === false || (await repos.weighingRepository.count()) === 0, 'soft delete some da listagem');
assert((await repos.weighingRepository.list({ includeDeleted: true })).length === 1, 'soft delete preserva registro');

// Mesmo id de domínio em mais de uma linha (restauração de backup, importação,
// reuso de id): update/remove/get precisam agir sobre a linha ATIVA. Quando
// pegavam a primeira linha, editar um cadastro atualizava a cópia já apagada e
// a alteração sumia sem nenhum erro.
const dup = 'id-repetido';
const antiga = await repos.weighingRepository.create({ id: dup, peso_kg: 10 });
await repos.weighingRepository.remove(dup); // a linha antiga fica soft-deletada
const ativa = await repos.weighingRepository.create({ id: dup, peso_kg: 20 });
assert(antiga.localId !== ativa.localId, 'duas linhas distintas com o mesmo id');
const lido = await repos.weighingRepository.get(dup);
assert(lido.localId === ativa.localId, 'get devolve a linha ativa, não a apagada');
await repos.weighingRepository.update(dup, { peso_kg: 99 });
const apos = await repos.weighingRepository.get(dup);
assert(apos.peso_kg === 99 && apos.localId === ativa.localId, 'update alterou a linha ativa');
const apagada = (await repos.weighingRepository.list({ includeDeleted: true }))
  .find((r) => r.localId === antiga.localId);
assert(apagada.peso_kg === 10, 'a linha apagada permaneceu intacta');
await repos.weighingRepository.remove(dup);
assert((await repos.weighingRepository.list()).every((r) => r.id !== dup), 'remove apagou a linha ativa');

// bulkCreate + summary
await repos.weighing.bulkCreate([
  { data_pesagem: '2026-07-01', peso_kg: 300, animal_id: 'a1', lote_id: 'l1' },
  { data_pesagem: '2026-07-15', peso_kg: 400, animal_id: 'a2', lote_id: 'l1' },
]);
const sum = await repos.weighing.summary({ loteId: 'l1' });
assert(sum.total === 2 && sum.somaPeso === 700, `summary por lote (total ${sum.total}, soma ${sum.somaPeso})`);

// Repositórios v7 (cadastros mestres, estoque, usuários) e bloqueio de escrita (ADR-038).
for (const repo of ['marcaRepository', 'racaRepository', 'categoriaAnimalRepository', 'parceiroRepository', 'propriedadeRepository', 'causaMorteRepository', 'faixaIdentificadorRepository', 'excecaoIdentificadorRepository', 'usuarioLocalRepository']) {
  assert(typeof repos[repo]?.create === 'function', `repositório v7 disponível: ${repo}`);
}
const marca = await repos.marcaRepository.create({ nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true });
assert(marca.id, 'repositório de marcas grava');
setWriteBlocked({ code: 'MIGRATION_FAILED', message: 'teste' });
assert(isWriteBlocked(), 'bloqueio ativo');
let blocked = false;
try { await repos.marcaRepository.create({ nome: 'BETA', nome_normalizado: 'BETA' }); } catch (err) { blocked = err.code === 'MIGRATION_BLOCKED'; }
assert(blocked, 'teste negativo: create bloqueado durante migração pendente/falha');
blocked = false;
try { await repos.marcaRepository.update(marca.id, { nome: 'X' }); } catch (err) { blocked = err.code === 'MIGRATION_BLOCKED'; }
assert(blocked, 'teste negativo: update bloqueado');
blocked = false;
try { await repos.writeAppSetting('k', 1); } catch (err) { blocked = err.code === 'MIGRATION_BLOCKED'; }
assert(blocked, 'teste negativo: configuração bloqueada');
assert((await repos.marcaRepository.get(marca.id)).nome === 'ALFA', 'leitura continua liberada e nada foi gravado');
clearWriteBlock();
assert((await repos.marcaRepository.update(marca.id, { nome: 'ALFA 2' })).nome === 'ALFA 2', 'escrita liberada após limpar o bloqueio');

console.log('OK verify-dexie-storage');
console.log(JSON.stringify({ stores: tables.length, dbVersion: DB_VERSION, upgradeV6ToV7: { lotesRemoved: true, enumsConverted: true }, crud: 'ok', writeBlock: 'ok', summary: sum }, null, 2));
