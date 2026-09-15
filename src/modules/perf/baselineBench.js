// Baseline de desempenho (F0 — Contratos e baseline).
// Mede p50/p95/p99 das operações que a arquitetura fixa como orçamento:
//   - busca indexada (Dexie) por animal e por período;
//   - troca identificação → peso (índice em memória + histórico + ganho/GMD);
//   - salvamento local (createEntry: validação, transação, projeções, recálculo);
//   - carga inicial da tela (listEntries completo) e reconstrução do índice;
//   - abertura simulada do Lançamento (listEntries + getRegisteredAnimals +
//     buildAnimalLookupIndex encadeados: o custo real de abrir a tela).
// A massa é semeada no esquema "v7" por padrão (cadastros mestres e ids —
// Programa 2.0); "v6" continua disponível para comparar com a F0/F1.
// O mesmo módulo roda em Node (fake-indexeddb) e no navegador (IndexedDB real)
// para que o baseline seja reproduzível em desenvolvimento e no pacote.
import storage from '../../storage/storageAdapter.js';
import { deleteDbForTests } from '../../storage/indexedDb/db.js';
import * as weighingService from '../weighing/application/weighingService.js';
import { calculateWeightGain } from '../weighing/domain/weighingCalculations.js';
import {
  buildAnimalLookupIndex,
  getAnimalHistory,
  getRegisteredAnimals,
  normalizeAnimalText,
} from '../animals/domain/animalHistory.js';
import { createRandom, DEFAULT_MASS_SCHEMA, generateTestMass, MASS_SCHEMAS, seedTestMass, TEST_MASSES } from './testMass.js';

// 2: relatório ganha `schema`, a métrica `abertura_lancamento_simulada` e o orçamento correspondente.
export const BASELINE_VERSION = 2;

// Orçamentos do documento 00-VISAO-E-PRINCIPIOS §5, 07-ROADMAP §4 (F1) e
// TARGET-PERFORMANCE-RISKS §4 / phase-00 PERFORMANCE §5 (abrir Lançamento < 1 s em 36 mil).
export const BUDGETS_MS = Object.freeze({
  busca_indexada_animal: { p95: 100 },
  identificacao_para_peso: { p95: 100 },
  salvamento_local: { p95: 250 },
  abertura_lancamento_simulada: { p95: 1000 },
});

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function percentiles(samples) {
  const sorted = [...samples].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  const n = sorted.length;
  if (!n) return { n: 0, min: null, p50: null, p95: null, p99: null, max: null, mean: null };
  const at = (p) => sorted[Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1))];
  const round = (value) => Number(value.toFixed(3));
  return {
    n,
    min: round(sorted[0]),
    p50: round(at(50)),
    p95: round(at(95)),
    p99: round(at(99)),
    max: round(sorted[n - 1]),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / n),
  };
}

async function timed(fn) {
  const started = now();
  const result = await fn();
  return { ms: now() - started, result };
}

async function series(count, fn) {
  const samples = [];
  for (let index = 0; index < count; index += 1) samples.push((await timed(() => fn(index))).ms);
  return percentiles(samples);
}

export function describeRuntime() {
  const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
  return {
    kind: isBrowser ? 'browser' : 'node',
    userAgent: isBrowser ? navigator.userAgent : `node ${globalThis.process?.version || '?'}`,
    indexedDb: isBrowser ? 'IndexedDB real (Chromium)' : 'fake-indexeddb (memória)',
    electron: isBrowser && typeof window.pesagemApp !== 'undefined',
  };
}

/** Semeia uma massa no banco atual (apaga o banco antes). `schema` padrão "v7". */
export async function seedMass(massKey, { seed, schema = DEFAULT_MASS_SCHEMA, onProgress } = {}) {
  if (!MASS_SCHEMAS.includes(schema)) throw new Error(`Esquema desconhecido: ${schema}. Use: ${MASS_SCHEMAS.join(', ')}`);
  await deleteDbForTests();
  const db = await storage.ensureReady();
  const mass = generateTestMass(massKey, { seed, schema });
  const seeding = await timed(() => seedTestMass(db, mass, { onProgress }));
  return { summary: mass.summary, seedMs: Number(seeding.ms.toFixed(1)), mass };
}

export async function clearMass() {
  await deleteDbForTests();
  await storage.ensureReady();
  return true;
}

