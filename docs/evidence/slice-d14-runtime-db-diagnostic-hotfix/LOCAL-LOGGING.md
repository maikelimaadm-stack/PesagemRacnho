# LOCAL-LOGGING (D.14)

`electron/logging/appLogger.cjs` → `userData/logs/app.log`. Offline, sem
telemetria. Inicializado no bootstrap (main.cjs).

## Eventos
Bootstrap:
- `[bootstrap] app version <x>`
- `[bootstrap] isPackaged <bool>`
- `[bootstrap] userData path <...>`
- `[bootstrap] dataDir <...>`
- `[bootstrap] databasePath <...>`
- `[bootstrap] ensureDatabaseReady start`
- `[bootstrap] ensureDatabaseReady success — database path <...>`
- `[bootstrap] ensureDatabaseReady error <code> <msg>` (se falhar)

databaseReady:
- `[db] ensureDatabaseReady start/success/error`

Manutenção (wrapper):
- `[ipc] maintenance channel called: <canal>`
- `[maintenance] <canal> requested`
- `[maintenance] database ready before op — <databasePath>`
- `[maintenance] <canal> success | error <code> <msg>`

## Privacidade
Sem pesagens/dados sensíveis; só caminhos, versão, contagem de migrations,
códigos/mensagens de erro.

## Prova
`installed:runtime:diagnostic:verify` lê o app.log e confirma eventos de
bootstrap, ensureDatabaseReady e backup (canal chamado + success).
