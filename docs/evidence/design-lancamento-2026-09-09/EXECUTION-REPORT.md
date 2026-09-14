# Design "Lançamento de Pesagens" — implementação (09/09/2026)

**Origem:** projeto Claude Design `formulario-escopo`
(`claude.ai/design/p/c4d6cae8-abc6-4bf0-9e87-cdb693fe7b6d`), arquivo
`Lançamento de Pesagens.dc.html` (cópia em `Lancamento-de-Pesagens.dc.html`
nesta pasta). O `support.js` do projeto é o runtime genérico do Claude Design
(dc-runtime); não contém regras de produto.

**Aplicação:** 1.1.17 (código ativo), tela `src/pages/LancamentoPesagensIndividuais.jsx`.

## Método

1. Leitura do design e comparação com a tela real por **estilos computados**
   no navegador a 1440 px (não por inspeção visual apenas), com massa anônima
   `pequena` mais oito lançamentos datados do dia.
2. Divergências corrigidas em CSS (bloco `D.17D.2R29` em
   `src/styles/d17b-modelobase1.css`) e em três componentes.
3. Contratos automatizados atualizados para proteger o novo estado.

## Divergências encontradas e corrigidas

| Elemento | Antes | Design / depois |
|---|---|---|
| Linha de campos (Manejo/Saída) | 5 colunas desiguais (132–220 px) | 9 colunas iguais |
| Linha Apartação/Transferência | 280 / 280 / 360 / restante | 9 colunas iguais; lote em `span 3` |
| Indicação do lote | caixa ≤ 360 px centralizada | pílula 28 px, 999 px, alinhada à esquerda |
| Ações redondas da barra | fundo `#f1f3f4`, borda cinza-azulada | fundo branco, borda `#d8dde5`, ícone `#5b6b80` (apartações `#047857`) |
| Nº Ident./Nome | borda `rgba(39,196,91,.52)`, peso 700 | borda `rgba(64,222,99,.42)`, sombra interna, peso 600 |
| Faixa de avisos | 6 px | 4 px |
| Cabeçalho da tabela | 11 px/600 `#374151`, fundo `#f2f5f9`, bordas escuras | 12 px/700 `#17243a`, fundo branco, bordas `#dfe5eb` |
| Linhas da tabela | 28,8 px, 11 px `#46566c`, monoespaçado geral | 26 px, 12 px `#5f6f82`, zebrado `#fafbfc`, mono só em peso/GMD, identificação em negrito, alinhamento à direita respeitado |
| Coluna Tipo | badge colorido (32 px) | texto simples (atributo `data-movement-type` preservado para estilização futura) |
| Rodapé | rótulos `#374151`; marcas 13→10 px sem pílula | rótulos `#6b7280`; "Marcas:" 10 px/500; pílulas 10 px/999 px `#cbd5e1`; contador 11 px |
| Painel lateral | título 13 px; Dia/Total como botões; contexto à esquerda; th/td 11 px | título 12 px/600; seletor em pílula com ativo verde; contexto centralizado; th 9 px/700 `#68778b`, td 10 px; totais 11 px `#6b7280` |

Mantidos por já coincidirem com o design: cartões 12 px `#e7eaee`, controles
28 px `#f1f3f4`, seletor de movimentação 224 px, seletor de resumo 132 px,
chip de estado 10 px, malha do espaço de trabalho `3fr / minmax(300px,1fr)`,
rodapé de 44 px colado à tabela, painel `sticky` a 8 px.

## Arquivos alterados

- `src/styles/d17b-modelobase1.css` — bloco R29 + ajustes em R17/R26 e no lote automático.
- `src/pages/LancamentoPesagensIndividuais.jsx` — células Nº e Tipo.
- `src/components/pesagens/PesagensResumoRodape.jsx` — classes do rodapé; rótulo "Marcas:" como `span[role=button]` acessível.
- `src/components/pesagens/ResumoLotes.jsx` — título, seletor Dia/Total com `data-active`/`aria-pressed`, totais.
- `scripts/verify-ui-consistency.mjs` — asserções do lote (três colunas), resumos (10 px) e bloco R29.

## Verificação

- Estilos computados após as mudanças (1440 px): campos `9 × 150 px`; th `30 px / 12 px / 700 / #17243a`; td `26,6 px / 12 px / #5f6f82`; pílula do lote `span 3`, 462 px, 28 px, `#ffedd5/#fdba74/#c2410c`; painel th 9 px, td 10 px; Dia ativo `#40de63` com texto branco.
- Modo escuro conferido: cabeçalho `#161b22`, linhas `#161b22/#1c2128`, bordas `#30363d`, texto `#c3cbd4`.
- Gates: `lint`, `ui:consistency:verify`, `animal:history-integrity:verify`, `ui:operational-customization:verify`, `ui:scrollbar-contract:verify`, `ui:locale-dialog:verify`, `maintenance:ui:verify` aprovados; `test:quick` integral executado ao final (ver CHANGELOG).
- Capturas: `screens/` (três telas, claro/escuro, massa pequena, userData isolado).

## Fora do escopo desta entrega

- `Lançamento de Pesagens v2.dc.html` (com indicador ESTÁVEL e ícone de
  balança) pertence à F5 (equipamentos) e não foi aplicado.
- Cabeçalho verde do shell (36 px) já coincide com o design; não foi tocado.
