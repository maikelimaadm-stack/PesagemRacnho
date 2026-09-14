# AUXILIARY-MIGRATION-REPORT — Slice D.7A

## Entidade: Apartacao

- Dry-run: PASS (válidos/inválidos/duplicados)
- Apply: PASS
- Backup: SQLite backup pré-apply
- Idempotência: already_completed na 2ª execução
- Inseridos / inválidos / ignorados: conforme dry-run
- Status: `legacy_aux_migration_apartacao_status=completed`
- JSON preservado: Sim

## Entidade: LoteApartacao

- Dry-run: PASS
- Apply: PASS (após Apartacao — FK)
- Backup: Sim
- Idempotência: Sim
- Status: `legacy_aux_migration_lote_apartacao_status=completed`
- JSON preservado: Sim

## Auto-migração

`tryAutoMigrateAuxiliary` no startup do Electron (após pesagens).
