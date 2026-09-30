// Relatório de venda do MAKGESTAO — E1D (Pesagens › Vendas) e E1E (Comercial › Vendas, Abates e Compras): o
// desenho do PDF da responsável (docs/evidence/e1d/referencia-makgestao/print-responsavel-vendas-w3.pdf; antigo
// RelatorioPesagensIndividuais.jsx L1400–1657). Função pura: transforma o view model de uma visão com
// `sheetLayout` ('vendas' | 'abates' | 'compras') nos blocos que a folha/impressão/PDF (exporters/vendasHtml.js) e
// o XLSX (exporters/vendasXlsx.js) desenham, na ordem do antigo:
//
//   resumo     Métrica | Valor (os totais da população inteira);
//   porMarca   TOTAIS POR MARCA;
//   porGrupo   TOTAIS POR COMPRADOR | FRIGORÍFICO | ORIGEM;
//   grupos     VENDAS POR COMPRADOR / ABATES POR FRIGORÍFICO / COMPRAS POR ORIGEM (DETALHADO): um cartão por grupo
//              e, com "Mostrar Detalhes", os lançamentos dele nas colunas do tipo;
//   totalGeral TOTAL GERAL: N animais | Peso Total | … | Valor Total.
//
// Um desenho só; muda a configuração de cada layout (SHEET_LAYOUT_CONFIGS: coluna do grupo, totais, rótulos). Nenhuma
// conta aqui: o motor (groupRows/computeAggregates) calcula os totais do layout sobre a população do view model (a
// condição fixa do tipo) — cada bloco recalcula sobre a PRÓPRIA população (marca, grupo, geral), nunca soma de
// médias; Qtd = animais DISTINTOS. As contas de cada layout (todas de colunas gravadas ou derivadas em eventColumns):
//   Vendas   Média (@) = média da @ VIVA (peso ÷ divisor); Média valor da arroba = Valor @ ponderado pela @ viva;
//            Valor total = valor_venda_calc (digitado > 0, senão @ viva × Valor @ — como o antigo).
//   Abates   @ de CARCAÇA gravada no lançamento (quantidade_arrobas = carcaça ÷ 15, só com rendimento válido);
//            Rendimento médio = rendimento gravado ponderado pelo peso vivo; Média valor da arroba = Valor @ do abate
//            ponderado pela @ de carcaça; Valor total = SÓ o valor do abate digitado (valor_total_abate) — sem ele
//            fica "-" e fora da soma: nenhuma conta inventada.
//   Compras  Valor total = soma do valor pago por cabeça (um cadastro = uma cabeça); Valor médio por cabeça = média
//            do valor pago (a população exige o valor preenchido).
// Os blocos usam sempre estes totais (um modelo com outros totais não muda o relatório). Quem não vê valores
// (commercial.values) recebe os blocos sem nenhum item de valor — o aviso de colunas ocultas é o de sempre.
import { groupRows } from './groupEngine.js';
import { computeAggregates } from './reportAggregates.js';
import { REPORT_MODES, SHEET_LAYOUT_GROUPS } from './reportDefinition.js';
import { formatCell, headerLabel, MISSING_SCREEN } from './reportFormatting.js';
import { formatGroupLabel } from './summaryLayout.js';

export const VENDAS_VIEW_ID = 'vendas';
// Sem valor: "-" como no antigo (o Valor total de uma venda sem Valor @ nem valor digitado).
export const VENDAS_MISSING = '-';

