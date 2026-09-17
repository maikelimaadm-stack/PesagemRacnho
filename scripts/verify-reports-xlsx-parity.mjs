// Gate reports:xlsx-parity:verify (R6) — XLSX sem dependência derivado do MESMO view model:
// ZIP válido (CRC), título/período/filtros/emissão, grupo/subtotal/total geral, números como
// números (nunca texto), mesma população e totais da tela e do CSV, aba de manifesto, SHA-256,
// e paridade da POPULAÇÃO entre UI, CSV, JSON, impressão/PDF e XLSX.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ADMIN, CONSULTA, OPERADOR, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { buildSheetRows, columnLetter, crc32, escapeXml, unzipStored } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { flattenTree } from '../src/modules/reporting/domain/groupEngine.js';

assert.equal(columnLetter(0), 'A');
assert.equal(columnLetter(25), 'Z');
assert.equal(columnLetter(26), 'AA');
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'CRC-32 padrão');
assert.equal(escapeXml('a<b & "c"'), 'a&lt;b &amp; &quot;c&quot;');

await seedReportFixture();
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const vm = await runReport('pesagens.periodo', {
  today: TODAY, params: period,
  selection: { columns: ['data_pesagem', 'numero_animal', 'marca', 'peso', 'gmd', 'dias', 'valor_venda_total'], groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }] },
}, ADMIN);
const { content, manifest, fileName } = await prepareEmission(vm, 'xlsx', ADMIN);
assert.ok(content instanceof Uint8Array, 'binário');
assert.ok(fileName.endsWith('.xlsx'));
assert.equal(manifest.sha256, createHash('sha256').update(content).digest('hex'), 'sha256 dos bytes');
assert.equal(String.fromCharCode(content[0], content[1]), 'PK', 'assinatura ZIP');

const files = unzipStored(content);
for (const name of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(files[name], `parte ${name}`);
// CRC de cada entrada confere (ZIP íntegro para o Excel)
{
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  let position = 0; let entries = 0;
  while (view.getUint32(position, true) === 0x04034b50) {
    const crc = view.getUint32(position + 14, true); const size = view.getUint32(position + 18, true);
    const nameLength = view.getUint16(position + 26, true); const start = position + 30 + nameLength;
    assert.equal(crc32(content.subarray(start, start + size)), crc, 'CRC da entrada');
    position = start + size; entries += 1;
  }
  assert.equal(entries, 7);
}
const sheet = files['xl/worksheets/sheet1.xml'];
assert.match(files['xl/workbook.xml'], /<sheet name="Pesagens por período"/);
assert.match(files['xl/workbook.xml'], /<sheet name="Manifesto"/);
assert.ok(sheet.includes('Pesagens por período') && sheet.includes('01/08/2026 a 15/09/2026') && sheet.includes('Apartação › Lote'), 'título, período e agrupamento');
assert.ok(files['xl/worksheets/sheet2.xml'].includes(vm.emissionId), 'aba de manifesto com a emissão');
assert.ok(!/s="null"/.test(sheet), 'NEGATIVO: nenhum estilo inválido');

// Estrutura = view model
const { rows } = buildSheetRows(vm);
const kinds = rows.map((row) => row.kind);
const flat = flattenTree(vm.tree);
assert.equal(kinds.filter((kind) => kind === 'DATA').length, vm.rowCount, 'linhas de dados = população');
assert.equal(kinds.filter((kind) => kind === 'GROUP').length, flat.filter((item) => item.kind === 'GROUP').length);
assert.equal(kinds.filter((kind) => kind === 'SUBTOTAL').length, flat.filter((item) => item.kind === 'SUBTOTAL').length * vm.aggregates.length);
assert.equal(kinds.filter((kind) => kind === 'GRAND_TOTAL').length, vm.aggregates.length);

// Números como números: cada DATA com peso tem <v> numérico na coluna do peso (E + 3 = H)
const pesoColumn = columnLetter(4 + vm.columns.findIndex((column) => column.id === 'peso'));
const numericPesos = [...sheet.matchAll(new RegExp(`<c r="${pesoColumn}\\d+" s="\\d+"><v>([^<]+)</v></c>`, 'g'))].map((match) => Number(match[1]));
const expectedPesos = flat.filter((item) => item.kind === 'DATA').map((item) => item.row.peso).filter((value) => typeof value === 'number');
assert.deepEqual(numericPesos, expectedPesos, 'peso numérico na mesma ordem');
assert.ok(!new RegExp(`<c r="${pesoColumn}\\d+"[^>]*t="inlineStr"><is><t[^>]*>\\d`).test(sheet), 'NEGATIVO: peso nunca como texto');
const grandAnimals = rows.find((row) => row.kind === 'GRAND_TOTAL' && row.cells[2][0] === 'Animais únicos');
assert.equal(grandAnimals.cells[3][0], vm.totals.animais.value, 'total geral numérico');
assert.equal(typeof grandAnimals.cells[3][0], 'number');

// Paridade de POPULAÇÃO entre todos os formatos
const csv = parseCsv((await prepareEmission(vm, 'csv', ADMIN)).content);
const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
const print = preparePrint(vm, ADMIN);
const population = {
  ui: vm.rowCount,
  csv: csv.filter((row) => row[0] === 'DATA').length,
  json: json.data.length,
  print: print.stats.dataRows,
  xlsx: kinds.filter((kind) => kind === 'DATA').length,
};
assert.deepEqual(new Set(Object.values(population)).size, 1, `mesma população em todos os formatos: ${JSON.stringify(population)}`);
const csvGrandAnimals = csv.find((row) => row[0] === 'GRAND_TOTAL' && row[3] === 'Animais únicos')[4];
assert.equal(Number(csvGrandAnimals), grandAnimals.cells[3][0]);
assert.equal(json.totals.animais.value, grandAnimals.cells[3][0]);
assert.deepEqual(new Set(json.data.map((row) => row._id)), new Set(flat.filter((item) => item.kind === 'DATA').map((item) => item.row.id)), 'JSON e XLSX com os mesmos registros');

// Permissão: OPERADOR não exporta; CONSULTA exporta sem valores
const vmOperador = await runReport('pesagens.periodo', { today: TODAY, params: period }, OPERADOR);
await assert.rejects(() => prepareEmission(vmOperador, 'xlsx', OPERADOR), (error) => error.code === 'AUTH_FORBIDDEN');
const consulta = await runReport('pesagens.periodo', { today: TODAY, params: period, selection: { columns: ['data_pesagem', 'numero_animal', 'valor_venda_total'] } }, CONSULTA);
const consultaSheet = unzipStored((await prepareEmission(consulta, 'xlsx', CONSULTA)).content)['xl/worksheets/sheet1.xml'];
assert.ok(!consultaSheet.includes('Valor venda') && !consultaSheet.includes('<v>3000</v>'), 'CONSULTA sem valores no XLSX');

await resetDb();
console.log(JSON.stringify({ gate: 'reports:xlsx-parity:verify', ok: true, bytes: content.length, population }, null, 2));
