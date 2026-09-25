// Gate reports:document-layout:verify (E1B 1.4.0) — a FOLHA do relatório (tela = impressão = PDF):
//   a) cada célula está sob o cabeçalho da SUA coluna (índice e chave), no modelo e no HTML — com negativo
//      (célula trocada ou faltando é detectada): o erro nº 1 do modelo antigo não pode voltar;
//   b) Subtotal e Total de cada seção = motor da E1 sobre a população do nó; Σ das linhas = subtotal só nas
//      métricas somáveis (contagem e soma) — média, mínimo, máximo, Qtd distinta e GMD nunca são somados;
//   c) "TOTAL POR <nível folha> – <nível 1>" = o mesmo motor (groupRows) sobre a população da seção;
//   d) coluna sem nenhum valor no relatório some (e volta com "mostrar colunas vazias"); contagem só com
//      zeros (Fêmeas num lote só de machos) também; o GMD sem pesagem anterior é "—", nunca "0,000", com a
//      nota "GMD calculado com N de M animais";
//   e) kg com 1 casa, @ com 2, GMD com 3; Média (@) = Peso médio ÷ divisor; rodapé "@ = peso vivo ÷ 30/15";
//   f) na tela, o clique no grupo (detalhe) e a ordenação por métrica apontam para nós reais da árvore;
//   g) estruturas com 0, 1, 2 e 3 níveis e o Detalhado como folha (linhas por animal).
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { listReportViews, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { DOC_ROW_TYPES, buildReportDocument, documentRows } from '../src/modules/reporting/domain/reportDocument.js';
import { computeAggregates } from '../src/modules/reporting/domain/reportAggregates.js';
import { groupRows } from '../src/modules/reporting/domain/groupEngine.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const ADDITIVE = new Set(['count', 'countValid', 'sum']);
const close = (a, b) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-6);
const views = listReportViews(getReportDefinition('pesagens'));
const view = views.find((item) => item.id === 'por-apartacao-data');
assert.ok(view, 'visão "Por apartação (resumo por data)" existe');
assert.equal(view.label, 'Por apartação (resumo por data)');
const run = (selection, extra = {}) => runReport('pesagens', { today: TODAY, params: P, selection, ...extra }, ADMIN);
const vm = await run(viewSelection(view, getReportDefinition('pesagens')));
assert.deepEqual(vm.groups.map((level) => level.columnId), ['nome_apartacao', 'data_pesagem', 'nome_lote'], 'Apartação › Data › Lote');
assert.equal(vm.mode, 'RESUMIDO');
const doc = buildReportDocument(vm, { orientation: 'landscape' });
const metricColumns = doc.columns.filter((column) => column.kind === 'metric');

// ---- a) alinhamento célula × coluna (modelo) ----
const rows = documentRows(doc);
for (const row of rows) {
  assert.equal(row.cells.length, doc.columns.length, `${row.id}: uma célula por coluna`);
  row.cells.forEach((cell, index) => {
    assert.equal(cell.col, index, `${row.id}: célula ${index} no índice certo`);
    assert.equal(cell.key, doc.columns[index].key, `${row.id}: célula ${index} sob a coluna ${doc.columns[index].key}`);
  });
}

