// Posologias versionadas (F08) — store `posologias` (v9). Rascunho é editável; aprovada é imutável e só sai
// de cena SUBSTITUÍDA por uma versão nova aprovada (vigência fecha na véspera) ou SUSPENSA com motivo.
// Toda transição tem auditoria.
import storage from '../../../storage/storageAdapter.js';
import { getActor } from '../../../storage/indexedDb/auditActor.js';
import { POSOLOGIA_STATUS, PosologyError, missingForApproval } from '../domain/posology.js';

const STORE = 'posologias';
const active = (row) => row && !row.deleted_at;
const strip = ({ localId: _l, ...rest }) => rest;
const audit = (fields) => ({ id: crypto.randomUUID(), ...fields, ...getActor() });

const previousDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

async function byId(db, id) {
  return (await db.table(STORE).where('id').equals(String(id || '')).toArray()).find(active) || null;
}

export async function listPosologies({ medicamentoId = null } = {}) {
  const db = await storage.ensureReady();
  const rows = medicamentoId ? await db.table(STORE).where('medicamento_id').equals(medicamentoId).toArray() : await db.table(STORE).toArray();
  return rows.filter(active).map(strip).sort((a, b) => String(a.medicamento_id).localeCompare(String(b.medicamento_id)) || (b.versao || 0) - (a.versao || 0));
}

/** Posologia APROVADA vigente na data para o medicamento (ou null). */
export async function activePosology(medicamentoId, data) {
  if (!medicamentoId) return null;
  const rows = await listPosologies({ medicamentoId });
  return rows.find((p) => p.status === POSOLOGIA_STATUS.APROVADA && (!p.vigencia_inicio || p.vigencia_inicio <= data) && (!p.vigencia_fim || p.vigencia_fim >= data)) || null;
}

export async function saveDraft({ id = null, fields }) {
  storage.assertWritable('Posologia');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  let saved = null;
  await db.transaction('rw', db.table(STORE), db.table('medicamentos'), db.table('auditoria'), async () => {
    const medicamento = (await db.table('medicamentos').where('id').equals(fields.medicamento_id).toArray()).find(active);
    if (!medicamento) throw new PosologyError('Medicamento não encontrado.');
    if (id) {
      const atual = await byId(db, id);
      if (!atual) throw new PosologyError('Posologia não encontrada.');
      if (atual.status !== POSOLOGIA_STATUS.RASCUNHO) throw new PosologyError('Posologia aprovada não se edita: crie uma nova versão.', undefined, 'POSOLOGIA_IMUTAVEL');
      if (atual.medicamento_id !== fields.medicamento_id) throw new PosologyError('O medicamento da posologia não muda.');
      await db.table(STORE).update(atual.localId, { ...fields, updated_at: ts });
      saved = { ...strip(atual), ...fields };
      await db.table('auditoria').add(audit({ entidade: STORE, entidade_id: id, acao: 'ATUALIZAR', antes: strip(atual), depois: fields, created_at: ts }));
    } else {
      const versoes = (await db.table(STORE).where('medicamento_id').equals(fields.medicamento_id).toArray()).filter(active).map((r) => r.versao || 0);
      saved = { id: crypto.randomUUID(), empresa_id: 'local', ...fields, versao: (versoes.length ? Math.max(...versoes) : 0) + 1, status: POSOLOGIA_STATUS.RASCUNHO, created_at: ts, updated_at: ts, deleted_at: null };
      await db.table(STORE).add(saved);
      await db.table('auditoria').add(audit({ entidade: STORE, entidade_id: saved.id, acao: 'CRIAR', depois: saved, resumo: `Posologia v${saved.versao} de ${medicamento.nome} (rascunho)`, created_at: ts }));
    }
  });
  return strip(saved);
}

/**
 * Aprova o rascunho: exige tudo de missingForApproval e o responsável técnico. A aprovada anterior do mesmo
 * medicamento vira SUBSTITUÍDA com vigência até a véspera da nova.
 */
export async function approve(id, { responsavel }) {
  storage.assertWritable('Aprovar posologia');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  let result = null;
  await db.transaction('rw', db.table(STORE), db.table('auditoria'), async () => {
    const atual = await byId(db, id);
    if (!atual) throw new PosologyError('Posologia não encontrada.');
    if (atual.status !== POSOLOGIA_STATUS.RASCUNHO) throw new PosologyError('Só rascunho pode ser aprovado.');
    const faltando = missingForApproval(atual);
    if (faltando.length) throw new PosologyError(`Falta para aprovar: ${faltando.join(', ')}.`, faltando.map((f) => `Falta: ${f}.`));
    const anteriores = (await db.table(STORE).where('medicamento_id').equals(atual.medicamento_id).toArray())
      .filter((r) => active(r) && r.status === POSOLOGIA_STATUS.APROVADA);
    for (const anterior of anteriores) {
      if (anterior.vigencia_inicio && anterior.vigencia_inicio >= atual.vigencia_inicio) {
        throw new PosologyError(`A vigência nova precisa começar depois de ${anterior.vigencia_inicio} (versão ${anterior.versao} aprovada).`);
      }
      const fim = previousDay(atual.vigencia_inicio);
      await db.table(STORE).update(anterior.localId, { status: POSOLOGIA_STATUS.SUBSTITUIDA, vigencia_fim: anterior.vigencia_fim && anterior.vigencia_fim < fim ? anterior.vigencia_fim : fim, substituida_por: atual.id, updated_at: ts });
      await db.table('auditoria').add(audit({ entidade: STORE, entidade_id: anterior.id, acao: 'SUBSTITUIR', resumo: `Substituída pela versão ${atual.versao}`, created_at: ts }));
    }
    const changes = { status: POSOLOGIA_STATUS.APROVADA, aprovado_por: responsavel, aprovado_em: ts, aprovado_por_usuario_id: getActor().usuario_id ?? null, updated_at: ts };
    await db.table(STORE).update(atual.localId, changes);
    await db.table('auditoria').add(audit({ entidade: STORE, entidade_id: id, acao: 'APROVAR', resumo: `Aprovada por ${responsavel}`, created_at: ts }));
    result = { ...strip(atual), ...changes };
  });
  return result;
}

export async function suspend(id, { motivo }) {
  storage.assertWritable('Suspender posologia');
  const db = await storage.ensureReady();
  const ts = new Date().toISOString();
  await db.transaction('rw', db.table(STORE), db.table('auditoria'), async () => {
    const atual = await byId(db, id);
    if (!atual) throw new PosologyError('Posologia não encontrada.');
    if (atual.status !== POSOLOGIA_STATUS.APROVADA) throw new PosologyError('Só posologia aprovada pode ser suspensa.');
    await db.table(STORE).update(atual.localId, { status: POSOLOGIA_STATUS.SUSPENSA, motivo_suspensao: motivo, updated_at: ts });
    await db.table('auditoria').add(audit({ entidade: STORE, entidade_id: id, acao: 'SUSPENDER', motivo, created_at: ts }));
  });
  return true;
}

/** Aplicações ativas (não canceladas) dos animais, para carência. */
export async function applicationsOf(animalIds = []) {
  const db = await storage.ensureReady();
  const ids = [...new Set(animalIds.filter(Boolean))];
  if (!ids.length) return [];
  return (await db.table('aplicacoesSanidade').where('animal_id').anyOf(ids).toArray()).filter((r) => active(r) && !r.cancelled_at).map(strip);
}
