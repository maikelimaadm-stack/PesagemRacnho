# Migração das barras de ação

As três páginas passaram a renderizar `ModeloBase1ActionBar`.

## PesagensIndividuais

A toolbar existente foi encaixada no componente compartilhado. Foram preservados: abrir filtros, nova pesagem, busca, atualizar, exportar CSV, importar CSV, configuração de colunas, menu adicional, configuração e limpeza dos filtros rápidos.

A toolbar continua com duas faixas internas por necessidade funcional atual. A normalização completa dos controles e do trilho de filtros pertence ao D.17D.3.

## LancamentoPesagensIndividuais

O callback `loadAllData()` do botão Atualizar foi movido para uma action bar independente abaixo do page header.

## ManutencaoSistema

O callback `refreshStatus` foi movido do primeiro card para a action bar, sem duplicação e sem mudança de função.

## Medidas

- altura base desktop: `36px`;
- botão desktop: `28px`;
- altura base mobile: `44px`;
- botão mobile: `36px`;
- gap interno: `4px` a `5px`.
