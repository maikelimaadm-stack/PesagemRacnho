# AUXILIARY-CUTOVER

Apartação / LoteApartação migradas para Dexie.

- `auxiliaryDataAdapter.js` → `storageAdapter.apartacoes` / `.loteApartacoes` (stores homônimos).
- Retorna linhas cruas (mesmos campos). Assinaturas preservadas (create/update/delete/get/list).
- Sem window.pesagemApp para dados.

Validação: storage:sqlite-detached (0 refs SQLite; usa storageAdapter); build PASS.
