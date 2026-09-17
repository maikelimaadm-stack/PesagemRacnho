// Contrato do gerador de massa e do bench de baseline (F0 → Programa 2.0).
// Garante: massa determinística por semente nos dois esquemas ("v6" congelado
// para os testes de migração; "v7" padrão do bench, com cadastros mestres e
// ids), formato compatível com o runtime, relatório com percentis, métrica de
// abertura simulada do Lançamento, veredito de orçamento e limpeza do banco.
// Testes negativos: massa/esquema inválidos, semente diferente, identidade
// duplicada detectada, store removida (`lotes`) recusada na semeadura,
// orçamento estourado e métrica ausente.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import 'fake-indexeddb/auto';
import {
  DEFAULT_MASS_SCHEMA,
  generateTestMass,
  MASS_KEYS,
  MASS_SCHEMAS,
  normalizeRegistryName,
  seedTestMass,
  TEST_MASSES,
} from '../src/modules/perf/testMass.js';
import { BASELINE_VERSION, BUDGETS_MS, clearMass, evaluateBudgets, percentiles, runBaseline, seedMass } from '../src/modules/perf/baselineBench.js';
import { storageRecordToViewModel } from '../src/modules/weighing/domain/weighingMapper.js';
import { parseCivilDate, isFutureCivilDate } from '../src/modules/weighing/domain/brazilianValues.js';
import { ANIMAL_SITUACOES, IDENTIFICADOR_TIPOS, LOTE_SITUACOES, SESSAO_STATUS, STORE_NAMES } from '../src/storage/indexedDb/schema.js';
import { deleteDbForTests, ensureStorageReady } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { weightMatches } from '../src/modules/operations/domain/categorySuggestion.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';

// Impressão digital estrutural da massa v6 "pequena" (semente padrão): ids,
// identidades, datas e pesos. Não inclui os derivados (ganho/GMD), que
// pertencem ao domínio de pesagens, para que só uma mudança no gerador
// invalide a saída congelada usada pelos testes de migração.
const V6_PEQUENA_FINGERPRINT = 'a7eb8d305029e2bced6f05c309233a565a8213a067c2c9c1386e327c0aeb5dda';
const structuralFingerprint = (mass) => createHash('sha256').update(JSON.stringify({
  animais: mass.stores.animais.map((r) => [r.id, r.numero_animal, r.marca, r.raca, r.sexo, r.era, r.ultima_pesagem_data, r.ultimo_peso_kg, r.lote_atual_id]),
  identificadores: mass.stores.animalIdentificadores.map((r) => [r.id, r.animal_id, r.tipo, r.valor_normalizado]),
  sessoes: mass.stores.sessoesPesagem.map((r) => [r.id, r.data, r.status]),
  lotes: mass.stores.loteApartacoes.map((r) => [r.id, r.apartacao_id, r.nome_lote, r.fechado ?? r.situacao]),
  pesagens: mass.stores.pesagens.map((r) => [r.id, r.animal_id, r.sessao_id, r.data_pesagem, r.peso_kg, r.lote_id, r.tipo_pesagem, r.created_at]),
  animalLotes: mass.stores.animalLotes.map((r) => [r.id, r.animal_id, r.lote_id, r.inicio, r.fim]),
})).digest('hex');

// Unicidade v7 (ADR-020): identificador VISUAL ativo é único por (marca_id, valor_normalizado).
function duplicateVisualIdentities(identifiers) {
  const owners = new Map();
  const duplicates = [];
  for (const row of identifiers) {
    if (row.tipo !== 'VISUAL' || row.ativo === false || row.deleted_at) continue;
    const key = `${row.marca_id}::${row.valor_normalizado}`;
    const owner = owners.get(key);
    if (owner && owner !== row.animal_id) duplicates.push(key);
    else owners.set(key, row.animal_id);
  }
  return duplicates;
}

const ids = (rows) => new Set(rows.map((row) => row.id));
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));

