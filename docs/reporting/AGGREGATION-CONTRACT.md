# Contrato de agregação, subtotais e total geral

Fontes: `src/modules/reporting/domain/aggregateEngine.js` (motor), `reportAggregates.js` (liga
especificações às colunas) e `groupEngine.js` (árvore de grupos).

## 1. Semântica obrigatória

| Regra | Implementação |
|---|---|
| **null ≠ 0** | `toFiniteNumber` converte para número finito ou `null` (`null`, `undefined`, `''`, `NaN`, booleano e texto não numérico → `null`). Valor ausente é **excluído** e contado em `n_ausentes`. |
| Sem valor válido → `null` | `sum`, `avg`, `min`, `max`, `range`, `weightedAvg`, `ratio` devolvem `value: null` (a tela mostra "—"), nunca 0. |
| `count` conta registros | `count(rows)` = quantidade de linhas, sem olhar valor. |
| `countDistinct` conta chaves | Chaves distintas (em `reportAggregates`, pela `groupKeyOf` da coluna — ex.: id do animal). Nunca é somado entre grupos. |
| Pares válidos | `weightedAvg` e `ratio` só usam linhas com as duas pontas presentes. |
| Sem arredondamento | Nenhum arredondamento no motor; arredondar é papel de `formatCell`. |
| Motor puro | Cada função opera sobre a população recebida. Subtotal e total geral chamam o motor de novo sobre a própria população. |

Conversão numérica aceita `1234,5`, `1234.5` e `1.234,5`.

## 2. Formato do resultado

```js
{ value, n_validos, n_ausentes, n_total }            // + numerator/denominator em ratio
```

| Operação | `value` | `n_validos` | `n_ausentes` |
|---|---|---|---|
| `count` | nº de linhas | nº de linhas | 0 |
| `countValid` | nº de valores numéricos | idem | linhas sem número |
| `countDistinct` | nº de chaves distintas | linhas com chave | linhas sem chave (`null`, `undefined`, `''`) |
| `sum` / `avg` / `min` / `max` / `range` | resultado sobre os valores válidos, ou `null` | valores numéricos | não numéricos |
| `weightedAvg` | Σ(valor × peso) ÷ Σ peso, só com valor e peso válidos e **peso > 0** | pares usados | `n_total − pares` |
| `ratio` | Σ numerador ÷ Σ denominador, só com as duas pontas válidas e **denominador > 0** (padrão `requirePositiveDenominator`) | pares usados | `n_total − pares` |
| `weightedGmd` | `ratio(ganho, dias)` | pares usados | `n_total − pares` |

Datas: em `reportAggregates`, `min`/`max` de colunas `date`/`datetime` comparam o texto (até 19
caracteres) e ignoram vazios (`dateExtreme`).

A tela e a impressão mostram "**n de N**" (`n_validos de n_total`) ao lado do valor quando há ausentes e a
operação não é `count`/`countDistinct` (ex.: "Média simples — Peso (kg): 150,00 (2 de 3)").

## 3. Especificação serializável

`{ id?, columnId?, op }`. Validação (`assertAggregateSpec`): `op` obrigatório; `count` sem coluna é
sempre válido; com coluna, a coluna precisa existir e `op` precisa estar em `column.aggregations`.
`aggregateSpecId` = `id` ou `<op>:<columnId|*>`. Leitores por operação:

| op | Leitura |
|---|---|
| `countDistinct` | `accessor.groupKeyOf(row)` |
| `weightedAvg` | valor da coluna × `column.weightedBy` |
| `weightedGmd` | `column.weighted.gain` ÷ `column.weighted.days` |
| `ratio` | `column.ratio.numerator` ÷ `column.ratio.denominator` |
| demais | `accessor.valueOf(row)` |

## 4. Grupos (`groupEngine.groupRows`)

