# D7B-MIGRATION-REPORT

Serviço: `electron/database/sanidadeEmbarqueLegacyMigration.cjs`

## Entidade: Sanidade (Config + Item + SanidadeAnimal)

### Dry-run
- Conta valid/invalid/duplicates/toInsert por grupo
- Não grava no SQLite
- Verificado: `npm run d7b:migration:dry-run:verify` → PASS

### Apply
- Backup SQLite obrigatório antes
- Transação + insert idempotente por id
- Status em `app_settings` (`legacy_sanidade_migration_*`)
- Empty → `completed_empty`
- Verificado: `npm run d7b:migration:apply:verify` → PASS

### Backup
Criado via serviço de backup antes do apply.

### Idempotência
Segundo apply retorna `alreadyCompleted: true`.

### Inseridos / Inválidos / Ignorados / Conflitos
Contados e persistidos em app_settings; inválidos não inseridos; dups skipped.

## Entidade: Embarque (Embarque + DocumentoEmbarque)

Mesmo padrão com chaves `legacy_embarque_migration_*`.

## Status app_settings

```
legacy_sanidade_migration_status
legacy_sanidade_migration_completed_at
legacy_sanidade_migration_inserted / invalid / skipped
legacy_embarque_migration_status
legacy_embarque_migration_completed_at
legacy_embarque_migration_inserted / invalid / skipped
```

## JSON preservado

`pesagens.json` nunca apagado; confirmado no verify apply.
