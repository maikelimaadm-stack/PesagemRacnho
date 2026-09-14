# DEXIE-CUTOVER-IMPLEMENTATION

## Arquivos do renderer alterados
- src/modules/weighing/infrastructure/weighingDataAdapter.js → Dexie
- src/modules/weighing/application/weighingService.js → sem window.pesagemApp
- src/modules/auxiliary/infrastructure/auxiliaryDataAdapter.js → Dexie
- src/modules/health/infrastructure/healthDataAdapter.js → Dexie
- src/modules/shipments/infrastructure/shipmentDataAdapter.js → Dexie
- src/modules/maintenance/infrastructure/maintenanceDataAdapter.js → Dexie + arquivos
- src/api/db.js → bootstrapLocalDb usa Dexie
- src/pages/ManutencaoSistema.jsx → rótulo armazenamento + restore por payload
- removido: src/modules/weighing/application/migrationStatus.js (legado SQLite)

## Main/preload
- electron/main.cjs → IPC app:writeUserFile (salvar backup/export em userData)
- electron/preload.cjs → files.writeUserFile

## Contratos preservados
Assinaturas e shapes dos adapters mantidos → pages e domain mappers inalterados.
lint + build PASS (imports resolvem, bundle limpo).