// ---- a) alinhamento no HTML (o que a tela e a impressão desenham) + negativos ----
function assertTablesAligned(html) {
  const tables = [...html.matchAll(/<table class="sheet-table[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map(([, body]) => body);
  assert.ok(tables.length > 0, 'folha tem tabelas');
  for (const body of tables) {
    const head = [...body.matchAll(/<th data-col="(\d+)" data-key="([^"]*)"/g)].map(([, col, key]) => [Number(col), key]);
    head.forEach(([col], index) => assert.equal(col, index, 'cabeçalho em ordem de índice'));
    const bodyRows = [...body.matchAll(/<tr class="[^"]*" data-row-type="([A-Z_]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
    for (const [, type, rowBody] of bodyRows) {
      const cells = [...rowBody.matchAll(/<td data-col="(\d+)"(?: data-key="([^"]*)")?/g)].map(([, col, key]) => [Number(col), key ?? null]);
      if (/class="sheet-chips"/.test(rowBody)) continue;
      assert.equal(cells.length, head.length, `linha ${type}: ${cells.length} células para ${head.length} colunas`);
      cells.forEach(([col, key], index) => {
        assert.equal(col, index, `linha ${type}: célula ${index} no índice ${col}`);
        assert.equal(key, head[index][1], `linha ${type}: célula ${index} (${key}) sob o cabeçalho ${head[index][1]}`);
      });
    }
  }
  return tables.length;
}
const html = renderSheetBody(doc, { mode: 'print' });
const tableCount = assertTablesAligned(html);
const swapped = html.replace(/(<td data-col="1" data-key=")([^"]*)(")/, '$1__trocada__$3');
assert.throws(() => assertTablesAligned(swapped), 'NEGATIVO: célula sob a coluna errada é detectada');
const dropped = html.replace(/<td data-col="2" data-key="[^"]*" class="[^"]*">[^<]*<\/td>/, '');
assert.throws(() => assertTablesAligned(dropped), 'NEGATIVO: célula faltando é detectada');

// ---- b/c) Subtotal, TOTAL POR e totais = motor sobre a população; somas só nas aditivas ----
const specs = vm.aggregates.map((spec) => ({ id: spec.id, op: spec.op, ...(spec.columnId ? { columnId: spec.columnId } : {}) }));
const nodesById = new Map();
(function index(nodes) { for (const node of nodes) { nodesById.set(node.id, node); index(node.children ?? []); } })(vm.tree);
const rawOf = (row, key) => row.cells.find((cell) => cell.key === key)?.raw ?? null;
const specOf = (key) => specs.find((spec) => spec.id === key);
let checkedSubtotals = 0;
let checkedLeafTotals = 0;
const walkSections = (sections, fn) => sections.forEach((section) => { fn(section); walkSections(section.sections, fn); });
walkSections(doc.sections, (section) => {
  const node = nodesById.get(section.id);
  assert.ok(node, `seção ${section.id} é um nó real da árvore`);
  if (section.table) {
    const groupLines = section.table.rows.filter((row) => row.type === DOC_ROW_TYPES.GROUP);
    const subtotal = section.table.rows.find((row) => row.type === DOC_ROW_TYPES.SUBTOTAL);
    assert.ok(subtotal, `${section.id}: tem linha de Subtotal`);
    assert.equal(groupLines.length, node.children.length, `${section.id}: uma linha por grupo do nível folha`);
    const recomputed = computeAggregates(node.rows, specs, vm.resolve);
    for (const column of metricColumns) {
      const spec = specOf(column.key);
      const shown = rawOf(subtotal, column.key);
      const expected = column.zeroAsEmpty && recomputed[column.key]?.value === 0 ? null : recomputed[column.key]?.value ?? null;
      assert.ok(close(shown, expected), `${section.id}: Subtotal ${column.key} = motor sobre a população (${shown} × ${expected})`);
      if (ADDITIVE.has(spec.op)) {
        const sum = groupLines.reduce((total, row) => total + (rawOf(row, column.key) ?? 0), 0);
        assert.ok(close(sum, shown ?? 0), `${section.id}: Σ linhas = Subtotal em ${column.key} (${spec.op})`);
      }
    }
    checkedSubtotals += 1;
  }
  if (section.leafTotal) {
    const regrouped = groupRows(node.rows, [{ columnId: 'nome_lote' }], vm.resolve, { aggregates: specs }).nodes;
    const leafLines = section.leafTotal.rows.filter((row) => row.type === DOC_ROW_TYPES.LEAF_TOTAL);
    const total = section.leafTotal.rows.find((row) => row.type === DOC_ROW_TYPES.TOTAL);
    assert.equal(leafLines.length, regrouped.length, `${section.id}: TOTAL POR LOTE com um lote por linha`);
    assert.ok(section.leafTotal.title.startsWith('TOTAL POR LOTE – '), `${section.id}: título ${section.leafTotal.title}`);
    for (const line of leafLines) {
      const child = regrouped.find((candidate) => line.id.endsWith(`|${candidate.id}`));
      assert.ok(child, `${line.id}: lote do reagrupamento`);
      for (const column of metricColumns) {
        const expected = column.zeroAsEmpty && child.aggregates[column.key]?.value === 0 ? null : child.aggregates[column.key]?.value ?? null;
        assert.ok(close(rawOf(line, column.key), expected), `${line.id}: ${column.key} = groupRows sobre a seção`);
      }
    }
    // Total da seção de nível 1 = nó (população inteira); Σ = total só nas aditivas (Σ dos subtotais das datas também).
    const dateSubtotals = section.sections.map((child) => child.table.rows.find((row) => row.type === DOC_ROW_TYPES.SUBTOTAL));
    for (const column of metricColumns) {
      const spec = specOf(column.key);
      const expected = column.zeroAsEmpty && node.aggregates[column.key]?.value === 0 ? null : node.aggregates[column.key]?.value ?? null;
      assert.ok(close(rawOf(total, column.key), expected), `${section.id}: Total ${column.key} = nó de nível 1`);
      if (ADDITIVE.has(spec.op)) {
        assert.ok(close(leafLines.reduce((sum, row) => sum + (rawOf(row, column.key) ?? 0), 0), rawOf(total, column.key) ?? 0), `${section.id}: Σ TOTAL POR LOTE = Total em ${column.key}`);
        assert.ok(close(dateSubtotals.reduce((sum, row) => sum + (rawOf(row, column.key) ?? 0), 0), rawOf(total, column.key) ?? 0), `${section.id}: Σ subtotais das datas = Total em ${column.key}`);
      }
    }
    checkedLeafTotals += 1;
  }
});
assert.ok(checkedSubtotals >= 2 && checkedLeafTotals >= 1, 'massa exercita subtotais e TOTAL POR');
// Qtd (distinta) NÃO é somada: na massa, a apartação tem menos animais do que a soma das datas.
const qtd = metricColumns.find((column) => column.key === 'qtd');
assert.ok(qtd, 'coluna Qtd');
const firstLevel1 = doc.sections[0];
const firstTotal = firstLevel1.leafTotal.rows.find((row) => row.type === DOC_ROW_TYPES.TOTAL);
const sumDates = firstLevel1.sections.reduce((sum, child) => sum + rawOf(child.table.rows.find((row) => row.type === DOC_ROW_TYPES.SUBTOTAL), 'qtd'), 0);
assert.ok(rawOf(firstTotal, 'qtd') < sumDates, `Qtd distinta não é soma das datas (${rawOf(firstTotal, 'qtd')} < ${sumDates})`);
const grand = rows.find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
for (const column of metricColumns) {
  const expected = column.zeroAsEmpty && vm.totals[column.key]?.value === 0 ? null : vm.totals[column.key]?.value ?? null;
  assert.ok(close(rawOf(grand, column.key), expected), `Total geral ${column.key} = população inteira`);
}

// ---- d) colunas vazias, zeros e GMD "—" ----
const cadastros = await run({ ...viewSelection(view, getReportDefinition('pesagens')), filters: { tipo_manejo: { operator: 'in', values: ['Cadastro'] } } });
const cadDoc = buildReportDocument(cadastros);
const hiddenKeys = cadDoc.hiddenColumns.map((column) => column.key);
for (const key of ['ganho_medio', 'ganho_total', 'dias_medios', 'gmd_medio']) assert.ok(hiddenKeys.includes(key), `só Cadastros (sem pesagem anterior): coluna ${key} oculta`);
assert.ok(cadDoc.notes.some((note) => note.startsWith('Sem nenhum valor no relatório (colunas ocultas): ')), 'nota lista as colunas ocultas');
const cadAll = buildReportDocument(cadastros, { showEmptyColumns: true });
assert.ok(cadAll.columns.some((column) => column.key === 'gmd_medio') && cadAll.hiddenColumns.length === 0, '"mostrar colunas vazias" traz as colunas de volta');
for (const row of documentRows(cadAll)) {
  const gmd = row.cells.find((cell) => cell.key === 'gmd_medio');
  assert.equal(gmd.text, '—', `sem pesagem anterior: GMD "—" (nunca 0,000) em ${row.id}`);
}
const machos = await run({ ...viewSelection(view, getReportDefinition('pesagens')), filters: { sexo: { operator: 'in', values: ['M'] } } });
const machosDoc = buildReportDocument(machos);
assert.ok(machosDoc.hiddenColumns.some((column) => column.key === 'femeas'), 'só machos: coluna Fêmeas (toda zero) oculta');
assert.ok(machosDoc.columns.some((column) => column.key === 'machos'), 'Machos continua');
const gmdNote = doc.notes.find((note) => note.startsWith('GMD calculado com '));
const counts = computeAggregates(vm.rows, [{ id: 'n', op: 'countDistinct', columnId: 'animais_com_anterior' }, { id: 'm', op: 'countDistinct', columnId: 'numero_animal' }], vm.resolve);
assert.ok(gmdNote && gmdNote.includes(`${counts.n.value} de ${counts.m.value} animais`), `nota do GMD com N de M animais: ${gmdNote}`);
for (const row of rows) {
  const gmd = row.cells.find((cell) => cell.key === 'gmd_medio');
  if (gmd) assert.notEqual(gmd.text, '0,000', `${row.id}: GMD nunca "0,000" por falta de pesagem anterior`);
}

// ---- e) casas decimais, @ e divisor ----
const textOf = (row, key) => row.cells.find((cell) => cell.key === key)?.text;
for (const row of rows) {
  const peso = textOf(row, 'peso_medio');
  if (peso && peso !== '—') assert.match(peso, /^\d{1,3}(\.\d{3})*,\d$/, `kg com 1 casa (${peso})`);
  const arroba = textOf(row, 'media_arroba');
  if (arroba && arroba !== '—') assert.match(arroba, /^\d{1,3}(\.\d{3})*,\d{2}$/, `@ com 2 casas (${arroba})`);
  const gmd = textOf(row, 'gmd_medio');
  if (gmd && gmd !== '—') assert.match(gmd, /^-?\d+,\d{3}$/, `GMD com 3 casas (${gmd})`);
  const media = rawOf(row, 'peso_medio');
  if (media !== null && rawOf(row, 'media_arroba') !== null) assert.ok(close(rawOf(row, 'media_arroba'), media / vm.arrobaDivisor), `${row.id}: Média (@) = Peso médio ÷ ${vm.arrobaDivisor}`);
  const total = rawOf(row, 'peso_total');
  if (total !== null && rawOf(row, 'total_arroba') !== null) assert.ok(close(rawOf(row, 'total_arroba'), total / vm.arrobaDivisor), `${row.id}: Total (@) = Peso total ÷ ${vm.arrobaDivisor}`);
}
assert.equal(vm.arrobaDivisor, 30, 'divisor padrão 30');
assert.equal(doc.footer.arroba, '@ = peso vivo ÷ 30', 'rodapé com o divisor');
const vm15 = await run(viewSelection(view, getReportDefinition('pesagens')), { arrobaDivisor: 15 });
const doc15 = buildReportDocument(vm15);
assert.equal(doc15.footer.arroba, '@ = peso vivo ÷ 15', 'rodapé com o divisor 15');
const grand15 = documentRows(doc15).find((row) => row.type === DOC_ROW_TYPES.GRAND_TOTAL);
assert.ok(close(rawOf(grand15, 'media_arroba'), rawOf(grand, 'media_arroba') * 2), 'divisor 15 dobra a Média (@)');
// Faixa exigida: só nas linhas de lote (e no TOTAL POR LOTE); vazia nos subtotais
const pair = doc.columns.find((column) => column.kind === 'pair');
if (pair) {
  for (const row of rows) {
    const cell = row.cells.find((item) => item.key === pair.key);
    if ([DOC_ROW_TYPES.SUBTOTAL, DOC_ROW_TYPES.TOTAL, DOC_ROW_TYPES.GRAND_TOTAL].includes(row.type)) assert.equal(cell.text, '', `${row.id}: faixa só na linha do lote`);
  }
  assert.ok(rows.some((row) => /^\d/.test(row.cells.find((item) => item.key === pair.key).text)), 'faixa exigida do lote aparece (de–até)');
}

// ---- f) tela interativa: detalhe e ordenação apontam para nós reais ----
const screen = renderSheetBody(doc, { mode: 'fragment', interactive: true, sort: { key: 'peso_medio', direction: 'desc' } });
const drills = [...screen.matchAll(/data-drill="([^"]+)"/g)].map(([, id]) => id.replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
assert.ok(drills.length >= rows.filter((row) => row.type === DOC_ROW_TYPES.GROUP).length, 'cada grupo tem botão de detalhe');
for (const id of drills) {
  const path = doc.drillTargets[id];
  assert.ok(Array.isArray(path) && path.length >= 1, `detalhe ${id} tem caminho`);
  assert.ok(path.every((part) => part.columnId && part.key !== undefined), `detalhe ${id}: caminho com coluna e chave`);
}
assert.ok(/data-sort="peso_medio" aria-sort="descending"/.test(screen), 'ordenação por métrica marcada no cabeçalho');
assert.ok(!/data-drill=/.test(html), 'impressão sem botões');

// ---- g) 0, 1 e 2 níveis e o Detalhado como folha ----
const oneLevel = buildReportDocument(await run({ mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }] }));
assert.ok(oneLevel.flat && oneLevel.sections.length === 0 && oneLevel.flat.rows.at(-1).type === DOC_ROW_TYPES.GRAND_TOTAL, '1 nível: tabela única com Total geral no fim');
const twoLevels = buildReportDocument(await run({ mode: 'RESUMIDO', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }] }));
assert.ok(twoLevels.sections.every((section) => section.table && section.table.rows.at(-1).type === DOC_ROW_TYPES.SUBTOTAL && !section.leafTotal), '2 níveis: seção com Subtotal, sem TOTAL POR');
const zeroLevels = buildReportDocument(await run({ mode: 'RESUMIDO', groups: [] }));
assert.ok(zeroLevels.grandTotal && zeroLevels.sections.length === 0 && !zeroLevels.flat, '0 nível: só o Total geral');
const analitico = views.find((item) => item.id === 'analitico');
const detailVm = await run({ ...viewSelection(analitico, getReportDefinition('pesagens')), groups: [{ columnId: 'nome_apartacao' }] });
const detailDoc = buildReportDocument(detailVm);
assert.equal(detailDoc.layout, 'detail');
assert.equal(detailDoc.stats.dataRows, detailVm.rowCount, 'Detalhado como folha: uma linha por pesagem');
assertTablesAligned(renderSheetBody(detailDoc, { mode: 'print' }));
const limited = buildReportDocument(detailVm, { maxDataRows: 3 });
assert.equal(limited.stats.dataRows, 3, 'tela limita as linhas do Detalhado');
assert.ok(limited.notes.some((note) => note.includes('a impressão e o PDF levam todas')), 'aviso de linhas limitadas na tela');

// ---- layout: paisagem cabe; retrato reduz a fonte ou avisa ----
assert.equal(doc.print.orientation, 'landscape');
const portrait = buildReportDocument(vm, { orientation: 'portrait' });
assert.equal(portrait.print.orientation, 'portrait');
assert.ok(portrait.print.fits || portrait.print.warning?.code === 'PRINT_TOO_WIDE', 'retrato cabe (fonte menor) ou avisa — nunca corta');

await resetDb();
console.log(JSON.stringify({
  gate: 'reports:document-layout:verify', ok: true,
  colunas: doc.columns.map((column) => column.key), ocultas: doc.hiddenColumns.map((column) => column.key),
  linhas: rows.length, tabelas: tableCount, subtotais: checkedSubtotals, totalPor: checkedLeafTotals,
  retrato: { cabe: portrait.print.fits, fonte: portrait.print.sizeClass }, paisagem: { cabe: doc.print.fits, fonte: doc.print.sizeClass },
}, null, 2));
