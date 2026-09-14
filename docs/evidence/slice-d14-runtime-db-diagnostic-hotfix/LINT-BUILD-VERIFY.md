# LINT-BUILD-VERIFY (D.14)

Execução real 2026-07-20 (Windows). Todos PASS.

| Comando | Resultado |
|---|---|
| lint | PASS |
| build | PASS |
| test (= test:full) | PASS (34 OK) |
| test:quick | PASS |
| test:full | PASS |
| first-run:db:verify | PASS |
| maintenance:first-run-backup:verify | PASS (handler IPC real) |
| maintenance:ui-backup-flow:verify | PASS (contrato withDatabaseReady) |
| installed:runtime:diagnostic:verify | PASS (runtime SSOT + diagnóstico + app.log) |
| maintenance:backup/export/restore/integrity:verify | PASS |
| desktop:smoke:verify | PASS |
| installer:sqlite:verify | PASS |
| packaged:source:verify | PASS (app.asar 1.0.2) |
| e2e:installed:verify | PASS (estrito) |
| data:preservation:verify | PASS |
| docs:user:verify | PASS (docs/release/1.0.2) |
| dist | PASS (Setup 1.0.2.exe) |
| release:checksum | PASS (eea84a05...0303) |
| release:manifest | PASS (1.0.2) |
| pós-dist packaged:source | PASS |
| pós-dist e2e | PASS |
| pós-dist installed:runtime:diagnostic | PASS |
| pós-dist first-run/maintenance-first-run-backup | PASS |

## Busca final (rg) — classificação
- `Banco SQLite não inicializado`: só `sqliteConnection.cjs:50` (guard; fora de
  fluxo recuperável — entradas usam ensureDatabaseReady que lança DB_READY_FAILED
  se falhar). → esperado
- `ensureDatabaseReady` / `databaseRuntime` / `configureDatabaseRuntime` /
  `getDiagnosticInfo` / `withDatabaseReady`: presentes nos módulos certos. → corrigido
- `1.0.0` / `1.0.1` hardcoded em electron/src: **0** (só CHANGELOG/docs). → documentação
- versão atual: **1.0.2**. → esperado
- db.entities 0, legacyWeighingBridge 0, login/permiss/auth reais 0, Program Files 0. → esperado
