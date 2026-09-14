# MAINTENANCE-IPC-WRAPPER

## Wrapper único
`electron/ipc/maintenanceIpc.cjs` define
`withDatabaseReady(channel, fn)`:
1. loga `[ipc] maintenance channel called: <channel>`
2. loga `[maintenance] <channel> requested`
3. `ensureDatabaseReady(getDataDir())`
4. loga `[maintenance] database ready before op — <databasePath>`
5. executa `fn` → loga `<channel> success` (ou `error <code> <msg>`)

## Cobertura (todos os handlers usam o wrapper)
maintenance:backup:sqlite, maintenance:backup:full, backup:list, backup:verify,
integrity:check, integrity:quick-check, database:stats, export:weighing-json,
export:weighing-csv, import:weighing-json:dry-run, import:weighing-json:apply,
restore:sqlite:dry-run, restore:sqlite:apply.

Nenhum handler fica fora do wrapper (os dois de backup usam `withDatabaseReady`
explicitamente com o nome do canal; os demais via alias `ready = withDatabaseReady`).

## Prova
- `maintenance:ui-backup-flow:verify`: confirma withDatabaseReady + ensureDatabaseReady
  nos canais de backup (sqlite e full).
- `maintenance:first-run-backup:verify` e `installed:runtime:diagnostic:verify`:
  invocam o handler real com a conexão fechada; o log emitido mostra o fluxo
  completo do wrapper.
