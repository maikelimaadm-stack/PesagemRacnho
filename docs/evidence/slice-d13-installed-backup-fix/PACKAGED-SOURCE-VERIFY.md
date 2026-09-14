# PACKAGED-SOURCE-VERIFY

## Script
`scripts/verify-packaged-source-contains-backup-fix.mjs`
(npm run `packaged:source:verify`).

Abre o **pacote gerado** (`release/win-unpacked/resources/app.asar`) com
`@electron/asar` e extrai arquivos específicos para provar que o build contém a
correção — não apenas o source.

## Verificações (todas PASS no build 1.0.1)
| Arquivo no app.asar | Deve conter |
|---|---|
| electron/database/databaseReady.cjs | ensureDatabaseReady, openConnection, runMigrations |
| electron/ipc/maintenanceIpc.cjs | ensureDatabaseReady, maintenance:backup:sqlite, databaseReady.cjs |
| electron/database/maintenance/backupService.cjs | ensureDatabaseReady, createSqliteBackup |
| electron/ipc/databaseIpc.cjs | ensureDatabaseReady |
| package.json | version === 1.0.1 |

Também confirma `better_sqlite3.node` em `app.asar.unpacked`.

## Nota técnica
No Windows, `@electron/asar` usa o separador nativo nos caminhos internos; o
script converte o caminho lógico com `path.sep`. Há fallback dependency-free
(busca de tokens no buffer do asar) caso a lib não esteja disponível.

## Resultado (2026-07-20)
```
OK verify-packaged-source-contains-backup-fix
mode: asar-extract
perFile: databaseReady.cjs ok, maintenanceIpc.cjs ok, backupService.cjs ok,
         databaseIpc.cjs ok, package.json version 1.0.1
```
Prova: o instalador 1.0.1 empacota a correção.
