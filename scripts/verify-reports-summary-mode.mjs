// Gate reports:summary-mode:verify (E1 1.4.0) — modo Resumido no domínio.
//   1. Para TODA definição agrupada (e todo alias agrupado): totais do Resumido = totais do Detalhado;
//      uma linha por nó da árvore, com os MESMOS agregados do nó do Detalhado; nenhuma linha de dados.
//   2. countDistinct por grupo correto quando o mesmo animal aparece em dois grupos (o pai/total
//      recalcula sobre a própria população — nunca soma dos filhos).
//   3. Níveis 2 e 3: agregados de cada nó conferidos contra a população do nó, recalculada à parte.
//   4. Casos à mão na massa (Rebanho atual por lote, Desempenho por lote).
//   5. Sem agrupamento + Resumido: só o Total geral. Ordem por métrica dentro do mesmo nível.
//   6. Detalhe de um grupo (drill-down): recorte exato pela chave do grupo, inclusive "Não informado".
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { LEGACY_REPORT_ALIASES, listAllReportDefinitions } from '../src/modules/reporting/definitions/reportCatalog.js';
import { flattenTree, NONE_GROUP_KEY } from '../src/modules/reporting/domain/groupEngine.js';
import { computeAggregates } from '../src/modules/reporting/domain/reportAggregates.js';
import { buildSummaryLayout, SUMMARY_LABEL_SORT } from '../src/modules/reporting/domain/summaryLayout.js';

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const run = (id, selection = {}, params = P) => runReport(id, { today: TODAY, params, selection }, ADMIN);
const plain = (value) => JSON.parse(JSON.stringify(value));

// ---- 1. Toda definição agrupada e todo alias agrupado: Resumido ≡ Detalhado ----
const grouped = [
  ...listAllReportDefinitions().filter((d) => d.status !== 'blocked' && d.defaultGroups.length).map((d) => d.id),
  // E1E: alias que virou tipo (comercial.*) tem o modo do tipo (Detalhado com o desenho de venda) — fica de fora.
  ...Object.entries(LEGACY_REPORT_ALIASES).filter(([, alias]) => alias.groups.length && !alias.view).map(([id]) => id),
];
assert.ok(grouped.length >= 30, `cobertura: ${grouped.length} relatórios/aliases agrupados`);
let nodesChecked = 0;
for (const id of grouped) {
  const detalhado = await run(id, { mode: 'DETALHADO' });
  const resumido = await run(id, { mode: 'RESUMIDO' });
  assert.equal(detalhado.mode, 'DETALHADO');
  assert.equal(resumido.mode, 'RESUMIDO');
  assert.deepEqual(plain(resumido.totals), plain(detalhado.totals), `${id}: totais do Resumido = totais do Detalhado`);
  assert.equal(resumido.rowCount, detalhado.rowCount, `${id}: mesma população`);
  const groups = flattenTree(detalhado.tree).filter((item) => item.kind === 'GROUP').map((item) => item.node);
  assert.equal(resumido.summaryRows.length, groups.length, `${id}: uma linha por grupo`);
  resumido.summaryRows.forEach((row, index) => {
    const node = groups[index];
    assert.equal(row.id, node.id, `${id}: ordem em profundidade`);
    assert.equal(row.level, node.level);
    assert.equal(row.rowCount, node.rowCount);
    assert.deepEqual(plain(row.aggregates), plain(node.aggregates), `${id}: agregados do grupo ${row.label}`);
    assert.ok(!('rows' in row) && !('children' in row), `${id}: Resumido sem linhas de dados`);
    nodesChecked += 1;
  });
  const layout = buildSummaryLayout(resumido, 'json');
  assert.equal(layout.rows.length, resumido.summaryRows.length + 1, `${id}: grupos + Total geral`);
  assert.deepEqual(layout.rows.at(-1).rawValues, layout.metrics.map((metric) => (metric.key === '__rows__' ? resumido.rowCount : resumido.totals[metric.key]?.value ?? null)), `${id}: Total geral do layout = totais`);
}

