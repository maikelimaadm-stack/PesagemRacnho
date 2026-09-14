# Componentes da fundação

## Fundação

- `foundations/ModeloBase1Tokens.jsx`: wrapper e ponto único de importação;
- `foundations/modelo-base1-tokens.css`: valores oficiais;
- `foundations/modelo-base1-reset.css`: reset somente no escopo.

## Estrutura e ações

- `ModeloBase1Page`, `ModeloBase1Section` e `ModeloBase1ActionBar`;
- `ModeloBase1Button` com variantes `green`, `ghost` e `danger`;
- `ModeloBase1IconButton` circular/pill, inclusive disabled/focus/active.

## Campos

- texto e número;
- required, disabled, readonly e erro;
- select simples;
- combobox pesquisável;
- data com calendário customizado em portal.

## Filtros

- trilho expansível;
- navegação horizontal;
- chip normal, ativo e com limpeza;
- popover de campo;
- botões de configurar e limpar.

## Tabela

- shell com scroll horizontal;
- cabeçalho sticky e menu de coluna;
- linhas compactas, zebra, hover e seleção;
- resumo `Selecionados / Listados / Filtrados / Totais`;
- lote por página e paginação visual.

## Overlays e feedback

- dialog portaled de configuração de colunas;
- popover genérico;
- badges neutro/sucesso/aviso/erro;
- empty, loading e error state.

Todos recebem apenas dados e callbacks por props. O laboratório usa somente estado React local.