const spec = (id, columnId, op) => Object.freeze({ id, columnId, op });
// Totais dos blocos de cada layout (ids fixos — a definição do tipo usa estas listas; folha, XLSX e gates leem por id).
export const VENDAS_BLOCK_TOTALS = Object.freeze([
  spec('animais_vendidos', 'numero_animal', 'countDistinct'),
  spec('peso_total', 'peso', 'sum'),
  spec('peso_medio', 'peso', 'avg'),
  spec('media_arroba', 'peso_arroba', 'avg'),
  spec('media_valor_arroba', 'valor_arroba_venda', 'weightedAvg'),
  spec('valor_total', 'valor_venda_calc', 'sum'),
]);
export const ABATES_BLOCK_TOTALS = Object.freeze([
  spec('animais_abatidos', 'numero_animal', 'countDistinct'),
  spec('peso_total', 'peso', 'sum'),
  spec('peso_medio', 'peso', 'avg'),
  spec('rendimento_medio', 'rendimento_carcaca', 'weightedAvg'),
  spec('arrobas_carcaca', 'quantidade_arrobas', 'sum'),
  spec('media_arroba_carcaca', 'quantidade_arrobas', 'avg'),
  spec('media_valor_arroba', 'valor_arroba_abate', 'weightedAvg'),
  spec('valor_total', 'valor_total_abate', 'sum'),
]);
export const COMPRAS_BLOCK_TOTALS = Object.freeze([
  spec('animais_comprados', 'numero_animal', 'countDistinct'),
  spec('peso_total', 'peso', 'sum'),
  spec('peso_medio', 'peso', 'avg'),
  spec('valor_medio_cabeca', 'valor_pago_cabeca', 'avg'),
  spec('valor_total', 'valor_pago_cabeca', 'sum'),
]);

// Formato de cada total como no PDF: kg e @ com 2 casas ("40.968,00", "15,17"), dinheiro "R$ 383,00", rendimento
// "52,00 %". Um id tem o mesmo formato em todos os layouts.
export const VENDAS_FORMATS = Object.freeze({
  animais_vendidos: Object.freeze({ type: 'integer' }),
  animais_abatidos: Object.freeze({ type: 'integer' }),
  animais_comprados: Object.freeze({ type: 'integer' }),
  peso_total: Object.freeze({ type: 'weight', decimals: 2 }),
  peso_medio: Object.freeze({ type: 'weight', decimals: 2 }),
  media_arroba: Object.freeze({ type: 'number', decimals: 2 }),
  rendimento_medio: Object.freeze({ type: 'percentage', decimals: 2 }),
  arrobas_carcaca: Object.freeze({ type: 'number', decimals: 2 }),
  media_arroba_carcaca: Object.freeze({ type: 'number', decimals: 2 }),
  media_valor_arroba: Object.freeze({ type: 'money', decimals: 2 }),
  valor_medio_cabeca: Object.freeze({ type: 'money', decimals: 2 }),
  valor_total: Object.freeze({ type: 'money', decimals: 2 }),
});

