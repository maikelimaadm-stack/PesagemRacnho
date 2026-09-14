# BACKUP-STRATEGY — Slice D.5

## Caminho do JSON

`{dataDir}/pesagens.json`

Em dev: `data/pesagens.json`

## Caminho do backup

`{dataDir}/backups/pesagens-json-before-sqlite-migration-YYYYMMDD-HHMMSS.json`

## Manifesto

`{dataDir}/backups/pesagens-json-before-sqlite-migration-YYYYMMDD-HHMMSS.manifest.json`

Campos:

```json
{
  "createdAt": "ISO_DATE",
  "sourcePath": ".../pesagens.json",
  "backupPath": ".../backups/...",
  "sizeBytes": 0,
  "sha256": "...",
  "estimatedPesagemRecords": 0,
  "appVersion": "1.0.0"
}
```

## SHA256

Calculado sobre o conteúdo bruto do JSON antes da cópia. Persistido em `app_settings.legacy_pesagem_migration_sha256`.

## Quando backup é criado

Antes de qualquer INSERT no SQLite durante `applyLegacyPesagemMigration()`, somente se:
- JSON existe
- há registros legados para migrar

JSON vazio: migração marca `completed` sem backup (nada a preservar além do arquivo original).

## O que acontece se backup falhar

Migração aborta com `LEGACY_MIGRATION_003`. Nenhum dado é escrito no SQLite. Bridge permanece ativa.
