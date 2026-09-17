# 13 — Exportação e impressão

Nenhuma biblioteca foi instalada. Estado de 16/09/2026.

## 1. Inventário

| Ponto | Arquivo | Biblioteca | Conteúdo | Respeita filtros? | Colunas visíveis? | Formato | Grupos/totais? | Canal | Riscos |
|---|---|---|---|---|---|---|---|---|---|
| CSV Relação | `PesagensIndividuais.jsx:772-801` | nenhuma | 17 colunas fixas | **sim** (filtrados, ordenados) | **não** | `;`, UTF-8 + BOM, números pt-BR com milhar | não | `Blob` + `<a download>` | **sem aspas/escape**: `;` ou quebra de linha na observação quebram o arquivo |
| CSV Lançamento (`exportarExcel`) | `LancamentoPesagensIndividuais.jsx:1172-1266` | nenhuma | colunas **visíveis, na ordem** | sim (dia + filtros) | **sim** | `;`, BOM; troca `;` por `,`, sem tratar aspas/quebras; moeda `R$ 1.234,56` | não | `Blob` | nome “Excel”, mas é CSV |
| Modelo CSV | `PesagensIndividuais.jsx:754-770` | nenhuma | cabeçalho + 3 exemplos | — | — | exemplo com ponto decimal (contradiz pt-BR) | — | `Blob` | — |
| CSV Fechamento | `FechamentoDia.jsx:117-122` | nenhuma | 9 colunas | data + apartação | não | `;`, BOM, **aspas corretas** | **não** (KPIs/lotes/marcas fora) | `Blob` | peso null sai `0,00` |
| JSON “backup do dia” | `FechamentoDia.jsx:124-127` | nenhuma | `{type,date,createdAt,count,entries}` | sim | — | JSON | não | `Blob` | **sem hash**, apesar da mensagem “validado”; não é restaurável |
| CSV Ficha | `FichaAnimal.jsx:130-135` | nenhuma | 9 colunas do histórico | animal (ignora período do gráfico) | não | `;`, BOM, aspas | não | `Blob` | peso null sai `0,00` |
| CSV Manutenção | `maintenanceDataAdapter.js:75-79` → `backupService.js:90-104` | nenhuma | colunas cruas do storage (sem `legacy_payload`) | não | — | **vírgula**, BOM, escape RFC, ponto decimal | não | **IPC `app:writeUserFile`** + SHA-256 | formato diferente dos demais |
| JSON Manutenção | `backupService.js:107-120` | nenhuma | `{type, createdAt, appVersion, count, entries}` | não | — | JSON | — | IPC + SHA-256 | sem versão de fórmula |
| Backup completo | `backupService.js:47-87` | `crypto.subtle` | todas as stores + manifesto (versões, contagens, motivo, `backupId`) + `integrity.sha256` | — | — | JSON | — | IPC | **referência de rastreabilidade** |
| Impressão | **não existe** | — | — | — | — | — | — | — | — |
| PDF | **não existe** | — | — | — | — | — | — | — | — |
| XLSX | **não existe** | — | — | — | — | — | — | — | — |

## 2. Restrições do Electron que decidem a estratégia

| Fato | Evidência | Consequência |
|---|---|---|
| `setWindowOpenHandler(() => ({ action: 'deny' }))` | `electron/main.cjs:48` | a técnica do ModeloBase1 (`window.open` + `document.write` + `print()`) **não funciona** no app |
| `sandbox: true`, `contextIsolation: true` | `main.cjs:41-43` | impressão/arquivo só via renderer (iframe) ou IPC novo |
| `app:writeUserFile` grava **texto UTF-8** em `userData/data/<subdir>` e devolve `path/size/sha256` | `main.cjs:118-139` | CSV/JSON prontos; **XLSX/PDF binários exigem variante binária** do IPC |
| Usuário não escolhe a pasta em `writeUserFile`; existe `dialog:select-export-directory` | `main.cjs:112`; `electron/ipc/dialogIpc.cjs:57` | relatório pode oferecer “Salvar em…” reaproveitando o diálogo existente |
| Downloads via `Blob` + `<a download>` sem handler `will-download` | `main.cjs` | comportamento padrão do Electron; **não validado fisicamente** |
| Nenhum IPC de impressão | `main.cjs` | `webContents.print()` / `webContents.printToPDF()` são nativos do Electron (**sem biblioteca**), mas exigem IPC novo |

