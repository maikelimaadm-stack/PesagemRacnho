// Posologia estruturada e versionada (F08), dose sugerida × aplicada (F09) e carência (F10) — puro.
//
// Uma posologia é a regra de dose de UM medicamento (produto comercial), com princípio ativo, apresentação,
// espécie, indicação e via, num dos modos:
//   PROPORCIONAL: dose = (peso ÷ kg_por_unidade) × dose_por_unidade   (ex.: 1 mL a cada 50 kg)
//   FAIXAS:       tabela da bula (peso mínimo–máximo → dose), sem buracos nem sobreposição.
// Arredondamento é da regra (nenhum, próximo, para cima ou para baixo, com passo) — não há arredondamento
// universal. Só uma posologia APROVADA (fonte + responsável), completa e vigente na data calcula dose; a
// sugestão nunca é aplicada sozinha (confirmação humana). Carência de carne/leite é separada; carência
// desconhecida (null) é diferente de carência zero. Nenhum produto comercial nem dose fixa no código: tudo vem do cadastro aprovado.
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from '../../weighing/domain/brazilianValues.js';
import { UNIDADES_DOSE, VIAS_APLICACAO } from './sanityRules.js';

export class PosologyError extends Error {
  constructor(message, erros = [message], code = 'POSOLOGIA_INVALIDA') {
    super(message);
    this.name = 'PosologyError';
    this.code = code;
    this.erros = erros;
  }
}

export const POSOLOGIA_STATUS = Object.freeze({ RASCUNHO: 'RASCUNHO', APROVADA: 'APROVADA', SUSPENSA: 'SUSPENSA', SUBSTITUIDA: 'SUBSTITUIDA' });
export const POSOLOGIA_STATUS_LABELS = Object.freeze({ RASCUNHO: 'Rascunho', APROVADA: 'Aprovada', SUSPENSA: 'Suspensa', SUBSTITUIDA: 'Substituída' });
export const MODOS = Object.freeze(['PROPORCIONAL', 'FAIXAS']);
export const ARREDONDAMENTOS = Object.freeze(['NENHUM', 'PROXIMO', 'ACIMA', 'ABAIXO']);
export const ARREDONDAMENTO_LABELS = Object.freeze({ NENHUM: 'Sem arredondamento', PROXIMO: 'Ao mais próximo', ACIMA: 'Para cima', ABAIXO: 'Para baixo' });
export const FONTES = Object.freeze(['BULA', 'RECEITUARIO', 'PROTOCOLO_VETERINARIO']);
export const FONTE_LABELS = Object.freeze({ BULA: 'Bula do produto', RECEITUARIO: 'Receituário veterinário', PROTOCOLO_VETERINARIO: 'Protocolo do veterinário responsável' });
// Origem do peso usado no cálculo. ESTIMADO/PROJETADO nunca calculam dose.
export const PESO_ORIGENS_DOSE = Object.freeze(['BALANCA', 'MANUAL', 'PESAGEM_REGISTRADA', 'INFORMADO']);
export const PESO_MAX_DIAS_PADRAO = 30;

const num = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseBrazilianNumber(value);
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
};
const text = (value) => {
  const t = value === null || value === undefined ? '' : String(value).trim();
  return t || null;
};

