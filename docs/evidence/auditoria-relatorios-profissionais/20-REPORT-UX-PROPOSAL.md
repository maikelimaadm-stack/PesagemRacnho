# 20 — Proposta de UX

Fluxo em três passos, na mesma tela, sem assistente modal longo.

## 1. Escolher

Catálogo (`19`). Cada cartão: nome, uma frase do que responde, grão (“uma linha por pesagem / por animal”), aviso de
ressalva quando houver (“Categoria histórica só a partir de 16/09/2026”).

## 2. Configurar (barra da pré-visualização)

| Controle | Comportamento |
|---|---|
| **Período** | obrigatório quando a definição exigir; presets Hoje · 7 dias · 30 dias · Mês atual · Mês anterior · Ano · Personalizado; mostra datas resolvidas |
| **Filtros** | mesmo menu de coluna da Relação + pílulas; só colunas permitidas |
| **Colunas** | lista com marcar/desmarcar e arrastar ordem (lista simples, não cubo) |
| **Agrupar por** | até 3 níveis entre as dimensões `groupable`; aviso quando o nível 3 tem alta cardinalidade |
| **Totais** | métricas por coluna numérica: soma, média, média ponderada (GMD), mín, máx; “animais únicos” |
| **Modelo** | Salvar · Salvar como · Compartilhar com a empresa (se permitido) · Restaurar padrão |

A tabela atualiza ao mudar a configuração (sem botão “gerar”), exceto quando o período exceder o limite de leitura
interativa — aí aparece “Calcular” e um contador de linhas.

## 3. Emitir

Botão **Emitir** → Imprimir · PDF · CSV · JSON (os disponíveis na fatia). Diálogo curto: orientação, quebra por grupo,
incluir detalhe ou só totais. Após gravar: caminho do arquivo + identificador da emissão.

## Regras de clareza

- Nulo aparece como “—”; médias mostram “(n de N)” quando houver ausentes.
- Colunas removidas por permissão: faixa discreta “2 colunas ocultas pelo seu perfil”.
- Texto informado no lançamento (comprador, frigorífico, causa) marcado com ícone “texto livre”.
- Sem gráficos na primeira onda; tabela primeiro.
- Mesmo visual ModeloBase1 da Relação; nenhum componente visual novo além de linha de grupo/subtotal.
