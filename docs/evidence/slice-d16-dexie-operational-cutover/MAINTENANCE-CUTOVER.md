# MAINTENANCE-CUTOVER

Manutenção migrada para Dexie.
- maintenanceDataAdapter → storageAdapter: createFullBackup, exportPesagensCsv/Json, dryRun/applyImportPesagens, dryRun/applyRestore, logicalIntegrity, databaseStats.
- Backup/export salvos em userData/data/{backups,exports} via IPC app:writeUserFile (usuario NAO escolhe pasta).
- Import/restore: dialog JSON + transacao Dexie.
- ManutencaoSistema: stats/status do Dexie; rotulo "Armazenamento: IndexedDB local (Dexie) versao 1"; restore passa payload JSON; copiar diagnostico sem campos SQLite.
- NAO aparece "Banco SQLite nao inicializado".

Validacao: storage:maintenance-ui-flow, storage:backup, storage:import-restore (PASS).
