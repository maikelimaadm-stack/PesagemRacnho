// Sintético (Matriz) — E1D (docs/plano-mestre/E1D-RELATORIO-PESAGENS-INDIVIDUAIS.md item 2; contrato
// docs/evidence/e1d/CONTRATOS-AGENTES.md §4, parte A). É um MODO DE VISÃO do Resumido de 2 níveis
// (Linhas › Colunas), não um relatório novo, e não faz conta nova — lê os agregados que o motor da E1 já
// calculou em cada nó:
//
//   linhas  = nós de nível 1 da árvore (eixo Y), na ordem do Resumido (summarySort: "Ordenar por" peso/GMD
//             ordena pelo total da linha; sem ele, ordem natural — rótulo/groupOrder, "Não informado" por último);
//   colunas = valores do eixo X na população inteira, em ordem natural (Mês cronológico, pelo groupOrder
//             "aaaa-mm") e na direção do nível X;
//   célula  = agregados do nó Y › X (Qtd = animais distintos, Peso médio, GMD ponderado); sem animais = vazia;
//             GMD sem pesagem anterior = null ("—"), nunca 0;
//   TOTAL   = coluna: o próprio nó Y; linha: a população inteira reagrupada por X pelo MESMO motor (groupRows,
//             mesmos agregados); canto: viewModel.totals. Nunca soma de médias nem de contagens distintas (um
//             animal pesado em dois meses conta uma vez em cada mês e uma vez na linha).
//
// A folha (reportDocument), o XLSX (xlsxExporter) e o gate reports:matrix:verify leem ESTE modelo. CSV e
// JSON continuam o Resumido de 2 níveis (buildSummaryLayout) — mesma população e mesmos números.
import { groupRows, NONE_GROUP_KEY } from './groupEngine.js';
import { REPORT_MODES, VIEW_LAYOUTS } from './reportDefinition.js';
import { formatCell, MISSING_SCREEN } from './reportFormatting.js';
import { buildSummaryRows, formatGroupLabel, summaryMetrics, summaryMetricValue } from './summaryLayout.js';

export const MATRIX_TOTAL_LABEL = 'TOTAL';
export const MATRIX_AXIS_EDGES = Object.freeze(['eixoY', 'eixoX']);

/** O view model é o Resumido de um tipo com layout "matrix" (2 níveis = Linhas › Colunas)? */
export function isMatrixViewModel(viewModel) {
  return viewModel?.view?.layout === VIEW_LAYOUTS.MATRIX
    && viewModel.mode === REPORT_MODES.RESUMIDO
    && (viewModel.groups ?? []).length === 2;
}

// "Peso médio (kg)" → "Peso médio": a legenda diz o que está na célula; a unidade vai no próprio valor.
const shortLabel = (label) => String(label ?? '').replace(/\s*\([^)]*\)\s*$/, '');

/**
 * Modelo da matriz a partir do view model (Resumido do tipo "sintetico-matriz").
 * @param viewModel resultado de runReport (usa groups, tree, rows, totals, aggregates, summarySort, matrix, resolve)
 * @param {{ target?: 'print'|'screen'|'xlsx'|'csv' }} options formato dos rótulos (data/sim-não)
 * @returns {{ rowAxis: object, colAxis: object, metrics: object[], legend: string,
 *   columns: { key, label, missing, node }[],
 *   rows: { id, key, label, missing, path, node, cells: (object|null)[], total: object }[],
 *   totalRow: { id, label, cells: object[], total: { rowCount, aggregates } } }}
 *   cells[i] = nó do motor (agregados) da coluna columns[i], ou null quando não há pesagem no cruzamento.
 */
