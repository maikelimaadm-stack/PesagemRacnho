# PACKAGED-SOURCE-VERIFY (D.14)

`scripts/verify-packaged-source-contains-backup-fix.mjs` — abre o `app.asar`
gerado (`@electron/asar`) e prova que o build 1.0.2 contém a correção.

## Verificações por arquivo (extraídos do app.asar) — PASS
| Arquivo | Deve conter |
|---|---|
| electron/database/databaseRuntime.cjs | configureDatabaseRuntime, getDatabaseRuntime |
| electron/database/databaseReady.cjs | ensureDatabaseReady, databaseRuntime, getDatabaseRuntime |
| electron/ipc/maintenanceIpc.cjs | withDatabaseReady, ensureDatabaseReady, maintenance:backup:sqlite |
| electron/database/maintenance/backupService.cjs | ensureDatabaseReady, createSqliteBackup |
| electron/ipc/databaseIpc.cjs | ensureDatabaseReady |
| electron/main.cjs | configureDatabaseRuntime, app:getDiagnosticInfo |
| electron/preload.cjs | getDiagnosticInfo |
| electron/diagnostics.cjs | buildDiagnosticInfo |
| package.json | version === 1.0.2 |

## Renderer (bundle no app.asar)
Busca no buffer: `getDiagnosticInfo` e `Caminho do banco` presentes → a tela de
Manutenção com diagnóstico está empacotada.

## Também
`better_sqlite3.node` presente em `app.asar.unpacked`.

## Resultado (2026-07-20)
`OK verify-packaged-source-contains-backup-fix` (mode asar-extract). Prova: o
instalador 1.0.2 empacota runtime SSOT + ensureDatabaseReady + diagnóstico.
