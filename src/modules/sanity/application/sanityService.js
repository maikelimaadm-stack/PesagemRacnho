// Serviço da sanidade mínima operacional (ADR-049): cadastros de programas e
// medicamentos e aplicações por animal (avulsas ou registradas no Lançamento).
// Stores próprias da v8 — nunca appSettings. Fora do escopo: estoque, compras,
// prescrição, calendário, diagnóstico, prontuário, financeiro e fiscal.
//
// Autorização no SERVIÇO pela matriz existente, sem ações novas: cadastros com
// registry.write (leitura registry.read); aplicações com weighing.write para
// registrar, weighing.edit para cancelar e weighing.read para ler. Mesma falha
// fechada de weighingService.requireWeighingPermission: com o módulo de
// autenticação ativo e sem sessão, recusa; sem provedor de ator (gates em Node,
// migração) a verificação não se aplica.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import {
  SanityError,
  trimOrNull,
  validateApplicationInput,
  validateMedicamentoInput,
  validateProgramInput,
} from '../domain/sanityRules.js';
import * as adapter from '../infrastructure/sanityDataAdapter.js';
import * as posologyAdapter from '../infrastructure/posologyDataAdapter.js';
import { PosologyError, computeDose, validatePosologyInput, validateWithdrawalClarification, withdrawalStatus } from '../domain/posology.js';

export {
  MOTIVO_PESAGEM_CANCELADA,
  PROGRAMA_TIPOS,
  PROGRAMA_TIPO_LABELS,
  SANITY_AUDIT_ACTIONS,
  SanityError,
  UNIDADES_DOSE,
  VIAS_APLICACAO,
  VIA_LABELS,
  suggestedDose,
  validateApplicationInput,
} from '../domain/sanityRules.js';
export {
  ARREDONDAMENTOS,
  ARREDONDAMENTO_LABELS,
  FONTES as POSOLOGIA_FONTES,
  FONTE_LABELS as POSOLOGIA_FONTE_LABELS,
  MODOS as POSOLOGIA_MODOS,
  POSOLOGIA_STATUS,
  POSOLOGIA_STATUS_LABELS,
  PosologyError,
  computeDose,
  describeRule,
  missingForApproval,
  withdrawalStatus,
} from '../domain/posology.js';

function requireSanityPermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

const empresaOf = (input) => input?.empresa_id ?? input?.empresaId ?? adapter.DEFAULT_EMPRESA_ID;

function requireId(id, rotulo) {
  if (id === null || id === undefined || String(id).trim() === '') {
    throw new SanityError('SANITY_INVALID', `${rotulo}: identificador obrigatório.`, { erros: [`${rotulo}: identificador obrigatório.`] });
  }
  return String(id);
}

// ---------------------------------------------------------------------------
// Programas de sanidade
// ---------------------------------------------------------------------------

/** Ordenados por ordem e nome. Inativos só com includeInactive. */
export async function listProgramas({ includeInactive = false, empresaId = adapter.DEFAULT_EMPRESA_ID } = {}) {
  requireSanityPermission('registry.read');
  return adapter.listRegistry(adapter.PROGRAMAS_STORE, { includeInactive, empresaId });
}

/** Cria (sem id) ou edita (com id). Nome único entre os ativos da empresa. */
export async function saveProgram(input = {}) {
  requireSanityPermission('registry.write');
  const fields = validateProgramInput(input);
  return adapter.saveRegistry(adapter.PROGRAMAS_STORE, { id: input?.id || null, fields, empresaId: empresaOf(input) });
}

export async function setProgramActive(id, ativo) {
  requireSanityPermission('registry.write');
  return adapter.setRegistryActive(adapter.PROGRAMAS_STORE, requireId(id, 'Programa de sanidade'), Boolean(ativo));
}

// ---------------------------------------------------------------------------
// Medicamentos
// ---------------------------------------------------------------------------

export async function listMedicamentos({ includeInactive = false, empresaId = adapter.DEFAULT_EMPRESA_ID } = {}) {
  requireSanityPermission('registry.read');
  return adapter.listRegistry(adapter.MEDICAMENTOS_STORE, { includeInactive, empresaId });
}

/** dose_padrao é texto livre de referência; carencia_dias inteiro >= 0 ou null. */
export async function saveMedicamento(input = {}) {
  requireSanityPermission('registry.write');
  const fields = validateMedicamentoInput(input);
  return adapter.saveRegistry(adapter.MEDICAMENTOS_STORE, { id: input?.id || null, fields, empresaId: empresaOf(input) });
}

