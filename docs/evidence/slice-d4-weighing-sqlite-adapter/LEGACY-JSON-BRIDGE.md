# LEGACY-JSON-BRIDGE — Slice D.4

## Motivo da bridge
Registros existentes em `pesagens.json` não foram migrados (D.5). Bridge evita ocultar dados antigos enquanto novos vão para SQLite.

## Arquivos que usam bridge
- `src/modules/weighing/infrastructure/legacyWeighingBridge.js` (único ponto)
- Consumido por `weighingService.js` apenas

## Operações suportadas
- listLegacyEntries
- updateLegacyEntry
- deleteLegacyEntry
- getLegacyEntryById
- detectLegacyStatus

## Operações não suportadas
- create (novos vão sempre SQLite)
- bulk import
- migrate

## Quando remover
Slice D.5 após migração controlada + validação count(JSON) === count(SQLite)

## Riscos
- Dois storages divergentes até D.5
- Edição legado ainda usa writeFileSync JSON
