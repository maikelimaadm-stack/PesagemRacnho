// Categoria do Cadastro importado (missão §29). Três modos:
//   PLANILHA  → nome ou id da coluna, resolvido nos cadastros (ausente = cadastro mestre ausente);
//   FIXA      → um id escolhido no assistente para todas as linhas;
//   AUTOMATICA→ faixa de peso das categorias do sexo (mesmas funções de categorySuggestion).
// A escolha automática da IMPORTAÇÃO é mais estrita que suggestCategory: sem sexo, sem peso,
// nenhuma faixa ou MAIS DE UMA faixa possível → não resolvida, com mensagem. Nunca escolhe em
// silêncio. Depois do Cadastro vale a regra vigente: o Manejo reclassifica animal automático.
import { normalizeName } from '../../catalog/domain/normalize.js';
import { categoriesForSex, hasWeightRange, sexMatches, weightMatches } from '../../operations/domain/categorySuggestion.js';
import { CATEGORY_MODES } from './importConstants.js';

export const CATEGORY_REASONS = Object.freeze({
  RESOLVIDA: 'RESOLVIDA',
  SEM_SEXO: 'SEM_SEXO',
  SEM_PESO: 'SEM_PESO',
  SEM_FAIXA: 'SEM_FAIXA',
  AMBIGUA: 'AMBIGUA',
  NAO_INFORMADA: 'NAO_INFORMADA',
});

const fmtKg = (peso) => String(peso).replace('.', ',');
const liveCategories = (categorias) => categorias.filter((row) => row && !row.deleted_at);

/** { categoria, reason, message } pela faixa de peso; categoria só quando exatamente uma faixa contém o peso. */
export function resolveAutomaticCategory({ categorias = [], sexo = null, peso = null } = {}) {
  if (!sexo) return { categoria: null, reason: CATEGORY_REASONS.SEM_SEXO, message: 'Categoria automática não resolvida: informe o sexo do animal.' };
  if (peso === null || peso === undefined) return { categoria: null, reason: CATEGORY_REASONS.SEM_PESO, message: 'Categoria automática não resolvida: evento sem peso.' };
  const matches = categoriesForSex(liveCategories(categorias), sexo).filter((row) => hasWeightRange(row) && weightMatches(row, peso));
  if (!matches.length) {
    return { categoria: null, reason: CATEGORY_REASONS.SEM_FAIXA, message: `Categoria automática não resolvida: nenhuma faixa de peso do sexo ${sexo} contém ${fmtKg(peso)} kg.` };
  }
  if (matches.length > 1) {
    return {
      categoria: null,
      reason: CATEGORY_REASONS.AMBIGUA,
      message: `Categoria automática não resolvida: mais de uma faixa contém ${fmtKg(peso)} kg (${matches.map((row) => row.nome).join(', ')}). Ajuste as faixas ou escolha a categoria.`,
    };
  }
  return { categoria: matches[0], reason: CATEGORY_REASONS.RESOLVIDA, message: null };
}

/**
 * resolveImportCategory({ mode, categorias, sexo, peso, categoriaId, categoriaNome, fixedCategoriaId }) →
 * { categoria, origem, automatic, reason, error, message, missingMaster }
 *   automatic: valor de `categoria_automatica` do animal novo;
 *   error: mensagem que torna a linha ERRO; missingMaster: nome de categoria não cadastrada.
 */
export function resolveImportCategory({ mode, categorias = [], sexo = null, peso = null, categoriaId = null, categoriaNome = null, fixedCategoriaId = null } = {}) {
  const rows = liveCategories(categorias);
  const checkSex = (categoria, origem) => {
    if (sexo && !sexMatches(categoria, sexo)) {
      return { categoria: null, origem, automatic: false, reason: null, error: `A categoria "${categoria.nome}" não se aplica ao sexo ${sexo}.`, message: null, missingMaster: null };
    }
    return { categoria, origem, automatic: false, reason: CATEGORY_REASONS.RESOLVIDA, error: null, message: null, missingMaster: null };
  };

  if (mode === CATEGORY_MODES.FIXA) {
    const categoria = rows.find((row) => String(row.id) === String(fixedCategoriaId ?? ''));
    if (!categoria) return { categoria: null, origem: CATEGORY_MODES.FIXA, automatic: false, reason: null, error: 'Categoria fixa não informada ou inexistente.', message: null, missingMaster: null };
    return checkSex(categoria, CATEGORY_MODES.FIXA);
  }

  if (mode === CATEGORY_MODES.AUTOMATICA) {
    const result = resolveAutomaticCategory({ categorias: rows, sexo, peso });
    // Faixa ambígua: o animal nasce com categoria manual vazia; nenhuma projeção escolhe por ele.
    const automatic = result.reason !== CATEGORY_REASONS.AMBIGUA;
    return { categoria: result.categoria, origem: CATEGORY_MODES.AUTOMATICA, automatic, reason: result.reason, error: null, message: result.message, missingMaster: null };
  }

  // PLANILHA (padrão).
  if (categoriaId) {
    const categoria = rows.find((row) => String(row.id) === String(categoriaId));
    if (categoria) return checkSex(categoria, CATEGORY_MODES.PLANILHA);
    // Id de outra base: vale o nome da coluna Categoria, quando houver.
    if (!normalizeName(categoriaNome)) {
      return { categoria: null, origem: CATEGORY_MODES.PLANILHA, automatic: false, reason: null, error: `categoria_id "${categoriaId}" não existe nos cadastros.`, message: null, missingMaster: null };
    }
  }
  const alvo = normalizeName(categoriaNome);
  if (!alvo) {
    return { categoria: null, origem: CATEGORY_MODES.PLANILHA, automatic: false, reason: CATEGORY_REASONS.NAO_INFORMADA, error: null, message: 'Categoria não informada na planilha: o animal fica sem categoria.', missingMaster: null };
  }
  const named = rows.filter((row) => row.nome_normalizado === alvo || normalizeName(row.nome) === alvo);
  const preferred = named.find((row) => row.ativo !== false) || named[0];
  if (!preferred) {
    return { categoria: null, origem: CATEGORY_MODES.PLANILHA, automatic: false, reason: null, error: `Categoria "${String(categoriaNome).trim()}" não cadastrada.`, message: null, missingMaster: String(categoriaNome).trim() };
  }
  return checkSex(preferred, CATEGORY_MODES.PLANILHA);
}
