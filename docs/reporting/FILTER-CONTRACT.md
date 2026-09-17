# Contrato de filtros

Fonte: `src/modules/reporting/domain/filterEngine.js`. Motor compartilhado por relatórios e pela Relação
de Pesagens (extraído de `matchesMakColumnFilter` e corrigido). Funções puras: o mesmo filtro produz a
mesma população na tela, no relatório e na exportação.

## 1. Forma serializável

```js
{ operator: 'between', value: '300', valueTo: '450', values: [] }
```

- `normalizeFilter(filter, filterType)`: objeto → campos preenchidos (`operator` ausente = operador
  padrão do tipo; `values` convertidos em string, `null`/`undefined` viram `''`); **string pura** →
  `{ operator: <padrão>, value: <string> }`.
- `isFilterActive(filter)`: ativo se o operador for `empty`/`not_empty`, se `values` não estiver vazio,
  se `value` for booleano, ou se `value` (sem espaços) não for vazio.
- `serializeFilters(filters)`: remove filtros inativos e grava `{ operator (ou null), value, valueTo,
  values }` — forma estável usada em modelos salvos, no view model e no manifesto.

Operador padrão (`defaultOperatorFor`): `text` → `contains`; `number` → `between`; `date` → `equals`;
`boolean` → `equals`; `enum`/`entity` → `in`.

## 2. Operadores por tipo (`FILTER_OPERATORS`)

| Operador | text | number | date | enum | boolean | entity |
|---|---|---|---|---|---|---|
| `contains` | ✓ | ✓ | ✓ | | | |
| `not_contains` | ✓ | | | | | |
| `equals` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `not_equals` | ✓ | ✓ | ✓ | ✓ | | ✓ |
| `starts_with`, `ends_with` | ✓ | | | | | |
| `greater`, `greater_equal`, `less`, `less_equal` | | ✓ | | | | |
| `before`, `after`, `on_or_before`, `on_or_after` | | | ✓ | | | |
| `between`, `not_between` | | ✓ | ✓ | | | |
| `in`, `not_in` | ✓ | ✓ | ✓ | ✓ | | ✓ |
| `empty`, `not_empty` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Tipo de filtro desconhecido → `Error`.

## 3. Semântica (`matchesFilter(rawValue, filter, filterType)`)

`rawValue` é o valor canônico da coluna: id para entidade, código para enum, número para numéricos,
`YYYY-MM-DD` para datas. Ordem de avaliação:

1. Filtro inativo → casa.
2. `empty` / `not_empty`: vazio = `null`, `undefined` ou string só com espaços.
3. **Lista** (quando `values` não está vazio **ou** o operador é `in`/`not_in`).
4. Regras do tipo.

### 3.1 Listas (`in` / `not_in`)

- A lista e o valor são comparados na forma do tipo: número → texto numérico normalizado; data → data
  civil; `entity`/`enum`/`boolean` → texto exato (código/id); `text` → texto normalizado (sem acento e
  sem caixa).
- Valor vazio **nunca** é encontrado na lista.
- Com lista, `not_in`, `not_equals` e `not_contains` são negativos (casam quando **não** encontrado —
  inclusive valores vazios); qualquer outro operador com lista é tratado como `in`.

### 3.2 Texto (acento e caixa ignorados)

`normalizeText`: decomposição NFD, remoção de diacríticos, minúsculas, espaços colapsados, `trim`.
"Nelore" = "nelore" = "NELORÉ". `contains` (padrão), `not_contains`, `equals`, `not_equals`,
`starts_with`, `ends_with` sobre os textos normalizados.

### 3.3 Número (vírgula decimal)

- Conversão aceita `1234,5`, `1234.5` e `1.234,5` (milhar com ponto e decimal com vírgula).
- `contains`: compara o texto numérico normalizado (`"45,5"` encontra `345.5`); vazio não casa.
- Comparações (`equals`, `not_equals`, `greater`…): se o valor da linha **ou** o valor do filtro não for
  número, **não casa** — inclusive em `not_equals`. Ausente nunca vira 0.
- `between` / `not_between`: limites em qualquer ordem (usa mínimo e máximo); sem `valueTo` numérico não
  casa; intervalo fechado.

### 3.4 Datas civis

- Sem fuso: comparação de texto `YYYY-MM-DD`. Entrada `dd/mm/aaaa` é convertida; valores com hora são
  cortados nos 10 primeiros caracteres.
- `equals` (padrão), `not_equals`, `before` (<), `after` (>), `on_or_before` (≤), `on_or_after` (≥),
  `between`/`not_between` (limites ordenados, fechado), `contains` (substring do texto civil).
- Linha ou filtro sem data válida → não casa.

### 3.5 Enum, entity e boolean

- `enum`/`entity` sem lista: `equals` compara o código/id exato; `not_equals` é a negação. A entidade
  **compara o id, nunca o nome**.
- `boolean`: `true`, `"true"`, `"sim"` e `"1"` são verdadeiros; valor vazio não casa.

## 4. Pílula de texto sobre enum/entity (`matchesAccessor`)

A pílula e o menu de coluna da tela oferecem controles de **texto, número e data**
(`reportUi.pillFilterType`). Para `enum` e `entity`:

- operadores só de texto (`contains`, `not_contains`, `starts_with`, `ends_with`) **sem lista** casam com
  o código/id **ou** com o rótulo exibido (`displayOf`), em modo texto; `not_contains` é a negação de
  "casou em algum dos dois";
- listas e igualdade continuam pelo código/id.

Na tela, a pílula lista **valores exibidos** (nome da entidade, rótulo do enum) tirados de
`viewModel.population` (até 500 valores distintos). `reportUi.toEngineFilters` converte cada rótulo
marcado em **todos os ids** que exibem aquele rótulo na população base (operador `in`, ou `not_in` para
os negativos); se nenhum id corresponder, a lista vira `['__nenhum__']` (população vazia).

## 5. Aplicação (`applyFilters(rows, criteria, resolve)`)

- `criteria = { search, searchColumnIds, filters }`.
- Pesquisa: o termo normalizado precisa estar contido no texto concatenado dos `displayOf` das colunas de
  pesquisa.
- Filtros de coluna: **AND** entre colunas. Coluna desconhecida → `Error`.
- Sem filtros ativos e sem pesquisa, devolve o próprio array (sem cópia).

## 6. Pré-filtro por índice, depois predicado em memória

1. **Na fonte** (IndexedDB): o período restringe a leitura por índice — `pesagens.data_pesagem` entre
   `from` e `to` inclusive (`index:data_pesagem`); auditoria por `auditoria.created_at`; permanências por
   `animalLotes.inicio`; entidades referenciadas por `anyOf` no índice `id`. `sourceOptions.tipos`
   (Cadastro/Saída) é aplicado durante a transformação das linhas lidas.
2. **Em memória**: `lockedFilters(params)` sobre as linhas carregadas → população base.
3. **Em memória**: pesquisa + filtros do usuário.

Filtros de coluna do usuário nunca são convertidos em consulta indexada. O gate
`reports:index-prefilter:verify` usa `lastEventQuery()` (`eventSource.js`) para provar a estratégia de
leitura; `reports:filters:verify` cobre a semântica acima.

## 7. Permissão e filtros

Em `resolveSelection`, filtro em coluna que o papel não pode ver é removido com o aviso
`FILTER_REMOVED_BY_PERMISSION`. Um modelo salvo com filtro em coluna invisível ao autor é recusado; ao
abrir um modelo, filtros em colunas inexistentes ou sem permissão são descartados com aviso.
