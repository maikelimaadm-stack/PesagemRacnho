// Sugestão de categoria do animal (ADR-028; docs 12 §3.1 `categoriasAnimal`).
// Regra pura: a primeira categoria ativa compatível com o sexo (`sexo_aplicavel`
// M/F/AMBOS) e com a idade em meses (faixa `idade_min_meses`..`idade_max_meses`,
// limites nulos = sem limite), na ordem em que o cadastro as lista.
// Sem nascimento não há sugestão: a tela nunca adivinha categoria sem idade.

function civil(value) {
  const text = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Meses completos entre o nascimento e a data de referência (ambos civis); null quando inválido ou futuro. */
export function monthsBetween(nascimento, referenceDate) {
  const birth = civil(nascimento);
  const reference = civil(referenceDate);
  if (!birth || !reference || reference < birth) return null;
  let months = (reference.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (reference.getUTCMonth() - birth.getUTCMonth());
  if (reference.getUTCDate() < birth.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function sexMatches(categoria, sexo) {
  const aplicavel = String(categoria?.sexo_aplicavel ?? 'AMBOS').toLocaleUpperCase('pt-BR');
  const alvo = String(sexo ?? '').toLocaleUpperCase('pt-BR');
  if (!alvo) return aplicavel === 'AMBOS';
  return aplicavel === 'AMBOS' || aplicavel === alvo;
}

export function ageMatches(categoria, meses) {
  if (!Number.isFinite(meses)) return false;
  const min = categoria?.idade_min_meses;
  const max = categoria?.idade_max_meses;
  if (min != null && Number.isFinite(Number(min)) && meses < Number(min)) return false;
  if (max != null && Number.isFinite(Number(max)) && meses > Number(max)) return false;
  return true;
}

/**
 * suggestCategory({ categorias, sexo, nascimento, referenceDate }) → categoria | null.
 * `referenceDate` é a data do lançamento (civil); sem ela usa a data de hoje.
 */
export function suggestCategory({ categorias = [], sexo, nascimento, referenceDate } = {}) {
  if (!nascimento) return null;
  const reference = referenceDate || new Date().toISOString().slice(0, 10);
  const meses = monthsBetween(nascimento, reference);
  if (meses === null) return null;
  return categorias.find((categoria) =>
    categoria && categoria.ativo !== false && !categoria.deleted_at && sexMatches(categoria, sexo) && ageMatches(categoria, meses)) ?? null;
}
