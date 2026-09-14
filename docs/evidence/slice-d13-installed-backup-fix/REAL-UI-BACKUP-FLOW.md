# REAL-UI-BACKUP-FLOW

Fluxo completo e verificado do botão "Criar backup do banco".

```
[Botão] onBackupSqlite  (src/pages/ManutencaoSistema.jsx)
  → maintenanceService.createSqliteBackup({ reason: "manual-ui" })
      (src/modules/maintenance/application/maintenanceService.js)
  → adapter.createSqliteBackup(options)
      (src/modules/maintenance/infrastructure/maintenanceDataAdapter.js)
  → window.pesagemApp.maintenance.createSqliteBackup(options)
  → ipcRenderer.invoke('maintenance:backup:sqlite', options)
      (electron/preload.cjs)
  → handler 'maintenance:backup:sqlite'  (electron/ipc/maintenanceIpc.cjs)
      wrapper ready('sqlite backup', ...):
        appLogger [maintenance] sqlite backup requested
        ensureDatabaseReady(getDataDir())   ← garante banco pronto
        maintenance.createSqliteBackup(getDataDir(), options)
          backupService: ensureDatabaseReady(dataDir) (defesa) → cria backup
  → arquivo .db + .manifest.json em userData/data/backups/sqlite/
```

## Confirmações
- O canal exposto pelo preload (`maintenance:backup:sqlite`) é EXATAMENTE o
  registrado pelo `maintenanceIpc`. Não há canal duplicado/antigo.
- O `preload.cjs` não expõe função antiga para backup.
- Todo handler passa pelo wrapper `ready` → `ensureDatabaseReady`.

## Verificação automatizada
- `maintenance:ui-backup-flow:verify` — contrato estático da cadeia acima (PASS).
- `maintenance:first-run-backup:verify` — invoca o **handler IPC real**
  (via fake ipcMain) com a conexão fechada e confirma o backup (PASS). O log
  emitido comprova: `sqlite backup requested → ensureDatabaseReady start → ok →
  sqlite backup ok`.
