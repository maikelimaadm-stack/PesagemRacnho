// Gate reports:summary-export-parity:verify (E1 1.4.0) — CSV, XLSX, impressão/PDF e JSON do
// RESUMIDO têm as MESMAS linhas (mesma ordem) e os MESMOS valores da tela: rótulos de grupo iguais,
// métricas iguais depois de lidas de volta (tela/impressão pt-BR, CSV pt-BR sem milhar, XLSX número,
// JSON canônico arredondado na casa da coluna). Inclui 1, 2 e 3 níveis, ordem por métrica, valor
// ausente e relatório sem agregação.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { buildSummaryLayout } from '../src/modules/reporting/domain/summaryLayout.js';
import { DEFAULT_DECIMALS, roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };

// Texto humano (tela/impressão) ou CSV → número; "—"/vazio → null.
function readNumber(text) {
  if (text === null || text === undefined) return null;
  if (typeof text === 'number') return text;
  const clean = String(text).replace(/\s/g, '').replace('R$', '').replace('%', '');
  if (!clean || clean === '—') return null;
  const normalized = /,/.test(clean) ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const value = Number(normalized);
  assert.ok(Number.isFinite(value), `número legível: ${text}`);
  return value;
}
const decode = (entity) => entity.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function normalizeRows(rows, groupCount, metrics, readMetric) {
  return rows.map((cells) => [
    ...cells.slice(0, groupCount).map((cell) => (cell === null || cell === undefined ? '' : String(cell))),
    ...cells.slice(groupCount).map((cell, index) => {
      const value = readMetric(cell, metrics[index]);
      return value === null ? null : roundTo(value, decimalsOf(metrics[index]));
    }),
  ]);
}
const decimalsOf = (metric) => (Number.isInteger(metric.column.decimals) ? metric.column.decimals : DEFAULT_DECIMALS[metric.column.type] ?? 2);

function xlsxRows(bytes) {
  const sheet = unzipStored(bytes)['xl/worksheets/sheet1.xml'];
  const rows = [...sheet.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)].map(([, number, body]) => ({
    number: Number(number),
    cells: [...body.matchAll(/<c r="([A-Z]+)\d+" s="\d+"(?: t="inlineStr")?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t xml:space="preserve">([^<]*)<\/t><\/is>)<\/c>)/g)]
      .map(([, , number2, text]) => (number2 !== undefined ? Number(number2) : text !== undefined ? decode(text) : null)),
  }));
  return rows;
}

