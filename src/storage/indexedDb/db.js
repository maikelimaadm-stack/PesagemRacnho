// Instância Dexie (IndexedDB). Sem módulo nativo, sem conexão no main process,
// sem app.asar.unpacked. O banco NASCE automaticamente na primeira abertura:
// Dexie cria o database e os object stores ao abrir. O usuário não configura nada.
import Dexie from 'dexie';
import { DB_NAME, DB_VERSION, REMOVED_STORES_V6, STORES, STORES_V5 } from './schema.js';

let _db = null;

export function getDb() {
  if (_db) return _db;
  const db = new Dexie(DB_NAME);
  db.version(5).stores(STORES_V5);
  db.version(DB_VERSION)
    .stores({ ...STORES, ...REMOVED_STORES_V6 })
    .upgrade(async (transaction) => {
      await transaction.table('pesagens').toCollection().modify((row) => {
        delete row.sanidade_ids;
        delete row.sanidades;
        if (row.legacy_payload && typeof row.legacy_payload === 'object') {
          delete row.legacy_payload.sanidade_ids;
          delete row.legacy_payload.sanidades;
        } else if (typeof row.legacy_payload === 'string') {
          try {
            const legacy = JSON.parse(row.legacy_payload);
            delete legacy.sanidade_ids;
            delete legacy.sanidades;
            row.legacy_payload = JSON.stringify(legacy);
          } catch {
            // Snapshot legado inválido permanece intacto; o mapper já o ignora.
          }
        }
      });
    });
  _db = db;
  return db;
}

/**
 * Garante o banco pronto (aberto) e retorna a instância Dexie.
 * Idempotente. NÃO existe estado "não inicializado": se estiver fechado, abre.
 */
export async function ensureStorageReady() {
  const db = getDb();
  if (!db.isOpen()) {
    await db.open();
  }
  return db;
}

export function getDbVersion() {
  return DB_VERSION;
}

// Utilitários apenas para testes (fake-indexeddb).
export function resetDbForTests() {
  if (_db) {
    try { _db.close(); } catch { /* noop */ }
    _db = null;
  }
}

export async function deleteDbForTests() {
  resetDbForTests();
  await Dexie.delete(DB_NAME);
}
