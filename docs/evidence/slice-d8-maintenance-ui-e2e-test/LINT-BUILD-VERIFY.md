# LINT-BUILD-VERIFY

Data: 2026-07-13

| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS (via npm test) |
| npm run test | PASS |
| npm run db:verify | PASS |
| npm run db:migrations:verify | PASS |
| npm run db:repositories:verify | PASS |
| npm run weighing:mapper:verify | PASS |
| npm run weighing:adapter:verify | PASS |
| npm run migration:dry-run:verify | PASS |
| npm run migration:apply:verify | PASS |
| npm run migration:idempotency:verify | PASS |
| npm run weighing:sqlite-only:verify | PASS |
| npm run maintenance:backup:verify | PASS |
| npm run maintenance:export:verify | PASS |
| npm run maintenance:import:verify | PASS |
| npm run maintenance:restore:verify | PASS |
| npm run maintenance:integrity:verify | PASS |
| npm run maintenance:ui:verify | PASS |
| npm run maintenance:dialog:verify | PASS |
| npm run installer:sqlite:verify | PASS |
| npm run e2e:installed:verify | PASS (limitação execução) |
| npm run aux:schema:verify | PASS |
| npm run aux:repositories:verify | PASS |
| npm run aux:migration:dry-run:verify | PASS |
| npm run aux:migration:apply:verify | PASS |
| npm run aux:sqlite-only:verify | PASS |
| npm run d7b:schema:verify | PASS |
| npm run d7b:repositories:verify | PASS |
| npm run d7b:migration:dry-run:verify | PASS |
| npm run d7b:migration:apply:verify | PASS |
| npm run d7b:sqlite-only:verify | PASS |
| npm run d7b:ui-contract:verify | PASS |

## rg final (amostra)
- `maintenanceService` / `ManutencaoSistema` — esperado
- `db.entities.*` em scripts verify — esperado (asserts negativos)
- `legacyWeighingBridge` — legado inativo (stub; sem import no service)
- Sem login/permissões na UI de manutenção
