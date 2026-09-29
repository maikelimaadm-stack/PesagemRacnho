// Vendas (Detalhado) — E1D: o relatório de venda do MAKGESTAO (PDF da responsável em
// docs/evidence/e1d/referencia-makgestao/print-responsavel-vendas-w3.pdf; antigo RelatorioPesagensIndividuais.jsx
// L1400–1657). Função pura: transforma o view model do tipo "vendas" nos blocos que a folha/impressão/PDF
// (exporters/vendasHtml.js) e o XLSX (exporters/vendasXlsx.js) desenham, na ordem do antigo:
//
//   resumo        Métrica | Valor: Animais vendidos, Peso total, Peso médio, Média (@), Média valor da arroba,
//                 Valor total;
//   porMarca      TOTAIS POR MARCA: Qtd, Peso Total, Peso Médio, Média (@), Média Valor @, Valor Total;
//   porComprador  TOTAIS POR COMPRADOR: Qtd, Peso Total, Valor Total;
//   compradores   VENDAS POR COMPRADOR (DETALHADO): um cartão por comprador (Total, Peso Médio, Peso Total,
//                 Média (@), Valor Total) e, com "Mostrar Detalhes", as vendas dele nas colunas do tipo;
//   totalGeral    TOTAL GERAL: N animais | Peso Total | Peso Médio | Média (@) | Valor Total.
//
// Nenhuma conta aqui: o motor (groupRows/computeAggregates) calcula VENDAS_BLOCK_TOTALS sobre a população do
// view model (Saída por Venda, condição fixa do tipo) — cada bloco recalcula sobre a PRÓPRIA população (marca,
// comprador, geral), nunca soma de médias. Qtd = animais DISTINTOS; Média (@) = média da @ viva; Média valor
// da arroba = Valor @ ponderado pela Qtd @ (só vendas com Valor @); Valor total = coluna derivada
// valor_venda_calc (digitado, senão @ viva × Valor @ — eventColumns.saleValueOf). Os blocos usam sempre estes
// totais (um modelo com outros totais não muda o relatório de venda). Quem não vê valores (commercial.values)
// recebe os blocos sem nenhum item de valor — o aviso de colunas ocultas é o de sempre (rodapé/tela).
import { groupRows } from './groupEngine.js';
import { computeAggregates } from './reportAggregates.js';
import { REPORT_MODES } from './reportDefinition.js';
import { formatCell, headerLabel, MISSING_SCREEN } from './reportFormatting.js';
import { formatGroupLabel } from './summaryLayout.js';

export const VENDAS_VIEW_ID = 'vendas';
// Sem valor: "-" como no antigo (o Valor total de uma venda sem Valor @ nem valor digitado).
export const VENDAS_MISSING = '-';

// Totais dos blocos (ids fixos — a definição do tipo usa esta lista; folha, XLSX e gates leem por id).
export const VENDAS_BLOCK_TOTALS = Object.freeze([
  Object.freeze({ id: 'animais_vendidos', columnId: 'numero_animal', op: 'countDistinct' }),
  Object.freeze({ id: 'peso_total', columnId: 'peso', op: 'sum' }),
  Object.freeze({ id: 'peso_medio', columnId: 'peso', op: 'avg' }),
  Object.freeze({ id: 'media_arroba', columnId: 'peso_arroba', op: 'avg' }),
  Object.freeze({ id: 'media_valor_arroba', columnId: 'valor_arroba_venda', op: 'weightedAvg' }),
  Object.freeze({ id: 'valor_total', columnId: 'valor_venda_calc', op: 'sum' }),
]);

// Formato de cada total como no PDF: kg e @ com 2 casas ("40.968,00", "15,17"), dinheiro "R$ 383,00".
export const VENDAS_FORMATS = Object.freeze({
  animais_vendidos: Object.freeze({ type: 'integer' }),
  peso_total: Object.freeze({ type: 'weight', decimals: 2 }),
  peso_medio: Object.freeze({ type: 'weight', decimals: 2 }),
  media_arroba: Object.freeze({ type: 'number', decimals: 2 }),
  media_valor_arroba: Object.freeze({ type: 'money', decimals: 2 }),
  valor_total: Object.freeze({ type: 'money', decimals: 2 }),
});

