# WEIGHING-ADAPTER-ARCHITECTURE — Slice D.4

## Camada criada
```
src/modules/weighing/
  domain/weighingErrors.js
  domain/weighingMapper.js
  infrastructure/weighingDataAdapter.js  → IPC SQLite
  infrastructure/legacyWeighingBridge.js → db.entities (temp)
  application/weighingService.js
```

## Métodos (weighingService)
- createEntry, updateEntry, deleteEntry, getEntryById
- listEntries, countEntries, getSummary, detectStorageStatus

## Fluxo create
UI payload → validateUiPayload → uiToSqlite → IPC weighing:create → sqliteToViewModel

## Fluxo update
Detect `__source` → legacy: bridge JSON | sqlite: merge existing + uiToSqlite → IPC update

## Fluxo delete
`__source === 'legacy-json'` → bridge delete | else → IPC soft delete

## Fluxo list
SQLite listAllEntries (paginated) + legacy list → mergeHybridEntries → filter empresaId

## Fluxo summary
Calculado sobre lista híbrida merged (total, pesoTotal, pesoMedio)

## Error handling
WeighingError com codes WEIGHING_* ; IPC `{ ok:false }` → WeighingError ; toUserMessage para UI
