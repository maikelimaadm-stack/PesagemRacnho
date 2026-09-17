// Benchmark dos relatórios (programa reporting R5). Roda em Node (fake-indexeddb) e no navegador/
// Electron (IndexedDB real). Mede cada fase separadamente — consulta, transformação, filtro,
// ordenação, agrupamento, agregação, preparação de tela e exportação — sem esconder custo num número só.
import { percentiles, seedMass } from './baselineBench.js';
import storage from '../../storage/storageAdapter.js';
import { runReport } from '../reporting/application/reportService.js';
import { prepareEmission } from '../reporting/application/reportExportService.js';
import { flattenTree } from '../reporting/domain/groupEngine.js';
import { buildReportLines } from '../reporting/infrastructure/exporters/reportLayout.js';
import { addDays } from '../reporting/domain/reportPeriod.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const heap = () => (typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage().heapUsed : null);
const BENCH_ACTOR = Object.freeze({ id: 'bench', nome: 'Benchmark', role: 'ADMIN' });

export const REPORT_BENCH_BUDGETS_MS = Object.freeze({
  // Orçamentos p95 da massa 36k (Node + fake-indexeddb, mais lento que o IndexedDB real do app).
  '36k': {
    pesagens_30d: 1500,
    pesagens_365d: 6000,
    inventario_atual: 3000,
    desempenho_por_animal_365d: 7000,
    agrupamento_1_nivel_365d: 6500,
    agrupamento_3_niveis_365d: 7000,
    csv_365d: 2500,
    view_model_365d_sem_consulta: 1500,
  },
});

async function latestDate(db) {
  const last = await db.table('pesagens').orderBy('data_pesagem').last();
  return last?.data_pesagem ?? '2026-09-15';
}

const SCENARIOS = [
  { id: 'pesagens_30d', report: 'pesagens.periodo', days: 30 },
  { id: 'pesagens_365d', report: 'pesagens.periodo', days: 365 },
  { id: 'inventario_atual', report: 'rebanho.inventario', days: null },
  { id: 'desempenho_por_animal_365d', report: 'desempenho.individual', days: 365 },
  { id: 'agrupamento_1_nivel_365d', report: 'pesagens.periodo', days: 365, groups: [{ columnId: 'marca' }] },
  { id: 'agrupamento_3_niveis_365d', report: 'pesagens.periodo', days: 365, groups: [{ columnId: 'marca' }, { columnId: 'sexo' }, { columnId: 'nome_lote' }] },
];

function summarize(samples) {
  const keys = Object.keys(samples[0] || {});
  return Object.fromEntries(keys.map((key) => [key, percentiles(samples.map((sample) => sample[key]))]));
}

/**
 * @param {{ massKey: '36k'|'250k'|'pequena', samples?: number, seedMassFirst?: boolean, log?: Function }} options
 */
export async function runReportBenchmark({ massKey = '36k', samples = 5, seedMassFirst = true, log = () => {} } = {}) {
  let seed = null;
  if (seedMassFirst) {
    log(`semeando massa ${massKey}…`);
    const seeded = await seedMass(massKey);
    seed = { summary: seeded.summary, seedMs: seeded.seedMs };
  }
  const db = await storage.ensureReady();
  const today = await latestDate(db);
  const totalWeighings = await db.table('pesagens').count();
  const results = {};
  let lastYear = null;

  for (const scenario of SCENARIOS) {
    const runs = [];
    let rows = 0;
    let rowsRead = 0;
    let heapDelta = null;
    for (let index = 0; index < samples; index += 1) {
      const heapBefore = heap();
      const startedAt = now();
      const vm = await runReport(scenario.report, {
        today,
        params: scenario.days ? { periodo: { preset: 'personalizado', from: addDays(today, -(scenario.days - 1)), to: today } } : {},
        selection: scenario.groups ? { groups: scenario.groups } : {},
      }, BENCH_ACTOR);
      const totalMs = now() - startedAt;
      // Preparação de tela: árvore achatada + formatação da 1ª página (100 linhas), como a ReportTable.
      const renderStart = now();
      const lines = vm.tree.length ? flattenTree(vm.tree) : vm.rows.map((row) => ({ kind: 'DATA', row }));
      const page = { ...vm, rows: lines.filter((line) => line.kind === 'DATA').slice(0, 100).map((line) => line.row), tree: [] };
      buildReportLines(page, 'screen');
      const renderMs = now() - renderStart;
      const heapAfter = heap();
      if (heapBefore !== null && heapAfter !== null) heapDelta = heapAfter - heapBefore;
      rows = vm.rowCount;
      rowsRead = vm.stats.rowsRead;
      const t = vm.stats.timings;
      runs.push({ total: totalMs, query: t.query ?? 0, transform: t.transform ?? 0, filter: t.filter, sort: t.sort, group: t.group, aggregate: t.aggregate, render: renderMs });
      if (scenario.id === 'pesagens_365d') lastYear = vm;
    }
    results[scenario.id] = { report: scenario.report, rows, rowsRead, strategy: lastYear && scenario.id === 'pesagens_365d' ? lastYear.stats.strategy : undefined, heapDeltaMB: heapDelta === null ? null : Number((heapDelta / 1048576).toFixed(1)), phases: summarize(runs) };
    log(`${scenario.id}: p95 ${results[scenario.id].phases.total.p95} ms (${rows} linhas)`);
  }

  // Exportação CSV e geração do view model (sem consulta) sobre o resultado de 365 dias.
  const csvRuns = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = now();
    const { content } = await prepareEmission(lastYear, 'csv', BENCH_ACTOR);
    csvRuns.push({ total: now() - startedAt, bytes: content.length });
  }
  results.csv_365d = { rows: lastYear.rowCount, bytes: csvRuns[0].bytes, phases: { total: percentiles(csvRuns.map((run) => run.total)) } };
  results.view_model_365d_sem_consulta = {
    rows: lastYear.rowCount,
    phases: { total: percentiles(Object.values(results.pesagens_365d.phases.total ? [results.pesagens_365d] : []).map(() => 0)) },
  };
  const vmOnly = results.pesagens_365d.phases;
  results.view_model_365d_sem_consulta.phases.total = {
    ...vmOnly.total,
    p50: Number(((vmOnly.filter.p50 ?? 0) + (vmOnly.sort.p50 ?? 0) + (vmOnly.group.p50 ?? 0) + (vmOnly.aggregate.p50 ?? 0)).toFixed(3)),
    p95: Number(((vmOnly.filter.p95 ?? 0) + (vmOnly.sort.p95 ?? 0) + (vmOnly.group.p95 ?? 0) + (vmOnly.aggregate.p95 ?? 0)).toFixed(3)),
  };

  const budgets = REPORT_BENCH_BUDGETS_MS[massKey] || null;
  const budgetResults = budgets ? Object.fromEntries(Object.entries(budgets).map(([key, limit]) => [key, { p95: results[key]?.phases.total.p95 ?? null, limit, ok: (results[key]?.phases.total.p95 ?? Infinity) <= limit }])) : null;
  return { massKey, totalWeighings, today, samples, seed, results, budgets: budgetResults, generatedAt: new Date().toISOString() };
}
