// Gate reports:sheet-xlsx-parity:verify (E1C 1.4.0, resposta 9 ao REPORT da E1B) — o bloco
// "TOTAL POR <nível folha> – <nível 1>" da FOLHA também no XLSX do Resumido com 3 níveis:
//   a) o XLSX é aberto (unzipStored) e cada bloco é comparado célula a célula com as linhas LEAF_TOTAL e
//      TOTAL da folha (buildReportDocument): título, rótulo, métrica a métrica com os números canônicos
//      (arredondados na casa da coluna), números como células numéricas e no mesmo formato das outras
//      linhas da planilha; o bloco fecha o nó de nível 1 (antes do próximo nível 1 ou do Total geral);
//   b) a faixa exigida (par leafOnly, colunas mínima/máxima) só nas linhas do lote do bloco — nunca no
//      "Total <nível 1>"; o Total é o nó de nível 1 (população inteira), nunca soma das linhas;
//   c) casos: Pesagens › Por apartação (resumo por data) — E1D: o tipo com as colunas padrão e com todas —,
//      com ordem por métrica e divisor 15, folha por data (faixa fora), sem totais (contagem de linhas) e
//      Desempenho apartação › lote › sexo;
//   d) NEGATIVOS: com 1 ou 2 níveis e no Detalhado não há bloco; o CSV e o JSON não têm o bloco; XLSX
//      adulterado (valor, rótulo, faixa no Total, Total somado, título removido) é detectado.
import assert from 'node:assert/strict';
import { ADMIN, TODAY, resetDb, seedReportFixture } from './lib/reportFixtures.mjs';
import { runReport } from '../src/modules/reporting/application/reportService.js';
import { prepareEmission } from '../src/modules/reporting/application/reportExportService.js';
import { getReportDefinition } from '../src/modules/reporting/definitions/reportCatalog.js';
import { SHEET_COLUMN_KEYS, SHEET_TOTALS } from '../src/modules/reporting/definitions/pesagens.js';
import { applyColumnKeys, listReportViews, viewSelection } from '../src/modules/reporting/domain/reportViews.js';
import { buildReportDocument, buildLeafTotalBlock, DOC_ROW_TYPES } from '../src/modules/reporting/domain/reportDocument.js';
import { buildSummaryLayout } from '../src/modules/reporting/domain/summaryLayout.js';
import { DEFAULT_DECIMALS, roundTo } from '../src/modules/reporting/domain/reportFormatting.js';
import { parseCsv } from '../src/modules/reporting/infrastructure/exporters/csvExporter.js';
import { buildSheetRows, crc32, unzipStored, XLSX_BLOCK_KINDS } from '../src/modules/reporting/infrastructure/exporters/xlsxExporter.js';

await seedReportFixture();
const P = { periodo: { preset: 'personalizado', from: '2026-08-01', to: '2026-09-15' } };
const PESAGENS = getReportDefinition('pesagens');
const STYLE = { text: 1, total: 4, group: 5, subtotal: 9, num1: 11, num2: 6, num3: 7, int: 8 };
const TOP_ROWS = 7; // título, 4 metadados, branco, cabeçalho
const run = (id, selection, extra = {}) => runReport(id, { today: TODAY, params: P, selection, arrobaDivisor: 30, ...extra }, ADMIN);
const decimalsOf = (metric) => (Number.isInteger(metric.column.decimals) ? metric.column.decimals : DEFAULT_DECIMALS[metric.column.type] ?? 2);

// ---- leitura do XLSX (o próprio arquivo, não o modelo) ----
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
  const files = unzipStored(content);
  return { content, files, sheet: files['xl/worksheets/sheet1.xml'] };
}
const valueAt = (row, index) => row.cells[index]?.value ?? null;
const isBlockTitle = (row) => typeof valueAt(row, 0) === 'string' && valueAt(row, 0).startsWith('TOTAL POR ');

/**
 * Compara cada bloco "TOTAL POR" do XLSX com a folha. Lança na primeira divergência.
 * @returns {{ blocks: number, lines: number, cells: number, found: object[] }}
 */
