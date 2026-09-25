// CSV canônico (substitui as implementações espalhadas; docs/reporting/EXPORT-CONTRACT.md §CSV).
// UTF-8 com BOM, separador ";", CRLF, toda célula entre aspas quando necessário (aspas dobradas),
// números pt-BR sem separador de milhar, datas dd/mm/aaaa, ausente = vazio.
// Estrutura DETALHADO: tipo_linha;nivel;grupo;metrica;valor;<colunas visíveis>
//   DATA        → colunas preenchidas;
//   GROUP       → cabeçalho do grupo em "grupo";
//   SUBTOTAL    → uma linha por total do grupo (metrica + valor);
//   GRAND_TOTAL → uma linha por total geral.
// Estrutura RESUMIDO (E1): tipo_linha;nivel;grupo;<um por nível de agrupamento>;<uma por métrica>
//   SUMMARY     → uma linha por grupo (mesmas células da tela); "grupo" = caminho "Engorda > Lote 01",
//                 para a hierarquia sobreviver a ordenar/filtrar no Excel;
//   GRAND_TOTAL → Total geral.
import { buildReportLines } from './reportLayout.js';

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARATOR = ';';
export const CSV_NEWLINE = '\r\n';

/**
 * Mitiga injeção de fórmula ao abrir no Excel: texto iniciado por =, +, @ ou - ganha apóstrofo.
 * Só número negativo de verdade ("-12", "-1,5", "-1234,56") passa sem apóstrofo — "-1+1" ou
 * "-2+3+cmd|…" (texto livre de marca, lote, comprador…) são fórmula para o Excel.
 */
export function protectFormula(value) {
  const text = String(value ?? '');
  return /^[=+@]/.test(text) || (/^-/.test(text) && !/^-\d+(?:[.,]\d+)?$/.test(text)) ? `'${text}` : text;
}

/** Escapa uma célula: aspas se tiver separador, aspas, quebra de linha ou espaço nas bordas. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = protectFormula(value);
  return /[";\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(viewModel) {
  const { mode, headers, lines } = buildReportLines(viewModel, 'csv');
  if (mode === 'RESUMIDO') {
    const out = [['tipo_linha', 'nivel', 'grupo', ...headers].map(csvCell).join(CSV_SEPARATOR)];
    for (const line of lines) out.push([line.type, line.level, line.group, ...line.cells].map(csvCell).join(CSV_SEPARATOR));
    return CSV_BOM + out.join(CSV_NEWLINE) + CSV_NEWLINE;
  }
  const out = [['tipo_linha', 'nivel', 'grupo', 'metrica', 'valor', ...headers].map(csvCell).join(CSV_SEPARATOR)];
  for (const line of lines) {
    const prefix = [line.type, line.level, line.type === 'GROUP' ? line.label : line.group, line.metric ?? '', line.value ?? ''];
    out.push([...prefix, ...line.cells].map(csvCell).join(CSV_SEPARATOR));
  }
  return CSV_BOM + out.join(CSV_NEWLINE) + CSV_NEWLINE;
}

/** Parser mínimo do próprio formato (gates de paridade). */
export function parseCsv(text) {
  const source = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === CSV_SEPARATOR) { row.push(cell); cell = ''; } else if (char === '\r' && source[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; } else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
