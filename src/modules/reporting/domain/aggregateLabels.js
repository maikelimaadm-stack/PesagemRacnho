// Rótulos e formato das agregações (domínio; usados pela tela, pelo layout linear e pelo Resumido).
//   aggregateLabel       → rótulo técnico do Detalhado/subtotal: "Média simples — Peso (kg)".
//   summaryMetricLabel   → rótulo de curral do Resumido: "Peso médio (kg)", "Cabeças", "GMD (kg/dia)".
//   aggregateValueColumn → coluna "virtual" com o tipo certo para formatar o valor agregado.
import { AGGREGATION_LABELS } from './columnDefinition.js';
import { headerLabel } from './reportFormatting.js';
import { arrobaKindOf, arrobaTag, hasArrobaToken, resolveArrobaLabel } from './arrobaColumns.js';

/** Rótulo de uma agregação: "Média simples — Peso (kg)"; contagem de registros sem coluna. */
export function aggregateLabel(spec, columns) {
  if (spec.op === 'count' && !spec.columnId) return 'Registros';
  const column = columns.find((item) => item.id === spec.columnId);
  if (spec.op === 'countDistinct' && column && ['animal', 'numero_animal'].includes(column.id)) return 'Animais únicos';
  return `${AGGREGATION_LABELS[spec.op] ?? spec.op} — ${column ? headerLabel(column) : spec.columnId}`;
}

// E1B: casas dos valores AGREGADOS — kg com 1 casa (@ com 2 e GMD com 3 já vêm da coluna/tipo). O
// valor de cada linha (grade, Relação, exportações de pesagem) continua com as casas da coluna.
export const AGGREGATE_WEIGHT_DECIMALS = 1;

/** Coluna "virtual" para formatar o valor de uma agregação no tipo certo. */
export function aggregateValueColumn(spec, columns) {
  if (['count', 'countValid', 'countDistinct'].includes(spec.op)) {
    // Contagem condicional (Machos/Fêmeas): a coluna pede 0 como vazio na folha.
    const counted = spec.op === 'countDistinct' && spec.columnId ? columns.find((item) => item.id === spec.columnId) : null;
    return counted?.zeroAsEmpty ? { type: 'integer', zeroAsEmpty: true } : { type: 'integer' };
  }
  const column = columns.find((item) => item.id === spec.columnId);
  if (!column) return { type: 'number' };
  if (spec.op === 'weightedGmd') return { type: 'gmd' };
  // Média de coluna inteira (dias no lote, dias sem pesagem, nº de pesagens) tem fração: 33,5 e não 34.
  if (column.type === 'integer' && ['avg', 'weightedAvg'].includes(spec.op)) return { ...column, type: 'number', decimals: 1 };
  if (column.type === 'weight') return { ...column, decimals: AGGREGATE_WEIGHT_DECIMALS };
  return column;
}

// O que "uma linha" conta em cada grão: contagem de registros no Resumido.
const COUNT_NOUN = Object.freeze({
  EVENT: 'Pesagens',
  EXIT: 'Saídas',
  LOT: 'Lotes',
  LOT_STAY: 'Permanências',
  SHIPMENT_DOCUMENT: 'Documentos',
  AUDIT_ENTRY: 'Ações',
  DATA_ISSUE: 'Problemas',
  BACKUP_ENTRY: 'Backups',
  REGISTRY_ITEM: 'Itens',
  SESSION: 'Sessões',
  ANIMAL_CURRENT: 'Animais',
  ANIMAL_PERIOD: 'Animais',
});

// Ids de total que já dizem o que contam (contagem de registros nomeada pela definição).
const COUNT_BY_SPEC_ID = Object.freeze({ cabecas: 'Cabeças', mortes: 'Mortes', saidas: 'Saídas', lotes: 'Lotes', permanencias: 'Permanências', documentos: 'Documentos' });

// Substantivo de curral para colunas de peso/ganho, com o gênero para concordar ("Carcaça média").
const WEIGHT_NOUNS = Object.freeze({
  peso: { noun: 'Peso' },
  ultimo_peso_kg: { noun: 'Peso' },
  peso_inicial: { noun: 'Peso inicial' },
  peso_final: { noun: 'Peso final' },
  peso_anterior: { noun: 'Peso anterior' },
  ganho: { noun: 'Ganho' },
  peso_total_real: { noun: 'Peso embarcado' },
  peso_carcaca_estimado: { noun: 'Carcaça', feminine: true },
});

