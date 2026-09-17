// Gate reports:grand-total:verify (R2) — total geral recalculado sobre o dataset final filtrado
// (nunca soma visual dos grupos para countDistinct, média, média ponderada e razão); total é da
// população inteira, não da página visível.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const close = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);
await seedReportFixture();
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };

// Eventos agrupados por marca: total geral contra a população final.
const report = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { groups: [{ columnId: 'marca' }] } }, ADMIN);
const pesos = report.rows.map((row) => row.peso).filter((value) => typeof value === 'number');
close(report.totals.peso_medio.value, pesos.reduce((a, b) => a + b, 0) / pesos.length, 'peso médio geral = média da população');
const mediaDosGrupos = report.tree.reduce((acc, node) => acc + node.aggregates.peso_medio.value, 0) / report.tree.length;
assert.ok(Math.abs(mediaDosGrupos - report.totals.peso_medio.value) > 1e-6, 'NEGATIVO: média dos subtotais ≠ total geral');
assert.equal(report.totals.animais.value, 4);
assert.equal(report.tree.reduce((acc, node) => acc + node.rowCount, 0), report.rowCount, 'grupos particionam as linhas');
assert.equal(report.totals.registros.value, report.rowCount);
close(report.totals.gmd_ponderado.value, (30 + 15 + 10) / (20 + 20 + 10), 'GMD ponderado geral dos eventos de manejo');

// Com filtro: o total acompanha a população filtrada.
const filtrado = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { filters: { sexo: { operator: 'in', values: ['F'] } } } }, ADMIN);
assert.equal(filtrado.totals.registros.value, filtrado.rowCount);
assert.equal(filtrado.totals.animais.value, 2, 'A2 e A4');
close(filtrado.totals.peso_medio.value, (250 + 260 + 280 + 200) / 4, 'peso médio das fêmeas');

// Desempenho por lote: total geral ponderado ≠ média dos GMD dos lotes.
const lote = await runReport('desempenho.lote', { today: TODAY, params: period }, ADMIN);
close(lote.totals.gmd_ponderado.value, 75 / 71, 'geral ponderado');
assert.equal(lote.totals.animais.value, 4);
const lotes = lote.tree.flatMap((node) => node.children);
assert.ok(lotes.length >= 2, 'apartação → lote');
assert.equal(lote.tree.reduce((acc, node) => acc + node.rowCount, 0), 4);

// Paginação é de apresentação: o view model traz a população inteira.
assert.equal(report.rows.length, report.rowCount);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:grand-total:verify', ok: true }, null, 2));
