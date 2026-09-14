# CURRENT-SQLITE-UI-FLOW (antes do cutover)

Fluxo que existia até D.15 (para referência do cutover):
UI → module service → module dataAdapter → window.pesagemApp.X (IPC) → main →
repositório SQLite (better-sqlite3).

| Boundary (adapter) | IPC antigo | Classificação |
|---|---|---|
| weighingDataAdapter | window.pesagemApp.weighing | migrado agora |
| auxiliaryDataAdapter | window.pesagemApp.apartacoes/loteApartacoes | migrado agora |
| healthDataAdapter | window.pesagemApp.healthConfigs/... | migrado agora |
| shipmentDataAdapter | window.pesagemApp.shipments/... | migrado agora |
| maintenanceDataAdapter | window.pesagemApp.maintenance | migrado agora |
| api/db.js (db.entities proxy) | window.pesagemApp.entities → db:* (JSON) | legado (não operacional) |
| weighingService (healthcheck/detectLegacyJson) | window.pesagemApp.database | removido |
| migrationStatus.js | window.pesagemApp.auxiliary/database | removido |

Main process (electron/database/*, IPC SQLite): legado morto (mantido, não
operacional). dialogIpc: mantido (arquivos).
