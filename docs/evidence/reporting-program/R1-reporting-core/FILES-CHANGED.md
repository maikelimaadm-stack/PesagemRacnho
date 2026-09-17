# R1 — Arquivos

Novos: `src/modules/reporting/domain/{reportGrain,columnDefinition,reportDefinition,reportPermissions,reportPeriod,reportFormatting,filterEngine,sortEngine,groupEngine,reportAggregates}.js`,
`src/modules/reporting/infrastructure/reportSources/{eventRows,eventSource,index}.js`,
`src/modules/reporting/application/{reportService,relationPopulation}.js`,
`src/modules/reporting/definitions/{reportCatalog,pesagens}.js`, `definitions/columns/eventColumns.js`,
`scripts/lib/reportFixtures.mjs`, `scripts/verify-reports-{definitions,filters,columns,relation-parity,index-prefilter,grain}.mjs`.

Alterados: `src/pages/PesagensIndividuais.jsx` (consumidora), `src/components/mak/MakColumnMenu.jsx` (fachada),
`scripts/verify-animal-history-integrity.mjs` (asserção da coluna Marca pela definição compartilhada), `package.json`.
