// Gate reports:csv-parity:verify (R3) — o CSV é a MESMA população e os MESMOS totais da tela:
// linhas DATA = linhas do view model (na ordem), células = formatação canônica CSV, SUBTOTAL e
// GRAND_TOTAL = agregações do view model; UTF-8 com BOM, ";", CRLF, escape correto, sha256.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport as runReportService } from '../src/modules/reporting/application/reportService.js';
import { emitReport, prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { CSV_BOM, csvCell, parseCsv, protectFormula } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { formatCell } from '../src/modules/reporting/domain/reportFormatting.js';
import { flattenTree } from '../src/modules/reporting/domain/groupEngine.js';
import { cellRawValue } from '../src/modules/reporting/infrastructure/exporters/reportLayout.js';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
// M1 (1.5.0): a massa de ago–set/2026 (scripts/lib/reportFixtures) tem intervalos de 10 e 20 dias entre pesagens; este
// gate confere à mão números de outro assunto, então fixa o intervalo mínimo do GMD em 7 (todos os intervalos
// confiáveis — os números de antes). A regra do mínimo (21 padrão, 28; cinza, aviso, rodapé e contas só com o
// confiável) tem gate próprio com a MESMA massa: reports:gmd-confiabilidade:verify.
const runReport = (id, request = {}, actor) => runReportService(id, { gmdDiasMinimos: 7, ...request }, actor);

// Escape: separador, aspas, quebra de linha, espaços nas bordas e fórmula
assert.equal(csvCell('a;b'), '"a;b"');
assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
assert.equal(csvCell('duas\nlinhas'), '"duas\nlinhas"');
assert.equal(csvCell(' borda'), '" borda"');
assert.equal(csvCell('=SOMA(A1)'), "'=SOMA(A1)", 'injeção de fórmula neutralizada');
assert.equal(csvCell('-12,50'), '-12,50', 'número negativo não é fórmula');
assert.equal(csvCell(null), '');
assert.deepEqual(parseCsv(`${CSV_BOM}a;"b;c"\r\n"x""y";\r\n`), [['a', 'b;c'], ['x"y', '']]);

const { db } = await seedReportFixture();
// Observação com caracteres difíceis para provar o escape de ponta a ponta
await weighingService.updateEntry('e3', { observacao: 'Pesou; "manco"\nverificar =1+1' });
const period = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };

for (const [label, selection] of [
  ['sem grupo', { columns: ['data_pesagem', 'numero_animal', 'marca', 'sexo', 'peso', 'gmd', 'observacao', 'valor_venda_total'] }],
  ['agrupado apartação → lote', { columns: ['data_pesagem', 'numero_animal', 'peso', 'gmd', 'observacao'], groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }] }],
]) {
  const vm = await runReport('pesagens.periodo', { today: TODAY, params: period, selection }, ADMIN);
  const { content, manifest } = await prepareEmission(vm, 'csv', ADMIN);
  assert.ok(content.startsWith(CSV_BOM), `${label}: BOM`);
  assert.ok(content.includes('\r\n'), `${label}: CRLF`);
  assert.equal(manifest.sha256, createHash('sha256').update(content, 'utf8').digest('hex'), `${label}: sha256 do conteúdo`);
  const [header, ...rows] = parseCsv(content);
  assert.deepEqual(header.slice(0, 5), ['tipo_linha', 'nivel', 'grupo', 'metrica', 'valor']);
  assert.equal(header.length, 5 + vm.columns.length);

  const data = rows.filter((row) => row[0] === 'DATA');
  const expectedRows = vm.tree.length ? flattenTree(vm.tree).filter((item) => item.kind === 'DATA').map((item) => item.row) : vm.rows;
  assert.equal(data.length, vm.rowCount, `${label}: mesma quantidade de linhas`);
  data.forEach((csvRow, index) => {
    vm.columns.forEach((column, columnIndex) => {
      const expected = protectFormula(formatCell(column, cellRawValue(vm, column, expectedRows[index]), 'csv'));
      assert.equal(csvRow[5 + columnIndex], expected, `${label}: linha ${index} coluna ${column.id}`);
    });
  });

  const grand = rows.filter((row) => row[0] === 'GRAND_TOTAL');
  assert.equal(grand.length, vm.aggregates.length, `${label}: uma linha por total geral`);
  const animais = grand.find((row) => row[3] === 'Animais únicos');
  assert.equal(animais[4], String(vm.totals.animais.value));
  const gmd = grand.find((row) => row[3].startsWith('GMD ponderado'));
  assert.equal(gmd[4], formatCell({ type: 'gmd' }, vm.totals.gmd_ponderado.value, 'csv'));
  if (vm.tree.length) {
    const subtotals = rows.filter((row) => row[0] === 'SUBTOTAL');
    const nodes = flattenTree(vm.tree, { includeRows: false }).filter((item) => item.kind === 'SUBTOTAL');
    assert.equal(subtotals.length, nodes.length * vm.aggregates.length, `${label}: subtotais de todos os nós`);
    const lote01 = nodes.find((item) => item.node.label === 'Lote 01').node;
    const registros = subtotals.find((row) => row[2] === 'Engorda > Lote 01' && row[3] === 'Registros');
    assert.equal(registros[4], String(lote01.aggregates.registros.value));
    assert.equal(rows.filter((row) => row[0] === 'GROUP').length, nodes.length);
  }
}

// Emissão grava conteúdo e manifesto; writer com hash divergente é recusado
const vm = await runReport('pesagens.periodo', { today: TODAY, params: period }, ADMIN);
const written = [];
const writer = async ({ fileName, content }) => { written.push({ fileName, content }); return { location: `/tmp/${fileName}`, sha256: createHash('sha256').update(content, 'utf8').digest('hex') }; };
const result = await emitReport(vm, 'csv', ADMIN, { writer });
assert.equal(written.length, 2, 'CSV + manifesto');
assert.ok(written[1].fileName.endsWith('.csv.manifest.json'));
assert.equal(JSON.parse(written[1].content).sha256, result.manifest.sha256);
await assert.rejects(() => emitReport(vm, 'csv', ADMIN, { writer: async () => ({ location: 'x', sha256: 'deadbeef' }) }), (error) => error.code === 'REPORT_INTEGRITY', 'NEGATIVO: arquivo gravado diferente');

void db;
await resetDb();
console.log(JSON.stringify({ gate: 'reports:csv-parity:verify', ok: true }, null, 2));
