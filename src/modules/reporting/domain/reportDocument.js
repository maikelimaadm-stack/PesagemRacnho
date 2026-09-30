// Documento da FOLHA do relatório (E1B 1.4.0): função pura que transforma o view model da E1 no modelo
// que a tela, a impressão e o PDF desenham (um renderizador só: infrastructure/exporters/sheetHtml.js).
//
//   Resumido  → seções por nível de agrupamento (APARTAÇÃO: … › DATA: …), tabela do nível folha, linha
//               de Subtotal por seção, bloco "TOTAL POR <nível folha> – <nível 1>" (3 níveis) e Total geral;
//   Detalhado → ("Ver como folha") seções por nível com as linhas de dados e o subtotal em linha de totais;
//   Matriz    → (E1D, Sintético (Matriz)) uma tabela cruzada Linhas × Colunas com TOTAL (domain/matrixLayout).
//
// Nenhuma conta nova: os valores são os agregados que o motor da E1 já calculou em cada nó (o pai recalcula
// sobre a própria população, nunca soma filhos) e o "TOTAL POR" é o MESMO motor (groupRows) sobre a
// população da seção de nível 1 (buildLeafTotalBlock — o XLSX grava o mesmo bloco). Colunas: cada linha é gerada por columns.map — uma célula por coluna, na
// ordem do cabeçalho (o erro de colunas desalinhadas do modelo antigo fica impossível por construção).
// Coluna sem nenhum valor no relatório inteiro some (opção showEmptyColumns desliga); GMD sem pesagem
// anterior fica "—" (o motor exclui).
//
// E1D item 8 ("menos informação na folha" — vale para TODOS os relatórios: a folha é uma só): título
// "(Analítico)"/"(Sintético)" pelo tipo do relatório; abaixo dele só "Período: dd/mm/aaaa a dd/mm/aaaa";
// cabeçalho sem "Emitido em"; nenhuma nota longa. O rodapé leva só os filtros (numa linha), "@ = peso vivo
// ÷ N" quando houver @, as colunas omitidas pelo perfil (quando houver) e quem emitiu e quando; "Página X
// de Y" fica na margem da página.
//
// E1D visual (decisão da responsável: "igual ao MAKGESTAO no visual, com as contas certas"): os 5 tipos de
// Pesagens saem com a cara da folha do antigo (doc.style = 'makgestao' — seção "Folha no estilo do
// MAKGESTAO" abaixo); o Personalizado e os outros relatórios continuam nesta folha da E1B.
import { PESAGENS_SHEET_HEADERS, PESAGENS_SHEET_LINES, PESAGENS_VIEW_IDS } from '../definitions/pesagens.js';
import { aggregateLabel, aggregateValueColumn } from './aggregateLabels.js';
import { describeFilter } from './filterEngine.js';
import { compareGroupLabels, groupRows, NONE_GROUP_KEY } from './groupEngine.js';
import { buildMatrix, isMatrixViewModel, MATRIX_TOTAL_LABEL, matrixCellLines, matrixValues } from './matrixLayout.js';
import { computeAggregate } from './reportAggregates.js';
import { REPORT_MODES } from './reportDefinition.js';
import { formatCell, headerLabel, MISSING_SCREEN } from './reportFormatting.js';
import { formatGroupLabel, summaryMetrics, SUMMARY_LABEL_SORT, SUMMARY_ROWS_METRIC } from './summaryLayout.js';
import { buildVendasBlocks, isVendasViewModel, vendasDocumentBody } from './vendasLayout.js';

export const DOCUMENT_KIND = 'pesagens.report-document';
export const DOC_ROW_TYPES = Object.freeze({
  GROUP: 'GROUP', // um grupo do nível folha (linha da tabela da seção)
  SUBTOTAL: 'SUBTOTAL', // totais do nó da seção
  LEAF_TOTAL: 'LEAF_TOTAL', // linha do bloco "TOTAL POR <folha>" (reagrupamento da seção de nível 1)
  TOTAL: 'TOTAL', // total da seção de nível 1 no fim do bloco "TOTAL POR"
  GRAND_TOTAL: 'GRAND_TOTAL',
  DATA: 'DATA', // linha de dados (Detalhado como folha)
});
export const LABEL_COLUMN_KEY = '__label__';

// Largura útil do A4 com margens de 10 mm (px impressos a 96 dpi) e os tamanhos de fonte da folha.
export const SHEET_PAGE = Object.freeze({
  PORTRAIT_WIDTH_PX: 718,
  LANDSCAPE_WIDTH_PX: 1047,
  SIZES: Object.freeze([
    Object.freeze({ id: 'm', factor: 1 }), // 8,5 pt
    Object.freeze({ id: 's', factor: 0.894 }), // 7,6 pt
    Object.freeze({ id: 'xs', factor: 0.8 }), // 6,8 pt
  ]),
  CELL_PADDING_PX: 9,
  LABEL_MIN_PX: 64,
  LABEL_MAX_PX: 210,
  METRIC_MIN_PX: 34,
  DETAIL_PORTRAIT_MAX: 1000, // Detalhado: soma das larguras de tela das colunas (como na E1)
  DETAIL_LANDSCAPE_MAX: 1520,
});
// Largura média de caractere (px) em 8,5 pt: rótulo em Arial, número em Consolas, cabeçalho em negrito menor.
const CHAR_PX = Object.freeze({ label: 6.2, number: 6.3, header: 5.9 });
// Folha do MAKGESTAO: 9 pt (text-xs do antigo, 12 px) em Segoe UI/Consolas (medidas no Electron: cabeçalho
// 6,65, rótulo 6,83, número 6,6 px por caractere), cabeçalho numa linha só (negrito) e 8 px de respiro de cada
// lado da célula (p-2); com a fonte menor (s/xs) o respiro cai para 6/4 px (sheetStyles).
const CHAR_PX_MAK = Object.freeze({ label: 7.0, number: 6.6, header: 6.7 });
const CELL_PADDING_MAK_PX = Object.freeze({ m: 16, s: 12, xs: 8 });

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const upper = (text) => String(text ?? '').toLocaleUpperCase('pt-BR');
const isMissingValue = (value) => value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));
const COUNT_OPS = new Set(['count', 'countValid', 'countDistinct']);

function brDate(iso) {
  return String(iso ?? '').slice(0, 10).split('-').reverse().join('/');
}

