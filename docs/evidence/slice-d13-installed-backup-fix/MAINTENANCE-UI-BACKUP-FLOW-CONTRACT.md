# MAINTENANCE-UI-BACKUP-FLOW-CONTRACT

## Script
`scripts/verify-maintenance-ui-backup-flow-contract.mjs`
(npm run `maintenance:ui-backup-flow:verify`).

Análise estática determinística da cadeia do botão de backup. Falha se o botão
sair do fluxo corrigido.

## Assertivas (todas PASS)
1. `ManutencaoSistema.jsx` importa `maintenanceService` e chama
   `maintenanceService.createSqliteBackup`.
2. `maintenanceService.js` delega `createSqliteBackup` ao adapter.
3. `maintenanceDataAdapter.js` usa `window.pesagemApp.maintenance` e chama
   `getApi().createSqliteBackup`.
4. `preload.cjs` mapeia `createSqliteBackup → invoke('maintenance:backup:sqlite')`.
5. `maintenanceIpc.cjs` importa `ensureDatabaseReady` de `databaseReady.cjs`, o
   wrapper `ready` chama `ensureDatabaseReady(getDataDir())`, e o canal
   `maintenance:backup:sqlite` é registrado com esse wrapper.
6. `backupService.cjs` importa `ensureDatabaseReady` de `databaseReady.cjs` e o
   chama em `createSqliteBackup(dataDir)`.
7. `databaseReady.cjs` NÃO importa `index.cjs` nem `maintenance` (sem ciclo) e
   exporta `ensureDatabaseReady`.

## Complemento dinâmico
`maintenance:first-run-backup:verify` executa o **handler IPC real** com a
conexão fechada (fake ipcMain) e confirma que o backup funciona — cobrindo o
caminho exato do clique, não apenas o service.

## Limitação honesta
O transporte real do Electron (`ipcRenderer`/processo separado) não é exercível
sem o runtime Electron. Cobrimos: contrato estático da cadeia + execução do
handler real em Node. O elo final (transporte IPC entre processos) é validado
apenas no teste físico.
