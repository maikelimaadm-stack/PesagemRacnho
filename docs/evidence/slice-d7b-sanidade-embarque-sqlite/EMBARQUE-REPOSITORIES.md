# EMBARQUE-REPOSITORIES

## Repositories

- `electron/database/repositories/shipmentRepository.cjs` → embarques
- `electron/database/repositories/shipmentDocumentRepository.cjs` → documentos_embarque

## Métodos

create, update, softDelete, getById, list, count.

**Não implementados** `createWithItems` / `shipment_animals`: domínio real não usa tabela de animais de embarque; vínculo via pesagens.

## Validações

- Embarque: `nome` obrigatório
- Documento: `embarque_id` obrigatório
- AppError D7B_*

## Paginação

limit 100 (max 1000), offset.

## Transações

CRUD unitário; create documento depende de embarque existente (FK).

## Prepared statements

Sim.
