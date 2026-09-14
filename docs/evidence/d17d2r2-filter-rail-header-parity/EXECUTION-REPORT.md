# D.17D.2R2 — Relatório de execução

Data: 2026-08-05

## Alterações aplicadas

- criado `MakFilterRail` a partir do contrato de `MgFilterPills`;
- filtros rápidos convertidos para pílulas compactas e limpezas individuais;
- filtros de data e peso transferidos para pop-ups dimensionados;
- botão `Nova pesagem` normalizado para `Novo`;
- menu combinado de cabeçalho separado em opções e filtro avançado;
- adicionados auto ajuste e congelamento visual de colunas;
- marcador de interface avançado para `d17d2r2-filterrail-2026-08-05`.

## Verificação

- `npm run lint`: aprovado, preservado um aviso preexistente em
  `electron/logging/appLogger.cjs`;
- `npm run build`: aprovado, 2.125 módulos transformados;
- `npm run test:full`: aprovado integralmente, incluindo build, contratos de
  armazenamento, manutenção, documentação, E2E permissivo e smoke desktop.

O acesso automatizado ao endereço local permaneceu bloqueado pela política do
navegador. A auditoria foi feita diretamente contra o código e o CSS oficiais do
`PROJETOMG-main`, sem contornar a restrição.
