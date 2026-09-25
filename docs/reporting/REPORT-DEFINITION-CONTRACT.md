# Contrato da ReportDefinition

Fonte: `src/modules/reporting/domain/reportDefinition.js` (`defineReport`). Uma definição é código
(Modelo 1): fixa grão, fonte, colunas permitidas, padrões e permissões. Modelos salvos (Modelo 2
pessoal / Modelo 3 compartilhado) só escolhem **dentro** do que a definição permite.

`defineReport(spec)` valida e devolve um objeto congelado (`Object.freeze`). A primeira inconsistência
lança `Error` — como as definições são construídas na carga do módulo, uma definição inválida impede o
catálogo de carregar.

## 1. Campos

| Campo | Obrigatório | Tipo / valores | Validação em `defineReport` | Padrão |
|---|---|---|---|---|
| `id` | sim | string única (`família.nome`) | presente; duplicidade verificada em `reportCatalog.js` | — |
| `title` | sim | string | presente | — |
| `family` | sim | chave de `REPORT_FAMILIES`: `rebanho`, `pesagens`, `desempenho`, `movimentacao`, `saidas`, `comercial`, `embarques`, `controle`, `cadastros` | pertence ao mapa | — |
| `grain` | sim | valor de `GRAINS` (ver GRAIN-CONTRACT.md) | `assertGrain` | — |
| `version` | sim | inteiro ≥ 1 | `Number.isInteger` e ≥ 1 | — |
| `requires` | sim | array de ações da `MATRIX` | deve incluir `reports.read` | — |
| `status` | não | `'available'` ou `'blocked'` | — | `'available'` |
| `blockedReason` | se bloqueado (convenção) | string exibida ao usuário | não validado | — |
| `source` | sim, exceto bloqueado | id registrado em `reportSources/index.js` | presente | — |
| `sourceOptions` | não | ex.: `{ tipos: ['Saída'] }` (repassado à fonte `events.byPeriod`) | — | — |
| `columns` | sim, exceto bloqueado | array de `ColumnDefinition` | não vazio; **toda coluna precisa declarar o grão do relatório**; ids únicos | — |
| `defaultColumns` | não | ids | ids existem | colunas com `defaultVisible: true` |
| `searchColumns` | não | ids usados pela pesquisa rápida | ids existem | `[]` |
| `defaultFilters` | não | `{ columnId: filtro }` | ids existem | — |
| `lockedFilters` | não | **função** `(params) => filtros` | deve ser função | — |
| `defaultSort` | não | `[{ columnId, direction }]` | id existe e coluna `sortable` | `[]` |
| `defaultGroups` | não | `[{ columnId, direction? }]` | ≤ 3 níveis; coluna `groupable` | `[]` |
| `defaultAggregates` | não | `[{ id?, columnId?, op }]` | `op` permitido na coluna (`count` sem coluna é sempre válido); `countDistinct` na coluna `animal` só em grão com animal | `[]` |
| `params` | não | `[{ id, type, label, required?, default?, min? }]` | `id` presente e `type` ∈ `period`, `integer`, `date`, `ranges` | `[]` |
| `periodExemption` | não | string justificando ausência de período obrigatório | ver §3 | — |
| `description`, `notes`, `metrics` | não | textos exibidos no catálogo, na tela, na impressão e no JSON | — | `''`, `[]`, `[]` |
| `classification` | não | valor de `DATA_CLASSIFICATION` | — | `CANÔNICO` |
| `presetOf` | não | id do "relatório-pai" de uma família de variações | — | — |
| `animalColumnId` | não | id da coluna do animal | — | — |

Campo calculado: `sensitivities` = sensibilidades distintas das colunas (`commercial`, `audit`, `personal`).

## 2. `defaultFilters` × `lockedFilters`

| | `defaultFilters` | `lockedFilters` |
|---|---|---|
| Natureza | Filtro inicial do usuário | Condição que define o relatório |
| Forma | Objeto de filtros | Função `(params) => filtros` (pode depender dos parâmetros) |
| Quando é aplicado | Quando a seleção não traz `filters` (`resolveSelection`); a tela também parte dele | Sempre, **antes** dos filtros do usuário, sobre as linhas carregadas (`runReport`) |
| Pode ser removido | Sim (pílula comum; "Limpar") | Não; aparece como pílula com cadeado na tela e com "(fixo)" na impressão |
| Vai para o manifesto | Em `filters` | Em `lockedFilters` |
| Salvo em modelo | Sim (como filtro do usuário) | Não (é recalculado pela definição) |
| Exemplos | Rebanho: `situacao in [ATIVO]` (exceto "Rebanho por situação") | `desempenho.perdendo-peso`: `ganho < 0`; `saidas.mortes*`: `motivo_saida in [Morte]`; `rebanho.sem-pesagem-recente`: `situacao in [ATIVO]` e `dias_sem_pesagem > params.dias_sem_pesagem` |

A população após `lockedFilters` é guardada em `viewModel.population` e alimenta as opções das pílulas.

