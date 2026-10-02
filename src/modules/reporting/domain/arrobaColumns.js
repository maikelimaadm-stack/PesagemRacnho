// M1 (1.5.0) — as DUAS arrobas do produto (docs/plano-mestre/M1-FUNDACAO-NUMERO.md §5). Elas continuam duas (não se
// unificam, nenhuma é escolhida no lugar da outra) e NUNCA se somam:
//   @ de PESO VIVO  (arroba: 'vivo')    = peso ÷ divisor (30 ou 15, Configurações › Relatórios) — peso_arroba, ganho_arroba;
//   @ de CARCAÇA    (arroba: 'carcaca') = peso × rendimento ÷ 100 ÷ 15, gravada no lançamento — quantidade_arrobas.
//
// Rótulo: UM padrão curto, o mesmo em tudo (tela, folha, impressão/PDF, CSV, XLSX, "Colunas", "Calcular", "Adicionar
// coluna…" e gráficos): a marca da arroba entre parênteses — "(@ vivo ÷30)" (o divisor EM USO aparece) e "(@ carcaça)".
// Nenhum rótulo de arroba começa por "@" (o CSV protege a célula que começa por "@" com apóstrofo).
//   - o rótulo declara o lugar da marca com {@} ("Média ({@})"); quem preenche é a COLUNA do total ou da célula, nunca o
//     id do total — um total de carcaça nunca sai com o nome da @ viva, mesmo vindo de um modelo antigo com o id trocado;
//   - a coluna leva `arroba` (o tipo) e `arrobaTag` (a marca): o runReport põe o divisor do view model
//     (definitionForDivisor) e todos os canais leem as colunas do view model;
//   - fora de um view model (catálogo, seletor antes da primeira emissão) a @ viva sai "(@ vivo)", sem divisor — nunca
//     um divisor que talvez não seja o em uso.
//
// Proibição dura: nenhum total (subtotal, total geral, "Calcular", "Adicionar coluna…", par "de–até", média ponderada,
// razão) junta as duas. arrobaConflictOf/assertSeparateArrobaTotals valem no serviço (resolveSelection), no motor
// (reportAggregates.computeAggregates/assertAggregateSpec) e no menu do cabeçalho (headerActions); a definição também é
// recusada se declarar a mistura (defineColumn/defineReport). Com as duas na mesma folha, cada uma tem o seu total.

export const ARROBA_KINDS = Object.freeze({ VIVO: 'vivo', CARCACA: 'carcaca' });
export const ARROBA_LABEL_TOKEN = '{@}';
export const LIVE_ARROBA_DIVISORS = Object.freeze([30, 15]);
export const ARROBA_MIXED_CODE = 'ARROBA_MISTA';

const KINDS = new Set(Object.values(ARROBA_KINDS));
const KIND_NAMES = Object.freeze({ vivo: '@ de peso vivo', carcaca: '@ de carcaça' });

/** O tipo declarado é uma das duas arrobas? */
export function isArrobaKind(kind) {
  return KINDS.has(kind);
}

/** Tipo de arroba da coluna ('vivo' | 'carcaca') ou null (não é coluna de arroba). */
export function arrobaKindOf(column) {
  return KINDS.has(column?.arroba) ? column.arroba : null;
}

const liveDivisor = (divisor) => (LIVE_ARROBA_DIVISORS.includes(Number(divisor)) ? Number(divisor) : null);

/** Marca curta: "@ vivo ÷30" / "@ vivo ÷15" / "@ vivo" (divisor desconhecido) / "@ carcaça". */
export function arrobaTag(kind, divisor = null) {
  if (kind === ARROBA_KINDS.CARCACA) return '@ carcaça';
  if (kind === ARROBA_KINDS.VIVO) {
    const value = liveDivisor(divisor);
    return value ? `@ vivo ÷${value}` : '@ vivo';
  }
  throw new Error(`arroba: tipo desconhecido (${kind})`);
}

/** Nome por extenso (descrições e ajuda): "@ de peso vivo (÷ 30)" / "@ de carcaça". */
export function arrobaName(kind, divisor = null) {
  if (kind === ARROBA_KINDS.CARCACA) return KIND_NAMES.carcaca;
  if (kind === ARROBA_KINDS.VIVO) {
    const value = liveDivisor(divisor);
    return value ? `${KIND_NAMES.vivo} (÷ ${value})` : KIND_NAMES.vivo;
  }
  throw new Error(`arroba: tipo desconhecido (${kind})`);
}

