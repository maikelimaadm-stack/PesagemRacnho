# INTEGRITY-REPORT — Slice D.6

## PRAGMA integrity_check

Implementado em `integrityService.runIntegrityCheck()`.
Resultado esperado: `{ ok: true, result: "ok" }`.
Falha → `INTEGRITY_001`.

## PRAGMA quick_check

Implementado em `integrityService.runQuickCheck()`.
Mesmo contrato de sucesso/erro.

## Stats

`getDatabaseStats()` retorna:

- weighingEntries, animals, lots, auditLog, backupHistory
- databaseSizeBytes, walSizeBytes
- lastMigrationStatus

## Resultado

**PASS** — `npm run maintenance:integrity:verify`

## Riscos

- Integrity check não substitui backup regular
- Stats de `weighing_entries` incluem soft-deleted (COUNT sem filtro deleted_at) — documentado; export/listagem operacional filtram deleted