export async function setMedicamentoActive(id, ativo) {
  requireSanityPermission('registry.write');
  return adapter.setRegistryActive(adapter.MEDICAMENTOS_STORE, requireId(id, 'Medicamento'), Boolean(ativo));
}

// ---------------------------------------------------------------------------
// Aplicações
// ---------------------------------------------------------------------------

/**
 * Aplicação avulsa (sem pesagem): { animal_id, data, programa_sanidade_id?,
 * medicamento_id?, dose?, unidade?, via_aplicacao?, observacao?, sessao_id? }.
 * Aplicações do Lançamento entram por weighingService.createEntry
 * (payload.aplicacoes_sanidade), na mesma transação da pesagem.
 */
export async function registerApplication(input = {}) {
  requireSanityPermission('weighing.write');
  const normalized = validateApplicationInput(input);
  return adapter.insertApplication(normalized, { empresaId: empresaOf(input) });
}

/** Grava cancelled_at + motivo_cancelamento; o fato nunca é apagado. */
export async function cancelApplication(id, { motivo } = {}) {
  requireSanityPermission('weighing.edit');
  return adapter.cancelApplication(requireId(id, 'Aplicação de sanidade'), { motivo: trimOrNull(motivo) });
}

/**
 * R2-03: esclarece a carência DESCONHECIDA de uma aplicação com prazo, fonte (bula/receituário/laudo) e responsável
 * técnico — é o caminho para regularizar tratamentos antigos sem liberar por decurso de tempo. Auditado.
 */
export async function clarifyWithdrawal(id, input = {}) {
  requireSanityPermission('weighing.edit');
  return adapter.clarifyWithdrawal(requireId(id, 'Aplicação de sanidade'), validateWithdrawalClarification(input));
}

/** Filtros por animal, período (from/to AAAA-MM-DD), programa e medicamento; canceladas só com includeCancelled. */
export async function listApplications({ animalId, from, to, programaId, medicamentoId, includeCancelled = false, empresaId = adapter.DEFAULT_EMPRESA_ID } = {}) {
  requireSanityPermission('weighing.read');
  return adapter.listApplications({
    animalId: animalId || null,
    from: from || null,
    to: to || null,
    programaId: programaId || null,
    medicamentoId: medicamentoId || null,
    includeCancelled: includeCancelled === true,
    empresaId,
  });
}

// ---------------------------------------------------------------------------
// Posologia (F08), dose sugerida (F09) e carência (F10)
// ---------------------------------------------------------------------------

export async function listPosologies(filters = {}) {
  requireSanityPermission('registry.read');
  return posologyAdapter.listPosologies(filters);
}

/** Rascunho (novo ou edição). Aprovada é imutável: mudança = nova versão. */
export async function savePosologyDraft(input = {}) {
  requireSanityPermission('registry.write');
  return posologyAdapter.saveDraft({ id: input.id || null, fields: validatePosologyInput(input) });
}

/** Aprovação exige responsável técnico (nome e registro) e regra completa. */
export async function approvePosology(id, { responsavel } = {}) {
  requireSanityPermission('registry.write');
  const nome = trimOrNull(responsavel);
  if (!nome || nome.length < 5) throw new PosologyError('Informe o responsável técnico pela aprovação (nome e registro).');
  return posologyAdapter.approve(requireId(id, 'Posologia'), { responsavel: nome });
}

export async function suspendPosology(id, { motivo } = {}) {
  requireSanityPermission('registry.write');
  const texto = trimOrNull(motivo);
  if (!texto || texto.length < 5) throw new PosologyError('Informe o motivo da suspensão.');
  return posologyAdapter.suspend(requireId(id, 'Posologia'), { motivo: texto });
}

/**
 * Dose sugerida para { medicamentoId, peso: { kg, data, origem }, dataAplicacao }. Sem posologia aprovada
 * vigente, ou com peso inadequado, devolve ok=false com o motivo (o operador aplica a própria dose).
 */
export async function getDoseSuggestion({ medicamentoId, peso, dataAplicacao } = {}) {
  requireSanityPermission('weighing.read');
  const posologia = await posologyAdapter.activePosology(medicamentoId, dataAplicacao);
  return { posologia, ...computeDose(posologia, peso, { dataAplicacao }) };
}

/** Carência dos animais numa data: { [animal_id]: { emCarencia, ate, abertas, desconhecidas } }. */
export async function getWithdrawalStatus(animalIds = [], data) {
  requireSanityPermission('weighing.read');
  const aplicacoes = await posologyAdapter.applicationsOf(animalIds);
  const out = {};
  for (const id of animalIds) out[id] = withdrawalStatus(aplicacoes.filter((a) => a.animal_id === id), data);
  return out;
}
