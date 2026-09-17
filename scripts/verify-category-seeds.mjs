// Gate category:seeds:verify — pré-cadastro de categorias (17/09/2026): 12 categorias com faixa
// de peso por sexo e era em meses. Em banco que já existe: as novas entram, as antigas intocadas
// ganham a faixa, os nomes antigos fora da lista saem se ninguém usou, e NADA que o responsável
// editou ou que está em uso é alterado.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { CATEGORIAS_SEED, CATEGORIAS_SEED_ANTERIOR, ensureSeeds } from '../src/modules/catalog/domain/seeds.js';
import { categoryService } from '../src/modules/catalog/application/registryServices.js';
import { suggestCategory } from '../src/modules/operations/domain/categorySuggestion.js';

const ADMIN = { id: 'u-admin', nome: 'Ana Admin', role: 'ADMIN' };
// Direto na store: a listagem do serviço não traz excluídos, e é justamente isso que checamos.
const porNome = async (nome) => (await (await storage.ensureReady()).table('categoriasAnimal').toArray()).find((c) => c.nome === nome);

// 1. Banco novo: as 12 categorias do pré-cadastro, com faixa e era.
await deleteDbForTests();
await storage.ensureReady();
await ensureSeeds('local');
const criadas = (await (await storage.ensureReady()).table('categoriasAnimal').toArray()).filter((c) => !c.deleted_at).sort((a, b) => a.ordem - b.ordem);
assert.deepEqual(criadas.map((c) => c.nome), CATEGORIAS_SEED.map((c) => c.nome), 'as 12 categorias, na ordem');
assert.ok(criadas.every((c) => c.peso_min_kg != null && c.era != null), 'todas com faixa de peso e era');

// 2. A escolha automática por peso usa essas faixas (macho e fêmea separados).
const categorias = criadas;
const escolha = (sexo, peso) => suggestCategory({ categorias, sexo, peso })?.nome ?? null;
assert.equal(escolha('M', 150), 'Bezerro');
assert.equal(escolha('M', 250), 'Garrote leve');
assert.equal(escolha('M', 300), 'Garrote');
assert.equal(escolha('M', 380), 'Boi magro');
assert.equal(escolha('M', 420), 'Boi em engorda');
assert.equal(escolha('M', 470), 'Boi terminado');
assert.equal(escolha('M', 620), 'Boi pesado', 'faixa aberta no fim');
assert.equal(escolha('F', 150), 'Bezerra');
assert.equal(escolha('F', 300), 'Novilha');
assert.equal(escolha('F', 700), 'Fêmea adulta');
assert.equal(escolha('M', 199), 'Bezerro', 'limite superior pertence à faixa');
assert.equal(escolha('M', 200), 'Garrote leve', 'limite inferior da seguinte');

// 3. Banco antigo (1.2.0): categorias sem faixa, uma editada e uma em uso.
await deleteDbForTests();
const db = await storage.ensureReady();
const ts = '2026-09-01T00:00:00.000Z';
await db.table('categoriasAnimal').bulkAdd(CATEGORIAS_SEED_ANTERIOR.map((nome, i) => ({
  id: `cat-${i}`, empresa_id: 'local', nome, nome_normalizado: nome.toLocaleUpperCase('pt-BR'),
  sexo_aplicavel: ['Bezerra', 'Novilha', 'Vaca'].includes(nome) ? 'F' : 'M',
  peso_min_kg: null, peso_max_kg: null, era: null, ordem: i + 1, ativo: true, created_at: ts, updated_at: ts, deleted_at: null,
})));
// "Touro" editado pelo responsável e "Vaca" em uso por um animal.
await categoryService.update(ADMIN, 'cat-6', { peso_min_kg: 700, era: 48 });
await db.table('animais').add({ id: 'a1', empresa_id: 'local', numero_animal: '1', categoria_id: 'cat-5', situacao: 'ATIVO', created_at: ts, updated_at: ts, deleted_at: null });

const resultado = await ensureSeeds('local');
assert.ok(resultado.categoriasAnimal >= 8, 'as categorias novas entram');
assert.ok(resultado.categoriasAtualizadas >= 4, 'as antigas intocadas ganham faixa e era');

const bezerro = await porNome('Bezerro');
assert.equal(bezerro.id, 'cat-0', 'a categoria existente é reaproveitada, não duplicada');
assert.deepEqual([bezerro.peso_min_kg, bezerro.peso_max_kg, bezerro.era], [0, 199, 12], 'ganhou a faixa do pré-cadastro');

const touro = await porNome('Touro');
assert.equal(touro.peso_min_kg, 700, 'NEGATIVO: categoria editada pelo responsável não é tocada');
assert.equal(touro.deleted_at, null, 'e não é removida');

const vaca = await porNome('Vaca');
assert.equal(vaca.deleted_at, null, 'NEGATIVO: categoria em uso por um animal permanece');

const boi = await porNome('Boi');
assert.ok(boi.deleted_at, 'nome antigo fora da lista, intocado e sem uso: sai do caminho');

// 4. Rodar de novo não muda mais nada.
const segunda = await ensureSeeds('local');
assert.deepEqual([segunda.categoriasAnimal, segunda.categoriasAtualizadas, segunda.categoriasRemovidas], [0, 0, 0], 'reexecução não mexe em nada');

await deleteDbForTests();
console.log(JSON.stringify({ gate: 'category:seeds:verify', ok: true, categorias: CATEGORIAS_SEED.length }, null, 2));
