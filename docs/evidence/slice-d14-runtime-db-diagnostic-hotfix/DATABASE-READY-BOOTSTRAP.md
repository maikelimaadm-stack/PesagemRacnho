# DATABASE-READY-BOOTSTRAP

## ensureDatabaseReady (electron/database/databaseReady.cjs)
Passos:
1. Se conexão aberta → retorna (idempotente).
2. Resolve dataDir do runtime SSOT (ou override em testes).
3. Loga `[db] ensureDatabaseReady start`.
4. openConnection (cria dataDir + pesagens.db + PRAGMAs).
5. runMigrations (001–003, idempotente).
6. pragma user_version=1.
7. Loga `[db] ensureDatabaseReady success` com database path.
8. Em falha, loga erro e lança `DB_READY_FAILED` (mensagem clara + causa).

## Independência (anti-ciclo)
requires: sqliteConnection, sqliteMigrations, databaseRuntime, sqliteErrors,
appLogger. NÃO importa index.cjs nem maintenance. Verificado por
`maintenance:ui-backup-flow:verify`.

## Não depende de
- tela / abrir Pesagens / healthcheck anterior / backupService.

## Ordem no bootstrap (main.cjs)
whenReady → configureDatabaseRuntime → ensureDatabaseReady (via
initializeSqliteDatabase) → IPC → janela. Backup depois disso encontra o banco
pronto; e mesmo que a conexão feche, o handler reabre via ensureDatabaseReady.
