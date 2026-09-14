# Linha-base visual anterior

## Origem

As imagens em `screenshots/before` são capturas reais do estado D.17B imediatamente anterior ao D.17D.2. Elas foram reaproveitadas do dossiê `slice-d17b-ui-implementation-projetomg-cadastro-empresas`; não foram reconstruídas ou simuladas.

## Matriz disponível

| Tela | 1440x900 | 1366x768 | 390x844 |
|---|---|---|---|
| PesagensIndividuais | disponível | disponível | disponível |
| LancamentoPesagensIndividuais | disponível | indisponível na linha-base histórica | disponível |
| ManutencaoSistema | disponível | indisponível na linha-base histórica | disponível |
| Cadastro de Empresas | disponível | disponível | disponível |

## Divergências identificadas antes da alteração

- sidebar de 220 px permanentemente consumindo a área útil;
- topbar semelhante em cor, mas com hierarquia própria do projeto de Pesagens;
- containers das três páginas usando wrappers diferentes;
- títulos divididos entre `d17b-page-heading` e barras de ação locais;
- área útil desktop igual a `viewport - 220px`;
- scroll distribuído entre shell, page slot e wrappers internos;
- action bars sem um componente estrutural comum.

## Tentativa de nova captura

A captura automatizada foi tentada antes da alteração. O navegador integrado recusou o localhost por política automática e proibiu explicitamente Playwright, CDP e superfícies alternativas. Por isso, o baseline histórico real foi preservado como evidência admissível.