// ---------------------------------------------------------------------------
// Catálogo e testes negativos de entrada.
// ---------------------------------------------------------------------------
assert.deepEqual(MASS_KEYS, ['vazia', 'pequena', '36k', '250k']);
assert.equal(TEST_MASSES['36k'].weighings, 36_000);
assert.equal(TEST_MASSES['250k'].weighings, 250_000);
assert.deepEqual([...MASS_SCHEMAS], ['v6', 'v7']);
assert.equal(DEFAULT_MASS_SCHEMA, 'v7', 'o bench usa o esquema v7 por padrão');
assert.throws(() => generateTestMass('gigante'), /Massa desconhecida/, 'massa inválida deve falhar');
assert.throws(() => generateTestMass('pequena', { schema: 'v8' }), /Esquema desconhecido/, 'esquema inválido deve falhar');
await assert.rejects(seedMass('pequena', { schema: 'v5' }), /Esquema desconhecido/, 'seedMass recusa esquema inválido');
await assert.rejects(runBaseline({ massKey: 'pequena', schema: 'v9' }), /Esquema desconhecido/, 'runBaseline recusa esquema inválido');

// ---------------------------------------------------------------------------
// Esquema v6: saída congelada (formato 1.1.17) para os testes de migração.
// ---------------------------------------------------------------------------
const v6 = generateTestMass('pequena', { schema: 'v6' });
assert.equal(v6.schema, 'v6');
assert.deepEqual(
  Object.keys(v6.stores),
  ['apartacoes', 'loteApartacoes', 'animais', 'animalIdentificadores', 'sessoesPesagem', 'animalLotes', 'pesagens'],
  'v6 não tem cadastros mestres nem a store lotes',
);
assert.equal(structuralFingerprint(v6), V6_PEQUENA_FINGERPRINT, 'a saída v6 é congelada: qualquer mudança quebra os testes de migração');
assert.equal(structuralFingerprint(generateTestMass('pequena', { schema: 'v6' })), V6_PEQUENA_FINGERPRINT, 'mesma semente → mesma massa');
assert.notEqual(structuralFingerprint(generateTestMass('pequena', { schema: 'v6', seed: 1 })), V6_PEQUENA_FINGERPRINT, 'semente diferente → massa diferente');
assert.ok(v6.stores.animalIdentificadores.every((row) => row.tipo === 'visual_marca' && row.valor_normalizado.includes('::') && !('marca_id' in row)), 'identificador v6 = NÚMERO::MARCA');
assert.ok(v6.stores.animais.every((row) => row.situacao === 'Ativo' && !('marca_id' in row)), 'animal v6 sem ids de cadastro');
assert.ok(v6.stores.sessoesPesagem.every((row) => row.status === 'Aberta'), 'sessão v6 "Aberta"');
assert.ok(v6.stores.loteApartacoes.every((row) => row.fechado === false && !('situacao' in row)), 'lote v6 com `fechado`');
assert.ok(v6.stores.pesagens.every((row) => 'status_animal' in row.legacy_payload && 'created_date' in row.legacy_payload), 'payload v6 mantém as chaves que o backfill B10 remove');
const v6Identities = new Set();
for (const identifier of v6.stores.animalIdentificadores) {
  assert.ok(!v6Identities.has(identifier.valor_normalizado), `identidade número::marca duplicada (${identifier.valor_normalizado})`);
  v6Identities.add(identifier.valor_normalizado);
}

