# SQLITE-ONLY-TRANSITION — Slice D.5

## O que agora usa somente SQLite

Após `legacy_pesagem_migration_status = completed`:

- `weighingService.listEntries()` — somente SQLite
- `weighingService.getSummary()` — somente SQLite
- `weighingService.updateEntry()` — somente SQLite
- `weighingService.deleteEntry()` — somente SQLite (soft delete)
- `weighingService.getEntryById()` — SQLite primeiro, sem fallback JSON

## Bridge ainda existe

Sim — `src/modules/weighing/infrastructure/legacyWeighingBridge.js`

## Bridge está ativa

**Não**, quando migração concluída. Ramo condicional em `weighingService.js` verifica `isMigrationCompleted()` antes de chamar bridge.

## Telas atualizadas

| Tela | Fonte de dados |
|------|----------------|
| `LancamentoPesagensIndividuais.jsx` | `weighingService` |
| `PesagensIndividuais.jsx` | `weighingService` |
| `GerenciarApartacoesDialog.jsx` | `weighingService` (propagate rename) |

## Listagem

SQLite via `weighingDataAdapter.listAllEntries()` → IPC → `weighingRepository`

## Summary

Calculado sobre resultado de `listEntries()` (SQLite only pós-migração)

## CRUD

Create → SQLite (já desde D.4)
Update/Delete → SQLite only pós-migração
