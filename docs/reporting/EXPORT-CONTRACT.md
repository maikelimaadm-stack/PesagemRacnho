# Contrato de emissão: CSV, XLSX, JSON, impressão e PDF

Fontes: `application/reportExportService.js`, `application/reportPrintService.js`,
`domain/reportFormatting.js`, `domain/reportDocument.js`, `infrastructure/exporters/reportLayout.js`,
`csvExporter.js`, `jsonExporter.js`, `xlsxExporter.js`, `printDocument.js`, `sheetHtml.js`,
`sheetStyles.js` e `electron/ipc/reportIpc.cjs`.

## 1. Princípios

1. **Permissão no serviço**: toda emissão (CSV, XLSX, JSON, impressão, PDF) chama `assertCanExport`
   (`reports.export` + `requires` da definição + nenhuma coluna sensível sem permissão). Ver PERMISSIONS.md.
2. **Mesma população e totais da tela**: os exportadores leem **somente** o `ReportViewModel` já
   calculado; não voltam ao banco nem refazem conta.
3. **Mesma sessão**: se `viewModel.emittedBy.id` difere de `actor.id`, a emissão é recusada
   (`AUTH_FORBIDDEN`, "o relatório foi gerado por outra sessão").
4. **Manifesto com integridade**: identificador da emissão, emissor (id, nome, papel — nunca segredo),
   versões e SHA-256.

## 2. Layout linear comum (`reportLayout.buildReportLines`)

CSV, XLSX e impressão percorrem a árvore/total já calculados e produzem linhas tipadas:

| `type` | Quando | Conteúdo |
|---|---|---|
| `GROUP` | início de cada grupo | `level`, rótulo "`Coluna: valor`", `rowCount` |
| `DATA` | cada linha de dados (só nas folhas) | células formatadas para o destino; `group` = caminho "A > B" |
| `SUBTOTAL` | fim de cada grupo | **uma linha por total** configurado (`metric` + `value`, `nValid`, `nMissing`) |
| `GRAND_TOTAL` | fim do documento | uma linha por total geral |

Sem agrupamento, só `DATA` (nível 0) e `GRAND_TOTAL`. Rótulo da métrica (`aggregateLabel`):
"Registros" (`count` sem coluna), "Animais únicos" (`countDistinct` em `animal`/`numero_animal`), senão
"`<operação>` — `<Coluna (unidade)>`". Cabeçalho da coluna: `headerLabel` → "Peso (kg)".

### 2.1 Modo Resumido (1.4.0)

Quando `viewModel.mode === 'RESUMIDO'` (`isSummaryMode`), todos os destinos usam
`buildSummaryLayout(viewModel, target)` (`domain/summaryLayout.js`) em vez das linhas acima: **uma linha
por nó de grupo** (profundidade primeiro, na ordem de `summarySort`), sem linhas de dados.

- Colunas: uma por nível de agrupamento (o rótulo fica na coluna do próprio nível) + uma por métrica.
  Sem agrupamento: coluna "Resumo" e só a linha "Total geral". Sem totais configurados: métrica de
  contagem de linhas.
- Rótulos das métricas em linguagem simples (`summaryMetricLabel`, `domain/aggregateLabels.js`):
  "Cabeças", "Pesagens", "Saídas", "Peso médio (kg)", "GMD (kg/dia)" (ponderado), "GMD simples
  (kg/dia)", "Valor (R$)", "Arrobas (@)"…
- Valores de cada nó recalculados sobre a população do nó; "Total geral" sobre a população inteira
  (nunca soma das linhas).
- Rótulo de grupo de coluna data/sim-não no formato do destino (`formatGroupLabel`): "01/08/2026",
  "Sim"/"Não" na tela, impressão, CSV e XLSX; JSON leva o canônico. Vale também para o cabeçalho de
  grupo do Detalhado. Média de coluna inteira sai com 1 casa (`aggregateValueColumn`).