// Rótulos bloco a bloco ([id do total, rótulo, opções]). strong = negrito (Valor total/Valor Total); unit = unidade
// no cartão e no TOTAL GERAL ("455,20 kg", "90 animais"). Vendas = os do antigo, texto a texto.
const STRONG = Object.freeze({ strong: true });
const CENTER = Object.freeze({ align: 'center' });
const ANIMAIS = Object.freeze({ unit: 'animais' });
const KG = Object.freeze({ unit: 'kg' });
const VENDAS_BLOCKS = Object.freeze({
  resumo: [['animais_vendidos', 'Animais vendidos'], ['peso_total', 'Peso total (kg)'], ['peso_medio', 'Peso médio (kg)'], ['media_arroba', 'Média (@)'], ['media_valor_arroba', 'Média valor da arroba'], ['valor_total', 'Valor total', STRONG]],
  porMarca: [['animais_vendidos', 'Qtd', CENTER], ['peso_total', 'Peso Total (kg)'], ['peso_medio', 'Peso Médio (kg)'], ['media_arroba', 'Média (@)'], ['media_valor_arroba', 'Média Valor @'], ['valor_total', 'Valor Total', STRONG]],
  porGrupo: [['animais_vendidos', 'Qtd', CENTER], ['peso_total', 'Peso Total (kg)'], ['valor_total', 'Valor Total', STRONG]],
  cartao: [['animais_vendidos', 'Total', ANIMAIS], ['peso_medio', 'Peso Médio', KG], ['peso_total', 'Peso Total', KG], ['media_arroba', 'Média (@)'], ['valor_total', 'Valor Total']],
  totalGeral: [['animais_vendidos', null, ANIMAIS], ['peso_total', 'Peso Total', KG], ['peso_medio', 'Peso Médio', KG], ['media_arroba', 'Média (@)'], ['valor_total', 'Valor Total']],
});
const ABATES_BLOCKS = Object.freeze({
  resumo: [['animais_abatidos', 'Animais abatidos'], ['peso_total', 'Peso total (kg)'], ['peso_medio', 'Peso médio (kg)'], ['rendimento_medio', 'Rendimento médio'], ['arrobas_carcaca', 'Total @ carcaça'], ['media_arroba_carcaca', 'Média @ carcaça'], ['media_valor_arroba', 'Média valor da arroba'], ['valor_total', 'Valor total', STRONG]],
  porMarca: [['animais_abatidos', 'Qtd', CENTER], ['peso_total', 'Peso Total (kg)'], ['peso_medio', 'Peso Médio (kg)'], ['arrobas_carcaca', 'Total @ Carcaça'], ['media_valor_arroba', 'Média Valor @'], ['valor_total', 'Valor Total', STRONG]],
  porGrupo: [['animais_abatidos', 'Qtd', CENTER], ['peso_total', 'Peso Total (kg)'], ['arrobas_carcaca', 'Total @ Carcaça'], ['valor_total', 'Valor Total', STRONG]],
  cartao: [['animais_abatidos', 'Total', ANIMAIS], ['peso_medio', 'Peso Médio', KG], ['peso_total', 'Peso Total', KG], ['rendimento_medio', 'Rendimento Médio'], ['arrobas_carcaca', 'Total @ Carcaça'], ['valor_total', 'Valor Total']],
  totalGeral: [['animais_abatidos', null, ANIMAIS], ['peso_total', 'Peso Total', KG], ['peso_medio', 'Peso Médio', KG], ['arrobas_carcaca', 'Total @ Carcaça'], ['valor_total', 'Valor Total']],
});
const COMPRAS_BLOCKS = Object.freeze({
  resumo: [['animais_comprados', 'Animais comprados'], ['peso_total', 'Peso total (kg)'], ['peso_medio', 'Peso médio (kg)'], ['valor_medio_cabeca', 'Valor médio por cabeça'], ['valor_total', 'Valor total', STRONG]],
  porMarca: [['animais_comprados', 'Qtd', CENTER], ['peso_total', 'Peso Total (kg)'], ['peso_medio', 'Peso Médio (kg)'], ['valor_medio_cabeca', 'Valor Médio/Cabeça'], ['valor_total', 'Valor Total', STRONG]],
  porGrupo: [['animais_comprados', 'Qtd', CENTER], ['peso_total', 'Peso Total (kg)'], ['valor_total', 'Valor Total', STRONG]],
  cartao: [['animais_comprados', 'Total', ANIMAIS], ['peso_medio', 'Peso Médio', KG], ['peso_total', 'Peso Total', KG], ['valor_medio_cabeca', 'Valor Médio/Cabeça'], ['valor_total', 'Valor Total']],
  totalGeral: [['animais_comprados', null, ANIMAIS], ['peso_total', 'Peso Total', KG], ['peso_medio', 'Peso Médio', KG], ['valor_total', 'Valor Total']],
});

// Configuração de cada layout. countId = total de animais (1 = "animal"); groupLabel = cabeçalho da coluna do grupo e
// do Excel; cardPrefix = título do cartão ("COMPRADOR: W3"); emphasis = colunas destacadas no detalhe (o antigo
// punha o Valor Total em semi-negrito e o Animal em peso médio); emptyText = a folha sem lançamento (texto do antigo).
export const SHEET_LAYOUT_CONFIGS = Object.freeze({
  vendas: Object.freeze({
    groupColumn: SHEET_LAYOUT_GROUPS.vendas, totals: VENDAS_BLOCK_TOTALS, blocks: VENDAS_BLOCKS, countId: 'animais_vendidos',
    groupLabel: 'Comprador', porGrupoTitle: 'TOTAIS POR COMPRADOR', gruposTitle: 'VENDAS POR COMPRADOR (DETALHADO)', cardPrefix: 'COMPRADOR',
    emphasis: Object.freeze({ valor_venda_calc: 'semibold', numero_animal: 'medium' }), emptyText: 'Nenhuma venda encontrada com os filtros aplicados.',
  }),
  abates: Object.freeze({
    groupColumn: SHEET_LAYOUT_GROUPS.abates, totals: ABATES_BLOCK_TOTALS, blocks: ABATES_BLOCKS, countId: 'animais_abatidos',
    groupLabel: 'Frigorífico', porGrupoTitle: 'TOTAIS POR FRIGORÍFICO', gruposTitle: 'ABATES POR FRIGORÍFICO (DETALHADO)', cardPrefix: 'FRIGORÍFICO',
    emphasis: Object.freeze({ valor_total_abate: 'semibold', numero_animal: 'medium' }), emptyText: 'Nenhum abate encontrado com os filtros aplicados.',
  }),
  compras: Object.freeze({
    groupColumn: SHEET_LAYOUT_GROUPS.compras, totals: COMPRAS_BLOCK_TOTALS, blocks: COMPRAS_BLOCKS, countId: 'animais_comprados',
    groupLabel: 'Origem', porGrupoTitle: 'TOTAIS POR ORIGEM', gruposTitle: 'COMPRAS POR ORIGEM (DETALHADO)', cardPrefix: 'ORIGEM',
    emphasis: Object.freeze({ valor_pago_cabeca: 'semibold', numero_animal: 'medium' }), emptyText: 'Nenhuma compra encontrada com os filtros aplicados.',
  }),
});

