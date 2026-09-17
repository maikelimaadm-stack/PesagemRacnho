// Gate import:performance:verify (suíte full) — mede a importação conciliada com massa sintética
// de histórico: ANIMALS animais × EVENTS_PER_ANIMAL eventos (padrão 12.000 × 3 = 36.000 linhas),
// em Node + fake-indexeddb. Etapas: leitura do arquivo, análise em base vazia, gravação em lotes,
// reanálise (100% JÁ EXISTE), reimportação sem gravar e importação parcial com Manejos
// retroativos. Os tempos alimentam docs/evidence/sanity-launch-import-reconciliation/PERFORMANCE.md.
// Uso: node scripts/verify-import-performance.mjs [animais] [eventosPorAnimal]
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { deleteDbForTests } from '../src/storage/indexedDb/db.js';
import storage from '../src/storage/storageAdapter.js';
import { brandService, breedService, categoryService } from '../src/modules/catalog/application/registryServices.js';
import { ROW_STATUS, analyzeImport, applyImport, readImportFile } from '../src/modules/import/application/importService.js';

const ANIMALS = Number(process.argv[2] || 12000);
const EVENTS_PER_ANIMAL = Number(process.argv[3] || 3);
const BRANDS = ['ABC', 'XYZ', 'KLM', 'RST'];
const DAY = 86_400_000;
const BASE = Date.UTC(2025, 0, 1);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const br = (ms) => { const [y, m, d] = iso(ms).split('-'); return `${d}/${m}/${y}`; };

await deleteDbForTests();
const db = await storage.ensureReady();
for (const nome of BRANDS) await brandService.create(null, { nome });
await breedService.create(null, { nome: 'Nelore' });
await categoryService.create(null, { nome: 'Bezerro', sexo_aplicavel: 'M', peso_min_kg: 0, peso_max_kg: 199, ordem: 1 });
await categoryService.create(null, { nome: 'Garrote', sexo_aplicavel: 'M', peso_min_kg: 200, peso_max_kg: 349, ordem: 2 });
await categoryService.create(null, { nome: 'Boi', sexo_aplicavel: 'M', peso_min_kg: 350, ordem: 3 });
await categoryService.create(null, { nome: 'Bezerra', sexo_aplicavel: 'F', peso_min_kg: 0, peso_max_kg: 199, ordem: 4 });
await categoryService.create(null, { nome: 'Novilha', sexo_aplicavel: 'F', peso_min_kg: 200, ordem: 5 });

// Arquivo em ordem embaralhada por evento (a cronologia não depende da ordem das linhas).
const lines = [];
for (let event = EVENTS_PER_ANIMAL - 1; event >= 0; event -= 1) {
  for (let index = 0; index < ANIMALS; index += 1) {
    const brand = BRANDS[index % BRANDS.length];
    const numero = String(Math.floor(index / BRANDS.length) + 1);
    const start = BASE + (index % 200) * DAY;
    const peso = 160 + (index % 90) + event * 35;
    lines.push(`${numero};${brand};${index % 3 === 0 ? 'F' : 'M'};Nelore;${br(start + event * 45 * DAY)};${peso},5`);
  }
}
const text = ['Brinco;Marca;Sexo;Raça;Data;Peso', ...lines].join('\r\n');
const heap = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
const timings = {};
const time = async (label, fn) => {
  const startedAt = performance.now();
  const value = await fn();
  timings[label] = { ms: Math.round(performance.now() - startedAt), heapMb: heap() };
  console.error(`[perf] ${label}: ${timings[label].ms} ms (heap ${timings[label].heapMb} MB)`);
  return value;
};

const file = await time('readImportFile', () => readImportFile(text));
assert.equal(file.rows.length, ANIMALS * EVENTS_PER_ANIMAL);
const plan = await time('analyzeImport (base vazia)', () => analyzeImport({ text, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } }));
assert.equal(plan.blocking, false);
assert.equal(plan.summary.animaisNovos, ANIMALS);
assert.equal(plan.summary.novos, ANIMALS * EVENTS_PER_ANIMAL);
let batches = 0;
const result = await time('applyImport (200 animais por lote)', () => applyImport(plan, null, { batchAnimals: 200, onProgress: () => { batches += 1; } }));
assert.equal(result.animaisNovos, ANIMALS);
assert.equal(result.cadastrosCriados + result.manejosCriados, ANIMALS * EVENTS_PER_ANIMAL);
assert.equal(batches, Math.ceil(ANIMALS / 200));
assert.equal(await db.table('pesagens').count(), ANIMALS * EVENTS_PER_ANIMAL);
const replay = await time('analyzeImport (reimportação, 100% JÁ EXISTE)', () => analyzeImport({ text, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } }));
assert.equal(replay.summary.jaExistem, ANIMALS * EVENTS_PER_ANIMAL);
const replayResult = await time('applyImport (reimportação, sem gravar)', () => applyImport(replay));
assert.equal(replayResult.status, 'SEM_ALTERACOES');

// Parcial: um Manejo retroativo (entre o 1º e o 2º evento) para 10% dos animais.
const retroLines = [];
for (let index = 0; index < ANIMALS; index += 10) {
  const brand = BRANDS[index % BRANDS.length];
  const numero = String(Math.floor(index / BRANDS.length) + 1);
  const start = BASE + (index % 200) * DAY;
  retroLines.push(`${numero};${brand};${br(start + 20 * DAY)};${170 + (index % 90)}`);
}
const retroText = ['Brinco;Marca;Data;Peso', ...retroLines].join('\r\n');
const retroPlan = await time('analyzeImport (Manejos retroativos, 10%)', () => analyzeImport({ text: retroText, type: 'MANEJOS' }));
assert.equal(retroPlan.blocking, false);
assert.ok(retroPlan.rows.every((row) => row.status === ROW_STATUS.NOVO));
const retroResult = await time('applyImport (Manejos retroativos, 10%)', () => applyImport(retroPlan));
assert.equal(retroResult.manejosCriados, retroLines.length);
assert.equal(retroResult.seriesRecalculadas, retroLines.length, 'só as séries afetadas');

await deleteDbForTests();
console.log(JSON.stringify({
  gate: 'import:performance:verify',
  ok: true,
  massa: { animais: ANIMALS, eventosPorAnimal: EVENTS_PER_ANIMAL, linhas: ANIMALS * EVENTS_PER_ANIMAL, bytes: text.length },
  node: process.version,
  timings,
  lotes: batches,
  retroativos: { linhas: retroLines.length, eventosRecalculados: retroResult.eventosRecalculados },
}, null, 2));