/**
 * Executa o baseline completo para uma massa e devolve um relatório JSON.
 * `samples` controla as amostras das operações unitárias; `saves` as gravações.
 */
export async function runBaseline({ massKey = 'pequena', samples = 200, saves = 30, seed = 20260908, schema = DEFAULT_MASS_SCHEMA, log = () => {} } = {}) {
  if (!TEST_MASSES[massKey]) throw new Error(`Massa desconhecida: ${massKey}`);
  if (!MASS_SCHEMAS.includes(schema)) throw new Error(`Esquema desconhecido: ${schema}. Use: ${MASS_SCHEMAS.join(', ')}`);
  const random = createRandom(seed + 7);
  const report = {
    baselineVersion: BASELINE_VERSION,
    massKey,
    label: TEST_MASSES[massKey].label,
    seed,
    schema,
    startedAt: new Date().toISOString(),
    runtime: describeRuntime(),
    dbVersion: storage.getDbVersion(),
    dataset: null,
    seedMs: null,
    metrics: {},
    budgets: BUDGETS_MS,
    notes: [],
  };

  log(`[${massKey}] gerando e semeando massa (${schema})…`);
  const seeded = await seedMass(massKey, { seed, schema, onProgress: (p) => log(`[${massKey}] ${p.store} ${p.written}/${p.total}`) });
  report.dataset = seeded.summary;
  report.seedMs = seeded.seedMs;
  const mass = seeded.mass;
  const empresaId = mass.empresaId;
  const isBig = mass.summary.pesagens >= 100_000;
  const loadRuns = isBig ? 1 : 3;

  // 1) Carga inicial da tela: listEntries completo (acontece ao abrir e após cada salvamento).
  log(`[${massKey}] carga inicial (${loadRuns}x)…`);
  let entries = [];
  report.metrics.carga_inicial_listEntries = await series(loadRuns, async () => {
    entries = await weighingService.listEntries({ empresaId });
  });
  report.metrics.carga_inicial_listEntries.registros = entries.length;

  // 2) Reconstrução do índice de animais (useMemo após cada recarga).
  log(`[${massKey}] índice de animais…`);
  let animals = [];
  let index = { byId: new Map(), byNumber: new Map() };
  report.metrics.indice_animais_rebuild = await series(loadRuns, () => {
    animals = getRegisteredAnimals(entries);
    index = buildAnimalLookupIndex(animals);
  });
  report.metrics.indice_animais_rebuild.animais = animals.length;

  // 3) Abertura simulada do Lançamento: os três passos encadeados, como a tela faz
  //    ao montar (carga completa → animais cadastrados → índice de busca).
  log(`[${massKey}] abertura simulada do Lançamento (${loadRuns}x)…`);
  let openedEntries = 0;
  let openedAnimals = 0;
  report.metrics.abertura_lancamento_simulada = await series(loadRuns, async () => {
    const loaded = await weighingService.listEntries({ empresaId });
    const registered = getRegisteredAnimals(loaded);
    buildAnimalLookupIndex(registered);
    openedEntries = loaded.length;
    openedAnimals = registered.length;
  });
  report.metrics.abertura_lancamento_simulada.registros = openedEntries;
  report.metrics.abertura_lancamento_simulada.animais = openedAnimals;

  const activeAnimals = mass.stores.animais;
  const pickAnimal = () => activeAnimals[random.int(0, Math.max(0, activeAnimals.length - 1))];

  if (activeAnimals.length) {
    // 3) Troca identificação → peso: índice por número + histórico + ganho/GMD.
    log(`[${massKey}] identificação → peso (${samples}x)…`);
    let ambiguous = 0;
    report.metrics.identificacao_para_peso = await series(samples, () => {
      const animal = pickAnimal();
      const matches = index.byNumber.get(normalizeAnimalText(animal.numero_animal)) || [];
      if (matches.length > 1) ambiguous += 1;
      const chosen = matches.find((item) => item.animal_id === animal.id) || matches[0];
      if (!chosen) return;
      const history = getAnimalHistory(entries, chosen);
      calculateWeightGain({ history, date: '2026-09-01', weight: 400 });
    });
    report.metrics.identificacao_para_peso.ambiguos = ambiguous;

    // 4) Busca indexada Dexie por animal.
    log(`[${massKey}] busca indexada por animal (${samples}x)…`);
    report.metrics.busca_indexada_animal = await series(samples, async () => {
      await storage.weighing.listByPeriodo({ animalId: pickAnimal().id });
    });

    // 5) Busca indexada Dexie por período de 30 dias.
    const periodRuns = Math.min(20, samples);
    log(`[${massKey}] busca indexada por período (${periodRuns}x)…`);
    report.metrics.busca_indexada_periodo_30d = await series(periodRuns, async () => {
      const month = random.int(1, 12);
      const year = random.next() < 0.5 ? 2025 : 2026;
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-30`;
      await storage.weighing.listByPeriodo({ dataInicial: start, dataFinal: end });
    });

    // 6) Salvamento local: createEntry (validação, transação, projeções, recálculo da série).
    const saveRuns = isBig ? Math.min(saves, 10) : saves;
    log(`[${massKey}] salvamento local (${saveRuns}x)…`);
    const usedAnimals = new Set();
    report.metrics.salvamento_local = await series(saveRuns, async (position) => {
      let animal = pickAnimal();
      while (usedAnimals.has(animal.id)) animal = pickAnimal();
      usedAnimals.add(animal.id);
      const day = `2026-09-0${1 + (position % 7)}`;
      await weighingService.createEntry({
        empresa_id: empresaId,
        tipo_manejo: 'Manejo',
        motivo_saida: null,
        status_animal: 'Ativo',
        data_pesagem: day,
        animal_id: animal.id,
        numero_animal: animal.numero_animal,
        sexo: animal.sexo,
        raca: animal.raca,
        era: animal.era,
        marca: animal.marca,
        peso: (animal.ultimo_peso_kg || 300) + 12,
        observacao: null,
        apartacao_id: animal.apartacao_atual_id,
        lote_id: animal.lote_atual_id,
        origem: 'baseline',
        operador: 'BENCH',
      });
    });

    // 7) Fluxo real da tela após salvar: recarga completa (listEntries).
    log(`[${massKey}] recarga após salvar…`);
    report.metrics.recarga_apos_salvar = await series(loadRuns, async () => {
      entries = await weighingService.listEntries({ empresaId });
    });
    report.notes.push('recarga_apos_salvar e indice_animais_rebuild permanecem como métricas comparativas da F0; a tela atual substitui incrementalmente somente a série do animal após salvar.');
  } else {
    report.notes.push('Massa vazia: somente carga inicial e índice foram medidos.');
    report.metrics.salvamento_local_primeiro_registro = await series(1, async () => {
      await weighingService.createEntry({
        empresa_id: empresaId, tipo_manejo: 'Cadastro', status_animal: 'Ativo', data_pesagem: '2026-09-01',
        numero_animal: '1', sexo: 'M', raca: 'Nelore', era: '12', marca: 'ALFA', peso: 250, origem: 'baseline', operador: 'BENCH',
      });
    });
  }

  report.finishedAt = new Date().toISOString();
  report.verdict = evaluateBudgets(report.metrics);
  return report;
}

export function evaluateBudgets(metrics) {
  const result = {};
  for (const [metric, budget] of Object.entries(BUDGETS_MS)) {
    const measured = metrics[metric];
    if (!measured || measured.p95 == null) {
      result[metric] = { status: 'sem-medida' };
      continue;
    }
    result[metric] = { status: measured.p95 <= budget.p95 ? 'dentro' : 'fora', p95: measured.p95, budgetP95: budget.p95 };
  }
  return result;
}

export function formatReportTable(report) {
  const lines = [];
  lines.push(`Massa ${report.label} (${report.massKey}, esquema ${report.schema || 'v6'}) — ${report.runtime.kind} — ${report.runtime.indexedDb}`);
  lines.push(`Registros: ${JSON.stringify(report.dataset)} — semeadura ${report.seedMs} ms`);
  lines.push('métrica | n | p50 | p95 | p99 | max');
  for (const [name, metric] of Object.entries(report.metrics)) {
    lines.push(`${name} | ${metric.n} | ${metric.p50} | ${metric.p95} | ${metric.p99} | ${metric.max}`);
  }
  for (const [name, verdict] of Object.entries(report.verdict || {})) {
    lines.push(`orçamento ${name}: ${verdict.status}${verdict.p95 != null ? ` (p95 ${verdict.p95} ms / limite ${verdict.budgetP95} ms)` : ''}`);
  }
  return lines.join('\n');
}
