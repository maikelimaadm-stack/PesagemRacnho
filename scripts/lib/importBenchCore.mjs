// Núcleo da importação conciliada com massa sintética (R2-05), igual no Node (fake-indexeddb) e no Electron real
// (IndexedDB do Chromium). ANIMALS × EVENTS_PER_ANIMAL eventos; etapas: leitura do arquivo, análise em base vazia,
// gravação em lotes, reanálise (100% JÁ EXISTE), reimportação sem gravar e importação parcial com Manejos
// retroativos. As conferências (contagens, deduplicação, idempotência, só séries afetadas) valem em qualquer massa:
// com massa pequena é o teste de CORREÇÃO do test:full; com 12.000 × 3 é a medição de CAPACIDADE.
import { deleteDbForTests } from '../../src/storage/indexedDb/db.js';
import storage from '../../src/storage/storageAdapter.js';
import { brandService, breedService, categoryService } from '../../src/modules/catalog/application/registryServices.js';
import { ROW_STATUS, analyzeImport, applyImport, readImportFile } from '../../src/modules/import/application/importService.js';
import { conferirConteudoRestaurado } from '../../src/storage/indexedDb/backup/contentIntegrity.js';

const agora = () => (globalThis.performance ? globalThis.performance.now() : Date.now());
function check(cond, msg = 'conferência falhou') { if (!cond) throw new Error(`import-bench: ${msg}`); }
function igual(a, b, msg) { check(a === b, `${msg || 'valor'}: esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); }

export async function runImportBench(ANIMALS = 12000, EVENTS_PER_ANIMAL = 3, { log = () => {} } = {}) {
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const BRANDS = ['ABC', 'XYZ', 'KLM', 'RST'];
  const DAY = 86_400_000;
  const BASE = Date.UTC(2025, 0, 1);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const br = (ms) => { const [y, m, d] = iso(ms).split('-'); return `${d}/${m}/${y}`; };

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
  const heap = () => { try { if (typeof process !== 'undefined' && process.memoryUsage) return Math.round(process.memoryUsage().heapUsed / 1024 / 1024); if (globalThis.performance?.memory) return Math.round(globalThis.performance.memory.usedJSHeapSize / 1024 / 1024); } catch { /* sem medida */ } return null; };
  const timings = {};
  const time = async (label, fn) => {
    const startedAt = agora();
    const value = await fn();
    timings[label] = { ms: Math.round(agora() - startedAt), heapMb: heap() };
    log(`[perf] ${label}: ${timings[label].ms} ms${timings[label].heapMb == null ? '' : ` (heap ${timings[label].heapMb} MB)`}`);
    return value;
  };

  const file = await time('readImportFile', () => readImportFile(text));
  igual(file.rows.length, ANIMALS * EVENTS_PER_ANIMAL);
  const plan = await time('analyzeImport (base vazia)', () => analyzeImport({ text, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } }));
  igual(plan.blocking, false);
  igual(plan.summary.animaisNovos, ANIMALS);
  igual(plan.summary.novos, ANIMALS * EVENTS_PER_ANIMAL);
  let batches = 0;
  const result = await time('applyImport (200 animais por lote)', () => applyImport(plan, null, { batchAnimals: 200, onProgress: () => { batches += 1; } }));
  igual(result.animaisNovos, ANIMALS);
  igual(result.cadastrosCriados + result.manejosCriados, ANIMALS * EVENTS_PER_ANIMAL);
  igual(batches, Math.ceil(ANIMALS / 200));
  igual(await db.table('pesagens').count(), ANIMALS * EVENTS_PER_ANIMAL);
  const replay = await time('analyzeImport (reimportação, 100% JÁ EXISTE)', () => analyzeImport({ text, type: 'HISTORICO', rules: { categoryMode: 'AUTOMATICA' } }));
  igual(replay.summary.jaExistem, ANIMALS * EVENTS_PER_ANIMAL);
  const replayResult = await time('applyImport (reimportação, sem gravar)', () => applyImport(replay));
  igual(replayResult.status, 'SEM_ALTERACOES');

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
  igual(retroPlan.blocking, false);
  check(retroPlan.rows.every((row) => row.status === ROW_STATUS.NOVO));
  const retroResult = await time('applyImport (Manejos retroativos, 10%)', () => applyImport(retroPlan));
  igual(retroResult.manejosCriados, retroLines.length);
  igual(retroResult.seriesRecalculadas, retroLines.length, 'só as séries afetadas');

  // R3-02: custo da conferência de conteúdo pós-restauração na mesma massa (o "backup" é o retrato das stores).
  const retrato = await time('retrato das stores (equivale ao backup lido)', async () => {
    const stores = {};
    for (const table of db.tables) stores[table.name] = await table.toArray();
    return stores;
  });
  const conferencia = await time('conferirConteudoRestaurado (R3-02)', () => conferirConteudoRestaurado(db, retrato));
  check(conferencia.ok, `conferência de conteúdo divergiu: ${JSON.stringify(conferencia.divergencias.slice(0, 3))}`);
  log(`[perf] conferência por store: ${Object.entries(conferencia.impressoes).filter(([, v]) => v.registros).map(([k, v]) => `${k}=${v.registros}/${v.ms}ms${JSON.stringify(v.etapas)}`).join(' ')}`);
  igual(conferencia.impressoes.pesagens.conferidos, ANIMALS * EVENTS_PER_ANIMAL + retroLines.length, 'pesagens conferidas');

  await deleteDbForTests();
  return {
    ok: true,
    massa: { animais: ANIMALS, eventosPorAnimal: EVENTS_PER_ANIMAL, linhas: ANIMALS * EVENTS_PER_ANIMAL, bytes: text.length },
    timings,
    lotes: batches,
    retroativos: { linhas: retroLines.length, eventosRecalculados: retroResult.eventosRecalculados },
  };
}
