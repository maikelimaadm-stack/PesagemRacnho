# E1D — contratos entre os agentes A/B/C/D (definidos pelo integrador antes de soltar os agentes)

Especificação: `docs/plano-mestre/E1D-RELATORIO-PESAGENS-INDIVIDUAIS.md`. Referência do antigo:
`docs/evidence/e1d/referencia-makgestao/RelatorioPesagensIndividuais.jsx.txt` (análise completa no fim deste
arquivo, §9). **Regra da etapa: SOMENTE FUNCIONAL** — nada de CSS, cores, posição de botões ou navegação. Se
algo exigir tela, o mínimo (reusar componentes e classes que já existem) e anotar "precisa da E1E".

A estrutura comum já está no commit de contratos (o integrador fez):

## 1. Definição (`reportDefinition.js`, `definitions/pesagens.js`)

- Visão ("Tipo de relatório") aceita as chaves novas `layout` ('matrix'), `matrix` ({eixoY, eixoX}),
  `population` (condições FIXAS do tipo), `groupChoices` (botões de agrupamento), `columnChoices`
  ({available, defaults} do seletor "Colunas"), `columnLabels` ({columnId: cabeçalho}) e `titleKind`
  ('Analítico' | 'Sintético'). Validação em `defineViewExtensions`.
- Definição aceita `defaultView`, `matrixAxes`, `sortChoices`, `defaultSortChoice`.
- `metricKeysOf(aggregates, metricPairs)`: chaves de métrica do Resumido — o par "de–até" (Faixa exigida)
  vira UMA chave (`faixa`).
- Pesagens declara os 5 tipos, nesta ordem e com estes ids (estáveis — vão para último estado, modelos e
  manifesto): `analitico` "Analítico (Detalhado)", `sintetico-matriz` "Sintético (Matriz)",
  `por-apartacao-lote` "Por Apartação/Lote", `por-apartacao-data` "Por Apartação (Resumo por Data)" (padrão),
  `vendas` "Vendas (Detalhado)". As constantes (colunas, totais, eixos, população, ordenações) estão em
  `pesagens.js` com o nome de cada parte (ANALITICO_*, MATRIX_*, SHEET_*_KEYS, VENDAS_*, PESAGENS_SORT_CHOICES).
- Coluna nova `mes_pesagem` "Mês" (eventColumns.js): chave e ordem "aaaa-mm", rótulo "set/2026", só agrupa.

## 2. Seleção e serviço (`reportService.js` → `resolveViewSelection`)

- `selection.view`: id de tipo declarado ou null (Personalizado). Desconhecido = erro.
- Com tipo:
  - `population` do tipo vira condição fixa (lockedFilters) — tela, exportações e modelos;
  - matriz: `selection.matrix` (padrão = o do tipo), eixos conhecidos e diferentes (iguais = erro); os grupos
    SÃO [eixo Y, eixo X] (a direção pedida em `selection.groups` para a coluna do eixo é mantida);
  - `groupChoices` (Analítico): grupos ⊆ escolhas (até 3); fora = erro;
  - demais: as colunas de agrupamento são as do tipo (direção livre); diferente = erro;
  - modo = o do tipo (exceto no detalhe de um grupo — drill — que é Detalhado);
  - sem colunas/totais na seleção → os padrão do tipo (`viewSelection`, com `columnChoices.defaults`).
- `selection.sortChoice`: id de `definition.sortChoices` ou null → `applySortChoice(definition, view,
  {sort, summarySort, groups}, choiceId)` em `domain/sortChoices.js` (HOJE É IDENTIDADE — o Agente C implementa).
- View model ganha `view` ({id, label, layout, titleKind} | null), `matrix` ({eixoY, eixoX, rowAxis, colAxis} |
  null) e `sortChoice`. `columns[].label` usa `view.columnLabels` quando houver.
- Modelos e último estado (`reportTemplateService.normalizeTypedConfig`): guardam `view`, `matrix`,
  `sortChoice`; ao abrir, o que deixou de existir sai com aviso (TEMPLATE_TYPE_REMOVED).

