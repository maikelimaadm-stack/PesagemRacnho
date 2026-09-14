# LINT-BUILD-VERIFY — Slice D.7A

Data: 2026-07-13

## Resultados

| Comando | Resultado |
|---------|-----------|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test | N/A |
| npm run db:verify | PASS |
| npm run db:migrations:verify | PASS (2 migrations) |
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
| npm run installer:sqlite:verify | PASS |
| npm run aux:schema:verify | PASS |
| npm run aux:repositories:verify | PASS |
| npm run aux:migration:dry-run:verify | PASS |
| npm run aux:migration:apply:verify | PASS |
| npm run aux:sqlite-only:verify | PASS |

## rg final

- `db.entities.Apartacao` / `LoteApartacao` removidos das telas operacionais migradas
- Sanidade/Embarque ainda em JSON (esperado / fora do escopo)
- legacyWeighingBridge mantida inativa (esperado)
- writeFileSync: JSON legado + backup/export (esperado)
