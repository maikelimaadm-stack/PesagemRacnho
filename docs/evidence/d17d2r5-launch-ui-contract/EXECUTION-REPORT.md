# D.17D.2R5 — Relatório de execução

Data: 2026-08-05

## Resultado

- `Novo` foi substituído por `Lançar pesagem`, usando a mesma cápsula verde do botão Salvar.
- Checkboxes de seleção da tabela passaram ao componente circular ModeloBase1 de 20 px.
- Campo único de data do filtro avançado ocupa toda a largura disponível.
- Botões de recolher e configurar a faixa personalizada medem 28 x 28 px e são circulares.
- Campos principais, seleções de apartação, detalhes de venda/abate e controles dos dialogs foram normalizados em 28 px.
- O seletor Apartação/Venda/Abate e a área de tabela voltaram ao fluxo vertical, com 6 px de separação e nenhuma sobreposição.
- A tabela de lançamento preserva largura mínima e rolagem horizontal real.
- Dialogs de apartações, embarques e sanidades usam 18 px de raio, cabeçalho de 44 px, rodapé de 48 px e um único botão Fechar.
- As superfícies internas dos dialogs foram ajustadas para o tema escuro.

## Evidências medidas no navegador

- controles principais: 28 px;
- checkbox: 20 x 20 px, raio 50%;
- botões de faixa: 28 x 28 px, raio 50%;
- botão Salvar: 28 px, raio 999 px;
- filtro de data: raiz 258,4 px e entrada 256,8 px;
- dialog em viewport 910 x 698: 846,4 x 680 px, raio 18 px;
- cabeçalho/rodapé do dialog: 44/48 px;
- sobreposição entre seletor e tabela: 0 px;
- tabela de lançamento: `scrollWidth` 2140 px para `clientWidth` 846 px.

## Marcador

`D.17D.2R5 · ModeloBase1 · d17d2r5-launch-ui-contract-2026-08-05`
