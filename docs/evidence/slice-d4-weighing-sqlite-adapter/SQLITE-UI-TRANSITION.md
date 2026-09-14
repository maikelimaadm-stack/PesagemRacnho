# SQLITE-UI-TRANSITION — Slice D.4

## O que passou a usar SQLite
- Criação de pesagens (`weighingService.createEntry`)
- Atualização de registros `__source: 'sqlite'`
- Soft delete de registros SQLite
- Listagem primária via `weighingDataAdapter.listAllEntries`

## O que ainda usa JSON
- Entidades auxiliares: Apartacao, Lote, Sanidade, Embarque, Documento
- Registros legados via `legacyWeighingBridge` (read/update/delete)
- `pesagens.json` intacto no disco

## Como novos lançamentos são salvos
1. UI monta `data`
2. `weighingService.createEntry(data)`
3. Mapper → SQLite IPC → `weighing_entries` + `legacy_payload`

## Como registros antigos são exibidos
1. `listLegacyEntries` lê JSON via bridge
2. Dedup: IDs já no SQLite são ignorados no legado
3. ViewModel com `__source: 'legacy-json'`

## Como evitar duplicidade
`mergeHybridEntries`: Set de IDs SQLite; legado só entra se ID ausente no SQLite.

## Como rollback lógico seria feito
- Feature flag futura `STORAGE_BACKEND=json` apontaria create para bridge
- JSON nunca apagado — dados SQLite em `.db` separado
- D.5 fará import formal com validação de contagem