function checkBlocks(name, vm, rows) {
  const layout = buildSummaryLayout(vm, 'xlsx');
  const { groupHeaders, metrics, headers } = layout;
  const groupCount = groupHeaders.length;
  // Folha com TODAS as colunas (mostrar colunas vazias): cada métrica do XLSX tem a sua coluna na folha.
  const doc = buildReportDocument(vm, { showEmptyColumns: true });
  const shownDoc = buildReportDocument(vm);
  const sections = doc.sections.filter((section) => section.leafTotal);
  assert.deepEqual(shownDoc.sections.filter((section) => section.leafTotal).map((section) => section.leafTotal.title), sections.map((section) => section.leafTotal.title), `${name}: mesmos blocos na folha com e sem colunas vazias`);
  assert.deepEqual(rows[TOP_ROWS - 1].cells.map((cell) => cell?.value ?? null), headers, `${name}: cabeçalho do XLSX`);
  const body = rows.slice(TOP_ROWS);

  // Blocos no arquivo: título (A = "TOTAL POR …"), linhas com A vazio, linha "Total …".
  const blocks = [];
  let level1 = null;
  for (let index = 0; index < body.length; index += 1) {
    const first = valueAt(body[index], 0);
    if (isBlockTitle(body[index])) {
      const lines = [];
      let cursor = index + 1;
      while (cursor < body.length && valueAt(body[cursor], 0) === null) lines.push(body[cursor++]);
      const total = body[cursor];
      assert.ok(total && String(valueAt(total, 0)).startsWith('Total '), `${name}: bloco ${first} fecha com a linha "Total …"`);
      blocks.push({ title: body[index], lines, total, level1, next: body[cursor + 1] ?? null });
      index = cursor;
    } else if (first !== null) {
      level1 = first; // linha de nível 1 (ou o Total geral)
    }
  }
  assert.equal(blocks.length, sections.length, `${name}: um bloco TOTAL POR por seção de nível 1 da folha (${blocks.length} × ${sections.length})`);

  // Formato de cada coluna de métrica = o das linhas normais da planilha (grupos e Total geral).
  const blockRows = new Set(blocks.flatMap((block) => [block.title, ...block.lines, block.total]));
  const numericStyle = new Map();
  for (const row of body.filter((item) => !blockRows.has(item))) {
    metrics.forEach((_, metricIndex) => {
      const cell = row.cells[groupCount + metricIndex];
      if (cell?.type === 'n') numericStyle.set(metricIndex, new Set([...(numericStyle.get(metricIndex) ?? []), cell.style]));
    });
  }
  for (const [metricIndex, styles] of numericStyle) assert.equal(styles.size, 1, `${name}: coluna ${metrics[metricIndex].key} com um formato só`);

  const docColumnOf = (metric) => doc.columns.find((column) => column.kind === 'metric' && column.key === metric.key)
    ?? doc.columns.find((column) => column.kind === 'pair' && (column.from.key === metric.key || column.to.key === metric.key));
  let cellsChecked = 0;
  const compareLine = (row, docRow, { labelIndex, leaf, where }) => {
    const labelStyle = leaf ? STYLE.text : STYLE.subtotal;
    assert.equal(row.cells.length, headers.length, `${where}: uma célula por coluna`);
    groupHeaders.forEach((_, index) => {
      assert.equal(valueAt(row, index), index === labelIndex ? docRow.cells[0].text : null, `${where}: rótulo na coluna ${index === labelIndex ? 'do nível' : 'vazia'} ${index}`);
      assert.equal(row.cells[index].style, labelStyle, `${where}: estilo do rótulo`);
    });
    metrics.forEach((metric, metricIndex) => {
      const cell = row.cells[groupCount + metricIndex];
      const value = cell.value;
      const docColumn = docColumnOf(metric);
      assert.ok(docColumn, `${where}: métrica ${metric.key} tem coluna na folha`);
      const docCell = docRow.cells[docColumn.index];
      assert.equal(docCell.key, docColumn.key, `${where}: célula da folha sob a coluna ${docColumn.key}`);
      if (value === null) assert.equal(cell.style, labelStyle, `${where}: ${metric.key} vazio no estilo da linha`);
      else {
        assert.equal(cell.type, 'n', `${where}: ${metric.key} como número (nunca texto)`);
        if (numericStyle.has(metricIndex)) assert.equal(cell.style, [...numericStyle.get(metricIndex)][0], `${where}: ${metric.key} no mesmo formato das outras linhas`);
      }
      if (docColumn.kind === 'pair') {
        // Faixa: vazia fora da linha do lote (folha ''), senão de–até canônicos.
        if (docCell.text === '') assert.equal(value, null, `${where}: ${metric.key} vazio (faixa só na linha do lote)`);
        else {
          const raw = docCell.raw[docColumn.from.key === metric.key ? 0 : 1];
          assert.equal(value, raw === null ? null : roundTo(raw, decimalsOf(metric)), `${where}: ${metric.key} = folha (${docCell.text})`);
        }
      } else if (docCell.raw === null) {
        // Contagem 0 aparece "—" na folha (zeroAsEmpty); na planilha fica 0, como nas outras linhas.
        assert.ok(value === null || (docColumn.zeroAsEmpty && value === 0), `${where}: ${metric.key} vazio na folha → vazio (ou 0 de contagem) no XLSX, veio ${value}`);
      } else {
        assert.equal(value, roundTo(docCell.raw, decimalsOf(metric)), `${where}: ${metric.key} = folha (${docCell.text})`);
      }
      cellsChecked += 1;
    });
  };

  blocks.forEach((block, index) => {
    const section = sections[index];
    const where = `${name} · ${section.leafTotal.title}`;
    const docLines = section.leafTotal.rows.filter((row) => row.type === DOC_ROW_TYPES.LEAF_TOTAL);
    const docTotal = section.leafTotal.rows.find((row) => row.type === DOC_ROW_TYPES.TOTAL);
    assert.equal(valueAt(block.title, 0), section.leafTotal.title, `${where}: título = folha`);
    assert.equal(block.title.cells.length, headers.length, `${where}: título na largura da tabela`);
    assert.ok(block.title.cells.every((cell) => cell.style === STYLE.group) && block.title.cells.slice(1).every((cell) => cell.value === null), `${where}: título em estilo de grupo, só na coluna A`);
    // Posição: o bloco fecha o nó de nível 1 da seção e vem antes do próximo nível 1 (ou do Total geral).
    assert.equal(`Total ${block.level1}`, docTotal.cells[0].text, `${where}: bloco depois das linhas do próprio nível 1`);
    assert.ok(block.next && valueAt(block.next, 0) !== null && !isBlockTitle(block.next), `${where}: depois do bloco vem o próximo nível 1 ou o Total geral`);
    assert.equal(block.lines.length, docLines.length, `${where}: uma linha por grupo do nível folha`);
    block.lines.forEach((line, lineIndex) => compareLine(line, docLines[lineIndex], { labelIndex: groupCount - 1, leaf: true, where: `${where} · ${docLines[lineIndex].cells[0].text}` }));
    compareLine(block.total, docTotal, { labelIndex: 0, leaf: false, where: `${where} · ${docTotal.cells[0].text}` });
  });

  // Fora dos blocos, a planilha continua EXATAMENTE a do layout (uma linha por grupo + Total geral).
  const plain = body.filter((row) => !blockRows.has(row)).map((row) => row.cells.map((cell) => cell?.value ?? null));
  assert.deepEqual(plain, layout.rows.map((row) => row.cells), `${name}: linhas fora do bloco = layout do Resumido`);
  return { blocks: blocks.length, lines: blocks.reduce((sum, block) => sum + block.lines.length + 1, 0), cells: cellsChecked, found: blocks };
}

