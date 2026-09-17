// Gate reports:columns:verify (R1) — ColumnDefinition única, agregações válidas por tipo e
// formatação canônica (tela/CSV/XLSX/JSON) com ausente ≠ 0.
import assert from 'node:assert/strict';
import { COLUMN_TYPES, allowedAggregations, defineColumn, displayOf, filterTypeOfColumnType, groupKeyOf, valueOf } from '../src/modules/reporting/domain/columnDefinition.js';
import { formatCell, headerLabel, roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { EVENT_COLUMNS, RELATION_COLUMN_IDS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { sortRows, compareValues } from '../src/modules/reporting/domain/sortEngine.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';

const E = [GRAINS.EVENT];
assert.deepEqual([...COLUMN_TYPES].sort(), ['boolean', 'date', 'datetime', 'entity', 'enum', 'gmd', 'identifier', 'integer', 'money', 'number', 'percentage', 'text', 'weight'].sort(), 'tipos mínimos do contrato');

// Negativos de definição
assert.throws(() => defineColumn({ label: 'x', type: 'text', grains: E }), /id obrigatório/);
assert.throws(() => defineColumn({ id: 'x', label: 'x', type: 'moeda', grains: E }), /tipo inválido/);
assert.throws(() => defineColumn({ id: 'x', label: 'x', type: 'text' }), /grains obrigatório/);
assert.throws(() => defineColumn({ id: 'x', label: 'x', type: 'text', grains: ['DIA'] }), /grão inválido/);
assert.throws(() => defineColumn({ id: 'x', label: 'x', type: 'entity', grains: E, accessor: (r) => r.id }), /display/);
assert.throws(() => defineColumn({ id: 'x', label: 'x', type: 'enum', grains: E }), /options/);
assert.throws(() => defineColumn({ id: 'nome', label: 'Nome', type: 'text', grains: E, aggregations: ['sum'] }), /sum não é válida/, 'texto não oferece SUM');
assert.throws(() => defineColumn({ id: 'data', label: 'Data', type: 'date', grains: E, aggregations: ['avg'] }), /avg não é válida/, 'data não oferece AVG');
assert.throws(() => defineColumn({ id: 'gmd', label: 'GMD', type: 'gmd', grains: E, aggregations: ['weightedGmd'] }), /weightedGmd não é válida/, 'GMD ponderado exige declarar ganho/dias');
assert.throws(() => defineColumn({ id: 'p', label: 'P', type: 'percentage', grains: E, aggregations: ['sum'] }), /sum não é válida/, 'percentual não soma');
assert.throws(() => defineColumn({ id: 'peso', label: 'Peso', type: 'weight', grains: E, groupable: true }), /agrupar/, 'número não agrupa');
assert.throws(() => defineColumn({ id: 'x', label: 'x', type: 'text', grains: E, sensitive: 'secreto' }), /sensibilidade/);

// Positivos: agregações por tipo
const gmd = defineColumn({ id: 'gmd', label: 'GMD', type: 'gmd', grains: E, weighted: { gain: 'ganho', days: 'dias' } });
assert.ok(allowedAggregations(gmd).includes('weightedGmd') && !allowedAggregations(gmd).includes('sum'), 'GMD: ponderado sim, soma não');
assert.ok(Object.isFrozen(gmd) && Object.isFrozen(gmd.aggregations));
const nome = defineColumn({ id: 'nome', label: 'Nome', type: 'text', grains: E });
assert.deepEqual(allowedAggregations(nome), ['count', 'countDistinct']);
assert.deepEqual(allowedAggregations(defineColumn({ id: 'd', label: 'D', type: 'date', grains: E })), ['count', 'countValid', 'min', 'max']);
assert.equal(filterTypeOfColumnType('money'), 'number');
assert.equal(filterTypeOfColumnType('datetime'), 'date');
assert.equal(filterTypeOfColumnType('identifier'), 'text');

// Entidade: valor = id, exibição = nome, grupo = id
const categoria = EVENT_COLUMNS.find((column) => column.id === 'categoria');
const row = { categoria_id: 'c1', categoria_nome: 'Garrote', marca: 'Álfa', marca_id: null, marca_nome: null };
assert.equal(valueOf(categoria, row), 'c1');
assert.equal(displayOf(categoria, row), 'Garrote');
assert.equal(groupKeyOf(categoria, row), 'c1');
const marca = EVENT_COLUMNS.find((column) => column.id === 'marca');
assert.equal(groupKeyOf(marca, { marca: 'ALFA', marca_id: 'm1' }), 'm1', 'marca agrupa pelo id');
assert.equal(groupKeyOf(marca, { marca: 'Álfa', marca_id: null }), groupKeyOf(marca, { marca: 'alfa', marca_id: null }), 'sem id: texto normalizado');

// Todas as colunas da Relação existem e valores comerciais são sensíveis
const ids = new Set(EVENT_COLUMNS.map((column) => column.id));
for (const id of RELATION_COLUMN_IDS) assert.ok(ids.has(id), `coluna da Relação definida: ${id}`);
for (const id of ['valor_pago_cabeca', 'valor_venda_total', 'valor_arroba', 'quantidade_arrobas', 'valor_total_abate']) {
  assert.equal(EVENT_COLUMNS.find((column) => column.id === id).sensitive, 'commercial', `${id} sensível`);
}

// Formatação canônica
const W = { type: 'weight' }; const M = { type: 'money' }; const G = { type: 'gmd' }; const P = { type: 'percentage' }; const I = { type: 'integer' };
assert.equal(formatCell(W, 1234.5, 'screen'), '1.234,50');
assert.equal(formatCell(W, null, 'screen'), '—', 'ausente na tela é travessão, nunca 0');
assert.equal(formatCell(W, null, 'csv'), '');
assert.equal(formatCell(W, null, 'xlsx'), null);
assert.equal(formatCell(W, null, 'json'), null);
assert.equal(formatCell(W, 0, 'screen'), '0,00', 'zero continua zero');
assert.equal(formatCell(W, 1234.5, 'csv'), '1234,50', 'CSV pt-BR sem milhar');
assert.equal(formatCell(W, 1234.567, 'xlsx'), 1234.57, 'XLSX número de verdade');
assert.equal(formatCell(W, 1234.567, 'json'), 1234.567, 'JSON valor canônico sem arredondar');
assert.equal(formatCell(M, 3000, 'screen').replace(/\s/g, ' '), 'R$ 3.000,00');
assert.equal(formatCell(G, 0.75, 'screen'), '0,750');
assert.equal(formatCell(P, 52.5, 'screen'), '52,50 %');
assert.equal(formatCell(I, 20, 'csv'), '20');
assert.equal(formatCell({ type: 'date' }, '2026-09-05', 'screen'), '05/09/2026');
assert.equal(formatCell({ type: 'date' }, '2026-09-05', 'json'), '2026-09-05');
assert.equal(formatCell({ type: 'datetime' }, '2026-09-05T13:45:00Z', 'print'), '05/09/2026 13:45');
assert.equal(formatCell({ type: 'boolean' }, true, 'csv'), 'Sim');
assert.equal(formatCell({ type: 'enum', options: [{ value: 'M', label: 'Macho' }] }, 'M', 'screen'), 'Macho');
assert.equal(roundTo(1.005, 2), 1.01, 'arredondamento sem erro binário');
assert.equal(headerLabel({ label: 'Peso', unit: 'kg' }), 'Peso (kg)');

// Ordenação: ausentes por último nas duas direções; número como número; texto pt-BR numérico
assert.equal(compareValues(null, 5, 'number', 'asc') > 0, true);
assert.equal(compareValues(null, 5, 'number', 'desc') > 0, true, 'ausente por último também em desc');
assert.equal(compareValues('10', '9', 'number', 'asc') > 0, true);
assert.equal(compareValues('lote 10', 'Lote 2', 'text', 'asc') > 0, true, 'collator numérico');
const resolve = createColumnResolver(EVENT_COLUMNS);
const sorted = sortRows([{ id: 'a', peso: null }, { id: 'b', peso: 300 }, { id: 'c', peso: 250 }, { id: 'd', peso: 300 }], [{ columnId: 'peso', direction: 'desc' }], resolve);
assert.deepEqual(sorted.map((item) => item.id), ['b', 'd', 'c', 'a'], 'estável e ausente por último');

console.log(JSON.stringify({ gate: 'reports:columns:verify', ok: true, eventColumns: EVENT_COLUMNS.length }, null, 2));
