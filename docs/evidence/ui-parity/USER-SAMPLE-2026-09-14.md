# Amostra de estilo enviada pelo responsável (14/09/2026)

Captura enviada por Maike no chat como "estilo de exemplo": uma listagem do ModeloBase1 (PROJETOMG-main),
tela de documentos fiscais/notas de compra. É a **referência de paridade** para todas as telas de lista
(cadastros, Relação, Usuários, Faixas, Operações, Embarques). Descrição elemento a elemento, para
comparação com estilos computados:

## Linha 1 — barra de ações (`mg-action-bar`, ~36 px, fundo branco, cantos arredondados)

| Posição | Elemento | Detalhes observados |
|---|---|---|
| esquerda | botão primário **"+ Novo"** | cápsula verde (`tb-btn-green`), ícone "+" à esquerda, texto branco em negrito leve, altura ~28 px, primeiro item da barra (não há botão "Filtrar" nesta linha) |
| direita | segmento de modos de visualização | três ícones em um controle segmentado cinza-claro: registro (documento), **tabela (ativo, fundo verde-claro e ícone verde)**, cards (grade); altura ~28 px |
| direita | "Mais opções" | botão redondo com "…" |

## Linha 2 — faixa de pílulas de filtro (`mg-table-panel-strip`, ~36 px)

| Posição | Elemento | Detalhes observados |
|---|---|---|
| esquerda | ícone do painel de filtros | ícone de "filtro/painel" **verde** em botão quadrado com fundo verde-claro (é o toggle do `aside.filter-panel`) |
| esquerda | chevron "‹" | navegação da faixa de pílulas (rolagem) |
| centro | pílulas | uma por coluna filtrável: Período, Documento fiscal, Empresa, Fornecedor, Código, Valor total, Data de emissão, Data de entrega, Emissão, Situação — cápsula cinza-claro, texto escuro médio, chevron "⌄" à direita, altura ~30 px, espaçamento ~8 px |
| direita | chevron "›" | rolagem |
| direita | ícone "limpar filtros" (funil com x, cinza) e ícone "colunas" (painel) | separados por divisor vertical fino |

## Tabela (`emp-table-pro` / `MakCadastroTable`)

| Elemento | Detalhes observados |
|---|---|
| cabeçalho | fundo cinza muito claro, altura ~36 px, texto em negrito escuro; cada coluna com menu "⋮" alinhado à direita; coluna de seleção com checkbox redondo |
| coluna "ID Global" | badge cinza-claro em cápsula (`#39`, `#40`) |
| coluna "Código" | **borda vertical verde** à esquerda da célula (destaque da coluna principal), texto normal |
| linhas | altura ~34 px, zebra branca/cinza muito claro, separadores finos; textos escuros; valores monetários alinhados à direita (`R$ 350,00`) |
| coluna "Emissão" | ícone + texto: ⚠️ Manual, ✅ Automática |
| coluna "Situação" | pílula de status verde-claro com texto verde escuro: "Confirmado" |

## Tokens visíveis

- verde primário ≈ `#40de63` (botões, ícone ativo, borda da coluna principal, pílula de status);
- cinzas de superfície: fundo da página cinza muito claro, cartões brancos com sombra suave e raio ~10–12 px;
- tipografia sem serifa, 12–13 px, cabeçalhos em negrito 600;
- ícones de 14–16 px em botões de 28 px.

## O que difere hoje no Pesagens (a corrigir na fatia de paridade)

1. Nossa barra de ações tem um botão "Filtrar" textual à esquerda e a pesquisa em pílula; a amostra coloca **"+ Novo" como primeiro item** e o toggle de filtros **na faixa de pílulas** (ícone verde). Conferir no PROJETOMG-main qual variante é a oficial para listas (`MgActionBar` × `MgTablePanelStrip`) e aplicar a mesma.
2. A faixa de pílulas da amostra tem chevrons de rolagem, ícone "limpar filtros" e ícone "colunas" à direita com divisor; a nossa tem só as pílulas + botão de colunas.
3. A tabela da amostra tem coluna de id em badge, **borda verde na coluna principal**, pílulas de status e ícones em células; nossas grades de cadastro mostram texto plano.
4. Segmento de modos com o modo ativo em verde-claro (fundo + ícone).
5. Tela de login: campos com borda vermelha antes de digitar (validação nativa `:invalid`), fora do padrão de campos do modelo.

Método de fechamento: renderizar a tela equivalente do PROJETOMG-main (mesmo harness usado em
`docs/evidence/modelobase1-referencia/`), extrair `getComputedStyle` de cada elemento acima e igualar
no Pesagens; evidência lado a lado em 1440/1366/390, claro e escuro, em `docs/evidence/ui-parity/`.
