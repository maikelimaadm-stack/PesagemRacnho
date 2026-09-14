# UI-CONTRACT

Fluxo operacional: UI (pages) -> service -> dataAdapter -> storageAdapter -> Dexie.
- Pages inalteradas; services chamam adapters (assinaturas preservadas); adapters usam Dexie.
- Sem IPC para dados.

Validacao: storage:ui-contract, storage:ui-first-run-persistence, storage:maintenance-ui-flow (PASS).