## 3. Tela (`ReportView.jsx`, `ReportFilterBar.jsx`)

- Estado: `view`, `matrix`, `sortChoice` (withTypedState: estado antigo sem `view` ganha o tipo que bate pela
  estrutura — `resolveViewId`). Abre no `defaultView` quando não há modelo, visão antiga nem último estado.
- "Tipo de relatório" → `applyView` (view, matrix, groups, modo, colunas/totais padrão do tipo).
- Controles genéricos (Agrupar por, Níveis, Resumido/Detalhado) → `view: null` (Personalizado). Drill mantém.
- `ReportFilterBar` tem o encaixe `typeControls` (depois do Tipo): cada parte passa o SEU componente, em
  arquivo próprio: A → `MatrixAxisControls.jsx` (Linhas (Eixo Y) / Colunas (Eixo X), com `BarSelect` —
  exportar BarSelect se precisar); C → `AnalyticGroupButtons.jsx` (Lote, Apartação, Sexo, Raça — botões em
  ordem de clique, até 3, reusando `rpt-quick-filter is-on`). Só o tipo atual mostra o seu controle.

## 4. Quem faz o quê (arquivos donos; tocar fora = só o mínimo, anotado no retorno)

| Parte | Faz | Dono de | Gate novo |
|---|---|---|---|
| **D** Tipos + folha + respostas 2/4 | tipos (nomes/ordem/padrão já declarados — conferir contra o antigo), conversão de modelos/último estado da E1B (`por-lote`, `por-data`, "Resumo por Sessão"/padrão, `analitico` antigo, `por-apartacao-data` antigo) para o tipo mais próximo **com auditoria como na E1** (origem própria, ex. `relatorios-tipos-e1d`); título da folha pelo `view.titleKind` (sem tipo: pelo modo); limpeza da folha (item 8: sem subtítulo "Resumido · …", sem "Emitido em" no cabeçalho — só no rodapé —, sem notas longas; rodapé = filtros numa linha, "@ = peso vivo ÷ N", emitido por/data/hora e "Página X de Y"; abaixo do título só "Período: dd/mm/aaaa a dd/mm/aaaa" — no lugar do subtítulo, sem CSS novo); confirmar "Mostrar no cabeçalho" desmarcado por padrão; `/Relatorios?r=pesagens` abre no tipo padrão; **resposta 2** (grade de Parceiros/Propriedades com CPF/CNPJ mascarado; pesquisa e filtro aceitam com ou sem pontuação); **resposta 4** (`docs/user/USUARIOS.md` com os 4 perfis); atualizar os gates `reports:sheet-data`, `reports:document-layout`, `reports:sheet-xlsx-parity` (hoje vermelhos só por citarem os tipos da E1B), `reports:templates`, `reports:print-contract`, `reports:pdf-contract` e o que a limpeza da folha mexer | `reportDocument.js` (cabeçalho/título/rodapé/notas), `sheetHtml.js`, `printDocument.js`, `reportTemplateService.js` (conversão), `reportViews.js` (matchView/resolveViewId), telas/serviços de Cadastros da resposta 2 | `reports:pesagens-tipos:verify` |
| **C** Analítico + colunas por tipo + 8 ordenações | Analítico: colunas padrão/opcionais (já declaradas), subtotal animais/peso médio/GMD médio (já declarados — conferir na folha e no XLSX), `AnalyticGroupButtons.jsx`; **colunas por tipo e por usuário**: chave nova de appSettings `report-type-columns:<empresa>:<usuario>` → `{ version: 1, reports: { [reportId]: { [viewId]: string[] } } }` (lista = chaves de `columnChoices.available`, na ordem escolhida), API `getTypeColumnPrefs(reportId, actor)` / `saveTypeColumnPrefs(reportId, viewId, keys, actor)` no reportTemplateService (validar contra o tipo; sem esquema novo); o seletor "Colunas" (MakColumnConfigDialog) passa a funcionar também nos tipos resumidos (métricas por chave: `applyColumnKeys` / `columnKeysOf` em reportViews.js); `applyView` aplica a escolha salva do tipo; **8 ordenações**: `applySortChoice` em `domain/sortChoices.js` (regras no §5) e o seletor "Ordenar por" mostra exatamente as 8 quando `definition.sortChoices` existir | `domain/sortChoices.js`, `AnalyticGroupButtons.jsx`, trechos de `ReportView.jsx` (Colunas, Ordenar por, botões), prefs no `reportTemplateService.js` | `reports:columns-per-type:verify` |
| **A** Sintético (Matriz) | `domain/matrixLayout.js` (`buildMatrix(viewModel)`: linhas = valores do eixo Y, colunas = do eixo X, célula = Qtd/Peso médio/GMD médio do nó Y›X; coluna TOTAL = nó Y; linha TOTAL = a população inteira reagrupada por X com o MESMO motor (`groupRows`); canto = `viewModel.totals` — nunca soma de médias; ordem: rótulo/`groupOrder` (mês cronológico); célula sem animais = vazia; GMD sem anterior = "—"); folha (`reportDocument` layout `matrix` + render em `sheetHtml` — três valores por célula como no antigo: Qtd, Peso médio kg, GMD; linha "Linhas: … · Colunas: … · Valores: Qtd / Peso médio / GMD médio"); XLSX (uma planilha: cabeçalho de 2 linhas — eixo X × {Qtd, Peso médio (kg), GMD médio (kg/dia)} —, números como números, TOTAL); CSV/JSON: o Resumido de 2 níveis como hoje (declarar no gate); `MatrixAxisControls.jsx`; drill na célula é opcional | `domain/matrixLayout.js`, trechos de `reportDocument.js`/`sheetHtml.js`/`xlsxExporter.js` só do layout matrix, `MatrixAxisControls.jsx` | `reports:matrix:verify` (casos à mão 2×2 e 3×4, totais recalculados, GMD ponderado, eixos iguais recusados, mês "set/2026" em ordem cronológica, paridade folha × XLSX) |
| **B** Vendas (Detalhado) | conferir população (= "Vendas do período": mesmas linhas), agrupamento por comprador (texto; "Não informado" por último), colunas padrão e opcionais (já declaradas), cabeçalhos do antigo por `columnLabels` (Qtd @ = peso vivo ÷ divisor, Valor @, Valor total), subtotal por comprador e total geral (animais distintos, peso total, peso médio, @, valor total), permissão comercial (quem não tem `commercial.values` — hoje CONSULTA… conferir a matriz — não vê valores nem totais de valor, sem erro), folha (Detalhado como folha, título "(Sintético)") e XLSX; decidir e documentar o valor total sem `valor_venda_total` (o antigo calculava peso ÷ 30 × valor @; ver como o Lançamento grava a saída por venda antes de decidir — nada de conta inventada) | trechos de `pesagens.js` só da visão `vendas`, o que a folha/XLSX do Detalhado precisar | `reports:vendas-por-comprador:verify` (população só de vendas = comercial.vendas, subtotais conferíveis, permissão) |