/** Valida e normaliza a posologia (rascunho ou para aprovar). */
export function validatePosologyInput(input = {}) {
  const erros = [];
  const modo = String(input.modo || '').toUpperCase();
  if (!MODOS.includes(modo)) erros.push('Escolha o modo da posologia (proporcional ao peso ou tabela de faixas).');
  const unidade = text(input.unidade);
  if (!unidade || !UNIDADES_DOSE.includes(unidade)) erros.push(`Unidade da dose: use ${UNIDADES_DOSE.join(', ')}.`);
  const via = text(input.via_aplicacao);
  if (via && !VIAS_APLICACAO.includes(via)) erros.push('Via de aplicação inválida.');
  const out = {
    medicamento_id: text(input.medicamento_id),
    principio_ativo: text(input.principio_ativo),
    apresentacao: text(input.apresentacao),
    especie: text(input.especie) || 'BOVINO',
    indicacao: text(input.indicacao),
    via_aplicacao: via,
    modo,
    unidade,
    dose_por_unidade: null,
    kg_por_unidade: null,
    faixas: [],
    arredondamento: { modo: 'NENHUM', passo: null },
    dose_minima: num(input.dose_minima),
    dose_maxima: num(input.dose_maxima),
    carencia_carne_dias: intOrNull(input.carencia_carne_dias),
    carencia_leite_dias: intOrNull(input.carencia_leite_dias),
    fonte: text(input.fonte) ? String(input.fonte).toUpperCase() : null,
    fonte_referencia: text(input.fonte_referencia),
    vigencia_inicio: parseCivilDate(input.vigencia_inicio) || null,
    vigencia_fim: parseCivilDate(input.vigencia_fim) || null,
    observacao: text(input.observacao),
  };
  if (!out.medicamento_id) erros.push('Escolha o medicamento.');
  if (modo === 'PROPORCIONAL') {
    out.dose_por_unidade = num(input.dose_por_unidade);
    out.kg_por_unidade = num(input.kg_por_unidade);
    if (!(out.dose_por_unidade > 0)) erros.push('Dose por unidade de peso deve ser maior que zero.');
    if (!(out.kg_por_unidade > 0)) erros.push('Quilos por unidade de dose devem ser maiores que zero.');
  }
  if (modo === 'FAIXAS') {
    const faixas = (Array.isArray(input.faixas) ? input.faixas : []).map((f) => ({ peso_min: num(f.peso_min), peso_max: num(f.peso_max), dose: num(f.dose) }))
      .sort((a, b) => (a.peso_min ?? 0) - (b.peso_min ?? 0));
    if (!faixas.length) erros.push('Informe ao menos uma faixa de peso da bula.');
    faixas.forEach((f, i) => {
      if (!(f.peso_min >= 0) || !(f.peso_max > f.peso_min) || !(f.dose > 0)) erros.push(`Faixa ${i + 1}: peso mínimo < máximo e dose maior que zero.`);
      if (i > 0 && f.peso_min < faixas[i - 1].peso_max) erros.push(`Faixa ${i + 1} se sobrepõe à anterior.`);
    });
    out.faixas = faixas;
  }
  const arredMode = String(input.arredondamento?.modo || input.arredondamento_modo || 'NENHUM').toUpperCase();
  const passo = num(input.arredondamento?.passo ?? input.arredondamento_passo);
  if (!ARREDONDAMENTOS.includes(arredMode)) erros.push('Arredondamento inválido.');
  if (arredMode !== 'NENHUM' && !(passo > 0)) erros.push('Informe o passo do arredondamento (ex.: 0,5).');
  out.arredondamento = { modo: arredMode, passo: arredMode === 'NENHUM' ? null : passo };
  if (out.dose_minima !== null && !(out.dose_minima > 0)) erros.push('Dose mínima deve ser maior que zero.');
  if (out.dose_maxima !== null && !(out.dose_maxima > 0)) erros.push('Dose máxima deve ser maior que zero.');
  if (out.dose_minima !== null && out.dose_maxima !== null && out.dose_minima > out.dose_maxima) erros.push('Dose mínima maior que a máxima.');
  for (const [campo, rotulo] of [['carencia_carne_dias', 'Carência de carne'], ['carencia_leite_dias', 'Carência de leite']]) {
    if (Number.isNaN(out[campo]) || (out[campo] !== null && out[campo] < 0)) { erros.push(`${rotulo}: dias inteiros ≥ 0 (vazio = desconhecida).`); out[campo] = null; }
  }
  if (out.fonte && !FONTES.includes(out.fonte)) erros.push('Fonte inválida.');
  if (out.vigencia_inicio && out.vigencia_fim && out.vigencia_fim < out.vigencia_inicio) erros.push('Fim da vigência antes do início.');
  if (erros.length) throw new PosologyError(erros[0], erros);
  return out;
}

/** O que falta para a posologia poder ser aprovada (e, portanto, calcular dose). */
export function missingForApproval(p) {
  const faltando = [];
  if (!p?.principio_ativo) faltando.push('princípio ativo');
  if (!p?.apresentacao) faltando.push('apresentação');
  if (!p?.indicacao) faltando.push('indicação');
  if (!p?.via_aplicacao) faltando.push('via de aplicação');
  if (!p?.fonte) faltando.push('fonte (bula, receituário ou protocolo)');
  if (!p?.vigencia_inicio) faltando.push('início da vigência');
  if (p?.carencia_carne_dias === null || p?.carencia_carne_dias === undefined) faltando.push('carência de carne (0 se a bula disser zero)');
  if (p?.modo === 'PROPORCIONAL' && !(p.dose_por_unidade > 0 && p.kg_por_unidade > 0)) faltando.push('regra proporcional');
  if (p?.modo === 'FAIXAS' && !(Array.isArray(p.faixas) && p.faixas.length)) faltando.push('tabela de faixas');
  return faltando;
}

export function describeRule(p) {
  if (!p) return '';
  const base = p.modo === 'PROPORCIONAL'
    ? `${fmt(p.dose_por_unidade)} ${p.unidade} a cada ${fmt(p.kg_por_unidade)} kg`
    : `tabela de ${p.faixas.length} faixa(s) de peso`;
  const arr = p.arredondamento?.modo && p.arredondamento.modo !== 'NENHUM' ? `, ${ARREDONDAMENTO_LABELS[p.arredondamento.modo].toLowerCase()} de ${fmt(p.arredondamento.passo)} ${p.unidade}` : '';
  return `${base}${arr}${p.dose_maxima ? `, máx. ${fmt(p.dose_maxima)} ${p.unidade}` : ''}`;
}

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 }));