- CSV: colunas `tipo_linha`, `nivel`, `grupo` (caminho "Engorda > Lote 01") e as do resumo; XLSX: aba
  com as mesmas linhas (números como números) e "Agrupado por: … · Resumido (uma linha por grupo)" nos
  metadados; JSON: `mode`, `drill`, `summary {headers, metrics, rows}` e `data: []`; tela, impressão e
  PDF: **a folha** (§9), com as mesmas métricas e valores por nó. Nada é cortado com reticências.
- Manifesto: `presetId` (visão antiga — também quando a tela abre pelo favorito/link antigo e chama o
  relatório novo com `request.presetId`), `mode`, `summarySort` e `drill`.
- Proteção contra fórmula no CSV (`protectFormula`): apóstrofo em todo texto iniciado por `=`, `+`, `@`
  ou `-`, exceto número negativo puro (`-12`, `-1,5`); a importação (`importFile.unprotectFormula`) usa
  a regra espelhada.
- `drill` (clique no grupo): corte exato por `groupKeyOf` do caminho escolhido, aplicado antes do
  agrupamento; aparece em "Filtros" como "(detalhe do grupo)".
- E1B: rótulos da definição (`metricLabels`, ex.: "Qtd", "Faixa mínima do lote (kg)") no cabeçalho;
  métricas de par fora do nível certo saem da folha, do CSV/XLSX, dos chips da grade e do `summary` do
  JSON (`hiddenMetrics` — ex.: faixa do lote agrupando só por data); com par `leafOnly`, as métricas do par ficam **vazias** nas linhas acima do nível
  folha e no Total geral (`leafOnlyMetricKeys`/`isLeafGroupLevel`), também nas linhas `SUBTOTAL`/
  `GRAND_TOTAL` do Detalhado e nos chips da grade. O JSON mantém os agregados brutos da árvore.
- Manifesto E1B: `arrobaDivisor` (30 ou 15) usado nas colunas em @.

Gate: `reports:summary-export-parity:verify` (mesmas células em tela, CSV, XLSX, impressão e JSON).

## 3. Formatação canônica (`formatCell(column, value, target)`)

| Tipo | `screen` / `print` | `csv` | `xlsx` | `json` |
|---|---|---|---|---|
| Ausente (`null`, `undefined`, texto vazio) | `—` | vazio | `null` (célula vazia) | `null` |
| `integer`, `number`, `weight`, `gmd`, `percentage` | pt-BR com casas fixas (`1.234,56`); percentual com " %" | arredondado, vírgula decimal, **sem** separador de milhar (`1234,56`) | **número** arredondado | número canônico **sem arredondar** |
| `money` | moeda BRL (`R$ 1.234,56`) | igual aos numéricos | número arredondado | número canônico |
| `date` | `dd/mm/aaaa` | `dd/mm/aaaa` | `dd/mm/aaaa` (texto) | texto original (`YYYY-MM-DD`) |
| `datetime` | `dd/mm/aaaa HH:MM` | idem | idem | texto original |
| `boolean` | `Sim` / `Não` | idem | idem | `true` / `false` |
| `enum` | rótulo da opção | rótulo | rótulo | código |
| `entity`, `text`, `identifier` | texto (entidade recebe o nome via `displayOf`) | texto | texto | texto |

Casas decimais padrão (`DEFAULT_DECIMALS`): `integer` 0, `number` 2, `weight` 2, `gmd` 3, `money` 2,
`percentage` 2; `column.decimals` sobrepõe. `roundTo` corrige o erro binário (1,005 → 1,01). Valores de
total usam a coluna virtual `aggregateValueColumn` (contagens como `integer`, `weightedGmd` como `gmd`).

## 4. CSV (`csvExporter.js`)

| Item | Regra |
|---|---|
| Codificação | UTF-8 com **BOM** (`﻿`) |
| Separador / quebra | `;` / **CRLF** (inclusive após a última linha) |
| Cabeçalho | `tipo_linha;nivel;grupo;metrica;valor;<cabeçalhos das colunas visíveis>` |
| Escape | célula entre aspas se contiver `"`, `;`, CR, LF ou espaço no início/fim; aspas internas dobradas |
| Proteção de fórmula | texto iniciado por `=`, `+`, `@`, ou por `-` não seguido de dígito, recebe apóstrofo (`'=SOMA(...)`); números negativos (`-12,5`) não são alterados |
| Ausente | vazio |

