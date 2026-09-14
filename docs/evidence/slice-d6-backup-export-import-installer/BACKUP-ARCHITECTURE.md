# BACKUP-ARCHITECTURE — Slice D.6

## Tipos de backup

1. **SQLite DB backup** — cópia do `pesagens.db` após `wal_checkpoint(TRUNCATE)`
2. **Full data backup** — diretório com db (+ wal/shm se existirem), `pesagens.json`, logs

## Caminhos

- SQLite: `{dataDir}/backups/sqlite/pesagens-db-backup-{stamp}.db`
- Manifesto SQLite: `{dataDir}/backups/sqlite/pesagens-db-backup-{stamp}.manifest.json`
- Full: `{dataDir}/backups/full/full-data-backup-{stamp}/`

Stamp inclui ISO + sufixo aleatório para evitar colisão no mesmo segundo.

## Manifesto

Inclui: `type`, `createdAt`, `sourceDatabasePath`, `backupPath`, `sizeBytes`, `sha256`, `appVersion`, `schemaVersion`, `migrationStatus`, `healthcheck`.

## SHA256

Calculado sobre o arquivo `.db` após a cópia. Persistido no manifesto e usado em `verifyBackup`.

## Healthcheck

Snapshot do healthcheck atual incluído no manifesto SQLite (healthy, foreignKeys, journalMode).

## Backup pré-importação

`applyImportWeighingEntriesFromJson` chama `createSqliteBackup({ reason: 'pre-import' })` antes da transação.

## Backup pré-restore

`applyRestoreSqliteBackup` cria backup do banco atual (`reason: 'pre-restore'`) + cópia de segurança `.pre-restore-*.bak` antes de substituir.

## Limitações

- ZIP não implementado (cópia de diretório suficiente neste slice)
- Backup usa cópia síncrona (não API Promise do better-sqlite3) por confiabilidade
- Histórico em `backup_history` é best-effort