// ---------------------------------------------------------------------------
// Esquema v7 (padrão): determinismo, cadastros mestres, ids, enums, payload.
// ---------------------------------------------------------------------------
const first = generateTestMass('pequena');
const second = generateTestMass('pequena');
const other = generateTestMass('pequena', { seed: 1 });
assert.equal(first.schema, 'v7');
assert.deepEqual(first.stores.pesagens.map((row) => row.id), second.stores.pesagens.map((row) => row.id), 'mesma semente deve gerar os mesmos ids');
assert.deepEqual(first.stores.marcas.map((row) => row.id), second.stores.marcas.map((row) => row.id), 'ids dos cadastros mestres também são determinísticos');
assert.notEqual(first.stores.pesagens[0].id, other.stores.pesagens[0].id, 'semente diferente deve gerar massa diferente');
assert.notEqual(first.stores.marcas[0].id, other.stores.marcas[0].id, 'semente diferente muda os ids dos cadastros');
assert.equal(first.summary.pesagens, 300);
assert.equal(first.summary.animais, 100);
assert.deepEqual(
  { marcas: first.summary.marcas, racas: first.summary.racas, categorias: first.summary.categorias, parceiros: first.summary.parceiros, propriedades: first.summary.propriedades, causasMorte: first.summary.causasMorte },
  { marcas: 5, racas: 5, categorias: 7, parceiros: 3, propriedades: 2, causasMorte: 4 },
);
// Os dois esquemas compartilham os ids operacionais: a massa v6 migrada e a v7 nativa são comparáveis.
for (const store of ['apartacoes', 'loteApartacoes', 'animais', 'animalIdentificadores', 'sessoesPesagem', 'animalLotes', 'pesagens']) {
  assert.deepEqual(first.stores[store].map((row) => row.id), v6.stores[store].map((row) => row.id), `${store}: mesma semente → mesmos ids nos dois esquemas`);
}
assert.ok(!('lotes' in first.stores), 'sem a store lotes (ADR-023)');
assert.ok(Object.keys(first.stores).every((name) => STORE_NAMES.includes(name)), 'todas as stores da massa existem no esquema vigente');

// Cadastros mestres (ADR-018): gerados das listas BRANDS/BREEDS, normalizados e únicos.
assert.deepEqual(first.stores.marcas.map((row) => row.nome), ['ALFA', 'BETA', 'GAMA', 'DELTA', 'OMEGA']);
assert.deepEqual(first.stores.racas.map((row) => row.nome), ['Nelore', 'Angus', 'Brangus', 'Guzerá', 'Tabapuã']);
assert.deepEqual(first.stores.categoriasAnimal.map((row) => row.nome), ['Bezerro', 'Bezerra', 'Garrote', 'Novilha', 'Boi', 'Vaca', 'Touro']);
for (const name of ['marcas', 'racas', 'categoriasAnimal', 'parceiros', 'propriedades', 'causasMorte']) {
  const normalized = new Set();
  for (const row of first.stores[name]) {
    assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, `${name}: id UUID v4`);
    assert.equal(row.empresa_id, 'local');
    assert.equal(row.ativo, true);
    assert.equal(row.deleted_at, null);
    assert.equal(row.nome_normalizado, normalizeRegistryName(row.nome), `${name}: nome_normalizado pela regra do contrato`);
    assert.ok(!normalized.has(row.nome_normalizado), `${name}: nome_normalizado duplicado (${row.nome_normalizado})`);
    normalized.add(row.nome_normalizado);
  }
}
assert.equal(normalizeRegistryName('  guzerá   do  campo '), 'GUZERÁ DO CAMPO', 'trim + maiúsculas pt-BR + espaços únicos');
assert.equal(first.stores.marcas.filter((row) => row.padrao).length, 1, 'uma marca padrão');
assert.equal(first.stores.racas.find((row) => row.padrao)?.nome, 'Nelore', 'raça padrão Nelore');
assert.ok(first.stores.parceiros.every((row) => row.documento === null && row.rendimento_padrao === null), 'parceiros anônimos e sem rendimento assumido (ADR-025)');
assert.equal(first.stores.propriedades.filter((row) => row.tipo === 'PROPRIA' && row.padrao).length, 1, 'uma propriedade própria padrão');

