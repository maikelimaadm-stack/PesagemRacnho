# D.17D.2R4 — Relatório de execução

Data: 2026-08-05

## Resultado

- a faixa de filtros personalizados reutiliza o mesmo `MakColumnMenu` dos cabeçalhos;
- condição, valores, datas, estados, `Cancelar`, `Limpar` e `OK` agora têm um único contrato;
- o seletor nativo de condição foi substituído por listagem compacta, pesquisável e com seleção visível;
- a configuração é derivada de todas as colunas de dados da tabela, sem lista paralela desatualizada;
- campos calculados da tabela, como `Qtd Doc (Dia)`, usam o mesmo valor estável em filtro, ordenação e célula;
- `Peso mínimo` e `Peso máximo` saíram da configuração e deram lugar a `Peso`;
- todos os campos numéricos recebem operadores numéricos, com `Entre` como condição inicial;
- os campos de data dos filtros não mostram ícone, mas continuam abrindo o calendário pelo campo;
- os controles de recolher, navegar e configurar filtros têm dimensões quadradas rígidas e forma circular.

## Verificação

- `npm run test:full`: aprovado integralmente;
- `npm run lint`: zero erros e um aviso preexistente em `electron/logging/appLogger.cjs`;
- `npm run build`: aprovado, 2.126 módulos transformados;
- contratos de armazenamento, manutenção, documentação, E2E permissivo e smoke desktop: aprovados;
- marcador de interface: `D.17D.2R4 · ModeloBase1 · d17d2r4-unified-filter-contract-2026-08-05`.

O acesso automatizado ao endereço local continua indisponível pela política do navegador.
A verificação visual estrutural foi feita pelo contrato oficial do `PROJETOMG-main` e pelos
componentes compartilhados do próprio aplicativo.
