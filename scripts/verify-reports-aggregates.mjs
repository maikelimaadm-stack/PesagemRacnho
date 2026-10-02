// Gate reports:aggregates:verify (R2) — operações canônicas sum/avg/min/max/range/count/
// countDistinct/weightedAvg/ratio; especificações validadas contra a coluna; datas min/max.
import assert from 'node:assert/strict';
import { AGGREGATION_OPS, aggregate, aggregateAll, avg, count, countDistinct, max, min, range, ratio, sum, weightedAvg } from '../src/modules/reporting/domain/aggregateEngine.js';
import { computeAggregate, computeAggregates } from '../src/modules/reporting/domain/reportAggregates.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { annotateGmdQuality } from '../src/modules/reporting/domain/gmdColumns.js';

assert.deepEqual([...AGGREGATION_OPS].sort(), ['avg', 'count', 'countDistinct', 'countValid', 'max', 'min', 'range', 'ratio', 'sum', 'weightedAvg'].sort());
const rows = [{ v: 2, w: 1, k: 'a' }, { v: 4, w: 3, k: 'b' }, { v: 9, w: 0, k: 'a' }, { v: null, w: 2, k: null }];
assert.equal(sum(rows, 'v').value, 15);
assert.equal(avg(rows, 'v').value, 5);
assert.equal(min(rows, 'v').value, 2);
assert.equal(max(rows, 'v').value, 9);
assert.equal(range(rows, 'v').value, 7);
assert.equal(count(rows).value, 4);
assert.equal(countDistinct(rows, 'k').value, 2);
assert.equal(weightedAvg(rows, { value: 'v', weight: 'w' }).value, (2 * 1 + 4 * 3) / 4, 'peso 0 e valor ausente não entram');
assert.equal(ratio(rows, { numerator: 'v', denominator: 'w' }).value, (2 + 4) / 4, 'razão de somas (pares com denominador > 0)');
assert.equal(aggregate(rows, { op: 'sum', field: 'v' }).value, 15, 'especificação serializável');
assert.equal(aggregate(rows, { op: 'sum', accessor: (row) => (row.v ?? 0) * 2 }).value, 30, 'accessor');
assert.deepEqual(Object.keys(aggregateAll(rows, [{ op: 'count' }, { id: 'x', op: 'max', field: 'v' }])), ['count:', 'x']);
assert.throws(() => aggregate(rows, { op: 'median', field: 'v' }), /desconhecida/);
assert.throws(() => sum(rows), /obrigatório/);
// Grandes números sem estouro de precisão típica
assert.equal(sum([{ v: 0.1 }, { v: 0.2 }], 'v').value.toFixed(10), '0.3000000000');

// Especificações contra colunas
const resolve = createColumnResolver(EVENT_COLUMNS);
const events = [
  { id: 1, peso: 300, data_pesagem: '2026-08-01', ganho: 10, dias: 10, gmd: 1, valor_arroba: 300, quantidade_arrobas: 10, animal_id: 'A' },
  { id: 2, peso: 320, data_pesagem: '2026-09-05', ganho: 40, dias: 20, gmd: 2, valor_arroba: 310, quantidade_arrobas: 30, animal_id: 'B' },
  { id: 3, peso: null, data_pesagem: '2026-08-20', ganho: null, dias: null, gmd: null, valor_arroba: null, quantidade_arrobas: null, animal_id: 'A' },
];
assert.equal(computeAggregate(events, { columnId: 'data_pesagem', op: 'min' }, resolve).value, '2026-08-01', 'data mínima como data');
assert.equal(computeAggregate(events, { columnId: 'data_pesagem', op: 'max' }, resolve).value, '2026-09-05');
assert.equal(computeAggregate(events, { columnId: 'valor_arroba', op: 'weightedAvg' }, resolve).value, (300 * 10 + 310 * 30) / 40, 'preço/@ ponderado pelas arrobas');
// M1: estas linhas não trazem a qualidade gravada pela fonte — o motor classifica com o mínimo padrão (21 dias): os
// intervalos de 10 e 20 dias ficam FORA de toda conta de GMD (n_total continua a população; ausentes = os de fora).
const semQualidade = computeAggregate(events, { columnId: 'gmd', op: 'weightedGmd' }, resolve);
assert.deepEqual([semQualidade.value, semQualidade.n_validos, semQualidade.n_total], [null, 0, 3], 'M1: intervalo curto (< 21 dias) não entra no GMD ponderado');
// Com a qualidade derivada pela fonte com o mínimo 7 (Configurações › Relatórios), os dois intervalos entram.
annotateGmdQuality(events, EVENT_COLUMNS, 7);
assert.deepEqual(events.map((row) => row.gmd_qualidade), ['CONFIAVEL', 'CONFIAVEL', 'SEM_GMD'], 'mínimo 7: 10 e 20 dias confiáveis; sem anterior = SEM_GMD');
assert.equal(computeAggregate(events, { columnId: 'gmd', op: 'weightedGmd' }, resolve).value, 50 / 30);
assert.equal(computeAggregate(events, { columnId: 'numero_animal', op: 'countDistinct' }, resolve).value, 2);
assert.equal(computeAggregate(events, { op: 'count' }, resolve).value, 3);
assert.throws(() => computeAggregate(events, { columnId: 'observacao', op: 'sum' }, resolve), /não é permitida/, 'texto não soma');
assert.throws(() => computeAggregate(events, { columnId: 'data_pesagem', op: 'avg' }, resolve), /não é permitida/, 'data não tem média');
assert.throws(() => computeAggregate(events, { columnId: 'peso', op: 'weightedGmd' }, resolve), /não é permitida/, 'GMD ponderado só na coluna GMD');
assert.throws(() => computeAggregate(events, { columnId: 'inexistente', op: 'sum' }, resolve), /desconhecida/);
const all = computeAggregates(events, [{ id: 'p', columnId: 'peso', op: 'avg' }, { columnId: 'peso', op: 'max' }], resolve);
assert.equal(all.p.value, 310);
assert.equal(all['max:peso'].value, 320);
assert.equal(all.p.op, 'avg');
assert.equal(all.p.columnId, 'peso');

console.log(JSON.stringify({ gate: 'reports:aggregates:verify', ok: true }, null, 2));
