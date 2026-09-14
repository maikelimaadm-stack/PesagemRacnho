# EXPORT-ARCHITECTURE — Slice D.6

## Export JSON

- Arquivo: `{dataDir}/exports/pesagens-export-{stamp}.json`
- Envelope: `type=weighing-entries-export`, `createdAt`, `appVersion`, `schemaVersion`, `filters`, `count`, `entries`

## Export CSV

- Arquivo: `{dataDir}/exports/pesagens-export-{stamp}.csv`
- UTF-8 com BOM (compatibilidade Excel)
- Escape de vírgulas, aspas e quebras de linha

## Campos CSV

```
id,data_pesagem,peso_kg,animal_id,lote_id,tipo_pesagem,operador,origem,observacao,created_at,updated_at,deleted_at
```

## Filtros

`dataInicial`, `dataFinal`, `animalId`, `loteId`, `sessionId`, `includeDeleted`

## Encoding

UTF-8

## Paginação

Leitura interna em páginas de 500 registros (`PAGE_SIZE`) para evitar carregar tudo de uma vez de forma irresponsável.

## Limitações

- Export não inclui stack traces nem dados técnicos desnecessários
- `legacy_payload` presente no JSON completo; omitido do CSV
