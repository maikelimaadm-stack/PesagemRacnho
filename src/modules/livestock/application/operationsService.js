// Serviço das operações de rebanho (F01 Entradas, F02 Saídas, F03 Movimentações) e do inventário (F17).
//
// Autorização no SERVIÇO pela matriz existente, sem ações novas (mesma regra do sanityService): ler com
// weighing.read; rascunho e confirmação com weighing.write; cancelar operação confirmada com weighing.edit.
// Com o módulo de autenticação ativo e sem sessão, recusa; sem provedor de ator (gates em Node) não se aplica.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import { computeInventory } from '../domain/inventory.js';
import {
  MOTIVO_SAIDA_POR_SUBTIPO as MOTIVO_SAIDA_POR_SUBTIPO_LOCAL,
  OperationError,
  checkConference,
  summarizeOperation,
  trimOrNull,
  validateHeader,
  validateItem,
} from '../domain/operationRules.js';
import * as adapter from '../infrastructure/operationsDataAdapter.js';
import { validateRelease } from '../../sanity/domain/posology.js';
import { prepareLaunchEntry } from '../../weighing/application/weighingService.js';

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

const OPERACAO_TIPOS_LANCAMENTO = Object.freeze({ ENTRADA: 'ENTRADA', SAIDA: 'SAIDA' });

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

/**
 * Liberação técnica de carência para ABATE (F10): só GESTOR/ADMIN (registry.write), com responsável técnico,
 * motivo e evidência. Fica na operação e na auditoria; sem ela o abate de animal em carência é bloqueado.
 */
export async function registerWithdrawalRelease(id, input = {}) {
  const actor = requirePermission('registry.write');
  return adapter.registerWithdrawalRelease(id, { ...validateRelease(input), registrado_por: actor?.nome || null });
}

/**
 * Entrada ou Saída de UM animal feita no Lançamento de Pesagens. Mesmas regras das telas Rebanho › Entradas/Saídas
 * (validateHeader/validateItem, conferência, carência) e o payload da tela passa pelas regras do createEntry
 * (permissão, valores comerciais, aplicações de sanidade). Grava operação, item, animal, movimento, pesagem e
 * aplicações numa só transação; `id` (ciclo do Lançamento) torna a chamada idempotente.
 * input: { id, tipo, subtipo, data, gta_numero, nf_numero, observacao, item: {...}, pesagem: payload da tela,
 *          aceitarAvisos }
 */
export async function registerLaunchOperation(input = {}) {
  const actor = requirePermission('weighing.write');
  const header = validateHeader(input);
  if (![OPERACAO_TIPOS_LANCAMENTO.ENTRADA, OPERACAO_TIPOS_LANCAMENTO.SAIDA].includes(header.tipo)) {
    throw new OperationError('OPERACAO_INVALIDA', 'O Lançamento registra Entradas e Saídas.');
  }
  const raw = input.item || {};
  const item = { ...validateItem(header, raw, { posicao: 1 }), causa_morte_id: header.subtipo === 'MORTE' ? trimOrNull(raw.causa_morte_id) : null };
  // Entrada sem peso não gera pesagem; a Saída sempre gera (com ou sem peso, como em Rebanho › Saídas).
  const semPesagem = header.tipo === OPERACAO_TIPOS_LANCAMENTO.ENTRADA && item.peso_kg === null;
  // Tipo, motivo, data e peso da pesagem são os da operação (uma só verdade para a tela, o livro e a pesagem).
  const pesagem = {
    ...(input.pesagem || {}),
    tipo_manejo: header.tipo === OPERACAO_TIPOS_LANCAMENTO.ENTRADA ? 'Cadastro' : 'Saída',
    motivo_saida: header.tipo === OPERACAO_TIPOS_LANCAMENTO.SAIDA ? MOTIVO_SAIDA_POR_SUBTIPO_LOCAL[header.subtipo] : null,
    data_pesagem: header.data,
    peso: item.peso_kg,
  };
  const { uiPayload, aplicacoesSanidade, valoresPermitidos } = prepareLaunchEntry(pesagem, { semPesagem });
  if (!valoresPermitidos) {
    item.valor = null;
    header.valor_total = null;
    header.frete = null;
  }
  return adapter.registerLaunchOperation({
    id: trimOrNull(input.id),
    header,
    item,
    launch: { ui: uiPayload, aplicacoesSanidade, entryId: trimOrNull(input.id) },
    aceitarAvisos: input.aceitarAvisos === true,
    operador: actor?.nome || actor?.login || null,
    empresaId: input.empresa_id || adapter.DEFAULT_EMPRESA_ID,
  });
}

/** Animal que entrou sem peso com este número/marca (a Entrada no Lançamento vira a 1ª pesagem dele). */
export async function findPendingEntryAnimal({ numero, marcaId = null } = {}) {
  requirePermission('weighing.read');
  return adapter.findPendingEntryAnimal({ numero, marcaId });
}

/** Animais que entraram sem peso com esta identificação (para o Manejo orientar a 1ª pesagem pela Entrada). */
export async function listPendingEntryAnimalsByNumber(numero) {
  requirePermission('weighing.read');
  return adapter.listPendingEntryAnimalsByNumber(numero);
}

/** Operação de origem de uma pesagem (para editar/excluir no Lançamento sem descasar o livro). */
export async function findOperationOfEntry(pesagemId) {
  requirePermission('weighing.read');
  return adapter.findOperationOfEntry(pesagemId);
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
