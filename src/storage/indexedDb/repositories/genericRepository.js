// Repositório genérico Dexie para stores de domínio (padrão id + soft-delete).
// A UI acessa somente os serviços; o repositório concentra os verbos de dados.
import { ensureStorageReady } from '../db.js';

function nowIso() {
  return new Date().toISOString();
}

function matchesFilters(row, filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (['includeDeleted', 'limit', 'offset', 'orderBy'].includes(key)) continue;
    if (value === undefined || value === null) continue;
    // Compatibilidade entre o contrato da UI (empresaId) e o contrato
    // persistido no banco (empresa_id). Registros criados por versões
    // anteriores podem conter qualquer uma das duas formas.
    if (key === 'empresaId' || key === 'empresa_id') {
      if ((row.empresa_id ?? row.empresaId) !== value) return false;
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

export function createRepository(storeName, { generateId } = {}) {
  const newId = generateId || (() => crypto.randomUUID());

  async function table() {
    const db = await ensureStorageReady();
    return db.table(storeName);
  }

  // A chave primária é o localId; `id` é só um índice, então o mesmo id de
  // domínio pode ter mais de uma linha (restauração de backup, importação,
  // reuso de id). Um `.first()` cru pega a linha mais antiga — que pode estar
  // soft-deletada — e faz update/remove agirem no registro errado, em silêncio.
  // Sempre preferimos a linha ATIVA mais recente.
  async function findRow(t, id) {
    const rows = await t.where('id').equals(id).toArray();
    if (!rows.length) return null;
    const ativos = rows.filter((r) => !r.deleted_at);
    const candidatos = ativos.length ? ativos : rows;
    return candidatos[candidatos.length - 1];
  }

  return {
    storeName,

    async list(filters = {}) {
      const t = await table();
      let rows = await t.toArray();
      if (!filters.includeDeleted) rows = rows.filter((r) => !r.deleted_at);
      rows = rows.filter((r) => matchesFilters(r, filters));
      if (filters.orderBy) rows.sort((a, b) => String(a[filters.orderBy] ?? '').localeCompare(String(b[filters.orderBy] ?? '')));
      const offset = filters.offset || 0;
      const limit = filters.limit;
      return limit ? rows.slice(offset, offset + limit) : rows.slice(offset);
    },

    async get(id) {
      const t = await table();
      return (await findRow(t, id)) || null;
    },

    async create(data) {
      const t = await table();
      const id = data.id || newId();
      const duplicate = await findRow(t, id);
      if (duplicate && !duplicate.deleted_at) {
        throw new Error(`${storeName}: id de domínio duplicado (${id})`);
      }
      const ts = nowIso();
      const record = { ...data, id, created_at: data.created_at || ts, updated_at: ts, deleted_at: data.deleted_at ?? null };
      const localId = await t.add(record);
      return { ...record, localId };
    },

    async update(id, patch) {
      const t = await table();
      const existing = await findRow(t, id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, id, updated_at: nowIso() };
      await t.update(existing.localId, updated);
      return updated;
    },

    async remove(id) {
      // soft delete (padrão do app)
      const t = await table();
      const existing = await findRow(t, id);
      if (!existing) return false;
      await t.update(existing.localId, { deleted_at: nowIso(), updated_at: nowIso() });
      return true;
    },

    async bulkCreate(items = []) {
      const t = await table();
      const ts = nowIso();
      const ids = new Set();
      const records = items.map((data) => ({
        ...data,
        id: data.id || newId(),
        created_at: data.created_at || ts,
        updated_at: ts,
        deleted_at: data.deleted_at ?? null,
      }));
      for (const record of records) {
        if (ids.has(record.id)) throw new Error(`${storeName}: id duplicado no lote (${record.id})`);
        ids.add(record.id);
        const duplicate = await findRow(t, record.id);
        if (duplicate && !duplicate.deleted_at) throw new Error(`${storeName}: id já existente (${record.id})`);
      }
      await t.bulkAdd(records);
      return records.length;
    },

    async bulkUpdate(items = []) {
      const t = await table();
      const ts = nowIso();
      const operations = [];
      for (const item of items) {
        const existing = await findRow(t, item.id);
        if (!existing) throw new Error(`${storeName}: registro não encontrado (${item.id})`);
        operations.push({ key: existing.localId, changes: { ...item.patch, id: existing.id, updated_at: ts } });
      }
      await t.bulkUpdate(operations);
      return operations.length;
    },

    async bulkRemove(ids = []) {
      const t = await table();
      const ts = nowIso();
      const operations = [];
      for (const id of ids) {
        const existing = await findRow(t, id);
        if (existing && !existing.deleted_at) operations.push({ key: existing.localId, changes: { deleted_at: ts, updated_at: ts } });
      }
      await t.bulkUpdate(operations);
      return operations.length;
    },

    async count(filters = {}) {
      const rows = await this.list(filters);
      return rows.length;
    },
  };
}
