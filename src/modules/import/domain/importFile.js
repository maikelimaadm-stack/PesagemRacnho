// Leitura do arquivo da importação conciliada: CSV/TXT com ";", "," ou TAB, BOM,
// aspas (com "" de escape e quebra de linha dentro do campo) e LF/CRLF/CR.
// Diferença deliberada para weighing/domain/csvParser.parseCsv: cada linha guarda a
// LINHA FÍSICA onde começa no arquivo (1 = cabeçalho), então linhas em branco e campos
// com quebra de linha não deslocam o "Linha N" das mensagens.
import { detectCsvDelimiter } from '../../weighing/domain/csvParser.js';
import { sha256HexSync } from './sha256Sync.js';

const BOM = String.fromCharCode(0xfeff);
const stripBom = (text) => (text.startsWith(BOM) ? text.slice(1) : text);

const DELIMITER_ALIASES = Object.freeze({ ';': ';', ',': ',', '\t': '\t', tab: '\t', TAB: '\t' });

// O CSV canônico (csvExporter.protectFormula) prefixa com apóstrofo o texto iniciado por
// =, +, @ ou - não numérico; na leitura o apóstrofo sai e o valor volta ao original.
const unprotectFormula = (value) => (/^'[=+@-]/.test(value) && !/^'-\d/.test(value) ? value.slice(1) : value);

/** Texto canônico para o hash: sem BOM, quebras como LF e sem linhas vazias no fim. */
export function normalizeImportText(text) {
  return stripBom(String(text ?? '')).replace(/\r\n?/g, '\n').replace(/\s+$/, '');
}

function resolveDelimiter(text, delimiter) {
  if (delimiter === undefined || delimiter === null || delimiter === '' || delimiter === 'auto') return detectCsvDelimiter(text);
  const resolved = DELIMITER_ALIASES[delimiter];
  if (!resolved) throw new Error(`Separador não suportado: "${delimiter}". Use ponto e vírgula, vírgula ou tabulação.`);
  return resolved;
}

// Registros { line, cells } na ordem do arquivo; registros totalmente vazios são descartados.
function parseRecords(source, delimiter) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  const closeField = () => {
    row.push(unprotectFormula(field.trim()));
    field = '';
  };
  const closeRecord = () => {
    closeField();
    if (row.some((value) => value !== '')) records.push({ line: recordLine, cells: row });
    row = [];
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && source[index + 1] === '\n') index += 1;
        field += '\n';
        line += 1;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.trim() === '') {
      field = '';
      quoted = true;
    } else if (char === delimiter) {
      closeField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      closeRecord();
      line += 1;
      recordLine = line;
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error(`Arquivo inválido: o campo entre aspas iniciado na linha ${recordLine} não foi fechado.`);
  closeRecord();
  return records;
}

// Cabeçalhos repetidos ganham sufixo " (2)", " (3)"… para que nenhuma coluna suma do mapeamento.
function uniqueHeaders(cells) {
  const seen = new Map();
  return cells.map((cell, index) => {
    const base = cell || `Coluna ${index + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

/**
 * readImportFile(text, { delimiter = 'auto' }) →
 * { headers, rows: [{ line, values: { [header]: string } }], delimiter, hash, totalLines }.
 * `line` é a linha física no arquivo (1 = cabeçalho). `hash` = SHA-256 hex do texto
 * normalizado (normalizeImportText): o mesmo conteúdo salvo com CRLF ou BOM dá o mesmo hash.
 */
export function readImportFile(text, { delimiter = 'auto' } = {}) {
  const source = stripBom(String(text ?? ''));
  const resolvedDelimiter = resolveDelimiter(source, delimiter);
  const records = parseRecords(source, resolvedDelimiter);
  const hash = sha256HexSync(normalizeImportText(text));
  if (!records.length) return { headers: [], rows: [], delimiter: resolvedDelimiter, hash, totalLines: 0 };
  const [headerRecord, ...dataRecords] = records;
  const headers = uniqueHeaders(headerRecord.cells);
  const rows = dataRecords.map((record) => ({
    line: record.line,
    values: Object.fromEntries(headers.map((header, index) => [header, record.cells[index] ?? ''])),
  }));
  return { headers, rows, delimiter: resolvedDelimiter, hash, totalLines: source.split(/\r\n|\r|\n/).length };
}
