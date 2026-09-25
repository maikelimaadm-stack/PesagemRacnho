# Contrato de emissão: CSV, XLSX, JSON, impressão e PDF

Fontes: `application/reportExportService.js`, `application/reportPrintService.js`,
`domain/reportFormatting.js`, `infrastructure/exporters/reportLayout.js`, `csvExporter.js`,
`jsonExporter.js`, `xlsxExporter.js`, `printDocument.js` e `electron/ipc/reportIpc.cjs`.

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
  metadados; JSON: `mode`, `drill`, `summary {headers, metrics, rows}` e `data: []`; impressão: tabela
  `tr.sum.lvlN`. Larguras estimadas pelo conteúdo (`summaryColumnWidths`: rótulo até 200 px e depois
  quebra linha; métrica = maior entre a palavra mais longa do cabeçalho e o maior número); A4 retrato
  até 718 px impressos, paisagem até 1047 px, acima disso o aviso "muitas colunas". Nada é cortado com
  reticências.
- Manifesto: `presetId` (visão antiga — também quando a tela abre pelo favorito/link antigo e chama o
  relatório novo com `request.presetId`), `mode`, `summarySort` e `drill`.
- Proteção contra fórmula no CSV (`protectFormula`): apóstrofo em todo texto iniciado por `=`, `+`, `@`
  ou `-`, exceto número negativo puro (`-12`, `-1,5`); a importação (`importFile.unprotectFormula`) usa
  a regra espelhada.
- `drill` (clique no grupo): corte exato por `groupKeyOf` do caminho escolhido, aplicado antes do
  agrupamento; aparece em "Filtros" como "(detalhe do grupo)".

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
- **Números são células numéricas** (nunca texto), com formato `#,##0.00`, `#,##0.000` (GMD) ou `#,##0`
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

## 9. Impressão e PDF (`printDocument.js`, `reportPrintService.js`)

- HTML autossuficiente, **sem script**, com CSP `default-src 'none'; style-src 'unsafe-inline'`; todo
  texto passa por `escapeHtml`.
- Papel **A4**; margens 12/10/14/10 mm; fonte 8,5 pt; `thead` repetido em cada página; linhas não quebram.
- **Cabeçalho**: "Pesagens Individuais" (+ organização se informada), título, Período (ou "Sem período
  (estado atual)"), Grão, Filtros (fixos marcados "(fixo)" e pesquisa), Agrupado por, selo de
  classificação legada; à direita: emitido em/por (papel), Registros · Animais únicos, versão e esquema,
  emissão (8 caracteres).
- Corpo: linhas de grupo com "N registro(s)", dados, subtotal e **Total geral** com os totais em chips e
  "(n de N)" quando há ausentes; sem totais configurados, "Registros: N".
- Final: notas da definição; aviso de colunas omitidas pelo perfil; "Ausentes são exibidos como “—” e
  não entram em médias e somas. Total geral recalculado sobre toda a população filtrada."
- **Rodapé**: "Pesagens Individuais <versão> · Emissão <8> · <relatório>" e **"Página X de Y"** —
  via `@page` (impressão/iframe) ou `footerTemplate` nativo do `printToPDF` (PDF, com não-ASCII
  convertido em entidade numérica).

**Regra de orientação** (`decidePrintLayout`, larguras = `widths` do modelo ou `defaultWidth`):

| Condição | Resultado |
|---|---|
| ≤ 8 colunas **e** soma das larguras ≤ 1000 | retrato (`auto`) |
| senão, soma ≤ 1520 | paisagem (`auto`) |
| não cabe na orientação escolhida | `fits: false` + aviso `PRINT_TOO_WIDE` "Este relatório possui muitas colunas para impressão." |

Com `fits: false` e sem `acceptTooWide`, `printReport`/`exportPdf` devolvem `{ blocked: true, layout }`.
A tela oferece: Usar paisagem (se retrato), Reduzir colunas, Exportar CSV, Continuar mesmo assim.
**Nenhuma coluna é escondida automaticamente.**

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
