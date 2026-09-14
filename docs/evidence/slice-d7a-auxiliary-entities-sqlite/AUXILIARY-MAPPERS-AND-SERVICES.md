# AUXILIARY-MAPPERS-AND-SERVICES — Slice D.7A

## Mappers

Repositories expõem ViewModel UI com aliases:

- `created_date` ← `created_at`
- `updated_date` ← `updated_at`
- `fechado` boolean

## Aliases suportados

empresaId / empresa_id, apartacaoId / apartacao_id

## Campos preservados

legacy_payload com snapshot JSON

## Services

`src/modules/auxiliary/application/apartacaoService.js`

## Adapters

`src/modules/auxiliary/infrastructure/auxiliaryDataAdapter.js`

## Compatibilidade com UI

Mesmos campos (`nome_apartacao`, `nome_lote`, `quantidade_maxima`, `peso_minimo`, `peso_maximo`, `fechado`) — sem mudança visual.
