# NPM-TEST-REVIEW

## npm run test
Aponta para `npm run test:full`

## test:quick
lint + db + weighing sqlite-only + maintenance ui + d7b sqlite-only + desktop smoke

## test:full
lint, build, db/migrations/repos, weighing (sqlite-only + mapper + adapter + migrations), maintenance (backup/export/import/restore/integrity/ui/dialog), aux + d7b completos, installer sqlite, e2e installed, desktop smoke

## Comandos incluídos
Todos os gates mínimos do slice + D.5–D.8 relevantes

## Comandos excluídos e motivo
- `npm run dist` — separado (pesado / gera instalador); executado manualmente no D.9 e documentado
- Launch empacotado — opt-in via `D9_LAUNCH_PACKAGED=1` no e2e

## Resultado
`npm run test` PASS (2026-07-16)
