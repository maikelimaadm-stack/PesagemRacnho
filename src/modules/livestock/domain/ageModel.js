// Idade com precisão conhecida, faixa etária, era, categoria produtiva e dentição (F04, F05) — puro.
//
// Fato × estimativa: o nascimento guarda a PRECISÃO e a FONTE. Sem dado, a idade é DESCONHECIDA — nunca um dia
// ou mês inventado. A idade é calculada para a data pedida (hoje ou a data de uma pesagem), contando meses
// completos por aniversário; muda com o calendário, sem nova pesagem. Peso nunca "envelhece" o animal: a faixa
// de peso (categoria por peso da 1.x, campo `era` legado) continua um snapshot à parte. Dentição é OBSERVADA
// (0, 2, 4, 6 ou 8 dentes permanentes, com data e origem) e nunca deduzida do calendário.
import { isFutureCivilDate, parseCivilDate } from '../../weighing/domain/brazilianValues.js';

export class AgeError extends Error {
  constructor(message, erros = [message]) {
    super(message);
    this.name = 'AgeError';
    this.code = 'IDADE_INVALIDA';
    this.erros = erros;
  }
}

export const PRECISOES = Object.freeze(['DIA', 'MES', 'IDADE_DECLARADA', 'DESCONHECIDA']);
export const PRECISAO_LABELS = Object.freeze({
  DIA: 'Data exata',
  MES: 'Mês e ano estimados',
  IDADE_DECLARADA: 'Idade declarada',
  DESCONHECIDA: 'Desconhecida',
});
export const FONTES_NASCIMENTO = Object.freeze(['REGISTRO_PROPRIO', 'DOCUMENTO_COMPRA', 'DECLARACAO_VENDEDOR', 'AVALIACAO_TECNICA', 'OPERACAO_NASCIMENTO', 'OUTRA']);
export const FONTE_LABELS = Object.freeze({
  REGISTRO_PROPRIO: 'Registro próprio',
  DOCUMENTO_COMPRA: 'Documento da compra',
  DECLARACAO_VENDEDOR: 'Declaração do vendedor',
  AVALIACAO_TECNICA: 'Avaliação técnica',
  OPERACAO_NASCIMENTO: 'Lançado como nascimento',
  OUTRA: 'Outra',
});
export const DENTICOES = Object.freeze([0, 2, 4, 6, 8]);
export const DENTICAO_LABELS = Object.freeze({ 0: 'Dente de leite (0)', 2: '2 dentes', 4: '4 dentes', 6: '6 dentes', 8: 'Boca cheia (8)' });

/**
 * Política de idade (Parametrização › Idade/era/categorias). `faixas_meses` são os limites superiores das
 * faixas (inclusive); a última faixa é "acima do último limite". `eras` são os rótulos locais de cada faixa
 * (mesma quantidade de faixas + 1). Categoria produtiva automática fica DESLIGADA por padrão: nenhuma regra
 * não validada é imposta.
 */
export const AGE_POLICY_DEFAULTS = Object.freeze({
  faixas_meses: Object.freeze([12, 24, 36]),
  eras: Object.freeze(['0 a 12 meses', '13 a 24 meses', '25 a 36 meses', 'Acima de 36 meses']),
  sugerir_categoria_produtiva: false,
  categorias_produtivas: Object.freeze({
    M: Object.freeze(['Bezerro', 'Garrote', 'Boi magro', 'Boi']),
    F: Object.freeze(['Bezerra', 'Novilha', 'Novilha', 'Vaca']),
  }),
});

export function normalizeAgePolicy(raw = {}) {
  const faixas = Array.isArray(raw.faixas_meses) ? raw.faixas_meses.map(Number) : [...AGE_POLICY_DEFAULTS.faixas_meses];
  const erros = [];
  if (!faixas.length || faixas.some((n) => !Number.isInteger(n) || n < 1 || n > 600)) erros.push('Faixas de idade: use meses inteiros entre 1 e 600.');
  if (faixas.some((n, i) => i > 0 && n <= faixas[i - 1])) erros.push('Faixas de idade: os limites precisam ser crescentes.');
  const eras = Array.isArray(raw.eras) ? raw.eras.map((t) => String(t || '').trim()) : null;
  const erasFinal = eras && eras.length === faixas.length + 1 ? eras : defaultEraLabels(faixas);
  if (erasFinal.some((t) => !t)) erros.push('Toda faixa precisa de um rótulo de era.');
  const cats = raw.categorias_produtivas && typeof raw.categorias_produtivas === 'object' ? raw.categorias_produtivas : AGE_POLICY_DEFAULTS.categorias_produtivas;
  const catOf = (sexo) => {
    const lista = Array.isArray(cats[sexo]) ? cats[sexo].map((t) => String(t || '').trim()) : [];
    return lista.length === faixas.length + 1 ? lista : Array.from({ length: faixas.length + 1 }, () => '');
  };
  if (erros.length) throw new AgeError(erros[0], erros);
  return {
    faixas_meses: faixas,
    eras: erasFinal,
    sugerir_categoria_produtiva: raw.sugerir_categoria_produtiva === true,
    categorias_produtivas: { M: catOf('M'), F: catOf('F') },
  };
}

