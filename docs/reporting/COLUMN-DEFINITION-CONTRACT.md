# Contrato da ColumnDefinition

Fonte: `src/modules/reporting/domain/columnDefinition.js` (`defineColumn`). Uma coluna declara tipo,
grãos em que existe, como ler o valor, como exibir, como filtrar, se agrupa, quais agregações fazem
sentido e se é sensível. Tela, CSV, JSON, impressão, PDF e XLSX leem **a mesma definição**.

Catálogo de colunas: `definitions/columns/eventColumns.js` (EVENT, EXIT, SHIPMENT_DOCUMENT),
`animalColumns.js` (ANIMAL_CURRENT, ANIMAL_PERIOD) e `controlColumns.js` (LOT, LOT_STAY,
SHIPMENT_DOCUMENT, AUDIT_ENTRY, DATA_ISSUE, BACKUP_ENTRY, REGISTRY_ITEM).

## 1. Campos e validações

| Campo | Obrigatório | Regra em `defineColumn` |
|---|---|---|
| `id` | sim | string |
| `label` | sim | presente |
| `type` | sim | um de `COLUMN_TYPES` (§2) |
| `grains` | sim | array não vazio; todo valor em `GRAIN_LIST`. Coluna sem `grains` é inválida (nunca significa "todos") |
| `accessor` | não | função `(row) => valor bruto`; sem ela lê `row[id]` |
| `display` | **sim para `entity`** | função `(row) => texto exibido` |
| `options` | **sim para `enum`** | array; normalizado para `{ value, label }` (string pura vira `{ value, label: String(value) }`) |
| `sensitive` | não | `commercial`, `audit` ou `personal` (`SENSITIVITY`) |
| `weighted` | não | `{ gain, days }` (ambos obrigatórios); habilita `weightedGmd` |
| `weightedBy` | não | campo (string) ou função do peso; habilita `weightedAvg` |
| `ratio` | não | `{ numerator, denominator }`; habilita `ratio` |
| `groupKey`, `groupLabel` | não | funções de chave e rótulo de grupo (§3) |
| `groupOrder` | não | função `(row) => chave de ordem` do grupo quando o rótulo não ordena (E1B: Sessão → `data|created_at` da sessão); precisa ser função |
| `zeroAsEmpty` | não | E1B: na folha, contagem 0 aparece "—" e a coluna só com zeros some (o valor continua 0 no motor e no JSON) |
| `metricOnly` | não | E1B: coluna só de cálculo (Machos, Fêmeas, animais com pesagem anterior): fora do seletor de colunas, filtros, ordenação e exportações; só alimenta agregações (`countDistinct`) |
| `aggregations` | não | lista explícita; cada item precisa estar entre as permitidas (§4), senão erro |
| `groupable` | não | só tipos categóricos (`text`, `identifier`, `enum`, `boolean`, `entity`) ou de data podem ser `true` |
| `unit`, `decimals`, `description` | não | unidade do cabeçalho ("Peso (kg)"), casas decimais, texto de ajuda |

Padrões aplicados quando o campo não é informado:

| Campo | Padrão |
|---|---|
| `source` | `'historico'` (outros valores usados: `'atual'`, `'derivado'`, `'legado-texto'`) |
| `sortable` | `true` |
| `filterable` | `true` |
| `groupable` | `false` |
| `exportable` | `true` |
| `defaultVisible` | `false` |
| `defaultWidth` | `120` (px; usado na tela e na decisão de orientação da impressão) |
| `align` | `right` para tipos numéricos, `left` para os demais |
| `sensitive`, `unit`, `decimals` | `null` |
| `aggregations` | ver §4 |

Campos calculados: `filterType` (§5); `aggregations`, `grains` e `options` congelados. `filterable` e
`exportable` são declarados, mas o núcleo atual não os consulta.

## 2. Tipos

| Grupo | Tipos |
|---|---|
| Numéricos | `number`, `integer`, `weight`, `gmd`, `percentage`, `money` |
| Datas | `date`, `datetime` |
| Categóricos | `text`, `identifier`, `enum`, `boolean`, `entity` |

`entity`: `accessor` devolve o **id** (filtro, agrupamento e animais únicos usam o id); `display` devolve o
nome (exibição, pesquisa e ordenação). `enum`: valor é o código; exibição é o rótulo de `options`.

## 3. Leitura: `valueOf`, `displayOf`, `groupKeyOf`, `groupLabelOf`

| Função | Regra |
|---|---|
| `valueOf(column, row)` | `accessor(row)` ou `row[id]` |
| `displayOf(column, row)` | `display(row)`; senão, para `enum`, o rótulo da opção; senão o valor |
| `groupKeyOf(column, row)` | `groupKey(row)`; senão, para datas, os 10 primeiros caracteres (`YYYY-MM-DD`); senão o valor |
| `groupLabelOf(column, row)` | `groupLabel(row)`; senão `displayOf` |
| `groupOrderOf(column, row)` | `groupOrder(row)`; senão `null` (o grupo ordena pelo rótulo) |

