# LEGACY-BRIDGE-DECISION

## legacyWeighingBridge
`src/modules/weighing/infrastructure/legacyWeighingBridge.js`

## Removida ou mantida
**Mantida como stub morto** (remoção física do arquivo bloqueada no ambiente; conteúdo neutralizado)

## Motivo
`weighingService.js` não importa mais a bridge. Fluxo operacional = SQLite-only. Stub lança erro se CRUD legado for chamado; `list`/`detect` retornam vazio.

## Fluxo operacional
UI → weighingService → weighingDataAdapter → IPC → SQLite

## Risco
Baixo — arquivo órfão; nenhum import operacional

## Próxima ação (D.9)
Apagar fisicamente o arquivo e limpar referências em docs/evidências antigas
