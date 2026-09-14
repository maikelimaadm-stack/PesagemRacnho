# DEXIE-SCHEMA

`src/storage/indexedDb/schema.js` — DB_NAME `pesagens-individuais`, DB_VERSION 1.

## Stores (12)
| Store | Índices |
|---|---|
| pesagens | ++localId, id, data_pesagem, animal_id, lote_id, embarque_id, created_at, updated_at, deleted_at |
| apartacoes | ++localId, id, nome, ... |
| loteApartacoes | ++localId, id, apartacao_id, lote_id, ... |
| configuracoesSanidade | ++localId, id, nome, ... |
| itensSanidade | ++localId, id, configuracao_id, nome, ... |
| sanidadesAnimal | ++localId, id, animal_id, data, ... |
| embarques | ++localId, id, data, status, ... |
| documentosEmbarque | ++localId, id, embarque_id, tipo, ... |
| animais | ++localId, id, brinco, ... |
| lotes | ++localId, id, nome, ... |
| appSettings | key |
| backupHistory | ++localId, id, tipo, created_at |

- Nomes de campos coerentes com o modelo SQLite (data_pesagem, animal_id...) para
  minimizar mudança nos mappers de domínio da UI.
- `++localId` autoincrement + `id` (uuid do domínio) indexado.
- Padrão soft-delete (`deleted_at`) nas entidades de domínio.
- Versão Dexie = 1 (migrações futuras via db.version(n).stores(...).upgrade(...)).

## First-run
Dexie cria o database e os stores automaticamente na primeira abertura
(`ensureStorageReady`). O usuário não configura nada; sem módulo nativo.
