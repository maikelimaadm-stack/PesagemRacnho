# E1G — GMD em todos os relatórios e gráficos de peso e ganho (versão 1.4.2, sem mudança de esquema)

Pedido direto da responsável em 30/09/2026: "os GMDs não estou puxando nos relatórios, preciso de gráficos de
ganho e de pesos". Respostas dela:
- faltou GMD em **todos** os relatórios (Pesagens, Desempenho, Rebanho atual);
- quer **todos** os gráficos: evolução do peso, GMD por lote/categoria, faixas de peso e curva do animal;
- as pesagens antigas entraram por **planilha com todas as pesagens** (histórico completo);
- na **venda/abate com peso**, calcular o GMD também.

Diagnóstico (massa de TESTE em fake-indexeddb; nada dos dados reais):
1. **Desempenho** recalcula o GMD só com pesagens DENTRO do período e exige 2 pesagens no período. Quem pesa
   por aparte (meses entre pesagens) fica sem GMD em todo o relatório (`animalRows.js`, `hasPair`).
2. A folha **esconde** coluna/métrica sem valor no padrão do tipo (`reportDocument.js` `isEmptyColumn` /
   `metricIsEmpty`): o GMD some em vez de aparecer "-".
3. **Rebanho atual** não tem GMD (nem coluna, nem métrica).
4. **Saída com peso** (venda, abate) nunca recebe GMD (`weighingSeries.js` e `weighingService.createEntry` só
   calculam em `Manejo`).
5. Importação: o mesmo animal escrito de outro jeito ("01016", "1016,0" do Excel) não casa com o existente e vira
   animal NOVO (Cadastro, sem GMD), partindo a série. Cabeçalhos "Dt.Ant."/"Peso Ant." do MAKGESTAO não são
   reconhecidos. Histórico com datas anteriores ao Cadastro já gravado é recusado (CONFLITO).
6. Não existe gráfico nos relatórios; a curva da Ficha do Animal usa eixo por índice (inclinação mente).

## Parte A — GMD

A1. **Saída com peso** passa a ter data/peso anterior, dias, ganho e GMD contra a pesagem anterior (mesma função
`calculateWeightGain`). Cadastro continua sem. Lançamento (prévia) igual. Os dados já gravados são recalculados
**uma vez** na abertura da 1.4.2 (marcador em configurações; só campos derivados; sem esquema novo; idempotente;
com registro no log e na auditoria como ação de sistema). Vendas/Saídas/Comercial/Romaneio oferecem Dias, Ganho
e GMD em "Colunas"; o tipo "Saídas › Analítico" mostra GMD no padrão. O layout W3 de Vendas não muda no padrão.

A2. **Desempenho**: o peso inicial do animal é a **última pesagem com peso ANTES do período**, quando existir
(vem do `data_anterior`/`peso_anterior` gravado na primeira pesagem do período). Assim o GMD do período =
Σganho ÷ Σdias das pesagens do período — o mesmo número do relatório Pesagens. Sem pesagem anterior, o
comportamento atual continua. Notas do relatório atualizadas.

A3. **GMD nunca some da folha**: colunas `dias`, `ganho`, `gmd` e métricas `gmd_medio`/`gmd_ponderado`/ganho
ficam visíveis mesmo vazias ("-"), com a nota "GMD de N de M cab." quando faltar para alguém.

A4. **Rebanho atual**: colunas novas "Peso de entrada", "Data de entrada", "Ganho desde a entrada", "Dias desde
a entrada", "GMD desde a entrada" e "Último GMD" (da última pesagem com GMD). O Analítico mostra "Último GMD" e
"GMD desde a entrada"; os resumos (Por Lote, Categoria…) ganham a métrica "GMD médio" (ponderado).

A5. **Importação**:
- identidade: número de brinco numérico casa sem zeros à esquerda e sem ",0"/".0" (só para achar o animal;
  o número gravado não muda); a análise avisa quantas linhas casaram por número parecido;
- cabeçalhos "Dt.Ant.", "Dt. Anterior", "Peso Ant." reconhecidos;
- histórico com data anterior ao Cadastro já gravado: a linha mais antiga passa a ser o Cadastro e o Cadastro
  antigo vira Manejo, na mesma transação, com recálculo da série (a análise mostra isso antes de gravar).

A6. **Qualidade dos dados** (aba Controle): novos apontamentos "Animal com uma pesagem só", "Manejo sem GMD" e
"Números parecidos (zeros à esquerda)".