function roundDose(value, arredondamento) {
  const modo = arredondamento?.modo || 'NENHUM';
  if (modo === 'NENHUM') return Math.round(value * 1000) / 1000;
  const passo = arredondamento.passo;
  const q = value / passo;
  const r = modo === 'ACIMA' ? Math.ceil(q - 1e-9) : modo === 'ABAIXO' ? Math.floor(q + 1e-9) : Math.round(q);
  return Math.round(r * passo * 1000) / 1000;
}

const daysBetween = (from, to) => Math.round((Date.UTC(...to.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) - Date.UTC(...from.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))))) / 86400000);

/**
 * Dose sugerida (F09). `peso`: { kg, data, origem }. Nunca lança: devolve { ok, dose, unidade, regra, avisos,
 * bloqueios }. `ok=false` = não sugerir (o operador pode aplicar dose própria, sem a regra).
 */
export function computeDose(posologia, peso = {}, { dataAplicacao, pesoMaxDias = PESO_MAX_DIAS_PADRAO } = {}) {
  const bloqueios = [];
  const avisos = [];
  if (!posologia) return { ok: false, dose: null, bloqueios: ['Medicamento sem posologia cadastrada: sem dose sugerida.'], avisos };
  if (posologia.status !== POSOLOGIA_STATUS.APROVADA) bloqueios.push(`Posologia ${POSOLOGIA_STATUS_LABELS[posologia.status]?.toLowerCase() || 'não aprovada'}: sem dose sugerida.`);
  const faltando = missingForApproval(posologia);
  if (faltando.length) bloqueios.push(`Posologia incompleta (falta: ${faltando.join(', ')}).`);
  if (dataAplicacao && posologia.vigencia_inicio && dataAplicacao < posologia.vigencia_inicio) bloqueios.push('Posologia ainda não vigente na data da aplicação.');
  if (dataAplicacao && posologia.vigencia_fim && dataAplicacao > posologia.vigencia_fim) bloqueios.push('Posologia vencida na data da aplicação.');
  const kg = num(peso.kg);
  if (!(kg > 0)) bloqueios.push('Sem peso do animal: sem dose sugerida.');
  const origem = String(peso.origem || '').toUpperCase();
  if (kg > 0 && !PESO_ORIGENS_DOSE.includes(origem)) bloqueios.push('Peso estimado ou projetado não calcula dose.');
  if (kg > 0 && peso.data && dataAplicacao) {
    if (peso.data > dataAplicacao) bloqueios.push('Peso de data posterior à aplicação.');
    else {
      const dias = daysBetween(peso.data, dataAplicacao);
      if (dias > pesoMaxDias) avisos.push(`Peso de ${dias} dias atrás: confirme o peso atual.`);
    }
  }
  if (origem === 'INFORMADO') avisos.push('Peso informado (não medido): confira antes de aplicar.');
  if (bloqueios.length) return { ok: false, dose: null, unidade: posologia.unidade, bloqueios, avisos };
  let bruto;
  if (posologia.modo === 'PROPORCIONAL') bruto = (kg / posologia.kg_por_unidade) * posologia.dose_por_unidade;
  else {
    const faixa = posologia.faixas.find((f) => kg >= f.peso_min && kg <= f.peso_max);
    if (!faixa) return { ok: false, dose: null, unidade: posologia.unidade, bloqueios: [`Peso ${fmt(kg)} kg fora das faixas da bula.`], avisos };
    bruto = faixa.dose;
  }
  let dose = roundDose(bruto, posologia.arredondamento);
  if (posologia.dose_maxima && dose > posologia.dose_maxima) { avisos.push(`Dose limitada ao máximo da regra (${fmt(posologia.dose_maxima)} ${posologia.unidade}).`); dose = posologia.dose_maxima; }
  if (posologia.dose_minima && dose < posologia.dose_minima) { avisos.push(`Dose elevada ao mínimo da regra (${fmt(posologia.dose_minima)} ${posologia.unidade}).`); dose = posologia.dose_minima; }
  return { ok: true, dose, unidade: posologia.unidade, via: posologia.via_aplicacao, regra: describeRule(posologia), peso_kg: kg, bloqueios, avisos };
}

const addDays = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Fim da carência (F10) pela data civil: aplicação + dias. Fonte: snapshot da posologia; senão a carência do
 * medicamento (carne). null = desconhecida (nunca vira zero).
 */