// Rótulos do antigo, bloco a bloco ([id do total, rótulo, opções]). strong = negrito (Valor total/Valor Total).
const RESUMO = Object.freeze([
  ['animais_vendidos', 'Animais vendidos'],
  ['peso_total', 'Peso total (kg)'],
  ['peso_medio', 'Peso médio (kg)'],
  ['media_arroba', 'Média (@)'],
  ['media_valor_arroba', 'Média valor da arroba'],
  ['valor_total', 'Valor total', { strong: true }],
]);
const POR_MARCA = Object.freeze([
  ['animais_vendidos', 'Qtd', { align: 'center' }],
  ['peso_total', 'Peso Total (kg)'],
  ['peso_medio', 'Peso Médio (kg)'],
  ['media_arroba', 'Média (@)'],
  ['media_valor_arroba', 'Média Valor @'],
  ['valor_total', 'Valor Total', { strong: true }],
]);
const POR_COMPRADOR = Object.freeze([
  ['animais_vendidos', 'Qtd', { align: 'center' }],
  ['peso_total', 'Peso Total (kg)'],
  ['valor_total', 'Valor Total', { strong: true }],
]);
// Cartão do comprador (grade de 2 colunas na folha, na ordem do antigo) e a linha do TOTAL GERAL.
const CARTAO = Object.freeze([
  ['animais_vendidos', 'Total', { unit: 'animais' }],
  ['peso_medio', 'Peso Médio', { unit: 'kg' }],
  ['peso_total', 'Peso Total', { unit: 'kg' }],
  ['media_arroba', 'Média (@)'],
  ['valor_total', 'Valor Total'],
]);
const TOTAL_GERAL = Object.freeze([
  ['animais_vendidos', null, { unit: 'animais' }],
  ['peso_total', 'Peso Total', { unit: 'kg' }],
  ['peso_medio', 'Peso Médio', { unit: 'kg' }],
  ['media_arroba', 'Média (@)'],
  ['valor_total', 'Valor Total'],
]);

// Colunas da tabela de detalhe em que o antigo destacava a célula (font-semibold / font-medium).
const DETAIL_EMPHASIS = Object.freeze({ valor_venda_calc: 'semibold', numero_animal: 'medium' });

const upper = (text) => String(text ?? '').toLocaleUpperCase('pt-BR');
const isMissing = (value) => value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));

/** O view model é o tipo "Vendas (Detalhado)" sem detalhe de grupo (o clique abre o Detalhado comum)? */
export function isVendasViewModel(viewModel) {
  return viewModel?.view?.id === VENDAS_VIEW_ID
    && viewModel.mode === REPORT_MODES.DETALHADO
    && !(viewModel.drill ?? []).length
    && (viewModel.groups ?? []).map((group) => group.columnId).join('|') === 'comprador';
}

/** Texto de um total no formato do PDF; sem valor = "-". */
export function vendasText(id, value) {
  if (isMissing(value)) return VENDAS_MISSING;
  return formatCell(VENDAS_FORMATS[id], value, 'print');
}

function item(aggregates, [id, label, options = {}]) {
  const value = aggregates?.[id]?.value ?? null;
  const text = vendasText(id, value);
  return { key: id, label, value, text, unit: options.unit ?? null, strong: Boolean(options.strong), align: options.align ?? 'right' };
}

/** Células de um bloco (só os totais que o perfil vê — os demais não existem em `aggregates`). */
function itemsOf(spec, aggregates, visible) {
  return spec.filter(([id]) => visible.has(id)).map((entry) => item(aggregates, entry));
}

/** Texto de um item do cartão/TOTAL GERAL: "Peso Médio: 455,20 kg", "1 animal" (sem valor, só "-"). */
function withUnit(entry) {
  if (!entry.unit || entry.text === VENDAS_MISSING) return entry.text;
  return `${entry.text} ${entry.unit === 'animais' && entry.value === 1 ? 'animal' : entry.unit}`;
}

/** Colunas da tabela de detalhe: as da folha (doc.columns) ou, sem elas, as do view model. */
function detailColumnsOf(viewModel, columns) {
  if (columns) return columns.map((column) => ({ key: column.key, label: column.label, align: column.align, column: column.column }));
  const numeric = new Set(['integer', 'number', 'weight', 'gmd', 'money', 'percentage']);
  return (viewModel.columns ?? []).map((column) => ({ key: column.id, label: headerLabel(column), align: column.align === 'right' || numeric.has(column.type) ? 'right' : 'left', column }));
}

/**
 * Célula de detalhe. Peso sem casas como no antigo (fmtNum(peso, 0)); Qtd @ com 2; dinheiro "R$ 5.810,10";
 * data dd/mm/aaaa; sem valor "-". `raw` = valor canônico (o XLSX grava ele no formato da coluna).
 */
function detailCell(viewModel, entry, row) {
  const accessor = viewModel.resolve(entry.key);
  const raw = entry.column?.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row);
  const shown = entry.column?.type === 'weight' ? { ...entry.column, decimals: 0 } : entry.column;
  const formatted = formatCell(shown, raw, 'print');
  const text = formatted === MISSING_SCREEN || formatted === '' ? VENDAS_MISSING : formatted;
  return { key: entry.key, raw: isMissing(raw) ? null : raw, text, align: entry.align, emphasis: DETAIL_EMPHASIS[entry.key] ?? null };
}

