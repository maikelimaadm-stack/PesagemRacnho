# ModeloBase1 Visual Lab

## Acesso

```txt
http://127.0.0.1:5173/#/ModeloBase1VisualLab
```

A rota foi adicionada a `src/pages.config.js` e não foi incluída no menu de `Layout.jsx`.

## Conteúdo

- action bar com principal, secundário, destrutivo, desabilitado e ícones;
- input, número, readonly, disabled, required e error;
- select, combobox pesquisável e calendário customizado;
- trilho de filtros com chips, clear e popover;
- tabela com seleção, cabeçalho, menu, zebra e hover;
- resumo inferior, lote por página e paginação;
- popover e dialog de configuração de colunas;
- badges e estados empty/loading/error.

## Isolamento

Todo dado da página é literal ou estado React local. Não há chamada a serviço, API, adapter, Dexie, backup, importação, exportação ou Electron. Fechar/recarregar a página descarta o estado do laboratório.

## Verificação

A importação e o bundle da rota foram validados pelo build. A abertura automatizada no navegador ficou `BLOQUEADA` por política externa de acesso a localhost; portanto a renderização visual não é declarada verificada neste relatório.
