# EMBARQUE-SCHEMA

## Migration

`electron/database/migrations/003_sanidade_embarque.sql` (versão 3)

## Tabelas

1. `embarques`
2. `documentos_embarque`

**Não criada:** `shipment_animals` — animais embarcados permanecem em `weighing_entries` com `embarque_id` / `documento_embarque_id`. Integrity stats reporta `shipmentAnimals: 0` documentado.

## Campos (resumo)

### embarques
id, empresa_id, nome, data, frigorifico, status (default Planejado), legacy_payload, timestamps, soft delete, origem, version

### documentos_embarque
id, empresa_id, embarque_id, embarque_nome, tipo_documento, numero_gta, numero_nfe, motorista_nome, placa_carreta, qtd_prev_machos, qtd_prev_femeas, legacy_payload, timestamps, soft delete, origem, version

## Constraints

- PK `id`
- FK `documentos_embarque.embarque_id` → `embarques(id)`

## Índices

- embarques: empresa, data, status, deleted_at
- documentos: embarque_id, empresa, deleted_at

## Relações

Embarque 1→N Documentos; Pesagens N→1 Embarque/Documento via weighing_entries.

## Soft delete

`deleted_at` padrão.

## Legacy payload

`legacy_payload` TEXT para extras do JSON.
