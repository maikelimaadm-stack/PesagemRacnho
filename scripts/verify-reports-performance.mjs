// Gate reports:performance:verify (R5) — massa 36 mil (Node + fake-indexeddb): cada cenário dentro
// do orçamento p95 de REPORT_BENCH_BUDGETS_MS, relatórios de período lendo pelo índice (não a base
// inteira), fases medidas separadamente. Pesado: fica no test:full, não no test:quick.
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { runReportBenchmark } from '../src/modules/perf/reportBench.js';

const report = await runReportBenchmark({ massKey: '36k', samples: 2, log: (line) => console.error(`[36k] ${line}`) });
const { results, budgets, totalWeighings } = report;
assert.ok(totalWeighings >= 36_000, 'massa de 36 mil');

for (const [scenario, budget] of Object.entries(budgets)) {
  assert.ok(budget.ok, `${scenario}: p95 ${budget.p95} ms > orçamento ${budget.limit} ms`);
}
// Período de 30 dias lê pelo índice: muito menos linhas que a base
assert.ok(results.pesagens_30d.rowsRead < totalWeighings / 4, `30 dias leu ${results.pesagens_30d.rowsRead} de ${totalWeighings}`);
assert.ok(results.pesagens_30d.rowsRead <= results.pesagens_365d.rowsRead, 'janela menor lê menos');
// Estado atual não relê pesagens
assert.ok(results.inventario_atual.rowsRead <= 20_000, 'inventário lê a projeção de animais');
// Fases separadas presentes
for (const phase of ['query', 'transform', 'filter', 'sort', 'group', 'aggregate', 'render']) {
  assert.ok(results.pesagens_365d.phases[phase], `fase ${phase} medida`);
}
console.log(JSON.stringify({ gate: 'reports:performance:verify', ok: true, budgets }, null, 2));
