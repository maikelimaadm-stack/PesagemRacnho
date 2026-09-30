# Orçamento de desempenho dos relatórios

Fontes: `src/modules/reporting/infrastructure/reportSources/*.js`, `application/reportService.js`,
`src/components/reports/ReportTable.jsx` e `src/modules/perf/reportBench.js`.

## 1. Estratégia

| Regra | Implementação |
|---|---|
| **Período obrigatório** para `EVENT`, `ANIMAL_PERIOD` e `EXIT` | `defineReport` recusa definição desses grãos sem parâmetro `period` obrigatório (ou `periodExemption`); as fontes `events.byPeriod`, `animals.period`, `lotStays.byPeriod` e `audit.byPeriod` recusam execução sem período. Nenhum relatório de eventos lê a base inteira. |
| **Índice `data_pesagem`** | `loadEventRows`: `pesagens.where('data_pesagem').between(from, to, true, true)`; estratégia registrada como `index:data_pesagem` (ou `full-scan` só quando chamado sem período, caso da Relação de Pesagens). `lastEventQuery()` expõe a última estratégia ao gate `reports:index-prefilter:verify`. |
| **Projeção `animais` para estado atual** | `ANIMAL_CURRENT` lê a projeção (`projection:animais`), sem reconstruir histórico a partir das pesagens. E1G (1.4.2): para Peso/Data de entrada, Ganho/Dias/GMD desde a entrada e Último GMD, lê também, **pelo índice**, os Cadastros (`pesagens.tipo_pesagem`) e só as pesagens gravadas nas datas da última pesagem da projeção (`pesagens.data_pesagem`: uma consulta `equals` por data, na mesma transação de leitura — nem `anyOf`, lento no fake-indexeddb, nem o intervalo entre a data mais antiga e a mais recente, que com vendidos e mortos no rebanho virava a base inteira) — nunca uma consulta por animal (`projection:animais+index:pesagens(cadastro,ultima)`). Com as datas agrupadas em apartes (o uso real), lê poucas pesagens; com datas espalhadas no ano (massa sintética 36k: 390 datas cobrindo 33,6 mil das 36 mil pesagens), lê quase toda a base uma vez (p95 medido 2,5 s em Node + fake-indexeddb, orçamento 3 s). `LOT` usa o índice `animais.situacao = ATIVO`. |
| **Lookups por `anyOf`** | Entidades referenciadas pelas linhas lidas (animais, sessões) são buscadas por `where('id').anyOf(ids)`; permanências por `animalLotes.animal_id anyOf`. Cadastros (marcas, raças, categorias, apartações, lotes, usuários) são stores pequenas lidas inteiras. |
| Outras leituras indexadas | Auditoria: `auditoria.created_at` between; permanências: `animalLotes.inicio ≤ fim`; embarques e qualidade dos dados: `pesagens.tipo_pesagem`. |
| **Paginação só de apresentação** | `ReportTable` fatia as linhas achatadas (50, 100 — padrão —, 250 ou 500 por página). Subtotais e total geral são sempre da população inteira filtrada. Exportação e impressão usam a população inteira. |
| **Sem cache** | Cada execução relê a fonte. A tela reexecuta 200 ms após a última mudança (período, filtros, colunas, grupos, totais, ordenação) e no botão **Atualizar**. Execuções antigas que terminam depois são descartadas (sequência). |
| Custo de CPU contido | `sortRows` pré-calcula as chaves de ordenação uma vez por linha; `groupRows` distribui em *buckets* em uma passada por nível; os filtros ativos e os *accessors* de pesquisa são resolvidos uma vez antes do laço. Agregações são recalculadas por nó de grupo (correção acima de custo). |
| Opções das pílulas | até 500 valores distintos lidos da população base (`pillOptions`). |
| Instrumentação | `viewModel.stats`: `strategy`, `rowsRead`, `rowsLoaded`, `rowsOut` e `timings` (`query`, `transform`, `load`, `filter`, `sort`, `group`, `aggregate`, `total`); a tela mostra "N ms · estratégia". |

## 2. Cenários medidos (`runReportBenchmark`)

| Cenário | Relatório | Período | Agrupamento |
|---|---|---|---|
| `pesagens_30d` | `pesagens.periodo` | 30 dias | — |
| `pesagens_365d` | `pesagens.periodo` | 365 dias | — |
| `inventario_atual` | `rebanho.inventario` | — | — |
| `desempenho_por_animal_365d` | `desempenho.individual` | 365 dias | — |
| `agrupamento_1_nivel_365d` | `pesagens.periodo` | 365 dias | marca |
| `agrupamento_3_niveis_365d` | `pesagens.periodo` | 365 dias | marca › sexo › lote |
| `csv_365d` | `prepareEmission(..., 'csv')` sobre o resultado de 365 dias | — | — |
| `view_model_365d_sem_consulta` | soma de filtro + ordenação + agrupamento + agregação de `pesagens_365d` (sem leitura) | — | — |

Cada amostra mede a execução completa (`total`), as fases do `stats.timings` e a preparação de tela
(árvore achatada + formatação da primeira página de 100 linhas, como a `ReportTable`); em Node registra
também a variação de heap. O período termina na data da pesagem mais recente da massa. Ator do benchmark:
ADMIN.

## 3. Orçamentos (`REPORT_BENCH_BUDGETS_MS`)

p95 em milissegundos, massa **36k**, medidos em Node + fake-indexeddb (mais lento que o IndexedDB real
do aplicativo). Um cenário passa quando `p95 ≤ limite`.

| Cenário | Limite p95 (ms) |
|---|---|
| `pesagens_30d` | 1500 |
| `pesagens_365d` | 6000 |
| `inventario_atual` | 3000 |
| `desempenho_por_animal_365d` | 7000 |
| `agrupamento_1_nivel_365d` | 6500 |
| `agrupamento_3_niveis_365d` | 7000 |
| `csv_365d` | 2500 |
| `view_model_365d_sem_consulta` | 1500 |

Massas sem orçamento declarado (ex.: `250k`, `pequena`) são medidas e registradas, mas não aprovadas ou
reprovadas por `runReportBenchmark` (`budgets: null`).

## 4. Como medir

| Comando (`package.json`) | O que faz |
|---|---|
| `npm run perf:reports` | `scripts/measure-report-performance.mjs --mass=36k,250k --samples=3`, grava em `docs/evidence/reporting-program/R5-report-families-performance/bench` |
| `npm run reports:performance:verify` | gate de desempenho (`scripts/verify-reports-performance.mjs`) |

## 5. Medições

Os números medidos (p50/p95 por fase, linhas lidas, estratégia, heap) ficam registrados na pasta de
evidência `docs/evidence/reporting-program/R5-report-families-performance/`. Este documento não repete
valores medidos; consulte a evidência da execução correspondente.