`createColumnResolver(columns)` (em `reportDefinition.js`) monta o *accessor* único usado por filtro,
ordenação, agrupamento e agregação: `valueOf`, `displayOf`, `filterValueOf` (= valor), `sortValueOf`
(nome/rótulo para `entity` e `enum`, valor para os demais), `sortType`, `filterType`, `groupKeyOf`,
`groupLabelOf`.

Exemplos de `groupKey` nas colunas de evento: marca, raça, lote e apartação exibem o texto gravado no
evento, mas agrupam pelo id quando existe (`textKey`: id ou `txt:<texto normalizado>`), para que grafias
diferentes do mesmo cadastro caiam no mesmo grupo. `numero_animal` agrupa por `animal_id` ou, em
registro legado, por `legado:<número>::<marca>`.

## 4. Agregações permitidas por tipo

`ALLOWED_BY_TYPE`, filtrado pelas declarações explícitas: `weightedAvg` só com `weightedBy`,
`weightedGmd` só com `weighted`, `ratio` só com `ratio`.

| Tipo | count | countValid | countDistinct | sum | avg | min | max | range | weightedAvg | weightedGmd | ratio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| text, identifier, enum, boolean, entity | ✓ | | ✓ | | | | | | | | |
| number, integer, money | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | com `weightedBy` | | com `ratio` |
| weight | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | com `weightedBy` | | |
| percentage | ✓ | ✓ | | | ✓ | ✓ | ✓ | ✓ | com `weightedBy` | | com `ratio` |
| gmd | ✓ | ✓ | | | ✓ | ✓ | ✓ | ✓ | | com `weighted` | |
| date, datetime | ✓ | ✓ | | | | ✓ | ✓ | | | | |

Observações: `gmd` e `percentage` não somam (somar GMD ou percentuais não tem significado).

Padrão quando `aggregations` não é informado (`defaultAggregations`, interseção com as permitidas):

| Tipo | Padrão |
|---|---|
| `gmd`, `percentage` | `avg`, `min`, `max` |
| demais numéricos | `sum`, `avg`, `min`, `max`, `range` |
| datas | `min`, `max` |
| categóricos | `countDistinct` |

Rótulos (`AGGREGATION_LABELS`): Contagem de registros, Contagem de valores, Distintos, Soma, Média
simples, Mínimo, Máximo, Amplitude, Média ponderada, GMD ponderado, Razão.

## 5. Tipo de filtro derivado

`filterTypeOfColumnType`: numéricos → `number`; datas → `date`; `enum` → `enum`; `boolean` → `boolean`;
`entity` → `entity`; `text`/`identifier` → `text`. Operadores por tipo: FILTER-CONTRACT.md.

## 6. Ponderação e razão — exemplos reais

| Coluna | Declaração | Cálculo do total |
|---|---|---|
| `gmd` (EVENT e ANIMAL_PERIOD) | `weighted: { gain: 'ganho', days: 'dias' }` | GMD ponderado = Σ ganho ÷ Σ dias (pares válidos com dias > 0) |
| `valor_arroba`, `valor_arroba_abate` | `weightedBy: 'quantidade_arrobas'` | Preço médio da @ ponderado pelas arrobas |
| `rendimento_carcaca` | `weightedBy: 'peso'` | Rendimento médio ponderado pelo peso |
| `peso_medio_atual` (LOT) | `weightedBy: 'animais_com_peso'` | Peso médio do grupo ponderado pelos animais com peso |
| `ocupacao` (LOT) | `ratio: { numerator: 'animais_x100_com_capacidade', denominator: 'capacidade' }` | Σ(animais × 100) ÷ Σ capacidade, só lotes com capacidade |

## 7. Sensibilidade

| `sensitive` | Permissão exigida para ver | Colunas atuais |
|---|---|---|
| `commercial` | `commercial.values` | `valor_pago_cabeca`, `valor_venda_total`, `valor_arroba`, `quantidade_arrobas`, `peso_carcaca_estimado` (canal lateral: arrobas = carcaça ÷ 15), `valor_arroba_abate`, `valor_total_abate` |
| `audit` | `audit.read` | `usuario` (AUDIT_ENTRY) |
| `personal` | `users.manage` | `login` (REGISTRY_ITEM de usuários) |

Além disso, qualquer coluna cujo id case com `FORBIDDEN_FIELD_PATTERN` (senha, salt, hash, token,
recuperação, segredo, credencial…) nunca é visível. Detalhes: PERMISSIONS.md.
