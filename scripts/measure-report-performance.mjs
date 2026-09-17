// Mede o desempenho dos relatórios em massas reproduzíveis (Node + fake-indexeddb).
// Uso: node --max-old-space-size=8192 scripts/measure-report-performance.mjs --mass=36k,250k --samples=5 --out=<pasta>
import 'fake-indexeddb/auto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runReportBenchmark } from '../src/modules/perf/reportBench.js';
import { describeRuntime } from '../src/modules/perf/baselineBench.js';

const arg = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const masses = arg('mass', '36k').split(',');
const samples = Number(arg('samples', '5'));
const outDir = arg('out', null);

const reports = [];
for (const massKey of masses) {
  const report = await runReportBenchmark({ massKey, samples: massKey === '250k' ? Math.min(samples, 3) : samples, log: (line) => console.error(`[${massKey}] ${line}`) });
  report.runtime = describeRuntime();
  report.heapPeakMB = Number((process.memoryUsage().heapUsed / 1048576).toFixed(1));
  reports.push(report);
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `report-bench-${massKey}.json`), `${JSON.stringify(report, null, 2)}\n`);
  }
}
const table = reports.flatMap((report) => Object.entries(report.results).map(([scenario, data]) => ({
  massa: report.massKey, cenario: scenario, linhas: data.rows, lidas: data.rowsRead ?? '', p50: data.phases.total.p50, p95: data.phases.total.p95,
  consulta: data.phases.query?.p95 ?? '', transf: data.phases.transform?.p95 ?? '', filtro: data.phases.filter?.p95 ?? '', grupo: data.phases.group?.p95 ?? '', agreg: data.phases.aggregate?.p95 ?? '', tela: data.phases.render?.p95 ?? '', heapMB: data.heapDeltaMB ?? '',
})));
console.log(JSON.stringify({ table, budgets: reports.map((report) => ({ massa: report.massKey, budgets: report.budgets })) }, null, 2));
