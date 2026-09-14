# CIRCULAR-DEPENDENCY-AUDIT

## Risco (hipótese #7)
No D.12, `backupService.cjs` importava `ensureDatabaseReady` de
`electron/database/index.cjs`. O `index.cjs` é o orquestrador do banco. Havia o
risco teórico de, dependendo da ordem de carregamento no runtime empacotado, o
`ensureDatabaseReady` não estar definido (export parcial em ciclo).

## Grafo de dependências (antes)
```
maintenance/index.cjs → backupService → index.cjs → (connection, migrations, healthcheck)
maintenanceIpc → maintenance/index.cjs + index.cjs
```
`index.cjs` NÃO importava maintenance, então não havia ciclo real — mas o
acoplamento `backupService → index.cjs` era desnecessário e frágil.

## Correção (D.13)
Extraído um módulo INDEPENDENTE:
```
electron/database/databaseReady.cjs
  requires: ./sqliteConnection.cjs, ./sqliteMigrations.cjs  (apenas)
  exports:  ensureDatabaseReady
```
Novo grafo:
```
services (backup/export/import) → databaseReady → sqliteConnection / sqliteMigrations
ipc (maintenanceIpc/databaseIpc) → databaseReady
index.cjs → databaseReady   (reexporta p/ compatibilidade)
databaseReady → NUNCA importa services nem index.cjs
```

## Verificação automatizada
`maintenance:ui-backup-flow:verify` inclui a assertiva:
> databaseReady NÃO importa index.cjs nem maintenance (sem ciclo)
checando os `require(...)` do arquivo. PASS.

## Resultado
Sem dependência circular. `ensureDatabaseReady` resolve deterministicamente em
qualquer ordem de carregamento, inclusive no app empacotado.