Preenchimento das colunas fixas:

| `tipo_linha` | `nivel` | `grupo` | `metrica` | `valor` | Colunas de dados |
|---|---|---|---|---|---|
| `GROUP` | 1–3 | "`Coluna: valor`" | vazio | vazio | vazias |
| `DATA` | nível da folha (0 sem agrupamento) | caminho "A > B" | vazio | vazio | preenchidas |
| `SUBTOTAL` | nível do grupo | caminho "A > B" | rótulo do total | valor formatado | vazias |
| `GRAND_TOTAL` | 0 | vazio | rótulo do total | valor formatado | vazias |

`parseCsv` (mesmo arquivo) lê o próprio formato para o gate `reports:csv-parity:verify`.

## 5. XLSX (`xlsxExporter.js`)

- Sem dependência: SpreadsheetML + ZIP "stored" (sem compressão) com datas fixas (saída determinística).
- Aba 1 (nome = título do relatório, saneado, até 31 caracteres): título; linhas **Período**, **Filtros**
  (ids das colunas filtradas, fixos primeiro), **Agrupado por**, **Emissão** (id · data ISO · emissor ·
  papel · versão); linha em branco; cabeçalho `Tipo | Grupo | Métrica | Valor | <colunas>`; painel
  congelado abaixo da linha 7.
- Linhas: `GROUP` (Grupo = rótulo, Métrica = "N registro(s)"), `DATA` (Grupo = caminho), `SUBTOTAL` e
  `GRAND_TOTAL` (Grupo = caminho ou "Total geral").
- **Resumido com 3 níveis (E1C):** no fim de cada nó de nível 1 (depois dos descendentes, antes do próximo
  nível 1 ou do Total geral) vai o bloco da folha — `reportDocument.buildLeafTotalBlock(vm, nó, { target:
  'xlsx' })`, o MESMO cálculo da folha: linha-título `TOTAL POR <NÍVEL FOLHA> – <NÍVEL 1>` (coluna A, estilo
  de grupo em toda a largura; não entra na largura da coluna), uma linha por grupo do nível folha (rótulo na
  coluna do nível folha, métricas nas colunas de sempre, números como números, faixa `leafOnly` só nessas
  linhas) e a linha `Total <nível 1>` (coluna A, estilo de subtotal). Com 1 ou 2 níveis e no Detalhado, o
  XLSX não muda; o **CSV e o JSON não levam o bloco**. Contagem 0 (`zeroAsEmpty`) fica 0 na planilha (na
  folha, "—"); colunas sem valor, que somem na folha, continuam na planilha. Gate
  `reports:sheet-xlsx-parity:verify` (folha × XLSX célula a célula, negativos com 2 níveis e no CSV).
- **Números são células numéricas** (nunca texto), com formato `#,##0.00`, `#,##0.000` (GMD), `#,##0.0`
  (totais em kg com 1 casa, E1B — as linhas de dados do Detalhado seguem as casas da coluna) ou `#,##0`
  (inteiro).
- Aba 2 **Manifesto**: uma linha por chave do manifesto (objetos em JSON), **sem** o `sha256`, que é do
  próprio arquivo e é calculado depois.
- Controle de XML: escape de `& < > " '` e remoção de caracteres de controle inválidos.

## 6. JSON (`jsonExporter.js`)

Estrutura do arquivo:

```json
{
  "manifest": { "...": "...", "contentSha256": "<sha-256 do corpo>" },
  "definition": { "id", "version", "title", "family", "grain", "grainLabel", "classification", "notes" },
  "parameters": {}, "period": {}, "filters": {}, "lockedFilters": {}, "search": "", "sort": [], "groups": [],
  "columns": [{ "id", "label", "type", "unit", "source", "sensitive" }],
  "aggregates": [{ "id", "columnId", "op" }],
  "data": [{ "_id": "...", "<coluna>": "<valor canônico>" }],
  "tree": [{ "id", "level", "columnId", "key", "label", "missing", "rowCount", "rowIds", "aggregates", "children" }],
  "totals": {}, "recordCount": 0, "uniqueAnimalCount": 0
}
```