function defaultEraLabels(faixas) {
  return faixas.map((limite, i) => `${i === 0 ? 0 : faixas[i - 1] + 1} a ${limite} meses`).concat(`Acima de ${faixas.at(-1)} meses`);
}

const parts = (iso) => String(iso).split('-').map(Number);

/** Meses completos entre duas datas civis (aniversário mensal: 31/01 → 28/02 ainda não fecha 1 mês). */
export function completedMonths(fromIso, toIso) {
  const [y1, m1, d1] = parts(fromIso);
  const [y2, m2, d2] = parts(toIso);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) {
    // Último dia do mês de destino conta como aniversário de quem nasceu em dia que esse mês não tem.
    const lastDay = new Date(Date.UTC(y2, m2, 0)).getUTCDate();
    if (!(d2 === lastDay && d1 > lastDay)) months -= 1;
  }
  return months;
}

/** Valida a entrada do nascimento (ficha do animal). */
export function validateBirthInput(input = {}) {
  const precisao = String(input.nascimento_precisao || '').toUpperCase();
  const erros = [];
  if (!PRECISOES.includes(precisao)) erros.push('Escolha a precisão do nascimento.');
  const fonte = input.nascimento_fonte ? String(input.nascimento_fonte).toUpperCase() : null;
  if (precisao !== 'DESCONHECIDA' && (!fonte || !FONTES_NASCIMENTO.includes(fonte))) erros.push('Informe a fonte do nascimento.');
  const out = { nascimento_precisao: precisao, nascimento_fonte: precisao === 'DESCONHECIDA' ? null : fonte, nascimento_data: null, idade_declarada_meses: null, idade_referencia_data: null };
  if (precisao === 'DIA') {
    const data = parseCivilDate(input.nascimento_data);
    if (!data) erros.push('Data de nascimento inválida.');
    else if (isFutureCivilDate(data)) erros.push('A data de nascimento não pode estar no futuro.');
    out.nascimento_data = data;
  } else if (precisao === 'MES') {
    const match = /^(\d{4})-(\d{2})$/.exec(String(input.nascimento_mes || '').trim());
    const mes = match ? Number(match[2]) : 0;
    if (!match || mes < 1 || mes > 12) erros.push('Informe o mês e o ano (AAAA-MM).');
    else {
      out.nascimento_data = `${match[1]}-${match[2]}-01`;
      if (isFutureCivilDate(out.nascimento_data)) erros.push('O mês de nascimento não pode estar no futuro.');
    }
  } else if (precisao === 'IDADE_DECLARADA') {
    const meses = Number(input.idade_declarada_meses);
    if (!Number.isInteger(meses) || meses < 0 || meses > 600) erros.push('Idade declarada: meses inteiros entre 0 e 600.');
    const ref = parseCivilDate(input.idade_referencia_data);
    if (!ref) erros.push('Informe a data em que a idade foi declarada.');
    else if (isFutureCivilDate(ref)) erros.push('A data de referência não pode estar no futuro.');
    out.idade_declarada_meses = Number.isInteger(meses) ? meses : null;
    out.idade_referencia_data = ref;
  }
  if (erros.length) throw new AgeError(erros[0], erros);
  return out;
}

/**
 * Idade na data (`em`, AAAA-MM-DD). Retorna meses completos, faixa [min, max] quando estimada, precisão e
 * texto. Sem dado: { desconhecida: true }.
 */
