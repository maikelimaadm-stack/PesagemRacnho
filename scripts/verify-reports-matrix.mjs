// Gate reports:matrix:verify (E1D 1.4.0 — docs/plano-mestre/E1D-RELATORIO-PESAGENS-INDIVIDUAIS.md item 2;
// contrato docs/evidence/e1d/CONTRATOS-AGENTES.md §4, parte A) — Pesagens › "Sintético (Matriz)":
//   a) 2×2 conferível à mão (massa de reportFixtures, Sexo × Mês, ago–set/2026) e 3×4 (a massa + animais em
//      dez/2025–jan/2026, um deles trocando de lote no mesmo mês; Lote × Mês): Qtd = animais distintos, Peso
//      médio, GMD ponderado (Σ ganho ÷ Σ dias, só pesagens com anterior); sem anterior = "—" (nunca 0);
//      cruzamento sem pesagem = célula vazia;
//   b) totais recalculados pelo motor: coluna TOTAL = nó da linha, linha TOTAL = população inteira reagrupada
//      pelo eixo X (groupRows), canto = total geral — com casos em que a soma das Qtd e a média das médias dão
//      outro número (o mesmo animal em duas colunas, e em duas linhas da mesma coluna);
//   c) ordem: mês cronológico (jan/2026 depois de dez/2025 — a ordem alfabética poria "ago/2026" antes de
//      "dez/2025"), "Não informado" por último (linhas e colunas), direção do nível X e das linhas, e
//      "Ordenar por" peso/GMD (summarySort) ordena as LINHAS pelo total da linha;
//   d) eixos iguais ou desconhecidos recusados — serviço, definição e modelo salvo (que guarda os eixos); a
//      tela troca os eixos de lugar em vez de travar (nextMatrixAxes, usado por MatrixAxisControls);
//   e) folha (tela = impressão = PDF): layout "matrix", legenda, 3 valores por célula (Qtd, "x kg", GMD),
//      alinhamento data-col (com negativos), clique na linha/célula/coluna = detalhe exato; muitas colunas →
//      paisagem/fonte menor/aviso, nunca corta coluna;
//   f) XLSX: cabeçalho em 2 linhas (valor de X mesclado sobre Qtd / Peso médio (kg) / GMD médio (kg/dia),
//      TOTAL no fim), números como números no formato da coluna, paridade com a folha célula a célula (e
//      adulterações detectadas); o XLSX dos outros tipos não muda;
//   g) DECLARADO: o CSV e o JSON do Sintético (Matriz) continuam o Resumido de 2 níveis (Linhas › Colunas,
//      uma linha por grupo + Total geral — buildSummaryLayout), com os mesmos números da matriz.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import * as weighingService from '../src/modules/weighing/application/weighingService.js';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { preparePrint } from '../src/modules/reporting/application/reportPrintService.js';
import { normalizeTemplateConfig, saveTemplate, templateToRequest } from '../src/modules/reporting/application/reportTemplateService.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { EVENT_COLUMNS } from '../src/modules/reporting/definitions/columns/eventColumns.js';
import { EVENT_PERIOD_PARAM, EVENT_TOTALS, MATRIX_AXES, MATRIX_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';
import { DATA_CLASSIFICATION, defineReport } from '../src/modules/reporting/domain/reportDefinition.js';
import { GRAINS } from '../src/modules/reporting/domain/reportGrain.js';
import { viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { buildMatrix, isMatrixViewModel, matrixValues, nextMatrixAxes } from '../src/modules/reporting/domain/matrixLayout.js';
import { buildReportDocument, documentRows, DOC_ROW_TYPES } from '../src/modules/reporting/domain/reportDocument.js';
import { buildSummaryLayout } from '../src/modules/reporting/domain/summaryLayout.js';
import { DEFAULT_DECIMALS, roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { NONE_GROUP_KEY } from '../src/modules/reporting/domain/groupEngine.js';
import { renderSheetBody } from '../src/modules/reporting/infrastructure/exporters/sheetHtml.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { buildSheetRows, columnLetter, crc32, unzipStored, XLSX_MATRIX_KINDS } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';

// ---- massa: reportFixtures (ago–set/2026) + animais conferíveis à mão em dez/2025–jan/2026 ----
//  A5 505 macho Nelore: 10/12/2025 200 kg no Lote 02 → 30/12/2025 215 kg no Lote 01 (20 d, +15) → 29/01/2026
//     236 kg no Lote 01 (30 d, +21): o MESMO animal em duas linhas (Lote 02 e Lote 01) da coluna dez/2025;
//  A6 606 fêmea Angus sem lote: 20/01/2026 180 kg (sem anterior → GMD "—");
//  A7 707 macho Nelore Lote 01: 20/12/2025 250 kg → 19/01/2026 262 kg (30 d, +12);
//  A8 808 fêmea Angus sem lote: uma pesagem por mês de out/2024 a nov/2025 (só no caso "muitas colunas").
await seedReportFixture();
const base = { empresa_id: 'local', status_animal: 'Ativo' };
const L1 = { lote_id: 'L1', nome_lote: 'Lote 01', apartacao_id: 'ap1', nome_apartacao: 'Engorda' };
const L2 = { lote_id: 'L2', nome_lote: 'Lote 02', apartacao_id: 'ap1', nome_apartacao: 'Engorda' };
const a5 = { ...base, animal_id: 'A5', numero_animal: '505', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'Nelore', raca_id: 'r-nelore' };
const a6 = { ...base, animal_id: 'A6', numero_animal: '606', marca: 'BETA', marca_id: 'm-beta', sexo: 'F', raca: 'Angus', raca_id: 'r-angus' };
const a7 = { ...base, animal_id: 'A7', numero_animal: '707', marca: 'ALFA', marca_id: 'm-alfa', sexo: 'M', raca: 'Nelore', raca_id: 'r-nelore', ...L1 };
const a8 = { ...base, animal_id: 'A8', numero_animal: '808', marca: 'BETA', marca_id: 'm-beta', sexo: 'F', raca: 'Angus', raca_id: 'r-angus' };
const monthly = Array.from({ length: 14 }, (_, index) => {
  const month = 9 + index; // out/2024 = índice 9 do ano de 2024
  const date = `${2024 + Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, '0')}-15`;
  return { ...a8, id: `w${index}`, tipo_manejo: index ? 'Manejo' : 'Cadastro', data_pesagem: date, peso: 150 + index * 10 };
});
for (const entry of [
  ...monthly,
  { ...a5, ...L2, id: 'm1', tipo_manejo: 'Cadastro', data_pesagem: '2025-12-10', peso: 200 },
  { ...a7, id: 'm2', tipo_manejo: 'Cadastro', data_pesagem: '2025-12-20', peso: 250 },
  { ...a5, ...L1, id: 'm3', tipo_manejo: 'Manejo', data_pesagem: '2025-12-30', peso: 215 },
  { ...a7, id: 'm4', tipo_manejo: 'Manejo', data_pesagem: '2026-01-19', peso: 262 },
  { ...a6, id: 'm5', tipo_manejo: 'Cadastro', data_pesagem: '2026-01-20', peso: 180 },
  { ...a5, ...L1, id: 'm6', tipo_manejo: 'Manejo', data_pesagem: '2026-01-29', peso: 236 },
]) await weighingService.createEntry(entry);

const PESAGENS = getReportDefinition('pesagens');
const MATRIX = 'sintetico-matriz';
const AGO_SET = { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' };
const DEZ_SET = { preset: 'personalizado', from: '2025-12-01', to: '2026-09-15' };
const WIDE = { preset: 'personalizado', from: '2024-10-01', to: '2026-09-15' };
const run = (periodo, selection = {}) => runReport('pesagens', { today: TODAY, params: { periodo }, selection: { ...viewSelection(MATRIX, PESAGENS), ...selection }, arrobaDivisor: 30 }, ADMIN);
const results = [];

// ---- a/b) casos à mão ----
const close = (actual, expected, where) => {
  if (expected === null) { assert.equal(actual, null, `${where}: ausente = null (nunca 0), veio ${actual}`); return; }
  assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-4, `${where}: esperado ${expected}, veio ${actual}`);
};
/**
 * Confere a matriz (modelo e folha) contra os valores calculados à mão.
 * expected.cells[linha][coluna] = [Qtd, Peso médio, GMD] ou null (cruzamento vazio); coluna 'TOTAL' = total da
 * linha; linha 'TOTAL' = linha TOTAL (o canto em TOTAL.TOTAL).
 */
function checkMatrix(name, vm, expected) {
  assert.ok(isMatrixViewModel(vm), `${name}: view model do Sintético (Matriz)`);
  const matrix = buildMatrix(vm);
  assert.deepEqual(matrix.metrics.map((metric) => metric.key), ['qtd', 'peso_medio', 'gmd_medio'], `${name}: célula = Qtd, Peso médio, GMD médio`);
  assert.deepEqual(matrix.rows.map((row) => row.label), expected.rows, `${name}: linhas (eixo Y) na ordem`);
  assert.deepEqual(matrix.columns.map((column) => column.label), expected.columns, `${name}: colunas (eixo X) na ordem`);
  const doc = buildReportDocument(vm);
  const docRows = documentRows(doc);
  assert.deepEqual(docRows.map((row) => row.cells[0].text), [...expected.rows, 'TOTAL'], `${name}: folha com uma linha por Y + TOTAL`);
  assert.deepEqual(doc.columns.map((column) => column.label), [matrix.rowAxis.label, ...expected.columns, 'TOTAL'], `${name}: folha com uma coluna por X + TOTAL`);
  let cells = 0;
  const sources = [...matrix.rows.map((row) => ({ label: row.label, cells: row.cells, total: row.total })), { label: 'TOTAL', cells: matrix.totalRow.cells, total: matrix.totalRow.total }];
  sources.forEach((source, rowIndex) => {
    [...expected.columns, 'TOTAL'].forEach((columnLabel, columnIndex) => {
      const where = `${name} · ${source.label} × ${columnLabel}`;
      const want = expected.cells[source.label][columnLabel] ?? null;
      const node = columnLabel === 'TOTAL' ? source.total : source.cells[columnIndex];
      const docCell = docRows[rowIndex].cells[columnIndex + 1];
      if (want === null) {
        assert.equal(node, null, `${where}: cruzamento sem pesagem = sem nó`);
        assert.deepEqual([docCell.text, docCell.lines, docCell.raw], ['', [], null], `${where}: célula vazia na folha`);
      } else {
        const values = matrixValues(matrix, node);
        want.forEach((value, index) => close(values[index], value, `${where} · ${matrix.metrics[index].key}`));
        assert.deepEqual(docCell.raw, values, `${where}: folha = modelo`);
      }
      cells += 1;
    });
  });
  // O canto É o total geral do view model (recalculado sobre a população, nunca soma).
  assert.deepEqual(matrixValues(matrix, matrix.totalRow.total), matrix.metrics.map((metric) => vm.totals[metric.key]?.value ?? null), `${name}: canto = total geral`);
  // Coluna TOTAL de cada linha = o próprio nó do eixo Y (mesmos agregados do Resumido).
  for (const row of matrix.rows) assert.equal(row.total, vm.tree.find((node) => node.id === row.id), `${name}: TOTAL de ${row.label} = nó da árvore`);
  return { matrix, doc, docRows, cells };
}

// 2×2 — Sexo × Mês (ago–set/2026): Macho = A1 (300, 330 +30/20 d, 345 +15/20 d) + A3 (410, saída sem peso);
// Fêmea = A2 (250, 260 +10/10 d, saída 280) + A4 (200, sem anterior).
const vm22 = await run(AGO_SET, { matrix: { eixoY: 'sexo', eixoX: 'mes' } });
assert.deepEqual(vm22.groups.map((level) => level.columnId), ['sexo', 'mes_pesagem'], '2×2: grupos = [eixo Y, eixo X]');
const case22 = checkMatrix('2×2 Sexo × Mês', vm22, {
  rows: ['Fêmea', 'Macho'],
  columns: ['ago/2026', 'set/2026'],
  cells: {
    Fêmea: { 'ago/2026': [1, 255, 1], 'set/2026': [2, 240, null], TOTAL: [2, 247.5, 1] },
    Macho: { 'ago/2026': [2, 1040 / 3, 1.5], 'set/2026': [2, 345, 0.75], TOTAL: [2, 346.25, 45 / 40] },
    TOTAL: { 'ago/2026': [3, 310, 40 / 30], 'set/2026': [4, 275, 0.75], TOTAL: [4, 296.875, 55 / 50] },
  },
});
{
  // O mesmo animal em duas colunas: Qtd do TOTAL da linha e do canto ≠ soma; média das médias ≠ recalculada.
  const [femea, macho] = case22.matrix.rows;
  const qtd = (node) => node.aggregates.qtd.value;
  assert.notEqual(qtd(macho.total), macho.cells.reduce((sum, node) => sum + qtd(node), 0), '2×2: Qtd do TOTAL de Macho (2) ≠ soma das células (4)');
  assert.notEqual(qtd(femea.total), femea.cells.reduce((sum, node) => sum + qtd(node), 0), '2×2: Qtd do TOTAL de Fêmea (2) ≠ soma das células (3)');
  assert.notEqual(vm22.totals.qtd.value, case22.matrix.totalRow.cells.reduce((sum, node) => sum + qtd(node), 0), '2×2: canto (4) ≠ soma da linha TOTAL (7)');
  const avgOf = (nodes, key) => nodes.reduce((sum, node) => sum + node.aggregates[key].value, 0) / nodes.length;
  assert.ok(Math.abs(avgOf(macho.cells, 'peso_medio') - macho.total.aggregates.peso_medio.value) > 0.4,'2×2: Peso médio do TOTAL de Macho = recalculado (346,25), não média das médias (345,83)');
  assert.ok(Math.abs(avgOf(case22.matrix.totalRow.cells, 'peso_medio') - vm22.totals.peso_medio.value) > 1, '2×2: canto = recalculado (296,875), não média das colunas (292,5)');
  // GMD ponderado: coluna ago/2026 = (10 + 30) ÷ (10 + 20) = 1,333 — a média simples dos GMD daria 1,25.
  close(case22.matrix.totalRow.cells[0].aggregates.gmd_medio.value, 40 / 30, '2×2: GMD ponderado da coluna ago/2026');
  assert.ok(Math.abs(case22.matrix.totalRow.cells[0].aggregates.gmd_medio.value - 1.25) > 0.05, '2×2: GMD não é a média simples');
  // GMD sem pesagem anterior: "—" na folha (nunca "0,000") e célula vazia no XLSX.
  const femeaSet = case22.docRows[0].cells[2];
  assert.deepEqual(femeaSet.lines, ['2', '240,0 kg', '—'], '2×2: Fêmea × set/2026 = 2 / 240,0 kg / —');
  assert.deepEqual(case22.docRows[1].cells[1].lines, ['2', '346,7 kg', '1,500'], '2×2: Macho × ago/2026 = 2 / 346,7 kg / 1,500');
  assert.deepEqual(case22.docRows[2].cells[3].lines, ['4', '296,9 kg', '1,100'], '2×2: canto = 4 / 296,9 kg / 1,100');
  results.push({ caso: '2×2 Sexo × Mês', celulas: case22.cells });
}

// 3×4 — Lote × Mês (dez/2025–set/2026), conferido à mão (Σ kg ÷ n; Σ ganho ÷ Σ dias só com anterior):
//   Lote 01 = A7 (250; 262 +12/30) + A5 (215 +15/20; 236 +21/30) + A1 + A3 → 4 cabeças, 2.348 kg ÷ 8, 93 ÷ 120;
//   Lote 02 = A5 (200) + A2 (250; 260 +10/10; saída 280) → 2 cabeças, 990 ÷ 4, 10 ÷ 10;
//   Não informado = A6 (180) + A4 (200) → sem anterior: GMD "—";
//   dez/2025 = A5 (Lote 02 e Lote 01) + A7 → 2 cabeças (a soma da coluna daria 3); canto = 7 cabeças (a soma da
//   coluna TOTAL daria 8), 3.718 kg ÷ 14, 103 ÷ 130.
const vm34 = await run(DEZ_SET, { matrix: { eixoY: 'lote', eixoX: 'mes' } });
const case34 = checkMatrix('3×4 Lote × Mês', vm34, {
  rows: ['Lote 01', 'Lote 02', 'Não informado'],
  columns: ['dez/2025', 'jan/2026', 'ago/2026', 'set/2026'],
  cells: {
    'Lote 01': { 'dez/2025': [2, 232.5, 0.75], 'jan/2026': [2, 249, 33 / 60], 'ago/2026': [2, 1040 / 3, 1.5], 'set/2026': [2, 345, 0.75], TOTAL: [4, 293.5, 93 / 120] },
    'Lote 02': { 'dez/2025': [1, 200, null], 'jan/2026': null, 'ago/2026': [1, 255, 1], 'set/2026': [1, 280, null], TOTAL: [2, 247.5, 1] },
    'Não informado': { 'dez/2025': null, 'jan/2026': [1, 180, null], 'ago/2026': null, 'set/2026': [1, 200, null], TOTAL: [2, 190, null] },
    TOTAL: { 'dez/2025': [2, 665 / 3, 0.75], 'jan/2026': [3, 226, 33 / 60], 'ago/2026': [3, 310, 40 / 30], 'set/2026': [4, 275, 0.75], TOTAL: [7, 3718 / 14, 103 / 130] },
  },
});
{
  const qtd = (node) => node?.aggregates.qtd.value ?? 0;
  const dez = case34.matrix.totalRow.cells[0];
  assert.notEqual(qtd(dez), case34.matrix.rows.reduce((sum, row) => sum + qtd(row.cells[0]), 0), '3×4: Qtd de dez/2025 na linha TOTAL (2) ≠ soma da coluna (3) — A5 em dois lotes no mês');
  assert.notEqual(vm34.totals.qtd.value, case34.matrix.rows.reduce((sum, row) => sum + qtd(row.total), 0), '3×4: canto (7) ≠ soma da coluna TOTAL (8)');
  const lote01 = case34.matrix.rows[0];
  const meanOfCells = lote01.cells.reduce((sum, node) => sum + node.aggregates.gmd_medio.value, 0) / lote01.cells.length;
  assert.ok(Math.abs(meanOfCells - lote01.total.aggregates.gmd_medio.value) > 0.05, '3×4: GMD do TOTAL do Lote 01 = 93 ÷ 120 (0,775), não média das células (0,8875)');
  results.push({ caso: '3×4 Lote × Mês', celulas: case34.cells });
}

// ---- c) ordem ----
{
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
  // Mês: cronológico, rótulo "mmm/aaaa". Alfabeticamente "ago/2026" viria antes de "dez/2025".
  const months = case34.matrix.columns.map((column) => column.label);
  assert.ok(months.every((label) => /^[a-z]{3}\/\d{4}$/.test(label)), 'mês no formato "set/2026"');
  assert.notDeepEqual([...months].sort(collator.compare), months, 'a ordem alfabética dos meses seria outra (o caso prova a cronológica)');
  assert.ok(months.indexOf('jan/2026') === months.indexOf('dez/2025') + 1, 'jan/2026 logo depois de dez/2025');
  // "Não informado" por último nas LINHAS: Raça (alfabeticamente "Não informado" viria antes de "Nelore").
  assert.ok(collator.compare('Não informado', 'Nelore') < 0, 'controle: "Não informado" < "Nelore" no alfabeto');
  const racaMes = buildMatrix(await run(DEZ_SET, { matrix: { eixoY: 'raca', eixoX: 'mes' } }));
  assert.deepEqual(racaMes.rows.map((row) => row.label), ['Angus', 'Nelore', 'Não informado'], 'Raça nas linhas: "Não informado" por último');
  // ... e nas COLUNAS.
  const sexoRaca = buildMatrix(await run(DEZ_SET, { matrix: { eixoY: 'sexo', eixoX: 'raca' } }));
  assert.deepEqual(sexoRaca.columns.map((column) => column.label), ['Angus', 'Nelore', 'Não informado'], 'Raça nas colunas: "Não informado" por último');
  // Direção do nível X (Mês decrescente) e do nível Y (Mês decrescente nas linhas); "Não informado" continua no fim.
  const desc = buildMatrix(await run(DEZ_SET, { matrix: { eixoY: 'lote', eixoX: 'mes' }, groups: [{ columnId: 'mes_pesagem', direction: 'desc' }] }));
  assert.deepEqual(desc.columns.map((column) => column.label), ['set/2026', 'ago/2026', 'jan/2026', 'dez/2025'], 'Mês decrescente nas colunas (direção do nível X)');
  const mesY = buildMatrix(await run(DEZ_SET, { matrix: { eixoY: 'mes', eixoX: 'lote' }, groups: [{ columnId: 'mes_pesagem', direction: 'desc' }] }));
  assert.deepEqual(mesY.rows.map((row) => row.label), ['set/2026', 'ago/2026', 'jan/2026', 'dez/2025'], 'Mês decrescente nas linhas');
  assert.deepEqual(mesY.columns.map((column) => column.label), ['Lote 01', 'Lote 02', 'Não informado'], 'Lote nas colunas, "Não informado" no fim');
  // "Ordenar por" Peso/GMD (summarySort do Resumido): ordena as LINHAS pelo total da linha; ausente no fim.
  const byMetric = async (key, direction) => buildMatrix(await run(DEZ_SET, { matrix: { eixoY: 'lote', eixoX: 'mes' }, summarySort: { key, direction } })).rows.map((row) => row.label);
  assert.deepEqual(await byMetric('peso_medio', 'desc'), ['Lote 01', 'Lote 02', 'Não informado'], 'Peso (Maior): 293,5 › 247,5 › "Não informado" no fim');
  assert.deepEqual(await byMetric('peso_medio', 'asc'), ['Lote 02', 'Lote 01', 'Não informado'], 'Peso (Menor): 247,5 › 293,5 › "Não informado" no fim (mesmo com 190)');
  assert.deepEqual(await byMetric('gmd_medio', 'desc'), ['Lote 02', 'Lote 01', 'Não informado'], 'GMD (Maior): 1,000 › 0,775 › sem GMD no fim');
  assert.deepEqual(await byMetric('gmd_medio', 'asc'), ['Lote 01', 'Lote 02', 'Não informado'], 'GMD (Menor): 0,775 › 1,000 › sem GMD no fim');
  // As colunas não mudam com a ordem das linhas.
  assert.deepEqual(buildMatrix(await run(DEZ_SET, { matrix: { eixoY: 'lote', eixoX: 'mes' }, summarySort: { key: 'peso_medio', direction: 'asc' } })).columns.map((column) => column.label), months, 'ordem das linhas não mexe nas colunas');
  results.push({ caso: 'ordem', meses: months, linhasRaca: racaMes.rows.map((row) => row.label) });
}

// ---- d) eixos: serviço, definição, modelo salvo, tela ----
{
  await assert.rejects(run(AGO_SET, { matrix: { eixoY: 'sexo', eixoX: 'sexo' } }), /não podem ser o mesmo eixo/, 'NEGATIVO serviço: eixos iguais recusados');
  await assert.rejects(run(AGO_SET, { matrix: { eixoY: 'peso', eixoX: 'sexo' } }), /eixo da matriz desconhecido/, 'NEGATIVO serviço: eixo desconhecido recusado');
  // Os 5 eixos do antigo, e todos os pares diferentes rodam (20 combinações).
  assert.deepEqual(PESAGENS.matrixAxes.map((axis) => axis.label), ['Lote', 'Apartação', 'Sexo', 'Raça', 'Mês'], 'eixos: Lote, Apartação, Sexo, Raça, Mês');
  let pairs = 0;
  for (const y of PESAGENS.matrixAxes) {
    for (const x of PESAGENS.matrixAxes) {
      if (x.id === y.id) continue;
      const vm = await run(DEZ_SET, { matrix: { eixoY: y.id, eixoX: x.id } });
      const matrix = buildMatrix(vm);
      assert.equal(matrix.legend, `Linhas: ${y.label} · Colunas: ${x.label} · Valores: Qtd / Peso médio / GMD médio`, `${y.label} × ${x.label}: legenda`);
      assert.equal(buildReportDocument(vm).layout, 'matrix', `${y.label} × ${x.label}: folha da matriz`);
      pairs += 1;
    }
  }
  // Padrão do tipo = o do antigo (Linhas Sexo, Colunas Lote).
  const standard = await run(AGO_SET);
  assert.deepEqual([standard.matrix.eixoY, standard.matrix.eixoX], ['sexo', 'lote'], 'padrão: Linhas = Sexo, Colunas = Lote');
  // Definição: a matriz com eixos iguais (ou desconhecidos) não é aceita.
  const spec = (matrix) => ({
    id: 'matriz-teste', family: 'pesagens', grain: GRAINS.EVENT, version: 1, source: 'events.byPeriod', requires: ['reports.read', 'weighing.read'],
    title: 'Matriz teste', params: [EVENT_PERIOD_PARAM], columns: EVENT_COLUMNS, animalColumnId: 'numero_animal', searchColumns: ['numero_animal'],
    defaultColumns: ['data_pesagem', 'numero_animal'], defaultSort: [{ columnId: 'data_pesagem', direction: 'asc' }], defaultGroups: [], defaultAggregates: EVENT_TOTALS,
    matrixAxes: MATRIX_AXES, views: [{ id: 'm', label: 'Matriz', mode: 'RESUMIDO', groups: [], layout: 'matrix', matrix, aggregates: MATRIX_TOTALS }], defaultView: 'm',
    classification: DATA_CLASSIFICATION.CANONICAL,
  });
  assert.ok(defineReport(spec({ eixoY: 'sexo', eixoX: 'lote' })), 'controle: definição com eixos diferentes é aceita');
  assert.throws(() => defineReport(spec({ eixoY: 'sexo', eixoX: 'sexo' })), /não podem ser o mesmo eixo/, 'NEGATIVO definição: eixos iguais');
  assert.throws(() => defineReport(spec({ eixoY: 'sexo', eixoX: 'peso' })), /eixos da matriz desconhecidos/, 'NEGATIVO definição: eixo desconhecido');
  // Modelo salvo: guarda os eixos e reabre neles; eixos iguais são recusados ao salvar e descartados com aviso ao abrir.
  const saved = await saveTemplate({ baseReportId: 'pesagens', name: 'Matriz lote × mês', view: MATRIX, matrix: { eixoY: 'lote', eixoX: 'mes' }, mode: 'RESUMIDO', aggregates: MATRIX_TOTALS, groups: [], period: DEZ_SET }, ADMIN);
  const request = templateToRequest(saved, ADMIN.role);
  assert.deepEqual(request.selection.matrix, { eixoY: 'lote', eixoX: 'mes' }, 'modelo guarda os eixos');
  const reopened = await runReport('pesagens', { today: TODAY, params: request.params, selection: request.selection, arrobaDivisor: 30 }, ADMIN);
  assert.deepEqual(buildMatrix(reopened).rows.map((row) => row.label), case34.matrix.rows.map((row) => row.label), 'modelo reabre a mesma matriz');
  assert.throws(() => normalizeTemplateConfig(PESAGENS, { view: MATRIX, matrix: { eixoY: 'raca', eixoX: 'raca' } }), /não podem ser o mesmo eixo/, 'NEGATIVO modelo: salvar com eixos iguais');
  const broken = templateToRequest({ ...saved, matrix: { eixoY: 'raca', eixoX: 'raca' } }, ADMIN.role);
  assert.ok(broken.warnings.some((warning) => warning.code === 'TEMPLATE_TYPE_REMOVED'), 'NEGATIVO modelo: eixos iguais ao abrir = aviso, sem erro');
  assert.notDeepEqual(broken.selection.matrix, { eixoY: 'raca', eixoX: 'raca' }, 'NEGATIVO modelo: eixos iguais não chegam ao serviço');
  // Tela: escolher num lado o eixo do outro TROCA os dois (a tela nunca manda eixos iguais ao serviço).
  const current = { eixoY: 'sexo', eixoX: 'lote' };
  assert.deepEqual(nextMatrixAxes(current, 'eixoY', 'lote'), { eixoY: 'lote', eixoX: 'sexo' }, 'tela: Linhas = eixo das Colunas → troca');
  assert.deepEqual(nextMatrixAxes(current, 'eixoX', 'sexo'), { eixoY: 'lote', eixoX: 'sexo' }, 'tela: Colunas = eixo das Linhas → troca');
  assert.deepEqual(nextMatrixAxes(current, 'eixoY', 'mes'), { eixoY: 'mes', eixoX: 'lote' }, 'tela: eixo livre só muda o lado escolhido');
  assert.deepEqual(nextMatrixAxes(current, 'eixoX', 'lote'), current, 'tela: mesmo valor = nada muda');
  assert.throws(() => nextMatrixAxes(current, 'eixoZ', 'lote'), /lado desconhecido/, 'NEGATIVO tela: lado desconhecido');
  for (const axis of PESAGENS.matrixAxes) {
    for (const edge of ['eixoY', 'eixoX']) {
      const next = nextMatrixAxes(current, edge, axis.id);
      assert.notEqual(next.eixoY, next.eixoX, `tela: ${edge} = ${axis.id} nunca deixa eixos iguais`);
      await run(AGO_SET, { matrix: next }); // o serviço aceita o que a tela manda
    }
  }
  // A tela liga os controles só no tipo matriz, com os rótulos do antigo, e mantém o tipo ao trocar o eixo.
  const controls = readFileSync(new URL('../src/components/reports/MatrixAxisControls.jsx', import.meta.url), 'utf8');
  assert.ok(controls.includes('"Linhas (Eixo Y)"') && controls.includes('"Colunas (Eixo X)"') && controls.includes('nextMatrixAxes') && controls.includes('BarSelect'), 'MatrixAxisControls: Linhas (Eixo Y) / Colunas (Eixo X) com BarSelect e troca de eixos');
  const screen = readFileSync(new URL('../src/components/reports/ReportView.jsx', import.meta.url), 'utf8');
  assert.ok(screen.includes('typeControls=') && /layout === VIEW_LAYOUTS\.MATRIX[\s\S]{0,120}<MatrixAxisControls /.test(screen), 'ReportView: MatrixAxisControls só no tipo com layout matrix (encaixe typeControls)');
  assert.match(screen, /const setMatrixAxes = \(matrix\) => update\(\{ matrix, drill: \[\]/, 'ReportView: trocar eixo mantém o tipo e sai do detalhe');
  results.push({ caso: 'eixos', paresRodados: pairs });
}

// ---- e) folha: alinhamento, clique, impressão, largura ----
function assertTablesAligned(html) {
  const tables = [...html.matchAll(/<table class="sheet-table[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map(([, body]) => body);
  assert.ok(tables.length > 0, 'folha tem tabela');
  for (const body of tables) {
    const head = [...body.matchAll(/<th data-col="(\d+)" data-key="([^"]*)"/g)].map(([, col, key]) => [Number(col), key]);
    head.forEach(([col], index) => assert.equal(col, index, 'cabeçalho em ordem de índice'));
    for (const [, type, rowBody] of body.matchAll(/<tr class="[^"]*" data-row-type="([A-Z_]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...rowBody.matchAll(/<td data-col="(\d+)"(?: data-key="([^"]*)")?/g)].map(([, col, key]) => [Number(col), key ?? null]);
      assert.equal(cells.length, head.length, `linha ${type}: ${cells.length} células para ${head.length} colunas`);
      cells.forEach(([col, key], index) => {
        assert.equal(col, index, `linha ${type}: célula ${index} no índice ${col}`);
        assert.equal(key, head[index][1], `linha ${type}: célula ${index} (${key}) sob o cabeçalho ${head[index][1]}`);
      });
    }
  }
  return tables.length;
}
{
  const { doc } = case34;
  assert.equal(doc.layout, 'matrix', 'folha: layout matrix');
  assert.equal(doc.matrix.legend, 'Linhas: Lote · Colunas: Mês · Valores: Qtd / Peso médio / GMD médio', 'folha: legenda');
  assert.equal(doc.flat.title, doc.matrix.legend, 'folha: legenda como título da tabela');
  assert.equal(doc.sections.length + (doc.grandTotal ? 1 : 0), 0, 'folha: uma tabela só (sem seções nem bloco de total à parte)');
  const rows = documentRows(doc);
  assert.deepEqual(rows.map((row) => row.type), [DOC_ROW_TYPES.GROUP, DOC_ROW_TYPES.GROUP, DOC_ROW_TYPES.GROUP, DOC_ROW_TYPES.GRAND_TOTAL], 'folha: 3 linhas de Y + TOTAL');
  for (const row of rows) {
    assert.equal(row.cells.length, doc.columns.length, `${row.id}: uma célula por coluna`);
    row.cells.forEach((cell, index) => {
      assert.equal(cell.col, index, `${row.id}: célula ${index} no índice certo`);
      assert.equal(cell.key, doc.columns[index].key, `${row.id}: célula ${index} sob a coluna ${doc.columns[index].key}`);
      if (index === 0) return;
      // 3 valores empilhados (Qtd, "x kg", GMD com 3 casas ou "—") ou célula vazia.
      if (!cell.lines.length) return;
      assert.equal(cell.lines.length, 3, `${row.id}: 3 valores na célula ${index}`);
      assert.match(cell.lines[0], /^\d+$/, `${row.id}: Qtd inteira`);
      assert.match(cell.lines[1], /^\d{1,3}(\.\d{3})*,\d kg$/, `${row.id}: Peso médio "x kg" com 1 casa`);
      assert.match(cell.lines[2], /^(\d+,\d{3}|—)$/, `${row.id}: GMD com 3 casas ou "—"`);
    });
  }
  assert.deepEqual(rows[0].cells[1].lines, ['2', '232,5 kg', '0,750'], 'folha: Lote 01 × dez/2025');
  assert.deepEqual(rows[1].cells[2].lines, [], 'folha: Lote 02 × jan/2026 vazio');
  assert.deepEqual(rows[3].cells[5].lines, ['7', '265,6 kg', '0,792'], 'folha: canto');
  // HTML (tela = impressão): alinhamento, 3 valores com <br>, legenda; negativos.
  const html = renderSheetBody(doc, { mode: 'print' });
  assert.equal(assertTablesAligned(html), 1, 'folha: uma tabela');
  assert.ok(html.includes('2<br>232,5 kg<br>0,750'), 'folha: valores empilhados com <br>');
  assert.ok(html.includes('Linhas: Lote · Colunas: Mês · Valores: Qtd / Peso médio / GMD médio'), 'folha: legenda no HTML');
  assert.ok(html.includes('data-layout="matrix"'), 'folha: data-layout="matrix"');
  const swapped = html.replace(/(<td data-col="1" data-key=")([^"]*)(")/, '$1__trocada__$3');
  assert.throws(() => assertTablesAligned(swapped), 'NEGATIVO: célula sob a coluna errada é detectada');
  const dropped = html.replace(/<td data-col="2" data-key="[^"]*" class="[^"]*">[\s\S]*?<\/td>/, '');
  assert.throws(() => assertTablesAligned(dropped), 'NEGATIVO: célula faltando é detectada');
  // Tela: todo clique aponta para um alvo real; linha, célula e coluna abrem o detalhe exato (mesmas pesagens).
  const screen = renderSheetBody(doc, { mode: 'fragment', interactive: true });
  const drills = [...screen.matchAll(/data-drill="([^"]+)"/g)].map(([, id]) => id.replace(/&amp;/g, '&'));
  assert.ok(drills.length > 0 && drills.every((id) => doc.drillTargets[id]), 'tela: cada clique aponta para um alvo da folha');
  assert.ok(!/data-sort=/.test(screen), 'tela: a matriz não oferece ordenar pelo cabeçalho (é o "Ordenar por")');
  const drillIds = async (path) => {
    const vm = await run(DEZ_SET, { matrix: { eixoY: 'lote', eixoX: 'mes' }, drill: path.map(({ columnId, key }) => ({ columnId, key })), mode: 'DETALHADO' });
    assert.equal(vm.mode, 'DETALHADO', 'detalhe = Detalhado');
    assert.equal(isMatrixViewModel(vm), false, 'detalhe não é matriz');
    assert.equal(buildReportDocument(vm).layout, 'detail', 'detalhe: folha do Detalhado');
    return vm.rows.map((row) => row.id).sort();
  };
  const cellTarget = rows[0].cells[1].drill;
  assert.deepEqual(await drillIds(doc.drillTargets[cellTarget]), ['m2', 'm3'], 'clique em Lote 01 × dez/2025 = A7 250 e A5 215');
  assert.deepEqual(await drillIds(doc.drillTargets[rows[3].cells[1].drill]), ['m1', 'm2', 'm3'], 'clique em TOTAL × dez/2025 = as 3 pesagens do mês');
  const noneRow = rows[2];
  assert.ok(doc.drillTargets[noneRow.drill].some((part) => part.key === NONE_GROUP_KEY), '"Não informado" abre pela chave exata');
  assert.deepEqual(await drillIds(doc.drillTargets[noneRow.drill]), ['e9', 'm5'], 'clique em "Não informado" = A4 e A6');
  assert.equal(rows[1].cells[2].drill, null, 'cruzamento vazio não abre nada');
  assert.equal(rows[3].cells[5].drill, null, 'canto não abre nada');
  // Impressão/PDF: o mesmo documento.
  const printed = preparePrint(vm34, ADMIN, { orientation: 'auto' });
  assert.equal(printed.document.layout, 'matrix', 'impressão: folha da matriz');
  assert.ok(printed.html.includes('232,5 kg') && printed.html.includes(doc.matrix.legend), 'impressão: valores e legenda');
  assert.ok(printed.layout.fits, '3×4 cabe na página');
  results.push({ caso: 'folha 3×4', orientacao: printed.layout.orientation, fonte: printed.layout.sizeClass, cliques: drills.length });
}
{
  // Muitas colunas (Sexo × Mês de out/2024 a set/2026 = 18 meses): paisagem/fonte menor/aviso, nunca corta.
  const vm = await run(WIDE, { matrix: { eixoY: 'sexo', eixoX: 'mes' } });
  const matrix = buildMatrix(vm);
  assert.equal(matrix.columns.length, 18, 'largura: 18 meses');
  const keys = matrix.columns.map((column) => column.key);
  assert.deepEqual(keys, [...keys].sort(), 'largura: meses em ordem cronológica');
  const auto = buildReportDocument(vm);
  assert.equal(auto.columns.length, 20, 'largura: nenhuma coluna cortada (Sexo + 18 meses + TOTAL)');
  assert.equal(auto.print.columnCount, 20, 'largura: layout com todas as colunas');
  assert.equal(auto.print.widths.length, 20, 'largura: uma largura por coluna');
  assert.equal(auto.print.orientation, 'landscape', 'largura: não cabe em retrato → paisagem');
  assert.ok(auto.print.fits ? auto.print.sizeClass !== 'm' : auto.print.warning?.code === 'PRINT_TOO_WIDE', 'largura: cabe só com fonte menor, ou avisa');
  const portrait = buildReportDocument(vm, { orientation: 'portrait' });
  assert.equal(portrait.print.fits, false, 'largura: retrato escolhido não cabe');
  assert.equal(portrait.print.warning?.code, 'PRINT_TOO_WIDE', 'largura: retrato → aviso "muitas colunas"');
  assert.ok(portrait.print.warning.options.includes('paisagem'), 'largura: o aviso oferece paisagem');
  assert.equal(portrait.columns.length, 20, 'largura: nem com aviso some coluna');
  assert.equal(preparePrint(vm, ADMIN, { orientation: 'portrait' }).layout.fits, false, 'largura: a impressão em retrato pergunta antes (printReport bloqueia)');
  results.push({ caso: 'muitas colunas', colunas: auto.columns.length, orientacao: auto.print.orientation, fonte: auto.print.sizeClass, cabe: auto.print.fits });
}

// ---- f) XLSX ----
const decode = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const letterIndex = (letters) => [...letters].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
function parseSheet(xml) {
  return [...xml.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)].map(([, rowNumber, body]) => {
    const cells = [];
    for (const [, letters, style, inline, inner] of body.matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"( t="inlineStr")?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      let value = null;
      let type = null;
      if (inner !== undefined) {
        const number = !inline && inner.match(/^<v>([^<]*)<\/v>$/);
        const text = inline && inner.match(/^<is><t xml:space="preserve">([\s\S]*?)<\/t><\/is>$/);
        if (number) { value = Number(number[1]); type = 'n'; } else if (text) { value = decode(text[1]); type = 's'; } else throw new Error(`célula ilegível: ${inner}`);
      }
      cells[letterIndex(letters)] = { value, type, style: Number(style), ref: `${letters}${rowNumber}` };
    }
    return { number: Number(rowNumber), cells };
  });
}
async function emitXlsx(vm) {
  const { content } = await prepareEmission(vm, 'xlsx', ADMIN);
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  let position = 0;
  while (view.getUint32(position, true) === 0x04034b50) {
    const crc = view.getUint32(position + 14, true);
    const size = view.getUint32(position + 18, true);
    const start = position + 30 + view.getUint16(position + 26, true);
    assert.equal(crc32(content.subarray(start, start + size)), crc, 'XLSX: CRC da entrada (o Excel abre sem reparo)');
    position = start + size;
  }
  const files = unzipStored(content);
  return { files, sheet: files['xl/worksheets/sheet1.xml'] };
}
const STYLE = { text: 1, header: 2, total: 4, int: 8, num1: 11, num3: 7 };
const METRIC_HEADERS = ['Qtd', 'Peso médio (kg)', 'GMD médio (kg/dia)'];
const METRIC_STYLES = [STYLE.int, STYLE.num1, STYLE.num3];
const HEADER_ROW = 7; // título, 4 metadados, branco → 1ª linha do cabeçalho da matriz
const printedNumber = (text) => (text === '—' ? null : Number(text.replace(/ kg$/, '').replace(/\./g, '').replace(',', '.')));

/** Compara a planilha (o arquivo) com a folha, célula a célula. Lança na primeira divergência. */
function checkXlsxAgainstSheet(name, vm, rows) {
  const doc = buildReportDocument(vm, { showEmptyColumns: true });
  const docRows = documentRows(doc);
  const groups = doc.columns.slice(1);
  const per = METRIC_HEADERS.length;
  // Casas de cada valor = as da coluna do agregado (as mesmas de formatCell): Qtd 0, kg 1, GMD 3.
  const decimals = buildMatrix(vm).metrics.map((metric) => (Number.isInteger(metric.column.decimals) ? metric.column.decimals : DEFAULT_DECIMALS[metric.column.type] ?? 2));
  assert.deepEqual(decimals, [0, 1, 3], `${name}: Qtd inteira, kg com 1 casa, GMD com 3`);
  const width = 1 + groups.length * per;
  const headerX = rows[HEADER_ROW - 1];
  const headerValues = rows[HEADER_ROW];
  assert.equal(headerX.cells.length, width, `${name}: cabeçalho na largura da matriz`);
  assert.equal(headerX.cells[0].value, doc.columns[0].label, `${name}: rótulo do eixo Y no cabeçalho`);
  assert.equal(headerValues.cells[0].value, null, `${name}: rótulo do eixo Y ocupa as 2 linhas (mesclado)`);
  groups.forEach((column, index) => {
    const first = 1 + index * per;
    assert.equal(headerX.cells[first].value, column.label, `${name}: cabeçalho ${column.label} (= folha)`);
    for (let offset = 1; offset < per; offset += 1) assert.equal(headerX.cells[first + offset].value, null, `${name}: ${column.label} só na 1ª das suas colunas (mesclado)`);
    assert.deepEqual(METRIC_HEADERS.map((_, offset) => headerValues.cells[first + offset].value), METRIC_HEADERS, `${name}: ${column.label} × Qtd / Peso médio (kg) / GMD médio (kg/dia)`);
  });
  assert.ok([...headerX.cells, ...headerValues.cells].every((cell) => cell.style === STYLE.header), `${name}: cabeçalho no estilo de cabeçalho`);
  const body = rows.slice(HEADER_ROW + 1);
  assert.equal(body.length, docRows.length, `${name}: uma linha por Y + TOTAL (= folha)`);
  let compared = 0;
  docRows.forEach((docRow, rowIndex) => {
    const row = body[rowIndex];
    const total = docRow.type === DOC_ROW_TYPES.GRAND_TOTAL;
    const where = `${name} · ${docRow.cells[0].text}`;
    assert.equal(row.cells.length, width, `${where}: uma célula por coluna`);
    assert.equal(row.cells[0].value, docRow.cells[0].text, `${where}: rótulo = folha`);
    assert.equal(row.cells[0].style, total ? STYLE.total : STYLE.text, `${where}: estilo do rótulo`);
    groups.forEach((column, columnIndex) => {
      const docCell = docRow.cells[columnIndex + 1];
      for (let metric = 0; metric < per; metric += 1) {
        const cell = row.cells[1 + columnIndex * per + metric];
        const at = `${where} × ${column.label} · ${METRIC_HEADERS[metric]}`;
        const raw = docCell.raw ? docCell.raw[metric] : null;
        const expected = raw === null ? null : roundTo(raw, decimals[metric]);
        if (expected === null) {
          assert.equal(cell.value, null, `${at} = folha (vazio)`);
          assert.equal(cell.style, total ? STYLE.total : STYLE.text, `${at}: vazio no estilo da linha`);
        } else {
          assert.equal(cell.type, 'n', `${at}: número (nunca texto)`);
          assert.equal(cell.value, expected, `${at} = folha (${docCell.lines[metric]})`);
          assert.equal(cell.style, METRIC_STYLES[metric], `${at}: formato da coluna`);
          assert.equal(printedNumber(docCell.lines[metric]), expected, `${at}: o que a folha imprime = o número da planilha`);
        }
        compared += 1;
      }
    });
  });
  return compared;
}
const xlsxCases = [['2×2 Sexo × Mês', vm22], ['3×4 Lote × Mês', vm34], ['padrão Sexo × Lote', await run(AGO_SET)]];
const keptXlsx = {};
for (const [name, vm] of xlsxCases) {
  const { files, sheet } = await emitXlsx(vm);
  assert.ok(files['xl/workbook.xml'].includes('<sheet name="Manifesto"'), `${name}: aba de manifesto`);
  const rows = parseSheet(sheet);
  const built = buildSheetRows(vm);
  assert.equal(rows.length, built.rows.length, `${name}: linhas do arquivo = linhas montadas`);
  assert.deepEqual(built.rows.slice(HEADER_ROW - 1).map((row) => row.kind), [XLSX_MATRIX_KINDS.HEADER_X, XLSX_MATRIX_KINDS.HEADER_VALUES, ...buildMatrix(vm).rows.map(() => XLSX_MATRIX_KINDS.ROW), XLSX_MATRIX_KINDS.TOTAL], `${name}: cabeçalho em 2 linhas, linhas de Y, TOTAL`);
  const groupCount = buildMatrix(vm).columns.length + 1;
  const merges = [`A${HEADER_ROW}:A${HEADER_ROW + 1}`, ...Array.from({ length: groupCount }, (_, index) => `${columnLetter(1 + index * 3)}${HEADER_ROW}:${columnLetter(3 + index * 3)}${HEADER_ROW}`)];
  assert.ok(sheet.includes(`<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`), `${name}: valor de X mesclado sobre as 3 colunas; eixo Y nas 2 linhas`);
  assert.ok(sheet.includes(`<pane xSplit="1" ySplit="${HEADER_ROW + 1}" topLeftCell="B${HEADER_ROW + 2}" activePane="bottomRight" state="frozen"/>`), `${name}: cabeçalho e coluna do eixo Y congelados`);
  assert.ok(rows[3].cells[1].value.startsWith('Linhas: '), `${name}: "Agrupado por" com a legenda da matriz`);
  const compared = checkXlsxAgainstSheet(name, vm, rows);
  keptXlsx[name] = { vm, sheet, rows };
  results.push({ caso: `XLSX ${name}`, celulasComparadas: compared });
}
{
  // Números conferidos à mão também no arquivo: Lote 01 × dez/2025 = 2 / 232,5 / 0,750; canto = 7 / 265,6 / 0,792.
  const { rows } = keptXlsx['3×4 Lote × Mês'];
  const pick = (row, first) => [row.cells[first].value, row.cells[first + 1].value, row.cells[first + 2].value];
  const body = rows.slice(HEADER_ROW + 1);
  assert.deepEqual(pick(body[0], 1), [2, 232.5, 0.75], 'XLSX: Lote 01 × dez/2025');
  assert.deepEqual(pick(body[1], 4), [null, null, null], 'XLSX: Lote 02 × jan/2026 vazio');
  assert.deepEqual(pick(body[1], 1), [1, 200, null], 'XLSX: Lote 02 × dez/2025 com GMD vazio (sem anterior)');
  assert.deepEqual(pick(body[3], 13), [7, 265.6, 0.792], 'XLSX: canto');
  // Adulterações são detectadas pela comparação com a folha.
  const { vm, sheet } = keptXlsx['3×4 Lote × Mês'];
  const setCell = (xml, ref, cell) => {
    const pattern = new RegExp(`<c r="${ref}" [^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);
    assert.ok(pattern.test(xml), `célula ${ref} existe`);
    return xml.replace(pattern, cell);
  };
  const first = HEADER_ROW + 2; // 1ª linha de dados
  const tampered = [
    ['Qtd somada no canto', setCell(sheet, `N${first + 3}`, `<c r="N${first + 3}" s="8"><v>8</v></c>`), /= folha/],
    ['média das médias no TOTAL do Lote 01', setCell(sheet, `O${first}`, `<c r="O${first}" s="11"><v>293.3</v></c>`), /= folha/],
    ['GMD 0 onde não há anterior', setCell(sheet, `D${first + 1}`, `<c r="D${first + 1}" s="7"><v>0</v></c>`), /= folha/],
    ['rótulo da linha trocado', setCell(sheet, `A${first}`, `<c r="A${first}" s="1" t="inlineStr"><is><t xml:space="preserve">Lote 02</t></is></c>`), /rótulo = folha/],
    ['número gravado como texto', setCell(sheet, `B${first}`, `<c r="B${first}" s="8" t="inlineStr"><is><t xml:space="preserve">2</t></is></c>`), /número \(nunca texto\)/],
    ['cabeçalho de mês trocado', setCell(sheet, `B${HEADER_ROW}`, `<c r="B${HEADER_ROW}" s="2" t="inlineStr"><is><t xml:space="preserve">ago/2026</t></is></c>`), /cabeçalho dez\/2025/],
  ];
  for (const [label, xml, reason] of tampered) {
    assert.notEqual(xml, sheet, `adulteração aplicada: ${label}`);
    assert.throws(() => checkXlsxAgainstSheet(label, vm, parseSheet(xml)), (error) => reason.test(error.message), `NEGATIVO: ${label} é detectado (${reason})`);
  }
  assert.ok(checkXlsxAgainstSheet('controle', vm, parseSheet(sheet)) > 0, 'controle: arquivo íntegro passa');
  results.push({ caso: 'XLSX adulterado', adulteracoes: tampered.map(([label]) => label) });
}
{
  // Os outros tipos: XLSX exatamente como antes (painel de 7 linhas, sem células mescladas), folha sem matriz.
  const vm = await runReport('pesagens', { today: TODAY, params: { periodo: AGO_SET }, selection: viewSelection('por-apartacao-data', PESAGENS), arrobaDivisor: 30 }, ADMIN);
  assert.equal(isMatrixViewModel(vm), false, 'NEGATIVO: Resumo por Data não é matriz');
  const doc = buildReportDocument(vm);
  assert.equal(doc.layout, 'summary', 'NEGATIVO: Resumo por Data continua a folha resumida');
  assert.equal(doc.matrix, null, 'NEGATIVO: documento sem matriz');
  const { sheet } = await emitXlsx(vm);
  assert.ok(sheet.includes('<pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>') && !sheet.includes('<mergeCells'), 'NEGATIVO: XLSX dos outros tipos sem mudança (painel de 7 linhas, sem mescla)');
  assert.ok(!buildSheetRows(vm).rows.some((row) => Object.values(XLSX_MATRIX_KINDS).includes(row.kind)), 'NEGATIVO: nenhuma linha de matriz fora do Sintético (Matriz)');
  // Personalizado com os mesmos 2 níveis (sem tipo) também não é matriz.
  const custom = await runReport('pesagens', { today: TODAY, params: { periodo: AGO_SET }, selection: { view: null, mode: 'RESUMIDO', groups: [{ columnId: 'sexo' }, { columnId: 'mes_pesagem' }], aggregates: MATRIX_TOTALS }, arrobaDivisor: 30 }, ADMIN);
  assert.equal(isMatrixViewModel(custom), false, 'NEGATIVO: Personalizado Sexo › Mês é o Resumido comum');
  assert.equal(buildReportDocument(custom).layout, 'summary', 'NEGATIVO: Personalizado Sexo › Mês = folha resumida');
}

// ---- g) DECLARADO: CSV e JSON do Sintético (Matriz) = Resumido de 2 níveis, mesmos números ----
{
  const vm = vm34;
  const layout = buildSummaryLayout(vm, 'csv');
  const csvText = (await prepareEmission(vm, 'csv', ADMIN)).content;
  const csv = parseCsv(csvText).filter((row) => row.length > 1);
  assert.deepEqual(csv[0].slice(3, 5), ['Lote', 'Mês'], 'CSV: colunas de nível Lote e Mês (Resumido de 2 níveis)');
  assert.equal(csv.length - 1, layout.rows.length, 'CSV: uma linha por grupo (3 lotes + 9 cruzamentos com pesagem) + Total geral');
  assert.equal(layout.rows.length, 3 + (4 + 3 + 2) + 1, 'CSV: 13 linhas conferidas à mão (cruzamento vazio não vira linha)');
  assert.deepEqual([...new Set(csv.slice(1).map((row) => row[0]))].sort(), ['GRAND_TOTAL', 'SUMMARY'], 'CSV: só SUMMARY e GRAND_TOTAL (sem desenho de matriz)');
  const json = JSON.parse((await prepareEmission(vm, 'json', ADMIN)).content);
  assert.equal(json.mode, 'RESUMIDO', 'JSON: Resumido');
  assert.deepEqual(json.groups.map((level) => level.columnId), ['nome_lote', 'mes_pesagem'], 'JSON: Linhas › Colunas');
  assert.equal(json.summary.rows.length, layout.rows.length, 'JSON: mesmas linhas do CSV');
  // Mesmos números da matriz: TOTAL do Lote 01, Lote 01 × dez/2025 e o canto.
  const matrix = case34.matrix;
  const jsonRow = (label, level) => json.summary.rows.find((row) => row.level === level && row.label === label);
  assert.deepEqual(Object.values(jsonRow('Lote 01', 1).values), matrixValues(matrix, matrix.rows[0].total), 'JSON: Lote 01 = TOTAL da linha na matriz');
  const lote01Dez = json.summary.rows.find((row) => row.level === 2 && row.path[0].label === 'Lote 01' && row.label === 'dez/2025');
  assert.deepEqual(Object.values(lote01Dez.values), matrixValues(matrix, matrix.rows[0].cells[0]), 'JSON: Lote 01 › dez/2025 = célula da matriz');
  assert.deepEqual(Object.values(json.summary.rows.at(-1).values), matrixValues(matrix, matrix.totalRow.total), 'JSON: Total geral = canto');
  results.push({ caso: 'CSV/JSON (Resumido de 2 níveis, declarado)', linhas: layout.rows.length });
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:matrix:verify', ok: true, cases: results }, null, 2));
