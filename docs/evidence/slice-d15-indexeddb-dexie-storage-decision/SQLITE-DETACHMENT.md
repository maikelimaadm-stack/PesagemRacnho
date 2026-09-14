# SQLITE-DETACHMENT

## Objetivo
O fluxo operacional de armazenamento (camada Dexie) não pode depender de
better-sqlite3 nem da conexão SQLite.

## Verificação (storage:sqlite-detached:verify — PASS)
Varre `src/storage/**` (7 arquivos) e garante ZERO referências a: better-sqlite3,
sqliteConnection, databaseReady, databaseRuntime, ensureDatabaseReady. Confirma
que db.js importa `dexie`.

## Estado
- Camada Dexie: 100% destacada de SQLite.
- SQLite nativo: mantido como **legado morto** (não removido neste slice; a spec
  autoriza manter se remover for arriscado). Nenhum fluxo Dexie o usa.
- Remoção de better-sqlite3 + electron/database/sqlite* = próximo passo, após o
  cutover da UI e validação física.
