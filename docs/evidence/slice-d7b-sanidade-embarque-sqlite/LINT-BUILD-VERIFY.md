# LINT-BUILD-VERIFY

Data: 2026-07-13

| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test | N/A — script ausente (limitação documentada) |
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
| npm run installer:sqlite:verify | PASS |
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

## rg final

Executado sobre `src electron scripts package.json`. Achados classificados:

- **esperado:** migration/repos/IPC/scripts/legacy JSON storage/preload allowlist
- **documentação:** evidências D.5–D.7A
- **falso positivo / UI labels:** strings "Embarque", state names em LancamentoPesagensIndividuais
- **pendente:** `legacyWeighingBridge` (inativa), `npm run test` ausente
- **risco:** baixo — nenhum `db.entities.(Sanidade*|Embarque*|Documento*)` em telas operacionais
