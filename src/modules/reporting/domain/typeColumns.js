// "Colunas" de um tipo de relatório (E1D, item 5): o que o seletor oferece e a validação da escolha salva por
// tipo e por usuário (report-type-columns, reportTemplateService). As chaves são as de columnChoices.available
// do tipo — ids de coluna no Detalhado; chaves de métrica no Resumido (o par "de–até", Faixa exigida, é UMA
// chave). Nunca amplia permissão: chave cuja coluna o papel não vê (valores comerciais) não é oferecida nem
// gravada. Nenhuma conta aqui — a seleção sai de reportViews.applyColumnKeys.
import { REPORT_MODES } from './reportDefinition.js';
import { aggregateSpecId } from './reportAggregates.js';
import { summaryMetricLabels } from './aggregateLabels.js';
import { canSeeColumn } from './reportPermissions.js';
import { headerLabel } from './reportFormatting.js';
import { definitionForDivisor } from './arrobaColumns.js';

/** O tipo tem seletor "Colunas" próprio? */
export function hasTypeColumns(view) {
  return Boolean(view?.columnChoices?.available?.length);
}

const columnOf = (definition, columnId) => (definition.columns ?? []).find((column) => column.id === columnId) ?? null;

/** Agregações do tipo por trás de uma chave de métrica (o par vira as duas). */
function metricSpecs(definition, view, key) {
  const pair = (definition.metricPairs ?? []).find((item) => item.id === key);
  const pool = view.aggregates ?? definition.defaultAggregates ?? [];
  return (pair ? [pair.from, pair.to] : [key]).map((id) => pool.find((spec) => aggregateSpecId(spec) === id)).filter(Boolean);
}

/** A chave é do tipo e o papel vê o que ela mostra? */
export function typeColumnKeyVisible(definition, view, key, role) {
  if (!hasTypeColumns(view) || !view.columnChoices.available.includes(key)) return false;
  if (view.mode === REPORT_MODES.DETALHADO) {
    const column = columnOf(definition, key);
    return Boolean(column) && !column.metricOnly && canSeeColumn(column, role);
  }
  const specs = metricSpecs(definition, view, key);
  return specs.length > 0 && specs.every((spec) => !spec.columnId || (columnOf(definition, spec.columnId) && canSeeColumn(columnOf(definition, spec.columnId), role)));
}

/**
 * Escolha de colunas de um tipo, limpa: só chaves de columnChoices.available que o papel vê, sem repetir, na
 * ordem dada. Lista vazia = volta ao padrão do tipo (quem chama decide).
 */
export function sanitizeTypeColumnKeys(definition, view, keys, role) {
  if (!hasTypeColumns(view) || !Array.isArray(keys)) return [];
  const out = [];
  for (const key of keys.map(String)) if (!out.includes(key) && typeColumnKeyVisible(definition, view, key, role)) out.push(key);
  return out;
}

/** Padrão do tipo que o papel vê (defaults sem as colunas sensíveis que ele não vê). */
export function typeColumnDefaults(definition, view, role) {
  return sanitizeTypeColumnKeys(definition, view, view?.columnChoices?.defaults ?? [], role);
}

/**
 * Opções do seletor "Colunas" do tipo, na ordem de columnChoices.available: { key, label, default }.
 * Detalhado: cabeçalho da coluna no tipo (columnLabels) ou o da coluna, com a unidade ("Peso (kg)").
 * Resumido: rótulo de curral da folha ("Qtd", "Média (@ vivo ÷30)", "Faixa exigida (kg)").
 * M1 §5: options.arrobaDivisor = o divisor do view model em uso (a marca da @ de peso vivo leva ele: "(@ vivo ÷30)");
 * sem ele, "(@ vivo)" — nunca um divisor que talvez não seja o em uso.
 */
export function typeColumnOptions(rawDefinition, rawView, role, { arrobaDivisor = rawDefinition?.arrobaDivisor ?? null } = {}) {
  if (!hasTypeColumns(rawView)) return [];
  const definition = definitionForDivisor(rawDefinition, arrobaDivisor);
  const view = (definition.views ?? []).find((item) => item.id === rawView.id) ?? rawView;
  const defaults = view.columnChoices.defaults;
  const keys = view.columnChoices.available.filter((key) => typeColumnKeyVisible(definition, view, key, role));
  if (view.mode === REPORT_MODES.DETALHADO) {
    // E1F: o cabeçalho do tipo (columnLabels) com a unidade, como a grade/XLSX/CSV ("Rendimento (%)", não "Rendimento").
    return keys.map((key) => {
      const column = columnOf(definition, key);
      return { key, label: headerLabel({ ...column, label: view.columnLabels?.[key] ?? column.label }), default: defaults.includes(key) };
    });
  }
  const pool = view.aggregates ?? definition.defaultAggregates ?? [];
  const labels = summaryMetricLabels(pool, definition.columns ?? [], { grain: definition.grain, animalColumnId: definition.animalColumnId ?? null, metricLabels: definition.metricLabels ?? null });
  const labelOf = (id) => labels[pool.findIndex((spec) => aggregateSpecId(spec) === id)] ?? id;
  return keys.map((key) => {
    const pair = (definition.metricPairs ?? []).find((item) => item.id === key);
    return { key, label: pair ? pair.label : labelOf(key), default: defaults.includes(key) };
  });
}
