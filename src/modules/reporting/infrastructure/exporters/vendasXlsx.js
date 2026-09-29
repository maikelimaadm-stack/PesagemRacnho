// "Vendas (Detalhado)" no XLSX (E1D): os MESMOS blocos da folha (domain/vendasLayout — buildVendasBlocks) numa
// planilha, na ordem da folha: Métrica | Valor, TOTAIS POR MARCA, TOTAIS POR COMPRADOR e VENDAS POR COMPRADOR
// (DETALHADO) — no Excel sempre com as vendas de cada comprador (o "Mostrar Detalhes" é só da folha) — e o
// TOTAL GERAL. Números como números (kg/@/R$ com 2 casas, Qtd inteiro); nenhuma conta aqui. O CSV e o JSON de
// Vendas continuam o Detalhado (uma linha por venda, subtotal por comprador e total geral).
import { formatCell } from '../../domain/reportFormatting.js';
import { buildVendasBlocks, VENDAS_FORMATS } from '../../domain/vendasLayout.js';

// Cabeçalho do cartão/TOTAL GERAL na planilha: na folha a unidade vai no valor ("455,20 kg"); aqui, no cabeçalho.
const headerOf = (total, animais) => (total.key === 'animais_vendidos' ? animais : total.unit === 'kg' ? `${total.label} (kg)` : total.label);

export const XLSX_VENDAS_KINDS = Object.freeze({
  TITLE: 'VENDAS_TITLE', // título do bloco ("TOTAIS POR MARCA", "COMPRADOR: W3")
  HEADER: 'VENDAS_HEADER',
  ROW: 'VENDAS_ROW', // linha de total (Métrica, marca, comprador, cartão do comprador)
  DATA: 'VENDAS_DATA', // uma venda
  TOTAL: 'VENDAS_TOTAL', // TOTAL GERAL
  BLANK: 'BLANK',
});

/**
 * Linhas da planilha de Vendas.
 * @param viewModel resultado de runReport com o tipo "vendas"
 * @param {{ STYLE: object, numberStyle: Function, metaRows: Function }} kit estilos e cabeçalho do xlsxExporter
 *   (os mesmos das outras planilhas)
 * @returns {{ rows, width, dataHeaders: string[], freeze: { rows: number, cols: number } }}
 */
export function buildVendasSheetRows(viewModel, { STYLE, numberStyle, metaRows }) {
  const blocks = buildVendasBlocks(viewModel, { showDetails: true });
  const detailColumns = blocks.compradores.detailColumns ?? [];
  const rows = metaRows(viewModel, { grouping: 'Comprador · Vendas (Detalhado)' });
  const blank = () => rows.push({ kind: XLSX_VENDAS_KINDS.BLANK, cells: [] });
  // O título transborda para as células vazias ao lado: não entra na medida da largura da coluna A.
  const title = (text) => rows.push({ kind: XLSX_VENDAS_KINDS.TITLE, overflow: true, cells: [[text, STYLE.group]] });
  const header = (labels) => rows.push({ kind: XLSX_VENDAS_KINDS.HEADER, cells: labels.map((label) => [label, STYLE.header]) });
  const number = (id, value, fallback) => {
    const cell = formatCell(VENDAS_FORMATS[id], value, 'xlsx');
    return [cell, typeof cell === 'number' ? numberStyle(VENDAS_FORMATS[id]) : fallback];
  };
  const totalsRow = (label, cells, kind = XLSX_VENDAS_KINDS.ROW, style = STYLE.text) => rows.push({
    kind, cells: [[label, style], ...cells.map((cell) => number(cell.key, cell.value, style))],
  });

  header(blocks.resumo.columns.map((column) => column.label));
  for (const row of blocks.resumo.rows) rows.push({ kind: XLSX_VENDAS_KINDS.ROW, key: row.key, cells: [[row.label, STYLE.text], number(row.key, row.value, STYLE.text)] });
  for (const block of [blocks.porMarca, blocks.porComprador]) {
    blank();
    title(block.title);
    header(block.columns.map((column) => column.label));
    for (const row of block.rows) totalsRow(row.label, row.cells);
  }
  blank();
  title(blocks.compradores.title);
  for (const entry of blocks.compradores.items) {
    title(entry.title);
    // Cartão do comprador: os totais dele numa linha (Total = animais distintos).
    header(['', ...entry.totals.map((total) => headerOf(total, 'Total (animais)'))]);
    totalsRow(`Total ${entry.label}`, entry.totals, XLSX_VENDAS_KINDS.ROW, STYLE.subtotal);
    header(detailColumns.map((column) => column.label));
    for (const row of entry.rows ?? []) {
      rows.push({
        kind: XLSX_VENDAS_KINDS.DATA,
        cells: row.cells.map((cell, index) => {
          const value = formatCell(detailColumns[index].column, cell.raw, 'xlsx');
          return [value, typeof value === 'number' ? numberStyle(detailColumns[index].column) : STYLE.text];
        }),
      });
    }
    blank();
  }
  header(['', ...blocks.totalGeral.items.map((total) => headerOf(total, 'Animais'))]);
  totalsRow('TOTAL GERAL', blocks.totalGeral.items, XLSX_VENDAS_KINDS.TOTAL, STYLE.total);
  const width = Math.max(2, ...rows.map((row) => row.cells.length));
  return { rows, width, dataHeaders: detailColumns.map((column) => column.label), freeze: { rows: 6, cols: 0 } };
}