## 3. Referência reaproveitável fora do app (ModeloBase1 original)

`arquivos do projetomgdomodelobase1/PROJETOMG-main/src/framework/cadastro/exports/`:

- `xlsxExportUtils.jsx` (9 KB): **XLSX sem dependência** — escreve `[Content_Types].xml`, `workbook.xml`,
  `styles.xml`, `sheet1.xml` e empacota em zip “store” com CRC próprio (`:47-148`), exporta
  `exportRowsToXlsx({ columns, rows, totalRows, title, fileName })`. Suporta linha de totais; não suporta grupos,
  estilos ricos nem várias planilhas.
- `tableExportUtils.jsx` (2,7 KB): HTML de tabela com `@page { size: A4 landscape; margin: 8mm }` (`:21`) impresso
  por `window.open` (`:49-55`) — **o HTML é reaproveitável; o canal de impressão não**.

## 4. Avaliação por formato

| Formato | Existe? | Biblioteca | Qualidade atual | Preserva grupos | Preserva totais | Preserva formatação | Offline | Custo de bundle | Risco |
|---|---|---|---|---|---|---|---|---|---|
| CSV | sim (5 variantes) | nenhuma | incoerente; 2 quebram com `;`/quebra de linha | não | não | números como texto pt-BR | sim | 0 | baixo (unificar) |
| JSON | sim | nenhuma | sem versão de contrato (exceto backup) | não | não | n/a | sim | 0 | baixo |
| Impressão | não | — | — | — | — | — | sim | 0 | médio (canal Electron) |
| PDF | não | — | — | — | — | — | sim com `printToPDF` | 0 | médio (IPC binário, quebras de página) |
| XLSX | não | — | — | — | — | — | sim | ~9 KB (porte do ModeloBase1) | médio (tipos numéricos, estilos, grupos) |

## 5. Sequência recomendada

1. **Modelo de relatório único (SSOT)**: `consulta → dataset → agrupamentos/agregados → ReportViewModel`. Tela e
   todos os formatos leem **o mesmo view model**; nenhum formato recalcula.
2. **CSV único** (substitui as cinco variantes nos relatórios novos): `;`, UTF-8 + BOM, **todas as células com aspas
   e escape**, números **sem separador de milhar** e decimal com vírgula (compatível com Excel pt-BR), cabeçalho com
   metadados opcionais, linhas de subtotal/total marcadas numa coluna `tipo_linha`.
3. **JSON versionado**: `{ reportManifest, definition, rows, groups, totals }` com `sha256` do conteúdo (padrão do
   backup).
4. **Impressão** por iframe oculto no próprio documento (sem abrir janela), CSS `@media print` + `@page`; fallback
   `webContents.print()` via IPC se o iframe falhar no instalado.
5. **PDF** por `webContents.printToPDF()` (nativo, sem biblioteca) + IPC de escrita binária com SHA-256.
6. **XLSX** portando o gerador do ModeloBase1 e estendendo para células numéricas tipadas, linhas de grupo/subtotal e
   aba de metadados. Deixar por último.

Toda saída carrega o manifesto do relatório (ver `12-REPORT-VISUAL-CONTRACT.md` §4).

## 6. Risco a corrigir antes (não é do módulo, afeta confiança)

- CSV da Relação e do Lançamento sem escape (quebra de arquivo) — P1.
- JSON “backup do dia” anuncia validação inexistente — P1.
- Peso nulo exportado como `0,00` (Fechamento, Ficha) — P1.