// ---- a/b/c) casos com 3 níveis ----
// E1D: o tipo "Por Apartação (Resumo por Data)" (colunas padrão do tipo: Qtd, Faixa, Menor, Maior, Peso médio,
// Média @, Peso total, GMD médio, Machos, Fêmeas) e, num caso, com TODAS as colunas do seletor.
const PAD_VIEW = listReportViews(PESAGENS).find((view) => view.id === 'por-apartacao-data');
const PAD = viewSelection(PAD_VIEW, PESAGENS);
const cases = [
  { name: 'Pesagens › Por apartação (resumo por data)', id: 'pesagens', selection: PAD },
  { name: 'Por apartação com todas as colunas', id: 'pesagens', selection: { ...PAD, ...applyColumnKeys(PAD_VIEW, PESAGENS, SHEET_COLUMN_KEYS) } },
  { name: 'Por apartação, ordem Peso médio crescente', id: 'pesagens', selection: { ...PAD, summarySort: { key: 'peso_medio', direction: 'asc' } } },
  { name: 'Por apartação, divisor 15', id: 'pesagens', selection: PAD, extra: { arrobaDivisor: 15 } },
  { name: 'Apartação › Lote › Data (faixa fora)', id: 'pesagens', selection: { mode: 'RESUMIDO', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }, { columnId: 'data_pesagem', direction: 'desc' }], aggregates: SHEET_TOTALS } },
  { name: 'Apartação › Data › Lote sem totais (contagem de linhas)', id: 'pesagens', selection: { mode: 'RESUMIDO', groups: PAD.groups, aggregates: [] } },
  { name: 'Desempenho apartação › lote › sexo', id: 'desempenho', selection: { mode: 'RESUMIDO', groups: [{ columnId: 'apartacao' }, { columnId: 'lote' }, { columnId: 'sexo' }] } },
];
const results = [];
const kept = {};
for (const testCase of cases) {
  const vm = await run(testCase.id, testCase.selection, testCase.extra);
  assert.equal(vm.groups.length, 3, `${testCase.name}: 3 níveis`);
  const { content, files, sheet } = await emitXlsx(vm);
  // ZIP íntegro (CRC de cada entrada) — o Excel abre sem reparo.
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  let position = 0;
  let entries = 0;
  while (view.getUint32(position, true) === 0x04034b50) {
    const crc = view.getUint32(position + 14, true);
    const size = view.getUint32(position + 18, true);
    const start = position + 30 + view.getUint16(position + 26, true);
    assert.equal(crc32(content.subarray(start, start + size)), crc, `${testCase.name}: CRC da entrada`);
    position = start + size;
    entries += 1;
  }
  assert.equal(entries, 7, `${testCase.name}: 7 partes no pacote`);
  assert.ok(files['xl/workbook.xml'].includes('<sheet name="Manifesto"'), `${testCase.name}: aba de manifesto`);
  const rows = parseSheet(sheet);
  // O arquivo = as linhas montadas (mesma quantidade e mesmos tipos do bloco).
  const built = buildSheetRows(vm).rows;
  assert.equal(rows.length, built.length, `${testCase.name}: linhas do arquivo = linhas montadas`);
  built.forEach((row, index) => {
    if (row.kind === XLSX_BLOCK_KINDS.TITLE) assert.ok(isBlockTitle(rows[index]), `${testCase.name}: linha ${index + 1} é título de bloco`);
  });
  const result = checkBlocks(testCase.name, vm, rows);
  assert.ok(result.blocks >= 1, `${testCase.name}: há bloco`);
  // Largura da coluna A: o título do bloco transborda para as células vazias, não alarga a coluna.
  const widthA = Number(sheet.match(/<col min="1" max="1" width="(\d+)"/)[1]);
  const longestA = Math.max(...rows.slice(TOP_ROWS - 1).filter((row) => !isBlockTitle(row)).map((row) => String(valueAt(row, 0) ?? '').length));
  assert.equal(widthA, Math.min(48, Math.max(10, longestA + 2)), `${testCase.name}: coluna A pela maior célula fora do título do bloco`);
  kept[testCase.name] = { vm, rows, sheet, result };
  results.push({ caso: testCase.name, blocos: result.blocks, linhasBloco: result.lines, celulasComparadas: result.cells });
}

