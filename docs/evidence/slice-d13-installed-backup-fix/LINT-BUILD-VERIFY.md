# LINT-BUILD-VERIFY (D.13)

Execução real em 2026-07-20 (Windows). Todos PASS.

| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test (= test:full) | PASS |
| npm run test:quick | PASS |
| npm run test:full | PASS |
| npm run first-run:db:verify | PASS |
| npm run maintenance:first-run-backup:verify | PASS (handler IPC real, conexão fechada) |
| npm run maintenance:ui-backup-flow:verify | PASS (contrato da cadeia do botão) |
| npm run maintenance:backup:verify | PASS |
| npm run maintenance:export:verify | PASS |
| npm run maintenance:restore:verify | PASS |
| npm run maintenance:integrity:verify | PASS |
| npm run desktop:smoke:verify | PASS |
| npm run installer:sqlite:verify | PASS |
| npm run packaged:source:verify | PASS (app.asar 1.0.1 contém ensureDatabaseReady) |
| npm run e2e:installed:verify | PASS (estrito) |
| npm run data:preservation:verify | PASS |
| npm run docs:user:verify | PASS (docs/release/1.0.1) |
| npm run dist | PASS (Setup 1.0.1.exe) |
| npm run release:checksum | PASS (SHA256 23863975...05a7) |
| npm run release:manifest | PASS (1.0.1) |
| pós-dist packaged:source:verify | PASS |
| pós-dist e2e:installed:verify | PASS |
| pós-dist first-run:db:verify | PASS |
| pós-dist maintenance:first-run-backup:verify | PASS |
| pós-dist maintenance:ui-backup-flow:verify | PASS |

## Busca final (rg) — classificação
- `Banco SQLite não inicializado`: só `sqliteConnection.cjs:50` (guard técnico,
  fora de fluxo recuperável). → esperado
- `ensureDatabaseReady`: databaseReady.cjs (def) + maintenanceIpc + databaseIpc +
  backupService + exportService + importService + index.cjs. → corrigido
- `1.0.0` em electron/src: **0** hardcoded (metadados agora leem package.json).
  Aparece só em CHANGELOG/docs históricos. → documentação
- versão atual (package.json): **1.0.1**. → esperado
- `db.entities.` operacional: 0 · `legacyWeighingBridge`: 0 · login/permiss/auth
  reais: 0 · `Program Files`: 0. → esperado
