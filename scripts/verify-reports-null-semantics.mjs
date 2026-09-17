// Gate reports:null-semantics:verify (R2) — null ≠ 0 em todo o motor de agregação,
// nos subtotais e na formatação.
import assert from 'node:assert/strict';
import { avg, count, countDistinct, countValid, max, min, range, sum, toFiniteNumber, weightedAvg } from '../src/modules/reporting/domain/aggregateEngine.js';
import { formatCell } from '../src/modules/reporting/domain/reportFormatting.js';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { defineColumn } from '../src/modules/reporting/domain/columnDefinition.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';

// Caso da missão: 100, null, 200
const rows = [{ v: 100 }, { v: null }, { v: 200 }];
assert.deepEqual(avg(rows, 'v'), { value: 150, n_validos: 2, n_ausentes: 1, n_total: 3 }, 'AVG = 150, não 100');
assert.deepEqual(sum(rows, 'v'), { value: 300, n_validos: 2, n_ausentes: 1, n_total: 3 });
assert.equal(min(rows, 'v').value, 100, 'MIN ignora ausente (não é 0)');
assert.equal(max(rows, 'v').value, 200);
assert.equal(range(rows, 'v').value, 100);
assert.equal(countValid(rows, 'v').value, 2);
assert.equal(count(rows).value, 3, 'contagem de registros inclui o ausente');

// Todo tipo de ausente
const messy = [{ v: undefined }, { v: '' }, { v: NaN }, { v: 'abc' }, { v: '  ' }, { v: true }, { v: '10,5' }, { v: '1.000,5' }, { v: 0 }];
assert.equal(countValid(messy, 'v').value, 3, 'só 10,5 · 1.000,5 · 0 são válidos');
assert.equal(sum(messy, 'v').value, 1011, '0 conta como zero; ausentes não');
assert.equal(toFiniteNumber('  '), null);
assert.equal(toFiniteNumber(false), null, 'booleano não é número');

// Grupo sem nenhum valor válido → null (nunca 0)
const empty = [{ v: null }, { v: undefined }];
assert.equal(sum(empty, 'v').value, null);
assert.equal(avg(empty, 'v').value, null);
assert.equal(min(empty, 'v').value, null);
assert.equal(weightedAvg(empty, { value: 'v', weight: 'w' }).value, null);
assert.equal(sum([], 'v').value, null, 'população vazia → null');
assert.equal(countDistinct([{ k: null }, { k: '' }], 'k').value, 0, 'distintos ignoram chave ausente');
assert.equal(countDistinct([{ k: null }, { k: '' }], 'k').n_ausentes, 2);

// Subtotal de grupo sem valores → null e formatado "—"
const peso = defineColumn({ id: 'peso', label: 'Peso', type: 'weight', grains: [GRAINS.EVENT], aggregations: ['avg', 'sum'] });
const lote = defineColumn({ id: 'lote', label: 'Lote', type: 'text', grains: [GRAINS.EVENT], groupable: true });
const resolve = createColumnResolver([peso, lote]);
const tree = groupRows([{ lote: 'A', peso: 300 }, { lote: 'B', peso: null }, { lote: 'B', peso: undefined }], [{ columnId: 'lote' }], resolve, { aggregates: [{ columnId: 'peso', op: 'avg' }] });
const loteB = tree.nodes.find((node) => node.key === 'B');
assert.equal(loteB.aggregates['avg:peso'].value, null, 'subtotal sem valor é null');
assert.equal(formatCell(peso, loteB.aggregates['avg:peso'].value, 'screen'), '—');
assert.equal(formatCell(peso, 0, 'screen'), '0,00', 'zero real continua zero');

// Grupo "Não informado" para chave ausente, sempre por último
const withMissing = groupRows([{ lote: null, peso: 1 }, { lote: 'Z', peso: 2 }, { lote: '', peso: 3 }, { lote: 'A', peso: 4 }], [{ columnId: 'lote' }], resolve, { aggregates: [{ columnId: 'peso', op: 'sum' }] });
assert.deepEqual(withMissing.nodes.map((node) => node.label), ['A', 'Z', 'Não informado']);
assert.equal(withMissing.nodes.at(-1).aggregates['sum:peso'].value, 4, 'null e vazio caem no mesmo grupo');

console.log(JSON.stringify({ gate: 'reports:null-semantics:verify', ok: true }, null, 2));