export function buildMatrix(viewModel, { target = 'print' } = {}) {
  const levels = viewModel?.groups ?? [];
  if (levels.length !== 2) throw new Error(`matriz: exige 2 níveis de agrupamento (Linhas › Colunas), recebido ${levels.length}`);
  if (typeof viewModel.resolve !== 'function') throw new Error('matriz: view model sem resolve (use o resultado de runReport)');
  const [rowLevel, colLevel] = levels;
  const available = viewModel.availableColumns ?? viewModel.columns ?? [];
  const columnOf = (columnId) => available.find((column) => column.id === columnId) ?? null;
  const labelOf = (level, node) => formatGroupLabel(columnOf(level.columnId), node.label, target, node.missing || node.key === NONE_GROUP_KEY);
  const rowAxis = { id: viewModel.matrix?.rowAxis?.id ?? null, label: viewModel.matrix?.rowAxis?.label ?? rowLevel.label, columnId: rowLevel.columnId, direction: rowLevel.direction ?? 'asc' };
  const colAxis = { id: viewModel.matrix?.colAxis?.id ?? null, label: viewModel.matrix?.colAxis?.label ?? colLevel.label, columnId: colLevel.columnId, direction: colLevel.direction ?? 'asc' };
  const metrics = summaryMetrics(viewModel).map((metric) => ({ ...metric, shortLabel: shortLabel(metric.label) }));

  // Colunas e linha TOTAL: a população inteira reagrupada pelo eixo X, com os MESMOS agregados (o motor
  // recalcula cada coluna sobre a própria população — nunca soma das células).
  const specs = (viewModel.aggregates ?? []).map((spec) => ({ id: spec.id, op: spec.op, ...(spec.columnId ? { columnId: spec.columnId } : {}) }));
  const regrouped = groupRows(viewModel.rows ?? [], [{ columnId: colLevel.columnId, direction: colLevel.direction }], viewModel.resolve, { aggregates: specs }).nodes;
  const columns = regrouped.map((node) => ({ key: node.key, label: labelOf(colLevel, node), missing: node.missing, node }));

  // Linhas: a ordem do Resumido (a mesma do CSV/JSON — buildSummaryRows aplica o summarySort só entre irmãos).
  const treeById = new Map((viewModel.tree ?? []).map((node) => [node.id, node]));
  const ordered = buildSummaryRows(viewModel.tree ?? [], { summarySort: viewModel.summarySort ?? null })
    .filter((row) => row.level === 1)
    .map((row) => treeById.get(row.id))
    .filter(Boolean);
  const rows = ordered.map((node) => {
    const byKey = new Map((node.children ?? []).map((child) => [child.key, child]));
    return {
      id: node.id,
      key: node.key,
      label: labelOf(rowLevel, node),
      missing: node.missing,
      path: node.path,
      node,
      cells: columns.map((column) => byKey.get(column.key) ?? null),
      total: node,
    };
  });
  const values = metrics.map((metric) => metric.shortLabel).join(' / ');
  return {
    rowAxis,
    colAxis,
    metrics,
    legend: `Linhas: ${rowAxis.label} · Colunas: ${colAxis.label} · Valores: ${values}`,
    columns,
    rows,
    totalRow: {
      id: '#matrix-total',
      label: MATRIX_TOTAL_LABEL,
      cells: columns.map((column) => column.node),
      total: { rowCount: viewModel.rowCount ?? (viewModel.rows ?? []).length, aggregates: viewModel.totals ?? {} },
    },
  };
}

/** Valores brutos (canônicos) de uma célula, na ordem de matrix.metrics; null = cruzamento sem pesagem. */
export function matrixValues(matrix, source) {
  if (!source) return null;
  return matrix.metrics.map((metric) => summaryMetricValue(source, metric.key));
}

/**
 * Textos de uma célula (um por valor, empilhados na folha). kg leva a unidade ("346,3 kg") como no antigo;
 * ausente = "—" (GMD sem pesagem anterior); contagem 0 de coluna zeroAsEmpty = "—" (como no Resumido).
 * Cruzamento sem pesagem = lista vazia (célula vazia).
 */
export function matrixCellLines(matrix, source, target = 'print') {
  const raw = matrixValues(matrix, source);
  if (!raw) return [];
  return matrix.metrics.map((metric, index) => {
    const value = metric.column?.zeroAsEmpty && raw[index] === 0 ? null : raw[index];
    const text = formatCell(metric.column, value, target);
    const unit = metric.column?.type === 'weight' ? metric.column.unit : null;
    return unit && text !== MISSING_SCREEN && text !== '' ? `${text} ${unit}` : text;
  });
}

/**
 * Troca de eixo na tela: escolher nas Linhas o eixo que está nas Colunas (ou o contrário) TROCA os dois de
 * lugar. A matriz nunca fica com o mesmo eixo nos dois lados (o serviço recusa) e a tela nunca trava.
 * @param {{ eixoY: string, eixoX: string }} current
 * @param {'eixoY'|'eixoX'} edge lado que a pessoa mudou
 * @param {string} value id do eixo escolhido (definition.matrixAxes)
 */
export function nextMatrixAxes(current, edge, value) {
  if (!MATRIX_AXIS_EDGES.includes(edge)) throw new Error(`matriz: lado desconhecido (${edge})`);
  const other = edge === 'eixoY' ? 'eixoX' : 'eixoY';
  const next = { eixoY: current?.eixoY ?? null, eixoX: current?.eixoX ?? null, [edge]: value };
  if (next[other] === value) next[other] = current?.[edge] ?? null;
  return next;
}
