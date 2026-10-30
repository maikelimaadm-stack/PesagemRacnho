// Serviço de documentos e anexos (F16). Ler: weighing.read; cadastrar/anexar: weighing.write; cancelar:
// weighing.edit (a mesma matriz das operações). O arquivo é escolhido no diálogo nativo do Electron e copiado
// para a pasta de anexos; aqui só chegam SHA-256, extensão, tamanho e nome.
import { getCurrentActor, hasActorProvider } from '../../../storage/indexedDb/auditActor.js';
import { authorize, forbiddenError } from '../../auth/domain/permissionService.js';
import { DocumentError, attachmentObjects, validateDocumentInput } from '../domain/documentRules.js';
import * as adapter from '../infrastructure/documentsDataAdapter.js';

export { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_LABELS, DocumentError, attachmentObjects } from '../domain/documentRules.js';

function requirePermission(action) {
  const actor = getCurrentActor();
  if (actor) {
    authorize(actor.role, action);
    return actor;
  }
  if (hasActorProvider()) throw forbiddenError(null, action);
  return null;
}

const port = () => (typeof window !== 'undefined' ? window.pesagemApp?.attachments ?? null : null);
const unwrap = (r) => {
  if (r?.ok === false) throw Object.assign(new Error(r.error?.message || 'Falha no anexo.'), { code: r.error?.code });
  return r?.data ?? r;
};

export async function listDocuments(filters = {}) {
  requirePermission('weighing.read');
  return adapter.listDocuments(filters);
}

/** Abre o diálogo nativo e guarda o arquivo na pasta de anexos; devolve { sha256, ext, size, nome_original } ou null. */
export async function pickAttachment() {
  requirePermission('weighing.write');
  if (!port()?.selectAndImport) throw new DocumentError('Anexar arquivo só no aplicativo desktop.');
  const r = unwrap(await port().selectAndImport());
  return r?.canceled ? null : r;
}

export async function saveDocument(input = {}) {
  requirePermission('weighing.write');
  return adapter.saveDocument({ id: input.id || null, fields: validateDocumentInput(input) });
}

export async function cancelDocument(id, { motivo } = {}) {
  requirePermission('weighing.edit');
  const texto = motivo ? String(motivo).trim() : '';
  if (texto.length < 3) throw new DocumentError('Informe o motivo do cancelamento.');
  return adapter.cancelDocument(id, { motivo: texto });
}

export async function openAttachment(documento) {
  requirePermission('weighing.read');
  if (!port()?.open) throw new DocumentError('Abrir anexo só no aplicativo desktop.');
  return unwrap(await port().open({ sha256: documento.sha256, ext: documento.anexo_ext }));
}

/** Situação dos anexos (presentes e íntegros) na pasta do app. */
export async function verifyAttachments() {
  requirePermission('weighing.read');
  const objetos = attachmentObjects(await adapter.allWithAttachment());
  if (!port()?.verify) return { total: objetos.length, ok: 0, faltando: objetos.map((o) => o.sha256), corrompidos: [], indisponivel: true };
  return unwrap(await port().verify({ objects: objetos }));
}
