# Comparação visual da fundação

## Estado da evidência

O controle do navegador recusou o acesso ao servidor local por política de segurança. A tentativa não foi repetida por meios alternativos. Assim, não existem capturas novas e nenhum item abaixo é declarado `IGUAL`.

| Componente | Estrutura/tokens por código | Captura multirresolução | Classificação | Observação |
|---|---|---|---|---|
| tokens e escopo | conferidos | bloqueada | BLOQUEADO | valores literais extraídos; falta prova renderizada |
| botões | conferidos | bloqueada | BLOQUEADO | variantes e medidas 28/36px presentes |
| input/número | conferidos | bloqueada | BLOQUEADO | campo 38px e label 12/9px presentes |
| select/combobox | conferidos | bloqueada | DIFERENÇA P2 | versão reduzida não porta lookup assíncrono/teclado completo |
| data/calendário | conferidos | bloqueada | DIFERENÇA P2 | grade/dimensões portadas; views mês/ano ficaram para D.17D.6 |
| filter rail/chips | conferidos | bloqueada | BLOQUEADO | estrutura principal portadas; sem comparação renderizada |
| tabela/cabeçalho | conferidos | bloqueada | DIFERENÇA P2 | shell básico proposital, sem filtro de coluna completo |
| rodapé/paginação | conferidos | bloqueada | BLOQUEADO | medidas e quatro contadores presentes |
| dialog | conferidos | bloqueada | DIFERENÇA P2 | estrutura reduzida, sem persistência/drag real |
| popover | conferidos | bloqueada | BLOQUEADO | portal e tokens presentes |
| badges/feedback | conferidos | bloqueada | BLOQUEADO | falta comparação renderizada |

## Resoluções previstas e não capturadas

- 1920×1080 — BLOQUEADO;
- 1440×900 — BLOQUEADO;
- 1366×768 — BLOQUEADO;
- 1024×768 — BLOQUEADO;
- 768×1024 — BLOQUEADO;
- 390×844 — BLOQUEADO.

## Critério de retomada

Quando o acesso local do navegador estiver liberado, capturar referência e laboratório no mesmo zoom e viewport, medir as propriedades definidas no contrato e somente então promover itens de `BLOQUEADO` para `IGUAL` ou diferença P1/P2/P3.