- Valores canônicos (sem arredondar); `rowIds` só nas folhas.
- `manifest.contentSha256` = SHA-256 de `JSON.stringify(corpo)` (tudo exceto o manifesto, compacto) —
  recalculável por quem recebe o arquivo.
- O arquivo é gravado com indentação de 2 espaços. O `sha256` do arquivo inteiro é calculado depois da
  serialização e devolvido no resultado da emissão; ele não está dentro do próprio arquivo, e para JSON
  **não** é gravado manifesto separado.

## 7. Manifesto (`buildManifest`)

| Campo | Conteúdo |
|---|---|
| `manifestFormat`, `kind` | `1`, `pesagens.report-emission` |
| `reportId`, `reportName`, `reportDefinitionVersion`, `family`, `grain`, `classification` | Definição |
| `emissionId`, `emittedAt`, `emittedBy {id, nome, role}` | Emissão |
| `appVersion`, `schemaVersion`, `dataBuildId` | Versões |
| `format` | `csv`, `xlsx`, `json`, `print` ou `pdf` |
| `period`, `periodDescription`, `parameters` | Parâmetros resolvidos |
| `filters`, `lockedFilters`, `search`, `sort`, `groups`, `aggregates` | Seleção aplicada |
| `columns` | `[{ id, label }]` |
| `recordCount`, `uniqueAnimalCount`, `hiddenByPermission` | Contagens e colunas omitidas pelo perfil |
| `fileName` | `<slug do título>_<AAAAMMDD-HHMMSS UTC>_<8 primeiros do emissionId>.<ext>` |
| `sha256` | SHA-256 do conteúdo gerado (CSV/XLSX/JSON) ou do PDF gravado |
| `contentSha256` | só JSON (§6) |
| `orientation`, `size` | impressão/PDF (orientação); PDF (tamanho em bytes) |

## 8. Gravação

| Formato | Electron | Navegador de desenvolvimento | Manifesto separado |
|---|---|---|---|
| CSV, JSON (texto) | `files.writeUserFile` em `<dados>/relatorios` | download | CSV: `<arquivo>.manifest.json`; JSON: não (embutido) |
| XLSX (binário) | IPC `reports:save-file` → **diálogo nativo** "Salvar relatório" | download | `<arquivo>.manifest.json` em `<dados>/relatorios` |
| PDF | IPC `reports:print-to-pdf` → diálogo nativo "Salvar relatório em PDF" | iframe + diálogo de impressão ("Salvar como PDF") | `<pdf>.manifest.json` em `<dados>/relatorios`, com `sha256` e `size` do PDF gravado |
| Impressão | IPC `reports:print` → diálogo de impressão do sistema | iframe + `print()` | não grava |

Integridade: se o writer devolve um SHA-256 diferente do conteúdo gerado → erro `REPORT_INTEGRITY`.
Diálogo cancelado → `canceled: true`, nada gravado.

## 9. A folha: tela, impressão e PDF (E1B 1.4.0)

Um documento e um renderizador para os três canais: `domain/reportDocument.js`
(`buildReportDocument(viewModel, { header, orientation, showEmptyColumns, maxDataRows, widths })`, função
pura) → `infrastructure/exporters/sheetHtml.js` (`renderSheetBody(doc, { mode: 'fragment'|'print',
interactive })`) com o CSS de `sheetStyles.js`. A tela (`components/reports/ReportSheetView.jsx`) desenha
o mesmo HTML em modo `fragment` interativo; `printDocument.buildPrintDocument` embrulha em modo `print`.

**Documento** (`DOCUMENT_KIND = 'pesagens.report-document'`):

