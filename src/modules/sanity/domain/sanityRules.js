// Regras puras da sanidade mínima operacional (ADR-049). Sem Dexie e sem sessão:
// enumerações, validação de programas, medicamentos e aplicações e a montagem do
// registro de aplicação (fato histórico com snapshot dos nomes). Fora do escopo:
// estoque, compras, prescrição, calendário e cálculo de dose por peso.
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from '../../weighing/domain/brazilianValues.js';

export const PROGRAMA_TIPOS = Object.freeze(['VACINACAO', 'VERMIFUGACAO', 'TRATAMENTO', 'PREVENTIVO', 'OUTRO']);
export const PROGRAMA_TIPO_LABELS = Object.freeze({
  VACINACAO: 'Vacinação',
  VERMIFUGACAO: 'Vermifugação',
  TRATAMENTO: 'Tratamento',
  PREVENTIVO: 'Preventivo',
  OUTRO: 'Outro',
});
export const VIAS_APLICACAO = Object.freeze(['SC', 'IM', 'IV', 'ORAL', 'POUR_ON', 'TOPICA', 'INTRANASAL', 'OUTRA']);
export const VIA_LABELS = Object.freeze({
  SC: 'Subcutânea (SC)',
  IM: 'Intramuscular (IM)',
  IV: 'Intravenosa (IV)',
  ORAL: 'Oral',
  POUR_ON: 'Pour-on',
  TOPICA: 'Tópica',
  INTRANASAL: 'Intranasal',
  OUTRA: 'Outra',
});
export const UNIDADES_DOSE = Object.freeze(['ml', 'mg', 'g', 'dose', 'comprimido', 'UI']);

// Ações da auditoria (store `auditoria`, entidade = nome da store).
export const SANITY_AUDIT_ACTIONS = Object.freeze({
  CRIAR_PROGRAMA: 'CRIAR_PROGRAMA_SANIDADE',
  EDITAR_PROGRAMA: 'EDITAR_PROGRAMA_SANIDADE',
  INATIVAR_PROGRAMA: 'INATIVAR_PROGRAMA_SANIDADE',
  REATIVAR_PROGRAMA: 'REATIVAR_PROGRAMA_SANIDADE',
  CRIAR_MEDICAMENTO: 'CRIAR_MEDICAMENTO',
  EDITAR_MEDICAMENTO: 'EDITAR_MEDICAMENTO',
  INATIVAR_MEDICAMENTO: 'INATIVAR_MEDICAMENTO',
  REATIVAR_MEDICAMENTO: 'REATIVAR_MEDICAMENTO',
  CRIAR_APLICACAO: 'CRIAR_APLICACAO_SANIDADE',
  CANCELAR_APLICACAO: 'CANCELAR_APLICACAO_SANIDADE',
});

// Motivo gravado quando a pesagem que originou a aplicação é cancelada.
export const MOTIVO_PESAGEM_CANCELADA = 'pesagem cancelada';

const MAX_NOME = 120;
const MAX_TEXTO_CURTO = 120;
const MAX_DOSE_PADRAO = 60;
const MAX_TEXTO_LONGO = 1000;
const ISO_CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SanityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SanityError';
    this.code = code;
    Object.assign(this, details);
  }
}

function invalid(erros) {
  const lista = Array.isArray(erros) ? erros : [erros];
  return new SanityError('SANITY_INVALID', lista.join(' '), { erros: lista });
}

/** Nome exibido: trim e espaços internos únicos; vazio → null. */
export function cleanName(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text || null;
}

/** Texto livre (observação, descrição): só trim, preserva quebras; vazio → null. */
export function trimOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function cleanId(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function checkLength(erros, value, max, label) {
  if (value && value.length > max) erros.push(`${label}: máximo de ${max} caracteres.`);
}

// Enum por chave (sem diferenciar maiúsculas; "pour-on" → POUR_ON) ou pelo rótulo exibido.
function matchEnum(value, keys, labels = null) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const asKey = text.toLocaleUpperCase('pt-BR').replace(/[\s-]+/g, '_');
  const byKey = keys.find((key) => key.toLocaleUpperCase('pt-BR') === asKey);
  if (byKey) return byKey;
  if (!labels) return null;
  const lower = text.toLocaleLowerCase('pt-BR');
  return keys.find((key) => String(labels[key]).toLocaleLowerCase('pt-BR') === lower) || null;
}

// Inteiro opcional: vazio → { ok, value: null }; "30" ou 30 → 30; resto → inválido.
function optionalInteger(value, { min = null } = {}) {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) return { ok: false, value: null };
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || (min !== null && parsed < min)) return { ok: false, value: null };
  return { ok: true, value: parsed };
}

