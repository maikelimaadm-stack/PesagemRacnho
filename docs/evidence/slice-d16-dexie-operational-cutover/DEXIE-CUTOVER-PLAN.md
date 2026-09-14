# DEXIE-CUTOVER-PLAN

Estratégia: trocar apenas a IMPLEMENTAÇÃO dos dataAdapters (ponto de fronteira
único), preservando assinaturas e shapes de retorno → pages/services/mappers não
mudam.

1. weighing: adapter → storage.weighing (+ sqliteToViewModel). service: remover
   chamadas diretas a window.pesagemApp.
2. auxiliary/health/shipments: adapters → storage.<repo> (rows crus, mesmos campos).
3. maintenance: adapter → storage backup/export/import/restore/health/stats;
   persistir arquivos via app:writeUserFile; import/restore via dialog JSON.
4. bootstrap: ensureStorageReady (Dexie) em vez de healthcheck SQLite.
5. Manutenção UI: rótulo de armazenamento IndexedDB; restore passa payload JSON.
6. Gates: storage:ui-first-run-persistence + storage:maintenance-ui-flow +
   storage:sqlite-detached (rígido). Reorganizar test:quick/test:full p/ Dexie.
7. Versão 1.1.0 + instalador. better-sqlite3 como legado (justificado).
