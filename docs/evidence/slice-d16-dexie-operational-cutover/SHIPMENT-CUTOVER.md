# SHIPMENT-CUTOVER

Embarque / DocumentoEmbarque migrados para Dexie.

- `shipmentDataAdapter.js` → `storageAdapter.embarques` / `.documentosEmbarque`.
- Linhas cruas; assinaturas preservadas (create/update/delete/get/list).
- Sem window.pesagemApp para dados.

Validação: storage:sqlite-detached; build PASS.
