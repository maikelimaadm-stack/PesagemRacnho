// Serviço do perfil do animal (F04/F05: nascimento, idade, era, categoria produtiva, dentição), do estoque de
// identificadores (F06) e do dossiê de rastreabilidade (F15). Autorização no serviço pela matriz existente:
//   ler: animal.read; dentição e aplicar/substituir identificador: weighing.write; corrigir nascimento e
//   categoria produtiva: weighing.edit; receber/devolver/bloquear/liberar estoque: registry.write;
//   parametrização de idade: settings.manage.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import { AgeError, ageAt, categoriaProdutiva, eraAt, validateBirthInput, validateDentition } from '../domain/ageModel.js';
import { ACOES, IdentifierError, TIPOS_IDENTIFICADOR, expandRange, physicalCount, stockSummary } from '../domain/identifierStock.js';
import { buildDossier, dossierRows } from '../domain/traceability.js';
import * as adapter from '../infrastructure/animalProfileDataAdapter.js';

export * from '../domain/ageModel.js';
export {
  ACAO_LABELS,
  SITUACAO_LABELS,
  TIPOS_IDENTIFICADOR,
  TIPO_IDENTIFICADOR_LABELS,
  IdentifierError,
  physicalCount,
  stockSummary,
} from '../domain/identifierStock.js';
export { AVISO_DOSSIE, dossierRows } from '../domain/traceability.js';

function requirePermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getAgePolicy() {
  requirePermission('animal.read');
  return adapter.getAgePolicy();
}

export async function saveAgePolicy(input) {
  requirePermission('settings.manage');
  return adapter.saveAgePolicy(input);
}

/** Idade, era e categoria produtiva do animal numa data (padrão: hoje). */
export async function describeAge(animal, { em = today() } = {}) {
  const policy = await adapter.getAgePolicy();
  return { idade: ageAt(animal, em), era: eraAt(animal, em, policy), categoria: categoriaProdutiva(animal, em, policy), policy };
}

export async function updateBirth(animalId, input) {
  requirePermission('weighing.edit');
  return adapter.updateBirth(animalId, validateBirthInput(input));
}

export async function setProductiveCategory(animalId, categoria) {
  requirePermission('weighing.edit');
  const valor = categoria ? String(categoria).trim().slice(0, 60) || null : null;
  return adapter.setProductiveCategory(animalId, valor);
}

export async function addDentition(animalId, input) {
  requirePermission('weighing.write');
  return adapter.addDentition(animalId, validateDentition(input));
}

export async function cancelDentition(id, { motivo } = {}) {
  requirePermission('weighing.edit');
  if (!motivo || String(motivo).trim().length < 3) throw new AgeError('Informe o motivo do cancelamento.');
  return adapter.cancelDentition(id, { motivo: String(motivo).trim() });
}

export async function listDentitions(animalId) {
  requirePermission('animal.read');
  return adapter.listDentitions(animalId);
}

// ---------------------------------------------------------------------------
// Identificadores
// ---------------------------------------------------------------------------

/** Recebe por faixa ({ prefixo, inicio, fim }) ou lista de códigos. */
export async function receiveIdentifiers({ tipo, faixa = null, codigos = null, data, fornecedor = null, descricao = null }) {
  requirePermission('registry.write');
  const t = String(tipo || '').toUpperCase();
  if (!TIPOS_IDENTIFICADOR.includes(t)) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Tipo de identificador inválido.');
  if (!data) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Informe a data do recebimento.');
  const lista = faixa ? expandRange(faixa) : (codigos || []).map((c) => String(c).trim()).filter(Boolean);
  if (!lista.length) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Nenhum código para receber.');
  return adapter.receiveIdentifiers({ tipo: t, codigos: lista, data, fornecedor, descricao, faixa });
}

const ACOES_ESTOQUE_GESTOR = new Set(['DEVOLVIDO', 'BLOQUEADO', 'LIBERADO']);
export async function stockAction({ tipo, valor, acao, data, observacao }) {
  const a = String(acao || '').toUpperCase();
  if (!ACOES.includes(a) || ['RECEBIDO', 'APLICADO'].includes(a)) throw new IdentifierError('IDENTIFICADOR_ACAO', 'Ação inválida para o estoque.');
  requirePermission(ACOES_ESTOQUE_GESTOR.has(a) ? 'registry.write' : 'weighing.write');
  if (!data) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Informe a data.');
  return adapter.stockAction({ tipo: String(tipo).toUpperCase(), valor, acao: a, data, observacao });
}

export async function applyIdentifier(input) {
  requirePermission('weighing.write');
  if (!input?.data) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Informe a data da aplicação.');
  return adapter.applyIdentifier({ ...input, tipo: String(input.tipo || '').toUpperCase() });
}

export async function substituteIdentifier(input) {
  requirePermission('weighing.write');
  if (!input?.data) throw new IdentifierError('IDENTIFICADOR_INVALIDO', 'Informe a data da troca.');
  return adapter.substituteIdentifier({ ...input, tipo: String(input.tipo || '').toUpperCase(), motivo: String(input.motivo || '').toUpperCase() });
}

export async function listStock(filters = {}) {
  requirePermission('animal.read');
  const codigos = await adapter.listStock(filters);
  return { codigos, resumo: stockSummary(codigos) };
}

export async function identifierHistory(tipo, valor) {
  requirePermission('animal.read');
  return adapter.identifierHistory(tipo, valor);
}

/** Conferência física: { tipo, contados: [códigos] } — só compara, não ajusta. */
export async function physicalStockCount({ tipo, contados = [] }) {
  requirePermission('animal.read');
  const { codigos } = await listStock({ tipo: String(tipo).toUpperCase() });
  return physicalCount(codigos, contados);
}

// ---------------------------------------------------------------------------
// Dossiê
// ---------------------------------------------------------------------------

export async function getTraceabilityDossier(animalId, { hoje = today() } = {}) {
  requirePermission('animal.read');
  const src = await adapter.loadTraceabilitySources(animalId);
  if (!src) return null;
  return buildDossier(src, { hoje, policy: await adapter.getAgePolicy() });
}

export { dossierRows as traceabilityRows };
