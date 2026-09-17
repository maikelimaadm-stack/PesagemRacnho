// Categoria automática do animal (docs 12 §3.1 `categoriasAnimal`; decisão do
// responsável em 16/09/2026: a idade/nascimento saiu, vale o PESO).
// Regra pura: entre as categorias ativas do sexo do animal que têm faixa de peso
// preenchida, a primeira (menor `ordem`) cuja faixa contém o peso. Limites
// inclusivos; mínimo vazio = 0, máximo vazio = sem limite. Categoria sem nenhum
// limite de peso só pode ser escolhida à mão.

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export function sexMatches(categoria, sexo) {
  const aplicavel = String(categoria?.sexo_aplicavel ?? '').toLocaleUpperCase('pt-BR');
  const alvo = String(sexo ?? '').toLocaleUpperCase('pt-BR');
  if (!alvo) return false;
  // Registros anteriores a 16/09/2026 podem ter "AMBOS": valem para os dois sexos.
  return aplicavel === alvo || aplicavel === 'AMBOS';
}

export function hasWeightRange(categoria) {
  return toNumber(categoria?.peso_min_kg) !== null || toNumber(categoria?.peso_max_kg) !== null;
}

export function weightMatches(categoria, peso) {
  const kg = toNumber(peso);
  if (kg === null || kg <= 0 || !hasWeightRange(categoria)) return false;
  const min = toNumber(categoria.peso_min_kg);
  const max = toNumber(categoria.peso_max_kg);
  if (min !== null && kg < min) return false;
  if (max !== null && kg > max) return false;
  return true;
}

const isActive = (categoria) => Boolean(categoria) && categoria.ativo !== false && !categoria.deleted_at;

const byOrder = (left, right) =>
  (toNumber(left.ordem) ?? Number.MAX_SAFE_INTEGER) - (toNumber(right.ordem) ?? Number.MAX_SAFE_INTEGER)
  || String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-BR');

/** Categorias ativas oferecidas para o sexo escolhido, na ordem do cadastro. */
export function categoriesForSex(categorias = [], sexo) {
  return categorias.filter((categoria) => isActive(categoria) && sexMatches(categoria, sexo)).sort(byOrder);
}

/** suggestCategory({ categorias, sexo, peso }) → categoria | null. */
export function suggestCategory({ categorias = [], sexo, peso } = {}) {
  return categoriesForSex(categorias, sexo).find((categoria) => weightMatches(categoria, peso)) ?? null;
}

/** Era gravada na pesagem para a categoria (texto, como o campo legado `era`); null sem era. */
export function eraOfCategory(categoria) {
  const era = toNumber(categoria?.era);
  return era === null ? null : String(era);
}
