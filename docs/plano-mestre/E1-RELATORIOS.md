# E1 — Relatórios resumidos + catálogo enxuto (1.4.0, sem mudança de esquema)

## Problema (medido em 1.3.2)

- 61 definições no catálogo (51 disponíveis, 10 bloqueadas). 13 são cópias que só mudam `defaultGroups`.
- Ao agrupar, tela/CSV/XLSX/PDF listam TODAS as linhas (animal/pesagem) sob cada grupo; subtotal vira
  "chips" ou uma linha por métrica (`reportLayout.buildReportLines`). Não existe tabela "uma linha por grupo".
- `groupEngine.flattenTree(nodes, { includeRows })` já aceita `includeRows:false`, mas ninguém usa.

## Resultado esperado

Botão **Resumido | Detalhado** em todo relatório. Resumido = uma linha por grupo com as métricas em
colunas (ex.: Lote | Cabeças | Peso médio | Peso total | GMD). Detalhado = como hoje. Catálogo com 12
relatórios visíveis.

## 1. Modo Resumido (domínio + apresentação)

1. `src/modules/reporting/domain/reportDefinition.js`: nada muda na validação; acrescentar campo opcional
   `defaultMode: 'RESUMIDO' | 'DETALHADO'` (default: `'RESUMIDO'` quando `defaultGroups.length > 0`,
   senão `'DETALHADO'`).
2. `src/modules/reporting/application/reportService.js`: a seleção aceita `mode`. O view model expõe
   `mode` e, quando RESUMIDO, `summaryRows`: lista em profundidade de nós (`level`, `path`, `label`,
   `rowCount`, `aggregates`) — SEM linhas de dados. Totais continuam calculados sobre a população inteira
   (nunca soma de filhos — regra atual do groupEngine).
3. Novo `src/modules/reporting/domain/summaryLayout.js`:
   - colunas = uma por nível de agrupamento (rótulo da coluna agrupada) + uma por agregação
     (rótulo via `aggregateLabel`, formato via `aggregateValueColumn`);
   - linhas = nós (nível 1 em negrito; níveis 2–3 recuados), última linha = Total geral;
   - rótulos simples: "Cabeças" (countDistinct animal), "Pesagens" (count em EVENT), "Peso médio (kg)",
     "Peso total (kg)", "GMD (kg/dia)", "Ganho total (kg)", "Valor (R$)".
4. `src/modules/reporting/infrastructure/exporters/reportLayout.js`: `buildReportLines(viewModel, target)`
   passa a respeitar `viewModel.mode`. Em RESUMIDO devolve `headers` do summaryLayout e linhas
   `SUMMARY` + `GRAND_TOTAL`. CSV, XLSX, impressão/PDF e JSON usam isso (JSON grava `mode` no manifesto).
5. `src/components/reports/ReportSummaryTable.jsx` (novo): tabela ModeloBase1 (`emp-table-pro`), ordenável
   por qualquer coluna de métrica dentro do mesmo nível; clicar num grupo abre o Detalhado já filtrado
   por aquele grupo (drill-down).
6. `src/components/reports/ReportView.jsx`:
   - toolbar: segmento "Resumido | Detalhado" (ao lado de Agrupar);
   - seletor rápido "Agrupar por" (lista das colunas `groupable` mais usadas) além do diálogo atual;
   - sem agrupamento + Resumido → mostra só o bloco Total geral e a dica "Escolha Agrupar por".
7. Modelos salvos (`reportTemplateService.js`): gravar e restaurar `mode`. Modelos antigos sem `mode`
   abrem com o `defaultMode` da definição.
8. Impressão: Resumido cabe em A4 retrato; cabeçalho com fazenda, período, filtros e "Agrupado por".

## 2. Catálogo enxuto (12 visíveis)

Consolidar definições de MESMO grão e MESMA fonte que só diferem em grupos/filtros. As antigas viram
**aliases** para não quebrar favoritos, recentes e modelos salvos.

