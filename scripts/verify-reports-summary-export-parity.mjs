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

function printRows(html) {
  return [...html.matchAll(/<tr class="(sum lvl\d|grand sumtotal)">([\s\S]*?)<\/tr>/g)].map(([, , body]) => [...body.matchAll(/<td class="[^"]*">([\s\S]*?)<\/td>/g)].map(([, cell]) => decode(cell)));
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
  assert.deepEqual(csv[0], ['tipo_linha', 'nivel', ...screen.headers], `${testCase.name}: cabeçalho CSV = tela`);
  const csvBody = csv.slice(1);
  assert.deepEqual(csvBody.map((row) => row[0]), screen.rows.map((row) => row.type), `${testCase.name}: tipos de linha CSV`);
  assert.deepEqual(csvBody.map((row) => Number(row[1])), screen.rows.map((row) => row.level), `${testCase.name}: níveis CSV`);
  assert.deepEqual(normalizeRows(csvBody.map((row) => row.slice(2)), groupCount, metrics, (cell) => readNumber(cell)), expected, `${testCase.name}: CSV = tela`);

  // XLSX (7 linhas de topo: título, 4 metadados, branco, cabeçalho)
  const xlsx = xlsxRows((await prepareEmission(vm, 'xlsx', ADMIN)).content);
  assert.deepEqual(xlsx[6].cells, screen.headers, `${testCase.name}: cabeçalho XLSX = tela`);
  const xlsxBody = xlsx.slice(7).map((row) => row.cells);
  assert.ok(xlsxBody.flat().filter((cell, index) => typeof cell === 'string' && /^\d+([.,]\d+)?$/.test(cell) && index >= groupCount).length === 0, `${testCase.name}: XLSX com números de verdade`);
  assert.deepEqual(normalizeRows(xlsxBody, groupCount, metrics, (cell) => (cell === null ? null : Number(cell))), expected, `${testCase.name}: XLSX = tela`);
  assert.ok(String(xlsx[3].cells[1]).includes('Resumido'), `${testCase.name}: XLSX informa o modo`);

  // Impressão/PDF (mesmo documento)
  const printed = preparePrint(vm, ADMIN, {});
  assert.deepEqual(normalizeRows(printRows(printed.html), groupCount, metrics, (cell) => readNumber(cell)), expected, `${testCase.name}: impressão = tela`);
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
