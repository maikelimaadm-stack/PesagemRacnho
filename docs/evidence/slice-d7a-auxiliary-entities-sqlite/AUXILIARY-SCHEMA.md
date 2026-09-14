# AUXILIARY-SCHEMA — Slice D.7A

## Migration

`electron/database/migrations/002_auxiliary_entities.sql`

Não destrutiva: apenas `CREATE TABLE IF NOT EXISTS` + indexes.

## Tabelas

### apartacoes

id, empresa_id, nome_apartacao, legacy_payload, created_at, updated_at, deleted_at, origem, version

### lote_apartacoes

id, empresa_id, apartacao_id, nome_apartacao, nome_lote, quantidade_maxima, peso_minimo, peso_maximo, fechado, legacy_payload, created_at, updated_at, deleted_at, origem, version

## Constraints

- PK em id
- FK `lote_apartacoes.apartacao_id → apartacoes(id)`

## Índices

- idx_apartacoes_empresa, idx_apartacoes_nome, idx_apartacoes_deleted
- idx_lote_apartacoes_empresa, idx_lote_apartacoes_apartacao, idx_lote_apartacoes_nome, idx_lote_apartacoes_deleted

## Soft delete

`deleted_at` em ambas as tabelas.

## Legacy payload

`legacy_payload TEXT` para campos extras do JSON.
