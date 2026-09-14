# D.17D.2R3 — Relatório de execução

Data: 2026-08-05

## Correções funcionais

- a condição de data `Entre` não aplica nem fecha ao escolher a primeira data;
- filtros rápidos de data e peso trabalham com rascunho e só aplicam no `OK`;
- filtros de lista suportam pesquisa, seleção múltipla e `Selecionar Tudo`;
- filtros de cabeçalho recebem os valores distintos reais da coluna;
- rolagem horizontal passa a existir quando a soma das larguras excede o painel.

## Correções visuais

- pop-ups reduzidos para 280 px;
- toolbar e faixa de filtros espaçadas em linhas de 36 px;
- diálogo de configuração reduzido para 540 px, com controles de 28 px;
- paginação, cabeçalhos, botões e estados ativos alinhados ao ModeloBase1;
- modo escuro aplicado ao shell, cartões, tabela, filtros, calendários e diálogos.

## Verificação

- `npm run test:full`: aprovado integralmente;
- build final: 2.125 módulos transformados;
- lint: zero erros e apenas um aviso preexistente em
  `electron/logging/appLogger.cjs`;
- contratos de armazenamento, manutenção, documentação, E2E permissivo e smoke
  desktop: aprovados.

O navegador automatizado permaneceu impedido de abrir o endereço local pela
política de segurança. A comparação foi feita diretamente contra os componentes
e estilos oficiais, sem contornar o bloqueio.
