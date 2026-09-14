# LINT-BUILD-VERIFY — Slice D.6

Data: 2026-07-10

## npm run lint

**PASS**

## npm run build

**PASS**

## npm run test

**N/A** — script não definido

## npm run db:verify

**PASS**

## npm run db:migrations:verify

**PASS**

## npm run db:repositories:verify

**PASS**

## npm run weighing:mapper:verify

**PASS**

## npm run weighing:adapter:verify

**PASS**

## npm run migration:dry-run:verify

**PASS**

## npm run migration:apply:verify

**PASS**

## npm run migration:idempotency:verify

**PASS**

## npm run weighing:sqlite-only:verify

**PASS**

## npm run maintenance:backup:verify

**PASS**

## npm run maintenance:export:verify

**PASS**

## npm run maintenance:import:verify

**PASS**

## npm run maintenance:restore:verify

**PASS**

## npm run maintenance:integrity:verify

**PASS**

## npm run installer:sqlite:verify

**PASS**

## npm run dist

**PASS** — Setup 1.0.0.exe + win-unpacked + better-sqlite3 unpacked

## rg final

Classificação:

| Padrão | Classificação |
|--------|---------------|
| `db.entities.PesagemIndividual` | bridge-temporária / legado (não em telas) |
| `legacyWeighingBridge` | bridge inativa pós-migração |
| `writeFileSync` | esperado em backup/export/JSON legado; não usado para CRUD SQLite de pesagens |
| `better-sqlite3` | esperado |
| `asarUnpack` | esperado |
| backup/restore/export/import | esperado (maintenance) |
