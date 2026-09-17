# 22 — Roadmap de implementação (R0–R6)

Nada foi implementado. Cada fatia é entregável, testável e reversível sozinha. **Nenhuma fatia até R5 altera schema.**

## R0 — Base confiável (pré-requisitos de dados e segurança)

| Item | Conteúdo |
|---|---|
| Objetivo | Remover defeitos que invalidariam qualquer relatório |
| Arquivos | `weighingDataAdapter.js` (projeção de categoria pelo último evento **com peso**), `weighingMapper.js` (allowlist `marca_id`, `raca_id`, `rendimento_origem`), `maintenanceService.js` (perfil real via `getCurrentActor`) |
| Stores | nenhuma nova; leitura/escrita em `pesagens`, `animais` |
| Schema | **não** |
| Componentes | nenhum |
| Services | ajustes pontuais nos existentes |
| Gates | `verify-category-projection`, extensão de `verify-animal-history-integrity`, gate de perfil na manutenção |
| Performance | neutra |
| Risco | baixo; `rebuildAnimalStateProjection` roda em todo evento |
| Rollback | reverter commit (sem migração) |
| Aceite | Morte sem peso mantém categoria; pesagem nova guarda `marca_id/raca_id/rendimento_origem`; GESTOR não restaura/limpa/reseta; `test:quick` verde |

Antes de R0: **commitar o trabalho 1.2.0 pendente** (37 arquivos) para ter base limpa.

## R1 — Núcleo compartilhado + primeiro relatório com paridade

| Item | Conteúdo |
|---|---|
| Objetivo | Extrair filtro/ordenação/formatação/colunas para domínio; Relação passa a consumi-los; relatório `pesagens.periodo` (B1) com mesmo resultado |
| Arquivos | novos `modules/reporting/domain/{columns,filterEngine,sortEngine,format}.js`; `modules/reports/domain/definitions/pesagensPeriodo.js`; `modules/reports/application/reportService.js`; `modules/reports/infrastructure/sources/eventsByPeriod.js`; alterados `MakColumnMenu.jsx` (importa o motor), `RelacaoPesagens` |
| Stores | `pesagens` (índice `data_pesagem`), cadastros |
| Schema | não |
| Componentes | `pages/RelatorioView.jsx` mínimo reutilizando a tabela ModeloBase1; rota `/relatorios/pesagens.periodo` |
| Services | `reportService.runReport`; autorização `reports.read` no service |
| Gates | `verify-report-parity`, `-filters`, `-indexed-prefilter`, `-no-duplication`, `-permissions` (parte) |
| Performance | período 30d em 36k ≤ 300 ms |
| Risco | médio — mudar o motor da Relação; mitigado pela paridade |
| Rollback | Relação volta ao motor antigo (import); rota de relatório removida |
| Aceite | Relação visualmente idêntica; relatório e Relação iguais para 20 combinações de filtro |

## R2 — Agrupamento, subtotais e totais

| Item | Conteúdo |
|---|---|
| Objetivo | Árvore até 3 níveis, agregação única com nulos corretos e GMD ponderado; relatórios A1–A5 e C1–C3 |
| Arquivos | `modules/reporting/domain/{groupEngine,aggregate}.js`; definições `rebanhoAtual`, `desempenhoPeriodo`; `components/reports/GroupedTable.jsx` |
| Stores | `animais`, `pesagens`, `loteApartacoes` |
| Schema | não |
| Componentes | tabela agrupada (linha de grupo/subtotal/total); reativar métricas de rodapé por classe nova (sem alterar a regra existente) |
| Services | sources `animalCurrent`, `animalPeriod` |
| Gates | `-grouping`, `-subtotals`, `-grand-total`, `-unique-animals`, `-null-semantics`, `-weighted-avg`, `-grain` |
| Performance | rebanho atual ≤ 500 ms em 36k |
| Risco | médio (regras numéricas) |
| Rollback | remover definições; núcleo R1 intacto |
| Aceite | números conferidos manualmente em massa pequena pelo responsável |

## R3 — Modelos e exportação CSV/JSON

| Item | Conteúdo |
|---|---|
| Objetivo | Modelos 2/3 em `appSettings`; CSV único e JSON com manifesto sha256; catálogo `/relatorios` |
| Arquivos | `templateService.js`; `export/{csv,json,manifest}.js`; `pages/Relatorios.jsx`; `Layout.jsx` (grupo Relatórios); `permissionService.js` (`reports.export`, aplicar `commercial.values`) |
| Stores | `appSettings` (`report-templates:<empresa>…`) |
| Schema | não |
| Componentes | catálogo, barra de modelo, diálogo Emitir |
| Services | `emitReport` via `app:writeUserFile` + `dialog:select-export-directory` |
| Gates | `-templates`, `-export-csv`, `-manifest`, `-permissions` completo |
| Performance | CSV 36k ≤ 3 s sem travar UI |
| Risco | baixo |
| Rollback | remover item de menu e chaves de `appSettings` |
| Aceite | CSV abre corretamente no Excel pt-BR; hash confere; CONSULTA não exporta valores |

## R4 — Impressão e PDF

| Item | Conteúdo |
|---|---|
| Objetivo | Documento emitido conforme `12` |
| Arquivos | `export/print.js` (iframe oculto); `electron/ipc/reportIpc.cjs` (`webContents.printToPDF` + escrita binária com sha256); `preload` |
| Stores | nenhuma |
| Schema | não |
| Componentes | layout de impressão |
| Services | `emitReport` formatos `print`/`pdf` |
| Gates | `-print-layout`; gate de segurança do IPC (caminho restrito à pasta escolhida) |
| Performance | PDF de 2.000 linhas ≤ 10 s |
| Risco | médio — novo IPC no processo principal (sandbox/contextIsolation preservados) |
| Rollback | remover IPC e botões |
| Aceite | PDF com cabeçalho repetido, página X de Y e “emitido por” |

## R5 — Famílias restantes e volume

| Item | Conteúdo |
|---|---|
| Objetivo | B2–B6, D1–D3, E1–E2, F1–F3, G1–G3, H1–H4, I2, I4; leitura em blocos para período longo |
| Arquivos | definições e sources novos; ajustes em Fechamento/Ficha para atalhos |
| Stores | `sessoesPesagem`, `animalLotes`, `documentosEmbarque`, `auditoria`, `backupHistory`, `usuarios` (via `sanitize`) |
| Schema | não (índice composto `[data_pesagem+tipo_pesagem]` só se a medição em 250k exigir — decisão separada, v8) |
| Componentes | nenhum novo |
| Gates | `-large` (36k e 250k); gates por família |
| Performance | **medir v7 em 250k** antes de liberar período anual |
| Risco | médio (volume) |
| Rollback | desabilitar definição no registro |
| Aceite | todos os relatórios “PRONTO COM PEQUENO SERVICE” do `10` disponíveis e com gate |

## R6 — XLSX e evolução modelada (decisões separadas)

| Item | Conteúdo |
|---|---|
| Objetivo | Portar escritor XLSX do ModeloBase1; avaliar modelagem de parceiros por id, operação comercial, registro de emissões e snapshot de rebanho (A6, D4, F4, F5, H5) |
| Arquivos | `export/xlsx.js` (porta sem dependência); propostas de schema em documento próprio |
| Stores | possíveis novas — **só com missão e decisão específicas** |
| Schema | possível v8 (fora deste roadmap de relatórios) |
| Gates | round-trip XLSX; gates de migração se houver v8 |
| Risco | alto para a parte de modelagem |
| Rollback | XLSX removível; modelagem conforme plano de migração |
| Aceite | definido na missão de modelagem |
