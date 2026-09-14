# NEXT-SLICE-D8-READINESS

## Estado após D.7B

Entidades operacionais principais (pesagens, apartações, sanidade, embarque) em SQLite-only nas telas.

## O que está pronto

- Schema 001–003
- Repos + IPC + services
- Backup/export/import/restore/integrity (D.6)
- Migrações legado com dry-run/apply
- Instalador com better-sqlite3 (D.6)

## O que ainda falta

- Tela de manutenção para usuário final
- E2E do instalador instalado
- `npm run test`
- Remoção definitiva de `legacyWeighingBridge` / neutralização total de `db.cjs` operacional

## Recomendação D.8

**Slice D.8 — Tela de manutenção/backup para usuário final + teste E2E do instalador instalado + criação de `npm run test`.**

## Tela de manutenção

Expor backup, export, import, restore, integrity (já no main process) via UI segura.

## Teste instalado

Smoke E2E: abrir app instalado, CRUD pesagem/sanidade/embarque, integrity.

## npm test

Introduzir runner mínimo (node test / vitest) agregando verifies existentes.

## Gates recomendados

- maintenance:ui:verify
- installer:e2e:verify
- test (suite)
- legacy-bridge:removed:verify