## 5. "Ordenar por" (Agente C) — as 8 do antigo, com os rótulos dele

`data_desc` Data (Mais Recente) · `data_asc` Data (Mais Antiga) · `peso_desc` Peso (Maior) · `peso_asc` Peso
(Menor) · `gmd_desc` GMD (Maior) · `gmd_asc` GMD (Menor) · `animal_asc` Animal (A-Z) · `lote_asc` Lote (A-Z).
Padrão: `data_desc`. Tradução por tipo (o antigo não ordenava os resumidos; a especificação pede "a métrica
equivalente" dentro de cada seção; ausentes sempre por último, desempate estável):

- **Analítico / Vendas (Detalhado)** — ordem das linhas (dentro de cada grupo; grupos em ordem natural):
  data ± (desempate animal A-Z), peso ±, GMD ± (sem GMD por último, nunca como 0), animal A-Z (numérico:
  "2" antes de "10"), lote A-Z (desempate data mais recente).
- **Por Apartação (Resumo por Data)** — data ± = direção do nível Data; peso ± = `peso_medio`; GMD ± =
  `gmd_medio`; animal/lote = ordem natural (rótulo A-Z) dos lotes.
- **Por Apartação/Lote** — sem nível de data: data ± = ordem natural; peso/GMD como acima; animal/lote =
  rótulo A-Z.
- **Sintético (Matriz)** — peso ± / GMD ± ordenam as LINHAS (eixo Y) pelo total da linha; data ± inverte o eixo
  Mês quando ele é um dos eixos (senão ordem natural); animal/lote = ordem natural.
- Sem tipo (Personalizado) e outros relatórios: o "Ordenar por" de hoje (E1B) continua.

## 6. Regras comuns

- Contas: o motor da E1 (animais = `countDistinct` do animal; GMD = `weightedGmd`; médias e totais
  recalculados sobre a população de cada grupo; nunca soma de médias). O antigo contava linhas e fazia média
  simples do GMD — **não copiar**.
- Sem mudança de esquema (appSettings é chave-valor; chave nova de preferência é permitida).
- Cada parte roda SÓ os gates da sua área (+ lint dos arquivos que tocou). test:quick completo só no fim, pelo
  integrador. Nada de push, nada de main, nada de E2+.
- Cada parte trabalha no SEU worktree (`.tmp/e1d-wt-<a|b|c|d>`, branch `e1d/agente-<a|b|c|d>`), commits
  pequenos, e devolve: arquivos tocados, gates rodados, decisões, pendências "precisa da E1E", perguntas.
- Gate novo: `scripts/verify-<nome>.mjs` + script `npm run <nome>:verify` no package.json + registrado no
  `test:quick` e no `test:full` (logo depois dos gates de relatórios da E1C). Use `scripts/lib/reportFixtures.mjs`.
- Escrita pt-BR de curral; comentários no estilo do código em volta.

## 9. Análise do relatório antigo (resumo do que importa)

- Tipos (valor/rótulo): analitico "Analítico (Detalhado)", sintetico "Sintético (Matriz)", apartacao "Por
  Apartação/Lote", apartacao_data "Por Apartação (Resumo por Data)", vendas "Vendas (Detalhado)". O antigo abria
  no Analítico; a E1D abre em Resumo por Data (especificação).
- Analítico: botões Lote/Apartação/Sexo/Raça, multi, ordem de clique (o antigo fazia chave composta "LOTE A →
  MACHO"; aqui são níveis do motor, até 3). Colunas na ordem: Data, Animal, Sexo, Raça, Peso, Lote, Apartação,
  [Data anterior], [Peso anterior], Dias, Ganho, GMD, [Obs]. Subtotal "n animais | Peso Médio | GMD Médio".
- Matriz: "Linhas (Eixo Y)" / "Colunas (Eixo X)" com Lote, Apartação, Sexo, Raça, Mês; padrão Y = Sexo, X = Lote;
  célula com 3 linhas (qtd, peso médio kg, GMD); coluna e linha TOTAL; célula sem animais vazia. Bugs a NÃO
  copiar: meses em ordem alfabética, GMD sem ponderar, canto com regra diferente.
- Por Apartação/Lote e Resumo por Data: 17 colunas do painel (a E1D reduz o padrão para 11). Bugs a NÃO
  copiar: cabeçalho × corpo desalinhados, TOTAL GERAL com 16 células para 9 cabeçalhos.
- Vendas: `tipo_manejo === 'Saída' && motivo_saida === 'Venda'`; por comprador (`comprador || 'Sem Comprador'`);
  detalhe Comprador, Data, Animal, Peso (kg), Qtd @ (= peso ÷ 30, calculado), Valor @, Valor Total (=
  `valor_venda_total` se > 0, senão peso ÷ 30 × valor @); total por comprador: n animais, peso médio, peso
  total, média (@), valor total; TOTAL GERAL. Sem regra de permissão no antigo.
- Título: "(Analítico)" só no Analítico; os outros 4 (inclusive Vendas) "(Sintético)". Subtítulo só "Período:".
- "Ordenar por": 8 opções, padrão Data (Mais Recente).