const WEIGHT_OPS = Object.freeze({ sum: 'total', avg: 'médio', weightedAvg: 'médio', min: 'mínimo', max: 'máximo' });
const WEIGHT_OPS_FEMININE = Object.freeze({ sum: 'total', avg: 'média', weightedAvg: 'média', min: 'mínima', max: 'máxima' });
const GENERIC_OPS = Object.freeze({ sum: 'soma', avg: 'média', weightedAvg: 'média ponderada', min: 'mínimo', max: 'máximo', range: 'amplitude', countValid: 'com valor' });

// "Peso médio atual" do lote já é uma média: média/mínimo/máximo dela é sobre os lotes, não animais.
const LOT_AVERAGE_LABELS = Object.freeze({
  weightedAvg: 'Peso médio (kg)',
  avg: 'Média dos pesos médios dos lotes (kg)',
  min: 'Menor peso médio de lote (kg)',
  max: 'Maior peso médio de lote (kg)',
});

// Somas de dinheiro que SÃO o valor da operação ("Valor (R$)"); as demais levam o nome da coluna.
const MAIN_VALUE_COLUMNS = new Set(['valor_venda_total', 'valor_total_abate', 'valor_pago_cabeca']);

// As duas arrobas (M1 §5): mesmo rótulo de curral do kg, com a MARCA da arroba no lugar da unidade — "Peso médio (@ vivo
// ÷30)", "Ganho total (@ vivo ÷30)", "Carcaça total (@ carcaça)". A marca vem da coluna (arrobaTag, com o divisor do
// view model); nunca "(@)" sozinho.
const ARROBA_NOUNS = Object.freeze({
  peso_arroba: { noun: 'Peso' },
  ganho_arroba: { noun: 'Ganho' },
  quantidade_arrobas: { noun: 'Carcaça', feminine: true },
});
const tagOf = (column) => column.arrobaTag ?? arrobaTag(arrobaKindOf(column));

// Faixa exigida do lote (E1B): o mínimo da faixa mínima / o máximo da faixa máxima é a própria faixa.
const LOT_RANGE_OPS = Object.freeze({ lote_peso_minimo: 'min', lote_peso_maximo: 'max' });

/**
 * Rótulo simples (linguagem de curral) de uma métrica do Resumido.
 * @param spec { id?, op, columnId? }
 * @param columns colunas disponíveis do relatório (availableColumns)
 * @param {{ grain?: string, animalColumnId?: string }} context
 */
