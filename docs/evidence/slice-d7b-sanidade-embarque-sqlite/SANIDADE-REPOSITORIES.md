# SANIDADE-REPOSITORIES

## Repositories

- `electron/database/repositories/healthConfigRepository.cjs` → configuracoes_sanidade
- `electron/database/repositories/healthItemRepository.cjs` → itens_sanidade
- `electron/database/repositories/animalHealthEventRepository.cjs` → sanidades_animal
- Helpers: `repoHelpers.cjs`

## Métodos

create, update, softDelete, getById, list, count — em todos.

## Validações

- Config: `nome_sanidade` obrigatório
- Item: `medicamento` + `configuracao_sanidade_id` obrigatórios
- Evento: `data_aplicacao` obrigatória
- AppError `D7B_MAP_001` / `D7B_REPO_001`

## Paginação

limit default 100, max 1000; offset suportado.

## Transações

CRUD simples; FK enforced pelo SQLite.

## Prepared statements

Sim — parâmetros bindados; sem concatenação SQL insegura.