/** Dose aplicada: vazia → null; número (ou texto "10", "1,5") maior que zero; resto → inválida. */
export function parseDose(value) {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const parsed = typeof value === 'number' ? value : parseBrazilianNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return { ok: false, value: null };
  return { ok: true, value: parsed };
}

/**
 * Sugestão numérica da dose padrão: número > 0 quando `dose_padrao` é só um número
 * ("10", "10,5"); texto de referência ("1 ml / 50 kg") → null e fica apenas como
 * sugestão exibida. Nunca calcula dose por peso.
 */
export function suggestedDose(medicamento) {
  const raw = medicamento?.dose_padrao;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;
  const text = String(raw ?? '').trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
  const parsed = parseBrazilianNumber(text);
  return parsed !== null && parsed > 0 ? parsed : null;
}

/** Campos de um programa de sanidade (sem nome_normalizado/ativo, que o adapter define). */
export function validateProgramInput(input = {}) {
  const erros = [];
  const nome = cleanName(input.nome);
  if (!nome) erros.push('Nome do programa é obrigatório.');
  checkLength(erros, nome, MAX_NOME, 'Nome do programa');
  const tipo = matchEnum(input.tipo, PROGRAMA_TIPOS, PROGRAMA_TIPO_LABELS);
  if (!tipo) erros.push(`Tipo do programa inválido. Use: ${PROGRAMA_TIPOS.map((key) => PROGRAMA_TIPO_LABELS[key]).join(', ')}.`);
  const descricao = trimOrNull(input.descricao);
  checkLength(erros, descricao, MAX_TEXTO_LONGO, 'Descrição');
  const ordem = optionalInteger(input.ordem, { min: 0 });
  if (!ordem.ok) erros.push('Ordem deve ser um número inteiro maior ou igual a zero.');
  if (erros.length) throw invalid(erros);
  return { nome, tipo, descricao, ordem: ordem.value };
}

/** Campos de um medicamento (dose_padrao é texto livre de referência). */
export function validateMedicamentoInput(input = {}) {
  const erros = [];
  const nome = cleanName(input.nome);
  if (!nome) erros.push('Nome do medicamento é obrigatório.');
  checkLength(erros, nome, MAX_NOME, 'Nome do medicamento');
  const principioAtivo = cleanName(input.principio_ativo);
  checkLength(erros, principioAtivo, MAX_TEXTO_CURTO, 'Princípio ativo');
  const fabricante = cleanName(input.fabricante);
  checkLength(erros, fabricante, MAX_TEXTO_CURTO, 'Fabricante');
  let unidadePadrao = null;
  if (trimOrNull(input.unidade_padrao)) {
    unidadePadrao = matchEnum(input.unidade_padrao, UNIDADES_DOSE);
    if (!unidadePadrao) erros.push(`Unidade padrão inválida. Use: ${UNIDADES_DOSE.join(', ')}.`);
  }
  const dosePadrao = trimOrNull(input.dose_padrao);
  checkLength(erros, dosePadrao, MAX_DOSE_PADRAO, 'Dose padrão');
  let via = null;
  if (trimOrNull(input.via_aplicacao)) {
    via = matchEnum(input.via_aplicacao, VIAS_APLICACAO, VIA_LABELS);
    if (!via) erros.push(`Via de aplicação inválida. Use: ${VIAS_APLICACAO.map((key) => VIA_LABELS[key]).join(', ')}.`);
  }
  const carencia = optionalInteger(input.carencia_dias, { min: 0 });
  if (!carencia.ok) erros.push('Carência deve ser um número inteiro de dias maior ou igual a zero.');
  const observacao = trimOrNull(input.observacao);
  checkLength(erros, observacao, MAX_TEXTO_LONGO, 'Observação');
  if (erros.length) throw invalid(erros);
  return {
    nome,
    principio_ativo: principioAtivo,
    fabricante,
    unidade_padrao: unidadePadrao,
    dose_padrao: dosePadrao,
    via_aplicacao: via,
    carencia_dias: carencia.value,
    observacao,
  };
}

/**
 * Validação pura de uma aplicação. Lança SanityError (code SANITY_INVALID) com a
 * mensagem em pt-BR; devolve a entrada normalizada. Exige programa OU
 * medicamento; dose null ou número > 0; data AAAA-MM-DD válida e não futura.
 * `requireAnimal: false` no Lançamento, onde o animal vem da própria pesagem.
 */
