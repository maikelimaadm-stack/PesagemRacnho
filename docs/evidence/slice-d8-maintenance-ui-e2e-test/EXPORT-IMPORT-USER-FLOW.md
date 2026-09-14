# EXPORT-IMPORT-USER-FLOW

## Export JSON
`exportWeighingJson({})` — exporta tudo; toast com caminho

## Export CSV
`exportWeighingCsv({})` — idem

## Import dry-run
Dialog `.json` → lê payload no main → `dryRunImportWeighingJson(payload)`  
Mostra: total / válidos / inválidos / duplicados / conflitos

## Import apply
Botão **Importar dados** só após dry-run; confirm menciona backup automático; `skipDuplicates: true`

## Backup pré-importação
Serviço D.6 cria backup `pre-import` antes do apply

## Tratamento de inválidos
Contados no dry-run; não inseridos

## Tratamento de duplicados
Skip por padrão (`skipDuplicates`)

## Mensagens ao usuário
Toasts simples; aviso de backup pré-importação na UI
