// Instância Dexie (IndexedDB). Sem módulo nativo, sem conexão no main process,
// sem app.asar.unpacked. O banco NASCE automaticamente na primeira abertura:
// Dexie cria o database e os object stores ao abrir. O usuário não configura nada.
//
// Versões declaradas: 5 (histórica), 6 (1.1.17), 7 (Programa 2.0) e 8 (sanidade
// mínima, ADR-049). O upgrade do Dexie executa apenas transformações leves e
// idempotentes; o backfill pesado (cadastros a partir de texto livre, ids em
// animais/identificadores, limpeza de legacy_payload) é resumível e roda após a
// abertura pelo migrationCoordinator, em cadeia v7 → v8
// (docs/arquitetura-produto/14-MIGRACOES.md).
import Dexie from 'dexie';
import {
  DB_NAME,
  DB_VERSION,
  REMOVED_STORES_V6,
  REMOVED_STORES_V7,
  STORES_V5,
  STORES_V6,
  STORES_V7,
  STORES_V8,
  STORES_V9,
} from './schema.js';

let _db = null;

const SESSION_STATUS_V7 = { Aberta: 'ABERTA', Fechada: 'FECHADA', Cancelada: 'CANCELADA' };

export function getDb() {
  if (_db) return _db;
  const db = new Dexie(DB_NAME);
  db.version(5).stores(STORES_V5);
  db.version(6)
    .stores({ ...STORES_V6, ...REMOVED_STORES_V6 })
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
  db.version(7)
    .stores({ ...STORES_V7, ...REMOVED_STORES_V7 })
    .upgrade(async (transaction) => {
      // Enumerações (idempotente). Nenhum dado é apagado aqui.
      await transaction.table('sessoesPesagem').toCollection().modify((row) => {
        if (SESSION_STATUS_V7[row.status]) row.status = SESSION_STATUS_V7[row.status];
        if (row.local === undefined) row.local = null;
      });
      await transaction.table('loteApartacoes').toCollection().modify((row) => {
        if (!row.situacao) row.situacao = row.fechado ? 'FECHADO' : 'ABERTO';
        if (row.ativo === undefined) row.ativo = true;
      });
      await transaction.table('apartacoes').toCollection().modify((row) => {
        if (row.ativo === undefined) row.ativo = true;
      });
    });
  // v8 aditiva: só cria as stores de sanidade (vazias). Sem upgrade(): nenhum dado
  // existente é tocado; o estado técnico migration:v8 é registrado pelo backfill.
  db.version(8).stores(STORES_V8);
  // v9 aditiva (17-MODELO-DADOS-V9): stores novas e índices novos; nenhum dado reescrito aqui —
  // a natureza dos movimentos e as operações legadas vêm do v9Backfill (resumível, com backup).
  db.version(9).stores(STORES_V9);
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
