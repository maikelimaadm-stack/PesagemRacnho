# LINT-BUILD-VERIFY (D.12)

Execução real em 2026-07-20 (Windows).

## Bateria completa — todos PASS
| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test (= test:full) | PASS |
| npm run test:quick | PASS |
| npm run test:full | PASS |
| npm run first-run:db:verify | PASS |
| npm run maintenance:first-run-backup:verify | PASS (novo gate de regressão) |
| npm run maintenance:backup:verify | PASS |
| npm run maintenance:export:verify | PASS |
| npm run maintenance:restore:verify | PASS |
| npm run maintenance:integrity:verify | PASS |
| npm run desktop:smoke:verify | PASS |
| npm run installer:sqlite:verify | PASS |
| npm run e2e:installed:verify | PASS (estrito) |
| npm run data:preservation:verify | PASS |
| npm run docs:user:verify | PASS |
| npm run dist | PASS (exit 0) — instalador regenerado com o fix |
| npm run release:checksum | PASS — SHA256 292c399d...5e52 |
| npm run release:manifest | PASS |
| e2e pós-dist | PASS |
| first-run pós-dist | PASS |
| maintenance-first-run-backup pós-dist | PASS |

## Busca final (rg) — classificação
- `Banco SQLite não inicializado`:
  - `sqliteConnection.cjs:50` → guard técnico de baixo nível (getConnection sem
    init de banco não-recuperável). NÃO é lançado em fluxo recuperável, pois
    todos os handlers/serviços chamam `ensureDatabaseReady` antes. → esperado/corrigido
  - `maintenanceIpc.cjs`, `index.cjs` (comentários) → documentação
  - `verify-maintenance-first-run-backup.mjs` (comentários) → teste
- `ensureDatabaseReady`: index.cjs (def) + maintenanceIpc + databaseIpc +
  backupService + teste. → corrigido/esperado
- `getDatabase(` solto: 0 (não existe função fantasma). → esperado
- `db.entities.` operacional: 0 · `legacyWeighingBridge`: 0 · login/permiss/auth
  reais: 0 · `Program Files`: 0. → esperado
- `PESAGENS_USER_DATA_DIR`: main.cjs + scripts de teste. → teste/esperado
- `deleteAppDataOnUninstall=false`: confirmado. → esperado