const upper = (text) => String(text ?? '').toLocaleUpperCase('pt-BR');
const isMissing = (value) => value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));

/** Layout do desenho de venda do view model ('vendas' | 'abates' | 'compras'), ou null (outra folha). */
export function sheetLayoutOf(viewModel) {
  const layout = viewModel?.view?.sheetLayout ?? null;
  return layout && SHEET_LAYOUT_CONFIGS[layout] ? layout : null;
}

// Sem sheetLayout no view model (view model montado à mão, como no gate da E1D) = o desenho de Vendas.
const configOf = (viewModel) => SHEET_LAYOUT_CONFIGS[sheetLayoutOf(viewModel) ?? VENDAS_VIEW_ID];

/**
 * O view model é uma visão com o desenho de venda (Pesagens › Vendas; Comercial › Vendas, Abates, Compras) sem
 * detalhe de grupo (o clique abre o Detalhado comum) e agrupada pela coluna do desenho?
 */
export function isVendasViewModel(viewModel) {
  const layout = sheetLayoutOf(viewModel);
  return Boolean(layout)
    && viewModel.mode === REPORT_MODES.DETALHADO
    && !(viewModel.drill ?? []).length
    && (viewModel.groups ?? []).map((group) => group.columnId).join('|') === SHEET_LAYOUT_CONFIGS[layout].groupColumn;
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
function itemsOf(entries, aggregates, visible) {
  return entries.filter(([id]) => visible.has(id)).map((entry) => item(aggregates, entry));
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
function detailCell(viewModel, entry, row, emphasis) {
  const accessor = viewModel.resolve(entry.key);
  const raw = entry.column?.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row);
  const shown = entry.column?.type === 'weight' ? { ...entry.column, decimals: 0 } : entry.column;
  const formatted = formatCell(shown, raw, 'print');
  const text = formatted === MISSING_SCREEN || formatted === '' ? VENDAS_MISSING : formatted;
  return { key: entry.key, raw: isMissing(raw) ? null : raw, text, align: entry.align, emphasis: emphasis[entry.key] ?? null };
}

/**
 * Blocos do relatório de venda.
 * @param viewModel resultado de runReport com uma visão de sheetLayout (usa view, rows, resolve, availableColumns,
 *   columns); sem sheetLayout = Vendas
 * @param {{ showDetails?: boolean, columns?: object[] }} options showDetails = "Mostrar Detalhes" (os lançamentos de
 *   cada grupo abaixo do cartão); columns = colunas visíveis da folha (doc.columns) para o detalhe
 * @returns {{ layout: string, groupColumn: string, groupLabel: string, showDetails: boolean, hasValues: boolean,
 *   totals: string[], emptyText: string,
 *   resumo: { columns: object[], rows: object[] },
 *   porMarca: { title: string, columns: object[], rows: object[] },
 *   porGrupo: { title: string, columns: object[], rows: object[] },
 *   grupos: { title: string, detailColumns: object[]|null, items: { id, key, label, title, missing, rowCount, totals: object[], rows: object[]|null }[] },
 *   totalGeral: { items: object[], text: string } }}
 *   Cada item/célula de total leva { key, label, value (bruto), text (formatado), strong, align }.
 */
export function buildVendasBlocks(viewModel, { showDetails = false, columns = null } = {}) {
  if (typeof viewModel?.resolve !== 'function') throw new Error('vendas: view model sem resolve (use o resultado de runReport)');
  const config = configOf(viewModel);
  const { blocks } = config;
  const available = new Set((viewModel.availableColumns ?? viewModel.columns ?? []).map((column) => column.id));
  // Total só com a coluna que o perfil vê (availableColumns já vem filtrado pelo serviço): sem commercial.values,
  // os totais de valor nem são calculados.
  const specs = config.totals.filter((total) => available.has(total.columnId));
  const visible = new Set(specs.map((total) => total.id));
  const rows = viewModel.rows ?? [];
  const resolve = viewModel.resolve;
  const columnOf = (columnId) => (viewModel.availableColumns ?? []).find((column) => column.id === columnId) ?? null;
  const groupsBy = (columnId) => groupRows(rows, [{ columnId }], resolve, { aggregates: specs }).nodes.map((node) => ({
    node,
    label: formatGroupLabel(columnOf(columnId), node.label, 'print', node.missing),
  }));
  const totals = computeAggregates(rows, specs, resolve);

  const tableColumns = (first, entries) => [
    { key: '__label__', label: first, align: 'left' },
    ...entries.filter(([id]) => visible.has(id)).map(([id, label, options = {}]) => ({ key: id, label, align: options.align ?? 'right', strong: Boolean(options.strong) })),
  ];
  const tableRows = (groups, entries) => groups.map(({ node, label }) => ({ id: node.id, key: node.key, label, missing: node.missing, cells: itemsOf(entries, node.aggregates, visible) }));

  const porGrupo = groupsBy(config.groupColumn);
  const detailColumns = showDetails ? detailColumnsOf(viewModel, columns) : null;
  const layout = sheetLayoutOf(viewModel) ?? VENDAS_VIEW_ID;
  return {
    layout,
    groupColumn: config.groupColumn,
    groupLabel: config.groupLabel,
    showDetails: Boolean(showDetails),
    hasValues: visible.has('valor_total'),
    totals: [...visible],
    emptyText: config.emptyText,
    resumo: {
      columns: [{ key: '__label__', label: 'Métrica', align: 'left' }, { key: '__value__', label: 'Valor', align: 'right' }],
      rows: itemsOf(blocks.resumo, totals, visible),
    },
    porMarca: { title: 'TOTAIS POR MARCA', columns: tableColumns('Marca', blocks.porMarca), rows: tableRows(groupsBy('marca'), blocks.porMarca) },
    porGrupo: { title: config.porGrupoTitle, columns: tableColumns(config.groupLabel, blocks.porGrupo), rows: tableRows(porGrupo, blocks.porGrupo) },
    grupos: {
      title: config.gruposTitle,
      detailColumns,
      items: porGrupo.map(({ node, label }) => ({
        id: node.id,
        key: node.key,
        label,
        title: `${config.cardPrefix}: ${upper(label)}`,
        missing: node.missing,
        rowCount: node.rowCount,
        totals: itemsOf(blocks.cartao, node.aggregates, visible).map((entry) => ({ ...entry, display: withUnit(entry) })),
        rows: detailColumns ? node.rows.map((row, index) => ({ id: String(row.id ?? index), cells: detailColumns.map((entry) => detailCell(viewModel, entry, row, config.emphasis)) })) : null,
      })),
    },
    totalGeral: (() => {
      const items = itemsOf(blocks.totalGeral, totals, visible).map((entry) => ({ ...entry, display: withUnit(entry) }));
      const parts = items.map((entry) => (entry.label ? `${entry.label}: ${entry.display}` : entry.display));
      return { items, text: `TOTAL GERAL: ${parts.join(' | ')}` };
    })(),
  };
}

/** Corpo do documento no layout "vendas": sem seções/linhas da folha comum (os blocos estão em doc.vendas). */
export function vendasDocumentBody(blocks) {
  const dataRows = blocks.grupos.items.reduce((sum, entry) => sum + (entry.rows?.length ?? 0), 0);
  return {
    sections: [],
    flat: null,
    grandTotal: null,
    drillTargets: {},
    stats: {
      sections: 0,
      tables: 3 + (blocks.showDetails ? blocks.grupos.items.length : 0),
      groupRows: blocks.porGrupo.rows.length,
      subtotalRows: 0,
      leafTotalRows: 0,
      totalRows: 0,
      dataRows,
      grandRows: 1,
      marcas: blocks.porMarca.rows.length,
      grupos: blocks.grupos.items.length,
    },
  };
}