// Animais v7: ids que resolvem nos cadastros, situação em maiúsculas, legado em texto preservado.
const marcaById = byId(first.stores.marcas);
const racaById = byId(first.stores.racas);
const categoriaById = byId(first.stores.categoriasAnimal);
const propriedadeIds = ids(first.stores.propriedades);
for (const animal of first.stores.animais) {
  assert.equal(animal.situacao, 'ATIVO');
  assert.ok(ANIMAL_SITUACOES.includes(animal.situacao));
  assert.equal(marcaById.get(animal.marca_id)?.nome, animal.marca, 'marca_id aponta para a marca do texto legado');
  assert.equal(racaById.get(animal.raca_id)?.nome, animal.raca, 'raca_id aponta para a raça do texto legado');
  const categoria = categoriaById.get(animal.categoria_id);
  assert.ok(categoria, 'categoria_id resolve');
  assert.equal(categoria.sexo_aplicavel, animal.sexo, 'categoria do mesmo sexo do animal');
  assert.ok(weightMatches(categoria, animal.ultimo_peso_kg), 'categoria automática contém o último peso');
  assert.equal(animal.categoria_automatica, true);
  assert.equal(animal.era, String(categoria.era), 'era do animal é a da categoria');
  assert.ok(propriedadeIds.has(animal.propriedade_id), 'propriedade_id resolve');
  assert.equal(animal.nascimento, null, 'nascimento não é usado');
  assert.equal(animal.nascimento_estimado, false);
  assert.equal(animal.nome, null);
  assert.ok(!('documento' in animal), 'massa anônima');
}

// Identificadores v7 (ADR-020): tipo VISUAL, só o número em valor_normalizado, marca em marca_id.
const animalById = byId(first.stores.animais);
for (const identifier of first.stores.animalIdentificadores) {
  assert.equal(identifier.tipo, 'VISUAL');
  assert.ok(IDENTIFICADOR_TIPOS.includes(identifier.tipo));
  assert.equal(identifier.valor_normalizado, String(identifier.valor).trim().toUpperCase(), 'valor_normalizado = só o número normalizado');
  assert.ok(!identifier.valor_normalizado.includes('::'), 'sem sufixo ::MARCA');
  const animal = animalById.get(identifier.animal_id);
  assert.ok(animal, 'identificador aponta para um animal da massa');
  assert.equal(identifier.marca_id, animal.marca_id, 'marca_id do identificador = marca_id do animal');
  assert.equal(identifier.marca, animal.marca, 'texto legado da marca preservado');
  assert.ok(identifier.inicio && !identifier.fim && identifier.ativo === true, 'identificador vigente com início');
}
assert.deepEqual(duplicateVisualIdentities(first.stores.animalIdentificadores), [], 'identidade (marca_id, número) única');
const numbersInSeveralBrands = first.stores.animais.filter((animal) =>
  first.stores.animais.some((candidate) => candidate.id !== animal.id && candidate.numero_animal === animal.numero_animal && candidate.marca_id !== animal.marca_id));
assert.ok(numbersInSeveralBrands.length > 0, 'massa deve conter números repetidos em marcas diferentes');
// Negativo: uma duplicidade injetada (mesma marca e número em outro animal) é detectada.
const injected = { ...first.stores.animalIdentificadores[0], id: 'dup-injetada', animal_id: 'outro-animal' };
assert.equal(duplicateVisualIdentities([...first.stores.animalIdentificadores, injected]).length, 1, 'teste negativo: duplicidade de identidade é detectada');
assert.equal(duplicateVisualIdentities([...first.stores.animalIdentificadores, { ...injected, ativo: false }]).length, 0, 'identificador inativo não conta');

