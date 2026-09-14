# BACKUP-RESTORE-USER-FLOW

## Backup SQLite
Botão **Criar backup do banco** → `createSqliteBackup({ reason: 'manual-ui' })`  
Mensagem: `Backup criado com sucesso.` (+ caminho se retornado)

## Backup completo
Botão **Criar backup completo** → `createFullDataBackup`  
Mensagem: `Backup completo criado com sucesso.`  
Texto: `Inclui banco de dados e arquivos locais importantes.`

## Restore dry-run
Seleção via dialog `.db` → staging em `data/backups/imports/` → `dryRunRestoreSqliteBackup`

## Restore apply
Só se `restorable`; `window.confirm` obrigatório; `applyRestoreSqliteBackup` (já cria backup pré-restore no D.6)

## Confirmação
`Restaurar este backup substituirá o banco atual. Um backup de segurança será criado antes. Deseja continuar?`

## Backup pré-restore
Implementado no serviço D.6 (`reason: 'pre-restore'`)

## Mensagens ao usuário
Toast sonner sucesso/erro; sem stack trace

## Limitações
Restore de arquivos externos passa por cópia staging no dataDir
