# WEIGHING-CUTOVER

Pesagens (PesagemIndividual) migradas para IndexedDB/Dexie.

- `weighingDataAdapter.js` → `storageAdapter.weighing` (store `pesagens`), mapeando
  linhas via `sqliteToViewModel` (mesmos nomes de campo; mapper aceita
  legacy_payload objeto/string).
- `weighingService.js`: removidas chamadas diretas a `window.pesagemApp` /
  healthcheck SQLite / migrationStatus; `detectStorageStatus` reporta IndexedDB;
  `getSummary` via adapter.
- Assinaturas preservadas: createEntry/updateEntry/deleteEntry/getEntryById/
  listEntries/bulkCreateEntries/countEntries/getSummary → pages inalteradas.

Validação: storage:ui-first-run-persistence (create/list/update/delete via
weighingService, persistência após reabrir) — PASS.