// Sessões, lotes e apartações v7: enums em maiúsculas (ADR-023/ADR-030).
assert.ok(first.stores.sessoesPesagem.every((row) => row.status === 'ABERTA' && SESSAO_STATUS.includes(row.status) && row.local === null), 'sessões ABERTA com local nulo');
assert.ok(first.stores.loteApartacoes.every((row) => row.situacao === 'ABERTO' && LOTE_SITUACOES.includes(row.situacao) && row.ativo === true && !('fechado' in row) && !('nome_apartacao' in row)), 'lotes ABERTO, sem `fechado` e sem nome_apartacao desnormalizado');
assert.ok(first.stores.apartacoes.every((row) => row.ativo === true && Number.isInteger(row.ordem)), 'apartações com ativo/ordem');

// Payload v7: histórico em texto preservado; chaves proibidas pela ADR-027 ausentes.
const FORBIDDEN_PAYLOAD_KEYS = ['_localId', 'peso_kg', 'created_date', 'updated_date', 'status_animal', 'sanidade_ids', 'sanidades'];
for (const row of first.stores.pesagens) {
  const payload = row.legacy_payload;
  assert.ok(typeof payload.marca === 'string' && typeof payload.raca === 'string', 'snapshot mantém marca/raça em texto (histórico)');
  for (const key of FORBIDDEN_PAYLOAD_KEYS) assert.ok(!(key in payload), `payload v7 não pode conter ${key}`);
}
assert.ok(first.stores.pesagens.some((row) => row.legacy_payload.marca !== first.stores.pesagens[0].legacy_payload.marca), 'usa mais de uma marca');

// Formato compatível com o runtime: datas civis válidas e nunca futuras, peso > 0,
// cadastro único por animal, derivados coerentes.
const registrationsByAnimal = new Map();
for (const row of first.stores.pesagens) {
  assert.ok(parseCivilDate(row.data_pesagem), 'data civil válida');
  assert.equal(isFutureCivilDate(row.data_pesagem), false, 'massa nunca gera data futura');
  assert.ok(row.peso_kg > 0);
  const view = storageRecordToViewModel(row);
  assert.equal(view.peso, row.peso_kg);
  assert.ok(['Cadastro', 'Manejo'].includes(view.tipo_manejo));
  assert.equal(row.tipo_pesagem, view.tipo_manejo);
  assert.equal(view.created_date, row.created_at, 'sem created_date no payload, o mapper cai para created_at');
  registrationsByAnimal.set(row.animal_id, (registrationsByAnimal.get(row.animal_id) || 0) + (view.tipo_manejo === 'Cadastro' ? 1 : 0));
  if (view.tipo_manejo === 'Manejo' && view.peso_anterior != null) {
    assert.equal(view.ganho, Number((view.peso - view.peso_anterior).toFixed(2)), 'ganho derivado pela regra do runtime');
    assert.ok(view.dias > 0);
  }
}
assert.ok([...registrationsByAnimal.values()].every((count) => count === 1), 'exatamente um Cadastro por animal');

// Massa vazia v7: só cadastros e estrutura de lotes.
const empty = generateTestMass('vazia');
assert.equal(empty.summary.pesagens, 0);
assert.equal(empty.summary.marcas, 5);

// ---------------------------------------------------------------------------
// Percentis e orçamentos (inclui o orçamento novo de abertura do Lançamento).
// ---------------------------------------------------------------------------
assert.deepEqual(percentiles([5, 1, 3, 2, 4]), { n: 5, min: 1, p50: 3, p95: 5, p99: 5, max: 5, mean: 3 });
assert.equal(percentiles([]).n, 0);
assert.deepEqual(BUDGETS_MS.abertura_lancamento_simulada, { p95: 1000 }, 'abrir Lançamento < 1 s (TARGET-PERFORMANCE-RISKS §4)');
assert.deepEqual(evaluateBudgets({ salvamento_local: { p95: 300 } }).salvamento_local, { status: 'fora', p95: 300, budgetP95: BUDGETS_MS.salvamento_local.p95 });
assert.equal(evaluateBudgets({ abertura_lancamento_simulada: { p95: 1000.1 } }).abertura_lancamento_simulada.status, 'fora', 'teste negativo: abertura acima de 1 s estoura');
assert.equal(evaluateBudgets({ abertura_lancamento_simulada: { p95: 999 } }).abertura_lancamento_simulada.status, 'dentro');
assert.equal(evaluateBudgets({}).abertura_lancamento_simulada.status, 'sem-medida', 'métrica ausente não passa como dentro');