export function ageAt(animal, em) {
  const precisao = animal?.nascimento_precisao || (animal?.nascimento_data ? 'DIA' : animal?.nascimento ? (animal.nascimento_estimado ? 'MES' : 'DIA') : 'DESCONHECIDA');
  const base = animal?.nascimento_data || animal?.nascimento || null;
  if (precisao === 'DIA' && base) {
    if (em < base) return { desconhecida: false, antesDoNascimento: true, meses: null, precisao, estimada: false, texto: 'antes do nascimento' };
    const meses = completedMonths(base, em);
    return { desconhecida: false, meses, min: meses, max: meses, precisao, estimada: false, texto: `${meses} ${meses === 1 ? 'mês' : 'meses'}` };
  }
  if (precisao === 'MES' && base) {
    // Nasceu em algum dia do mês: de (último dia do mês) a (dia 1) → faixa de no máximo 1 mês.
    const [y, m] = parts(base);
    const ultimo = `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
    if (em < base) return { desconhecida: false, antesDoNascimento: true, meses: null, precisao, estimada: true, texto: 'antes do nascimento' };
    const max = completedMonths(base, em);
    const min = em < ultimo ? 0 : completedMonths(ultimo, em);
    return { desconhecida: false, meses: min, min, max, precisao, estimada: true, texto: min === max ? `~${max} meses (mês estimado)` : `${min} a ${max} meses (mês estimado)` };
  }
  if (precisao === 'IDADE_DECLARADA' && Number.isInteger(animal?.idade_declarada_meses) && animal?.idade_referencia_data) {
    const decorridos = em >= animal.idade_referencia_data ? completedMonths(animal.idade_referencia_data, em) : -completedMonths(em, animal.idade_referencia_data);
    const meses = animal.idade_declarada_meses + decorridos;
    if (meses < 0) return { desconhecida: false, antesDoNascimento: true, meses: null, precisao, estimada: true, texto: 'antes do nascimento' };
    return { desconhecida: false, meses, min: meses, max: meses, precisao, estimada: true, texto: `~${meses} meses (idade declarada)` };
  }
  return { desconhecida: true, meses: null, min: null, max: null, precisao: 'DESCONHECIDA', estimada: false, texto: 'Idade desconhecida' };
}

/** Índice da faixa (0..n) para meses; null sem idade. Estimativa que atravessa limite usa o mínimo. */
export function faixaIndex(meses, policy = AGE_POLICY_DEFAULTS) {
  if (meses === null || meses === undefined) return null;
  const i = policy.faixas_meses.findIndex((limite) => meses <= limite);
  return i === -1 ? policy.faixas_meses.length : i;
}

/** Era (rótulo local da faixa de idade) na data; null quando a idade é desconhecida. */
export function eraAt(animal, em, policy = AGE_POLICY_DEFAULTS) {
  const idade = ageAt(animal, em);
  if (idade.desconhecida || idade.meses === null) return null;
  const i = faixaIndex(idade.meses, policy);
  const iMax = faixaIndex(idade.max, policy);
  return { indice: i, rotulo: policy.eras[i], incerta: iMax !== i, estimada: idade.estimada };
}

/**
 * Categoria produtiva: a GRAVADA no animal (decisão de manejo) prevalece; sugestão por sexo + faixa só
 * quando a política liga a sugestão e há idade e sexo.
 */
export function categoriaProdutiva(animal, em, policy = AGE_POLICY_DEFAULTS) {
  if (animal?.categoria_produtiva) return { valor: animal.categoria_produtiva, origem: 'INFORMADA' };
  if (!policy.sugerir_categoria_produtiva || !['M', 'F'].includes(animal?.sexo)) return { valor: null, origem: null };
  const era = eraAt(animal, em, policy);
  if (!era) return { valor: null, origem: null };
  const valor = policy.categorias_produtivas[animal.sexo]?.[era.indice] || null;
  return { valor, origem: valor ? 'SUGERIDA' : null };
}

export function validateDentition(input = {}) {
  const erros = [];
  const dentes = Number(input.dentes);
  if (!DENTICOES.includes(dentes)) erros.push('Dentição: escolha 0, 2, 4, 6 ou 8 dentes.');
  const data = parseCivilDate(input.data);
  if (!data) erros.push('Data da avaliação é obrigatória.');
  else if (isFutureCivilDate(data)) erros.push('A data da avaliação não pode estar no futuro.');
  if (erros.length) throw new AgeError(erros[0], erros);
  return { dentes, data, avaliador: input.avaliador ? String(input.avaliador).trim() || null : null, observacao: input.observacao ? String(input.observacao).trim() || null : null };
}
