# Arquitetura do subsistema de relatórios

> Programa reporting (R0–R5), app **Pesagens Individuais** 1.2.0. Este documento descreve o que está
> implementado em `src/modules/reporting/`, `src/components/reports/`, `src/pages/Relatorios.jsx` e
> `electron/ipc/reportIpc.cjs`. Contratos detalhados: ver os demais arquivos desta pasta.

## 1. Pipeline único

Todo relatório — e também a tela operacional **Relação de Pesagens** — passa pela mesma sequência de
funções. Tela, CSV, JSON, XLSX, impressão e PDF leem **o mesmo objeto** (`ReportViewModel`); nenhum
exportador volta ao banco nem refaz conta.

```
ReportDefinition (definitions/*.js, validada por defineReport)
   │  params resolvidos (período → {preset, from, to, days})
   ▼
Fonte indexada (infrastructure/reportSources/index.js → getReportSource(definition.source))
   │  consulta Dexie por índice (ex.: pesagens.data_pesagem between from..to)
   ▼
Linhas canônicas do grão (eventRows.js / animalRows.js / controlSources.js)
   ▼
filterEngine.applyFilters  ← 1º lockedFilters(params)  → população base ("population")
                           ← 2º pesquisa + filtros do usuário (AND entre colunas)
   ▼
sortEngine.sortRows        (estável, multi-chave, ausentes sempre por último)
   ▼
groupEngine.groupRows      (até 3 níveis; cada nó recalcula agregações sobre as próprias linhas)
   ▼
reportAggregates.computeAggregates → aggregateEngine   (total geral sobre a população final)
   ▼
ReportViewModel (reportService.runReport)
   ├─ Tela: ReportTable (paginação só de apresentação)
   ├─ reportLayout.buildReportLines → csvExporter / xlsxExporter / printDocument
   ├─ jsonExporter.buildJsonBody
   └─ reportPrintService → IPC Electron (print / printToPDF)
```

Orquestração: `src/modules/reporting/application/reportService.js` (`runReport`). A função mede cada
fase (`stats.timings`: `query`, `transform`, `load`, `filter`, `sort`, `group`, `aggregate`, `total`) e
informa a estratégia de leitura (`stats.strategy`, ex.: `index:data_pesagem`).

## 2. Camadas

| Camada | Pasta / arquivos | Responsabilidade | Regras |
|---|---|---|---|
| Domínio | `domain/reportGrain.js`, `columnDefinition.js`, `reportDefinition.js`, `filterEngine.js`, `sortEngine.js`, `groupEngine.js`, `aggregateEngine.js`, `reportAggregates.js`, `reportFormatting.js`, `reportPeriod.js`, `reportPermissions.js` | Contratos e motores | Funções puras, sem Dexie, sem React; testáveis em Node |
| Aplicação | `application/reportService.js`, `reportExportService.js`, `reportPrintService.js`, `reportTemplateService.js`, `relationPopulation.js` | Casos de uso: executar, emitir, imprimir, modelos, população da Relação | **Toda permissão é validada aqui**, não só na tela |
| Infraestrutura | `infrastructure/reportSources/*`, `infrastructure/exporters/*`, `electron/ipc/reportIpc.cjs`, bridge `window.pesagemApp.reports` (preload) | Leitura indexada do Dexie; geração de arquivos; janela de renderização e diálogo nativo | Fontes não devolvem credenciais; IPC não aceita caminho vindo do renderer |
| Definições | `definitions/reportCatalog.js`, `pesagens.js`, `rebanho.js`, `desempenho.js`, `operacional.js`, `controle.js`, `columns/eventColumns.js`, `animalColumns.js`, `controlColumns.js` | Catálogo (Modelo 1 = definição em código) | Validadas no carregamento do módulo (`defineReport`/`defineColumn` lançam erro) |
| UI | `src/pages/Relatorios.jsx`, `src/components/reports/ReportCatalog.jsx`, `ReportView.jsx`, `ReportTable.jsx`, `ReportDialogs.jsx`, `reportUi.js` | Catálogo, tela do relatório, diálogos | Sem regra de negócio: contas, filtros e formatação vêm do domínio (`formatCell(..., 'screen')`) |

## 3. ReportViewModel

Produzido por `runReport(definitionOrId, { params, selection, empresaId, today }, actor)`.

