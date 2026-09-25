// Rótulos e formato das agregações (domínio; usados pela tela, pelo layout linear e pelo Resumido).
//   aggregateLabel       → rótulo técnico do Detalhado/subtotal: "Média simples — Peso (kg)".
//   summaryMetricLabel   → rótulo de curral do Resumido: "Peso médio (kg)", "Cabeças", "GMD (kg/dia)".
//   aggregateValueColumn → coluna "virtual" com o tipo certo para formatar o valor agregado.
import { AGGREGATION_LABELS } from './columnDefinition.js';
import { headerLabel } from './reportFormatting.js';

/** Rótulo de uma agregação: "Média simples — Peso (kg)"; contagem de registros sem coluna. */
export function aggregateLabel(spec, columns) {
  if (spec.op === 'count' && !spec.columnId) return 'Registros';
  const column = columns.find((item) => item.id === spec.columnId);
  if (spec.op === 'countDistinct' && column && ['animal', 'numero_animal'].includes(column.id)) return 'Animais únicos';
  return `${AGGREGATION_LABELS[spec.op] ?? spec.op} — ${column ? headerLabel(column) : spec.columnId}`;
}

/** Coluna "virtual" para formatar o valor de uma agregação no tipo certo. */
export function aggregateValueColumn(spec, columns) {
  if (['count', 'countValid', 'countDistinct'].includes(spec.op)) return { type: 'integer' };
  const column = columns.find((item) => item.id === spec.columnId);
  if (!column) return { type: 'number' };
  if (spec.op === 'weightedGmd') return { type: 'gmd' };
  // Média de coluna inteira (dias no lote, dias sem pesagem, nº de pesagens) tem fração: 33,5 e não 34.
  if (column.type === 'integer' && ['avg', 'weightedAvg'].includes(spec.op)) return { ...column, type: 'number', decimals: 1 };
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
    if (spec.op === 'weightedGmd') return 'GMD (kg/dia)';
    if (spec.op === 'avg') return 'GMD simples (kg/dia)';
    return `GMD ${WEIGHT_OPS[spec.op] ?? spec.op} (kg/dia)`;
  }
  if (column.id === 'peso_medio_atual' && LOT_AVERAGE_LABELS[spec.op]) return LOT_AVERAGE_LABELS[spec.op];
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
  if (column.id === 'quantidade_arrobas' && spec.op === 'sum') return 'Arrobas (@)';
  if (spec.op === 'ratio') return headerLabel(column);
  // Contagens guardadas como número (pesagens, capacidade, previsto): a soma é o próprio rótulo.
  if (column.type === 'integer' && spec.op === 'sum') return headerLabel(column);
  if (column.type === 'date' || column.type === 'datetime') return `${column.label} (${spec.op === 'min' ? 'mais antiga' : 'mais recente'})`;
  const unit = column.unit ? `, ${column.unit}` : '';
  const op = GENERIC_OPS[spec.op] ?? spec.op;
  // "Dias no lote (no período)" já tem parênteses: "Dias no lote (no período) — média".
  return column.label.includes('(') ? `${column.label} — ${op}${unit ? ` (${column.unit})` : ''}` : `${column.label} (${op}${unit})`;
}

/** Rótulos das métricas do Resumido, sem repetição (repetidos caem no rótulo técnico). */
export function summaryMetricLabels(specs, columns, context = {}) {
  const seen = new Set();
  const isAnimalColumn = (columnId) => columnId === context.animalColumnId || ['animal', 'numero_animal'].includes(columnId);
  const distinctAnimals = specs.some((spec) => spec.op === 'countDistinct' && isAnimalColumn(spec.columnId));
  return specs.map((spec) => {
    let label = summaryMetricLabel(spec, columns, { ...context, distinctAnimals });
    if (seen.has(label)) label = aggregateLabel(spec, columns);
    seen.add(label);
    return label;
  });
}
