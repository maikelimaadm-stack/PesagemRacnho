// Agrupamento genérico até 3 níveis (docs/reporting/AGGREGATION-CONTRACT.md §grupos).
// Retorna ÁRVORE estrutural (nunca HTML). Cada nó guarda a população do grupo e as agregações
// calculadas SOBRE ESSA POPULAÇÃO — o pai recalcula contra as próprias linhas, nunca soma filhos
// (countDistinct, médias, médias ponderadas e razões ficam corretos em qualquer nível).
import { computeAggregates } from './reportAggregates.js';

export const MAX_GROUP_LEVELS = 3;
export const NONE_GROUP_KEY = '__nao_informado__';
export const NONE_GROUP_LABEL = 'Não informado';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function isMissing(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * @param rows população já filtrada (e ordenada: a ordem das linhas dentro do grupo é preservada)
 * @param levels [{ columnId, direction? }] — até 3
 * @param resolve (columnId) => { column, groupKeyOf(row), groupLabelOf(row), valueOf(row), ... }
 * @param {{ aggregates?: object[] }} options especificações de agregação por nó
 * @returns {{ nodes: object[], levels: object[] }}
 */
export function groupRows(rows, levels = [], resolve, { aggregates = [] } = {}) {
  const activeLevels = (levels || []).filter((level) => level?.columnId);
  if (activeLevels.length > MAX_GROUP_LEVELS) throw new Error(`agrupamento: no máximo ${MAX_GROUP_LEVELS} níveis`);
  const resolvedLevels = activeLevels.map((level) => {
    const accessor = resolve(level.columnId);
    if (!accessor) throw new Error(`agrupamento: coluna desconhecida (${level.columnId})`);
    if (!accessor.column.groupable) throw new Error(`agrupamento: coluna ${level.columnId} não é agrupável`);
    return { ...level, accessor, direction: level.direction === 'desc' ? 'desc' : 'asc' };
  });
  if (new Set(resolvedLevels.map((level) => level.columnId)).size !== resolvedLevels.length) {
    throw new Error('agrupamento: a mesma coluna não pode repetir em dois níveis');
  }

  const build = (population, depth, parentPath) => {
    const level = resolvedLevels[depth];
    const buckets = new Map();
    for (const row of population) {
      const rawKey = level.accessor.groupKeyOf(row);
      const missing = isMissing(rawKey);
      const key = missing ? NONE_GROUP_KEY : String(rawKey);
      let bucket = buckets.get(key);
      if (!bucket) {
        const rawLabel = missing ? NONE_GROUP_LABEL : level.accessor.groupLabelOf(row);
        bucket = { key, label: isMissing(rawLabel) ? String(rawKey) : String(rawLabel), missing, rows: [] };
        buckets.set(key, bucket);
      }
      bucket.rows.push(row);
    }
    const ordered = [...buckets.values()].sort((left, right) => {
      if (left.missing !== right.missing) return left.missing ? 1 : -1;
      const result = collator.compare(left.label, right.label);
      return level.direction === 'desc' ? -result : result;
    });
    return ordered.map((bucket) => {
      const path = [...parentPath, { columnId: level.columnId, key: bucket.key, label: bucket.label }];
      const node = {
        type: 'group',
        id: path.map((part) => `${part.columnId}=${part.key}`).join('|'),
        level: depth + 1,
        columnId: level.columnId,
        columnLabel: level.accessor.column.label,
        key: bucket.key,
        label: bucket.label,
        missing: bucket.missing,
        path,
        rowCount: bucket.rows.length,
        rows: bucket.rows,
        aggregates: computeAggregates(bucket.rows, aggregates, resolve),
        children: [],
      };
      if (depth + 1 < resolvedLevels.length) node.children = build(bucket.rows, depth + 1, path);
      return node;
    });
  };

  return {
    levels: resolvedLevels.map((level) => ({ columnId: level.columnId, label: level.accessor.column.label, direction: level.direction })),
    nodes: resolvedLevels.length ? build(rows, 0, []) : [],
  };
}

/** Percorre a árvore em profundidade: GROUP_HEADER, DATA*, (filhos), SUBTOTAL. */
export function flattenTree(nodes, { includeRows = true } = {}) {
  const out = [];
  const walk = (node) => {
    out.push({ kind: 'GROUP', node });
    if (node.children.length) node.children.forEach(walk);
    else if (includeRows) node.rows.forEach((row) => out.push({ kind: 'DATA', row, node }));
    out.push({ kind: 'SUBTOTAL', node });
  };
  nodes.forEach(walk);
  return out;
}