export function formatEmittedAt(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Filtros aplicados em texto (condições fixas, filtros do usuário, detalhe do grupo e pesquisa). */
export function describeReportFilters(viewModel) {
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  const columnOf = (columnId) => available.find((column) => column.id === columnId) ?? null;
  const label = (columnId) => columnOf(columnId)?.label ?? columnId;
  const parts = [
    ...Object.entries(viewModel.lockedFilters || {}).map(([id, filter]) => `${label(id)} ${describeFilter(filter, columnOf(id))} (fixo)`),
    ...Object.entries(viewModel.filters || {}).map(([id, filter]) => `${label(id)} ${describeFilter(filter, columnOf(id))}`),
    ...(viewModel.drill || []).map((part) => `${part.columnLabel ?? label(part.columnId)} = ${part.label ?? part.key} (detalhe do grupo)`),
  ];
  if (viewModel.search) parts.push(`pesquisa “${viewModel.search}”`);
  return parts.length ? parts.join(' · ') : 'Nenhum';
}

/** Plural simples de um rótulo de nível ("Lote" → "Lotes", "Apartação" → "Apartações"). */
function pluralOf(label) {
  const word = String(label ?? '').split(' (')[0].trim();
  if (!word) return 'Grupos';
  if (/ão$/i.test(word)) return word.replace(/ão$/i, 'ões');
  if (/l$/i.test(word)) return `${word.slice(0, -1)}is`;
  if (/[rzs]$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

function metricValueOf(node, key) {
  if (key === SUMMARY_ROWS_METRIC) return node.rowCount;
  return node.aggregates?.[key]?.value ?? null;
}

/**
 * Ordem dos irmãos: a mesma do Resumido da E1 (summarySort dentro do nível; ausente sempre por último).
 * E1D: summarySort.columnId restringe a ordem ao nível dessa coluna (as seções acima ficam na ordem natural).
 */
export function orderNodes(nodes, summarySort) {
  if (!summarySort?.key) return nodes;
  if (summarySort.columnId && nodes[0]?.columnId !== summarySort.columnId) return nodes;
  const direction = summarySort.direction === 'desc' ? -1 : 1;
  return [...nodes].sort((left, right) => {
    if (left.missing !== right.missing) return left.missing ? 1 : -1;
    if (summarySort.key === SUMMARY_LABEL_SORT) return direction * compareGroupLabels(left, right);
    const a = metricValueOf(left, summarySort.key);
    const b = metricValueOf(right, summarySort.key);
    const missingA = isMissingValue(a);
    const missingB = isMissingValue(b);
    if (missingA || missingB) return missingA === missingB ? compareGroupLabels(left, right) : (missingA ? 1 : -1);
    if (typeof a === 'number' && typeof b === 'number') return a === b ? compareGroupLabels(left, right) : direction * (a - b);
    return direction * collator.compare(String(a), String(b));
  });
}

function columnLookup(viewModel) {
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  return (columnId) => available.find((column) => column.id === columnId) ?? null;
}

/** Texto de uma faixa "de–até" (ex.: 250–500); inteiro sem casas, fração com 1 casa. */
/** Faixa "de–até" (150–350; ≥ 150; ≤ 350; "—"): a mesma na folha, nos totais do Detalhado e na grade. */
export function rangeText(from, to) {
  const fmt = (value) => Number(value).toLocaleString('pt-BR', Number.isInteger(Number(value)) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const hasFrom = !isMissingValue(from);
  const hasTo = !isMissingValue(to);
  if (hasFrom && hasTo) return `${fmt(from)}–${fmt(to)}`;
  if (hasFrom) return `≥ ${fmt(from)}`;
  if (hasTo) return `≤ ${fmt(to)}`;
  return MISSING_SCREEN;
}

// ---------------------------------------------------------------------------
// Folha no estilo do MAKGESTAO (E1D visual)
// ---------------------------------------------------------------------------
// Só os 5 tipos de Pesagens (doc.style = 'makgestao'; o Personalizado e os outros relatórios continuam na
// folha da E1B). Muda a APRESENTAÇÃO, como na folha do antigo (RelatorioPesagensIndividuais.jsx): cabeçalhos
// dele (Title Case, sem unidade entre parênteses), "kg" em cada peso (Menor/Maior/Faixa em kg inteiros),
// ausente/zero = "-", e Subtotal/Total/TOTAL GERAL como LINHA DE TEXTO (row.line). As linhas de total da
// tabela continuam no documento com as células (os mesmos números do XLSX) — a folha desenha a linha.
// As contas continuam as do motor (animais distintos, GMD ponderado, médias recalculadas, meses em ordem):
// cada número da linha é um agregado do motor sobre a população do grupo (PESAGENS_SHEET_LINES).

export const SHEET_STYLES = Object.freeze({ E1B: 'e1b', MAKGESTAO: 'makgestao' });
// Ausente e zero de contagem aparecem "-" (hífen), como no antigo.
export const MAK_MISSING = '-';
// Negrito/semi-negrito das tabelas por lote do antigo (Qtd em negrito; Peso Médio e GMD Médio semi).
const MAK_EMPHASIS = Object.freeze({ qtd: 'bold', peso_medio: 'semibold', gmd_medio: 'semibold' });
const MAK_SMALL_WORDS = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'por']);
// Zero que o antigo mostrava "-" nas linhas de dados (Dias: `p.dias || '-'`).
const MAK_ZERO_AS_MISSING = new Set(['dias']);

/** Estilo da folha: 'makgestao' só nos 5 tipos de Pesagens; o resto (Personalizado, outros relatórios) 'e1b'. */
export function sheetStyleOf(viewModel) {
  return viewModel?.reportId === 'pesagens' && PESAGENS_VIEW_IDS.includes(viewModel.view?.id) ? SHEET_STYLES.MAKGESTAO : SHEET_STYLES.E1B;
}

/** Variante do desenho do antigo (cada tipo tinha o seu): data-view da folha. */
function makVariant(viewModel, layout) {
  if (layout === 'matrix') return 'matriz';
  if (layout === 'summary') return viewModel.view?.id === 'por-apartacao-lote' ? 'apartacao-lote' : 'resumo-data';
  return viewModel.view?.id === 'vendas' ? 'vendas' : 'analitico';
}

/** Cabeçalho no jeito do antigo: sem "(unidade)" no fim (menos "(@)") e em Title Case ("Peso médio (kg)" → "Peso Médio"). */
export function makHeaderLabel(label) {
  const base = String(label ?? '').replace(/\s*\((?!@\))[^)]*\)\s*$/, '').trim();
  return base.split(/\s+/).map((word, index) => (index > 0 && MAK_SMALL_WORDS.has(word.toLowerCase())
    ? word.toLowerCase()
    : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1))).join(' ');
}

const makInteger = (value) => Math.round(Number(value)).toLocaleString('pt-BR');

/** Faixa exigida como no antigo: "250-500 kg" (inteiros); um lado só "≥ 250 kg"/"≤ 500 kg"; sem faixa "-". */
export function makRangeText(from, to) {
  const hasFrom = !isMissingValue(from);
  const hasTo = !isMissingValue(to);
  if (hasFrom && hasTo) return `${makInteger(from)}-${makInteger(to)} kg`;
  if (hasFrom) return `≥ ${makInteger(from)} kg`;
  if (hasTo) return `≤ ${makInteger(to)} kg`;
  return MAK_MISSING;
}

/**
 * Texto de um número da folha do antigo: casas da coluna, "kg" em todo peso (Menor/Maior em kg inteiros —
 * fmtInteiro do antigo), ausente "-". Arredondar é só apresentação (o número do motor não muda).
 * @param column coluna de valor (aggregateValueColumn ou a coluna da linha)
 * @param {{ op?: string, decimals?: number, unit?: boolean }} options unit=false tira o "kg" (Vendas: "Peso (kg)")
 */
function makNumberText(column, value, { op = null, decimals = null, unit = true } = {}) {
  if (isMissingValue(value) || value === '') return MAK_MISSING;
  const isWeight = column?.type === 'weight';
  const places = Number.isInteger(decimals) ? decimals : isWeight && (op === 'min' || op === 'max') ? 0 : null;
  const text = formatCell(Number.isInteger(places) ? { ...column, decimals: places } : column, value, 'print');
  if (text === MISSING_SCREEN || text === '') return MAK_MISSING;
  return unit && isWeight && column.unit ? `${text} ${column.unit}` : text;
}

/**
 * Colunas das tabelas por lote no estilo do antigo (rótulo, alinhamento e o que é monoespaçado/negrito).
 * Resumo por Data: centralizado, números em fonte mono, Lote/Peso Médio/GMD Médio semi e Qtd em negrito; Por
 * Apartação/Lote: grade com bordas, tudo à esquerda e sem destaque (como o antigo desenhava esse tipo).
 */
function makSummaryColumns(columns, variant) {
  const plain = variant === 'apartacao-lote';
  const align = plain ? 'left' : 'center';
  return columns.map((column) => {
    if (column.kind === 'label') return { ...column, align: 'left', mk: { mono: false, weight: plain ? null : 'semibold' } };
    if (column.kind === 'matrix') return { ...column, align: 'center', mk: { mono: true, weight: null } };
    const id = column.kind === 'pair' ? column.pair.id : column.key;
    const label = PESAGENS_SHEET_HEADERS.metrics[id] ?? makHeaderLabel(column.label);
    const mono = !plain && (column.kind === 'pair' || !COUNT_OPS.has(column.op));
    return { ...column, label, align, mk: { mono, weight: plain ? null : MAK_EMPHASIS[column.key] ?? null } };
  });
}

