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
// M1 §5: a marca da arroba ("(@ vivo ÷30)", "(@ carcaça)") fica — sem ela o valor não diria qual arroba é.
const shortLabel = (label) => String(label ?? '').replace(/\s*\((?!@)[^)]*\)\s*$/, '');

// O nome do lote é único só dentro da apartação (o cadastro aceita "Lote 01" na Engorda e na Recria) e a
// matriz agrupa pela chave (lote_id): sem contexto sairiam dois cabeçalhos "Lote 01" com números diferentes.
export const MATRIX_LABEL_CONTEXT = Object.freeze({ nome_lote: 'nome_apartacao' });
export const MATRIX_CONTEXT_SEPARATOR = ' · ';

const countLabels = (labels) => labels.reduce((count, label) => count.set(label, (count.get(label) ?? 0) + 1), new Map());

/**
 * Rótulos distintos para os valores de um eixo (folha, PDF e XLSX leem estes). Rótulo único fica como está;
 * rótulo repetido com chave diferente ganha o contexto ("Lote 01 · Recria" — apartação do lote) e, se ainda
 * repetir (eixo sem contexto, ou mesmo contexto), o número de ordem ("Lote 01 · Recria (2)").
 * @param entries [{ label, node }] na ordem do eixo (node = nó do motor, com as linhas do grupo)
 */
function distinctLabels(entries, level, resolve) {
  const first = countLabels(entries.map((entry) => entry.label));
  if (entries.every((entry) => first.get(entry.label) === 1)) return entries.map((entry) => entry.label);
  const contextId = MATRIX_LABEL_CONTEXT[level.columnId];
  const accessor = contextId ? resolve(contextId) : null;
  const withContext = entries.map((entry) => {
    if (first.get(entry.label) === 1 || !accessor) return entry.label;
    const context = (entry.node.rows ?? []).map((row) => accessor.groupLabelOf(row)).find((value) => value != null && String(value).trim() !== '');
    return context ? `${entry.label}${MATRIX_CONTEXT_SEPARATOR}${context}` : entry.label;
  });
  const second = countLabels(withContext);
  const seen = new Map();
  return withContext.map((label) => {
    if (second.get(label) === 1) return label;
    const index = (seen.get(label) ?? 0) + 1;
    seen.set(label, index);
    return `${label} (${index})`;
  });
}

/**
 * Modelo da matriz a partir do view model (Resumido do tipo "sintetico-matriz").
 * @param viewModel resultado de runReport (usa groups, tree, rows, totals, aggregates, summarySort, matrix, resolve)
 * @param {{ target?: 'print'|'screen'|'xlsx'|'csv' }} options formato dos rótulos (data/sim-não)
 * @returns {{ rowAxis: object, colAxis: object, metrics: object[], legend: string,
 *   columns: { key, label, missing, node }[],
 *   rows: { id, key, label, missing, path, node, cells: (object|null)[], total: object }[],
 *   totalRow: { id, label, cells: object[], total: { rowCount, aggregates } },
 *   drillPath: (node) => { columnId, key, label }[]|null }}
 *   cells[i] = nó do motor (agregados) da coluna columns[i], ou null quando não há pesagem no cruzamento.
 *   Rótulos de linha/coluna são distintos (distinctLabels); drillPath = caminho do nó com esses rótulos.
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
  const columnLabels = distinctLabels(regrouped.map((node) => ({ label: labelOf(colLevel, node), node })), colLevel, viewModel.resolve);
  const columns = regrouped.map((node, index) => ({ key: node.key, label: columnLabels[index], missing: node.missing, node }));

  // Linhas: a ordem do Resumido (a mesma do CSV/JSON — buildSummaryRows aplica o summarySort só entre irmãos).
  const treeById = new Map((viewModel.tree ?? []).map((node) => [node.id, node]));
  const ordered = buildSummaryRows(viewModel.tree ?? [], { summarySort: viewModel.summarySort ?? null })
    .filter((row) => row.level === 1)
    .map((row) => treeById.get(row.id))
    .filter(Boolean);
  const rowLabels = distinctLabels(ordered.map((node) => ({ label: labelOf(rowLevel, node), node })), rowLevel, viewModel.resolve);
  const rows = ordered.map((node, index) => {
    const byKey = new Map((node.children ?? []).map((child) => [child.key, child]));
    return {
      id: node.id,
      key: node.key,
      label: rowLabels[index],
      missing: node.missing,
      path: node.path,
      node,
      cells: columns.map((column) => byKey.get(column.key) ?? null),
      total: node,
    };
  });
  // Detalhe (clique na folha): a pílula mostra o mesmo rótulo do cabeçalho — só troca o que ganhou contexto.
  const relabeled = new Map();
  regrouped.forEach((node, index) => { if (columnLabels[index] !== labelOf(colLevel, node)) relabeled.set(`${colLevel.columnId}=${node.key}`, columnLabels[index]); });
  ordered.forEach((node, index) => { if (rowLabels[index] !== labelOf(rowLevel, node)) relabeled.set(`${rowLevel.columnId}=${node.key}`, rowLabels[index]); });
  const drillPath = (node) => (node?.path?.length ? node.path.map((part) => ({ ...part, label: relabeled.get(`${part.columnId}=${part.key}`) ?? part.label })) : null);
  const values = metrics.map((metric) => metric.shortLabel).join(' / ');
  return {
    rowAxis,
    colAxis,
    metrics,
    legend: `Linhas: ${rowAxis.label} · Colunas: ${colAxis.label} · Valores: ${values}`,
    columns,
    rows,
    drillPath,
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
 * E1D visual: `style: 'makgestao'` (folha dos tipos de Pesagens) = como a célula do antigo — kg inteiro
 * ("347 kg", pesoMed.toFixed(0)) e ausente "-" (hífen). Só apresentação: os valores (matrixValues) não mudam.
 */
export function matrixCellLines(matrix, source, target = 'print', { style = null } = {}) {
  const raw = matrixValues(matrix, source);
  if (!raw) return [];
  const mak = style === 'makgestao';
  return matrix.metrics.map((metric, index) => {
    const value = metric.column?.zeroAsEmpty && raw[index] === 0 ? null : raw[index];
    const weight = metric.column?.type === 'weight';
    const text = formatCell(mak && weight ? { ...metric.column, decimals: 0 } : metric.column, value, target);
    if (mak && (text === MISSING_SCREEN || text === '')) return '-';
    const unit = weight ? metric.column.unit : null;
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
