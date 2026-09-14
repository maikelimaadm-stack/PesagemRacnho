# LOCAL-LOGGING

## Módulo
`electron/logging/appLogger.cjs` — log local simples, **offline**, sem telemetria,
sem internet. Grava em `userData/logs/app.log`.

API: `initLogger(logDir)`, `getLogFilePath()`, `log(tag, message)`.

## Eventos registrados
Bootstrap (main.cjs, app.whenReady):
- `[bootstrap] app version <x>`
- `[bootstrap] userData path <...>`
- `[bootstrap] dataDir <...>`
- `[bootstrap] database path <...>`
- `[bootstrap] migrations applied <n>, healthy <bool>`
- `[bootstrap] ERRO sqlite init: <code> <message>` (se falhar)

Manutenção (maintenanceIpc, wrapper `ready`):
- `[maintenance] <ação> requested`
- `[maintenance] ensureDatabaseReady start`
- `[maintenance] ensureDatabaseReady ok`
- `[maintenance] <ação> ok`
- `[maintenance] <ação> error <code> <message>`

## Privacidade
- NÃO registra pesagens nem dados do usuário.
- Apenas caminhos, versão, contagem de migrations e códigos/mensagens de erro.
- Nada é enviado para a internet.

## Uso para diagnóstico
Se o backup falhar na máquina da Maike, o `app.log` mostrará se
`ensureDatabaseReady` rodou e qual erro real ocorreu — permitindo distinguir
"build antigo sem fix" de "banco realmente inabrível (permissão/disco)".
Caminho no Windows: `%APPDATA%\pesagens-individuais\logs\app.log`.