/**
 * Número de uma linha de total do antigo: o agregado do tipo quando o view model já o tem (mesmo número da
 * grade e do XLSX); senão o MESMO motor sobre a população do grupo — só em coluna que o perfil vê (a lista de
 * colunas do view model já vem sem as que o perfil não vê). undefined = o item não entra (sem permissão).
 */
function makLineResult(mak, spec, source) {
  const own = (mak.viewModel.aggregates ?? []).find((item) => item.op === spec.op && (item.columnId ?? null) === (spec.columnId ?? null));
  if (own) return source.aggregates?.[own.id] ?? null;
  if (typeof mak.viewModel.resolve !== 'function' || (spec.columnId && !mak.available.some((column) => column.id === spec.columnId))) return undefined;
  return computeAggregate(source.rows ?? [], spec, mak.viewModel.resolve);
}

/**
 * Linha de total em texto (Subtotal/Total/TOTAL GERAL do antigo).
 * @param items itens de PESAGENS_SHEET_LINES (o 1º sem rótulo recebe o `lead`: "Subtotal 02/06/2026", "Total")
 * @param source { aggregates, rows } — nó do motor, ou { aggregates: totals, rows } no total geral
 * @param {{ lead: string, layout: 'grid'|'box'|'right', lotes?: number|null }} options
 * @returns {{ layout, items: { key, label, text, raw }[] }}
 */
function makLine(mak, items, source, { lead, layout, lotes = null }) {
  const out = [];
  for (const item of items) {
    if (item.lotes) {
      if (lotes !== null) out.push({ key: item.key, label: item.label, text: makInteger(lotes), raw: lotes });
      continue;
    }
    const result = makLineResult(mak, item.spec, source);
    if (result === undefined) continue;
    const value = result?.value ?? null;
    const column = aggregateValueColumn(item.spec, mak.available);
    let text;
    if (isMissingValue(value)) text = MAK_MISSING;
    else if (item.unit === 'animais') text = `${makInteger(value)} ${value === 1 ? 'animal' : 'animais'}`;
    else {
      text = formatCell(column, value, 'print');
      if (item.unit) text = `${text} ${item.unit}`;
      // Valor total digitado só em parte das vendas: a linha diz quantas (decisão da E1D, como na E1B).
      if (column.type === 'money' && result.n_validos > 0 && result.n_validos < result.n_total) text = `${text} (${result.n_validos} de ${result.n_total})`;
    }
    // arroba: a linha mostra @ (o rodapé explica "@ = peso vivo ÷ N" mesmo sem a coluna de @ na tabela).
    out.push({ key: item.key, label: item.label ?? lead, text, raw: value, ...(column.unit === '@' ? { arroba: true } : {}) });
  }
  return { layout, items: out };
}

/** Quantos grupos do nível folha (lotes) uma população tem — o mesmo motor de agrupamento (groupRows). */
function makLeafCount(mak, rows) {
  const leaf = (mak.viewModel.groups ?? []).at(-1);
  if (!leaf || typeof mak.viewModel.resolve !== 'function') return null;
  return groupRows(rows ?? [], [{ columnId: leaf.columnId }], mak.viewModel.resolve).nodes.length;
}

/** Texto de uma célula de dados (Analítico/Vendas) como no antigo: Sexo "M"/"F", kg nos pesos, "-" no vazio. */
function makDataCell(mak, column, raw) {
  const source = column.column;
  if (source.id === 'sexo' && !isMissingValue(raw) && String(raw).trim() !== '') {
    const text = String(raw).trim();
    if (/^m/i.test(text)) return { text: 'M' };
    if (/^f/i.test(text)) return { text: 'F' };
  }
  if (MAK_ZERO_AS_MISSING.has(source.id) && Number(raw) === 0) return { text: MAK_MISSING };
  const numeric = ['integer', 'number', 'weight', 'gmd', 'money', 'percentage'].includes(source.type);
  const text = numeric
    ? makNumberText(source, raw, { decimals: column.mk.decimals, unit: column.mk.unit })
    : formatCell(source, raw, 'print');
  const shown = text === MISSING_SCREEN || text === '' ? MAK_MISSING : text;
  // GMD verde quando ganha, vermelho quando perde (text-emerald-600 / text-red-600 do antigo).
  const tone = source.type === 'gmd' && typeof raw === 'number' && raw !== 0 ? (raw > 0 ? 'pos' : 'neg') : null;
  return { text: shown, tone };
}

// ---------------------------------------------------------------------------
// Colunas do Resumido
// ---------------------------------------------------------------------------

function summaryColumns(viewModel) {
  const columnOf = columnLookup(viewModel);
  const metrics = summaryMetrics(viewModel);
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const pairs = (viewModel.metricPairs || []).filter((pair) => byKey.has(pair.from) && byKey.has(pair.to));
  const paired = new Set(pairs.flatMap((pair) => [pair.from, pair.to]));
  const leafLevel = (viewModel.groups ?? []).at(-1) ?? null;
  const columns = [{ key: LABEL_COLUMN_KEY, label: leafLevel?.label ?? 'Resumo', kind: 'label', align: 'left' }];
  for (const metric of metrics) {
    const pair = pairs.find((item) => item.from === metric.key);
    if (pair) {
      columns.push({ key: `pair:${pair.id}`, label: pair.label, kind: 'pair', align: 'right', pair, from: metric, to: byKey.get(pair.to) });
      continue;
    }
    if (paired.has(metric.key)) continue;
    const source = metric.spec?.columnId ? columnOf(metric.spec.columnId) : null;
    columns.push({
      key: metric.key,
      label: metric.label,
      kind: 'metric',
      align: 'right',
      metric,
      op: metric.spec?.op ?? 'count',
      zeroAsEmpty: Boolean(source?.zeroAsEmpty),
      unit: metric.column?.unit ?? null,
    });
  }
  return columns;
}

function metricIsEmpty(column, totals) {
  if (column.kind === 'label') return false;
  // Sem totais configurados, a métrica é a contagem de linhas (rowCount do nó), que não mora em totals:
  // nunca é "vazia" quando há linhas (buildReportDocument só chama isto com hasRows).
  if (column.key === SUMMARY_ROWS_METRIC) return false;
  if (column.kind === 'pair') return isMissingValue(totals?.[column.from.key]?.value) && isMissingValue(totals?.[column.to.key]?.value);
  const value = totals?.[column.key]?.value ?? null;
  if (isMissingValue(value)) return true;
  return column.zeroAsEmpty && value === 0;
}

function summaryCell(column, index, { node, aggregates, isLeafRow, labelText }, mak = null) {
  const align = mak ? column.align : 'right';
  if (column.kind === 'label') return { col: index, key: column.key, text: labelText, raw: labelText, align: 'left', kind: 'label' };
  if (column.kind === 'pair') {
    if (column.pair.leafOnly && !isLeafRow) return { col: index, key: column.key, text: '', raw: null, align, kind: 'num' };
    const from = aggregates?.[column.from.key]?.value ?? null;
    const to = aggregates?.[column.to.key]?.value ?? null;
    return { col: index, key: column.key, text: mak ? makRangeText(from, to) : rangeText(from, to), raw: [from, to], align, kind: 'num' };
  }
  const result = column.key === SUMMARY_ROWS_METRIC ? { value: node?.rowCount ?? null } : aggregates?.[column.key];
  let value = result?.value ?? null;
  if (column.zeroAsEmpty && value === 0) value = null;
  const partial = result && !COUNT_OPS.has(column.op) && Number.isInteger(result.n_validos) && Number.isInteger(result.n_total)
    && result.n_validos > 0 && result.n_validos < result.n_total ? { nValid: result.n_validos, nTotal: result.n_total } : null;
  const text = mak ? makNumberText(column.metric.column, value, { op: column.op }) : formatCell(column.metric.column, value, 'print');
  return { col: index, key: column.key, text, raw: value, align, kind: 'num', partial };
}

