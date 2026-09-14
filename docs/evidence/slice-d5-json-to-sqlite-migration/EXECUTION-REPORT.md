# EXECUTION-REPORT — Slice D.5

## Slice

D.5 — Migração controlada do JSON legado para SQLite + desativação da bridge temporária

## Data

2026-07-09

## Branch

N/A — git não disponível no ambiente

## Commit

N/A — git não disponível no ambiente

## Objetivo

Migrar registros legados de `PesagemIndividual` do JSON para SQLite de forma idempotente, preservar backup, desativar bridge JSON no fluxo operacional e manter UI inalterada.

## Arquivos alterados

- `electron/database/legacyPesagemMigration.cjs` — módulo de migração (criado/reparado)
- `electron/database/weighingPayloadMapper.cjs` — mapper main process
- `electron/ipc/databaseIpc.cjs` — handlers IPC migração
- `electron/main.cjs` — auto-migração no startup
- `electron/preload.cjs` — exposição IPC migração
- `src/modules/weighing/application/weighingService.js` — SQLite-only pós-migração
- `src/modules/weighing/application/migrationStatus.js` — cache de status
- `src/modules/weighing/infrastructure/legacyWeighingBridge.js` — comentário fallback
- `src/pages/PesagensIndividuais.jsx` — weighingService
- `src/pages/LancamentoPesagensIndividuais.jsx` — weighingService
- `src/components/pesagens/GerenciarApartacoesDialog.jsx` — weighingService
- `package.json` — scripts de verificação migração

## Arquivos criados

- `scripts/migration-test-helper.mjs`
- `scripts/verify-legacy-pesagem-migration-dry-run.mjs`
- `scripts/verify-legacy-pesagem-migration-apply.mjs`
- `scripts/verify-legacy-pesagem-migration-idempotency.mjs`
- `scripts/verify-weighing-sqlite-only-after-migration.mjs`
- `docs/evidence/slice-d5-json-to-sqlite-migration/*` (11 arquivos)

## Resumo

Implementada migração controlada no Electron main com backup SHA256, dry-run, apply transacional, audit_log e status em app_settings. Auto-migração no startup. weighingService opera SQLite-only após migração concluída. Telas operacionais não usam JSON direto. Bridge mantida como fallback inativo.

## Resultado

**SUCESSO** — todos os critérios de aceite atendidos. Lint, build e 12 scripts de verificação passaram.
