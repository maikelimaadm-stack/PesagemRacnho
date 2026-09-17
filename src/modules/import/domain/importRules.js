// Regras da análise escolhidas no assistente, normalizadas para valores conhecidos.
// Nada aqui lê banco: o serviço passa as regras cruas e recebe sempre o mesmo formato.
import { isTechnicalLayout } from './importFields.js';
import { CATEGORY_MODES, DATE_FORMATS, DECIMAL_FORMATS, DEFAULT_EMPRESA_ID } from './importConstants.js';

export const FIXED_VALUE_KEYS = Object.freeze(['marca_id', 'raca_id', 'categoria_id', 'sexo', 'apartacao_id', 'lote_id', 'motivo_saida']);

const textOrNull = (value) => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());

/**
 * normalizeImportRules(rules, headers) →
 * { dateFormat, decimal, effectiveDecimal, categoryMode, fixedValues, createMissingMasters, empresaId,
 *   ignoredLines, acceptDuplicates }
 *   effectiveDecimal: com 'auto' e cabeçalhos do CSV técnico, vale 'ponto' (contrato da reimportação);
 *   ignoredLines: linhas físicas que a tela mandou ignorar (viram IGNORADA);
 *   acceptDuplicates: grava repetições idênticas (repesagem) em vez de marcá-las POSSÍVEL DUPLICIDADE.
 */
export function normalizeImportRules(rules = {}, headers = []) {
  const source = rules && typeof rules === 'object' ? rules : {};
  const decimal = DECIMAL_FORMATS.includes(source.decimal) ? source.decimal : 'auto';
  const fixedSource = source.fixedValues && typeof source.fixedValues === 'object' ? source.fixedValues : {};
  const fixedValues = Object.fromEntries(FIXED_VALUE_KEYS.map((key) => [key, textOrNull(fixedSource[key])]));
  const ignoredLines = [...new Set((Array.isArray(source.ignoredLines) ? source.ignoredLines : [])
    .map(Number)
    .filter((line) => Number.isInteger(line) && line > 1))].sort((a, b) => a - b);
  return {
    dateFormat: DATE_FORMATS.includes(source.dateFormat) ? source.dateFormat : 'auto',
    decimal,
    effectiveDecimal: decimal === 'auto' && isTechnicalLayout(headers) ? 'ponto' : decimal,
    categoryMode: Object.values(CATEGORY_MODES).includes(source.categoryMode) ? source.categoryMode : CATEGORY_MODES.PLANILHA,
    fixedValues,
    createMissingMasters: source.createMissingMasters === true,
    empresaId: textOrNull(source.empresaId) || DEFAULT_EMPRESA_ID,
    ignoredLines,
    acceptDuplicates: source.acceptDuplicates === true,
  };
}
