# ROOT-CAUSE

## Erro reportado
Na tela de Manutenção, ao fazer backup no app instalado:
`Banco SQLite não inicializado` (código `SQLITE_CONN_001`).

## Causa técnica
Os serviços de manutenção (`backupService`, `integrityService`, etc.) obtêm a
conexão via `getConnection()` de `electron/database/sqliteConnection.cjs`, que
**lança `SQLITE_CONN_001: "Banco SQLite não inicializado"` quando `dbInstance` é
null**. Os handlers IPC (`electron/ipc/maintenanceIpc.cjs`) chamavam os serviços
diretamente, **sem garantir que a conexão estava aberta**.

O único ponto que abria a conexão era `initializeSqliteDatabase(dataDir)` no
`app.whenReady()` do `electron/main.cjs`, dentro de um `try/catch` que **engole**
a falha (`sqliteInitError`). Então, se por qualquer motivo a conexão não estava
aberta no momento do backup (init do startup falhou/foi engolido, ou a conexão
não estava viva naquele contexto), o backup quebrava com "não inicializado" —
**sem nenhuma tentativa de recuperação/reinicialização**.

Não havia um inicializador central lazy compartilhado. Cada serviço assumia que
"alguém já inicializou".

## Arquivos envolvidos
- electron/database/sqliteConnection.cjs (getConnection lança o erro)
- electron/database/index.cjs (initializeSqliteDatabase — só chamado no startup)
- electron/database/maintenance/backupService.cjs (usa getConnection)
- electron/ipc/maintenanceIpc.cjs (handlers sem garantir init)
- electron/ipc/databaseIpc.cjs (healthcheck/migrations sem garantir init)
- electron/main.cjs (init no whenReady dentro de try/catch que engole)

## Reprodução (determinística)
Cenário: criar banco (first-run) → fechar a conexão (simula "não inicializado"
no momento do backup) → chamar `createSqliteBackup(dataDir)`.
Resultado ANTES do fix: `SQLITE_CONN_001 - Banco SQLite não inicializado`
(mesmo com o arquivo `pesagens.db` existindo). Ver REPRODUCTION.md.

## Por que os testes anteriores não pegaram
Os verifies de manutenção (`maintenance:backup:verify`, etc.) usam o
`maintenance-test-helper`, que **abre a conexão e semeia dados ANTES** de chamar
o backup. Ou seja, sempre testavam o caminho "conexão já aberta". O caso físico
real (usuário abre o app e clica em Backup sem que a conexão esteja viva naquele
contexto) nunca era exercido. O `first-run:db:verify` do D.11 criava o banco mas
**não executava backup** depois.

## Correção aplicada
Inicializador central idempotente `ensureDatabaseReady(dataDir)` em
`electron/database/index.cjs`: se a conexão não estiver aberta, abre + roda
migrations + PRAGMAs; se já estiver, retorna. Passou a ser chamado por:
- todos os handlers de `maintenanceIpc.cjs` (wrapper `ready`);
- os handlers de banco em `databaseIpc.cjs` (healthcheck, migrations:status);
- o próprio `backupService` (`createSqliteBackup`/`createFullDataBackup`) como
  defesa em profundidade;
- `initializeSqliteDatabase` (startup) agora delega para `ensureDatabaseReady`.
Nenhuma conexão paralela é criada — o `sqliteConnection` é singleton (cache de
módulo do Node), então todos compartilham o mesmo `pesagens.db`.

## Como o novo teste impede regressão
`scripts/verify-maintenance-first-run-backup.mjs` reproduz o cenário do bug
(conexão fechada + userData limpo) e chama o serviço de backup real. Falha se
"Banco SQLite não inicializado" voltar. Está em `test:quick` e `test:full`.
