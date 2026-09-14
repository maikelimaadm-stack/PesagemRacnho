# RISK-NOTES — Slice D.3

## Riscos eliminados

| Risco | Como |
|-------|------|
| Sem camada transacional | SQLite com WAL + FK + CHECK |
| Sem versionamento de schema | schema_migrations + executor |
| SQLite no renderer (inseguro) | Apenas main process |
| SQL injection | Prepared statements |

## Riscos reduzidos

| Risco | Redução |
|-------|---------|
| R-01 Perda/corrupção JSON | Infra SQLite pronta; JSON ainda ativo |
| R-12 Performance tabela grande | Índices + paginação nos repositories |
| Confusão arquitetural | IPC documentado; dual storage explícito |

## Riscos remanescentes

| Risco | Severidade |
|-------|------------|
| JSON ainda é backend da UI (writeFileSync) | CRÍTICO até D.4/D.5 |
| Dois storages podem divergir | ALTO até troca |
| better-sqlite3 rebuild em CI/dist | MÉDIO — monitorar electron-builder |
| Sem testes automatizados npm test | MÉDIO |

## Riscos que passam para D.4

- Adapter `db.entities.*` → SQLite repositories
- Feature flag STORAGE_BACKEND
- Paginação na UI de listagem
- Atomic write no path de produção

## Riscos que passam para D.5

- Migração real JSON → SQLite
- Validação count(JSON) === count(SQLite)
- Rollback plan
- Import legacy_payload
