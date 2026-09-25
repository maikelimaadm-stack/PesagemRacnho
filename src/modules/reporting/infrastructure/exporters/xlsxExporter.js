// XLSX sem dependência (porta do escritor do ModeloBase1: framework/cadastro/exports/xlsxExportUtils.jsx),
// adaptado aos relatórios: ZIP "stored" + SpreadsheetML, números como números (nunca texto),
// título, período, filtros e emissão no topo; mesma estrutura de linhas do CSV
// (Tipo | Grupo | Métrica | Valor | colunas) e uma segunda aba com o manifesto.
// E1C: o Resumido com 3 níveis leva também o bloco "TOTAL POR <nível folha> – <nível 1>" da folha, no fim
// de cada nó de nível 1 (o CSV continua uma linha por grupo + total geral).
import { describeFilters } from './printDocument.js';
import { describePeriod } from '../../domain/reportPeriod.js';
import { DEFAULT_DECIMALS, formatCell } from '../../domain/reportFormatting.js';
import { buildLeafTotalBlock, DOC_ROW_TYPES } from '../../domain/reportDocument.js';
import { leafOnlyMetricKeys, summaryMetricValue } from '../../domain/summaryLayout.js';
import { aggregateValueColumn, buildReportLines } from './reportLayout.js';

const encoder = new TextEncoder();

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de controle não são válidos em XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const INVALID_SHEET_NAME_CHARS = /[\\/?*[\]:]/g;
export function sanitizeSheetName(name) {
  return String(name || 'Planilha').replace(INVALID_SHEET_NAME_CHARS, ' ').trim().slice(0, 31) || 'Planilha';
}

export function columnLetter(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const mod = (value - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    value = Math.floor((value - mod) / 26);
  }
  return result;
}

// Estilos (cellXfs): 0 padrão · 1 texto com borda · 2 cabeçalho · 3 título · 4 total · 5 grupo ·
// 6 número 2 casas · 7 número 3 casas · 8 inteiro · 9 subtotal · 10 rótulo de metadados ·
// 11 número 1 casa (E1B: kg agregado)
const STYLE = { text: 1, header: 2, title: 3, total: 4, group: 5, num2: 6, num3: 7, int: 8, subtotal: 9, meta: 10, num1: 11 };

// Formato do Excel = casas da coluna (as mesmas de formatCell): 0 inteiro, 1, 2 (padrão) ou 3.
function numberStyle(column) {
  if (!column) return STYLE.num2;
  const decimals = Number.isInteger(column.decimals) ? column.decimals : DEFAULT_DECIMALS[column.type];
  if (column.type === 'integer' || decimals === 0) return STYLE.int;
  if (decimals === 1) return STYLE.num1;
  if (decimals === 3) return STYLE.num3;
  return STYLE.num2;
}

