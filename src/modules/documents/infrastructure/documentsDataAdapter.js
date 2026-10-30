// Persistência dos documentos (F16) — store v9 `documentos`. Cancelar é exclusão lógica com motivo e auditoria;
// o arquivo anexado NUNCA é apagado (retenção: fato cancelado conserva a evidência).
import storage from '../../../storage/storageAdapter.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { DocumentError } from '../domain/documentRules.js';

const active = (row) => row && !row.deleted_at;
const strip = ({ localId: _l, ...rest }) => rest;
const audit = (fields) => ({ id: crypto.randomUUID(), ...fields, ...getActor() });

export async function saveDocument({ id = null, fields }) {
  storage.assertWritable('Documento');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  let saved = null;
  await db.transaction('rw', db.table('documentos'), db.table('operacoes'), db.table('animais'), db.table('propriedades'), db.table('auditoria'), async () => {
    for (const [campo, store, rotulo] of [['operacao_id', 'operacoes', 'Operação'], ['animal_id', 'animais', 'Animal'], ['propriedade_id', 'propriedades', 'Propriedade']]) {
      if (fields[campo] && !(await db.table(store).where('id').equals(fields[campo]).toArray()).some(active)) throw new DocumentError(`${rotulo} do vínculo não encontrada(o).`);
    }
    if (id) {
      const atual = (await db.table('documentos').where('id').equals(id).toArray()).find(active);
      if (!atual) throw new DocumentError('Documento não encontrado.');
      // Anexo já gravado não é trocado em silêncio: anexar outro arquivo cria outro documento.
      const next = atual.sha256 ? { ...fields, sha256: atual.sha256, anexo_ext: atual.anexo_ext, anexo_tamanho: atual.anexo_tamanho, anexo_nome: atual.anexo_nome } : fields;
      await db.table('documentos').update(atual.localId, { ...next, updated_at: ts });
      await db.table('auditoria').add(audit({ entidade: 'documentos', entidade_id: id, acao: 'ATUALIZAR', antes: strip(atual), depois: next, created_at: ts }));
      saved = { ...strip(atual), ...next };
    } else {
      saved = { id: crypto.randomUUID(), empresa_id: 'local', ...fields, created_at: ts, updated_at: ts, deleted_at: null };
      await db.table('documentos').add(saved);
      await db.table('auditoria').add(audit({ entidade: 'documentos', entidade_id: saved.id, acao: 'CRIAR', depois: saved, created_at: ts }));
    }
  });
  return strip(saved);
}

export async function cancelDocument(id, { motivo }) {
  storage.assertWritable('Cancelar documento');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table('documentos'), db.table('auditoria'), async () => {
    const atual = (await db.table('documentos').where('id').equals(id).toArray()).find(active);
    if (!atual) throw new DocumentError('Documento não encontrado.');
    await db.table('documentos').update(atual.localId, { deleted_at: ts, updated_at: ts, status: 'CANCELADO', motivo_cancelamento: motivo });
    await db.table('auditoria').add(audit({ entidade: 'documentos', entidade_id: id, acao: 'CANCELAR', antes: strip(atual), motivo, created_at: ts }));
  });
  return true;
}

export async function listDocuments({ operacaoId = null, animalId = null, propriedadeId = null, tipo = null, incluirCancelados = false } = {}) {
  const db = await storage.ensureReady();
  let rows;
  if (operacaoId) rows = await db.table('documentos').where('operacao_id').equals(operacaoId).toArray();
  else if (animalId) rows = await db.table('documentos').where('animal_id').equals(animalId).toArray();
  else if (propriedadeId) rows = await db.table('documentos').where('propriedade_id').equals(propriedadeId).toArray();
  else rows = await db.table('documentos').toArray();
  return rows.filter((r) => (incluirCancelados || active(r)) && (!tipo || r.tipo === tipo)).map(strip)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/** Todos os documentos (inclusive cancelados) com anexo: o backup leva também os anexos de fatos cancelados. */
export async function allWithAttachment() {
  const db = await storage.ensureReady();
  return (await db.table('documentos').toArray()).filter((r) => r.sha256).map(strip);
}
