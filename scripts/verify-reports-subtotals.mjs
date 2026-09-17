// Gate reports:subtotals:verify (R2) — subtotal de cada grupo = agregação recalculada sobre a
// população do grupo, em todos os níveis, comparada com um cálculo ingênuo independente.
import assert from 'node:assert/strict';
import { groupRows, flattenTree } from '../src/modules/reporting/domain/groupEngine.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { ANIMAL_PERIOD_COLUMNS } from '../src/modules/reporting/definitions/columns/animalColumns.js';

const resolve = createColumnResolver(ANIMAL_PERIOD_COLUMNS);
const rows = [];
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const marcas = ['m1', 'm2', 'm3'];
const lotes = ['L1', 'L2'];
for (let i = 0; i < 240; i += 1) {
  const dias = rnd() < 0.1 ? null : 5 + Math.floor(rnd() * 60);
  const ganho = rnd() < 0.1 ? null : Math.round((rnd() * 80 - 10) * 10) / 10;
  rows.push({
    id: `a${i % 180}`, animal_id: `a${i % 180}`, numero_animal: String(i % 180), // 60 animais aparecem 2 vezes
    marca_id: marcas[i % 3], marca_nome: marcas[i % 3].toUpperCase(), sexo: i % 2 ? 'M' : 'F',
    lote_id: rnd() < 0.05 ? null : lotes[i % 2], lote_nome: null,
    peso_inicial: rnd() < 0.05 ? null : 200 + Math.floor(rnd() * 200), dias, ganho,
    gmd: ganho !== null && dias ? ganho / dias : null,
  });
}
for (const row of rows) row.lote_nome = row.lote_id;

const AGG = [
  { id: 'animais', columnId: 'animal', op: 'countDistinct' },
  { id: 'peso_medio', columnId: 'peso_inicial', op: 'avg' },
  { id: 'ganho_total', columnId: 'ganho', op: 'sum' },
  { id: 'gmd_pond', columnId: 'gmd', op: 'weightedGmd' },
  { id: 'gmd_simples', columnId: 'gmd', op: 'avg' },
  { id: 'peso_max', columnId: 'peso_inicial', op: 'max' },
];

// Referência ingênua, escrita de forma independente do motor.
function naive(population) {
  const valid = (key) => population.map((row) => row[key]).filter((value) => typeof value === 'number' && Number.isFinite(value));
  const pesos = valid('peso_inicial');
  const ganhos = valid('ganho');
  const pares = population.filter((row) => typeof row.ganho === 'number' && typeof row.dias === 'number' && row.dias > 0);
  const gmds = valid('gmd');
  return {
    animais: new Set(population.map((row) => row.animal_id)).size,
    peso_medio: pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : null,
    ganho_total: ganhos.length ? ganhos.reduce((a, b) => a + b, 0) : null,
    gmd_pond: pares.length ? pares.reduce((a, r) => a + r.ganho, 0) / pares.reduce((a, r) => a + r.dias, 0) : null,
    gmd_simples: gmds.length ? gmds.reduce((a, b) => a + b, 0) / gmds.length : null,
    peso_max: pesos.length ? Math.max(...pesos) : null,
  };
}
const same = (actual, expected, message) => {
  if (expected === null) assert.equal(actual, null, message);
  else assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);
};

const tree = groupRows(rows, [{ columnId: 'marca' }, { columnId: 'lote' }, { columnId: 'sexo' }], resolve, { aggregates: AGG });
let nodesChecked = 0;
const walk = (node) => {
  const reference = naive(node.rows);
  for (const spec of AGG) same(node.aggregates[spec.id].value, reference[spec.id], `${node.id} · ${spec.id}`);
  nodesChecked += 1;
  if (node.children.length) {
    assert.equal(node.children.reduce((total, child) => total + child.rowCount, 0), node.rowCount, `${node.id}: filhos particionam o pai`);
    node.children.forEach(walk);
  }
};
tree.nodes.forEach(walk);
assert.equal(tree.nodes.reduce((total, node) => total + node.rowCount, 0), rows.length, 'nível 1 particiona a população');
assert.ok(tree.nodes.some((node) => node.children.some((child) => child.missing)), 'lote ausente vira "Não informado"');

// NEGATIVO: média de subtotais ≠ subtotal do pai quando os grupos têm tamanhos diferentes.
const pai = tree.nodes[0];
const mediaDasMedias = pai.children.reduce((acc, child) => acc + child.aggregates.peso_medio.value, 0) / pai.children.length;
assert.ok(Math.abs(mediaDasMedias - pai.aggregates.peso_medio.value) > 1e-6, 'média das médias difere do recálculo');

// Estrutura achatada: GROUP → DATA → SUBTOTAL, sem HTML.
const flat = flattenTree(tree.nodes);
assert.equal(flat.filter((item) => item.kind === 'DATA').length, rows.length);
assert.equal(flat.filter((item) => item.kind === 'GROUP').length, flat.filter((item) => item.kind === 'SUBTOTAL').length);
assert.ok(flat.every((item) => typeof item === 'object' && !('html' in item)));

console.log(JSON.stringify({ gate: 'reports:subtotals:verify', ok: true, rows: rows.length, nodesChecked }, null, 2));
