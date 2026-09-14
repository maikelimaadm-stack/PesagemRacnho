# DEXIE-REPOSITORIES

`src/storage/indexedDb/repositories/` — mesma interface dos repos SQLite.

## genericRepository.createRepository(storeName)
list(filters) · get(id) · create(data) · update(id, patch) · remove(id) [soft] ·
bulkCreate(items) · count(filters). Preenche id/created_at/updated_at/deleted_at.

## repositories/index.js
weighing(+summary/listByPeriodo), apartacao, loteApartacao, healthConfig,
healthItem, animalHealthEvent, shipment, shipmentDocument, animal, lot +
readAppSetting/writeAppSetting.

## Contrato
A UI não sabe se o backend é SQLite ou Dexie — os verbos (list/get/create/update/
delete/bulk/count) são equivalentes. Ponto de troca: os dataAdapters do renderer.

## Validação
`storage:dexie:verify` (CRUD, soft-delete, bulk, summary) — PASS.