// ---------------------------------------------------------------------------
// Bloco "TOTAL POR <nível folha> – <nível 1>" (3 níveis)
// ---------------------------------------------------------------------------

/**
 * Bloco "TOTAL POR <nível folha> – <nível 1>" de uma seção de nível 1 do Resumido com 3 níveis: o MESMO
 * motor (groupRows) sobre a população do nó, reagrupada pelo nível folha (uma linha por lote, nunca soma de
 * linhas), na ordem do Resumido, e o próprio nó como linha "Total <nível 1>". A folha (LEAF_TOTAL/TOTAL) e
 * o XLSX (E1C) desenham ESTE bloco — mesmos grupos, rótulos e agregados por construção.
 * @param viewModel resultado de runReport (usa groups, aggregates, summarySort e resolve)
 * @param node nó de nível 1 da árvore (viewModel.tree, com as linhas da população)
 * @param {{ target?: 'print'|'xlsx' }} options formato dos rótulos (data dd/mm/aaaa e Sim/Não nos dois)
 * @returns {null | { id: string, title: string, leafLevel: object, lines: { id, node, label, path }[],
 *   total: { id, node, label, path } }} null com menos de 3 níveis ou nó que não é de nível 1
 */
export function buildLeafTotalBlock(viewModel, node, { target = 'print' } = {}) {
  const levels = viewModel.groups ?? [];
  if (levels.length < 3 || node?.level !== 1) return null;
  const columnOf = columnLookup(viewModel);
  const leafLevel = levels[levels.length - 1];
  const leafColumn = columnOf(leafLevel.columnId);
  const nodeLabel = formatGroupLabel(columnOf(levels[0]?.columnId), node.label, target, node.missing || node.key === NONE_GROUP_KEY);
  const specs = (viewModel.aggregates ?? []).map((spec) => ({ id: spec.id, op: spec.op, ...(spec.columnId ? { columnId: spec.columnId } : {}) }));
  const regrouped = groupRows(node.rows, [{ columnId: leafLevel.columnId, direction: leafLevel.direction }], viewModel.resolve, { aggregates: specs });
  const lines = orderNodes(regrouped.nodes, viewModel.summarySort).map((child) => ({
    id: `${node.id}#total-por|${child.id}`,
    node: child,
    label: formatGroupLabel(leafColumn, child.label, target, child.missing),
    path: [...node.path, ...child.path],
  }));
  return {
    id: `${node.id}#total-por`,
    title: `TOTAL POR ${upper(leafLevel.label)} – ${upper(nodeLabel)}`,
    leafLevel,
    lines,
    total: { id: `${node.id}#total`, node, label: `Total ${nodeLabel}`, path: node.path },
  };
}

// ---------------------------------------------------------------------------
// Corpo do Resumido
// ---------------------------------------------------------------------------

function buildSummaryBody(viewModel, columns, mak = null) {
  const columnOf = columnLookup(viewModel);
  const levels = viewModel.groups ?? [];
  const depth = levels.length;
  const levelColumn = (level) => columnOf(levels[level - 1]?.columnId);
  const nodeLabel = (node) => formatGroupLabel(levelColumn(node.level), node.label, 'print', node.missing || node.key === NONE_GROUP_KEY);
  const stats = { sections: 0, tables: 0, groupRows: 0, subtotalRows: 0, leafTotalRows: 0, totalRows: 0, dataRows: 0, grandRows: 0 };
  const drillTargets = {};
  // Estilo MAKGESTAO: itens da linha de total do tipo (Resumo por Data: 5; Por Apartação/Lote: 6).
  const lineItems = mak ? PESAGENS_SHEET_LINES[mak.variant === 'apartacao-lote' ? 'por-apartacao-lote' : 'por-apartacao-data'] : null;

  const row = (type, id, cellsArgs, drill, line = null) => {
    if (drill) drillTargets[id] = drill;
    const out = { type, id, drill: drill ? id : null, cells: columns.map((column, index) => summaryCell(column, index, cellsArgs, mak)) };
    if (line) out.line = line;
    return out;
  };
  const groupRow = (node) => {
    stats.groupRows += 1;
    return row(DOC_ROW_TYPES.GROUP, node.id, { node, aggregates: node.aggregates, isLeafRow: node.level === depth, labelText: nodeLabel(node) }, node.path);
  };
  const subtotalRow = (node) => {
    stats.subtotalRows += 1;
    const childLevel = levels[node.level];
    const children = node.children?.length ?? 0;
    const text = `Subtotal ${nodeLabel(node)}${childLevel ? ` · ${pluralOf(childLevel.label)}: ${children}` : ''}`;
    // Antigo: "Subtotal 02/06/2026: 103 animais … Lotes: 3" (data) e "Total: … Lotes: 3" (apartação).
    const line = mak ? makLine(mak, lineItems, node, { lead: node.level === 1 ? 'Total' : `Subtotal ${nodeLabel(node)}`, layout: 'grid', lotes: node.level === depth - 1 ? children : makLeafCount(mak, node.rows) }) : null;
    return row(DOC_ROW_TYPES.SUBTOTAL, `${node.id}#subtotal`, { node, aggregates: node.aggregates, isLeafRow: false, labelText: text }, node.path, line);
  };
  const table = (id, kind, rows, title = null) => {
    stats.tables += 1;
    return { id, kind, title, rows };
  };

  const sections = [];
  let flat = null;
  if (depth === 1) {
    flat = table('flat', 'FLAT', orderNodes(viewModel.tree, viewModel.summarySort).map(groupRow));
  } else if (depth >= 2) {
    const buildSection = (node) => {
      stats.sections += 1;
      drillTargets[node.id] = node.path;
      // Por Apartação/Lote do antigo: "APARTAÇÃO: " + o nome como foi digitado (normal-case).
      const name = mak?.variant === 'apartacao-lote' ? nodeLabel(node) : upper(nodeLabel(node));
      const title = `${upper(node.columnLabel ?? levels[node.level - 1]?.label)}: ${name}`;
      const section = { id: node.id, level: node.level, title, drill: node.id, sections: [], table: null, leafTotal: null };
      const children = orderNodes(node.children ?? [], viewModel.summarySort);
      if (node.level === depth - 1) {
        section.table = table(node.id, 'SECTION', [...children.map(groupRow), subtotalRow(node)]);
      } else {
        section.sections = children.map(buildSection);
      }
      // 3 níveis: no fim da seção de nível 1, a mesma tabela consolidada por nível folha (todas as datas) —
      // o bloco vem de buildLeafTotalBlock, o mesmo que o XLSX grava.
      const block = node.level === 1 && depth >= 3 ? buildLeafTotalBlock(viewModel, node, { target: 'print' }) : null;
      if (block) {
        const rows = block.lines.map((line) => {
          stats.leafTotalRows += 1;
          return row(DOC_ROW_TYPES.LEAF_TOTAL, line.id, { node: line.node, aggregates: line.node.aggregates, isLeafRow: true, labelText: line.label }, line.path);
        });
        stats.totalRows += 1;
        const totalLine = mak ? makLine(mak, lineItems, node, { lead: 'Total', layout: 'grid', lotes: block.lines.length }) : null;
        rows.push(row(DOC_ROW_TYPES.TOTAL, block.total.id, { node, aggregates: node.aggregates, isLeafRow: false, labelText: block.total.label }, block.total.path, totalLine));
        section.leafTotal = table(block.id, 'LEAF_TOTAL', rows, block.title);
        // Título do antigo na folha ("TOTAL POR LOTE - APARTE 02/06", com hífen); `title` continua o do XLSX.
        if (mak) section.leafTotal.heading = `TOTAL POR ${upper(block.leafLevel.label)} - ${upper(nodeLabel(node))}`;
      }
      return section;
    };
    sections.push(...orderNodes(viewModel.tree, viewModel.summarySort).map(buildSection));
  }

  stats.grandRows += 1;
  const grandRow = {
    type: DOC_ROW_TYPES.GRAND_TOTAL,
    id: '#grand',
    drill: null,
    cells: columns.map((column, index) => summaryCell(column, index, { node: { rowCount: viewModel.rowCount }, aggregates: viewModel.totals, isLeafRow: false, labelText: 'Total geral' }, mak)),
  };
  // TOTAL GERAL do antigo em linha de texto, com os números do motor sobre a população inteira.
  if (mak) grandRow.line = makLine(mak, lineItems, { aggregates: viewModel.totals, rows: viewModel.rows }, { lead: 'TOTAL GERAL', layout: 'grid', lotes: makLeafCount(mak, viewModel.rows) });
  if (flat) flat.rows.push(grandRow);
  const grandTotal = flat ? null : table('grand', 'GRAND', [grandRow]);
  return { sections, flat, grandTotal, stats, drillTargets };
}

