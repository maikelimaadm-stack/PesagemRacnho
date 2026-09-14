# LINT-BUILD-VERIFY

Data: 2026-07-16

| Comando | Resultado |
|---|---|
| npm run lint | PASS (via test) |
| npm run build | PASS (via test + dist) |
| npm run test | PASS (= test:full) |
| npm run test:quick | PASS |
| npm run test:full | PASS |
| npm run db:verify | PASS |
| npm run db:migrations:verify | PASS |
| npm run db:repositories:verify | PASS |
| npm run weighing:sqlite-only:verify | PASS |
| npm run maintenance:backup:verify | PASS |
| npm run maintenance:export:verify | PASS |
| npm run maintenance:import:verify | PASS |
| npm run maintenance:restore:verify | PASS |
| npm run maintenance:integrity:verify | PASS |
| npm run maintenance:ui:verify | PASS |
| npm run maintenance:dialog:verify | PASS |
| npm run installer:sqlite:verify | PASS |
| npm run e2e:installed:verify | PASS |
| npm run desktop:smoke:verify | PASS |
| npm run aux:sqlite-only:verify | PASS |
| npm run d7b:sqlite-only:verify | PASS |
| npm run d7b:ui-contract:verify | PASS |
| npm run dist | PASS |

## rg final
- login/senha/permissões: **não implementados** (falso positivo: author, class-variance-authority, role=combobox)
- legacyWeighingBridge: **removido**
- backup/restore/export/import: **esperado** (manutenção)
- better-sqlite3 / asarUnpack: **esperado**
- writeFileSync: scripts de teste / legado / manutenção — não CRUD operacional
