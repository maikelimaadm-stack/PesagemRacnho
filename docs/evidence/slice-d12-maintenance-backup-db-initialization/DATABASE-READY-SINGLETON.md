# DATABASE-READY-SINGLETON

## Função central
`ensureDatabaseReady(dataDir)` em `electron/database/index.cjs`:
```js
function ensureDatabaseReady(dataDir) {
  if (connection.isOpen()) {
    return connection.getConnection();
  }
  connection.openConnection(dataDir);            // cria data/ + pesagens.db + PRAGMAs
  migrations.runMigrations(connection.getConnection());
  connection.getConnection().pragma('user_version = 1');
  return connection.getConnection();
}
```

## Idempotência
- Se a conexão já está aberta (`connection.isOpen()`), apenas retorna a conexão.
- Se não está, abre uma vez, roda migrations pendentes e retorna.
- Seguro para N chamadas repetidas (cada handler chama sem custo se já pronto).
- `runMigrations` já é idempotente (aplica só pendentes via `schema_migrations`).

## Quem usa
- `electron/ipc/maintenanceIpc.cjs` — wrapper `ready(fn)` chama
  `ensureDatabaseReady(getDataDir())` antes de TODO handler (backup sqlite/full,
  list, verify, integridade, quick-check, stats, export json/csv, import
  dry-run/apply, restore dry-run/apply).
- `electron/ipc/databaseIpc.cjs` — healthcheck e migrations:status.
- `electron/database/maintenance/backupService.cjs` — `createSqliteBackup` e
  `createFullDataBackup` (defesa em profundidade, para chamadas diretas).
- `electron/database/index.cjs` — `initializeSqliteDatabase` (startup) delega.
- `scripts/verify-maintenance-first-run-backup.mjs` (teste).

## Garantia de mesmo path / mesma conexão
`sqliteConnection.cjs` mantém `dbInstance`/`databasePath` em escopo de módulo. O
Node cacheia módulos por caminho resolvido, então TODOS os `require(...
sqliteConnection.cjs)` compartilham o MESMO singleton. Não há conexão paralela
nem banco em caminho diferente.

## Garantia de userData
`getDataDir()` (main.cjs) → packaged: `app.getPath('userData')/data`. O
`ensureDatabaseReady` recebe esse `dataDir` via `getDataDir()` nos handlers, então
o banco nasce/abre sempre em `userData/data/pesagens.db`. Override de teste:
`PESAGENS_USER_DATA_DIR`.

## Novo helper de estado
`sqliteConnection.isOpen()` → `!!dbInstance`. Usado por `ensureDatabaseReady`
para decidir se precisa abrir, sem lançar exceção.
