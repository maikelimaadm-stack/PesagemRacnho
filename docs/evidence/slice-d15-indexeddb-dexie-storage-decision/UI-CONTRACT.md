# UI-CONTRACT

## Facade
`src/storage/storageAdapter.js` — SSOT de armazenamento consumido pela UI/serviços:
UI → service → storageAdapter → Dexie. Sem IPC/pesagemApp para dados.

Expõe: repositórios de domínio (weighing, apartacoes, ...), createFullBackup,
export CSV/JSON, import dry-run/apply, restore dry-run/apply, logicalIntegrity,
databaseStats, ensureReady.

## Validação (storage:ui-contract:verify — PASS)
- Todos os repositórios têm list/create.
- Todos os métodos de manutenção existem.
- Chamada real service→adapter→Dexie funciona (create + stats).
- storageAdapter NÃO usa ipcRenderer/pesagemApp para dados.

## Pendente (honesto)
O cutover real das pages/adapters (weighing/health/auxiliary/shipments/
maintenance + proxy db.entities) para o storageAdapter NÃO foi feito neste slice
e requer validação física. Ver NEXT-STEPS.
