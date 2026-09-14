# MIGRATIONS-REPORT — Slice D.3

## Tabela schema_migrations

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  checksum TEXT,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Criada pelo executor (`sqliteMigrations.cjs`) antes de aplicar migrations.

## Migrations criadas

| Version | Name | Arquivo |
|---------|------|---------|
| 1 | 001_initial_schema | `electron/database/migrations/001_initial_schema.sql` |

## Ordem

Arquivos lidos de `migrations/*.sql`, ordenados por prefixo numérico (`001`, `002`, ...).

## Transação

Cada migration executa dentro de `db.transaction()`:
1. `db.exec(sql)` — DDL da migration
2. `INSERT INTO schema_migrations (version, name, checksum)`

Se falhar: rollback automático da transação; erro `SQLITE_MIG_001`.

## Rollback em caso de falha

- Transação SQLite reverte DDL parcial
- Migration não registrada em `schema_migrations`
- App continua com JSON funcional
- Banco `.db` pode ser removido manualmente para retry limpo

## Status final

```
applied: [{ version: 1, name: "001_initial_schema", checksum: "81eef2dc..." }]
pending: []
total: 1
```

Verificação: `npm run db:migrations:verify` — OK (2026-07-09)

Re-execução idempotente: migrations já aplicadas são ignoradas.
