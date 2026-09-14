# D.17D.2R4 — Contrato unificado de filtros ModeloBase1

## Fonte oficial

- `PROJETOMG-main/src/framework/mak/layout/MgFilterPills.jsx`;
- `PROJETOMG-main/src/ModeloBase1/dialogs/MakFilterFieldsConfigDialog.jsx`;
- componentes locais `MakColumnMenu`, `MakFilterRail` e `MakColumnConfigDialog`.

## Invariantes aplicados

- um único editor atende filtro personalizado e filtro de cabeçalho;
- a condição abre como listagem visual, não como `select` nativo;
- valores de lista permitem busca e múltipla seleção;
- textos, números e datas recebem operadores próprios;
- todo número oferece `Entre` e inicia nesse operador quando ainda não filtrado;
- datas em intervalo permanecem em rascunho até `OK`;
- campos de data dos filtros não exibem ícone de calendário;
- todos os campos de dados da tabela podem ser adicionados à faixa;
- recolhimento, navegação e configuração usam botões circulares de 28 px;
- estados claros, escuros, ativos, hover e foco preservam o mesmo vocabulário visual.
