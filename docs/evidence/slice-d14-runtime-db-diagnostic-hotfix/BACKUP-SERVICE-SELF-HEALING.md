# BACKUP-SERVICE-SELF-HEALING

`electron/database/maintenance/backupService.cjs` chama `ensureDatabaseReady(dataDir)`
no início de `createSqliteBackup` e `createFullDataBackup` (import de
`../databaseReady.cjs`). Assim, mesmo que o IPC não tivesse chamado (defesa em
profundidade), o backup prepara o banco sozinho.

Backup funciona:
- logo após abrir o app
- sem pesagem cadastrada
- com banco recém-criado
- com conexão fechada
- com userData limpo

`exportService` e `importService` (apply) também chamam ensureDatabaseReady.
Restore reabre a conexão ao final.

## Prova
`maintenance:first-run-backup:verify` reseta a conexão (fechada) e chama o
handler real de backup → PASS, com `pesagens.db` criado durante o backup.
