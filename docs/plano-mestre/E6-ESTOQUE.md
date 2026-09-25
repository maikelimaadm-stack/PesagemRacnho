# E6 — Estoque de brincos e medicamentos (1.8.0, Dexie v11)

Um motor de estoque só, usado por brincos e medicamentos. Não é rastreabilidade oficial (SISBOV fora).
Hoje existem `faixasIdentificadores` + `excecoesIdentificadores` (numeração por marca) e `medicamentos`
(cadastro) — nenhum dos dois tem saldo, entrada, consumo ou perda.

## 1. Esquema v11

| Store | Campos | Índices |
|---|---|---|
| `itensEstoque` | `tipo` (BRINCO, MEDICAMENTO, OUTRO), `nome`, `unidade` (UN, ML, DOSE, FRASCO), `conteudo_por_unidade` (ex.: frasco 500 ml), `estoque_minimo`, `medicamento_id`, `brinco_tipo` (VISUAL, BOTAO, ELETRONICO), `marca_id`, `ativo` | `++localId, &id, empresa_id, tipo, medicamento_id, marca_id, ativo, created_at, updated_at, deleted_at` |
| `movimentosEstoque` | `item_id`, `tipo` (ENTRADA, CONSUMO, PERDA, DESCARTE, AJUSTE), `quantidade` (+/−), `data`, `lote_fabricacao`, `validade`, `custo_unitario`, `nf`, `fornecedor_parceiro_id`, `ref_tipo` (ANIMAL, APLICACAO, IDENTIFICADOR, PESAGEM), `ref_id`, `motivo`, `cancelado_em` | `++localId, &id, empresa_id, item_id, tipo, data, [item_id+lote_fabricacao], validade, ref_id, created_at, updated_at, deleted_at` |

Saldo = soma dos movimentos não cancelados (projeção em memória com cache invalidado por escrita;
nunca campo "saldo" editável). Custo médio ponderado por item. Saída de medicamento por FEFO
(vence primeiro, sai primeiro).

Backfill: cria `itensEstoque` MEDICAMENTO para cada `medicamentos` ativo (saldo 0) e um item BRINCO
por faixa ativa (tipo/marca). Nenhum movimento inventado.

## 2. Brincos

- **Entrada**: "Recebi brincos" → item, quantidade, faixa numérica (início–fim) ou lista colada,
  fornecedor, NF, custo. Cria/estende a faixa em `faixasIdentificadores`.
- **Consumo automático**: ao gravar um identificador novo no animal (Lançamento ou ficha), movimento
  CONSUMO ligado ao identificador. Número fora do estoque → aviso (não bloqueia; entra como AJUSTE
  pendente de conferência).
- **Perda / rebrinco**: ação "Brinco perdido" no animal → inativa o identificador com motivo PERDA,
  movimento PERDA, e oferece o próximo número livre. A busca pelo número antigo continua achando o animal
  (histórico em `animalIdentificadores`).
- **Painel**: saldo por tipo e marca, próximo número livre, números pulados, taxa de perda por lote
  e por mês, alerta de mínimo.
- Lista "Animais para rebrincar" (identificador com PERDA sem substituto) — aparece também no curral.

## 3. Medicamentos

- **Entrada**: produto, lote de fabricação, validade, quantidade (em frascos ou ml), custo, NF, fornecedor.
- **Consumo automático**: cada aplicação em `aplicacoesSanidade` gera CONSUMO (dose × animais) por FEFO;
  cancelar a aplicação cancela o movimento.
- Alertas: vencendo em 30 dias, vencido (bloqueia uso, com liberação justificada), abaixo do mínimo.
- Custo sanitário por aplicação → alimenta custo por animal/lote (relatórios da E8).

## 4. Telas

Menu REBANHO › **Estoque** com abas: Saldo · Movimentos · Entrada rápida · Alertas. Cabeçalho com
3 cartões: itens abaixo do mínimo, vencendo, brincos disponíveis.

## 5. Relatórios

`estoque.saldo` (grão novo STOCK_ITEM, Resumido por tipo/marca), `estoque.movimentos`
(STOCK_MOVEMENT, período obrigatório), `estoque.perdas-brinco`.

## 6. Gates

`migration:v11:verify`, `stock:ledger:verify` (saldo = soma, cancelamento, FEFO, custo médio),
`stock:ear-tag-flow:verify` (entrada por faixa, consumo, perda, rebrinco, busca por número antigo),
`stock:medicine-flow:verify` (consumo por aplicação, cancelamento, vencido bloqueia).

## 7. Aceite humano

1. Receber 500 brincos (faixa 1001–1500) → saldo 500.
2. Brincar 3 animais no Lançamento → saldo 497, próximo livre 1004.
3. Marcar perda no animal 1002 e rebrincar com 1004 → busca por "1002" ainda acha o animal.
4. Entrada de 2 frascos de 500 ml de vermífugo → aplicar em 10 animais a 5 ml → saldo 950 ml.
