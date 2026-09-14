# LINT-BUILD-VERIFY — Slice D.5

Data: 2026-07-09

## npm run lint

**PASS** — exit 0

## npm run build

**PASS** — exit 0 (vite build, 2078 modules)

## npm run test

**N/A** — script `test` não definido em `package.json`

## npm run db:verify

**PASS** — `OK verify-sqlite-healthcheck`

## npm run db:migrations:verify

**PASS** — `OK verify-sqlite-migrations`

## npm run db:repositories:verify

**PASS** — `OK verify-sqlite-repositories`

## npm run weighing:mapper:verify

**PASS** — `OK verify-weighing-mapper`

## npm run weighing:adapter:verify

**PASS** — `OK verify-weighing-adapter-contract`

## npm run weighing:hybrid:verify

**PASS** — `OK verify-weighing-hybrid-read`

## npm run migration:dry-run:verify

**PASS** — `OK verify-legacy-pesagem-migration-dry-run`

## npm run migration:apply:verify

**PASS** — `OK verify-legacy-pesagem-migration-apply`

## npm run migration:idempotency:verify

**PASS** — `OK verify-legacy-pesagem-migration-idempotency`

## npm run weighing:sqlite-only:verify

**PASS** — `OK verify-weighing-sqlite-only-after-migration`

## rg final

```
src/modules/weighing/infrastructure/legacyWeighingBridge.js  — bridge (desativada pós-migração)
src/modules/weighing/application/weighingService.js          — condicional bridge
src/modules/weighing/domain/weighingMapper.js                — __source mapper
electron/database/legacyPesagemMigration.cjs                 — migração
electron/database/weighingPayloadMapper.cjs                  — mapper main
electron/db.cjs, preload.cjs, legacyJsonStorage.cjs          — JSON storage
scripts/*                                                    — testes
data/pesagens.json                                           — backup legado (vazio em dev)
```

Critério atendido: nenhuma tela operacional usa `db.entities.PesagemIndividual`.
