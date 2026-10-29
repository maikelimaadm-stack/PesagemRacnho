// Serviço das operações de rebanho (F01 Entradas, F02 Saídas, F03 Movimentações) e do inventário (F17).
//
// Autorização no SERVIÇO pela matriz existente, sem ações novas (mesma regra do sanityService): ler com
// weighing.read; rascunho e confirmação com weighing.write; cancelar operação confirmada com weighing.edit.
// Com o módulo de autenticação ativo e sem sessão, recusa; sem provedor de ator (gates em Node) não se aplica.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import { computeInventory } from '../domain/inventory.js';
import {
  OperationError,
  checkConference,
  summarizeOperation,
  trimOrNull,
  validateHeader,
  validateItem,
} from '../domain/operationRules.js';
import * as adapter from '../infrastructure/operationsDataAdapter.js';

export {
  ITEM_STATUS,
  MOTIVO_SAIDA_POR_SUBTIPO,
  OPERACAO_STATUS,
  OPERACAO_TIPOS,
  OperationError,
  PESO_ORIGENS,
  PESO_ORIGEM_LABELS,
  STATUS_LABELS,
  SUBTIPOS,
  SUBTIPOS_PESO_OBRIGATORIO,
  SUBTIPO_LABELS,
  TIPO_LABELS,
  checkConference,
  summarizeOperation,
} from '../domain/operationRules.js';
export { CLASSES_ENTRADA, CLASSES_SAIDA, CLASSE_LABELS } from '../domain/inventory.js';

function requirePermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

export async function listOperations(filters = {}) {
  requirePermission('weighing.read');
  return adapter.listOperations(filters);
}

export async function getOperation(id) {
  requirePermission('weighing.read');
  const found = await adapter.getOperation(id);
  if (!found) return null;
  return { ...found, resumo: summarizeOperation(found.operacao, found.itens), conferencia: checkConference(found.operacao, found.itens) };
}

/**
 * Cria/atualiza o rascunho: { id?, tipo, subtipo, data, ...cabeçalho, itens: [...] }.
 * Valida cabeçalho e cada item antes de gravar (nada parcial).
 */
export async function saveDraft(input = {}) {
  requirePermission('weighing.write');
  const header = validateHeader(input);
  const itensInput = Array.isArray(input.itens) ? input.itens : [];
  const erros = [];
  const itens = [];
  itensInput.forEach((raw, index) => {
    try {
      itens.push({ ...validateItem(header, raw, { posicao: index + 1 }), causa_morte_id: header.subtipo === 'MORTE' ? trimOrNull(raw.causa_morte_id) : null });
    } catch (err) {
      if (err instanceof OperationError) erros.push(...(err.erros || [err.message]));
      else throw err;
    }
  });
  if (erros.length) throw new OperationError('OPERACAO_INVALIDA', erros[0], { erros });
  const salvo = await adapter.saveDraft({ id: input.id || null, header, itens, empresaId: input.empresa_id || adapter.DEFAULT_EMPRESA_ID });
  return { ...salvo, resumo: summarizeOperation(salvo.operacao, salvo.itens), conferencia: checkConference(salvo.operacao, salvo.itens) };
}

export async function discardDraft(id) {
  requirePermission('weighing.write');
  return adapter.discardDraft(id);
}

/** Confirma: bloqueios impedem; avisos (quantidade, sem peso, sem identificação) exigem aceitarAvisos. */
export async function confirmOperation(id, { aceitarAvisos = false } = {}) {
  const actor = requirePermission('weighing.write');
  return adapter.confirmOperation(id, { aceitarAvisos, operador: actor?.nome || actor?.login || null });
}

/** Cancela operação confirmada com motivo obrigatório (fato cancelado, nunca apagado). */
export async function cancelOperation(id, { motivo } = {}) {
  requirePermission('weighing.edit');
  const texto = trimOrNull(motivo);
  if (!texto || texto.length < 3) throw new OperationError('OPERACAO_INVALIDA', 'Informe o motivo do cancelamento.');
  return adapter.cancelOperation(id, { motivo: texto });
}

/**
 * Inventário conciliado do período (F17): { from, to, filtros: { sexo, raca_id, categoria_id, marca_id,
 * lote_id, propriedade_id } }.
 */
export async function getInventory({ from, to, filtros = {} } = {}) {
  requirePermission('weighing.read');
  const fontes = await adapter.loadInventorySources();
  return computeInventory(fontes, { from, to, filtros });
}
