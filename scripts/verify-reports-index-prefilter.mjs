// Gate reports:index-prefilter:verify (R1) — relatório de EVENT com período usa o índice
// data_pesagem (lê só as linhas do período) e dá o mesmo resultado da varredura completa.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { lastEventQuery, loadEventRows } from '../src/modules/reporting/infrastructure/reportSources/eventSource.js';
import { relationPopulation } from '../src/modules/reporting/application/relationPopulation.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const { db } = await seedReportFixture();
// Ruído fora do período: 300 pesagens em 2025 inseridas direto na store.
const noise = Array.from({ length: 300 }, (_, index) => ({
  id: `ruido-${index}`, data_pesagem: `2025-0${1 + (index % 9)}-${String(1 + (index % 28)).padStart(2, '0')}`, peso_kg: 200 + index, animal_id: `R${index}`, tipo_pesagem: 'Manejo',
  legacy_payload: { empresa_id: 'local', tipo_manejo: 'Manejo', numero_animal: `R${index}`, peso: 200 + index }, created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z', deleted_at: null,
}));
await db.table('pesagens').bulkAdd(noise);
const total = await db.table('pesagens').count();

const report = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-09-01', to: '2026-09-15' } } }, ADMIN);
const query = lastEventQuery();
assert.equal(query.strategy, 'index:data_pesagem', 'consulta indexada');
const inPeriod = (await db.table('pesagens').toArray()).filter((row) => row.data_pesagem >= '2026-09-01' && row.data_pesagem <= '2026-09-15').length;
assert.equal(query.rowsRead, inPeriod, 'lê só as linhas do período');
assert.ok(query.rowsRead < total / 10, `NEGATIVO de varredura: leu ${query.rowsRead} de ${total}`);

// Mesmo resultado da varredura completa + filtro de data em memória.
const full = await loadEventRows({ empresaId: 'local' });
assert.equal(full.strategy, 'full-scan');
const reference = relationPopulation(full.rows, { filtrosColuna: { data_pesagem: { operator: 'between', value: '2026-09-01', valueTo: '2026-09-15' } }, sortConfig: { key: 'data_pesagem', direction: 'asc' } });
assert.deepEqual(new Set(report.rows.map((row) => row.id)), new Set(reference.map((row) => row.id)), 'índice = varredura');
assert.equal(report.rowCount, 4, 'e3, e6, e8, e9');

// Registro excluído e duplicado de id não aparecem duas vezes.
const alvo = await db.table('pesagens').where('id').equals('e3').first();
await db.table('pesagens').add({ ...alvo, localId: undefined, deleted_at: null, observacao: 'versão nova' });
const again = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-09-01', to: '2026-09-15' } } }, ADMIN);
assert.equal(again.rows.filter((row) => row.id === 'e3').length, 1, 'dois registros ativos com o mesmo id → uma linha');
assert.equal(again.rows.find((row) => row.id === 'e3').observacao, 'versão nova', 'vale o registro mais recente (maior localId)');
assert.equal(again.rowCount, 4, 'duplicata não infla a contagem');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:index-prefilter:verify', ok: true, totalRows: total, rowsRead: query.rowsRead, rowsOut: report.rowCount }, null, 2));