// ---------------------------------------------------------------------------
// Semeadura v7 (padrão): banco no formato que o app lê, índices v7 e novos lançamentos.
// ---------------------------------------------------------------------------
const seeded = await seedMass('pequena');
assert.equal(seeded.mass.schema, 'v7');
assert.equal(seeded.summary.pesagens, 300);
const db = await storage.ensureReady();
for (const [name, expected] of Object.entries({ pesagens: 300, animais: 100, animalIdentificadores: 100, sessoesPesagem: 201, loteApartacoes: 9, apartacoes: 3, marcas: 5, racas: 5, categoriasAnimal: 7, parceiros: 3, propriedades: 2, causasMorte: 4 })) {
  assert.equal(await db.table(name).count(), expected, `${name} semeada`);
}
const sampleAnimal = first.stores.animais.find((animal) => numbersInSeveralBrands.includes(animal));
assert.equal(await db.table('animalIdentificadores').where('[marca_id+valor_normalizado]').equals([sampleAnimal.marca_id, sampleAnimal.identificacao_normalizada]).count(), 1, 'índice composto v7 resolve número + marca para um único animal');
assert.ok(await db.table('animalIdentificadores').where('[tipo+valor_normalizado]').equals(['VISUAL', sampleAnimal.identificacao_normalizada]).count() > 1, 'o mesmo número existe em outra marca (índice por tipo não é único)');
assert.equal(await db.table('animais').where('marca_id').equals(sampleAnimal.marca_id).count(), 20, 'índice marca_id de animais responde');
const listed = await weighingService.listEntries({ empresaId: 'local' });
assert.equal(listed.length, 300, 'listEntries deve enxergar a massa com empresa local');
const integrity = await storage.logicalIntegrity();
// O diagnóstico de integridade ainda agrupa identificadores por tipo+valor_normalizado
// (regra v6); na v7 a unicidade do VISUAL é por (marca_id, valor_normalizado) e foi
// provada acima. Qualquer outro problema (órfãos, datas, ids) continua bloqueando.
const identifierRuleV6 = /identificação ativa duplicada/;
assert.deepEqual(integrity.issues.filter((issue) => !identifierRuleV6.test(issue)), [], 'a massa v7 semeada não gera órfãos, ids duplicados nem datas inválidas');
const animal = first.stores.animais[0];
await weighingService.createEntry({
  empresa_id: 'local', tipo_manejo: 'Manejo', status_animal: 'Ativo', data_pesagem: '2026-09-01', animal_id: animal.id,
  numero_animal: animal.numero_animal, sexo: animal.sexo, raca: animal.raca, era: animal.era, marca: animal.marca, peso: 480, origem: 'contract', operador: 'TESTE',
});
assert.equal(await db.table('pesagens').count(), 301, 'massa v7 aceita lançamento novo pela cadeia oficial');
// Negativo: a massa não pode carregar a store `lotes` (removida na v7); a semeadura falha.
await assert.rejects(seedTestMass(db, { stores: { lotes: [{ id: 'lote-legado' }] } }), /lotes/, 'teste negativo: store removida é recusada na semeadura');

// ---------------------------------------------------------------------------
// Semeadura v6 explícita: formato legado íntegro para o bench comparativo e a migração.
// ---------------------------------------------------------------------------
const seededV6 = await seedMass('pequena', { schema: 'v6' });
assert.equal(seededV6.mass.schema, 'v6');
const dbV6 = await ensureStorageReady();
assert.equal(await dbV6.table('marcas').count(), 0, 'v6 não semeia cadastros mestres');
assert.equal(await dbV6.table('animalIdentificadores').where('tipo').equals('visual_marca').count(), 100);
assert.equal((await weighingService.listEntries({ empresaId: 'local' })).length, 300);
assert.deepEqual((await storage.logicalIntegrity()).issues, [], 'a massa v6 semeada passa na verificação de integridade do app');