// ---- 2. countDistinct por grupo: A1 e A2 aparecem em Cadastro e Manejo ----
const porTipo = await run('pesagens', { mode: 'RESUMIDO', groups: [{ columnId: 'tipo_manejo' }] });
const cabecas = Object.fromEntries(porTipo.summaryRows.map((row) => [row.label, row.aggregates.animais.value]));
assert.deepEqual(cabecas, { Cadastro: 4, Manejo: 2, 'Saída': 2 }, 'cabeças por tipo');
assert.equal(porTipo.totals.animais.value, 4, 'total de cabeças = 4 animais distintos (a soma dos grupos daria 8)');
assert.notEqual(porTipo.totals.animais.value, Object.values(cabecas).reduce((sum, value) => sum + value, 0));

// ---- 3. Três níveis: cada nó conferido contra a própria população, recalculada à parte ----
const tres = await run('pesagens', { mode: 'RESUMIDO', groups: [{ columnId: 'tipo_manejo' }, { columnId: 'marca' }, { columnId: 'sexo' }] });
assert.deepEqual([...new Set(tres.summaryRows.map((row) => row.level))].sort(), [1, 2, 3], 'níveis 1, 2 e 3');
for (const row of tres.summaryRows) {
  const population = tres.rows.filter((item) => row.path.every((part) => {
    const raw = tres.resolve(part.columnId).groupKeyOf(item);
    const key = raw === null || raw === undefined || String(raw).trim() === '' ? NONE_GROUP_KEY : String(raw);
    return key === part.key;
  }));
  assert.equal(population.length, row.rowCount, `nível ${row.level} ${row.label}: população`);
  assert.deepEqual(plain(computeAggregates(population, tres.aggregates, tres.resolve)), plain(row.aggregates), `nível ${row.level} ${row.label}: recalculado sobre a própria população`);
}
const nivel2 = tres.summaryRows.filter((row) => row.level === 2);
const tresLayout = buildSummaryLayout(tres, 'screen');
for (const line of tresLayout.rows.filter((item) => item.type === 'SUMMARY')) {
  assert.equal(line.cells[line.level - 1], line.label, 'rótulo na coluna do próprio nível');
  line.cells.slice(0, 3).forEach((cell, index) => { if (index !== line.level - 1) assert.equal(cell, '', 'demais colunas de grupo vazias'); });
}
assert.ok(nivel2.length > 0);

// ---- 4. Casos à mão ----
// Rebanho atual por lote (padrão): ativos = A1 (Lote 01, 345 kg) e A4 (sem lote, 200 kg).
const rebanho = await run('rebanho.atual', {}, {});
assert.equal(rebanho.mode, 'RESUMIDO', 'Rebanho atual abre no Resumido');
assert.deepEqual(rebanho.groups.map((group) => group.columnId), ['lote_atual']);
const rebanhoLayout = buildSummaryLayout(rebanho, 'screen');
assert.deepEqual(rebanhoLayout.headers, ['Lote atual', 'Cabeças', 'Peso médio (kg)', 'Peso total (kg)'], 'colunas: Lote | Cabeças | Peso médio | Peso total');
// E1B: kg agregado com 1 casa (a coluna de dados e as exportações de pesagem continuam com 2).
assert.deepEqual(rebanhoLayout.rows.map((row) => row.cells), [
  ['Lote 01', '1', '345,0', '345,0'],
  ['Não informado', '1', '200,0', '200,0'],
  ['Total geral', '2', '272,5', '545,0'],
]);
// Desempenho por lote: A1 +45 kg em 40 d (L1), A3 sem par (L1), A2 +30 kg em 31 d (L2), A4 sem lote.
const desempenho = await run('desempenho');
assert.equal(desempenho.mode, 'RESUMIDO');
const porLote = Object.fromEntries(desempenho.summaryRows.map((row) => [row.label, row.aggregates]));
assert.equal(porLote['Lote 01'].animais.value, 2);
assert.equal(porLote['Lote 01'].ganho_total.value, 45);
assert.equal(porLote['Lote 01'].gmd_ponderado.value, 45 / 40);
assert.equal(porLote['Lote 02'].gmd_ponderado.value, 30 / 31);
assert.equal(desempenho.totals.gmd_ponderado.value, 75 / 71, 'GMD geral ponderado sobre a população (não média dos lotes)');
// E1G: Dias médios no padrão do Desempenho (pedido da responsável: dias em média, nunca soma).
assert.deepEqual(buildSummaryLayout(desempenho, 'screen').headers, ['Lote (última pesagem no período)', 'Cabeças', 'Peso inicial médio (kg)', 'Peso final médio (kg)', 'Ganho total (kg)', 'Ganho médio (kg)', 'Dias médios', 'GMD (kg/dia)']);
assert.equal(desempenho.totals.dias_medio.value, 71 / 2, 'Dias médios do total = (40 + 31) ÷ 2 = 35,5 (média, não a soma 71)');