| Campo | Conteúdo |
|---|---|
| `kind`, `version` | `pesagens.report-view-model`, `1` |
| `emissionId` | UUID da execução (identifica a emissão em manifestos, rodapé e nome de arquivo) |
| `reportId`, `reportName`, `reportDefinitionVersion`, `family`, `grain`, `grainLabel`, `classification`, `notes` | Metadados da definição |
| `generatedAt`, `emittedBy {id, nome, role}` | Emissão (sem nenhum segredo de autenticação) |
| `appVersion`, `schemaVersion`, `dataBuildId` | `versioning/versionInfo.js` |
| `params`, `period`, `periodDescription` | Parâmetros resolvidos; período no formato "Últimos 30 dias = dd/mm/aaaa a dd/mm/aaaa" |
| `columns`, `availableColumns`, `hiddenByPermission` | Colunas visíveis, colunas que o papel pode escolher, colunas removidas pelo perfil |
| `search`, `filters`, `lockedFilters`, `sort`, `groups`, `aggregates` | Seleção efetivamente aplicada (serializável) |
| `rows`, `rowCount`, `uniqueAnimalCount` | População final ordenada; animais únicos (só em grão com animal e `animalColumnId`) |
| `tree`, `totals` | Árvore de grupos com agregações por nó; total geral |
| `warnings`, `stats` | Avisos (ex.: colunas ocultas pelo perfil) e medições |
| `resolve`, `population` | Internos, não serializados: resolvedor de colunas e população após `lockedFilters` (opções das pílulas) |

## 4. Infraestrutura compartilhada: Relação de Pesagens como primeiro consumidor

A Relação de Pesagens (`src/pages/PesagensIndividuais.jsx`) não tem filtro nem ordenação próprios: chama
`relationPopulation(rows, { searchTerm, filtrosColuna, sortConfig })`
(`application/relationPopulation.js`), que usa `applyFilters` + `sortRows` com `EVENT_COLUMNS` e
`RELATION_SEARCH_COLUMN_IDS` (número, marca, lote, apartação, raça). As linhas vêm de
`loadEventRows`/`enrichEventRows` — a mesma transformação usada por "Pesagens por período". O gate
`reports:relation-parity:verify` compara a população da Relação com a do relatório.

Diferença de leitura: a Relação lê a store `pesagens` sem período (`full-scan`, como a tela sempre
fez); os relatórios de grão EVENT sempre leem pelo índice `data_pesagem`.

## 5. Decisões estruturais

| Decisão | Como está no código |
|---|---|
| Sem cache | `runReport` relê a fonte a cada execução. O único memo é o de *accessors* de coluna em `createColumnResolver` (funções, não dados). A tela reexecuta com atraso de 200 ms após cada mudança de estado e no botão **Atualizar**. |
| Sem mudança de esquema | Nenhuma store nova. Modelos, favoritos e recentes ficam em `appSettings` (`report-templates:<empresa>`, `report-favorites:<empresa>:<usuário>`, `report-recents:<empresa>:<usuário>`). Esquema vigente: Dexie 7 (`DATA_BUILD_ID = 'schema-v7'`); backup formato 3 (`BACKUP_FORMAT_VERSION = 3`). |
| Zero dependências novas | XLSX gerado por escritor próprio (ZIP "stored" + SpreadsheetML em `xlsxExporter.js`); PDF via `webContents.printToPDF` do Electron; SHA-256 via `crypto.subtle` (`src/lib/sha256.js`); nenhuma biblioteca de relatório/planilha/PDF em `package.json`. |
| Uma formatação | `reportFormatting.formatCell(column, value, target)` com `target` ∈ `screen`, `print`, `csv`, `xlsx`, `json`. Arredondamento só aqui, nunca antes de agregar. |
| Permissões genéricas | Ações nomeadas da `MATRIX` (`reports.read`, `reports.export`, `commercial.values`…); nunca uma permissão por relatório. |
| Relatório impossível não é simulado | Definições com `status: 'blocked'` e `blockedReason` aparecem no catálogo como indisponíveis. |

## 6. Navegação

- Menu: item **Relatórios** (`src/Layout.jsx`, permissão `reports.read`).
- `/Relatorios` → catálogo; `/Relatorios?r=<reportId>` → relatório; `&m=<templateId>` → modelo salvo;
  `&d=YYYY-MM-DD` → pré-preenche o período (atalho "Imprimir fechamento" do Fechamento do Dia).
  A URL leva só identificadores, nunca filtros ou dados.

## 7. Gates relacionados (`package.json`)

`reports:definitions:verify`, `reports:columns:verify`, `reports:grain:verify`, `reports:filters:verify`,
`reports:relation-parity:verify`, `reports:index-prefilter:verify`, `reports:grouping:verify`,
`reports:aggregates:verify`, `reports:subtotals:verify`, `reports:grand-total:verify`,
`reports:unique-animals:verify`, `reports:null-semantics:verify`, `reports:weighted-gmd:verify`,
`reports:templates:verify`, `reports:permissions:verify`, `reports:csv-parity:verify`,
`reports:json-manifest:verify`, `reports:sensitive-data:verify`, `reports:print-contract:verify`,
`reports:pdf-contract:verify`, `reports:catalog:verify`, `reports:xlsx-parity:verify`,
`reports:performance:verify`.
