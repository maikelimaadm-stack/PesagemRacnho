# D.17D.2R — Relatório de execução

Data: 2026-08-05  
Marcador de UI: `d17d2-density-2026-08-05`

## Resultado

- Cabeçalho-card redundante removido visualmente de Pesagens, Lançamento e Manutenção; o conteúdo continua disponível para leitores de tela.
- Toolbar de Pesagens normalizada para duas linhas compactas, com botões e filtros em 28 px.
- Filtros rápidos passaram a respeitar o tamanho do conteúdo e a busca foi reduzida para a escala oficial.
- Tabelas normalizadas para cabeçalho de 30 px e linhas de 26 px.
- Rodapé da listagem reorganizado no padrão `Selecionados / Listados / Filtrados / Totais / Paginação`.
- Campos do lançamento receberam proporções funcionais e tipografia de entrada consistente.
- Apartação, transferência, retorno de lote e painéis de resumo foram compactados.
- Espaçamentos duplicados entre classes utilitárias e o layout ModeloBase1 foram removidos.
- Cards e botões de Manutenção foram compactados.
- Dialogs de gestão e filtros de cabeçalho foram normalizados.
- `MakDateControl` passou a usar calendário visual único, em português, com seleção, hoje e limpeza.

## Segurança funcional

Nenhuma regra de negócio, callback, consulta, persistência ou fluxo de importação/exportação foi alterado. As mudanças ficaram restritas a componentes visuais, classes e apresentação do controle de data; o valor de data emitido continua no formato ISO `AAAA-MM-DD`.

## Validação executada

- `npm run lint`: sem erros; permanece um aviso preexistente em `electron/logging/appLogger.cjs`.
- `npm run build`: aprovado.
- `npm run test:quick`: aprovado, incluindo boot, preload, Dexie, persistência, manutenção e smoke desktop.
- `npm run test:full`: aprovado, incluindo contratos completos, backup/importação/restauração, documentação e E2E permissivo de artefatos.

## Limitação de evidência visual

O acesso automatizado ao endereço local `127.0.0.1:5173` foi bloqueado pela política de segurança do navegador. Não houve tentativa de contorno. A validação desta rodada usa a fonte oficial do ModeloBase1, as capturas de referência existentes, compilação e testes automatizados.

## Empacotamento

O instalador 1.1.3 não foi reconstruído nesta rodada. O marcador técnico foi alterado de propósito para que o gate `packaged:ui-build:verify` rejeite qualquer pacote anterior a esta normalização.
