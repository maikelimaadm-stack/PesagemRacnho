# R1 — Núcleo compartilhado de reporting (16/09/2026)

Branch `program/reporting-1.3.0` (a partir de `a465123`, tag `v1.2.0-rc1` em `3b27958`).
Commits `f82fa7b..1857eb7`. **Sem mudança de schema** (Dexie 7, backup 3). **Zero dependências novas.**

## Entregue

| Peça | Arquivo | Observação |
|---|---|---|
| Grão | `src/modules/reporting/domain/reportGrain.js` | 12 grãos; colunas declaram `grains`; grãos com animal |
| ColumnDefinition | `domain/columnDefinition.js` | 13 tipos; agregações válidas por tipo; `weightedGmd`/`weightedAvg`/`ratio` só com declaração; sensibilidade |
| ReportDefinition | `domain/reportDefinition.js` | valida grão das colunas, padrões, ≤3 grupos, agregações, período obrigatório em EVENT/ANIMAL_PERIOD/EXIT |
| Filtros | `domain/filterEngine.js` | `in`/`not_in` respeitados, texto sem acento, vírgula decimal, enum/boolean/entity, serializável |
| Ordenação | `domain/sortEngine.js` | estável, multi-chave, ausentes por último, collator pt-BR numérico |
| Formatação | `domain/reportFormatting.js` | uma função para tela/impressão/CSV/XLSX/JSON |
| Período | `domain/reportPeriod.js` | presets resolvidos na emissão com `today` injetado |
| Permissões | `domain/reportPermissions.js` | sensibilidade → ação genérica; exportação recusada com coluna sensível |
| Agrupamento/agregação | `domain/groupEngine.js`, `reportAggregates.js`, `aggregateEngine.js` (R0) | usados no R2 |
| Linhas de evento | `infrastructure/reportSources/eventRows.js`, `eventSource.js` | deduplicação por id, nomes de cadastro, índice `data_pesagem` com período |
| Serviço | `application/reportService.js` | autoriza → fonte → filtro → ordenação → grupos → totais → view model com tempos por fase |
| População da Relação | `application/relationPopulation.js` | a tela chama esta função |
| Relatórios | `definitions/pesagens.js` | Pesagens por período (canário), por sessão, por lote/apartação |

## Relação de Pesagens migrada

- Carrega `loadEventRows` (mesma transformação dos relatórios).
- Filtro + pesquisa + ordenação por `relationPopulation` (motor compartilhado).
- Células por `formatCell` da ColumnDefinition (sem formatter paralelo); `MakColumnMenu` delega ao `filterEngine`
  (Lançamento e Cadastros herdam a correção de `values`/acentos).
- Mudanças visíveis: ausente aparece como “—”; peso com 2 casas; rótulo “Tipo de Saída” → “Motivo da saída”
  (unificação P3); ausentes vão para o fim na ordenação.

## Critério de conclusão R1

| Critério | Resultado |
|---|---|
| motor compartilhado | ✔ |
| Relação usando infraestrutura compartilhada sem regressão | ✔ `test:quick` verde; tela renderizada no navegador (1440×900) com 13 pesagens, sem erro de console |
| Pesagens por período funcionando | ✔ serviço (UI do catálogo em R3) |
| consulta indexada | ✔ `index:data_pesagem`, lê 4 de 309 linhas na massa do gate |
| paridade comprovada | ✔ 12 critérios: mesma população, ordem e células |

Massa de verificação criada no banco de desenvolvimento do navegador (localhost): 13 pesagens com observação
`[teste relatórios]` (animais `dev-A101..106`).
