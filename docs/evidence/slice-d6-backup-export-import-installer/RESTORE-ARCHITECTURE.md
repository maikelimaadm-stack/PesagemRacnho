# RESTORE-ARCHITECTURE — Slice D.6

## Dry-run restore

`dryRunRestoreSqliteBackup`:

1. Valida path/arquivo `.db`
2. Verifica manifesto e SHA256
3. Abre backup readonly
4. `PRAGMA integrity_check`
5. Confirma tabelas obrigatórias

## Apply restore

1. Dry-run
2. Backup pré-restore do banco atual
3. Checkpoint + close connection
4. Cópia de segurança `.pre-restore-*.bak`
5. Remove wal/shm + unlink do db atual
6. Copia backup validado
7. Reabre conexão + migrations + integrity + healthcheck
8. Em falha, tenta restaurar safety copy

## Validação de manifesto

SHA256 do manifesto comparado com hash real do arquivo.

## Validação de SHA256

Obrigatória quando manifesto existe; mismatch → não restaurável.

## Integrity check

Executado no backup (dry-run) e no banco restaurado (apply).

## Backup pré-restore

Obrigatório (`RESTORE_002` se falhar).

## Fechamento/reabertura de conexão

Implementado via `closeConnection` / `openConnection` do módulo sqliteConnection.

## Limitações

- IPC restringe paths ao `dataDir` (anti path-traversal)
- Restore apply validado em ambiente temporário pelos scripts
- Não há restauração automática no startup