/** O texto tem o lugar da marca da arroba ({@})? */
export function hasArrobaToken(text) {
  return typeof text === 'string' && text.includes(ARROBA_LABEL_TOKEN);
}

/**
 * Rótulo com {@} → a marca da COLUNA ("Média ({@})" + coluna da @ viva do view model → "Média (@ vivo ÷30)"). Texto sem
 * {@} volta igual. {@} numa coluna que não é de arroba é erro (o rótulo diria uma arroba que o número não é).
 */
export function resolveArrobaLabel(text, column) {
  if (!hasArrobaToken(text)) return text;
  const kind = arrobaKindOf(column);
  const tag = column?.arrobaTag ?? (kind ? arrobaTag(kind) : null);
  if (!tag) throw new Error(`rótulo "${text}": {@} só em coluna ou total de arroba (coluna ${column?.id ?? 'nenhuma'})`);
  return text.split(ARROBA_LABEL_TOKEN).join(tag);
}

/**
 * A coluna com a marca do divisor em uso (rótulo da definição com {@} → "Peso (@ vivo ÷30)"). Coluna que não é de
 * arroba volta a mesma (mesmo objeto).
 */
export function arrobaColumnFor(column, divisor = null) {
  const kind = arrobaKindOf(column);
  if (!kind) return column;
  const tag = arrobaTag(kind, divisor);
  if (column.arrobaTag === tag) return column;
  return Object.freeze({ ...column, arrobaTag: tag, label: resolveArrobaLabel(column.labelTemplate ?? column.label, { arroba: kind, arrobaTag: tag }) });
}

/**
 * A coluna de um view model com a marca da arroba: a pública (runReport já põe arroba/arrobaTag com o divisor em uso);
 * num view model montado à mão (sem a marca nas colunas públicas), a da definição pelo resolve, com o divisor do view
 * model. null = coluna desconhecida.
 */
export function viewModelArrobaColumn(viewModel, columnId) {
  if (!columnId) return null;
  const shown = (viewModel?.availableColumns ?? viewModel?.columns ?? []).find((column) => column.id === columnId) ?? null;
  if (shown?.arrobaTag || arrobaKindOf(shown)) return shown;
  const defined = typeof viewModel?.resolve === 'function' ? viewModel.resolve(columnId)?.column ?? null : null;
  return defined ? arrobaColumnFor(defined, viewModel.arrobaDivisor ?? null) : shown;
}

/** {@} de um rótulo do view model pela coluna do total/célula (viewModelArrobaColumn). */
export function viewModelArrobaLabel(viewModel, text, columnId) {
  return hasArrobaToken(text) ? resolveArrobaLabel(text, viewModelArrobaColumn(viewModel, columnId)) : text;
}

const specIdOf = (spec) => spec.id ?? `${spec.op}:${spec.columnId ?? '*'}`;

/**
 * Rótulos de curral dos totais (metricLabels, por id) com {@} preenchido pela coluna do total que tem o id. A primeira
 * lista que tiver o id manda (passe a seleção antes dos totais da definição). Rótulo com {@} num total que não é de
 * arroba sai (fica o rótulo automático, que diz o que a coluna é).
 * @param labels { [id]: rótulo }
 * @param specs totais ({ id?, op, columnId? })
 * @param columnOf (columnId) => coluna (com arrobaTag) | null
 */
export function metricLabelsFor(labels, specs, columnOf) {
  const out = {};
  for (const [id, label] of Object.entries(labels ?? {})) {
    if (!hasArrobaToken(label)) { out[id] = label; continue; }
    const spec = (specs ?? []).find((item) => item && specIdOf(item) === id);
    const column = spec?.columnId ? columnOf(spec.columnId) : null;
    if (arrobaKindOf(column)) out[id] = resolveArrobaLabel(label, column);
  }
  return Object.freeze(out);
}

const labelledDefinitions = new WeakMap();

/**
 * A definição com as colunas, os rótulos dos totais (metricLabels) e os cabeçalhos dos tipos (columnLabels) na marca
 * do divisor em uso (null = "@ vivo", sem divisor). Mesma definição quando ela não tem coluna de arroba. Memoizada por
 * definição e divisor (as colunas novas são criadas uma vez).
 */