// E1B: a impressão é a FOLHA (seções por nível). Cada nó da árvore aparece uma vez como linha de grupo
// (nível folha), Subtotal (nível acima) ou Total da seção de nível 1 — lidas pelo data-row-id (= id do nó)
// e comparadas métrica a métrica (data-key) com a mesma linha do layout da tela/CSV/XLSX/JSON.
function printRowsByNode(html) {
  const out = new Map();
  for (const [, type, id, body] of html.matchAll(/<tr class="[^"]*" data-row-type="(GROUP|SUBTOTAL|TOTAL|GRAND_TOTAL|LEAF_TOTAL)" data-row-id="([^"]*)">([\s\S]*?)<\/tr>/g)) {
    if (type === 'LEAF_TOTAL') continue;
    const nodeId = type === 'GRAND_TOTAL' ? '#grand' : decode(id).replace(/#(subtotal|total)$/, '');
    const cells = Object.fromEntries([...body.matchAll(/<td data-col="\d+" data-key="([^"]*)" class="[^"]*"(?: title="[^"]*")?>([\s\S]*?)<\/td>/g)].map(([, key, text]) => [decode(key), decode(text.replace(/<[^>]+>/g, ''))]));
    assert.ok(!out.has(nodeId), `nó ${nodeId} aparece uma vez só na folha`);
    out.set(nodeId, cells);
  }
  return out;
}

const cases = [
  { name: 'Rebanho atual por lote (1 nível)', id: 'rebanho.atual', params: {} },
  { name: 'Desempenho por apartação › lote (2 níveis)', id: 'desempenho', selection: { groups: [{ columnId: 'apartacao' }, { columnId: 'lote' }] } },
  { name: 'Pesagens tipo › marca › sexo (3 níveis, ordem por métrica)', id: 'pesagens', selection: { groups: [{ columnId: 'tipo_manejo' }, { columnId: 'marca' }, { columnId: 'sexo' }], summarySort: { key: 'peso_medio', direction: 'desc' } } },
  { name: 'Saídas por motivo', id: 'saidas', selection: { mode: 'RESUMIDO' } },
  { name: 'Ocupação de lotes (razão e média ponderada)', id: 'rebanho.ocupacao-lotes', params: {} },
  { name: 'Embarques previsto × realizado', id: 'embarques.previsto-realizado' },
  { name: 'Alias antigo "Mortes por causa"', id: 'saidas.mortes.causa' },
  { name: 'Sem agregação (contagem de linhas)', id: 'pesagens', selection: { groups: [{ columnId: 'sessao' }], aggregates: [] } },
];

const results = [];
for (const testCase of cases) {
  const vm = await runReport(testCase.id, { today: TODAY, params: testCase.params ?? P, selection: { mode: 'RESUMIDO', ...(testCase.selection || {}) } }, ADMIN);
  assert.equal(vm.mode, 'RESUMIDO', `${testCase.name}: Resumido`);
  const screen = buildSummaryLayout(vm, 'screen');
  const { groupHeaders, metrics } = screen;
  const groupCount = groupHeaders.length;
  const expected = normalizeRows(screen.rows.map((row) => row.cells), groupCount, metrics, (cell) => readNumber(cell));
  assert.equal(expected.length, vm.summaryRows.length + 1, `${testCase.name}: linhas da tela`);

  // CSV
  const csv = parseCsv((await prepareEmission(vm, 'csv', ADMIN)).content).filter((row) => row.length > 1);
  assert.deepEqual(csv[0], ['tipo_linha', 'nivel', 'grupo', ...screen.headers], `${testCase.name}: cabeçalho CSV = tela`);
  const csvBody = csv.slice(1);
  assert.deepEqual(csvBody.map((row) => row[0]), screen.rows.map((row) => row.type), `${testCase.name}: tipos de linha CSV`);
  assert.deepEqual(csvBody.map((row) => Number(row[1])), screen.rows.map((row) => row.level), `${testCase.name}: níveis CSV`);
  // "grupo" = caminho completo: a linha de nível 2/3 leva o pai (a hierarquia sobrevive a ordenar no Excel).
  assert.deepEqual(csvBody.map((row) => row[2]), screen.rows.map((row) => (row.node ? row.node.path.map((part) => part.label).join(' > ') : '')), `${testCase.name}: caminho do grupo no CSV`);
  assert.deepEqual(normalizeRows(csvBody.map((row) => row.slice(3)), groupCount, metrics, (cell) => readNumber(cell)), expected, `${testCase.name}: CSV = tela`);

  // XLSX (7 linhas de topo: título, 4 metadados, branco, cabeçalho)
  const xlsx = xlsxRows((await prepareEmission(vm, 'xlsx', ADMIN)).content);
  assert.deepEqual(xlsx[6].cells, screen.headers, `${testCase.name}: cabeçalho XLSX = tela`);
  const xlsxBody = xlsx.slice(7).map((row) => row.cells);
  assert.ok(xlsxBody.flat().filter((cell, index) => typeof cell === 'string' && /^\d+([.,]\d+)?$/.test(cell) && index >= groupCount).length === 0, `${testCase.name}: XLSX com números de verdade`);
  assert.deepEqual(normalizeRows(xlsxBody, groupCount, metrics, (cell) => (cell === null ? null : Number(cell))), expected, `${testCase.name}: XLSX = tela`);
  assert.ok(String(xlsx[3].cells[1]).includes('Resumido'), `${testCase.name}: XLSX informa o modo`);

  // Impressão/PDF (a folha): todo nó da árvore, com os MESMOS valores da tela, métrica a métrica
  const printed = preparePrint(vm, ADMIN, {});
  const sheetRows = printRowsByNode(printed.html);
  const nodeIds = ['#grand', ...vm.summaryRows.map((row) => row.id)];
  assert.deepEqual([...sheetRows.keys()].sort(), [...nodeIds].sort(), `${testCase.name}: folha cobre todos os nós (e só eles)`);
  const zeroAsEmpty = new Set(printed.document.columns.filter((column) => column.zeroAsEmpty).map((column) => column.key));
  screen.rows.forEach((row, index) => {
    const nodeId = row.node ? row.node.id : '#grand';
    const cells = sheetRows.get(nodeId);
    metrics.forEach((metric, metricIndex) => {
      if (!(metric.key in cells)) {
        assert.ok(printed.document.hiddenColumns.some((column) => column.key === metric.key) || printed.document.columns.some((column) => column.kind === 'pair' && [column.from.key, column.to.key].includes(metric.key)), `${testCase.name}: métrica ${metric.key} só falta na folha se for coluna vazia (oculta) ou par "de–até"`);
        return;
      }
      const value = readNumber(cells[metric.key]);
      const wanted = expected[index][groupCount + metricIndex];
      if (value === null && wanted === 0 && zeroAsEmpty.has(metric.key)) return; // contagem zero aparece "—" na folha
      assert.equal(value === null ? null : roundTo(value, decimalsOf(metric)), wanted, `${testCase.name}: impressão = tela (${nodeId} · ${metric.key})`);
    });
  });
  assert.equal(printed.manifest.mode, 'RESUMIDO');

  // JSON (valor canônico, arredondado aqui na casa da coluna)
  const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
  assert.equal(json.mode, 'RESUMIDO');
  assert.deepEqual(json.summary.headers, screen.headers, `${testCase.name}: cabeçalho JSON = tela`);
  const jsonRows = json.summary.rows.map((row) => [...row.cells.slice(0, groupCount), ...metrics.map((metric) => row.values[metric.key])]);
  assert.deepEqual(normalizeRows(jsonRows, groupCount, metrics, (value) => (value === null ? null : Number(value))), expected, `${testCase.name}: JSON = tela`);
  assert.deepEqual(json.data, [], `${testCase.name}: JSON sem linhas de dados`);

  results.push({ caso: testCase.name, linhas: expected.length, colunas: screen.headers.length });
}

// Rótulo de grupo de data e de sim/não no formato brasileiro em tela, impressão, CSV e XLSX (JSON canônico).
const byDate = await runReport('pesagens', { today: TODAY, params: P, selection: { mode: 'RESUMIDO', groups: [{ columnId: 'data_pesagem' }] } }, ADMIN);
const dateLabels = buildSummaryLayout(byDate, 'screen').rows.filter((row) => row.node && !row.node.missing).map((row) => row.label);
assert.ok(dateLabels.length > 0 && dateLabels.every((label) => /^\d{2}\/\d{2}\/\d{4}$/.test(label)), `data agrupada em dd/mm/aaaa: ${dateLabels.join(', ')}`);
assert.ok(buildSummaryLayout(byDate, 'csv').rows.filter((row) => row.node && !row.node.missing).every((row) => /^\d{2}\/\d{2}\/\d{4}$/.test(row.label)), 'CSV: data em dd/mm/aaaa');
assert.ok(buildSummaryLayout(byDate, 'json').rows.filter((row) => row.node && !row.node.missing).every((row) => /^\d{4}-\d{2}-\d{2}/.test(row.label)), 'JSON: data canônica');
const byBool = await runReport('movimentacao.lotes', { today: TODAY, params: P, selection: { mode: 'RESUMIDO', groups: [{ columnId: 'mudanca' }] } }, ADMIN);
const boolLabels = buildSummaryLayout(byBool, 'print').rows.filter((row) => row.node && !row.node.missing).map((row) => row.label);
assert.ok(boolLabels.length > 0 && boolLabels.every((label) => ['Sim', 'Não'].includes(label)), `sim/não por extenso: ${boolLabels.join(', ')}`);

// Média de coluna inteira (dias no lote) mantém a fração em tela, CSV e XLSX.
const stays = await runReport('movimentacao.lotes', { today: TODAY, params: P, selection: { mode: 'RESUMIDO', aggregates: [{ id: 'dias_medio', op: 'avg', columnId: 'dias_no_lote' }] } }, ADMIN);
const staysLayout = buildSummaryLayout(stays, 'xlsx');
const rawAvg = staysLayout.rows.map((row) => row.rawValues[0]).filter((value) => typeof value === 'number' && !Number.isInteger(value));
assert.ok(rawAvg.length > 0, 'massa com média de dias fracionária');
for (const row of staysLayout.rows) {
  if (typeof row.rawValues[0] === 'number') assert.equal(row.cells.at(-1), roundTo(row.rawValues[0], 1), 'XLSX grava a média com 1 casa (não o inteiro arredondado)');
}

// CSV: texto que o Excel leria como fórmula ganha apóstrofo; número negativo não; a importação desfaz.
const { protectFormula } = await import('../src/modules/reporting/infrastructure/exporters/csvExporter.js');
for (const hostile of ['-1+1', "-2+3+cmd|' /C calc'!A0", '=1+1', '+5', '@SUM(1)', '-A1']) assert.equal(protectFormula(hostile), `'${hostile}`, `fórmula protegida: ${hostile}`);
for (const number of ['-12', '-1,5', '-1234,56', '-0.5', '12']) assert.equal(protectFormula(number), number, `número sem apóstrofo: ${number}`);
const { readImportFile } = await import('../src/modules/import/domain/importFile.js');
const reimported = readImportFile(`marca;peso;obs\r\n${protectFormula('-1+1')};${protectFormula('-12')};${protectFormula('=HYPERLINK(1)')}\r\n`, { delimiter: ';' });
assert.deepEqual(reimported.rows[0].values, { marca: '-1+1', peso: '-12', obs: '=HYPERLINK(1)' }, 'importação desfaz o apóstrofo (ida e volta)');

// Impressão do Resumido: nada é cortado com "…" e a largura estimada cobre o maior rótulo/número.
const perf = await runReport('desempenho', { today: TODAY, params: P, selection: { mode: 'RESUMIDO', groups: [{ columnId: 'apartacao' }, { columnId: 'lote' }] } }, ADMIN);
const perfPrint = preparePrint(perf, ADMIN, {});
assert.ok(!/text-overflow:\s*ellipsis/.test(perfPrint.html), 'impressão do Resumido sem reticências');
assert.ok(/\.sheet-table th \{[^}]*white-space: normal; overflow-wrap: normal/.test(perfPrint.html), 'cabeçalho das métricas quebra entre palavras (nunca no meio)');
assert.ok(/\.sheet-table \.num \{[^}]*white-space: nowrap/.test(perfPrint.html), 'número nunca quebra nem é cortado');
// Larguras pelo conteúdo: rótulo longo alarga a coluna do rótulo (até o máximo; acima disso quebra linha).
const { decideSheetLayout } = await import('../src/modules/reporting/domain/reportDocument.js');
const perfDoc = perfPrint.document;
const longRows = [...perfDoc.sections.flatMap((section) => section.table?.rows ?? []), { type: 'GROUP', cells: [{ text: 'Pasto Norte Grande - Piquete A' }, ...perfDoc.columns.slice(1).map(() => ({ text: '12.345,6' }))] }];
const longWidths = decideSheetLayout({ layout: 'summary', columns: perfDoc.columns, rows: longRows }).widths;
assert.ok(longWidths[0] >= 150, 'rótulo longo alarga a coluna (até o máximo; acima disso quebra linha)');
assert.ok(longWidths.slice(1).every((width) => width >= 34), 'métricas com largura mínima');

// Negativo: um layout adulterado é detectado pela comparação.
const vm = await runReport('rebanho.atual', { today: TODAY, params: {}, selection: { mode: 'RESUMIDO' } }, ADMIN);
const screen = buildSummaryLayout(vm, 'screen');
const tampered = screen.rows.map((row) => row.cells);
tampered[0] = [...tampered[0].slice(0, -1), '999,99'];
assert.notDeepEqual(
  normalizeRows(tampered, screen.groupHeaders.length, screen.metrics, (cell) => readNumber(cell)),
  normalizeRows(screen.rows.map((row) => row.cells), screen.groupHeaders.length, screen.metrics, (cell) => readNumber(cell)),
  'NEGATIVO: valor divergente é detectado',
);

await resetDb();
console.log(JSON.stringify({ gate: 'reports:summary-export-parity:verify', ok: true, cases: results }, null, 2));
