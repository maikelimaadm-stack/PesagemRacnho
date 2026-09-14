# MAINTENANCE-BACKUP-EXPORT-IMPORT

`src/storage/indexedDb/backup/backupService.js`.

## Backup completo
`createFullBackup()` → { format: "pesagens-individuais-indexeddb-backup",
version, dbVersion, createdAt, stores: {todos os 12 stores} }. Serializável p/ JSON.

## Export
- `exportPesagensCsv()` → CSV (BOM UTF-8, header + escape de aspas/vírgulas).
- `exportPesagensJson()` → payload weighing-entries-export.

## Import (JSON)
- `dryRunImportPesagens(payload)` — obrigatório: conta total/toInsert/duplicates/
  invalidRecords (duplicado por id; inválido sem data).
- `applyImportPesagens(payload)` — cria backup antes; pula duplicados; transação.

## Restore
- `dryRunRestore(backup)` — valida formato + conta por store.
- `applyRestore(backup)` — backup de segurança pré-restore; transação: clear +
  bulkAdd de todos os stores. Volta ao estado do backup.

## Integridade lógica + stats
`logicalIntegrity()` (ids únicos, referências) e `databaseStats()` (contagens).
Substituem PRAGMA integrity_check/stats do SQLite.

## Validação
`storage:backup:verify` + `storage:import-restore:verify` — PASS.
