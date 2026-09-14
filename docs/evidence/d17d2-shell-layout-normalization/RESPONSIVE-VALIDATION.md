# Validação responsiva inicial

## Contratos validados em código

| Largura | Shell | Navegação | Conteúdo | Estado |
|---:|---|---|---|---|
| 1920 | topbar 36px | sidebar flutuante | 100% útil | contrato presente |
| 1440 | topbar 36px | sidebar flutuante | 100% útil | contrato presente |
| 1366 | topbar 36px | sidebar flutuante | 100% útil | contrato presente |
| 1024 | topbar 36px | sidebar flutuante | 100% útil | contrato presente |
| 768 | topbar 36px | sidebar flutuante | tablet preserva chrome desktop | contrato presente |
| 390 | topbar 48px | drawer 280px + bottom bar 56px | padding 6px | contrato presente |

## Scroll

- shell e page slot: `overflow: hidden`;
- listagem: grid de altura útil, table card com scroll interno;
- lançamento: scroll somente no chrome do formulário;
- manutenção: scroll somente no page container;
- filtros móveis: drawer fixo entre topbar e bottom bar;
- safe area aplicada à navegação inferior.

## Limite da validação

Lint, build e testes passaram. A inspeção visual runtime em cada viewport não pôde ser executada porque a política automática do navegador bloqueou o localhost e proibiu ferramentas alternativas. Portanto esta validação comprova o contrato CSS, não uma equivalência pixel a pixel pós-implementação.
