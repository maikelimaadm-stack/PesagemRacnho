# D.17D.2 — Relatório de execução

## Resultado

O shell operacional foi migrado para a fundação `ModeloBase1` nas rotas `/PesagensIndividuais`, `/LancamentoPesagensIndividuais` e `/ManutencaoSistema`.

A mudança estrutural principal foi concluída: a navegação lateral de 220 px deixou de ocupar largura permanente e passou a abrir como painel flutuante, conforme o shell do Cadastro de Empresas. A área útil agora ocupa 100% da largura da janela quando o menu está fechado.

Também foram consolidados e aplicados:

- topbar desktop de 36 px;
- topbar mobile de 48 px;
- drawer mobile de 280 px;
- navegação inferior mobile de 56 px;
- page container único;
- page header único;
- action bar única;
- scroll interno por tipo de página;
- padding, gaps e raios estruturais pelos tokens D.17D.1.

## Escopo preservado

Não foram alterados storage, Dexie, API, services, adapters, handlers, Electron, callbacks, consultas ou persistência. Tabelas, campos, filtros internos, dialogs, popups e quadros de resumo permanecem para os slices seguintes.

## Verificação

- `npm.cmd run lint`: passou, 0 erros e 1 warning preexistente em `electron/logging/appLogger.cjs`.
- `npm.cmd run build`: passou.
- `npm.cmd run test`: passou integralmente.
- contrato de uso dos novos componentes nas três páginas: confirmado por inspeção de código.
- rotas e destinos de navegação: preservados.

## Limitação visual

O navegador integrado negou por política automática qualquer leitura/captura de `http://127.0.0.1:5173`. A política também proibiu Playwright, CDP ou outra superfície de navegador como alternativa. O projeto de referência em `:5174` abriu em branco por erro próprio de export/import de `ErpOperationBadge`.

As capturas reais do estado imediatamente anterior, produzidas no D.17B, foram preservadas em `screenshots/before`. Não foram fabricadas imagens de “depois”.
