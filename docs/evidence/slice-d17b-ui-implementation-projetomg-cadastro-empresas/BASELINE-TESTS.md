# Baseline técnico anterior às alterações

Executado em `MAKGESTAO-main` antes de editar o produto.

| Comando | Resultado |
|---|---|
| `npm.cmd run lint` | aprovado; 0 erros, 1 warning preexistente em `electron/logging/appLogger.cjs:32` |
| `npm.cmd run build` | aprovado; 2106 módulos; CSS 486,57 kB; JS 820,71 kB |
| `npm.cmd run test` | aprovado; suíte completa em 38,8 s |

A suíte baseline confirmou boot Electron, preload, 12 stores Dexie, CRUD, primeira execução, backup, CSV/JSON, import/restore, persistência após reabertura, manutenção, SQLite detached, mapper, contratos de UI/dialog, documentação, E2E permissivo e desktop smoke.

Hashes de recuperação dos arquivos planejados constam em `BACKUP-HASHES.md`.
