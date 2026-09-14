# BACKUP-EXPORT-IMPORT-DEXIE

- Backup completo: JSON de todos os stores. format "pesagens-individuais-indexeddb-backup", version 1.1.0.
- Export CSV (BOM + escape) e JSON de pesagens.
- Import: dry-run (duplicados/invalidos) + apply (pula duplicados, backup antes).
- Restore: dry-run (conta por store) + apply (transacao clear+bulkAdd; backup de seguranca antes).
- Arquivos persistidos em userData/data/{backups,exports}.

Validacao: storage:backup:verify + storage:import-restore:verify (PASS).
