# DATABASE-READY-ARCHITECTURE

## Módulo central
`electron/database/databaseReady.cjs` — independente (só importa
`sqliteConnection` e `sqliteMigrations`).

```js
function ensureDatabaseReady(dataDir) {
  if (connection.isOpen()) return connection.getConnection();
  connection.openConnection(dataDir);            // cria data/ + pesagens.db + PRAGMAs
  migrations.runMigrations(connection.getConnection());
  connection.getConnection().pragma('user_version = 1');
  return connection.getConnection();
}
```

## Requisitos atendidos
- idempotente: retorna cedo se `isOpen()`.
- sem circular dependency: ver CIRCULAR-DEPENDENCY-AUDIT.
- segura para chamadas repetidas.
- mesmo path sempre: `sqliteConnection` é singleton (cache de módulo).
- cria dataDir: `openConnection → ensureDataDirectories`.
- cria pesagens.db: `new Database(path)`.
- roda migrations: `runMigrations` (idempotente por `schema_migrations`).
- reabre se a conexão fechou (ex.: após restore).
- não depende de tela, de healthcheck anterior, nem de abrir Pesagens antes.

## Quem chama (cobertura)
- `electron/ipc/maintenanceIpc.cjs` — wrapper `ready` em TODOS os handlers
  (backup sqlite/full, list, verify, integridade, quick-check, stats,
  export json/csv, import dry-run/apply, restore dry-run/apply).
- `electron/ipc/databaseIpc.cjs` — healthcheck, migrations:status.
- `electron/database/maintenance/backupService.cjs` — createSqliteBackup, createFullDataBackup.
- `electron/database/maintenance/exportService.cjs` — export json/csv.
- `electron/database/maintenance/importService.cjs` — apply import.
- `electron/database/index.cjs` — initializeSqliteDatabase (startup) delega.

## Guard de baixo nível mantido
`getConnection()` ainda lança `SQLITE_CONN_001` se chamado sem init — mas isso
não ocorre em fluxo recuperável, pois os pontos de entrada garantem readiness.