/**
 * Blocos do relatório de venda.
 * @param viewModel resultado de runReport com o tipo "vendas" (usa rows, resolve, availableColumns, columns)
 * @param {{ showDetails?: boolean, columns?: object[] }} options showDetails = "Mostrar Detalhes" (as vendas de
 *   cada comprador abaixo do cartão); columns = colunas visíveis da folha (doc.columns) para o detalhe
 * @returns {{ showDetails: boolean, hasValues: boolean, totals: string[],
 *   resumo: { columns: object[], rows: object[] },
 *   porMarca: { title: string, columns: object[], rows: object[] },
 *   porComprador: { title: string, columns: object[], rows: object[] },
 *   compradores: { title: string, detailColumns: object[]|null, items: { id, key, label, title, missing, rowCount, totals: object[], rows: object[]|null }[] },
 *   totalGeral: { items: object[], text: string } }}
 *   Cada item/célula de total leva { key, label, value (bruto), text (formatado), strong, align }.
 */
export function buildVendasBlocks(viewModel, { showDetails = false, columns = null } = {}) {
  if (typeof viewModel?.resolve !== 'function') throw new Error('vendas: view model sem resolve (use o resultado de runReport)');
  const available = new Set((viewModel.availableColumns ?? viewModel.columns ?? []).map((column) => column.id));
  // Total só com a coluna que o perfil vê (availableColumns já vem filtrado pelo serviço): sem commercial.values,
  // Média valor da arroba e Valor total não são nem calculados.
  const specs = VENDAS_BLOCK_TOTALS.filter((spec) => available.has(spec.columnId));
  const visible = new Set(specs.map((spec) => spec.id));
  const rows = viewModel.rows ?? [];
  const resolve = viewModel.resolve;
  const columnOf = (columnId) => (viewModel.availableColumns ?? []).find((column) => column.id === columnId) ?? null;
  const groupsBy = (columnId) => groupRows(rows, [{ columnId }], resolve, { aggregates: specs }).nodes.map((node) => ({
    node,
    label: formatGroupLabel(columnOf(columnId), node.label, 'print', node.missing),
  }));
  const totals = computeAggregates(rows, specs, resolve);

  const tableColumns = (first, spec) => [
    { key: '__label__', label: first, align: 'left' },
    ...spec.filter(([id]) => visible.has(id)).map(([id, label, options = {}]) => ({ key: id, label, align: options.align ?? 'right', strong: Boolean(options.strong) })),
  ];
  const tableRows = (groups, spec) => groups.map(({ node, label }) => ({ id: node.id, key: node.key, label, missing: node.missing, cells: itemsOf(spec, node.aggregates, visible) }));

  const porComprador = groupsBy('comprador');
  const detailColumns = showDetails ? detailColumnsOf(viewModel, columns) : null;
  return {
    showDetails: Boolean(showDetails),
    hasValues: visible.has('valor_total'),
    totals: [...visible],
    resumo: {
      columns: [{ key: '__label__', label: 'Métrica', align: 'left' }, { key: '__value__', label: 'Valor', align: 'right' }],
      rows: itemsOf(RESUMO, totals, visible),
    },
    porMarca: { title: 'TOTAIS POR MARCA', columns: tableColumns('Marca', POR_MARCA), rows: tableRows(groupsBy('marca'), POR_MARCA) },
    porComprador: { title: 'TOTAIS POR COMPRADOR', columns: tableColumns('Comprador', POR_COMPRADOR), rows: tableRows(porComprador, POR_COMPRADOR) },
    compradores: {
      title: 'VENDAS POR COMPRADOR (DETALHADO)',
      detailColumns,
      items: porComprador.map(({ node, label }) => ({
        id: node.id,
        key: node.key,
        label,
        title: `COMPRADOR: ${upper(label)}`,
        missing: node.missing,
        rowCount: node.rowCount,
        totals: itemsOf(CARTAO, node.aggregates, visible).map((entry) => ({ ...entry, display: withUnit(entry) })),
        rows: detailColumns ? node.rows.map((row, index) => ({ id: String(row.id ?? index), cells: detailColumns.map((entry) => detailCell(viewModel, entry, row)) })) : null,
      })),
    },
    totalGeral: (() => {
      const items = itemsOf(TOTAL_GERAL, totals, visible).map((entry) => ({ ...entry, display: withUnit(entry) }));
      const parts = items.map((entry) => (entry.label ? `${entry.label}: ${entry.display}` : entry.display));
      return { items, text: `TOTAL GERAL: ${parts.join(' | ')}` };
    })(),
  };
}

/** Corpo do documento no layout "vendas": sem seções/linhas da folha comum (os blocos estão em doc.vendas). */
export function vendasDocumentBody(blocks) {
  const dataRows = blocks.compradores.items.reduce((sum, entry) => sum + (entry.rows?.length ?? 0), 0);
  return {
    sections: [],
    flat: null,
    grandTotal: null,
    drillTargets: {},
    stats: {
      sections: 0,
      tables: 3 + (blocks.showDetails ? blocks.compradores.items.length : 0),
      groupRows: blocks.porComprador.rows.length,
      subtotalRows: 0,
      leafTotalRows: 0,
      totalRows: 0,
      dataRows,
      grandRows: 1,
      marcas: blocks.porMarca.rows.length,
      compradores: blocks.compradores.items.length,
    },
  };
}
