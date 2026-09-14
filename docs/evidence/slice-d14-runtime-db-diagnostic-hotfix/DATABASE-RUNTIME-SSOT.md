# DATABASE-RUNTIME-SSOT

## Módulo
`electron/database/databaseRuntime.cjs` — SSOT dos caminhos do banco. Módulo
independente (sem imports de outros módulos do app → sem ciclo).

API:
- `configureDatabaseRuntime({ userDataPath, dataDir, databasePath, appVersion, isPackaged })`
- `getDatabaseRuntime()` → objeto configurado (ou null)
- `isConfigured()`, `ensureRuntimeConfigured()`, `resetRuntimeForTests()`

## Configuração única (main.cjs, app.whenReady)
Ordem: resolver userData → aplicar PESAGENS_USER_DATA_DIR (teste) → initLogger →
`configureDatabaseRuntime(...)` → ensureDatabaseReady (via initializeSqliteDatabase)
→ registrar IPC → criar janela.

## Uso
`databaseReady.ensureDatabaseReady()` sem argumento lê `getDatabaseRuntime().dataDir`.
Handlers de manutenção passam `getDataDir()` (mesmo valor) como override — ambos
apontam para `userData/data`. Se o runtime não estiver configurado e não houver
override, lança `DB_READY_FAILED` com mensagem clara (registrado no log).

## Prova
- `installed:runtime:diagnostic:verify`: configura o runtime e chama
  `ensureDatabaseReady()` SEM argumento → cria `pesagens.db` no caminho do runtime.
- `packaged:source:verify`: confirma `databaseRuntime.cjs` + `configureDatabaseRuntime`
  no app.asar 1.0.2.
