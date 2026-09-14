# D.17D.2R — Contrato de densidade ModeloBase1

Fonte de verdade auditada: Cadastro de Empresas do `PROJETOMG-main`.

| Elemento | Medida oficial | Aplicação em Pesagens |
| --- | ---: | --- |
| Campo de formulário | 38 px | lançamento, apartação, filtros avançados e dialogs |
| Botão de ação | 28 px | toolbars, ações de formulário e manutenção |
| Botão somente ícone | 28 × 28 px | listagem, filtros e cabeçalhos |
| Filtro rápido | 28 px | barra inferior da toolbar de listagem |
| Linha de toolbar | 36 px | action bars; listagem usa duas linhas compactas |
| Cabeçalho de tabela | 30 px | listagem e tabela do lançamento |
| Linha de tabela | 26 px | listagem e tabela do lançamento |
| Espaçamento interno principal | 6–10 px | cards, painéis e dialogs |

## Regras aplicadas

- O breadcrumb da topbar é a identificação visual da tela; o título interno permanece no DOM apenas para acessibilidade.
- Filtros rápidos têm largura orientada pelo conteúdo, sem largura mínima uniforme excessiva.
- Os quatro contadores do rodapé ocupam frações iguais; paginação fica isolada à direita.
- Campos operacionais têm proporções por função: campos curtos não disputam largura com identificação, observação e transferência.
- Toolbars usam botões de 28 px; campos continuam com 38 px conforme o ModeloBase1.
- Popups de cabeçalho e dialogs de gestão usam a mesma escala de botões, gaps e raios.
- Datas usam um calendário controlado pela aplicação, evitando diferenças do calendário nativo do sistema operacional.

## Breakpoints

- Desktop: grade completa e painéis lado a lado.
- Até 1024 px: formulário de lançamento redistribuído em seis colunas e resumo abaixo da tabela.
- Até 767 px: controles de toque em 36 px, filtros em fluxo horizontal e cards em coluna única.