- `header` = `buildPropertyHeader(...)` (`catalog/domain/propertyHeader.js`, resolvido por
  `catalog/application/propertyHeaderService.loadReportHeader`): logo (data URL PNG/JPEG validado por
  assinatura e tamanho, ≤ 300 KB), titular, fazenda, endereço + município-UF, documentos (só com
  `mostrar_documento_no_cabecalho`), telefone (E1D: também só com essa opção). Sem propriedade: só o nome
  do sistema. Propriedade do cabeçalho: a de filtro/condição fixa/detalhe na coluna `propriedade` com um
  único valor; senão a padrão. E1D item 8: o cabeçalho não leva período nem "Emitido em".
- `title` = `sheetTitleOf(viewModel)`: "Relatório de <nome> (Sintético|Analítico)" pelo `view.titleKind` do
  tipo (E1D: "Analítico" só no Analítico de Pesagens; Vendas, que é Detalhado, é "Sintético"); sem tipo,
  pelo modo. `periodText` ("Período: dd/mm/aaaa a dd/mm/aaaa") fica ao lado do título, no lugar do antigo
  subtítulo "modo · níveis".
- Resumido (`layout: 'summary'`): colunas = rótulo do nível folha + métricas (`summaryMetrics`, rótulos
  `metricLabels`); par `metricPairs` vira **uma** coluna "de–até" (`rangeText`: `150–350`, `≥ 150`,
  `≤ 350`, `—`) e, com `leafOnly`, só é preenchido nas linhas do nível folha. Seções: 1 nível = tabela
  plana; 2 níveis = seção por nível 1 com tabela dos filhos + SUBTOTAL; 3 níveis = seção nível 1 ›
  subseção nível 2 (tabela + SUBTOTAL) + bloco `TOTAL POR <folha> – <nível 1>` = `groupRows` da
  população da seção de nível 1 pelo nível folha, com linha TOTAL; por fim `GRAND_TOTAL`.
- Detalhado (`layout: 'detail'`, botão "Ver como folha"): seções por nível com as linhas de dados e o
  subtotal em texto (`chips`); o par vira um item "Faixa exigida (kg): 150–350", só no subtotal do nível
  folha. Na tela, até 2.000 linhas de dados (`maxDataRows`; `screenNotice` avisa, só na tela);
  impressão/PDF levam todas.
- Cada linha é `columns.map(...)`: **uma célula por coluna, na ordem do cabeçalho** (`data-col` =
  índice). Gate `reports:document-layout:verify` confere célula × coluna em todas as linhas.
- **Colunas vazias somem**: métrica com total geral ausente (ou 0 com `zeroAsEmpty`) sai de `columns` e
  vai para `hiddenColumns`; `showEmptyColumns` desliga a regra (tela e impressão).
- Notas: **nenhuma** na folha desde a E1D (item 8, "menos informação na folha" — vale para todos os
  relatórios, a folha é uma só). As notas da definição continuam na tela, fora da folha (grade).
- Rodapé (`footer`): Filtros (`describeReportFilters`, uma linha), "@ = peso vivo ÷ 30|15" (quando há coluna
  em @), "<n> coluna(s) omitida(s) pelo perfil de quem emitiu" (só quando há) e "Emitido por <nome> em
  dd/mm/aaaa HH:MM". A margem da página leva só "Página X de Y" (versão e código da emissão ficam no manifesto).
- Ordem dos irmãos: `orderNodes` (mesma de `buildSummaryRows`); rótulo compara `compareGroupLabels`
  (chave `groupOrder` da coluna quando existe — Sessão pela data — senão o rótulo).
- Formato na folha: kg com **1 casa**, @ com 2, GMD com 3 (`aggregateLabels`; no Detalhado como folha, as
  colunas de peso das linhas também com 1 casa); XLSX usa `#,##0.0` para os totais em kg.
- O rodapé existe **só na folha** (tela, impressão, PDF). O bloco `TOTAL POR` existe na folha e,
  desde a E1C, no XLSX (§5; mesma função `buildLeafTotalBlock`); CSV e JSON do Resumido têm uma linha por nó
  do agrupamento + Total geral (§2.1) — os mesmos números por nó.