## 3. Parâmetros (`params`)

Resolvidos em `reportService.resolveParams`:

| Tipo | Forma do valor | Resolução | Uso atual |
|---|---|---|---|
| `period` | `{ preset }` ou `{ preset: 'personalizado', from, to }` | `resolvePeriod(value, today)` → `{ preset, label, from, to, days }`; sem valor e `required` → erro "período obrigatório" | EVENT, EXIT, ANIMAL_PERIOD, LOT_STAY, AUDIT_ENTRY (obrigatório); `embarques.previsto-realizado` (opcional) |
| `integer` | número | `input ?? default`; precisa ser inteiro e ≥ `min` quando declarado, senão erro | `rebanho.sem-pesagem-recente` (`dias_sem_pesagem`, padrão 30, mínimo 1) |
| `ranges` | `[{ label, min, max }]` | repassado; a fonte de animais usa essas faixas ou, sem elas, as faixas das categorias com peso configurado | Rebanho e Desempenho (`faixas`) |
| `date` | — | aceito pela validação e repassado sem transformação | nenhuma definição usa hoje |

Presets de período (`domain/reportPeriod.js`; datas civis `YYYY-MM-DD`; intervalo fechado): `hoje`,
`ontem`, `ultimos_7_dias`, `ultimos_30_dias`, `ultimos_90_dias`, `ultimos_365_dias`, `mes_atual`,
`mes_anterior`, `ano_atual`, `personalizado` (datas invertidas são trocadas; datas inválidas → erro).
Sem preset e sem datas, `resolvePeriod` assume `ultimos_30_dias`. O preset é resolvido **na emissão**
com o `today` do momento, e o intervalo resolvido vai para o manifesto.

