# AUXILIARY-REPOSITORIES — Slice D.7A

## Repositories criados/alterados

- `apartacaoRepository.cjs` (novo)
- `loteApartacaoRepository.cjs` (novo)
- `animalRepository.cjs` / `lotRepository.cjs` (já existiam — sem mudança obrigatória)

## Métodos

create, update, softDelete, getById, list, count

## Validações

- Apartacao: nome_apartacao obrigatório
- LoteApartacao: nome_lote + apartacao_id obrigatórios

## Paginação

limit padrão 100, máximo 1000, offset suportado

## Transações

Migração auxiliar usa transaction no apply.

## Prepared statements

Todos os SQL usam prepared statements.
