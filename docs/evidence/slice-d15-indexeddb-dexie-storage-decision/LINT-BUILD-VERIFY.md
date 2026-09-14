# LINT-BUILD-VERIFY (D.15)

Execução real 2026-07-20 (Windows).

| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test (= test:full) | PASS (40 passos OK) |
| npm run test:quick | PASS |
| npm run test:full | PASS |
| npm run storage:dexie:verify | PASS |
| npm run storage:first-run:verify | PASS |
| npm run storage:backup:verify | PASS |
| npm run storage:import-restore:verify | PASS |
| npm run storage:ui-contract:verify | PASS |
| npm run storage:sqlite-detached:verify | PASS |
| npm run docs:user:verify | PASS |
| npm run dist | NÃO executado (ver INSTALLER-RELEASE-1.1.0.md) |

Os testes SQLite legados continuam PASS (Dexie e SQLite convivem). Nada do fluxo
atual foi quebrado.

## rg final — classificação
- src/storage (Dexie): 7 arquivos; 0 referências a better-sqlite3/sqliteConnection
  → esperado (destacado).
- "Banco SQLite não inicializado" na camada Dexie: 0 → esperado (não existe).
- better-sqlite3: ainda dependência (legado morto, fluxo SQLite intacto) → legado.
- db.entities operacional: 0 (proxy legado em api/db.js) → legado.
- login/permiss/auth/cloud reais em src: 0 → esperado.
- Versão: mantida em 1.0.2 (1.1.0 só quando a UI estiver em Dexie e validada).
