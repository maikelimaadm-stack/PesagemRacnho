# MIGRATION-ARCHITECTURE — Slice D.5

## Módulo de migração

- `electron/database/legacyPesagemMigration.cjs` — orquestração principal
- `electron/database/weighingPayloadMapper.cjs` — validação e mapeamento JSON → SQLite no main process

## Fluxo

```
App startup (main.cjs)
  → tryAutoMigrateLegacyPesagens(dataDir)
    → detectLegacyPesagemStatus()
    → dryRunLegacyPesagemMigration()
    → createLegacyJsonBackup() (se JSON existir e houver registros)
    → applyLegacyPesagemMigration() (transação SQLite)
    → markLegacyPesagemMigrationComplete()

Renderer (weighingService)
  → isMigrationCompleted()
    → true: SQLite only
    → false: hybrid (SQLite + legacyWeighingBridge)
```

## Status

Chaves em `app_settings`:

| Chave | Descrição |
|-------|-----------|
| `legacy_pesagem_migration_status` | `pending` \| `completed` |
| `legacy_pesagem_migration_completed_at` | ISO timestamp |
| `legacy_pesagem_migration_backup_path` | caminho do backup |
| `legacy_pesagem_migration_total_legacy` | total no JSON |
| `legacy_pesagem_migration_inserted` | inseridos |
| `legacy_pesagem_migration_skipped` | ignorados (duplicados) |
| `legacy_pesagem_migration_invalid` | inválidos |
| `legacy_pesagem_migration_sha256` | hash do backup |

## IPC

Handlers em `electron/ipc/databaseIpc.cjs`:

- `database:legacy-pesagem:status`
- `database:legacy-pesagem:dry-run`
- `database:legacy-pesagem:backup`
- `database:legacy-pesagem:apply`

Expostos via `electron/preload.cjs` → `window.pesagemApp.database.legacyPesagem*`.

## App settings

Status persistido após apply bem-sucedido. Segunda execução retorna `alreadyCompleted: true`.

## Rollback

Transação SQLite com rollback automático em erro (`LEGACY_MIGRATION_006`). JSON nunca é alterado ou apagado.

## Idempotência

1. Status `completed` bloqueia re-aplicação destrutiva
2. Deduplicação por `id` existente no SQLite
3. IDs ausentes gerados via hash estável (`legacy-{sha256...}`)
4. Dry-run pode ser executado quantas vezes necessário