- Título: `Relatório de <vm.sheetTitle> (Sintético|Analítico)` — `sheetTitle` da definição (Pesagens =
  "Pesagens Individuais", E1C) ou o nome do relatório; o tipo entre parênteses como em `title` (E1D).

**Página** (`decideSheetLayout`): largura útil A4 com margens de 10 mm = **718 px** (retrato) e **1047 px**
(paisagem) a 96 dpi; fonte 8,5 / 7,6 / 6,8 pt (`m`, `s`, `xs`). `auto` tenta retrato m → paisagem m → s → xs;
retrato/paisagem escolhidos só reduzem a fonte. Larguras estimadas pelo conteúdo (rótulo 64–210 px, métrica
≥ 34 px); a **folga** da página vai primeiro para o rótulo do subtotal caber numa linha (até 300 px), sem
mudar `fits`. Detalhado: soma das larguras de tela ≤ 1000 (retrato) / 1520 (paisagem). Não coube →
`fits: false` + `PRINT_TOO_WIDE` "Este relatório possui muitas colunas para impressão." e, sem
`acceptTooWide`, `printReport`/`exportPdf` devolvem `{ blocked: true, layout }` (a tela oferece paisagem,
reduzir totais/colunas, exportar, continuar). **Nenhuma coluna é escondida por falta de espaço.**

**Impressão / PDF** (`printDocument.js`, `reportPrintService.js`):

- HTML autossuficiente, **sem script**, CSP `default-src 'none'; img-src data:; style-src
  'unsafe-inline'` (só o logo embutido); todo texto passa por `escapeHtml`; texto em CSS por `cssString`.
- `<table class="sheet-page">` externa: `thead` = cabeçalho da propriedade + título (**repete em cada
  página**), `tfoot` = rodapé, `tbody` = conteúdo; linhas não quebram; títulos de seção não ficam órfãos.
- `@page { size: A4 <orientação>; margin: 10mm 10mm 12mm 10mm }` com `@bottom-left` = `pageFooter` e
  `@bottom-right` = **"Página X de Y"** (`counter(page)`/`counter(pages)`) — o mesmo na impressão, no PDF e
  no iframe de desenvolvimento.
- IPC `pdfOptions({ landscape })`: `pageSize: 'A4'`, `printBackground`, **`displayHeaderFooter: false`**,
  **`preferCSSPageSize: true`** (o `@page` manda), margens de reserva 0,3937/0,4724 in.
- Manifesto de impressão/PDF: `orientation` e `arrobaDivisor`; PDF também `sha256` e `size`.

Gates: `reports:print-contract:verify` (estrutura, CSP, escape, cabeçalho/rodapé, orientação),
`reports:pdf-contract:verify` (opções do IPC), `reports:document-layout:verify` (alinhamento, somas,
colunas vazias, GMD "—", 0–3 níveis, Detalhado como folha), `reports:summary-export-parity:verify` (mesmos
números em folha, CSV, XLSX e JSON), `reports:sheet-xlsx-parity:verify` (bloco TOTAL POR folha × XLSX).

### 9.1 Gráficos na impressão, no PDF e no XLSX (E1G 1.4.2)

- **Mesma conta da folha**: `domain/reportCharts.buildReportCharts(viewModel, definition, config, role)` é a MESMA
  função da tela, sobre o MESMO view model (sem voltar ao banco), com os MESMOS specs dos totais da folha
  (`groupRows`/`computeAggregates`). Texto de número = `sheetNumberText` (o da folha); sem valor = `-`, nunca 0.
- **Impressão/PDF**: `preparePrint(viewModel, actor, { chartsConfig, chartsOnly })`. Com `chartsConfig` (objeto;
  `{}` = os padrões) sai "gráficos + folha": o bloco de gráficos entra ANTES da folha, no mesmo documento
  (`renderSheetBody(doc, { prelude })`), e a folha começa em página nova (`.rc-break`). `chartsOnly` = só os
  gráficos (sem a folha; o aviso "muitas colunas" não vale — os gráficos sempre cabem). Sem `chartsConfig`, o
  documento é exatamente o de antes.
