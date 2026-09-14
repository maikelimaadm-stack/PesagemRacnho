# REPRODUCTION

## Objetivo
Reproduzir tecnicamente o erro físico "Banco SQLite não inicializado" no backup.

## Cenário (o pior caso do bug)
1. userData temporário limpo.
2. Primeira abertura: cria `pesagens.db` (como o first-run).
3. Fecha a conexão SQLite (simula o app rodando sem conexão viva no momento do
   backup — equivalente ao init de startup ter falhado/sido engolido).
4. Usuário clica em Backup → `maintenance.createSqliteBackup(dataDir)`.

## Resultado ANTES do fix
```
banco criado: true
RESULTADO: backup FALHOU -> SQLITE_CONN_001 - Banco SQLite não inicializado
```
Confirma: o arquivo do banco existe, mas o backup falha porque a conexão não
está aberta e o serviço não reinicializa.

## Resultado DEPOIS do fix
```
banco criado: true
RESULTADO: backup OK (bug NAO reproduzido)
```
Com `ensureDatabaseReady` no serviço/handler, o backup reabre o banco
automaticamente e conclui.

## Observação
O mesmo cenário virou teste de regressão permanente:
`scripts/verify-maintenance-first-run-backup.mjs`
(`npm run maintenance:first-run-backup:verify`).
