# 16 — Matriz de reuso

| Necessidade | Já existe | Arquivo/componente | Reutilizar | Adaptar | Substituir |
|---|---|---|---|---|---|
| Tabela visual | sim | `.d17c-table` em `d17b-modelobase1.css`; tabela da Relação | ✔ | linhas de grupo/subtotal | — |
| Menu de coluna (filtro/ordenar) | sim | `components/mak/MakColumnMenu.jsx` | ✔ UI | tipos enum/boolean/entity | — |
| Motor de filtro | sim | `matchesMakColumnFilter` (`MakColumnMenu.jsx:123-172`) | — | extrair para domínio; `in/not_in`, acento, vírgula | — |
| Pílulas de filtro | sim | Relação (seguem colunas visíveis) | ✔ | incluir período | — |
| Definição de colunas | não (3 formatos) | Relação, Lançamento, `formatCellValue` (Cadastros) | — | — | ✔ ColumnDefinition |
| Ordenação | parcial | Relação / Lançamento | — | extrair `sortEngine` (null por último, número/data tipados) | — |
| Agrupamento | 1 nível | `components/pesagens/ResumoPersonalizado.jsx` | — | ideia de escopo/agrupamento | ✔ `groupEngine` |
| Agregação | espalhada | resumos, `ResumoVendaDia`, `ResumoLotes`, Fechamento | — | — | ✔ `aggregate.js` (null ≠ 0, ponderado) |
| GMD/ganho | sim | série de pesagens (`recalculateAllWeightSeries`) | ✔ valores gravados | — | — |
| Arroba/rendimento | 3 fórmulas | Lançamento, resumos | — | escolher 1 canônica | ✔ |
| Leitura por período | sim, sem uso | `listByPeriodo` (repositório de pesagens) | ✔ | expor no source | — |
| Leitura de estado atual | sim | store `animais` (projeção) | ✔ | — | — |
| Payload → view model | sim | `storageRecordToViewModel` / `weighingMapper.js` | ✔ | allowlist (G-P0-03) | — |
| Cadastros id→nome | sim | services de catálogo | ✔ | mapa em memória | — |
| Permissões | sim | `permissionService.js` `MATRIX`, `RequirePermission` | ✔ | + `reports.export`; aplicar `commercial.values` | — |
| Ator/“emitido por” | sim | `getCurrentActor()`, `useAuth().user` | ✔ | — | — |
| CSV | 5 variantes | Relação, Cadastros, manutenção, resumos | — | — | ✔ `csv.js` único |
| Escrita de arquivo | sim | IPC `app:writeUserFile` (texto, sha256) | ✔ CSV/JSON | — | binário em R4 |
| Escolher pasta | sim | `dialog:select-export-directory` (`dialogIpc.cjs:57`) | ✔ | — | — |
| Manifesto com hash | sim | manifesto de backup (format 2) | ✔ padrão | campos de relatório | — |
| Impressão | não no app | ModeloBase1 `tableExportUtils.jsx` (`window.open`, negado) | — | layout A4 paisagem | iframe oculto / `webContents.print` |
| XLSX | não no app | ModeloBase1 `xlsxExportUtils.jsx` (sem dependência) | — | portar (R6) | — |
| PDF | não | Electron `printToPDF` | — | IPC novo (R4) | — |
| Modelos salvos | padrão | `appSettings` `resumo-personalizado:<empresa>` | ✔ padrão | lista de modelos | — |
| Navegação | sim | `Layout.jsx` grupos | ✔ | grupo/itens de relatório | — |
| Fechamento do dia | sim | `FechamentoDia` | ✔ regras | versão imprimível | — |
| Qualidade de dados | sim | `health.js` logicalIntegrity | ✔ | — | — |
| Massa de teste | sim | `modules/perf/testMass.js` 36k/250k | ✔ | — | — |
| Painel de filtros lateral | removido | `MgFilterPanel` (excluído); órfãos MgCmdSelect/MgPortalPanel | — | — | não ressuscitar |
