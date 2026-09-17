// Gate animal:orphan-cleanup:verify — excluir TODAS as pesagens de um animal remove o animal
// (ele nasce do Cadastro): identificadores, permanências e movimentos saem junto por exclusão
// lógica, com auditoria, e os cadastros (marca, raça, categoria) deixam de aparecer "Em uso".
// Negativos: sobrando qualquer pesagem, o animal continua; excluir não apaga fisicamente nada.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { brandService, breedService } from '../src/modules/catalog/application/registryServices.js';

setActorProvider(() => ({ id: 'u-admin', nome: 'Ana Admin', role: 'ADMIN' }));
await deleteDbForTests();
const db = await storage.ensureReady();
const ts = '2026-09-17T00:00:00.000Z';
await db.table('marcas').add({ id: 'm-alfa', empresa_id: 'local', nome: 'ALFA', nome_normalizado: 'ALFA', ativo: true, created_at: ts, updated_at: ts, deleted_at: null });
await db.table('racas').add({ id: 'r-nelore', empresa_id: 'local', nome: 'Nelore', nome_normalizado: 'NELORE', ativo: true, created_at: ts, updated_at: ts, deleted_at: null });

const base = { empresa_id: 'local', marca: 'ALFA', marca_id: 'm-alfa', raca: 'Nelore', raca_id: 'r-nelore', sexo: 'M', status_animal: 'Ativo' };
const criar = (id, animalId, numero, tipo, data, peso) => weighingService.createEntry({ ...base, id, animal_id: animalId, numero_animal: numero, tipo_manejo: tipo, data_pesagem: data, peso });

await criar('c1', 'a1', '101', 'Cadastro', '2026-08-01', 300);
await criar('m1', 'a1', '101', 'Manejo', '2026-08-20', 330);
await criar('c2', 'a2', '202', 'Cadastro', '2026-08-01', 310);

const usoDe = async (registro, id) => (await registro.countUsage(id));
assert.equal(await usoDe(brandService, 'm-alfa'), 2, 'duas marcas em uso: dois animais ativos');

// 1. Excluir SÓ o manejo: o animal continua (ainda tem o Cadastro).
await weighingService.deleteEntry('m1');
let a1 = await db.table('animais').where('id').equals('a1').first();
assert.equal(a1.deleted_at, null, 'NEGATIVO: sobrando pesagem, o animal permanece');
assert.equal(a1.situacao, 'ATIVO');
assert.equal(await usoDe(brandService, 'm-alfa'), 2);

// 2. Excluir a última pesagem do animal: o animal sai junto.
await weighingService.deleteEntry('c1');
a1 = await db.table('animais').where('id').equals('a1').first();
assert.ok(a1, 'o registro continua no banco (exclusão lógica, nunca física)');
assert.ok(a1.deleted_at, 'animal sem pesagem nenhuma é excluído logicamente');
const identificadores = (await db.table('animalIdentificadores').where('animal_id').equals('a1').toArray());
assert.ok(identificadores.length > 0 && identificadores.every((row) => row.deleted_at), 'identificadores saem junto');
assert.ok((await db.table('animalLotes').where('animal_id').equals('a1').toArray()).every((row) => row.deleted_at), 'permanências saem junto');
assert.ok((await db.table('movimentosAnimais').where('animal_id').equals('a1').toArray()).every((row) => row.deleted_at), 'movimentos saem junto');
const auditoria = (await db.table('auditoria').toArray()).filter((row) => row.entidade === 'animais' && row.entidade_id === 'a1' && row.acao === 'CANCELAR');
assert.equal(auditoria.length, 1, 'auditoria registra a remoção do animal');
assert.equal(auditoria[0].usuario_id, 'u-admin', 'com o usuário real');

// 3. O cadastro deixa de aparecer "Em uso" (só o animal 202 restou) e a raça acompanha.
assert.equal(await usoDe(brandService, 'm-alfa'), 1, 'marca: só o animal que ainda tem pesagem');
assert.equal(await usoDe(breedService, 'r-nelore'), 1);

// 4. Excluindo em lote as pesagens restantes, o cadastro fica livre.
await weighingService.bulkDeleteEntries(['c2']);
assert.equal(await usoDe(brandService, 'm-alfa'), 0, 'sem animais, a marca não está mais em uso');
assert.equal(await usoDe(breedService, 'r-nelore'), 0);
assert.ok((await db.table('animais').where('id').equals('a2').first()).deleted_at);
assert.equal((await db.table('pesagens').toArray()).length, 3, 'nada foi apagado fisicamente');

setActorProvider(null);
await deleteDbForTests();
console.log(JSON.stringify({ gate: 'animal:orphan-cleanup:verify', ok: true }, null, 2));