export function summaryMetricLabel(spec, columns, { grain = null, animalColumnId = null, distinctAnimals = false } = {}) {
  const column = spec.columnId ? columns.find((item) => item.id === spec.columnId) : null;
  if (spec.op === 'count') {
    // "Cabeças" contando linhas ao lado de "Cabeças" contando animais distintos (romaneio): a
    // contagem de linhas vira o nome do que a linha é (Saídas, Documentos…).
    if (spec.id === 'cabecas' && distinctAnimals) return COUNT_NOUN[grain] ?? 'Registros';
    if (COUNT_BY_SPEC_ID[spec.id]) return COUNT_BY_SPEC_ID[spec.id];
    if (!spec.columnId) return COUNT_NOUN[grain] ?? 'Registros';
  }
  if (!column) return aggregateLabel(spec, columns);
  const isAnimal = column.id === animalColumnId || ['animal', 'numero_animal'].includes(column.id);
  if (spec.op === 'countDistinct') return isAnimal ? 'Cabeças' : `${column.label} (distintos)`;
  if (spec.op === 'countValid') return column.label.includes('(') ? `${column.label} — com valor` : `${column.label} (com valor)`;
  if (column.type === 'gmd') {
    // M1: "GMD (regressão)" não é o GMD entre pesagens — o rótulo diz qual é ("GMD (regressão) médio (kg/dia)").
    if (column.id === 'gmd_regressao') return `GMD (regressão) ${WEIGHT_OPS[spec.op] ?? spec.op} (kg/dia)`;
    if (spec.op === 'weightedGmd') return 'GMD (kg/dia)';
    if (spec.op === 'avg') return 'GMD simples (kg/dia)';
    return `GMD ${WEIGHT_OPS[spec.op] ?? spec.op} (kg/dia)`;
  }
  if (arrobaKindOf(column) && (WEIGHT_OPS[spec.op] || spec.op === 'range')) {
    const { noun, feminine = false } = ARROBA_NOUNS[column.id] ?? { noun: String(column.label).replace(/\s*\(@[^)]*\)\s*$/, '') };
    if (spec.op === 'range') return `Amplitude ${feminine ? 'da' : 'do'} ${noun.toLowerCase()} (${tagOf(column)})`;
    return `${noun} ${(feminine ? WEIGHT_OPS_FEMININE : WEIGHT_OPS)[spec.op]} (${tagOf(column)})`;
  }
  if (column.id === 'peso_medio_atual' && LOT_AVERAGE_LABELS[spec.op]) return LOT_AVERAGE_LABELS[spec.op];
  if (LOT_RANGE_OPS[column.id]) {
    const unit = column.unit || 'kg';
    return spec.op === LOT_RANGE_OPS[column.id] ? `${column.label} (${unit})` : `${column.label} — ${GENERIC_OPS[spec.op] ?? spec.op} (${unit})`;
  }
  if (column.type === 'weight' && (WEIGHT_OPS[spec.op] || spec.op === 'range')) {
    const { noun, feminine = false } = WEIGHT_NOUNS[column.id] ?? { noun: column.label };
    const unit = column.unit || 'kg';
    if (spec.op === 'range') return `Amplitude ${feminine ? 'da' : 'do'} ${noun.toLowerCase()} (${unit})`;
    return `${noun} ${(feminine ? WEIGHT_OPS_FEMININE : WEIGHT_OPS)[spec.op]} (${unit})`;
  }
  if (column.type === 'money') {
    if (spec.op === 'sum') return MAIN_VALUE_COLUMNS.has(column.id) ? 'Valor (R$)' : `${column.label} (R$)`;
    if (spec.op === 'weightedAvg' && column.weightedBy === 'quantidade_arrobas') return 'Preço médio da @ (R$)';
    if (spec.op === 'avg') return `${column.label} médio (R$)`;
    return `${column.label} — ${GENERIC_OPS[spec.op] ?? spec.op} (R$)`;
  }
  if (spec.op === 'ratio') return headerLabel(column);
  // Contagens guardadas como número (pesagens, capacidade, previsto): a soma é o próprio rótulo.
  if (column.type === 'integer' && spec.op === 'sum') return headerLabel(column);
  if (column.type === 'date' || column.type === 'datetime') return `${column.label} (${spec.op === 'min' ? 'mais antiga' : 'mais recente'})`;
  const unit = column.unit ? `, ${column.unit}` : '';
  const op = GENERIC_OPS[spec.op] ?? spec.op;
  // "Dias no lote (no período)" já tem parênteses: "Dias no lote (no período) — média".
  return column.label.includes('(') ? `${column.label} — ${op}${unit ? ` (${column.unit})` : ''}` : `${column.label} (${op}${unit})`;
}

/**
 * Rótulos das métricas do Resumido, sem repetição (repetidos caem no rótulo técnico).
 * context.metricLabels (E1B): { [id da métrica]: 'Rótulo' } da definição — rótulo de curral da folha
 * ("Qtd", "Menor (kg)", "Média (@)") aplicado quando a métrica com esse id está na seleção.
 */
export function summaryMetricLabels(specs, columns, context = {}) {
  const seen = new Set();
  const overrides = context.metricLabels && typeof context.metricLabels === 'object' ? context.metricLabels : {};
  const isAnimalColumn = (columnId) => columnId === context.animalColumnId || ['animal', 'numero_animal'].includes(columnId);
  const distinctAnimals = specs.some((spec) => spec.op === 'countDistinct' && isAnimalColumn(spec.columnId));
  // M1 §5: rótulo com {@} ("Média ({@})") = a marca da arroba da coluna do TOTAL (nunca a do id); num total que não é
  // de arroba o rótulo da definição não vale (fica o automático, que diz o que a coluna é).
  const overrideOf = (spec) => {
    const label = spec.id ? overrides[spec.id] : undefined;
    if (typeof label !== 'string') return null;
    if (!hasArrobaToken(label)) return label;
    const column = spec.columnId ? columns.find((item) => item.id === spec.columnId) ?? null : null;
    return arrobaKindOf(column) ? resolveArrobaLabel(label, column) : null;
  };
  // Rótulos da definição primeiro: um rótulo automático igual a um deles cai no técnico, não o contrário.
  for (const spec of specs) if (overrideOf(spec) !== null) seen.add(overrideOf(spec));
  return specs.map((spec) => {
    const override = overrideOf(spec);
    if (override !== null) return override;
    let label = summaryMetricLabel(spec, columns, { ...context, distinctAnimals });
    if (seen.has(label)) label = aggregateLabel(spec, columns);
    seen.add(label);
    return label;
  });
}