export function withdrawalEnd(dataAplicacao, { posologia = null, medicamento = null } = {}) {
  const carne = Number.isInteger(posologia?.carencia_carne_dias) ? posologia.carencia_carne_dias
    : Number.isInteger(medicamento?.carencia_dias) ? medicamento.carencia_dias : null;
  const leite = Number.isInteger(posologia?.carencia_leite_dias) ? posologia.carencia_leite_dias : null;
  return {
    carencia_carne_dias: carne,
    carencia_leite_dias: leite,
    carencia_carne_ate: carne === null ? null : addDays(dataAplicacao, carne),
    carencia_leite_ate: leite === null ? null : addDays(dataAplicacao, leite),
  };
}

/**
 * Janela em que uma aplicação de carência DESCONHECIDA ainda pesa sobre abate/venda (R05). Era 120 dias; há
 * produtos de longa ação para bovinos com carência de carne acima de 120 dias, então a janela passou a 180 dias
 * (margem sobre os mais longos de uso comum). Fora da janela a aplicação continua listada no dossiê do animal.
 */
export const JANELA_CARENCIA_DESCONHECIDA_DIAS = 180;

/**
 * Situação de UMA aplicação na data (R05): ZERO (carência de 0 dia), ABERTA (fim > data), ENCERRADA (fim ≤ data),
 * CANCELADA (cancelada/excluída — não conta), DESCONHECIDA (medicamento sem carência cadastrada: nunca vira zero;
 * inclui registros antigos sem o campo `carencia_conhecida`), SEM_MEDICAMENTO (procedimento sem produto) ou
 * POSTERIOR (aplicada depois da data).
 */
export function withdrawalCase(a, data) {
  if (!a) return null;
  if (a.cancelled_at || a.deleted_at) return 'CANCELADA';
  if (!a.data || a.data > data) return 'POSTERIOR';
  if (a.carencia_carne_ate) {
    if (a.carencia_carne_ate === a.data) return 'ZERO';
    return a.carencia_carne_ate > data ? 'ABERTA' : 'ENCERRADA';
  }
  if (!a.medicamento_id) return 'SEM_MEDICAMENTO';
  return 'DESCONHECIDA';
}

/**
 * Pendências de carência do animal numa data (abate/venda/transferência): aplicações ativas com carência de
 * carne em aberto (fim > data) e aplicações de medicamento com carência DESCONHECIDA nos `janelaDesconhecida`
 * dias anteriores. Devolve também as encerradas, as de carência zero e as canceladas (transparência).
 */
export function withdrawalStatus(aplicacoes = [], data, { janelaDesconhecida = JANELA_CARENCIA_DESCONHECIDA_DIAS } = {}) {
  const abertas = [];
  const desconhecidas = [];
  const encerradas = [];
  const zeradas = [];
  const canceladas = [];
  const inicioJanela = addDays(data, -janelaDesconhecida);
  for (const a of aplicacoes) {
    const caso = withdrawalCase(a, data);
    const resumo = a ? { id: a.id, data: a.data, medicamento: a.medicamento_nome_snapshot || null } : null;
    if (caso === 'ABERTA') abertas.push({ ...resumo, ate: a.carencia_carne_ate });
    else if (caso === 'ENCERRADA') encerradas.push({ ...resumo, ate: a.carencia_carne_ate });
    else if (caso === 'ZERO') zeradas.push(resumo);
    else if (caso === 'CANCELADA') canceladas.push(resumo);
    else if (caso === 'DESCONHECIDA' && a.data >= inicioJanela) desconhecidas.push(resumo);
  }
  const ate = abertas.map((x) => x.ate).sort().at(-1) || null;
  return { emCarencia: abertas.length > 0, ate, abertas, desconhecidas, encerradas, zeradas, canceladas, janelaDesconhecida };
}

/**
 * R05: a liberação técnica só cobre carência DESCONHECIDA quando é documentada — responsável, motivo e a
 * evidência (laudo, bula, receituário) registrada. Aceitar o aviso não basta.
 */
export function releaseCoversUnknown(liberacao) {
  return Boolean(liberacao && String(liberacao.responsavel || '').trim() && String(liberacao.motivo || '').trim() && String(liberacao.evidencia || '').trim());
}

export function validateRelease(input = {}) {
  const erros = [];
  const motivo = text(input.motivo);
  const responsavel = text(input.responsavel);
  if (!motivo || motivo.length < 10) erros.push('Liberação técnica: descreva o motivo (mín. 10 caracteres).');
  if (!responsavel) erros.push('Liberação técnica: informe o responsável técnico (nome e registro).');
  const data = parseCivilDate(input.data);
  if (!data || isFutureCivilDate(data)) erros.push('Liberação técnica: data válida, não futura.');
  if (erros.length) throw new PosologyError(erros[0], erros, 'LIBERACAO_INVALIDA');
  return { motivo, responsavel, evidencia: text(input.evidencia), data };
}
