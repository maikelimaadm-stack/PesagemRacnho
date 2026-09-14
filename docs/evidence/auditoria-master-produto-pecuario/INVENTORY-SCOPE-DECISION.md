# INVENTORY-SCOPE-DECISION — Escopo de "estoque" no produto

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Pergunta

O pedido "cadastro de estoque de identificadores (brincos etc.)" pode ser lido de duas formas: (a) estoque **de identificadores**, ou (b) um módulo de estoque de insumos (brincos, medicamentos, sal, ração) do qual brincos seriam o primeiro item. Esta auditoria precisa fixar qual dos dois entra no produto.

## 2. Análise

| Critério | (a) Estoque de identificadores | (b) Estoque de insumos genérico |
|---|---|---|
| Ligação com o núcleo | direta: cada número vira identidade de animal | indireta: consumo não muda o animal |
| Modelo | faixas + exceções (`IDENTIFIER-INVENTORY-MODEL.md`) | itens, unidades, entradas, saídas, saldo, custo médio, lotes de validade |
| Telas | 1 (faixas) + relatório | ≥ 4 (itens, movimentos, inventário, ajustes) |
| Regras | próximo livre, uso único, perda | valorização, validade, ponto de pedido, rateio de custo |
| Aderência à orientação "evitar WMS/ERP" | forte | fraca — é o começo de um WMS |
| Dependência de decisões | DEC-002 apenas | P-004 (método de custo) e definição de insumos |
| Valor para o curral | alto: número certo, sem duplicidade | baixo |

## 3. Decisão proposta

**Escopo = (a).** "Estoque" no Pesagens Individuais significa **estoque de identificadores** (visual, RFID, SISBOV, manejo), modelado por faixas e exceções, com rastreabilidade por animal. Nenhum outro insumo entra.

Consequências:

1. Não haverá store de "itens de estoque", "movimentações de estoque" ou "unidades de medida".
2. Medicamentos (hoje em sanidade) **não** ganham estoque, por este documento e por ADR-007.
3. Custo do brinco, se desejado, é um campo informativo na faixa (`custo_total`), sem valorização de saldo.
4. Ração, sal, vacinas e suplementos ficam explicitamente fora de escopo até nova ADR.

## 4. Critério para revisitar

Só reabrir (b) se o responsável decidir P-004 (método de custo) **e** houver relatório REP-304 (custo do ganho) aprovado que exija consumo de insumo por lote. Mesmo assim, a arquitetura sugere módulo separado (ADR-008), não extensão do estoque de identificadores.

## 5. Registro

DEC-002 (estratégia de estoque de identificadores) e DEC-017 (escopo de estoque) em `DECISION-REGISTER.md`.