// Números conferidos à mão no bloco de Engorda (massa de reportFixtures): Lote 01 = A1 (300, 330, 345) + A3
// (410, saída sem peso) → 2 cabeças, médio 346,25, total 1.385; Lote 02 = A2 (250, 260, 280); Total Engorda =
// 3 cabeças (A1, A2, A3) — a soma das 7 datas daria 7: o Total é o nó, nunca soma de linhas.
{
  const { vm, rows, result } = kept['Pesagens › Por apartação (resumo por data)'];
  const layout = buildSummaryLayout(vm, 'xlsx');
  const col = (key) => layout.groupHeaders.length + layout.metrics.findIndex((metric) => metric.key === key);
  const engorda = result.found.find((block) => valueAt(block.title, 0) === 'TOTAL POR LOTE – ENGORDA');
  assert.ok(engorda, 'bloco "TOTAL POR LOTE – ENGORDA"');
  const pick = (row, keys) => keys.map((key) => valueAt(row, col(key)));
  const keys = ['qtd', 'faixa_min', 'faixa_max', 'menor', 'maior', 'peso_medio', 'peso_total', 'media_arroba', 'gmd_medio', 'machos', 'femeas'];
  assert.deepEqual(engorda.lines.map((row) => valueAt(row, 2)), ['Lote 01', 'Lote 02'], 'Engorda: Lote 01 e Lote 02 na coluna Lote');
  assert.deepEqual(pick(engorda.lines[0], keys), [2, 300, 400, 300, 410, 346.3, 1385, 11.54, 1.125, 2, 0], 'Lote 01 (todas as datas)');
  // E1G: a saída com peso do Lote 02 (260 → 280 em 21 d) entra no GMD: (10 + 20) ÷ (10 + 21) = 0,968; Engorda 75 ÷ 71.
  assert.deepEqual(pick(engorda.lines[1], keys), [1, 200, 300, 250, 280, 263.3, 790, 8.78, 0.968, 0, 1], 'Lote 02 (todas as datas)');
  assert.equal(valueAt(engorda.total, 0), 'Total Engorda');
  assert.deepEqual(pick(engorda.total, keys), [3, null, null, 250, 410, 310.7, 2175, 10.36, 1.056, 2, 1], 'Total Engorda = nó de nível 1, sem faixa');
  const dateQtd = rows.slice(TOP_ROWS).filter((row) => valueAt(row, 1) !== null).map((row) => valueAt(row, col('qtd')));
  assert.ok(dateQtd.length > 1 && dateQtd.reduce((sum, value) => sum + value, 0) > valueAt(engorda.total, col('qtd')), 'Qtd do Total não é a soma das datas (cabeças distintas)');
  // Formatos: kg #,##0.0 (11), @ #,##0.00 (6), GMD #,##0.000 (7), contagem #,##0 (8).
  assert.deepEqual(['peso_medio', 'media_arroba', 'gmd_medio', 'qtd'].map((key) => engorda.lines[0].cells[col(key)].style), [STYLE.num1, STYLE.num2, STYLE.num3, STYLE.int], 'formatos do Excel no bloco');
  assert.equal(engorda.total.cells[0].style, STYLE.subtotal, '"Total Engorda" no estilo de subtotal');
  // A faixa (b): preenchida nas linhas de lote do bloco, nunca na linha "Total …".
  for (const block of result.found) {
    assert.deepEqual(pick(block.total, ['faixa_min', 'faixa_max']), [null, null], `${valueAt(block.title, 0)}: sem faixa no "Total …"`);
  }
  assert.ok(result.found.some((block) => block.lines.some((row) => valueAt(row, col('faixa_min')) !== null)), 'faixa aparece nas linhas de lote do bloco');
}
// Ordem das linhas do bloco = ordem do Resumido (a da folha): Peso médio crescente põe o Lote 02 primeiro.
{
  const { result } = kept['Por apartação, ordem Peso médio crescente'];
  const engorda = result.found.find((block) => valueAt(block.title, 0) === 'TOTAL POR LOTE – ENGORDA');
  assert.deepEqual(engorda.lines.map((row) => valueAt(row, 2)), ['Lote 02', 'Lote 01'], 'ordem por Peso médio crescente no bloco');
}
// Folha por data no nível folha: rótulo dd/mm/aaaa e faixa fora (hiddenMetrics) nos dois canais.
{
  const { vm, result } = kept['Apartação › Lote › Data (faixa fora)'];
  assert.ok(result.found.every((block) => valueAt(block.title, 0).startsWith('TOTAL POR DATA – ')), 'título TOTAL POR DATA');
  assert.ok(result.found.flatMap((block) => block.lines).every((row) => /^\d{2}\/\d{2}\/\d{4}$/.test(valueAt(row, 2)) || valueAt(row, 2) === 'Não informado'), 'datas dd/mm/aaaa no bloco');
  assert.ok(!buildSummaryLayout(vm, 'xlsx').metrics.some((metric) => ['faixa_min', 'faixa_max'].includes(metric.key)), 'faixa fora quando o nível folha não é o lote');
}
// A função do bloco é a mesma para os dois destinos (só o formato do rótulo muda — e data/sim-não coincidem).
{
  const { vm } = kept['Apartação › Lote › Data (faixa fora)'];
  for (const node of vm.tree) {
    const print = buildLeafTotalBlock(vm, node, { target: 'print' });
    const xlsx = buildLeafTotalBlock(vm, node, { target: 'xlsx' });
    assert.equal(xlsx.title, print.title, 'título igual nos dois destinos');
    assert.deepEqual(xlsx.lines.map((line) => [line.id, line.label]), print.lines.map((line) => [line.id, line.label]), 'linhas iguais nos dois destinos');
  }
  assert.equal(buildLeafTotalBlock(vm, vm.tree[0].children[0]), null, 'NEGATIVO: nó de nível 2 não tem bloco');
}