// ---------------------------------------------------------------------------
// Corpo do Detalhado ("Ver como folha")
// ---------------------------------------------------------------------------

function detailColumns(viewModel) {
  const numericTypes = new Set(['integer', 'number', 'weight', 'gmd', 'money', 'percentage']);
  return (viewModel.columns ?? []).map((column) => ({
    key: column.id,
    label: headerLabel(column),
    kind: 'data',
    align: column.align === 'right' || numericTypes.has(column.type) ? 'right' : 'left',
    // Na folha, kg com 1 casa (a grade e as exportações de pesagem continuam com as casas da coluna).
    column: column.type === 'weight' && !Number.isInteger(column.decimals) ? { ...column, decimals: 1 } : column,
  }));
}

/**
 * Colunas de dados no estilo do antigo. Analítico: "Peso", "Peso Ant.", "Ganho" com 2 casas e " kg" em cada
 * número (formatarDecimal(p.peso, 2)); Vendas: "Peso (kg)" no cabeçalho e o peso inteiro (fmtNum(v.peso, 0)),
 * Valor Total em semi-negrito; Animal em peso médio (font-medium).
 */
function makDetailColumns(columns, variant) {
  const labels = variant === 'vendas' ? PESAGENS_SHEET_HEADERS.vendas : PESAGENS_SHEET_HEADERS.columns;
  return columns.map((column) => {
    const source = column.column;
    const numeric = column.align === 'right';
    const weight = source.type === 'weight';
    const mk = {
      mono: numeric,
      weight: source.id === 'numero_animal' ? 'medium' : source.id === 'valor_venda_total' ? 'semibold' : null,
      decimals: weight ? (variant === 'vendas' ? 0 : 2) : null,
      unit: variant !== 'vendas',
    };
    return { ...column, label: labels[source.id] ?? makHeaderLabel(source.label), mk };
  });
}

function dataCellRaw(viewModel, column, row) {
  const accessor = viewModel.resolve(column.id);
  return column.type === 'entity' ? accessor.displayOf(row) : accessor.valueOf(row);
}

/**
 * Totais do Detalhado em texto. Par "de–até" (faixa do lote) = um item só, e o `leafOnly` só no subtotal
 * do nível folha — como na folha resumida (a faixa de uma data com lotes diferentes seria inventada).
 */
function detailChips(viewModel, aggregates, rowCount, { leafLevel = false } = {}) {
  const metrics = summaryMetrics(viewModel);
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  if (!(viewModel.aggregates ?? []).length) return [{ label: 'Registros', text: String(rowCount ?? 0) }];
  const byKey = new Set(metrics.map((metric) => metric.key));
  const pairs = (viewModel.metricPairs || []).filter((pair) => byKey.has(pair.from) && byKey.has(pair.to));
  const paired = new Set(pairs.flatMap((pair) => [pair.from, pair.to]));
  const items = [];
  for (const metric of metrics) {
    const pair = pairs.find((item) => item.from === metric.key);
    if (pair) {
      if (!pair.leafOnly || leafLevel) items.push({ label: pair.label, text: rangeText(aggregates?.[pair.from]?.value ?? null, aggregates?.[pair.to]?.value ?? null) });
      continue;
    }
    if (paired.has(metric.key)) continue;
    const result = aggregates?.[metric.key];
    // Contagem 0 de coluna zeroAsEmpty (Machos/Fêmeas) = "—", como nas células da folha resumida.
    const zeroAsEmpty = Boolean(available.find((column) => column.id === metric.spec?.columnId)?.zeroAsEmpty);
    const value = zeroAsEmpty && result?.value === 0 ? null : result?.value ?? null;
    const partial = result && !COUNT_OPS.has(metric.spec?.op) && result.n_validos > 0 && result.n_validos < result.n_total ? ` (${result.n_validos} de ${result.n_total})` : '';
    const label = metric.label || aggregateLabel(metric.spec, available);
    items.push({ label, text: `${formatCell(metric.column ?? aggregateValueColumn(metric.spec, available), value, 'print')}${partial}` });
  }
  return items;
}

function buildDetailBody(viewModel, columns, { maxDataRows = Infinity } = {}, mak = null) {
  const columnOf = columnLookup(viewModel);
  const levels = viewModel.groups ?? [];
  const stats = { sections: 0, tables: 0, groupRows: 0, subtotalRows: 0, leafTotalRows: 0, totalRows: 0, dataRows: 0, grandRows: 0 };
  const drillTargets = {};
  const vendas = mak?.variant === 'vendas';
  const lineItems = mak ? PESAGENS_SHEET_LINES[vendas ? 'vendas' : 'analitico'] : null;
  let emitted = 0;
  const dataRow = (row, index) => {
    stats.dataRows += 1;
    emitted += 1;
    return {
      type: DOC_ROW_TYPES.DATA,
      id: `${row.id ?? index}`,
      drill: null,
      cells: columns.map((column, col) => {
        const raw = dataCellRaw(viewModel, column.column, row);
        const kind = column.align === 'right' ? 'num' : 'txt';
        if (mak) {
          const { text, tone } = makDataCell(mak, column, raw);
          return { col, key: column.key, text, raw: null, align: column.align, kind, ...(tone ? { tone } : {}) };
        }
        return { col, key: column.key, text: formatCell(column.column, raw, 'print'), raw: null, align: column.align, kind };
      }),
    };
  };
  const chipsRow = (type, id, title, aggregates, rowCount, leafLevel = false) => ({ type, id, drill: null, chips: { title, items: detailChips(viewModel, aggregates, rowCount, { leafLevel }) } });
  // Estilo MAKGESTAO: o subtotal é a linha de texto do antigo ("Subtotal: 8 animais | Peso Médio: … | GMD
  // Médio: …"; Vendas: "Total: … Valor Total: …" no quadro do comprador) — no lugar dos itens da E1B.
  const lineRow = (type, id, line) => ({ type, id, drill: null, line });
  const rowsOf = (population) => {
    const out = [];
    for (const [index, row] of population.entries()) {
      if (emitted >= maxDataRows) break;
      out.push(dataRow(row, index));
    }
    return out;
  };
  const nodeLabel = (node) => formatGroupLabel(columnOf(levels[node.level - 1]?.columnId), node.label, 'print', node.missing);

  const sections = [];
  let flat = null;
  if (!levels.length) {
    stats.tables += 1;
    flat = { id: 'flat', kind: 'FLAT', title: null, rows: rowsOf(viewModel.rows ?? []) };
  } else {
    const buildSection = (node, trail = []) => {
      stats.sections += 1;
      drillTargets[node.id] = node.path;
      const path = [...trail, nodeLabel(node)];
      const leaf = !node.children?.length;
      // Analítico do antigo: o grupo é o próprio valor ("LOTE 01"; com mais níveis "LOTE 01 → MACHO", no
      // grupo de baixo); Vendas: "COMPRADOR: X". Estilo da E1B: "LOTE: LOTE 01" em cada nível.
      let title = `${upper(node.columnLabel)}: ${upper(nodeLabel(node))}`;
      if (mak && !vendas) title = leaf ? upper(path.join(' → ')) : null;
      const section = { id: node.id, level: node.level, title, drill: node.id, sections: [], table: null, leafTotal: null };
      const subtotal = mak
        ? lineRow(DOC_ROW_TYPES.SUBTOTAL, `${node.id}#subtotal`, makLine(mak, lineItems.subtotal, node, vendas
          ? { lead: 'Total', layout: 'grid' }
          : { lead: leaf ? 'Subtotal' : `Subtotal ${upper(path.join(' → '))}`, layout: 'box' }))
        : chipsRow(DOC_ROW_TYPES.SUBTOTAL, `${node.id}#subtotal`, `Subtotal ${nodeLabel(node)}`, node.aggregates, node.rowCount, node.level === levels.length);
      stats.subtotalRows += 1;
      stats.tables += 1;
      if (node.children?.length) {
        section.sections = node.children.map((child) => buildSection(child, path));
        section.table = { id: `${node.id}#subtotal-table`, kind: 'SUBTOTAL', title: null, rows: [subtotal] };
      } else if (vendas) {
        // Vendas do antigo: o quadro do comprador (título + totais) vem ANTES da tabela.
        section.lead = subtotal;
        section.table = { id: node.id, kind: 'SECTION', title: null, rows: rowsOf(node.rows) };
      } else {
        section.table = { id: node.id, kind: 'SECTION', title: null, rows: [...rowsOf(node.rows), subtotal] };
      }
      return section;
    };
    sections.push(...(viewModel.tree ?? []).map((node) => buildSection(node)));
  }
  stats.grandRows += 1;
  stats.tables += 1;
  const grand = mak
    ? lineRow(DOC_ROW_TYPES.GRAND_TOTAL, '#grand', makLine(mak, lineItems.total, { aggregates: viewModel.totals, rows: viewModel.rows }, { lead: 'TOTAL GERAL', layout: vendas ? 'right' : 'box' }))
    : chipsRow(DOC_ROW_TYPES.GRAND_TOTAL, '#grand', 'Total geral', viewModel.totals, viewModel.rowCount);
  const grandTotal = { id: 'grand', kind: 'GRAND', title: null, rows: [grand] };
  const truncated = emitted < (viewModel.rows?.length ?? 0) ? { shown: emitted, total: viewModel.rows.length } : null;
  return { sections, flat, grandTotal, stats, drillTargets, truncated };
}

