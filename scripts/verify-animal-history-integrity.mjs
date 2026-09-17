import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import 'fake-indexeddb/auto';
import { buildAnimalLookupIndex, buildDeletionPlan, canonicalProfile, findAnimalsByNumber, getAnimalHistory, getRegisteredAnimals, needsImmediateAnimalChoice } from '../src/modules/animals/domain/animalHistory.js';
import { findLatestSnProfile, isSnIdentifier, normalizeAnimalIdentifier } from '../src/modules/animals/domain/snAnimal.js';

const entries = [
  { id: 'cad-x', animal_id: 'animal-x', tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'X', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-08-01', peso: 100, status_animal: 'Ativo' },
  { id: 'man-x', animal_id: 'animal-x', tipo_manejo: 'Manejo', numero_animal: '1', marca: 'X', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-08-02', peso: 110, status_animal: 'Ativo' },
  { id: 'cad-y', animal_id: 'animal-y', tipo_manejo: 'Cadastro', numero_animal: '1', marca: 'Y', sexo: 'F', raca: 'Angus', data_pesagem: '2026-08-01', peso: 120, status_animal: 'Ativo' },
];

const choices = findAnimalsByNumber(entries, '1');
assert.equal(choices.length, 2, 'número repetido deve produzir duas identidades por marca');
assert.deepEqual(choices.map((item) => item.marca), ['X', 'Y']);
assert.equal(needsImmediateAnimalChoice(entries, '1'), true, 'número em mais de uma marca abre escolha imediatamente ao digitar');
assert.equal(needsImmediateAnimalChoice(entries, '999'), false, 'número sem conflito não abre escolha');
assert.deepEqual(getAnimalHistory(entries, entries[0]).map((item) => item.id), ['cad-x', 'man-x']);

const cascade = buildDeletionPlan(entries, ['cad-x']);
assert.deepEqual(new Set(cascade.ids), new Set(['cad-x']), 'excluir cadastro nunca deve expandir silenciosamente para o histórico');
assert.equal(cascade.cascades[0].laterEntries.length, 1);
assert.equal(cascade.cascades[0].blocked, true, 'cadastro com histórico deve bloquear exclusão');
assert.deepEqual(buildDeletionPlan(entries, ['man-x']).ids, ['man-x'], 'excluir manejo não remove cadastro');

const changed = canonicalProfile({ ...entries[0], numero_animal: '10', marca: 'Z', sexo: 'F' }, 'animal-x');
assert.deepEqual(changed, { animal_id: 'animal-x', numero_animal: '10', sexo: 'F', raca: 'Nelore', era: null, marca: 'Z' });

assert.equal(normalizeAnimalIdentifier('boi ágil 27'), 'BOI ÁGIL 27', 'identificação/nome deve ser normalizada em maiúsculas');
assert.equal(isSnIdentifier('sn'), true);
assert.equal(isSnIdentifier('SN 12'), true);
assert.equal(isSnIdentifier('SINAL'), false);
assert.deepEqual(findLatestSnProfile([
  { numero_animal: 'SN', data_pesagem: '2026-08-10', created_date: '2026-08-01T10:00:00Z', sexo: 'M', raca: 'Nelore', era: '12', marca: 'A' },
  { numero_animal: 'sn', data_pesagem: '2026-08-02', created_date: '2026-08-02T10:00:00Z', sexo: 'F', raca: 'Angus', era: '18', marca: 'B' },
]), { sexo: 'F', raca: 'Angus', era: '18', marca: 'B' }, 'SN atual deve herdar o perfil do SN anterior mais recente');

const largeEntries = [];
for (let index = 0; index < 12000; index += 1) {
  const number = String(index + 1);
  const animalId = `perf-animal-${index}`;
  largeEntries.push({ id: `perf-cad-${index}`, animal_id: animalId, tipo_manejo: 'Cadastro', numero_animal: number, marca: 'PERF', data_pesagem: '2026-01-01', peso: 200 });
  largeEntries.push({ id: `perf-man-a-${index}`, animal_id: animalId, tipo_manejo: 'Manejo', numero_animal: number, marca: 'PERF', data_pesagem: '2026-02-01', peso: 210 });
  largeEntries.push({ id: `perf-man-b-${index}`, animal_id: animalId, tipo_manejo: 'Manejo', numero_animal: number, marca: 'PERF', data_pesagem: '2026-03-01', peso: 220 });
}
const buildStartedAt = performance.now();
const largeAnimals = getRegisteredAnimals(largeEntries);
const largeIndex = buildAnimalLookupIndex(largeAnimals);
const buildDurationMs = performance.now() - buildStartedAt;
const lookupStartedAt = performance.now();
for (let index = 0; index < 5000; index += 1) {
  assert.equal(largeIndex.byNumber.get(String((index % 12000) + 1))?.length, 1);
}
const lookupDurationMs = performance.now() - lookupStartedAt;
assert.equal(largeAnimals.length, 12000);
assert.ok(buildDurationMs < 5000, `índice de 36 mil registros deve ser construído sem bloqueio quadrático (${buildDurationMs.toFixed(1)} ms)`);
assert.ok(lookupDurationMs < 250, `5 mil buscas indexadas devem ser imediatas (${lookupDurationMs.toFixed(1)} ms)`);

const launch = await readFile(new URL('../src/pages/LancamentoPesagensIndividuais.jsx', import.meta.url), 'utf8');
const relation = await readFile(new URL('../src/pages/PesagensIndividuais.jsx', import.meta.url), 'utf8');
const summaries = await readFile(new URL('../src/components/pesagens/ConfigurarResumosDialog.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(`${launch}\n${relation}`, /SelectItem\s+value=\{null\}/, 'SelectItem não pode usar valor nulo');
assert.match(launch, /tipoManejo === 'Cadastro' && <>/, 'campos cadastrais devem aparecer somente no Cadastro');
assert.match(launch, /SelecionarAnimalDialog/, 'número com várias marcas deve abrir escolha explícita');
assert.match(launch, /ConfirmarAnimalSnDialog/, 'SN deve solicitar sexo, raça, era e marca antes de salvar');
assert.match(launch, /skipSnConfirmation/, 'confirmação de SN deve continuar o salvamento sem reabrir o popup');
assert.doesNotMatch(launch, /findAnimalsByNumber\(pesagens,\s*value\)/, 'Tab na identificação não pode reconstruir todos os animais');
assert.match(launch, /animalLookupIndex\.byNumber\.get/, 'busca ao concluir a identificação deve usar índice por número');
assert.match(launch, /deleteEntriesRespectingHistory/, 'exclusão deve respeitar histórico');
assert.match(launch, /onUseDocument/, 'documentação deve poder ser aplicada pelo popup');
assert.match(launch, /onUseApartacao/, 'apartação deve poder ser aplicada pelo popup');
// Editar um lançamento tem que restaurar o registro inteiro no formulário.
// Quando a edição vinda da Relação tinha o próprio caminho, ela esquecia o tipo
// e um Cadastro reabria como Manejo, escondendo sexo/raça/era/marca; os campos
// não restaurados ainda eram gravados como null ao salvar.
assert.match(launch, /handleEditar\(pesagem\)/, 'edição vinda da Relação reutiliza a restauração completa');
for (const campo of ['setTipoManejo', 'setMotivoSaida', 'setComprador', 'setFrigorifico', 'setValorPagoCabeca', 'setEmbarqueSelecionadoDoc']) {
  assert.match(launch, new RegExp(`${campo}\\(p\\.`), `handleEditar restaura ${campo}`);
}
// A marca faz parte da identidade: precisa ser coluna visível na Relação.
assert.match(relation, /id: "marca", label: "Marca", default: true/, 'Relação mostra a coluna Marca por padrão');
assert.match(summaries, /RESUMO_GROUPS/);
assert.match(summaries, /Mover métrica para cima/);

const { deleteDbForTests } = await import('../src/storage/indexedDb/db.js');
const weighingService = await import('../src/modules/weighing/application/weighingService.js');
const historyService = await import('../src/modules/animals/application/animalHistoryService.js');
await deleteDbForTests();
const empresaId = 'empresa-history-test';
await weighingService.createEntry({ id: 'db-cad', empresa_id: empresaId, animal_id: 'db-animal', tipo_manejo: 'Cadastro', numero_animal: '7', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-08-01', peso: 200, status_animal: 'Ativo' });
await weighingService.createEntry({ id: 'db-man', empresa_id: empresaId, animal_id: 'db-animal', tipo_manejo: 'Manejo', numero_animal: '7', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-08-02', peso: 210, status_animal: 'Ativo' });
let dbEntries = await weighingService.listEntries({ empresaId });
await historyService.propagateAnimalProfile({ entries: dbEntries, registration: dbEntries.find((item) => item.id === 'db-cad'), profile: { numero_animal: '70', marca: 'B', sexo: 'F', raca: 'Angus', era: '24' } });
dbEntries = await weighingService.listEntries({ empresaId });
assert.equal(dbEntries.length, 2);
assert.ok(dbEntries.every((item) => item.numero_animal === '7' && item.marca === 'A' && item.sexo === 'M' && item.raca === 'Nelore'), 'alterar cadastro atual não deve reescrever fatos históricos');
await assert.rejects(
  historyService.deleteEntriesRespectingHistory({ entries: dbEntries, ids: ['db-cad'], empresaId }),
  /possui histórico/,
  'cadastro com histórico deve ser protegido contra exclusão em cascata',
);
assert.equal((await weighingService.listEntries({ empresaId })).length, 2);
await deleteDbForTests();

// Categoria automática pelo peso (16/09/2026): gravada no Cadastro, recalculada no
// Manejo, preservada quando escolhida à mão; a era vem da categoria de cada pesagem.
const storage = (await import('../src/storage/storageAdapter.js')).default;
const catDb = await storage.ensureReady();
const categoriaFixture = (id, nome, sexo, min, max, era, ordem) => ({ id, empresa_id: 'local', nome, nome_normalizado: nome.toUpperCase(), sexo_aplicavel: sexo, peso_min_kg: min, peso_max_kg: max, era, ordem, ativo: true, created_at: '2026-09-16T00:00:00.000Z', updated_at: '2026-09-16T00:00:00.000Z', deleted_at: null });
await catDb.table('categoriasAnimal').bulkAdd([
  categoriaFixture('cat-bezerro', 'Bezerro', 'M', 300, 350, 12, 1),
  categoriaFixture('cat-garrote', 'Garrote', 'M', 350, null, 24, 2),
  categoriaFixture('cat-novilha', 'Novilha', 'F', 250, 400, 18, 3),
  categoriaFixture('cat-touro', 'Touro', 'M', null, null, 36, 4),
]);
const animalDe = (id) => catDb.table('animais').where('id').equals(id).first();
const entradaDe = async (id) => (await weighingService.listEntries({ empresaId })).find((item) => item.id === id);

await weighingService.createEntry({ id: 'auto-cad', empresa_id: empresaId, animal_id: 'auto-animal', tipo_manejo: 'Cadastro', numero_animal: '101', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-09-01', peso: 320, categoria_automatica: true, status_animal: 'Ativo' });
let auto = await animalDe('auto-animal');
assert.equal(auto.categoria_id, 'cat-bezerro', 'Cadastro automático: macho de 320 kg entra como Bezerro');
assert.equal(auto.categoria_automatica, true);
assert.equal(auto.era, '12', 'era do animal vem da categoria');
assert.equal(auto.nascimento, null, 'nascimento não é gravado');
assert.equal((await entradaDe('auto-cad')).era, '12', 'pesagem de Cadastro grava a era da categoria');

await weighingService.createEntry({ id: 'auto-man', empresa_id: empresaId, animal_id: 'auto-animal', tipo_manejo: 'Manejo', numero_animal: '101', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-09-10', peso: 362, status_animal: 'Ativo' });
auto = await animalDe('auto-animal');
assert.equal(auto.categoria_id, 'cat-garrote', 'Manejo recalcula: passou de 350 kg → Garrote');
assert.equal(auto.era, '24');
assert.equal((await entradaDe('auto-man')).era, '24', 'pesagem de Manejo grava a era da nova categoria');
assert.equal((await entradaDe('auto-cad')).era, '12', 'histórico: a pesagem de Cadastro mantém a era do momento');

await weighingService.deleteEntry('auto-man');
auto = await animalDe('auto-animal');
assert.equal(auto.categoria_id, 'cat-bezerro', 'excluir o Manejo volta a categoria pelo peso anterior');

await weighingService.createEntry({ id: 'manual-cad', empresa_id: empresaId, animal_id: 'manual-animal', tipo_manejo: 'Cadastro', numero_animal: '102', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-09-01', peso: 500, categoria_id: 'cat-touro', categoria_automatica: false, era: '36', status_animal: 'Ativo' });
await weighingService.createEntry({ id: 'manual-man', empresa_id: empresaId, animal_id: 'manual-animal', tipo_manejo: 'Manejo', numero_animal: '102', marca: 'A', sexo: 'M', raca: 'Nelore', data_pesagem: '2026-09-10', peso: 320, status_animal: 'Ativo' });
const manual = await animalDe('manual-animal');
assert.equal(manual.categoria_id, 'cat-touro', 'NEGATIVO: categoria escolhida à mão não é recalculada pelo peso');
assert.equal(manual.categoria_automatica, false);

await weighingService.createEntry({ id: 'femea-cad', empresa_id: empresaId, animal_id: 'femea-animal', tipo_manejo: 'Cadastro', numero_animal: '103', marca: 'A', sexo: 'F', raca: 'Nelore', data_pesagem: '2026-09-01', peso: 320, categoria_automatica: true, status_animal: 'Ativo' });
assert.equal((await animalDe('femea-animal')).categoria_id, 'cat-novilha', 'fêmea de 320 kg nunca cai em categoria de macho');
await deleteDbForTests();

console.log('OK verify-animal-history-integrity');
console.log(JSON.stringify({
  duplicateNumberByBrand: true,
  immutableHistory: true,
  cascadeDeleteBlocked: true,
  historyPreserved: true,
  operationalPopupSelection: true,
  customizableGroupedSummaries: true,
  uppercaseAnimalIdentification: true,
  inheritedSnProfile: true,
  performanceDatasetRecords: largeEntries.length,
  performanceAnimals: largeAnimals.length,
  indexBuildMs: Number(buildDurationMs.toFixed(1)),
  indexedLookups: 5000,
  indexedLookupMs: Number(lookupDurationMs.toFixed(1)),
}, null, 2));
