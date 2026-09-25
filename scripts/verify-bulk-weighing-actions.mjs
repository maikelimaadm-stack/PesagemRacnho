// Gate weighing:bulk-actions:verify
// Garante que as ações em lote da Relação alteram o cadastro canônico do animal,
// sincronizam os snapshots históricos e preservam a unicidade número + marca.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import { setActorProvider } from '../src/storage/indexedDb/auditActor.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const now = '2026-09-23T12:00:00.000Z';

function registry(id, name) {
  return {
    id,
    empresa_id: 'local',
    nome: name,
    nome_normalizado: name.toUpperCase(),
    ativo: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

async function rejectionMessage(run) {
  try {
    await run();
    return null;
  } catch (error) {
    return error?.message || String(error);
  }
}

await deleteDbForTests();
setActorProvider(() => ({ id: 'u-gestor', nome: 'Gestor', role: 'GESTOR' }));

const base = {
  empresa_id: 'local',
  sexo: 'M',
  era: '14',
  raca: 'Nelore',
  status_animal: 'Ativo',
};

await weighingService.createEntry({
  ...base,
  id: 'cad-a',
  animal_id: 'animal-a',
  numero_animal: '900',
  marca: 'A',
  tipo_manejo: 'Cadastro',
  data_pesagem: '2026-09-01',
  peso: 300,
});
await weighingService.createEntry({
  ...base,
  id: 'manejo-a',
  animal_id: 'animal-a',
  numero_animal: '900',
  marca: 'A',
  tipo_manejo: 'Manejo',
  data_pesagem: '2026-09-10',
  peso: 330,
});
await weighingService.createEntry({
  ...base,
  id: 'cad-b',
  animal_id: 'animal-b',
  numero_animal: '900',
  marca: 'B',
  tipo_manejo: 'Cadastro',
  data_pesagem: '2026-09-02',
  peso: 280,
});

const db = await ensureStorageReady();
const brandB = (await db.table('marcas').where('nome_normalizado').equals('B').first());
assert.ok(brandB?.id, 'a marca B criada pelo cadastro existe');
await db.table('marcas').add(registry('brand-c', 'C'));
await db.table('racas').add(registry('race-angus', 'Angus'));
await db.table('categoriasAnimal').add(registry('category-novilha', 'Novilha'));

const collision = await rejectionMessage(() => weighingService.bulkUpdateAnimalProfiles([{
  animalId: 'animal-a',
  patch: { marca_id: brandB.id },
}]));
assert.match(collision || '', /já existe na marca B/i, 'recusa colisão número + marca');

assert.equal(await weighingService.bulkUpdateAnimalProfiles([{
  animalId: 'animal-a',
  patch: {
    marca_id: 'brand-c',
    raca_id: 'race-angus',
    categoria_id: 'category-novilha',
    sexo: 'F',
    era: '24-36',
  },
}]), 1, 'atualiza um animal canônico');

const animal = await db.table('animais').where('id').equals('animal-a').first();
assert.equal(animal.marca_id, 'brand-c');
assert.equal(animal.marca, 'C');
assert.equal(animal.raca_id, 'race-angus');
assert.equal(animal.raca, 'Angus');
assert.equal(animal.categoria_id, 'category-novilha');
assert.equal(animal.categoria_automatica, false);
assert.equal(animal.sexo, 'F');
assert.equal(animal.era, '24-36');

const identifier = (await db.table('animalIdentificadores').where('animal_id').equals('animal-a').toArray())
  .find((row) => row.tipo === 'VISUAL' && row.ativo !== false && !row.deleted_at);
assert.equal(identifier.marca_id, 'brand-c', 'identificador visual acompanha a marca');
assert.equal(identifier.marca, 'C');

for (const id of ['cad-a', 'manejo-a']) {
  const entry = await weighingService.getEntryById(id);
  assert.equal(entry.marca, 'C', `${id}: marca sincronizada`);
  assert.equal(entry.raca, 'Angus', `${id}: raça sincronizada`);
  assert.equal(entry.sexo, 'F', `${id}: sexo sincronizado`);
  assert.equal(entry.era, '24-36', `${id}: era sincronizada`);
  assert.equal(entry.categoria_id, 'category-novilha', `${id}: categoria sincronizada`);
}

const audit = (await db.table('auditoria').where('entidade_id').equals('animal-a').toArray())
  .find((row) => row.origem === 'edicao-coletiva' && row.acao === 'ATUALIZAR');
assert.ok(audit, 'a alteração coletiva produz auditoria');
assert.ok(audit.campos_alterados.includes('marca_id'));
assert.ok(audit.campos_alterados.includes('categoria_id'));

const relationSource = read('src/pages/PesagensIndividuais.jsx');
const relationCss = read('src/styles/d17b-modelobase1.css');
assert.match(relationSource, /Ações para \$\{fmtInt\(selectedItems\.length\)\} registros selecionados/);
assert.match(relationSource, /title=\{`Ações em lote · \$\{fmtInt\(selectedItems\.length\)\} selecionado\(s\)`\}[\s\S]{0,160}<MoreVertical/);
assert.doesNotMatch(relationSource, /d17c-bulk-actions-trigger/);
assert.match(relationSource, />Identificação e cadastro</);
assert.match(relationSource, />Movimentação</);
assert.match(relationSource, />Dados comerciais</);
assert.match(relationSource, /selectionSummary\.cadastros\.length === 0/);
assert.match(relationSource, /selectionSummary\.vendas\.length === 0/);
assert.match(relationSource, /selectionSummary\.abates\.length === 0/);
for (const label of ['Número da GTA', 'Número da NF-e', 'Frete', 'Embarque', 'Documento do embarque']) {
  assert.match(relationSource, new RegExp(label), `formulário coletivo oferece ${label}`);
}
assert.match(relationSource, /shipmentService\.listShipments/);
assert.match(relationSource, /shipmentService\.listDocuments/);
assert.doesNotMatch(relationCss, /\.d17c-bulk-actions-trigger/);

setActorProvider(null);
await deleteDbForTests();

console.log(JSON.stringify({
  gate: 'weighing:bulk-actions:verify',
  ok: true,
  synchronizedEntries: 2,
  collisionProtected: true,
}, null, 2));