// ---------------------------------------------------------------------------
// Sintético (Matriz) — E1D: Linhas (eixo Y) × Colunas (eixo X), vários valores por célula
// ---------------------------------------------------------------------------

export const MATRIX_TOTAL_KEY = '__total__';

/** Colunas da matriz: rótulo do eixo Y, uma por valor do eixo X (na ordem do modelo) e TOTAL. */
function matrixColumns(matrix) {
  return [
    { key: LABEL_COLUMN_KEY, label: matrix.rowAxis.label, kind: 'label', align: 'left' },
    ...matrix.columns.map((column) => ({ key: `x:${column.key}`, label: column.label, kind: 'matrix', align: 'right', axisKey: column.key })),
    { key: MATRIX_TOTAL_KEY, label: MATRIX_TOTAL_LABEL, kind: 'matrix', align: 'right', total: true },
  ];
}

/**
 * Corpo da matriz: UMA tabela (flat) com uma linha por valor do eixo Y e a linha TOTAL; a legenda
 * ("Linhas: … · Colunas: … · Valores: …") é o título da tabela. Cada célula leva os valores empilhados
 * (`lines`, na ordem de matrix.metrics) e os brutos (`raw`, mesma ordem — base da paridade com o XLSX).
 * Na tela, o rótulo da linha e cada célula abrem o Detalhado daquele recorte (mesmo detalhe da E1).
 */
/**
 * Legenda da matriz no jeito do antigo: "Linhas: Sexo | Colunas: Lote | Valores: Qtd / Peso Médio / GMD Médio"
 * (rótulos em negrito na folha). O XLSX continua com a legenda do modelo (matrix.legend).
 */
function makMatrixLegend(matrix) {
  const values = matrix.metrics.map((metric) => PESAGENS_SHEET_HEADERS.matrix[metric.key] ?? makHeaderLabel(metric.shortLabel ?? metric.label)).join(' / ');
  const parts = [{ label: 'Linhas', text: matrix.rowAxis.label }, { label: 'Colunas', text: matrix.colAxis.label }, { label: 'Valores', text: values }];
  return { text: parts.map((part) => `${part.label}: ${part.text}`).join(' | '), parts };
}

function buildMatrixBody(matrix, columns, mak = null) {
  const stats = { sections: 0, tables: 1, groupRows: 0, subtotalRows: 0, leafTotalRows: 0, totalRows: 0, dataRows: 0, grandRows: 0 };
  const drillTargets = {};
  const target = (node) => {
    if (!node?.path?.length) return null;
    drillTargets[node.id] = matrix.drillPath(node); // mesmo rótulo do cabeçalho ("Lote 01 · Recria")
    return node.id;
  };
  const position = new Map(matrix.columns.map((column, index) => [column.key, index]));
  const valueCell = (column, index, source, drill) => {
    // Estilo MAKGESTAO: "347 kg" (kg inteiro, pesoMed.toFixed(0) do antigo) e "-" no GMD sem pesagem anterior.
    const lines = matrixCellLines(matrix, source, 'print', mak ? { style: SHEET_STYLES.MAKGESTAO } : {});
    return { col: index, key: column.key, text: lines.join(' / '), lines, raw: matrixValues(matrix, source), align: mak ? 'center' : 'right', kind: 'num', drill: source ? drill : null };
  };
  const line = (type, id, label, drill, { cells, total, totalDrill, cellDrill }) => ({
    type,
    id,
    drill,
    cells: columns.map((column, index) => {
      if (column.kind === 'label') return { col: index, key: column.key, text: label, raw: label, align: 'left', kind: 'label' };
      if (column.total) return valueCell(column, index, total, totalDrill);
      const cell = cells[position.get(column.axisKey)] ?? null;
      return valueCell(column, index, cell, cellDrill(cell));
    }),
  });
  const rows = matrix.rows.map((row) => {
    stats.groupRows += 1;
    const drill = target(row.node);
    return line(DOC_ROW_TYPES.GROUP, row.id, row.label, drill, { cells: row.cells, total: row.total, totalDrill: drill, cellDrill: target });
  });
  stats.grandRows += 1;
  // Linha TOTAL: cada coluna abre o Detalhado daquele valor do eixo X (todas as linhas); o canto não abre.
  rows.push(line(DOC_ROW_TYPES.GRAND_TOTAL, '#grand', matrix.totalRow.label, null, { cells: matrix.totalRow.cells, total: matrix.totalRow.total, totalDrill: null, cellDrill: target }));
  const legend = mak ? makMatrixLegend(matrix) : null;
  const flat = { id: 'matrix', kind: 'MATRIX', title: legend ? legend.text : matrix.legend, rows };
  if (legend) flat.legend = legend.parts;
  return { sections: [], flat, grandTotal: null, stats, drillTargets };
}

// ---------------------------------------------------------------------------
// Página: orientação, tamanho da fonte e larguras (estimadas pelo conteúdo)
// ---------------------------------------------------------------------------

function allRows(body) {
  const out = [];
  const walk = (section) => {
    if (section.lead) out.push(section.lead); // Vendas no estilo MAKGESTAO: totais do comprador antes da tabela
    if (section.table) out.push(...section.table.rows);
    section.sections.forEach(walk);
    if (section.leafTotal) out.push(...section.leafTotal.rows);
  };
  body.sections.forEach(walk);
  if (body.flat) out.push(...body.flat.rows);
  if (body.grandTotal) out.push(...body.grandTotal.rows);
  return out;
}