function cellXml(ref, value, style = 0) {
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function rowXml(rowNumber, cells) {
  return `<row r="${rowNumber}">${cells.map(([value, style], index) => cellXml(`${columnLetter(index)}${rowNumber}`, value, style ?? 0)).join('')}</row>`;
}

// Mesma coluna "virtual" do layout (kg agregado com 1 casa, média de inteiro com 1, GMD com 3).
function aggregateColumn(spec, viewModel) {
  return aggregateValueColumn(spec, viewModel.availableColumns ?? viewModel.columns ?? []);
}

function metaRows(viewModel) {
  const grouping = viewModel.groups.length ? viewModel.groups.map((group) => group.label).join(' › ') : 'Sem agrupamento';
  const mode = viewModel.mode === 'RESUMIDO' ? ' · Resumido (uma linha por grupo)' : ' · Detalhado';
  return [
    { kind: 'TITLE', cells: [[viewModel.reportName, STYLE.title]] },
    { kind: 'META', cells: [['Período', STYLE.meta], [viewModel.period ? describePeriod(viewModel.period) : 'Estado atual', null]] },
    { kind: 'META', cells: [['Filtros', STYLE.meta], [describeFilters(viewModel), null]] },
    { kind: 'META', cells: [['Agrupado por', STYLE.meta], [`${grouping}${mode}`, null]] },
    { kind: 'META', cells: [['Emissão', STYLE.meta], [`${viewModel.emissionId} · ${viewModel.generatedAt} · ${viewModel.emittedBy.nome ?? viewModel.emittedBy.id} (${viewModel.emittedBy.role}) · versão ${viewModel.appVersion}`, null]] },
    { kind: 'BLANK', cells: [] },
  ];
}

// Tipos de linha do bloco "TOTAL POR" na planilha (os de linha e total são os mesmos da folha).
export const XLSX_BLOCK_KINDS = Object.freeze({ TITLE: 'LEAF_TOTAL_TITLE', LEAF_TOTAL: DOC_ROW_TYPES.LEAF_TOTAL, TOTAL: DOC_ROW_TYPES.TOTAL });

/**
 * Bloco "TOTAL POR <nível folha> – <nível 1>" de um nó de nível 1 (3 níveis): linha-título (estilo de
 * grupo), uma linha por grupo do nível folha (rótulo na coluna do nível folha) e a linha "Total <nível 1>"
 * (estilo de subtotal). O MESMO bloco da folha (buildLeafTotalBlock), com as colunas e os formatos das
 * outras linhas da planilha; a faixa (par leafOnly) só nas linhas do nível folha.
 */
function leafTotalSheetRows(viewModel, summary, node, width) {
  const block = buildLeafTotalBlock(viewModel, node, { target: 'xlsx' });
  if (!block) return [];
  const { groupHeaders, metrics } = summary;
  const leafOnly = leafOnlyMetricKeys(viewModel);
  const cellsOf = (source, label, labelIndex, isLeaf, style) => [
    ...groupHeaders.map((_, index) => [index === labelIndex ? label : null, style]),
    ...metrics.map((metric) => {
      const value = !leafOnly.has(metric.key) || isLeaf ? formatCell(metric.column, summaryMetricValue(source, metric.key), 'xlsx') : null;
      return [value, typeof value === 'number' ? numberStyle(metric.column) : style];
    }),
  ];
  return [
    { kind: XLSX_BLOCK_KINDS.TITLE, cells: Array.from({ length: width }, (_, index) => [index === 0 ? block.title : null, STYLE.group]) },
    ...block.lines.map((line) => ({ kind: XLSX_BLOCK_KINDS.LEAF_TOTAL, cells: cellsOf(line.node, line.label, groupHeaders.length - 1, true, STYLE.text) })),
    { kind: XLSX_BLOCK_KINDS.TOTAL, cells: cellsOf(block.total.node, block.total.label, 0, false, STYLE.subtotal) },
  ];
}

/** Resumido: mesma tabela da tela (níveis de grupo + métricas), números como números. */
function buildSummarySheetRows(viewModel, layout) {
  const { headers, lines, summary } = layout;
  const width = headers.length;
  const groupCount = summary.groupHeaders.length;
  const rows = metaRows(viewModel);
  rows.push({ kind: 'HEADER', cells: headers.map((header) => [header, STYLE.header]) });
  // 3 níveis: o bloco do nó de nível 1 fecha antes do próximo nível 1 (ou do Total geral). A linha do
  // layout traz o nó do Resumido (sem as linhas); a população vem do nó da árvore com o mesmo id.
  const blocks = (viewModel.groups ?? []).length >= 3;
  const treeById = new Map((blocks ? viewModel.tree ?? [] : []).map((node) => [node.id, node]));
  let openLevel1 = null;
  const closeBlock = () => {
    if (openLevel1) rows.push(...leafTotalSheetRows(viewModel, summary, openLevel1, width));
    openLevel1 = null;
  };
  lines.forEach((line, lineIndex) => {
    if (line.level <= 1) closeBlock();
    const total = line.type === 'GRAND_TOTAL';
    const labelStyle = total ? STYLE.total : line.level === 1 ? STYLE.group : STYLE.text;
    const cells = line.cells.map((value, index) => {
      if (index < groupCount) return [value, labelStyle];
      const metric = summary.metrics[index - groupCount];
      return [value, typeof value === 'number' ? numberStyle(metric.column) : (total ? STYLE.total : STYLE.text)];
    });
    rows.push({ kind: line.type, cells });
    if (blocks && line.level === 1) openLevel1 = treeById.get(summary.rows[lineIndex].node?.id) ?? null;
  });
  closeBlock();
  return { rows, width, dataHeaders: headers };
}

/** Linhas da planilha principal: [{ cells: [[valor, estilo], ...], kind }]. */
export function buildSheetRows(viewModel) {
  const layout = buildReportLines(viewModel, 'xlsx');
  if (layout.mode === 'RESUMIDO') return buildSummarySheetRows(viewModel, layout);
  const { headers, lines } = layout;
  const width = 4 + viewModel.columns.length;
  const pad = (cells) => [...cells, ...Array(Math.max(0, width - cells.length)).fill([null, STYLE.text])];
  const rows = metaRows(viewModel);
  rows.push({ kind: 'HEADER', cells: pad([['Tipo', STYLE.header], ['Grupo', STYLE.header], ['Métrica', STYLE.header], ['Valor', STYLE.header], ...headers.map((header) => [header, STYLE.header])]) });
  for (const line of lines) {
    if (line.type === 'GROUP') {
      rows.push({ kind: 'GROUP', cells: pad([['GROUP', STYLE.group], [line.label, STYLE.group], [`${line.rowCount} registro(s)`, STYLE.group], [null, STYLE.group]]) });
    } else if (line.type === 'DATA') {
      rows.push({ kind: 'DATA', cells: pad([['DATA', STYLE.text], [line.group || null, STYLE.text], [null, STYLE.text], [null, STYLE.text], ...line.cells.map((value, index) => [value, typeof value === 'number' ? numberStyle(viewModel.columns[index]) : STYLE.text])]) });
    } else {
      const style = line.type === 'GRAND_TOTAL' ? STYLE.total : STYLE.subtotal;
      const valueStyle = typeof line.value === 'number' ? numberStyle(aggregateColumn(line.spec, viewModel)) : style;
      rows.push({ kind: line.type, cells: pad([[line.type, style], [line.group || 'Total geral', style], [line.metric, style], [line.value, valueStyle]]) });
    }
  }
  return { rows, width, dataHeaders: headers };
}

function worksheetXml(rows, width, widths) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${Array.from({ length: width }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${widths[index] ?? 14}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.map((row, index) => rowXml(index + 1, row.cells)).join('')}</sheetData>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.000"/><numFmt numFmtId="166" formatCode="#,##0"/><numFmt numFmtId="167" formatCode="#,##0.0"/></numFmts>
<fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFF0E5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF7F1"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function workbookFiles(viewModel, manifest) {
  const { rows, width } = buildSheetRows(viewModel);
  // O título do bloco "TOTAL POR" transborda para as células vazias ao lado: não alarga a coluna A.
  const measured = rows.slice(6).filter((row) => row.kind !== XLSX_BLOCK_KINDS.TITLE);
  const widths = Array.from({ length: width }, (_, index) => Math.min(48, Math.max(10, measured.reduce((max, row) => Math.max(max, String(row.cells[index]?.[0] ?? '').length), 0) + 2)));
  const manifestRows = Object.entries(manifest || {}).map(([key, value]) => ({ cells: [[key, STYLE.meta], [typeof value === 'object' ? JSON.stringify(value) : value, STYLE.text]] }));
  return {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sanitizeSheetName(viewModel.reportName))}" sheetId="1" r:id="rId1"/><sheet name="Manifesto" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES_XML,
    'xl/worksheets/sheet1.xml': worksheetXml(rows, width, widths),
    'xl/worksheets/sheet2.xml': worksheetXml([{ cells: [['Manifesto da emissão', STYLE.title]] }, ...manifestRows], 2, [28, 90]),
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP sem compressão ("stored"), datas fixas para saída determinística dado o mesmo conteúdo. */
export function zipStored(files, date = new Date(2026, 0, 1)) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const u16 = (array, value) => array.push(value & 0xff, (value >>> 8) & 0xff);
  const u32 = (array, value) => array.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const crc = crc32(data);
    const local = [];
    u32(local, 0x04034b50); u16(local, 20); u16(local, 0x0800); u16(local, 0); u16(local, dosTime); u16(local, dosDate);
    u32(local, crc); u32(local, data.length); u32(local, data.length); u16(local, nameBytes.length); u16(local, 0);
    chunks.push(Uint8Array.from(local), nameBytes, data);
    const header = [];
    u32(header, 0x02014b50); u16(header, 20); u16(header, 20); u16(header, 0x0800); u16(header, 0); u16(header, dosTime); u16(header, dosDate);
    u32(header, crc); u32(header, data.length); u32(header, data.length); u16(header, nameBytes.length); u16(header, 0); u16(header, 0); u16(header, 0); u16(header, 0); u32(header, 0); u32(header, offset);
    central.push(Uint8Array.from(header), nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = [];
  u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, Object.keys(files).length); u16(end, Object.keys(files).length); u32(end, centralSize); u32(end, offset); u16(end, 0);
  const all = [...chunks, ...central, Uint8Array.from(end)];
  const total = all.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let position = 0;
  for (const chunk of all) { out.set(chunk, position); position += chunk.length; }
  return out;
}

/** Leitor mínimo do próprio formato (gates): nome → texto. */
export function unzipStored(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = {};
  let position = 0;
  while (position + 30 <= bytes.length && view.getUint32(position, true) === 0x04034b50) {
    const size = view.getUint32(position + 18, true);
    const nameLength = view.getUint16(position + 26, true);
    const extraLength = view.getUint16(position + 28, true);
    const name = decoder.decode(bytes.subarray(position + 30, position + 30 + nameLength));
    const start = position + 30 + nameLength + extraLength;
    files[name] = decoder.decode(bytes.subarray(start, start + size));
    position = start + size;
  }
  return files;
}

export function buildXlsx(viewModel, manifest) {
  return zipStored(workbookFiles(viewModel, manifest));
}
