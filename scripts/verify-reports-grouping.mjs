// Gate reports:grouping:verify (R2) — agrupamento genérico até 3 níveis, por id canônico,
// "Não informado" por último, árvore estrutural (não HTML), ordem das linhas preservada.
import assert from 'node:assert/strict';
import { MAX_GROUP_LEVELS, NONE_GROUP_LABEL, groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { createColumnResolver } from '../src/modules/reporting/domain/reportDefinition.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';

const resolve = createColumnResolver(EVENT_COLUMNS);
assert.equal(MAX_GROUP_LEVELS, 3);

const rows = [
  { id: 1, marca: 'ALFA', marca_id: 'm1', marca_nome: 'Alfa Ltda', raca: 'Nelore', raca_id: 'r1', categoria_id: 'c1', categoria_nome: 'Garrote', data_pesagem: '2026-09-02' },
  { id: 2, marca: 'alfa ', marca_id: 'm1', marca_nome: 'Alfa Ltda', raca: 'Nelore', raca_id: 'r1', categoria_id: null, categoria_nome: null, data_pesagem: '2026-09-01' },
  { id: 3, marca: 'Beta', marca_id: 'm2', marca_nome: 'Beta', raca: 'Angus', raca_id: 'r2', categoria_id: 'c2', categoria_nome: 'Bezerro', data_pesagem: '2026-09-02' },
  { id: 4, marca: 'Álfa', marca_id: null, marca_nome: null, raca: null, raca_id: null, categoria_id: 'c1', categoria_nome: 'Garrote', data_pesagem: '2026-09-03' },
];

// Marca → Raça → Categoria
const tree = groupRows(rows, [{ columnId: 'marca' }, { columnId: 'raca' }, { columnId: 'categoria' }], resolve);
assert.deepEqual(tree.levels.map((level) => level.columnId), ['marca', 'raca', 'categoria']);
const labels = tree.nodes.map((node) => node.label);
assert.ok(labels.includes('Alfa Ltda'), 'rótulo = nome atual do cadastro');
const alfa = tree.nodes.find((node) => node.key === 'm1');
assert.equal(alfa.rowCount, 2, 'grafias "ALFA" e "alfa " com o mesmo id no mesmo grupo');
assert.deepEqual(alfa.rows.map((row) => row.id), [1, 2], 'ordem de entrada preservada no grupo');
const semId = tree.nodes.find((node) => node.key.startsWith('txt:'));
assert.equal(semId.rowCount, 1, 'sem id: agrupa pelo texto normalizado');
assert.equal(alfa.children[0].children.map((node) => node.label).at(-1), NONE_GROUP_LABEL, 'categoria ausente = "Não informado", por último');
assert.equal(alfa.level, 1); assert.equal(alfa.children[0].level, 2); assert.equal(alfa.children[0].children[0].level, 3);
assert.equal(alfa.children[0].children[0].path.length, 3, 'caminho completo no nó');
assert.ok(!('html' in alfa), 'estrutural');
const raiz4 = tree.nodes.find((node) => node.key.startsWith('txt:'));
assert.equal(raiz4.children[0].label, NONE_GROUP_LABEL, 'raça ausente');

// Data → Sessão (data agrupa pelo dia civil)
const byDate = groupRows(rows, [{ columnId: 'data_pesagem', direction: 'desc' }], resolve);
assert.deepEqual(byDate.nodes.map((node) => node.key), ['2026-09-03', '2026-09-02', '2026-09-01'], 'direção desc no grupo');

// Negativos
assert.throws(() => groupRows(rows, [{ columnId: 'marca' }, { columnId: 'raca' }, { columnId: 'categoria' }, { columnId: 'sexo' }], resolve), /no máximo 3/);
assert.throws(() => groupRows(rows, [{ columnId: 'peso' }], resolve), /não é agrupável/, 'peso não agrupa');
assert.throws(() => groupRows(rows, [{ columnId: 'marca' }, { columnId: 'marca' }], resolve), /não pode repetir/);
assert.throws(() => groupRows(rows, [{ columnId: 'xpto' }], resolve), /desconhecida/);
assert.deepEqual(groupRows(rows, [], resolve).nodes, [], 'sem níveis → sem árvore');

// Relatórios na massa: Apartação → Lote; Sessão; presets de dimensão
await seedReportFixture();
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const porLote = await runReport('pesagens.lote', { today: TODAY, params: period }, ADMIN);
assert.deepEqual(porLote.groups.map((group) => group.columnId), ['nome_apartacao', 'nome_lote']);
const engorda = porLote.tree.find((node) => node.label === 'Engorda');
assert.deepEqual(engorda.children.map((node) => `${node.label}:${node.rowCount}`), ['Lote 01:5', 'Lote 02:3']);
assert.equal(porLote.tree.find((node) => node.missing).rowCount, 1, 'A4 sem apartação');
const porSessao = await runReport('pesagens.sessao', { today: TODAY, params: period }, ADMIN);
assert.equal(porSessao.tree.reduce((acc, node) => acc + node.rowCount, 0), 9);
assert.ok(porSessao.tree.every((node) => !node.missing), 'toda pesagem tem sessão');
const porCategoria = await runReport('rebanho.dimensao.sexo', { today: TODAY }, ADMIN);
assert.deepEqual(porCategoria.tree.map((node) => `${node.label}:${node.aggregates.animais.value}`), ['Fêmea:1', 'Macho:1'], 'ativos por sexo com rótulo');
// Seleção do usuário substitui o agrupamento padrão (inclusive "sem agrupamento").
const semGrupo = await runReport('pesagens.lote', { today: TODAY, params: period, selection: { groups: [] } }, ADMIN);
assert.equal(semGrupo.tree.length, 0);
await assert.rejects(() => runReport('pesagens.periodo', { today: TODAY, params: period, selection: { groups: [{ columnId: 'peso' }] } }, ADMIN), /não é agrupável/);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:grouping:verify', ok: true }, null, 2));