const longestWord = (text) => String(text ?? '').split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
// Célula com valores empilhados (matriz, E1D): a largura é a do maior valor, não a do texto emendado.
const widthText = (cell) => (Array.isArray(cell?.lines) ? cell.lines.reduce((widest, line) => (line.length > widest.length ? line : widest), '') : cell?.text ?? '');

function summaryWidths(columns, rows, factor, style = SHEET_STYLES.E1B, { oneLineHeader = true, sizeId = 'm' } = {}) {
  const mak = style === SHEET_STYLES.MAKGESTAO;
  const pad = mak ? CELL_PADDING_MAK_PX[sizeId] ?? CELL_PADDING_MAK_PX.m : SHEET_PAGE.CELL_PADDING_PX;
  const chars = mak ? CHAR_PX_MAK : CHAR_PX;
  // Estilo MAKGESTAO: o cabeçalho fica numa linha (como no antigo) quando cabe, e as linhas de total viram
  // texto fora da tabela — só as linhas desenhadas na tabela contam.
  const drawn = rows.filter((row) => row.cells && !(mak && row.line));
  const headerWidth = (label) => (mak && oneLineHeader ? String(label ?? '').length : longestWord(label)) * chars.header;
  return columns.map((column, index) => {
    const texts = drawn.map((row) => widthText(row.cells[index]));
    if (column.kind === 'label') {
      // O rótulo do subtotal ("Subtotal 02/06/2026 · Lotes: 3") quebra linha: não alarga a coluna.
      const labels = drawn.filter((row) => row.type !== 'SUBTOTAL').map((row) => row.cells[index]?.text ?? '');
      const widest = Math.max(headerWidth(column.label), ...labels.map((text) => Math.min(text.length, 34) * chars.label));
      return Math.round(Math.min(SHEET_PAGE.LABEL_MAX_PX, Math.max(SHEET_PAGE.LABEL_MIN_PX, widest * factor + pad)));
    }
    const widest = Math.max(headerWidth(column.label), ...texts.map((text) => text.length * chars.number));
    return Math.round(Math.max(SHEET_PAGE.METRIC_MIN_PX, widest * factor + pad));
  });
}

// Folga da página vai primeiro para o rótulo do subtotal caber numa linha (negrito ≈ 8% mais largo),
// até este teto; nunca tira largura das métricas e nunca muda o que cabe ou não na página.
const SUBTOTAL_LABEL_MAX_PX = 300;

function growLabelIntoSlack(columns, rows, widths, factor, limit) {
  const labelIndex = columns.findIndex((column) => column.kind === 'label');
  if (labelIndex < 0) return widths;
  const texts = rows.filter((row) => row.cells && row.type === 'SUBTOTAL').map((row) => row.cells[labelIndex]?.text ?? '');
  if (!texts.length) return widths;
  const need = Math.min(SUBTOTAL_LABEL_MAX_PX, Math.round(Math.max(...texts.map((text) => text.length)) * CHAR_PX.label * 1.08 * factor + SHEET_PAGE.CELL_PADDING_PX));
  const slack = limit - widths.reduce((sum, width) => sum + width, 0);
  if (need <= widths[labelIndex] || slack <= 0) return widths;
  const grown = [...widths];
  grown[labelIndex] += Math.min(need - widths[labelIndex], slack);
  return grown;
}

function detailWidths(columns, widths = {}) {
  return columns.map((column) => widths[column.key] || column.column?.defaultWidth || 120);
}

/**
 * Orientação e tamanho: "auto" tenta retrato, depois paisagem, reduzindo a fonte (8,5 → 7,6 → 6,8 pt);
 * retrato/paisagem escolhidos pela pessoa só reduzem a fonte. Se nada couber, avisa (nunca corta coluna).
 */