// ---- d) NEGATIVOS ----
// 1 e 2 níveis: nenhum bloco (nem na planilha nem nas linhas montadas).
// E1D: "Por lote" (E1B) escrito à mão; o tipo "Por Apartação/Lote" (2 níveis) também não tem bloco; o
// Detalhado é "Personalizado" (view null: o tipo é Resumido).
const noBlock = [
  ['Pesagens › Por lote (1 nível)', 'pesagens', { mode: 'RESUMIDO', groups: [{ columnId: 'nome_lote' }], aggregates: SHEET_TOTALS }],
  ['Pesagens apartação › lote (2 níveis)', 'pesagens', { mode: 'RESUMIDO', groups: [{ columnId: 'nome_apartacao' }, { columnId: 'nome_lote' }], aggregates: SHEET_TOTALS }],
  ['Pesagens › tipo Por Apartação/Lote (2 níveis)', 'pesagens', viewSelection('por-apartacao-lote', PESAGENS)],
  ['Desempenho apartação › lote (2 níveis)', 'desempenho', { mode: 'RESUMIDO', groups: [{ columnId: 'apartacao' }, { columnId: 'lote' }] }],
  ['Por apartação no Detalhado', 'pesagens', { ...PAD, view: null, mode: 'DETALHADO' }],
];
for (const [name, id, selection] of noBlock) {
  const vm = await run(id, selection);
  const { sheet } = await emitXlsx(vm);
  assert.ok(!sheet.includes('TOTAL POR'), `NEGATIVO ${name}: XLSX sem bloco TOTAL POR`);
  const kinds = buildSheetRows(vm).rows.map((row) => row.kind);
  assert.ok(!kinds.some((kind) => Object.values(XLSX_BLOCK_KINDS).includes(kind)), `NEGATIVO ${name}: nenhuma linha de bloco montada`);
  if (vm.mode === 'RESUMIDO') {
    // O próprio cálculo do bloco recusa menos de 3 níveis (não só quem o chama).
    assert.ok(vm.tree.length > 0 && vm.tree.every((node) => buildLeafTotalBlock(vm, node) === null), `NEGATIVO ${name}: buildLeafTotalBlock devolve null com ${vm.groups.length} nível(is)`);
    assert.equal(parseSheet(sheet).length, TOP_ROWS + buildSummaryLayout(vm, 'xlsx').rows.length, `NEGATIVO ${name}: uma linha por grupo + Total geral`);
    assert.equal(checkBlocks(name, vm, parseSheet(sheet)).blocks, 0, `NEGATIVO ${name}: nenhum bloco a comparar`);
  }
}
// CSV e JSON do Resumido com 3 níveis continuam sem o bloco (uma linha por grupo + total geral).
{
  const { vm } = kept['Pesagens › Por apartação (resumo por data)'];
  const layout = buildSummaryLayout(vm, 'csv');
  const csvText = (await prepareEmission(vm, 'csv', ADMIN)).content;
  assert.ok(!csvText.includes('TOTAL POR') && !/Total Engorda/.test(csvText), 'NEGATIVO: CSV sem o bloco TOTAL POR');
  const csv = parseCsv(csvText).filter((row) => row.length > 1);
  const csvBody = csv.slice(1);
  assert.equal(csvBody.length, layout.rows.length, 'NEGATIVO: CSV com uma linha por grupo + total geral');
  assert.deepEqual([...new Set(csvBody.map((row) => row[0]))].sort(), ['GRAND_TOTAL', 'SUMMARY'], 'NEGATIVO: CSV só com SUMMARY e GRAND_TOTAL');
  const jsonText = (await prepareEmission(vm, 'json', ADMIN)).content;
  assert.ok(!jsonText.includes('TOTAL POR') && !jsonText.includes('Total Engorda'), 'NEGATIVO: JSON sem o bloco TOTAL POR');
  assert.equal(JSON.parse(jsonText).summary.rows.length, layout.rows.length, 'NEGATIVO: JSON com as mesmas linhas do layout');
}
// XLSX adulterado é detectado pela comparação com a folha.
{
  const { vm, sheet, result } = kept['Pesagens › Por apartação (resumo por data)'];
  const layout = buildSummaryLayout(vm, 'xlsx');
  const letter = (index) => { let value = index + 1; let out = ''; while (value > 0) { const mod = (value - 1) % 26; out = String.fromCharCode(65 + mod) + out; value = Math.floor((value - mod) / 26); } return out; };
  const colLetter = (key) => letter(layout.groupHeaders.length + layout.metrics.findIndex((metric) => metric.key === key));
  const engorda = result.found.find((block) => valueAt(block.title, 0) === 'TOTAL POR LOTE – ENGORDA');
  const setCell = (xml, ref, cell) => {
    const pattern = new RegExp(`<c r="${ref}" [^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);
    assert.ok(pattern.test(xml), `célula ${ref} existe`);
    return xml.replace(pattern, cell);
  };
  const lote01 = engorda.lines[0].number;
  const totalRow = engorda.total.number;
  // [adulteração, XML adulterado, motivo esperado da recusa]
  const tampered = [
    ['valor do Lote 01 alterado', setCell(sheet, `${colLetter('peso_total')}${lote01}`, `<c r="${colLetter('peso_total')}${lote01}" s="11"><v>1386</v></c>`), /peso_total = folha/],
    ['faixa na linha "Total Engorda"', setCell(sheet, `${colLetter('faixa_min')}${totalRow}`, `<c r="${colLetter('faixa_min')}${totalRow}" s="11"><v>200</v></c>`), /faixa_min vazio \(faixa só na linha do lote\)/],
    ['Total somado (Qtd = Σ das datas)', setCell(sheet, `${colLetter('qtd')}${totalRow}`, `<c r="${colLetter('qtd')}${totalRow}" s="8"><v>7</v></c>`), /Total Engorda: qtd = folha/],
    ['rótulo do lote trocado', setCell(sheet, `C${lote01}`, `<c r="C${lote01}" s="1" t="inlineStr"><is><t xml:space="preserve">Lote 02</t></is></c>`), /rótulo na coluna do nível/],
    ['título do bloco removido', setCell(sheet, `A${engorda.title.number}`, `<c r="A${engorda.title.number}" s="5"/>`), /um bloco TOTAL POR por seção de nível 1/],
    ['número gravado como texto', setCell(sheet, `${colLetter('qtd')}${lote01}`, `<c r="${colLetter('qtd')}${lote01}" s="8" t="inlineStr"><is><t xml:space="preserve">2</t></is></c>`), /qtd como número \(nunca texto\)/],
  ];
  for (const [label, xml, reason] of tampered) {
    assert.notEqual(xml, sheet, `adulteração aplicada: ${label}`);
    assert.throws(() => checkBlocks(label, vm, parseSheet(xml)), (error) => reason.test(error.message), `NEGATIVO: ${label} é detectado (${reason})`);
  }
  // Controle: o arquivo sem adulteração passa pela mesma comparação.
  assert.equal(checkBlocks('controle', vm, parseSheet(sheet)).blocks, result.blocks, 'controle: arquivo íntegro passa');
  results.push({ caso: 'NEGATIVOS (adulterações detectadas)', adulteracoes: tampered.map(([label]) => label) });
}

await resetDb();
console.log(JSON.stringify({ gate: 'reports:sheet-xlsx-parity:verify', ok: true, cases: results, semBloco: noBlock.map(([name]) => name) }, null, 2));