export function validateApplicationInput(input = {}, { requireAnimal = true, today = new Date() } = {}) {
  const erros = [];
  const source = input || {};
  const animalId = cleanId(source.animal_id ?? source.animalId);
  if (requireAnimal && !animalId) erros.push('Animal é obrigatório.');
  const data = String(source.data ?? '').trim();
  if (!data) erros.push('Data da aplicação é obrigatória.');
  else if (!ISO_CIVIL_DATE.test(data) || !parseCivilDate(data)) erros.push('Data da aplicação inválida (use AAAA-MM-DD).');
  else if (isFutureCivilDate(data, today)) erros.push('A data da aplicação não pode estar no futuro.');
  const programaId = cleanId(source.programa_sanidade_id);
  const medicamentoId = cleanId(source.medicamento_id);
  if (!programaId && !medicamentoId) erros.push('Informe o programa de sanidade ou o medicamento.');
  const dose = parseDose(source.dose);
  if (!dose.ok) erros.push('Dose deve ser numérica e maior que zero.');
  let unidade = null;
  if (trimOrNull(source.unidade)) {
    unidade = matchEnum(source.unidade, UNIDADES_DOSE);
    if (!unidade) erros.push(`Unidade da dose inválida. Use: ${UNIDADES_DOSE.join(', ')}.`);
  }
  let via = null;
  if (trimOrNull(source.via_aplicacao)) {
    via = matchEnum(source.via_aplicacao, VIAS_APLICACAO, VIA_LABELS);
    if (!via) erros.push(`Via de aplicação inválida. Use: ${VIAS_APLICACAO.map((key) => VIA_LABELS[key]).join(', ')}.`);
  }
  const observacao = trimOrNull(source.observacao);
  checkLength(erros, observacao, MAX_TEXTO_LONGO, 'Observação');
  if (erros.length) throw invalid(erros);
  return {
    animal_id: animalId,
    data,
    programa_sanidade_id: programaId,
    medicamento_id: medicamentoId,
    dose: dose.value,
    unidade,
    via_aplicacao: via,
    observacao,
    sessao_id: cleanId(source.sessao_id),
  };
}

/**
 * Aplicações informadas no Lançamento (payload.aplicacoes_sanidade, 0..N). A data
 * é sempre a da pesagem; animal, sessão e pesagem vêm da própria pesagem. Lista
 * ausente → []; qualquer item inválido lança (nada é gravado).
 */
export function validateLaunchApplications(list, { data, today = new Date() } = {}) {
  if (list === null || list === undefined) return [];
  if (!Array.isArray(list)) throw invalid('As aplicações de sanidade do lançamento devem ser uma lista.');
  return list.map((item, index) => {
    try {
      const normalized = validateApplicationInput({ ...(item || {}), data, animal_id: null, sessao_id: null }, { requireAnimal: false, today });
      return { ...normalized, animal_id: null, sessao_id: null };
    } catch (err) {
      if (!(err instanceof SanityError)) throw err;
      const erros = (err.erros || [err.message]).map((erro) => `Aplicação ${index + 1}: ${erro}`);
      throw invalid(erros);
    }
  });
}

/**
 * Registro gravado em `aplicacoesSanidade`. Snapshot dos nomes no momento do fato;
 * unidade e via omitidas herdam o padrão do medicamento (unidade só quando há dose).
 */
export function buildApplicationRecord({ id, input, programa = null, medicamento = null, empresaId, actor, ts, pesagemId = null, sessaoId = null }) {
  return {
    id,
    empresa_id: empresaId,
    animal_id: input.animal_id,
    programa_sanidade_id: input.programa_sanidade_id || null,
    medicamento_id: input.medicamento_id || null,
    programa_nome_snapshot: programa?.nome ?? null,
    medicamento_nome_snapshot: medicamento?.nome ?? null,
    data: input.data,
    dose: input.dose ?? null,
    unidade: input.unidade ?? (input.dose != null ? medicamento?.unidade_padrao ?? null : null),
    via_aplicacao: input.via_aplicacao ?? medicamento?.via_aplicacao ?? null,
    observacao: input.observacao ?? null,
    sessao_id: sessaoId ?? input.sessao_id ?? null,
    pesagem_id: pesagemId ?? null,
    created_by: actor?.usuario_id ?? null,
    created_by_nome: actor?.usuario_nome_snapshot ?? null,
    created_at: ts,
    updated_at: ts,
    cancelled_at: null,
    motivo_cancelamento: null,
    deleted_at: null,
  };
}
