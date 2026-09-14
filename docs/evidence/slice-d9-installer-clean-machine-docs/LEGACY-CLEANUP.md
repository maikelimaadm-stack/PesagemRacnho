# LEGACY-CLEANUP

## legacyWeighingBridge
Arquivo **removido**: `src/modules/weighing/infrastructure/legacyWeighingBridge.js`

## Removido/mantido
Removido

## Motivo
Nenhum import em `src/` desde D.8; fluxo operacional já era SQLite-only; smoke verify confirma ausência.

## Fluxo operacional
UI → weighingService → weighingDataAdapter → IPC → SQLite

## db.entities
Não usado em telas operacionais migradas (smoke + d7b/aux sqlite-only verifies).  
`electron/db.cjs` / preload allowlist permanecem para JSON legado/backup/migração — esperado.

## Pendências
Limpeza futura opcional de `electron/db.cjs` se/quando JSON legado deixar de ser necessário para migração/backup.