**Período obrigatório por grão:** para `EVENT`, `ANIMAL_PERIOD` e `EXIT` (não bloqueados),
`defineReport` exige um parâmetro `period` com `required: true` ou um `periodExemption` justificado.
As fontes `events.byPeriod`, `animals.period`, `lotStays.byPeriod` e `audit.byPeriod` também lançam erro
se chamadas sem período. As definições de `LOT_STAY` declaram `periodExemption` ("LOT_STAY usa o
período como interseção") e, mesmo assim, período obrigatório.

## 4. Relatórios bloqueados (`status: 'blocked'` + `blockedReason`)

`status: 'blocked'` dispensa `source` e `columns`. Efeitos:

- Desde a 1.4.0 o bloqueado tem `visibility: 'hidden'` (padrão de `blocked(...)`): não aparece em
  nenhuma tela. `listReports(actor, { visibility: 'hidden' })` ainda o devolve com `available: false` e
  `blockedReason` para qualquer papel (backlog), e `resolveReportId` continua achando o id.
- `assertCanRunReport` verifica primeiro `requires` e depois lança erro com `code = 'REPORT_BLOCKED'`
  ("Relatório indisponível: <motivo>").
- `canRunReport` retorna `false`; modelos de relatórios bloqueados não são listados nem salvos.

Os bloqueados são criados pela função `blocked(...)` em `definitions/controle.js` (lista e motivos em
REPORT-CATALOG.md).

## 4.1 Visibilidade, modo padrão e visões antigas (1.4.0)

| Campo / função | Regra |
|---|---|
| `visibility` | `'catalog'` (os 12 de Relatórios), `'maintenance'` (aba Controle da Manutenção) ou `'hidden'` (cadastros.* e bloqueados). Padrão: `hidden` se bloqueado, senão `catalog`. |
| `defaultMode` | `'RESUMIDO'` ou `'DETALHADO'`. Padrão: Resumido quando há `defaultGroups`. |
| `quickFilters` | `[{ id, label, filters }]` — atalhos de um clique na faixa de filtros. |
| `quickGroups` | ids de colunas `groupable` oferecidos no "Agrupar por" rápido (o agrupamento padrão sempre entra). |
| `listReportDefinitions({ visibility })` | só as definições daquela área (padrão `catalog`). |
| `listAllReportDefinitions()` | todas as definições (gates e ferramentas). |
| `resolveReportId(id)` | `{ definition, aliasId, alias }`: id atual ou id antigo consolidado (`LEGACY_REPORT_ALIASES`). `getReportDefinition(idAntigo)` devolve a definição nova. |
| `listReports(actor, { visibility })` | resumo por área, filtrado pelo papel (bloqueados só na área `hidden`). |

## 4.2 Tipos de relatório, rótulos e pares da folha (E1B 1.4.0)

| Campo / função | Regra |
|---|---|
| `views` | `[{ id, label, description?, groups, mode, aggregates?, columns?, sort?, summarySort?, filters? }]` — os "Tipos de relatório" da barra. `defineReport` valida: id único, `groups` só com colunas `groupable` (≤ 3, direção `asc`/`desc`), `mode` válido, agregações/colunas/ordem existentes, chave desconhecida recusada. Pesagens declara `por-apartacao-data` (Apartação › Data desc › Lote, Resumido), `por-lote`, `por-data` (sem a faixa) e `analitico`. |
| `listReportViews(definition)` | visões declaradas; se nenhuma reproduz o agrupamento padrão, entra primeiro a gerada **"Resumo por <nível>"** (`padrao`, no `defaultMode`); sem nenhuma visão Detalhado, entra **"Analítico"** no fim. |
| `viewSelection(view, definition)` / `matchView(definition, { groups, mode })` | seleção da visão (sem `drill`) / id da visão que casa com o estado atual, senão `null` ("Personalizado"). |
| `metricLabels` | `{ <id da agregação>: 'rótulo de curral' }` — cabeçalho da folha, dos arquivos e chips (ex.: `qtd` → "Qtd"). Rótulo vazio recusado. |
| `metricPairs` | `[{ id, label, from, to, leafOnly?, leafColumnId?, unit? }]` — duas agregações que viram UMA coluna "de–até" na folha (Faixa exigida = `faixa_min`–`faixa_max`). `leafColumnId`: o par só vale quando o nível folha do agrupamento é essa coluna; fora dele as duas métricas vão para `vm.hiddenMetrics` e saem de todos os canais. `leafOnly`: preenchido só nas linhas do nível folha (vazio acima e no Total geral). |

View model (E1B): `arrobaDivisor` (30|15 — `request.arrobaDivisor` ou Configurações › Relatórios; outro
valor → erro), `metricLabels`, `metricPairs` (só os pares ativos), `hiddenMetrics`.

Estado por usuário (não é modelo): `saveReportViewState`/`getReportViewState`
(`report-view-state:<empresa>:<usuário>` em appSettings, sem auditoria) guardam a última seleção de cada
relatório + `showEmptyColumns`; a tela reabre por ele quando não há modelo nem visão antiga na URL.
Modelo antigo sem `mode`: Resumido se tiver agrupamento, senão Detalhado (`templateToRequest`).

Condições dos relatórios antigos (`alias.fixed`): viram filtros comuns com `match: 'code'`; quando a
seleção também filtra a mesma coluna, a condição vai para `selection.fixedFilters` e é aplicada como as
`lockedFilters` da definição (o catálogo recusa alias com condição fixa apontando para relatório com
`lockedFilters` próprias).

## 5. Classificação dos dados

`DATA_CLASSIFICATION`:

| Valor | Significado | Onde aparece |
|---|---|---|
| `CANÔNICO` (padrão) | Dados canônicos do sistema (ids, projeções, eventos) | Não é destacado |
| `COMERCIAL — DADOS LEGADOS/POR EVENTO` | Valores e parceiros vêm do texto gravado em cada lançamento; não há vínculo canônico por parceiro nem operação comercial agregada | Selo no card do catálogo, na tela do relatório e no cabeçalho impresso/PDF; campo `classification` no manifesto, no JSON e no view model |

Usado por `comercial.vendas`, `comercial.abates` e `comercial.compras` (`definitions/operacional.js`).

## 6. `presetOf`

Marca variações geradas da mesma base (mesmas colunas e totais, agrupamento padrão diferente):
`rebanho.dimensao`, `desempenho.dimensao`, `saidas.mortes` e `cadastros`. O campo é exposto por
`listReports`; o catálogo atual lista cada variação como um card próprio e não usa o campo para agrupar.

## 7. `animalColumnId`

Id da coluna que identifica o animal: `numero_animal` nos grãos EVENT/EXIT; `animal` em ANIMAL_CURRENT,
ANIMAL_PERIOD e LOT_STAY. Usos:

- `runReport` calcula `uniqueAnimalCount` = quantidade de `groupKeyOf` distintos e não vazios na
  população final, **somente** se o grão tiver animal (`grainHasAnimal`) e o campo estiver declarado;
  senão `null` (a tela não mostra "Animais únicos").
- O diálogo **Totais** rotula `countDistinct` dessa coluna como "Animais únicos".

`embarques.previsto-realizado` (SHIPMENT_DOCUMENT) e os relatórios de LOT, controle e cadastros não
declaram `animalColumnId`.

## 8. Resolução da seleção contra a definição

`reportService.resolveSelection(definition, selection, role)`:

- colunas pedidas (ou `defaultColumns`); id desconhecido → erro; colunas sem permissão → removidas com
  aviso `COLUMNS_HIDDEN_BY_PERMISSION`;
- filtros (ou `defaultFilters`) serializados; filtro em coluna sem permissão → removido com aviso
  `FILTER_REMOVED_BY_PERMISSION`;
- ordenação (ou `defaultSort`) sem as colunas invisíveis ao papel;
- grupos (ou `defaultGroups`): ≤ 3 e `groupable`; coluna sem permissão → erro `AUTH_FORBIDDEN`;
- agregações (ou `defaultAggregates`) validadas por `assertAggregateSpec`; as de colunas invisíveis são
  descartadas;
- `searchColumns` filtradas pelo papel.
