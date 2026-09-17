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
