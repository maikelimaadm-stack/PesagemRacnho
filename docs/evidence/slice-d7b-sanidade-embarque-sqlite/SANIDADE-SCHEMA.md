# SANIDADE-SCHEMA

## Migration

`electron/database/migrations/003_sanidade_embarque.sql` (versão 3)

Não destrutiva: apenas `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.

## Tabelas

1. `configuracoes_sanidade`
2. `itens_sanidade`
3. `sanidades_animal`

## Campos (resumo)

### configuracoes_sanidade
id, empresa_id, nome_sanidade, ativo, legacy_payload, created_at, updated_at, deleted_at, origem, version

### itens_sanidade
id, empresa_id, configuracao_sanidade_id, nome_sanidade, medicamento, finalidade, quantidade_padrao, unidade_medida, custo_unitario, legacy_payload, timestamps, soft delete, origem, version

### sanidades_animal
id, empresa_id, configuracao_sanidade_id, nome_sanidade, numero_animal, data_aplicacao, medicamento, finalidade, quantidade, unidade_medida, custo_unitario, custo_total, legacy_payload, timestamps, soft delete, origem, version

## Constraints

- PK em `id`
- FK `itens_sanidade.configuracao_sanidade_id` → `configuracoes_sanidade(id)`
- FK `sanidades_animal.configuracao_sanidade_id` → `configuracoes_sanidade(id)`
- **Sem** FK `numero_animal` → `animals(id)` (domínio usa string de brinco)

## Índices

- config: empresa, nome, deleted_at
- itens: config, empresa, deleted_at
- eventos: data, animal, config, empresa, deleted_at

## Relações

Config 1→N Itens; Config 1→N Eventos (opcional).

## Soft delete

`deleted_at` em todas as tabelas; listagens padrão filtram `deleted_at IS NULL`.

## Legacy payload

`legacy_payload` TEXT (JSON) para campos extras do JSON legado.