// ---- 5. Sem agrupamento + Resumido; ordem por métrica ----
const semGrupo = await run('pesagens', { mode: 'RESUMIDO', groups: [] });
assert.deepEqual(semGrupo.summaryRows, [], 'sem agrupamento: nenhuma linha de grupo');
assert.deepEqual(buildSummaryLayout(semGrupo, 'screen').rows.map((row) => row.type), ['GRAND_TOTAL'], 'só o Total geral');
const ordenado = await run('pesagens', { mode: 'RESUMIDO', groups: [{ columnId: 'tipo_manejo' }, { columnId: 'marca' }], summarySort: { key: 'registros', direction: 'desc' } });
const topo = ordenado.summaryRows.filter((row) => row.level === 1);
assert.deepEqual(topo.map((row) => row.aggregates.registros.value), [...topo.map((row) => row.aggregates.registros.value)].sort((a, b) => b - a), 'nível 1 ordenado por Pesagens (desc)');
ordenado.summaryRows.forEach((row, index) => {
  if (row.level === 2) assert.equal(ordenado.summaryRows.slice(0, index).reverse().find((item) => item.level === 1).key, row.path[0].key, 'filhos continuam sob o próprio pai');
});
const porRotulo = await run('pesagens', { mode: 'RESUMIDO', groups: [{ columnId: 'tipo_manejo' }], summarySort: { key: SUMMARY_LABEL_SORT, direction: 'desc' } });
assert.deepEqual(porRotulo.summaryRows.map((row) => row.label), ['Saída', 'Manejo', 'Cadastro'], 'ordem pelo rótulo (desc)');
const chaveInvalida = await run('pesagens', { mode: 'RESUMIDO', summarySort: { key: 'xpto' } });
assert.equal(chaveInvalida.summarySort, null, 'NEGATIVO: ordem por métrica inexistente é ignorada');

// ---- 6. Detalhe de um grupo (drill-down) ----
const lote1 = await run('desempenho', { mode: 'DETALHADO', drill: [{ columnId: 'lote', key: 'L1' }] });
assert.deepEqual(lote1.rows.map((row) => row.animal_id).sort(), ['A1', 'A3'], 'detalhe do Lote 01');
assert.equal(lote1.totals.animais.value, 2, 'totais recalculados sobre o detalhe');
assert.equal(lote1.drill[0].label, 'Lote 01', 'rótulo do detalhe para a tela e a impressão');
const semLote = await run('desempenho', { mode: 'DETALHADO', drill: [{ columnId: 'lote', key: NONE_GROUP_KEY }] });
assert.deepEqual(semLote.rows.map((row) => row.animal_id), ['A4'], 'detalhe de "Não informado"');
assert.equal(semLote.drill[0].label, 'Não informado');
const doisNiveis = await run('pesagens', { mode: 'DETALHADO', groups: [{ columnId: 'tipo_manejo' }, { columnId: 'marca' }], drill: [{ columnId: 'tipo_manejo', key: 'Manejo' }, { columnId: 'marca', key: 'm-alfa' }] });
assert.deepEqual(doisNiveis.rows.map((row) => row.id).sort(), ['e2', 'e3'], 'detalhe de nível 2 (Manejo › ALFA)');
await assert.rejects(() => run('pesagens', { drill: [{ columnId: 'peso', key: '300' }] }), /não é agrupável/, 'NEGATIVO: detalhe só por coluna agrupável');

// ---- Modo padrão das definições ----
for (const definition of listAllReportDefinitions().filter((d) => d.status !== 'blocked')) {
  const explicit = ['pesagens.pendencias', 'controle.fechamento-dia', 'controle.qualidade-dados'];
  const expected = explicit.includes(definition.id) ? 'DETALHADO' : (definition.defaultGroups.length ? 'RESUMIDO' : 'DETALHADO');
  assert.equal(definition.defaultMode, expected, `${definition.id}: modo padrão`);
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:summary-mode:verify', ok: true, groupedReports: grouped.length, nodesChecked }, null, 2));
