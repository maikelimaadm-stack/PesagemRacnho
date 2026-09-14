# LINT-BUILD-DB-VERIFY — Slice D.3

## npm run lint

```
> eslint .
(exit code 0)
```

## npm run build

```
> vite build
✓ 2072 modules transformed.
✓ built in ~27s
(exit code 0)
```

## npm run test

```
npm error Missing script: "test"
```

Registro: **indisponível / script inexistente** (fora de escopo D.3)

## npm run db:verify

```
OK verify-sqlite-healthcheck
healthy: true
journalMode: wal
foreignKeys: true
appliedMigrations: [{ version: 1, name: "001_initial_schema" }]
(exit code 0)
```

## npm run db:migrations:verify

```
OK verify-sqlite-migrations
pending: []
applied: 1 migration
tables: animals, lots, weighing_entries, ...
(exit code 0)
```

## npm run db:repositories:verify

```
OK verify-sqlite-repositories
(create → list → update → soft delete → validation reject peso_kg=0)
(exit code 0)
```

## Observações

- Todos os scripts de verificação usam banco temporário (não tocam dados do usuário)
- better-sqlite3 compilou sem necessidade de electron-rebuild neste ambiente
- Warnings de chunk size e browserslist são pré-existentes
