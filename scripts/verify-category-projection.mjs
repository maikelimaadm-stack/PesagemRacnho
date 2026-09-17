// Gate category-projection:verify (R0 do programa reporting, G-P0-02).
// Uma Saída sem peso (Morte/Doação/Transferência) ou um peso fora de todas as faixas NÃO
// apaga a classificação conhecida do animal: a projeção preserva a última categoria válida,
// o peso atual vem do último evento com peso e a pesagem de saída herda a categoria.
// Negativos: categoria manual nunca é recalculada; o caso antigo (null após saída) falha.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

await deleteDbForTests();
const db = await storage.ensureReady();
const empresaId = 'local';
const ts = '2026-09-16T00:00:00.000Z';
const categoria = (id, nome, sexo, min, max, era, ordem) => ({ id, empresa_id: empresaId, nome, nome_normalizado: nome.toUpperCase(), sexo_aplicavel: sexo, peso_min_kg: min, peso_max_kg: max, era, ordem, ativo: true, created_at: ts, updated_at: ts, deleted_at: null });
await db.table('categoriasAnimal').clear();
await db.table('categoriasAnimal').bulkAdd([
  categoria('cat-bezerro', 'Bezerro', 'M', 300, 350, 12, 1),
  categoria('cat-garrote', 'Garrote', 'M', 350, 450, 24, 2),
]);
const animal = (id) => db.table('animais').where('id').equals(id).first();
const payloadOf = async (id) => (await db.table('pesagens').where('id').equals(id).first()).legacy_payload;
const base = { empresa_id: empresaId, numero_animal: '501', marca: 'A', sexo: 'M', raca: 'Nelore', status_animal: 'Ativo' };

// 1. Cadastro 320 → Bezerro; Manejo 362 → Garrote.
await weighingService.createEntry({ ...base, id: 'c1', animal_id: 'a1', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 320, categoria_automatica: true });
await weighingService.createEntry({ ...base, id: 'm1', animal_id: 'a1', tipo_manejo: 'Manejo', data_pesagem: '2026-09-05', peso: 362 });
assert.equal((await animal('a1')).categoria_id, 'cat-garrote');

// 2. Saída por Morte sem peso: categoria, era e peso atual preservados.
await weighingService.createEntry({ ...base, id: 's1', animal_id: 'a1', tipo_manejo: 'Saída', motivo_saida: 'Morte', causa_morte: 'Raio', data_pesagem: '2026-09-10', peso: null });
let a1 = await animal('a1');
assert.equal(a1.situacao, 'MORTO', 'saída aplicada');
assert.equal(a1.categoria_id, 'cat-garrote', 'Saída sem peso preserva a última categoria válida');
assert.equal(a1.era, '24', 'era preservada');
assert.equal(a1.ultimo_peso_kg, 362, 'peso atual vem do último evento com peso');
assert.equal(a1.ultima_pesagem_data, '2026-09-05', 'última pesagem = último evento com peso');
assert.equal((await payloadOf('s1')).categoria_id, 'cat-garrote', 'a pesagem de saída herda a categoria conhecida');

// 3. Editar a saída (observação) continua preservando.
await weighingService.updateEntry('s1', { observacao: 'conferido' });
a1 = await animal('a1');
assert.equal(a1.categoria_id, 'cat-garrote', 'edição da saída sem peso preserva a categoria');
assert.equal((await payloadOf('s1')).categoria_id, 'cat-garrote');

// 4. Peso fora de todas as faixas não grava null: preserva a última categoria válida.
await weighingService.createEntry({ ...base, numero_animal: '502', id: 'c2', animal_id: 'a2', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 330, categoria_automatica: true });
await weighingService.createEntry({ ...base, numero_animal: '502', id: 'm2', animal_id: 'a2', tipo_manejo: 'Manejo', data_pesagem: '2026-09-05', peso: 290 });
assert.equal((await animal('a2')).categoria_id, 'cat-bezerro', 'peso sem faixa correspondente não apaga a categoria');
assert.equal((await payloadOf('m2')).categoria_id, 'cat-bezerro', 'pesagem sem faixa herda a categoria conhecida');

// 5. Negativo: categoria manual nunca é recalculada, nem por Saída sem peso.
await weighingService.createEntry({ ...base, numero_animal: '503', id: 'c3', animal_id: 'a3', tipo_manejo: 'Cadastro', data_pesagem: '2026-09-01', peso: 330, categoria_id: 'cat-garrote', categoria_automatica: false });
await weighingService.createEntry({ ...base, numero_animal: '503', id: 's3', animal_id: 'a3', tipo_manejo: 'Saída', motivo_saida: 'Doação', data_pesagem: '2026-09-10', peso: null });
assert.equal((await animal('a3')).categoria_id, 'cat-garrote', 'manual preservada');

// 6. Negativo: a regra antiga ("último evento, com ou sem peso") produziria null — o gate a detecta.
const events = (await db.table('pesagens').where('animal_id').equals('a1').toArray()).sort((l, r) => l.data_pesagem.localeCompare(r.data_pesagem));
const pesoDoUltimoEvento = events.at(-1).peso_kg ?? events.at(-1).legacy_payload.peso ?? null;
assert.equal(pesoDoUltimoEvento, null, 'cenário reproduz a regressão (último evento sem peso)');

// 7. Lançamento retroativo em outro lote não troca o lote atual nem quebra o histórico (revisão de dados).
const lotBase = { ...base, numero_animal: '777', lote_id: 'L1', nome_lote: 'Lote 01' };
await weighingService.createEntry({ ...lotBase, id: 'r1', animal_id: 'a7', tipo_manejo: 'Cadastro', data_pesagem: '2026-08-01', peso: 320, categoria_automatica: true });
await weighingService.createEntry({ ...lotBase, id: 'r2', animal_id: 'a7', tipo_manejo: 'Manejo', data_pesagem: '2026-08-21', peso: 330 });
await weighingService.createEntry({ ...lotBase, id: 'r3', animal_id: 'a7', tipo_manejo: 'Manejo', data_pesagem: '2026-08-03', peso: 322, lote_id: 'L2', nome_lote: 'Lote 02' });
assert.equal((await animal('a7')).lote_atual_id, 'L1', 'retroativo em L2 não vira lote atual');
const stays = (await db.table('animalLotes').where('animal_id').equals('a7').toArray()).filter((row) => !row.deleted_at).sort((x, y) => x.inicio.localeCompare(y.inicio));
assert.deepEqual(stays.map((row) => [row.lote_id, row.inicio, row.fim]), [['L1', '2026-08-01', '2026-08-03'], ['L2', '2026-08-03', '2026-08-21'], ['L1', '2026-08-21', null]], 'histórico reconstruído em ordem');

await deleteDbForTests();
console.log(JSON.stringify({ gate: 'category-projection:verify', ok: true, cases: ['saida-sem-peso', 'edicao-da-saida', 'peso-fora-de-faixa', 'manual-preservada', 'cenario-da-regressao'] }, null, 2));