export function definitionForDivisor(definition, divisor = null) {
  if (!definition?.columns?.some((column) => arrobaKindOf(column))) return definition;
  const value = liveDivisor(divisor);
  let byDivisor = labelledDefinitions.get(definition);
  if (!byDivisor) { byDivisor = new Map(); labelledDefinitions.set(definition, byDivisor); }
  const key = value ?? 'sem-divisor';
  if (byDivisor.has(key)) return byDivisor.get(key);
  const columns = definition.columns.map((column) => arrobaColumnFor(column, value));
  const byId = new Map(columns.map((column) => [column.id, column]));
  const columnOf = (columnId) => byId.get(columnId) ?? null;
  const specs = [...(definition.defaultAggregates ?? []), ...(definition.views ?? []).flatMap((view) => view.aggregates ?? [])];
  const views = (definition.views ?? []).map((view) => {
    if (!view.columnLabels) return view;
    const columnLabels = Object.fromEntries(Object.entries(view.columnLabels).map(([id, label]) => [id, resolveArrobaLabel(label, columnOf(id))]));
    return Object.freeze({ ...view, columnLabels: Object.freeze(columnLabels) });
  });
  const labelled = Object.freeze({
    ...definition,
    columns: Object.freeze(columns),
    views: Object.freeze(views),
    metricLabels: metricLabelsFor(definition.metricLabels, specs, columnOf),
    arrobaDivisor: value,
  });
  byDivisor.set(key, labelled);
  return labelled;
}

const kindText = (kind) => (kind ? KIND_NAMES[kind] : 'valor que não é arroba');

/**
 * Mistura de arrobas num total só (null = nenhuma). O total junta as duas quando a média ponderada pesa uma @ pela
 * outra, a razão divide uma pela outra, ou a coluna de arroba aponta para um peso/razão que o motor não confere.
 * @param spec { op, columnId? }
 * @param column coluna do total
 * @param columnOf (columnId) => coluna | null
 */
export function arrobaSpecConflict(spec, column, columnOf) {
  const kind = arrobaKindOf(column);
  if (!kind || !spec) return null;
  const parts = spec.op === 'weightedAvg' ? [column.weightedBy] : spec.op === 'ratio' ? [column.ratio?.numerator, column.ratio?.denominator] : [];
  for (const part of parts) {
    if (typeof part !== 'string') return `${kindText(kind)} (${column.id}) com ${spec.op} por uma conta que não diz qual arroba é`;
    const other = arrobaKindOf(columnOf(part));
    if (other && other !== kind) return `${spec.op} de ${kindText(kind)} (${column.id}) pela ${kindText(other)} (${part})`;
  }
  return null;
}

/**
 * Lista de totais que junta as duas arrobas (null = nenhuma mistura): o mesmo total (id) em colunas de tipos diferentes
 * — o resultado de um sobrescreveria o do outro na mesma célula, linha ou coluna da folha — ou um total que mistura por
 * dentro (arrobaSpecConflict).
 * @param specs totais ({ id?, op, columnId? })
 * @param columnOf (columnId) => coluna | null
 * @returns {null | string} o motivo, em texto
 */
export function arrobaConflictOf(specs, columnOf) {
  const seen = new Map();
  for (const spec of specs ?? []) {
    if (!spec) continue;
    const column = spec.columnId ? columnOf(spec.columnId) : null;
    const inside = arrobaSpecConflict(spec, column, columnOf);
    if (inside) return inside;
    const id = specIdOf(spec);
    const kind = arrobaKindOf(column);
    if (seen.has(id)) {
      const before = seen.get(id);
      if (before.kind !== kind && (before.kind || kind)) {
        return `o total "${id}" junta ${kindText(before.kind)} (${before.columnId ?? 'sem coluna'}) com ${kindText(kind)} (${spec.columnId ?? 'sem coluna'})`;
      }
      continue;
    }
    seen.set(id, { kind, columnId: spec.columnId ?? null });
  }
  return null;
}

/** Erro da proibição dura (code ARROBA_MISTA). */
export function arrobaMixedError(reason) {
  const error = new Error(`@ de peso vivo e @ de carcaça não se somam: ${reason}. Cada uma tem o seu total.`);
  error.code = ARROBA_MIXED_CODE;
  return error;
}

/** Lança ARROBA_MISTA quando a lista de totais junta as duas arrobas. */
export function assertSeparateArrobaTotals(specs, resolve) {
  const reason = arrobaConflictOf(specs, (columnId) => resolve(columnId)?.column ?? null);
  if (reason) throw arrobaMixedError(reason);
}

// Texto de quantidade com "@" ou "arroba(s)" — o que precisa dizer QUAL arroba é (preço da @ não: é dinheiro).
const MENTIONS_ARROBA = /@|\barrobas?\b/i;

/** O texto fala de arroba? (para conferir que a coluna declara o tipo) */
export function mentionsArroba(text) {
  return typeof text === 'string' && MENTIONS_ARROBA.test(text);
}
