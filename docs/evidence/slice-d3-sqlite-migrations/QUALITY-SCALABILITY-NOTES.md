# QUALITY-SCALABILITY-NOTES — Slice D.3

## Capacidade estimada

| Volume | Status |
|--------|--------|
| 10 mil registros | ✅ Obrigatório — índices + paginação |
| 100 mil registros | ✅ Obrigatório — WAL + índices em data/animal/lote |
| 1 milhão registros | ⚠️ Preparado — paginação limit 1000; VACUUM/índices adicionais em D.4 |

## Paginação

- `limit` default: 100
- `limit` max: 1000
- `offset` default: 0
- Repositories não carregam tabela inteira

## Índices

7 índices criados na migration 001, focados em:
- Filtro por data (`data_pesagem`)
- Joins por animal, lote, session
- Soft delete (`deleted_at`)
- Busca por brinco/nome

## Transações

- Migrations: transação por migration
- Repositories: operações single-statement (better-sqlite3 sync)
- D.4: transações multi-op para create pesagem + sanidade

## Riscos de performance

| Risco | Mitigação futura |
|-------|------------------|
| UI ainda carrega JSON inteiro | D.4 pagina via SQLite |
| SUM/COUNT em tabelas grandes | Índices + materialized views se necessário |
| WAL file growth | Checkpoint policy em D.4 |

## Melhorias futuras

- Connection pool (single connection suficiente para desktop)
- Batch insert na migração JSON (D.5)
- EXPLAIN QUERY PLAN nos repositories críticos
- Vacuum programado
- Backup automático para `backups/`
