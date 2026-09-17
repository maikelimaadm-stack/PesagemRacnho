# 15 — Arquitetura alvo

## 1. Decisão (seção 27): infraestrutura compartilhada, não camada independente

**Infraestrutura de tabela compartilhada + camada fina de relatórios.** Funções puras (colunas, filtros, ordenação,
agrupamento, agregação, formatação, exportação) saem das telas para módulos de domínio. A Relação de Pesagens passa a
ser o **primeiro consumidor**, provado por gate de paridade; o módulo de relatórios é o segundo consumidor.

Motivos:
- As regras já existem espalhadas (filtro em `MakColumnMenu.jsx`, formatos em 3 lugares, 5 CSVs); duplicar criaria a 4ª/6ª versão.
- Relatório e tela precisam dar **o mesmo número** para o mesmo filtro.
- Uma camada independente (BI/engine) está fora do escopo proibido pela missão.

Não é “refatorar a Relação primeiro”: extrai-se **só o que o relatório vai consumir**, com a Relação trocando a
implementação por baixo sem mudança visível.

## 2. Camadas

```text
UI  ───────────────────────────────────────────────────────────────
  pages/Relatorios.jsx (catálogo)   pages/RelatorioView.jsx (pré-visualização)
  components/reports/*  (barra, filtros, colunas, agrupar, tabela agrupada, emissão)
  Relação de Pesagens (consumidor existente)
APPLICATION ───────────────────────────────────────────────────────
  modules/reports/application/reportService.js
     runReport(definition, template, actor) → ReportResult
     emitReport(result, format, actor)      → { manifest, file }
  modules/reports/application/templateService.js  (appSettings)
DOMAIN (puro, testável em node) ───────────────────────────────────
  modules/reporting/domain/columns.js        ColumnDefinition + registry por grão
  modules/reporting/domain/filterEngine.js   (extraído de matchesMakColumnFilter, corrigido)
  modules/reporting/domain/sortEngine.js
  modules/reporting/domain/groupEngine.js    árvore até 3 níveis
  modules/reporting/domain/aggregate.js      sum/avg/min/max/count/countDistinct/weightedAvg com n_validos/n_ausentes
  modules/reporting/domain/format.js         formatação canônica (tela/impressão/CSV)
  modules/reports/domain/definitions/*.js    uma definição por relatório (grão, fonte, colunas, permissões)
INFRASTRUCTURE ────────────────────────────────────────────────────
  modules/reports/infrastructure/sources/*   leitura indexada por grão (period, animalCurrent, session…)
  modules/reporting/infrastructure/export/   csv.js, json.js, print.js (iframe), pdf (IPC), manifest.js
  electron: IPC novo só em R4 (printToPDF + escrita binária)
```

## 3. Contratos

```js
// ReportDefinition (código, Modelo 1)
{ id, version, title, family, grain, requires: ['reports.read'],
  source: 'events.byPeriod', requiredFilters: ['periodo'],
  columns: [...ids permitidos], defaultColumns: [...], groupable: [...], metrics: [...] }

// ReportResult (view model único — SSOT de tela, impressão e exportação)
{ definition, template, period: { from, to, preset }, generatedAt, actor,
  columns: ColumnDefinition[], rows: Row[], tree: GroupNode[], totals: AggregateMap,
  warnings: [], stats: { rowsRead, rowsOut, ms } }

// Manifesto de emissão (padrão do backup)
{ format: 1, report_id, report_version, app_version, data_build_id, actor, role,
  generated_at, period, filters, grouping, columns, row_count, sha256 }
```

## 4. Princípios

1. **Um grão por relatório** (`23`).
2. **Pré-filtro indexado + predicado em memória** (`04`, `14`).
3. Agregação sempre recalculada a partir da população; nunca soma de médias nem de `countDistinct` (`05`, `06`).
4. Formatação e exportação leem o **mesmo `ReportResult`**.
5. Autorização no service e na definição (`18`).
6. Sem store nova, sem schema, sem cache, sem biblioteca na primeira onda.