export function decideSheetLayout({ layout, columns, rows, style = SHEET_STYLES.E1B }, { orientation = 'auto', widths: userWidths = {} } = {}) {
  const orientations = orientation === 'auto' ? ['portrait', 'landscape'] : [orientation === 'landscape' ? 'landscape' : 'portrait'];
  const candidates = orientation === 'auto'
    ? [['portrait', 'm'], ['landscape', 'm'], ['landscape', 's'], ['landscape', 'xs']]
    : orientations.flatMap((item) => SHEET_PAGE.SIZES.map((size) => [item, size.id]));
  const factorOf = (sizeId) => SHEET_PAGE.SIZES.find((size) => size.id === sizeId).factor;
  const evaluate = ([pageOrientation, sizeId]) => {
    if (layout === 'detail') {
      const widths = detailWidths(columns, userWidths);
      const total = widths.reduce((sum, width) => sum + width, 0) * factorOf(sizeId);
      const limit = pageOrientation === 'landscape' ? SHEET_PAGE.DETAIL_LANDSCAPE_MAX : SHEET_PAGE.DETAIL_PORTRAIT_MAX;
      return { orientation: pageOrientation, sizeClass: sizeId, widths, totalWidth: Math.round(total), fits: total <= limit };
    }
    const limit = pageOrientation === 'landscape' ? SHEET_PAGE.LANDSCAPE_WIDTH_PX : SHEET_PAGE.PORTRAIT_WIDTH_PX;
    let base = summaryWidths(columns, rows, factorOf(sizeId), style, { sizeId });
    // Folha do MAKGESTAO com muitas colunas: o cabeçalho quebra entre palavras (como na E1B) antes de reduzir a fonte.
    if (style === SHEET_STYLES.MAKGESTAO && base.reduce((sum, width) => sum + width, 0) > limit) base = summaryWidths(columns, rows, factorOf(sizeId), style, { oneLineHeader: false, sizeId });
    const total = base.reduce((sum, width) => sum + width, 0);
    // Estilo MAKGESTAO: o subtotal não é linha da tabela (é texto abaixo dela) — nada a alargar.
    const widths = total <= limit && style !== SHEET_STYLES.MAKGESTAO ? growLabelIntoSlack(columns, rows, base, factorOf(sizeId), limit) : base;
    return { orientation: pageOrientation, sizeClass: sizeId, widths, totalWidth: total, fits: total <= limit };
  };
  const tried = candidates.map(evaluate);
  const chosen = tried.find((item) => item.fits) ?? tried.at(-1);
  // E1D: paisagem com fonte menor também conta (matriz com muitos meses cabe em paisagem 7,6 pt): o botão
  // "Usar paisagem" do aviso imprime em paisagem, que tenta os 3 tamanhos.
  const landscapeFits = tried.some((item) => item.orientation === 'landscape' && item.fits)
    || (chosen.orientation === 'portrait' && SHEET_PAGE.SIZES.some((size) => evaluate(['landscape', size.id]).fits));
  const sum = chosen.widths.reduce((total, width) => total + width, 0) || 1;
  return {
    orientation: chosen.orientation,
    sizeClass: chosen.sizeClass,
    fits: chosen.fits,
    totalWidth: chosen.totalWidth,
    columnCount: columns.length,
    widths: chosen.widths,
    widthPercents: chosen.widths.map((width) => Number(((width / sum) * 100).toFixed(2))),
    warning: chosen.fits ? null : {
      code: 'PRINT_TOO_WIDE',
      message: 'Este relatório possui muitas colunas para impressão.',
      options: chosen.orientation === 'portrait' && landscapeFits ? ['paisagem', 'reduzir totais', 'exportar XLSX/CSV'] : ['reduzir totais', 'exportar XLSX/CSV'],
    },
  };
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

/**
 * Título da folha. E1D: pelo tipo do relatório (view.titleKind) — "Analítico" só no Analítico; os outros
 * quatro, inclusive Vendas (que é Detalhado), "Sintético", como no MAKGESTAO. Sem tipo (Personalizado e os
 * demais relatórios), pelo modo, como na E1B.
 */
export function sheetTitleOf(viewModel) {
  const kind = viewModel.view?.titleKind ?? (viewModel.mode === REPORT_MODES.RESUMIDO ? 'Sintético' : 'Analítico');
  return `Relatório de ${viewModel.sheetTitle ?? viewModel.reportName} (${kind})`;
}

/**
 * @param viewModel resultado de runReport (Resumido → folha resumida; Detalhado → folha com linhas)
 * @param {{ header?: object|null, orientation?: 'auto'|'portrait'|'landscape', showEmptyColumns?: boolean,
 *   maxDataRows?: number, showDetails?: boolean }} options header = buildPropertyHeader(...) (ou null → só o
 *   nome do sistema); showDetails = "Mostrar Detalhes" do relatório de Vendas (E1D, layout "vendas")
 */
export function buildReportDocument(viewModel, { header = null, orientation = 'auto', showEmptyColumns = false, maxDataRows = Infinity, widths = {}, showDetails = false } = {}) {
  const summary = viewModel.mode === REPORT_MODES.RESUMIDO;
  const levels = (viewModel.groups ?? []).map((level) => ({ columnId: level.columnId, label: level.label }));
  // E1D: Sintético (Matriz) = o Resumido de 2 níveis desenhado como tabela cruzada (domain/matrixLayout).
  const matrix = summary && isMatrixViewModel(viewModel) ? buildMatrix(viewModel, { target: 'print' }) : null;
  const layout = matrix ? 'matrix' : summary ? 'summary' : 'detail';
  // E1D visual: os 5 tipos de Pesagens com a cara da folha do MAKGESTAO (o resto continua na folha da E1B).
  const style = sheetStyleOf(viewModel);
  const variant = style === SHEET_STYLES.MAKGESTAO ? makVariant(viewModel, layout) : null;
  const mak = variant ? { variant, viewModel, available: viewModel.availableColumns ?? viewModel.columns ?? [] } : null;
  let allColumns = matrix ? matrixColumns(matrix) : summary ? summaryColumns(viewModel) : detailColumns(viewModel);
  if (mak) allColumns = layout === 'detail' ? makDetailColumns(allColumns, variant) : makSummaryColumns(allColumns, variant);
  const hasRows = (viewModel.rowCount ?? 0) > 0;
  const isEmptyColumn = (column) => {
    // Coluna da matriz nunca some: cada valor do eixo X existe porque há pesagem nele.
    if (!hasRows || showEmptyColumns || column.kind === 'label' || column.kind === 'matrix') return false;
    if (summary) return metricIsEmpty(column, viewModel.totals);
    return (viewModel.rows ?? []).every((row) => formatCell(column.column, dataCellRaw(viewModel, column.column, row), 'print') === MISSING_SCREEN);
  };
  const hiddenColumns = allColumns.filter(isEmptyColumn).map((column) => ({ key: column.key, label: column.label }));
  const hiddenKeys = new Set(hiddenColumns.map((column) => column.key));
  const columns = allColumns.filter((column) => !hiddenKeys.has(column.key)).map((column, index) => ({ ...column, index }));

  // E1D Vendas (Detalhado): o relatório de venda do MAKGESTAO — blocos próprios (domain/vendasLayout) em doc.vendas.
  const vendas = isVendasViewModel(viewModel) ? buildVendasBlocks(viewModel, { showDetails, columns }) : null;
  const body = vendas ? vendasDocumentBody(vendas) : matrix ? buildMatrixBody(matrix, columns, mak) : summary ? buildSummaryBody(viewModel, columns, mak) : buildDetailBody(viewModel, columns, { maxDataRows }, mak);
  const bodyRows = allRows(body);
  // Vendas sem "Mostrar Detalhes" não tem tabela de colunas: os blocos cabem no retrato (como o PDF).
  const print = decideSheetLayout({ layout: summary ? 'summary' : 'detail', columns: vendas && !showDetails ? [] : columns, rows: bodyRows, style }, { orientation, widths });

  // Detalhado: os totais em texto também podem estar em @ (Média @, Total @) — o rodapé explica o divisor.
  // Sem linhas a folha é só "Nenhum registro…" (nenhuma coluna aparece): nada em @ para explicar.
  const usesArroba = hasRows && (columns.some((column) => column.unit === '@' || column.column?.unit === '@' || column.metric?.column?.unit === '@')
    || Boolean(matrix?.metrics.some((metric) => metric.column?.unit === '@')) || Boolean(vendas?.liveArroba)
    || (mak && !vendas ? bodyRows.some((row) => row.line?.items.some((item) => item.arroba)) : false)
    || (!summary && !mak && (viewModel.aggregates ?? []).length > 0 && summaryMetrics(viewModel).some((metric) => metric.column?.unit === '@')));
  const divisor = viewModel.arrobaDivisor ?? 30;
  const omitted = viewModel.hiddenByPermission?.length ?? 0;

  const emitted = formatEmittedAt(viewModel.generatedAt);
  const emitter = viewModel.emittedBy?.nome ?? viewModel.emittedBy?.id ?? '—';
  const periodText = viewModel.period ? `Período: ${brDate(viewModel.period.from)} a ${brDate(viewModel.period.to)}` : 'Estado atual (hoje)';
  // E1D item 8: só isto no rodapé. As colunas omitidas pelo perfil ficam (curto e só quando acontece): quem
  // lê o papel precisa saber que faltou coluna por permissão, e não porque não havia valor.
  const footer = {
    filtros: `Filtros: ${describeReportFilters(viewModel)}`,
    arroba: usesArroba ? `@ = peso vivo ÷ ${divisor}` : null,
    omitidas: omitted ? `${omitted} coluna(s) omitida(s) pelo perfil de quem emitiu` : null,
    emitidoPor: `Emitido por ${emitter} em ${emitted}`,
  };
  return {
    kind: DOCUMENT_KIND,
    version: 1,
    mode: viewModel.mode,
    layout: vendas ? 'vendas' : layout,
    reportId: viewModel.reportId,
    // E1D visual: 'makgestao' nos 5 tipos de Pesagens (variant = desenho de cada tipo do antigo), senão 'e1b'.
    style,
    variant,
    title: sheetTitleOf(viewModel),
    header: header ?? null,
    // Abaixo do título (no lugar do antigo "Resumido · Apartação › Data › Lote"): só o período.
    periodText,
    levels,
    columns,
    hiddenColumns,
    sections: body.sections,
    flat: body.flat,
    grandTotal: body.grandTotal,
    drillTargets: body.drillTargets,
    // Só a tela limita as linhas do Detalhado; o aviso é da tela (a impressão leva todas).
    truncated: body.truncated ?? null,
    screenNotice: body.truncated ? `Na tela aparecem ${body.truncated.shown.toLocaleString('pt-BR')} de ${body.truncated.total.toLocaleString('pt-BR')} linhas; a impressão e o PDF levam todas.` : null,
    empty: !hasRows,
    // Folha vazia: o texto do antigo nos tipos de Pesagens ("Nenhuma pesagem/venda encontrada…").
    // E1E: o desenho de venda leva o texto do tipo (venda, abate, compra — doc.vendas.emptyText).
    emptyText: vendas?.emptyText ?? (mak ? `Nenhuma ${variant === 'vendas' ? 'venda' : 'pesagem'} encontrada com os filtros aplicados.` : 'Nenhum registro para os filtros informados.'),
    footer,
    print,
    stats: body.stats,
    // E1D: eixos e legenda da matriz (null fora do Sintético (Matriz)); os valores de cada célula estão em cells[].raw.
    // Estilo MAKGESTAO: a legenda da folha é a do antigo ("Linhas: … | Colunas: … | Valores: …").
    matrix: matrix ? { legend: body.flat.title, rowAxis: matrix.rowAxis, colAxis: matrix.colAxis, values: matrix.metrics.map((metric) => ({ key: metric.key, label: metric.label })) } : null,
    // E1D: blocos do relatório de venda (null fora de "Vendas (Detalhado)") — exporters/vendasHtml desenha.
    vendas,
  };
}

/** Todas as linhas do documento (na ordem da folha) — base dos gates de alinhamento e de totais. */
export function documentRows(doc) {
  return allRows({ sections: doc.sections, flat: doc.flat, grandTotal: doc.grandTotal });
}