- **SVG inline** (`exporters/chartSvg.js`): nunca `<img src=data:…>`, sem `<script>`, sem `foreignObject`, sem
  `href`; todo texto por `escapeHtml`; ids gerados (`rc-<n>`). A CSP do documento não muda. Retrato: 718 × 260,
  um por linha; paisagem: 515 × 230, grade 2 × 2 (o gráfico cuja tabela de dados tem mais de 8 colunas — ex.: um
  ano de meses — ocupa a linha inteira, 1047 px, para a tabela não vazar do cartão). No papel não há hover: rótulo
  de valor em toda barra, rótulo no fim das linhas (por cima das linhas, com contorno claro) e a tabela de dados
  embaixo de cada gráfico. Cores só por tokens `--rc-*`; a impressão usa
  sempre os tokens CLAROS (`CHART_CSS` não tem regra de tema escuro).
- **Permissão**: imprimir/exportar os gráficos passa pelo mesmo `assertCanExport`, com as colunas dos gráficos
  (`chartColumnIds`); a definição recusa coluna sensível em gráfico (`defineCharts`).
- **Manifesto**: `display: 'graficos'`, `chartsOnly` e `charts: [{ id, kind, title, config, series, points }]`.
- **XLSX**: `prepareEmission(viewModel, 'xlsx', actor, { chartsConfig })` → 3ª aba "Gráficos" com a tabela de
  dados de cada gráfico (números como números, nos formatos da coluna — os mesmos da tela e do PDF). Sem
  `chartsConfig` o arquivo não muda. O gráfico nativo do Excel (DrawingML) fica para depois. CSV e JSON não mudam.

Gates: `reports:charts:verify` (números × folha, "Demais", cores, histogramas, halteres, validação),
`reports:charts-print:verify` (documento, CSP, escape, tamanhos, tema claro, manifesto, permissão, XLSX),
`reports:charts-state:verify` (vista "Folha | Gráficos" e gráficos no estado da tela, nos modelos e no último
estado; a configuração da tela chega ao PDF e ao Excel; "Imprimir só os gráficos"/"PDF só dos gráficos" no menu ⋯).
Na tela, Imprimir/PDF na vista Gráficos saem "gráficos + folha" e o Excel leva a aba Gráficos; na vista Folha, como antes.

## 10. Segurança do IPC (`electron/ipc/reportIpc.cjs`)

| Canal | Função |
|---|---|
| `reports:print-to-pdf` | renderiza o HTML em janela oculta, gera PDF A4 (`printBackground`, rodapé com página X de Y), pergunta o destino, grava |
| `reports:print` | mesma janela; diálogo de impressão do sistema (A4, orientação informada) |
| `reports:save-file` | grava CSV/JSON (texto) ou XLSX (base64) no destino do diálogo; `.pdf` recusado aqui |

- **Janela de renderização trancada**: `show: false`, `sandbox`, `contextIsolation`, sem `nodeIntegration`,
  **sem JavaScript**, `webSecurity`, sem preload; `setWindowOpenHandler` nega janelas; `will-navigate`
  bloqueado. O HTML vai para um arquivo temporário removido ao final (e a janela é destruída).
- HTML precisa começar com `<!doctype html>` e ter no máximo 80 MB; arquivo gravado no máximo 200 MB;
  arquivo vazio recusado; `landscape` precisa ser booleano.
- **Destino só pelo diálogo nativo**: o renderer nunca envia caminho, apenas nome sugerido — reduzido a
  `basename`, com caracteres proibidos trocados por `_`, até 120 caracteres; pasta inicial = Documentos.
- **Allowlist de extensões**: `.pdf`, `.csv`, `.json`, `.xlsx`; outra extensão → `REPORT_IPC_001`; se o
  usuário apagar a extensão no diálogo, ela é recolocada.
- Escrita atômica (temporário + `rename`) e SHA-256 dos bytes gravados devolvido ao renderer.
