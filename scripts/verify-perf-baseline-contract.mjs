// F0 — contrato do gerador de massa e do bench de baseline.
// Garante: massa determinística por semente, formato compatível com o runtime,
// relatório com percentis e veredito de orçamento, e limpeza do banco ao final.
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { generateTestMass, MASS_KEYS, TEST_MASSES } from '../src/modules/perf/testMass.js';
import { BUDGETS_MS, clearMass, evaluateBudgets, percentiles, runBaseline, seedMass } from '../src/modules/perf/baselineBench.js';
import { storageRecordToViewModel } from '../src/modules/weighing/domain/weighingMapper.js';
import { parseCivilDate, isFutureCivilDate } from '../src/modules/weighing/domain/brazilianValues.js';
import storage from '../src/storage/storageAdapter.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

assert.deepEqual(MASS_KEYS, ['vazia', 'pequena', '36k', '250k']);
assert.equal(TEST_MASSES['36k'].weighings, 36_000);
assert.equal(TEST_MASSES['250k'].weighings, 250_000);

// Determinismo: mesma semente → mesma massa; semente diferente → massa diferente.
const first = generateTestMass('pequena');
const second = generateTestMass('pequena');
const other = generateTestMass('pequena', { seed: 1 });
assert.deepEqual(first.stores.pesagens.map((row) => row.id), second.stores.pesagens.map((row) => row.id), 'mesma semente deve gerar os mesmos ids');
assert.notDeepEqual(first.stores.pesagens[0].id, other.stores.pesagens[0].id, 'semente diferente deve gerar massa diferente');
assert.equal(first.summary.pesagens, 300);
assert.equal(first.summary.animais, 100);

// Formato compatível com o runtime: datas civis válidas e nunca futuras, peso > 0,
// cadastro único por animal, derivados coerentes, anonimato (sem nomes/documentos).
const byAnimal = new Map();
for (const row of first.stores.pesagens) {
  assert.ok(parseCivilDate(row.data_pesagem), 'data civil válida');
  assert.equal(isFutureCivilDate(row.data_pesagem), false, 'massa nunca gera data futura');
  assert.ok(row.peso_kg > 0);
  const view = storageRecordToViewModel(row);
  assert.equal(view.peso, row.peso_kg);
  assert.ok(['Cadastro', 'Manejo'].includes(view.tipo_manejo));
  assert.equal(row.tipo_pesagem, view.tipo_manejo);
  byAnimal.set(row.animal_id, (byAnimal.get(row.animal_id) || 0) + (view.tipo_manejo === 'Cadastro' ? 1 : 0));
  if (view.tipo_manejo === 'Manejo' && view.peso_anterior != null) {
    assert.equal(view.ganho, Number((view.peso - view.peso_anterior).toFixed(2)), 'ganho derivado pela regra do runtime');
    assert.ok(view.dias > 0);
  }
}
assert.ok([...byAnimal.values()].every((count) => count === 1), 'exatamente um Cadastro por animal');
assert.ok(first.stores.animais.every((animal) => animal.nome === null && !('documento' in animal)), 'massa anônima');
assert.ok(first.stores.pesagens.some((row) => row.legacy_payload.marca !== first.stores.pesagens[0].legacy_payload.marca), 'usa mais de uma marca');

// Percentis: definição por posição (ceil(p/100·n)).
assert.deepEqual(percentiles([5, 1, 3, 2, 4]), { n: 5, min: 1, p50: 3, p95: 5, p99: 5, max: 5, mean: 3 });
assert.equal(percentiles([]).n, 0);
assert.deepEqual(evaluateBudgets({ salvamento_local: { p95: 300 } }).salvamento_local, { status: 'fora', p95: 300, budgetP95: BUDGETS_MS.salvamento_local.p95 });

// Semeadura real: o banco fica no mesmo formato que o app lê e aceita novos lançamentos.
const seeded = await seedMass('pequena');
assert.equal(seeded.summary.pesagens, 300);
const db = await storage.ensureReady();
assert.equal(await db.table('pesagens').count(), 300);
assert.equal(await db.table('animais').count(), 100);
assert.equal(await db.table('animalIdentificadores').count(), 100);
const listed = await weighingService.listEntries({ empresaId: 'local' });
assert.equal(listed.length, 300, 'listEntries deve enxergar a massa com empresa local');
const integrity = await storage.logicalIntegrity();
assert.deepEqual(integrity.issues, [], 'a massa semeada deve passar na verificação de integridade do app');
const identities = new Set();
for (const identifier of first.stores.animalIdentificadores) {
  assert.ok(!identities.has(identifier.valor_normalizado), `identidade número::marca duplicada (${identifier.valor_normalizado})`);
  identities.add(identifier.valor_normalizado);
}
assert.ok(first.stores.animais.filter((animal) => first.stores.animais.some((other) => other.id !== animal.id && other.numero_animal === animal.numero_animal)).length > 0, 'massa deve conter números repetidos em marcas diferentes');
const animal = first.stores.animais[0];
await weighingService.createEntry({
  empresa_id: 'local', tipo_manejo: 'Manejo', status_animal: 'Ativo', data_pesagem: '2026-09-01', animal_id: animal.id,
  numero_animal: animal.numero_animal, sexo: animal.sexo, raca: animal.raca, era: animal.era, marca: animal.marca, peso: 480, origem: 'contract', operador: 'TESTE',
});
assert.equal(await db.table('pesagens').count(), 301, 'massa aceita lançamento novo pela cadeia oficial');

// Relatório do bench: percentis por métrica e veredito dos três orçamentos.
const report = await runBaseline({ massKey: 'pequena', samples: 20, saves: 3 });
for (const metric of ['carga_inicial_listEntries', 'indice_animais_rebuild', 'identificacao_para_peso', 'busca_indexada_animal', 'busca_indexada_periodo_30d', 'salvamento_local', 'recarga_apos_salvar']) {
  assert.ok(report.metrics[metric], `métrica ${metric}`);
  assert.ok(Number.isFinite(report.metrics[metric].p95), `p95 de ${metric}`);
}
assert.equal(report.metrics.identificacao_para_peso.n, 20);
assert.equal(report.metrics.salvamento_local.n, 3);
assert.deepEqual(Object.keys(report.verdict).sort(), Object.keys(BUDGETS_MS).sort());
assert.equal(report.runtime.kind, 'node');
await clearMass();
assert.equal(await (await storage.ensureReady()).table('pesagens').count(), 0, 'clearMass deixa o banco vazio');

console.log('OK verify-perf-baseline-contract');
console.log(JSON.stringify({ deterministicMass: true, runtimeCompatible: true, percentiles: true, budgets: Object.keys(BUDGETS_MS), reportMetrics: Object.keys(report.metrics).length }, null, 2));