| Regra | Detalhe |
|---|---|
| Máximo de níveis | `MAX_GROUP_LEVELS = 3`; mais que isso → `Error` (também validado na definição, na seleção e nos modelos) |
| Coluna agrupável | coluna precisa ser `groupable`; a mesma coluna não pode repetir em dois níveis |
| Chave e rótulo | `groupKeyOf` / `groupLabelOf` da coluna (id para entidade; data cortada em `YYYY-MM-DD`) |
| "Não informado" | chave ausente (`null`, `undefined`, texto vazio) → grupo `__nao_informado__` com rótulo **"Não informado"**, sempre por **último** |
| Ordem dos grupos | por rótulo com collator pt-BR (sem acento/caixa, numérico), `asc` ou `desc` por nível |
| Ordem das linhas | a ordem da população (já ordenada por `sortRows`) é preservada dentro do grupo |
| Saída | árvore estrutural (nunca HTML): `{ id, level, columnId, columnLabel, key, label, missing, path, rowCount, rows, aggregates, children }` |

**Subtotal recalculado sobre a população do grupo:** cada nó chama `computeAggregates(bucket.rows, ...)`
com as próprias linhas. O pai recalcula contra as próprias linhas, nunca soma filhos — por isso
`countDistinct`, médias, médias ponderadas e razões ficam corretos em qualquer nível.

**Total geral sobre o dataset final filtrado:** `runReport` calcula
`computeAggregates(sorted, aggregates)` sobre a população final (após `lockedFilters`, pesquisa e filtros
do usuário) — nunca a soma dos subtotais. A paginação da tela não afeta subtotais nem total geral.

`flattenTree` percorre em profundidade: `GROUP`, linhas `DATA` (só nas folhas), filhos, `SUBTOTAL`.

## 5. Exemplos

### 5.1 null ≠ 0 — média simples de 100, ausente, 200

| Linha | Peso |
|---|---|
| 1 | 100 |
| 2 | (ausente) |
| 3 | 200 |

`avg` = (100 + 200) ÷ 2 = **150** · `n_validos` = 2 · `n_ausentes` = 1 · `n_total` = 3.
Se o ausente virasse 0, a média seria 100 — errado. Tela: "150,00 (2 de 3)".

### 5.2 GMD simples × GMD ponderado

| Animal | Ganho | Dias | GMD individual |
|---|---|---|---|
| A | 10 kg | 10 | 1,000 |
| B | 40 kg | 20 | 2,000 |

- **GMD simples** (`avg` de `gmd`) = (1,0 + 2,0) ÷ 2 = **1,500** kg/dia.
- **GMD ponderado** (`weightedGmd` = Σ ganho ÷ Σ dias) = (10 + 40) ÷ (10 + 20) = 50 ÷ 30 = **1,667** kg/dia.

O ponderado é o GMD do grupo: dá mais peso a quem ficou mais tempo. Animais sem par válido (ganho ou
dias ausentes, ou dias = 0) não entram no ponderado e aparecem no "n de N".

### 5.3 Registros × animais únicos (grão EVENT)

| Pesagem | Animal |
|---|---|
| 1, 2, 3 | A |
| 4, 5 | B |

`count` = **5 registros** · `countDistinct(numero_animal)` = **2 animais**.

Se A estiver no lote 1 (pesagens 1–2) e no lote 2 (pesagem 3), e B no lote 2:
subtotal lote 1 = 2 registros / 1 animal; subtotal lote 2 = 3 registros / 2 animais; **total geral =
5 registros / 2 animais** (não 3 — animais únicos não são somados).

## 6. Totais padrão por família (exemplos)

| Relatórios | Totais padrão |
|---|---|
| Pesagens (`pesagens.periodo`, `sessao`, `lote`) | Registros; Animais únicos; Peso médio, mínimo e máximo; GMD ponderado |
| Rebanho | Animais únicos; Peso total, médio, mínimo e máximo (peso atual) |
| Desempenho | Animais; soma de pesagens; peso inicial/final médios; ganho total e médio; GMD ponderado; GMD simples |
| Ocupação de lotes | Lotes; Σ animais; Σ capacidade; ocupação = razão; peso médio ponderado |
| Comercial (vendas/abates) | Cabeças; peso total; arrobas; valor; preço da @ ponderado pelas arrobas |

O usuário pode alterar os totais no diálogo **Totais**, que só oferece as operações de
`column.aggregations`.
