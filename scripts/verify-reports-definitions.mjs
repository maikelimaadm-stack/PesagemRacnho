// Gate reports:definitions:verify (R1+) — catálogo válido, permissões genéricas, todo relatório
// disponível executa na massa de referência; defineReport recusa definições incoerentes.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { listAllReportDefinitions as listReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { defineReport, REPORT_FAMILIES } from '../src/modules/reporting/domain/reportDefinition.js';
import { defineColumn } from '../src/modules/reporting/domain/columnDefinition.js';
import { GRAINS, GRAIN_LIST } from '../src/modules/reporting/domain/reportGrain.js';
import { ACTIONS } from '../src/modules/auth/domain/permissionService.js';
import { listReportSourceIds } from '../src/modules/reporting/infrastructure/reportSources/index.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const definitions = listReportDefinitions();
assert.ok(definitions.length >= 3, 'catálogo com relatórios');
assert.equal(new Set(definitions.map((d) => d.id)).size, definitions.length, 'ids únicos');
const genericActions = new Set(ACTIONS);
for (const definition of definitions) {
  assert.ok(REPORT_FAMILIES[definition.family], `${definition.id}: família`);
  assert.ok(GRAIN_LIST.includes(definition.grain), `${definition.id}: grão`);
  assert.ok(definition.requires.includes('reports.read'), `${definition.id}: reports.read`);
  for (const action of definition.requires) assert.ok(genericActions.has(action), `${definition.id}: permissão genérica existente (${action})`);
  assert.ok(Object.isFrozen(definition), `${definition.id}: congelada`);
  if (definition.status !== 'blocked') assert.ok(listReportSourceIds().includes(definition.source), `${definition.id}: fonte registrada (${definition.source})`);
  else assert.ok(definition.blockedReason, `${definition.id}: bloqueado com motivo`);
}
assert.ok(!ACTIONS.some((action) => /^reports\.[a-z]+\.[a-z]+\.[a-z]+/.test(action) || /^report\./.test(action)), 'NEGATIVO: nenhuma permissão por relatório');

// Todo relatório disponível executa (ADMIN) na massa de referência.
await seedReportFixture();
const executed = [];
for (const definition of definitions.filter((d) => d.status !== 'blocked')) {
  const result = await runReport(definition.id, { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } } }, ADMIN);
  assert.equal(result.reportId, definition.id);
  assert.equal(result.grain, definition.grain);
  assert.ok(Array.isArray(result.rows) && result.rowCount === result.rows.length, `${definition.id}: linhas`);
  assert.ok(result.emissionId && result.generatedAt && result.emittedBy.role === 'ADMIN', `${definition.id}: identificação da emissão`);
  executed.push({ id: definition.id, rows: result.rowCount, groups: result.groups.length });
}
await resetDb();

// Negativos
const col = defineColumn({ id: 'x', label: 'X', type: 'text', grains: [GRAINS.EVENT], groupable: true });
const animalCol = defineColumn({ id: 'y', label: 'Y', type: 'text', grains: [GRAINS.ANIMAL_CURRENT] });
const valid = { id: 't', title: 'T', family: 'pesagens', grain: GRAINS.EVENT, version: 1, source: 'events.byPeriod', requires: ['reports.read'], columns: [col], params: [{ id: 'periodo', type: 'period', required: true }] };
assert.ok(defineReport(valid));
assert.throws(() => defineReport({ ...valid, requires: ['weighing.read'] }), /reports\.read/);
assert.throws(() => defineReport({ ...valid, family: 'bi' }), /família/);
assert.throws(() => defineReport({ ...valid, grain: 'DIA' }), /grão inválido/);
assert.throws(() => defineReport({ ...valid, version: 0 }), /version/);
assert.throws(() => defineReport({ ...valid, columns: [col, animalCol] }), /não existe no grão EVENT/, 'coluna de outro grão');
assert.throws(() => defineReport({ ...valid, defaultColumns: ['z'] }), /desconhecida/);
assert.throws(() => defineReport({ ...valid, defaultGroups: [{ columnId: 'x' }, { columnId: 'x' }, { columnId: 'x' }, { columnId: 'x' }] }), /no máximo 3/);
assert.throws(() => defineReport({ ...valid, defaultAggregates: [{ columnId: 'x', op: 'sum' }] }), /inválida/);
assert.throws(() => defineReport({ ...valid, params: [] }), /período obrigatório/, 'EVENT sem período');
assert.throws(() => defineReport({ ...valid, params: [{ id: 'q', type: 'sql' }] }), /parâmetro inválido/);

console.log(JSON.stringify({ gate: 'reports:definitions:verify', ok: true, definitions: definitions.length, executed }, null, 2));
