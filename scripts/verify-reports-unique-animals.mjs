// Gate reports:unique-animals:verify (R2) — animais únicos = countDistinct(animal); eventos
// nunca viram animais; o pai recalcula contra a própria população (não soma filhos).
import assert from 'node:assert/strict';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const resolve = createColumnResolver(EVENT_COLUMNS);
const AGG = [{ id: 'registros', op: 'count' }, { id: 'animais', columnId: 'numero_animal', op: 'countDistinct' }];

// Caso da missão: A com 3 eventos, B com 2 → 5 eventos, 2 animais.
const events = [
  { id: 1, animal_id: 'A', numero_animal: '1', nome_lote: 'L1', lote_id: 'L1', nome_apartacao: 'Engorda', apartacao_id: 'ap' },
  { id: 2, animal_id: 'A', numero_animal: '1', nome_lote: 'L1', lote_id: 'L1', nome_apartacao: 'Engorda', apartacao_id: 'ap' },
  { id: 3, animal_id: 'A', numero_animal: '1', nome_lote: 'L2', lote_id: 'L2', nome_apartacao: 'Engorda', apartacao_id: 'ap' }, // A mudou de lote
  { id: 4, animal_id: 'B', numero_animal: '2', nome_lote: 'L2', lote_id: 'L2', nome_apartacao: 'Engorda', apartacao_id: 'ap' },
  { id: 5, animal_id: 'B', numero_animal: '2', nome_lote: 'L2', lote_id: 'L2', nome_apartacao: 'Engorda', apartacao_id: 'ap' },
];
const tree = groupRows(events, [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], resolve, { aggregates: AGG });
const engorda = tree.nodes[0];
assert.equal(engorda.aggregates.registros.value, 5, 'eventos = 5');
assert.equal(engorda.aggregates.animais.value, 2, 'animais únicos = 2 (não 5)');
const [l1, l2] = engorda.children;
assert.equal(l1.aggregates.animais.value, 1, 'L1: A');
assert.equal(l2.aggregates.animais.value, 2, 'L2: A e B');
const somaDosFilhos = l1.aggregates.animais.value + l2.aggregates.animais.value;
assert.equal(somaDosFilhos, 3, 'soma ingênua dos filhos daria 3');
assert.notEqual(engorda.aggregates.animais.value, somaDosFilhos, 'NEGATIVO: pai não é soma dos filhos');

// Legado sem animal_id: número + marca identificam o animal (e não o evento).
const legacy = [{ id: 'x', numero_animal: '7', marca: 'Álfa' }, { id: 'y', numero_animal: '7', marca: 'ALFA' }, { id: 'z', numero_animal: '7', marca: 'BETA' }];
assert.equal(groupRows(legacy, [{ columnId: 'tipo_manejo' }], resolve, { aggregates: AGG }).nodes[0].aggregates.animais.value, 2, 'legado: 7/ALFA e 7/BETA');

// Relatório na massa: 9 eventos, 4 animais; por tipo o total geral não é soma.
await seedReportFixture();
const report = await runReport('pesagens.periodo', { today: TODAY, params: { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } }, selection: { groups: [{ columnId: 'tipo_manejo' }] } }, ADMIN);
assert.equal(report.totals.registros.value, 9);
assert.equal(report.totals.animais.value, 4);
assert.equal(report.uniqueAnimalCount, 4);
const porTipo = Object.fromEntries(report.tree.map((node) => [node.label, node.aggregates.animais.value]));
assert.deepEqual(porTipo, { Cadastro: 4, Manejo: 2, 'Saída': 2 });
assert.equal(Object.values(porTipo).reduce((a, b) => a + b, 0), 8, 'soma por tipo = 8 ≠ 4');

// Inventário (ANIMAL_CURRENT): uma linha por animal; ativos = A1 e A4.
const inventario = await runReport('rebanho.inventario', { today: TODAY }, ADMIN);
assert.deepEqual(inventario.rows.map((row) => row.animal_id).sort(), ['A1', 'A4'], 'padrão: só ativos');
assert.equal(inventario.totals.animais.value, 2);
const todos = await runReport('rebanho.inventario', { today: TODAY, selection: { filters: {} } }, ADMIN);
assert.equal(todos.rowCount, 4, 'sem filtro: todos os animais, um por linha');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:unique-animals:verify', ok: true, porTipo }, null, 2));