## Parte B — Gráficos

Contrato de dados e desenho (SVG próprio, sem biblioteca, offline; paleta validada pelo validador da skill dataviz):
- `src/modules/reporting/domain/reportCharts.js` (puro): `defineCharts`, `chartsOf(definition, role)`,
  `normalizeChartConfig(definition, config)`, `buildReportCharts(viewModel, definition, config, role)` →
  `ChartData[]` `{ id, kind, title, subtitle, unit, xType, series:[{key,label,slot,points:[{xKey,x,xLabel,y,text,cab,drill}]}],
  referencia, total, cobertura:{validos,total,texto}, notas, vazio, textoVazio, tabela:{cabecalho,linhas} }`.
  Todo número sai do MESMO view model do `runReport` via `groupRows`/`computeAggregates` com os MESMOS specs da
  folha (peso médio avg; GMD weightedGmd = Σganho÷Σdias; ganho sum; @ = ganho ÷ divisor; cab countDistinct) —
  o gráfico bate com a folha por construção. Sem valor = ponto ausente, nunca 0.
- `chartScale.js` (ticks, escala de tempo proporcional, bandas, `chartGeometry`), `infrastructure/exporters/chartSvg.js`
  (`renderChartSvg`, `renderChartTable`, `renderChartsBlock`) e `chartStyles.js` (tokens claro/escuro).
- Máx. 7 cores em ordem fixa (#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #4a3aa7; escuro #3987e5 #d95926
  #199e70 #c98500 #d55181 #008300 #9085e9) + "Demais" cinza calculado sobre a união das linhas; a cor segue a
  entidade (ordem da população), filtro não repinta. Vermelho reservado a perda de peso. Texto sempre em tinta
  de texto. Linhas 2 px, barras ≤ 24 px com ponta arredondada, grade fina, eixo único.

Gráficos:
| Relatório | Gráficos |
|---|---|
| Pesagens | Evolução do peso médio (linha; série Lote padrão/Apartação/Sexo/Raça/Marca/Todos; eixo Mês/Data; alternador Peso médio/GMD médio); GMD por grupo (barras horizontais, cobertura, grupos sem GMD em texto); Ganho e @ por mês (colunas, kg/@); Distribuição do peso (histograma, última pesagem de cada animal) |
| Desempenho | GMD por grupo; Peso inicial × final por grupo (halteres); Animais por faixa de GMD (<0, 0–0,3, 0,3–0,6, 0,6–0,9, 0,9–1,2, ≥1,2); Distribuição do peso final |
| Rebanho atual | Distribuição do peso atual; GMD médio por lote |
| Ficha do Animal | Curva de peso com eixo de tempo real, eixo Y em kg, tooltip (data, peso, dias, ganho, GMD do trecho), tema escuro |

Tela: alternador **Folha | Gráficos** na faixa de ferramentas da área do papel (só nos relatórios com gráficos);
período, filtros e detalhe valem para as duas vistas; trocar de vista não roda o relatório de novo. Cartões com
título, subtítulo (período, definição do GMD, cobertura), controles do próprio gráfico, SVG, legenda (liga/desliga
série), "Ver tabela", tooltip no hover/foco; clique numa barra abre a folha no detalhe daquele grupo. Tema claro e
escuro. Estado (`display`, `charts`) no último estado e em "Meus relatórios" (chaves só quando diferentes do padrão).

Impressão/PDF: na vista Gráficos, Imprimir/PDF saem "gráficos + folha" (gráficos antes, folha em página nova);
menu ⋯ "Imprimir só os gráficos"/"PDF só dos gráficos". SVG inline (sem imagem, sem script; CSP do PDF intacta),
rótulo de valor em toda barra e tabela de dados abaixo de cada gráfico, sempre tokens claros. Excel: aba
"Gráficos" com as tabelas de dados (mesmos números). Permissão: só colunas não sensíveis; exportar exige
`reports.export` pelo mesmo `assertCanExport`.

## Gates novos
`reports:gmd` (A1–A4 e A6), `import:identity` (A5), `reports:charts`, `reports:charts-print`,
`reports:charts-state`, `animal:weight-curve` — todos ligados no test:quick e no test:full.

## Não faz
Meta/farol de GMD (E7), gráfico nativo do Excel, mudança de esquema, push, avançar a main.