// ---------------------------------------------------------------------------
// Relatório do bench: percentis por métrica, métrica de abertura e veredito dos orçamentos.
// ---------------------------------------------------------------------------
const report = await runBaseline({ massKey: 'pequena', samples: 20, saves: 3 });
assert.equal(BASELINE_VERSION, 2);
assert.equal(report.baselineVersion, 2, 'shape novo do relatório = baselineVersion 2');
assert.equal(report.schema, 'v7');
assert.equal(report.dataset.marcas, 5);
for (const metric of ['carga_inicial_listEntries', 'indice_animais_rebuild', 'abertura_lancamento_simulada', 'identificacao_para_peso', 'busca_indexada_animal', 'busca_indexada_periodo_30d', 'salvamento_local', 'recarga_apos_salvar']) {
  assert.ok(report.metrics[metric], `métrica ${metric}`);
  assert.ok(Number.isFinite(report.metrics[metric].p95), `p95 de ${metric}`);
}
assert.equal(report.metrics.abertura_lancamento_simulada.n, 3, 'abertura simulada mede as mesmas rodadas da carga inicial');
assert.equal(report.metrics.abertura_lancamento_simulada.registros, 300);
assert.equal(report.metrics.abertura_lancamento_simulada.animais, 100);
assert.ok(report.metrics.abertura_lancamento_simulada.min >= report.metrics.carga_inicial_listEntries.min * 0.5, 'abertura encadeia a carga inicial (não pode ser desprezível)');
assert.equal(report.metrics.identificacao_para_peso.n, 20);
assert.equal(report.metrics.salvamento_local.n, 3);
assert.deepEqual(Object.keys(report.verdict).sort(), Object.keys(BUDGETS_MS).sort());
assert.ok(['dentro', 'fora'].includes(report.verdict.abertura_lancamento_simulada.status), 'veredito da abertura é medido');
assert.equal(report.runtime.kind, 'node');

const reportV6 = await runBaseline({ massKey: 'pequena', samples: 5, saves: 2, schema: 'v6' });
assert.equal(reportV6.schema, 'v6', 'o bench continua rodando com a massa v6');
assert.equal(reportV6.metrics.abertura_lancamento_simulada.registros, 300);
assert.equal(reportV6.dataset.marcas, undefined);

const reportEmpty = await runBaseline({ massKey: 'vazia', samples: 5, saves: 2 });
assert.equal(reportEmpty.metrics.abertura_lancamento_simulada.registros, 0, 'massa vazia também mede a abertura');
assert.equal(reportEmpty.dataset.marcas, 5);

await clearMass();
assert.equal(await (await storage.ensureReady()).table('pesagens').count(), 0, 'clearMass deixa o banco vazio');
assert.equal(await (await storage.ensureReady()).table('marcas').count(), 0);
await deleteDbForTests();

console.log('OK verify-perf-baseline-contract');
console.log(JSON.stringify({
  schemas: [...MASS_SCHEMAS],
  defaultSchema: DEFAULT_MASS_SCHEMA,
  v6Frozen: true,
  v7MasterRegistry: true,
  sharedIdsAcrossSchemas: true,
  deterministicMass: true,
  runtimeCompatible: true,
  negativeTests: ['massa inválida', 'esquema inválido', 'semente diferente', 'identidade duplicada', 'store lotes recusada', 'orçamento estourado', 'métrica ausente'],
  percentiles: true,
  baselineVersion: BASELINE_VERSION,
  budgets: Object.keys(BUDGETS_MS),
  reportMetrics: Object.keys(report.metrics).length,
  integrityIssuesPendingHealthV7: integrity.issues.length,
}, null, 2));