| Novo id | Grão | Agrupamento padrão | Absorve (vira alias com grupos/filtros pré-setados) |
|---|---|---|---|
| `rebanho.atual` | ANIMAL_CURRENT | lote_atual | rebanho.inventario, rebanho.dimensao.* (8), rebanho.sem-pesagem-recente (filtro "dias sem pesagem ≥ N") |
| `rebanho.ocupacao-lotes` | LOT | apartacao | — (fica) |
| `pesagens` | EVENT | sessao | pesagens.periodo, pesagens.sessao, pesagens.lote, pesagens.operador, pesagens.origem, movimentacao.entradas-saidas (grupo tipo_manejo) |
| `controle.fechamento-dia` | EVENT | sessao | — (fica; família passa a Pesagens) |
| `desempenho` | ANIMAL_PERIOD | lote | desempenho.individual, desempenho.lote, desempenho.dimensao.* (6), desempenho.perdendo-peso (filtro "somente perdendo peso": ganho < 0), desempenho.faixa-peso |
| `movimentacao.lotes` | LOT_STAY | lote | movimentacao.mudancas-lote, movimentacao.permanencias-lote |
| `saidas` | EXIT | motivo_saida | saidas.motivo, saidas.mortes*, (filtro "somente mortes") |
| `comercial.vendas` | EXIT | — | fica |
| `comercial.abates` | EXIT | — | fica |
| `comercial.compras` | EVENT | — | fica |
| `embarques.romaneio` | EXIT | embarque + documento | fica |
| `embarques.previsto-realizado` | SHIPMENT_DOCUMENT | embarque | fica |

- `reportCatalog.js`: `LEGACY_REPORT_ALIASES = { '<id antigo>': { id, groups, filters, mode } }`;
  `getReportDefinition(idAntigo)` resolve o alias; `listReportDefinitions()` lista só os 12.
- Migração de preferências (em runtime, idempotente, sem esquema): favoritos/recentes/modelos com id
  antigo são reescritos para o novo id + seleção equivalente, com auditoria "relatório consolidado".
- Saem do catálogo de Relatórios e passam para **Manutenção** (aba "Controle", reaproveitando ReportView):
  controle.auditoria, controle.qualidade-dados, controle.backups, pesagens.pendencias.
- Somem da interface: cadastros.* (7) — as telas de cadastro já listam e exportam; e os 10 `blocked`
  (continuam no código como backlog, com `visibility: 'hidden'`).
- `ReportCatalog.jsx`: agrupar cartões por família (Rebanho, Pesagens, Desempenho, Movimentação, Saídas,
  Comercial, Embarques); busca no topo; favoritos primeiro.

## 3. Gates novos (registrar em test:quick)

- `reports:summary-mode:verify` — para cada definição com grupos: totais do Resumido = totais do
  Detalhado; countDistinct por grupo correto quando o mesmo animal aparece em dois grupos; nível 2/3.
- `reports:summary-export-parity:verify` — CSV, XLSX, impressão e JSON do Resumido têm as mesmas
  linhas/valores da tela.
- `reports:catalog-consolidation:verify` — 12 visíveis; todo id antigo resolve para alias válido;
  nenhum modelo salvo órfão após a migração de preferências.
- Atualizar `reports:catalog:verify`, `reports:templates:verify` e `reports:print-contract:verify`.

## 4. Docs e release

- `docs/user/RELATORIOS.md`: reescrever em linguagem simples (o que é Resumido, como agrupar, lista dos 12).
- CHANGELOG `## [1.4.0]`, `docs/release/1.4.0/` com notas e checklist.

## 5. Aceite humano (a responsável faz no app instalado)

1. Abrir "Rebanho atual" → aparece uma linha por lote com Cabeças, Peso médio e Peso total.
2. Trocar "Agrupar por" para Categoria → atualiza sem abrir diálogo.
3. Clicar numa linha → abre Detalhado só daquele lote.
4. Exportar Excel do Resumido → mesma tabela da tela.
5. Imprimir o Resumido de "Desempenho" por lote → uma página A4.
6. Um favorito antigo ("Rebanho por raça") ainda abre, já agrupado por raça.
