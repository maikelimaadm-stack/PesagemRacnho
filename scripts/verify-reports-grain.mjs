// Gate reports:grain:verify — todo relatório declara um grão; colunas só existem nos seus grãos;
// um animal com várias pesagens = N linhas em EVENT e 1 linha em ANIMAL_CURRENT/ANIMAL_PERIOD;
// animais únicos nunca são contagem de eventos.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { listReportDefinitions, getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { columnSupportsGrain, GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { runReport, resolveSelection } from '../src/modules/reporting/application/reportService.js';

for (const definition of listReportDefinitions()) {
  for (const column of definition.columns) assert.ok(columnSupportsGrain(column, definition.grain), `${definition.id}: ${column.id} pertence ao grão ${definition.grain}`);
}

await seedReportFixture();
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const events = await runReport('pesagens.periodo', { today: TODAY, params: period }, ADMIN);
assert.equal(events.grain, GRAINS.EVENT);
assert.equal(events.rows.filter((row) => row.animal_id === 'A1').length, 3, 'EVENT: A1 aparece 3 vezes');
assert.equal(events.rowCount, 9, 'EVENT: 9 pesagens');
assert.equal(events.uniqueAnimalCount, 4, 'animais únicos = 4, não 9');
assert.equal(events.totals.animais.value, 4);
assert.equal(events.totals.registros.value, 9);

const grainResults = { EVENT: { rows: events.rowCount, animals: events.uniqueAnimalCount } };
for (const [id, grain] of [['rebanho.inventario', GRAINS.ANIMAL_CURRENT], ['desempenho.individual', GRAINS.ANIMAL_PERIOD]]) {
  const definition = getReportDefinition(id);
  if (!definition) continue; // entra no R2
  const result = await runReport(id, { today: TODAY, params: period }, ADMIN);
  assert.equal(result.grain, grain);
  const ids = result.rows.map((row) => row.animal_id);
  assert.equal(new Set(ids).size, ids.length, `${grain}: um animal por linha`);
  grainResults[grain] = { rows: result.rowCount, animals: result.uniqueAnimalCount };
}

// NEGATIVO: seleção não aceita coluna fora da definição (de outro grão).
assert.throws(() => resolveSelection(getReportDefinition('pesagens.periodo'), { columns: ['dias_sem_pesagem'] }, 'ADMIN'), /coluna desconhecida/);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:grain:verify', ok: true, grainResults }, null, 2));
