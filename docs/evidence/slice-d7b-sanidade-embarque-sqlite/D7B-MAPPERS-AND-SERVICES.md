# D7B-MAPPERS-AND-SERVICES

## Mappers

- `src/modules/health/domain/healthMapper.js`
- `src/modules/shipments/domain/shipmentMapper.js`

## Aliases suportados

| UI / legado | Campo canônico |
|---|---|
| nome / name | nome_sanidade (config) / nome (embarque) |
| produto | medicamento |
| config_id / configId | configuracao_sanidade_id |
| data_evento / data | data_aplicacao / data |
| animal_id | numero_animal (string) |
| shipment_id | embarque_id |
| tipo | tipo_documento |
| data_embarque / destino | data / nome |

## Campos preservados

Shape UI mantido; extras em `legacy_payload` na persistência SQLite.

## Services

- `src/modules/health/application/healthService.js`
- `src/modules/shipments/application/shipmentService.js`

## Adapters

- `src/modules/health/infrastructure/healthDataAdapter.js`
- `src/modules/shipments/infrastructure/shipmentDataAdapter.js`

## Compatibilidade com UI

Telas continuam recebendo objetos com os mesmos nomes de campo; sem mudança visual.
