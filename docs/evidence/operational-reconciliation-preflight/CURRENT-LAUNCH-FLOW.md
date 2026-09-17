# CURRENT-LAUNCH-FLOW — mapa do fluxo atual do Lançamento de Pesagens

> Pré-voo (somente leitura) para o programa "sanity-launch-import".
> Branch `program/sanity-launch-import`, HEAD `d44d5b9` (conferido em `.git/HEAD` e `git log -1`).
> Data da leitura: 17/09/2026. **Nada foi implementado.** O código atual é a fonte da verdade;
> quando um documento antigo diverge, a divergência está registrada na seção 23.

## 0. Legenda de arquivos e método

| Sigla | Arquivo | Linhas |
|---|---|---|
| **LPI** | `src/pages/LancamentoPesagensIndividuais.jsx` | 2420 (lido inteiro) |
| **SEQ** | `src/components/pesagens/SequenciaBrincos.jsx` | 244 |
| **LOOK** | `src/components/pesagens/animalLookup.jsx` (o pedido citava `src/pages/animalLookup.jsx`, que **não existe**) | 67 |
| **SNDLG** | `src/components/pesagens/ConfirmarAnimalSnDialog.jsx` | 127 |
| **SELDLG** | `src/components/pesagens/SelecionarAnimalDialog.jsx` | 39 |
| **SAIDLG** | `src/components/pesagens/GerenciarSaidasDialog.jsx` (não é usado — ver D-01) | 115 |
| **WPREV** | `src/components/pesagens/weightPreview.js` | 30 |
| **RODAPE** | `src/components/pesagens/PesagensResumoRodape.jsx` | 112 |
| **RLOTES** | `src/components/pesagens/ResumoLotes.jsx` | 84 |
| **WSVC** | `src/modules/weighing/application/weighingService.js` | 267 |
| **WADP** | `src/modules/weighing/infrastructure/weighingDataAdapter.js` | 800 |
| **WMAP** | `src/modules/weighing/domain/weighingMapper.js` | 150 |
| **WCALC** | `src/modules/weighing/domain/weighingCalculations.js` | 35 |
| **WSER** | `src/modules/weighing/domain/weighingSeries.js` | 50 |
| **WWARN** | `src/modules/weighing/domain/weighingWarnings.js` | 57 |
| **COMM** | `src/modules/weighing/domain/commercialCalculations.js` | 58 |
| **BRV** | `src/modules/weighing/domain/brazilianValues.js` | 68 |
| **CAT** | `src/modules/operations/domain/categorySuggestion.js` | 56 |
| **AHIST** | `src/modules/animals/domain/animalHistory.js` | 152 |
| **AHSVC** | `src/modules/animals/application/animalHistoryService.js` | 24 |
| **SN** | `src/modules/animals/domain/snAnimal.js` | 28 |
| **POL** | `src/modules/operations/application/operationalPolicies.js` | 123 |
| **OIS** | `src/modules/operations/application/operationalInsightsService.js` | — |
| **SCHEMA** | `src/storage/indexedDb/schema.js` | — |
| **CSS** | `src/styles/d17b-modelobase1.css` | — |

Método: leitura integral de LPI em blocos (1–400, 400–800, 800–1200, 1200–1600, 1600–2020, 2020–2420), leitura integral dos componentes e do caminho de gravação, `grep` de usos (estados mortos, componentes não importados, gates em `scripts/`).

---

## 1. Visão geral e cadeia de gravação

```
LPI (React, estado local)                                        Dexie / IndexedDB
 ├─ handleSalvar (LPI:789-1089)
 │    ├─ validações de tela (LPI:796-901)
 │    ├─ cálculo de ganho de pré-visualização  calculateWeightGain (LPI:910-916)  ← descartado pelo serviço
 │    ├─ lote automático / transferência (LPI:919-943)
 │    ├─ perfil do animal / categoria (LPI:964-983)
 │    ├─ cálculo comercial calculateCarcassTrade (LPI:947-951)
 │    └─ payload `data` (LPI:989-1053)
 ├─ weighingService.createEntry (WSVC:53-103)   | updateEntry (WSVC:199-216)
 │    ├─ permissão weighing.write/edit (WSVC:16-24) e remoção de valores comerciais sem commercial.write (WSVC:26-35)
 │    ├─ validateUiPayload (WMAP:51-79)
 │    ├─ recálculo canônico de data/peso anterior, dias, ganho, GMD só para Manejo (WSVC:60-77)
 │    ├─ uiToStorageRecord + allowlist do legacy_payload (WMAP:6-19, 81-113)
 │    └─ weighingDataAdapter.createEntry (WADP:297-391) | updateEntry (WADP:393-436)
 │          ├─ validateAnimalChronology (WADP:165-191)
 │          ├─ sessão do dia (WADP:318-329)
 │          ├─ categoria automática carimbada (WADP:197-207, 331-334)
 │          ├─ pesagens.add (WADP:335)
 │          ├─ Cadastro: animais + animalIdentificadores VISUAL (WADP:336-345)
 │          ├─ animalLotes / movimentosAnimais (WADP:346-371)
 │          ├─ retroativo: rebuildAnimalLotProjection (WADP:374-378)
 │          ├─ auditoria CRIAR (WADP:379-387)
 │          └─ rebuildAnimalStateProjection (WADP:215-258, 388)
 │    └─ inserção retroativa → recalculateWeightSeriesForKeys (WSVC:81-88, 148-197)
 └─ pós-salvar: refreshAnimalSeries (LPI:556-574) + resets (LPI:1074-1083)
```

---

## 2. Layout ModeloBase1 atual (regiões)

| Região | Elemento | Linhas | Observação de CSS |
|---|---|---|---|
| Contêiner | `ModeloBase1PageContainer variant="form"` com classes `d17b-launch-page mak-mother-page` | LPI:1275-1278 | `src/components/modelobase1/layout/ModeloBase1PageContainer.jsx:3-16` |
| Scroll | `.mak-mother-page__chrome` | LPI:1279 | — |
| Cabeçalho (oculto) | `ModeloBase1PageHeader visuallyHidden` | LPI:1281-1287 | — |
| Barra de tipo (toolbar) | `ModeloBase1ActionBar` → `.d17d-launch-typebar` | LPI:1289-1436 | `src/components/modelobase1/Primitives.jsx` (ActionBar) |
| ├ Tipo de movimentação | Select | LPI:1294-1304 | — |
| ├ Gerenciar Apartações | botão ícone | LPI:1306-1314 | — |
| ├ Saída: Motivo / Causa / Dados da venda / Dados do abate / Documentação | | LPI:1316-1373 | — |
| ├ Cadastro: Sequência de brincos (Tag) / Dados de compra (olho) | | LPI:1375-1382 | — |
| ├ **Fragmento vazio para Cadastro/Manejo** | `<></>` | **LPI:1384-1386** | espaço já reservado na barra |
| └ Ações à direita: painel de resumo, "+", colunas, atualizar | `.d17d-launch-typebar__actions` | LPI:1390-1434 | CSS:1761-1764 |
| Faixa do formulário | `.mak-mother-page__panel-strip` (`data-mak-region="panel-strip"`) → Card `d17b-form-card` | LPI:1439-2060 | CSS:925 |
| ├ Linha de campos | `.d17d-launch-fields--registration|movement` | LPI:1442-1576 | flex-wrap com larguras fixas R30 (CSS:3755-3786) |
| ├ Faixa de avisos/desempenho | `.d17d-launch-feedbacks` → `.d17d-animal-performance` (Animal · Última · Ganho · tendência · aviso) | LPI:1579-1629 | CSS:2715-2728, 2805-2875 |
| ├ Painel Sequência de brincos | `<SequenciaBrincos>` (sempre montado; `hidden` quando invisível) | LPI:1631; SEQ:161 | — |
| ├ Painel Dados de Compra | `.d17d-detail-panel` | LPI:1632-1700 | CSS:945-948 (grade 4 colunas) |
| ├ Painel Dados da Venda | `.d17d-detail-panel` | LPI:1703-1819 | idem |
| ├ Painel Documentação / Abate | `.d17d-detail-panel` | LPI:1822-1966 | idem |
| └ Linha de apartação | `.d17d-apartation-fields` (+ `--documented-exit` em Venda/Abate) | LPI:1969-2055 | CSS:973-976, 3930-3940, 2681-2715 |
| Área de trabalho | `.mak-mother-page__view-stack.d17d-launch-workspace` (`data-mak-region="view-stack"`) | LPI:2062-2312 | grade `3fr / minmax(300px,1fr)` (CSS:984); coluna lateral ocupa linhas 1–2 (CSS:1988-1992) |
| ├ Tabela do dia | `.d17d-launch-table-column` → Card + `PesagensResumoRodape` | LPI:2064-2278 | CSS:1784-1812 |
| └ **Coluna lateral de resumo** | `ResumoPersonalizado` / `ResumoEmbarque` / `ResumoVendaDia` / `ResumoLotes` conforme `painelResumoTipo` | **LPI:2281-2311** | `.d17d-summary-column` (CSS:994, 1816-1820) |
| Diálogos | exclusão, conferência de peso, apartações, colunas, embarques, resumos, seletor de animal, SN | LPI:2314-2415 | — |

---

## 3. Estados do formulário

### 3.1 Contexto da sequência (estados que hoje se comportam como contexto)

"Por tipo" = gravado em `configuracoesPorTipoRef` (LPI:398-401) e restaurado em `aplicarConfiguracaoTipo` (LPI:402-406).

| Estado | Decl. | Onde aparece | Após salvar (LPI:1074-1083) | Troca de modo (LPI:407-413) | `handleEditar` (LPI:1111-1163) | Cancelar edição (LPI:1553-1568) |
|---|---|---|---|---|---|---|
| `dataPesagem` | LPI:109 (hoje) | todos, LPI:1443 | preservado | preservado (não é por tipo) | não muda (só `?editar=` em LPI:519) | preservado |
| `tipoManejo` | LPI:136 (`'Manejo'`) | LPI:1295 | preservado | trocado | `p.tipo_manejo` (LPI:1130) | fica o tipo do registro editado |
| `motivoSaida` | LPI:137 | Saída, LPI:1319 | preservado | por tipo | `p.motivo_saida` (LPI:1131) | **zerado** (LPI:1560) |
| `causaMorte` | LPI:138 | Saída/Morte, LPI:1336 | **preservado** | por tipo | `p.causa_morte` (LPI:1132) | **zerado** (LPI:1561) |
| `sexo` | LPI:118 (`'M'`) | Cadastro, LPI:1445 | preservado | por tipo | `p.sexo` (LPI:1119) | `'M'` (LPI:1563) |
| `raca` / `racaId` | LPI:120-121 | Cadastro, LPI:1467 | preservado | por tipo | `p.raca`/id por nome (LPI:1123-1124) | padrão da empresa (LPI:1565 → 291) |
| `marca` / `marcaId` | LPI:122-123 | Cadastro, LPI:1476 | preservado | por tipo | `p.marca`/id por nome (LPI:1126-1127) | padrão da empresa (LPI:1565 → 290) |
| `categoriaSelecao` | LPI:126 (`__auto__`) | Cadastro, LPI:1458 | Cadastro: **volta a Automático** (LPI:1077); demais: preservado | por tipo | Automático (LPI:1128) + restauração do registro v7 (LPI:349-357) | Automático (LPI:294) |
| `era` (legado) | LPI:125 | não exibida | Cadastro: `''` (LPI:1077) | por tipo | `p.era` (LPI:1125) | `''` (LPI:294) |
| `apartacaoSelecionada` | LPI:133 | LPI:1972 | preservado | **por tipo** | só se `p.apartacao_id` (LPI:1133) | apartação padrão, se houver (LPI:1566) |
| `loteTransferencia` | LPI:134 | LPI:1984 | **preservado** | por tipo | só se `p.lote_id` (LPI:1134) | `''` (LPI:1559) |
| `mostrarSequenciaBrinco` | LPI:144 | LPI:1376 | preservado | por tipo | — | — |
| `mostrarDadosCompra` | LPI:143 | LPI:1379 | preservado | por tipo | — | — |
| `mostrarDadosVenda` | LPI:154 | LPI:1351 | preservado | por tipo | — | — |
| `mostrarDadosAbate` | LPI:167 | LPI:1364 | preservado | por tipo | — | — |
| `valorPagoCabeca` | LPI:145 | compra, LPI:1644 (só `commercial.values`) | preservado | por tipo | LPI:1137 | preservado |
| `origemAnimal` | LPI:146 | compra, LPI:1653 | preservado | por tipo | LPI:1138 | preservado |
| `numeroGTA`, `numeroNFeCompra`, `valorFreteCompra`, `observacoesCompra` | LPI:148-151 | compra, LPI:1663-1695 | preservado | por tipo | JSON `documentacao` (LPI:1139-1144) | preservado |
| `comprador` | LPI:155 | venda, LPI:1729 | preservado | por tipo | LPI:1147 | preservado |
| `destinoVenda` | LPI:162 | venda, LPI:1740 | preservado | por tipo | LPI:1148 | preservado |
| `valorArroba` | LPI:157 | venda, LPI:1750 | preservado | por tipo | LPI:1150 | preservado |
| `valorVendaTotal` | LPI:156 | venda, LPI:1760 | **preservado** | por tipo | LPI:1149 | preservado |
| `rendimentoCarcacaVenda` / `rendimentoOrigemVenda` | LPI:160-161 | venda, LPI:1769 | preservado | por tipo | LPI:1153-1155 | padrão da empresa (LPI:292) |
| `numeroGTAVenda`, `numeroNFeVenda`, `valorFreteVenda`, `observacoesVenda` | LPI:163-166 | venda LPI:1781-1815; **NF-e e Frete também no painel Abate** LPI:1939, 1949 | preservado | por tipo | **não restaurados** | preservado — **nunca gravados** (B-01) |
| `frigorifico` | LPI:168 | abate, LPI:1885 | preservado | por tipo | LPI:1156 | preservado |
| `valorArrobaAbate` | LPI:169 | abate, LPI:1898 | preservado | por tipo | LPI:1157 | preservado |
| `valorTotalAbate` | LPI:172 | abate, LPI:1908 | **preservado** | por tipo | LPI:1158 | preservado |
| `rendimentoCarcacaAbate` / `rendimentoOrigemAbate` | LPI:170-171 | abate, LPI:1916 | preservado | por tipo | LPI:1159 | padrão da empresa (LPI:293) |
| `numeroGTAAbate`, `observacoesAbate` | LPI:173-174 | abate, LPI:1930, 1958 | preservado | por tipo | **não restaurados** | preservado — **nunca gravados** (B-01) |
| `embarqueSelecionadoDoc` | LPI:178 | LPI:1832 **e** LPI:2017 (dois seletores, mesmo estado) | preservado | por tipo | LPI:1160 | preservado |
| `documentoSelecionado` | LPI:179 | LPI:1841 **e** LPI:2030 | preservado | por tipo | LPI:1161 | preservado |
| `documentacao` | LPI:147 | nenhum | `''` (LPI:1080) | — | — | — (estado morto, D-03) |
| Estado interno da sequência (`usarSequencia`, `brincoInicial`, `brincoFinal`, `direcao`, `pulados`, `ativoInterno`, `sequenciaRef`, `numerosUsadosRef`) | SEQ:25-33 | SEQ:161-242 | cursor avança (LPI:1078; SEQ:123-148) | preservado (componente sempre montado, LPI:1631) | — | — |

### 3.2 Dados do animal (evento corrente)

| Estado | Decl. | Após salvar | Troca de modo | `handleEditar` | Cancelar |
|---|---|---|---|---|---|
| `editingId` | LPI:108 | `null` (LPI:1074) | `null` (LPI:412) | `p.id` (LPI:1112) | `null` (LPI:1554) |
| `numeroAnimal` | LPI:110 | `''` ou próximo da sequência (LPI:1078) | `''` (LPI:412) | LPI:1113 | `''` (LPI:1555) |
| `animalIdSelecionado` | LPI:111 | `''` (LPI:1074) | `''` (LPI:412) | LPI:1117 | `''` (LPI:1556) |
| `animalRegistro` (registro `animais` v7) | LPI:129; efeito LPI:339-344 | `null` via efeito (LPI:341) | idem | recarregado | idem |
| `peso` | LPI:117 | `''` (LPI:1074) | `''` (LPI:412) | LPI:1118 | `''` (LPI:1557) |
| `observacao` | LPI:132 | `''` (LPI:1079) | `''` (LPI:412) | LPI:1129 | `''` (LPI:1558) |
| `avisoTela` | LPI:181 | `null` (LPI:1081) | `null` (LPI:412) | — | `null` (LPI:1562) |
| `opcoesAnimal`, `seletorAnimalOpen` | LPI:112-113 | — | — | — | — |
| `snDialogOpen`, `snDialogInitialValue`, `snDialogInherited` | LPI:114-116 | — (fecha em LPI:2412) | — | — | — |
| `outlierDialog`, `outlierJustification` | LPI:197-198 | — (justificativa zera ao abrir, LPI:890) | — | — | — |
| `isSaving` | LPI:135 | `false` (LPI:1087) | — | — | — |

**Problema estrutural:** `sexo`, `raca/racaId`, `marca/marcaId`, `era` e `categoriaSelecao` são ao mesmo tempo **contexto do Cadastro** e **perfil do animal** em Manejo/Saída (`aplicarAnimalSelecionado` escreve neles, LPI:277-282). Não há separação de estados.

### 3.3 Estados de apoio (não pertencem ao formulário)

`dbReady` LPI:94 (nunca muda), `pesagens` LPI:102, `apartacoes` LPI:103, `lotesApartacao` LPI:104, `isLoading` LPI:105, `catalogos` LPI:127, `politicas` LPI:128, `auxiliaryCatalogs` LPI:139, `embarques` LPI:176, `documentosEmbarque` LPI:177, `dialogEmbarqueOpen` LPI:180, `colunaMenuAberto` LPI:184, `filtrosColuna` LPI:185, `sortColumn`/`sortDirection` LPI:186-187, `launchPage` LPI:188, `showApartacoesDialog` LPI:192, `showConfigColunas` LPI:193, `showResumoConfig` LPI:194, `resumoPersonalizado` LPI:195, `deleteLaunchRequest` LPI:196, `painelResumoTipo` LPI:201, `colunasOrdem` LPI:457, `colunasVisiveis` LPI:469.

### 3.4 Refs

| Ref | Linha | Uso |
|---|---|---|
| `numeroInputRef` | LPI:97 | foco no Nº (LPI:806, 1083, 1162, 1476, 1567) |
| `pesoInputRef` | LPI:98 | foco no Peso (LPI:284, 813, 1083, 1503, 1631) |
| `ignorarProximoBlurIdentificacaoRef` | LPI:99 | evita resolver duas vezes (Enter + blur) (LPI:1497-1503) |
| `padroesEmpresaRef` | LPI:130 | padrões da empresa (LPI:318) |
| `apartacaoPadraoAplicadaRef` | LPI:131 | aplica apartação padrão uma vez (LPI:331-336) |
| `registroRestauradoRef` | LPI:348 | restauração da categoria na edição de Cadastro (LPI:349-357) |
| `configuracoesPorTipoRef` | LPI:398 | **único "contexto" existente**, em memória, por tipo |
| `sequenciaRef`, `numerosUsadosRef` | SEQ:32-33 | cursor da sequência |
| `window.__sequenciaBrincos` (global) | SEQ:120-157 | ponte entre `SequenciaBrincos` e `handleSalvar` |

### 3.5 Derivados relevantes (useMemo)

`animaisCadastrados` = `getRegisteredAnimals(pesagens)` (LPI:203; AHIST:22-91 — só registros **Cadastro** viram animal), `animalLookupIndex` (LPI:204; AHIST:93-109), `animalSelecionado` (LPI:205-208), `historicoAnimalSelecionado` (LPI:209-212), `ultimoPerfilSn` (LPI:213), `ganhoVisual`/`sparklinePeso` (LPI:226-229; WPREV:6-30), `avisosPesoVisual` (LPI:232-235), `categoriasDoSexo` (LPI:246), `categoriaAutomatica` (LPI:247-250), `categoriaEfetiva` (LPI:251-253), `pesagensDia` (LPI:577-643), `numerosUsados` (LPI:682), `lotesApartacaoAtual` (LPI:683), `estatisticas` (LPI:686-692), `ultimoLancamentoDia` (LPI:693-697), `resumoDoc`/`resumoEmbarque` (LPI:700-726), `resumoDocsAbate` (LPI:738-753), `totaisDocsAbate` (LPI:755-764, não usado).

---

## 4. Modos e campos

### 4.1 Tipos e subtipos existentes

- Tipos: `Cadastro (Novo Animal)`, `Manejo (Pesagem Periódica)`, `Saída (Venda/Morte/Doação)` (LPI:1300-1302). Tipo inicial: `Manejo` (LPI:136).
- Motivos de saída: `Venda`, `Morte`, `Doação`, `Abate`, `Transferência`, `Outros` (LPI:1324-1329). Não existe motivo "Descarte", "Furto/Perda" ou "Consumo".
- Situação v7 derivada do motivo: VENDA→VENDIDO, ABATE→ABATIDO, MORTE→MORTO, DOACAO→DOADO, TRANSFERENCIA→TRANSFERIDO, outro→INATIVO (`src/storage/indexedDb/normalize.js:19-38`; usado em WADP:247).

### 4.2 Matriz de visibilidade

| Controle | Linha | Cadastro | Manejo | Saída: Venda | Saída: Abate | Saída: Morte | Doação / Transferência / Outros |
|---|---|---|---|---|---|---|---|
| Tipo de movimentação | 1295 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gerenciar Apartações (ícone) | 1306 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Motivo da Saída * | 1318 | — | — | ✓ | ✓ | ✓ | ✓ |
| Causa da Morte * (cadastro `causasMorte`) | 1335 | — | — | — | — | ✓ | — |
| Botão "Dados da venda" | 1347 | — | — | ✓ | — | — | — |
| Botão "Dados do abate" | 1360 | — | — | — | ✓ | — | — |
| Botão "Documentação" (GerenciarEmbarquesDialog) | 1371 | — | — | ✓ | ✓ | — | — |
| Sequência de brincos (Tag) / Dados de compra (olho) | 1376-1381 | ✓ | — | — | — | — | — |
| Data * | 1443 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sexo *, Categoria, Raça, Marca * | 1445-1483 | ✓ | — | — | — | — | — |
| Nº Ident./Nome * | 1485 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Peso (kg) * (+ botão balança) | 1508 | obrigatório | obrigatório | obrigatório | obrigatório | opcional | Doação/Transferência opcional; **Outros obrigatório** (LPI:810) |
| Observação | 1534 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Salvar (Enter) / Cancelar (só edição) | 1545-1573 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Faixa de avisos | 1580 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Faixa Animal · Última · Ganho · tendência · aviso | 1596 | — | com animal | com animal | com animal | com animal | com animal |
| Painel Sequência de brincos | 1631 | com toggle | — | — | — | — | — |
| Painel Dados de Compra (valor/cabeça só `commercial.values`, vendedor, GTA, NF-e, frete, obs.) | 1632-1700 | com toggle | — | — | — | — | — |
| Painel Dados da Venda (comprador, destino, [valor @, total, rendimento, estimativa], GTA, NF-e, frete, obs., "Limpar dados da venda") | 1703-1819 | — | — | com toggle | — | — | — |
| Painel Documentação/Abate (embarque, documento, tabela de docs, frigorífico, [valor @, total, rendimento, estimativa], GTA, NF-e*, frete*, obs.) | 1822-1966 | — | — | — | com toggle | — | — |
| Apartação / Transferência de Lote / Lote destino | 1970-2013 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Embarque / Documento (GTA/NF-e) | 2014-2039 | — | — | ✓ | ✓ | — | — |
| "Último … Desfazer" | 2041-2046 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Texto de status | 2047-2053 | "Cadastro de novos animais (Ativo)" | "Apenas animais já cadastrados (Ativo)" | "Animal será marcado como INATIVO" | idem | idem | idem |

`*` no painel Abate: NF-e e Frete estão ligados aos estados **da Venda** (`numeroNFeVenda`, `valorFreteVenda`, LPI:1939, 1949).
Doação e Transferência **não** têm destinatário/destino próprios; `destino_venda` só é gravado em Venda (LPI:1028).

### 4.3 Matriz do payload gravado (LPI:989-1053)

| Campo | Cadastro | Manejo | Saída | Linha |
|---|---|---|---|---|
| `empresa_id`, `tipo_manejo`, `data_pesagem`, `animal_id`, `numero_animal`, `sexo`, `raca`, `era`, `marca`, `marca_id`, `raca_id`, `categoria_id`, `categoria_automatica`, `peso`, `observacao`, `alertas_confirmados`, `justificativa_alerta`, `apartacao_id`, `nome_apartacao`, `lote_id`, `nome_lote` | ✓ | ✓ | ✓ | 990-1016 |
| `status_animal` (`Inativo` na Saída) | enviado | enviado | enviado | 994 — **descartado** pelo mapper (proibido, WMAP:23-25) e derivado no view model (WMAP:146) |
| `motivo_saida` | null | null | ✓ | 992 |
| `causa_morte` (texto) | null | null | só Morte | 993 |
| `valor_pago_cabeca`, `origem_animal`, `documentacao` (JSON `{gta,nfe,frete,obs}`) | ✓ | null | null | 1018-1025 |
| `comprador`, `destino_venda`, `valor_venda_total`, `valor_arroba` | null | null | só Venda | 1027-1030 |
| `rendimento_carcaca`, `rendimento_origem`, `peso_carcaca_estimado`, `quantidade_arrobas` | null | null | Venda/Abate com peso | 1031-1034 |
| `frigorifico`, `valor_arroba_abate`, `valor_total_abate` | null | null | só Abate | 1036-1038 |
| `embarque_id`, `embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` | null | null | **qualquer motivo** (V-04) | 1040-1046 |
| `data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | null | ✓ (recalculado no serviço) | null | 1048-1052; WSVC:63-77 |
| Não enviados pela tela | `sessao_id`, `operador`, `origem`, `id_externo`, `causa_morte_id`, `nome_animal` | | | permitidos na allowlist (WMAP:6-19) |

---

## 5. Abertura da tela e padrões

1. `ensureEmpresaId()` (LPI:86); `?editar=` lido do hash (LPI:90-92).
2. Carga paralela de políticas + marcas/raças/categorias (LPI:297-327): `loadOperationalPolicies` (POL:82-96), `brandService/breedService/categoryService.list`. Monta `padroes` (marca/raça padrão via `resolveDefaultRegistry` POL:102-109, `apartacao_padrao_id`, `rendimento_padrao` formatado POL:120-123), grava em `padroesEmpresaRef` (LPI:318), **reinicializa `configuracoesPorTipoRef` dos três tipos** (LPI:319) e, sem `?editar=`, aplica os padrões ao formulário (LPI:321; `aplicarPadroesEmpresa` LPI:289-295).
3. Apartação padrão aplicada uma única vez quando apartações e políticas chegam (LPI:331-336).
4. `getSetting('resumo-personalizado:<empresa>')` (LPI:382-384); `loadAuxiliaryCatalogs` → compradores, vendedores, frigoríficos, causas de morte (LPI:386-390; `src/modules/auxiliary/application/legacyCatalogBridge.js:33-63`).
5. `loadAllData` (LPI:529-554): **todas** as pesagens da empresa (`weighingService.listEntries`, WSVC:237-250), apartações, lotes, embarques, documentos.
6. `?editar=`: quando `pesagens` carrega, chama `handleEditar` + `setDataPesagem` e limpa a URL (LPI:510-527).

---

## 6. Identificação do animal

- **Digitação** (LPI:1490-1495): normaliza para maiúsculas (`normalizeAnimalIdentifier`, SN:3-4); fora do Cadastro zera `animalIdSelecionado`; limpa `avisoTela`.
- **Enter** no Nº (LPI:1503): marca `ignorarProximoBlur…`, chama `resolverAnimalDigitado`; se `true`, foco no Peso.
- **Blur** no Nº (LPI:1496-1502): resolve, salvo quando o blur veio do Enter.
- `resolverAnimalDigitado` (LPI:365-380):
  - Cadastro ou SN → `true` sem busca (LPI:366).
  - Busca no índice `byNumber` dos animais **cadastrados** (LPI:367; AHIST:93-109).
  - 1 resultado → `aplicarAnimalSelecionado` (LPI:368).
  - >1 → abre `SelecionarAnimalDialog` + `toast.warning` (LPI:369-375; SELDLG:8-39).
  - 0 → `toast.error("Animal … não cadastrado…")` e `animalIdSelecionado=''` (LPI:376-379).
- `aplicarAnimalSelecionado` (LPI:273-286): grava `animalIdSelecionado`, `numeroAnimal`, **`sexo`, `raca/racaId`, `era`, `marca/marcaId`** do animal; `avisoTela = criarMensagemAnimal(...)` (LOOK:12-24: tipo `erro` se inativo, `info` se ativo — `info` **não é renderizado**, LPI:1580); foco no Peso.
- **SN** (`isSnIdentifier`, SN:1 — `SN`, `SN 12`…): em qualquer modo, ao salvar abre `ConfirmarAnimalSnDialog` com o perfil do último SN (`findLatestSnProfile`, SN:6-28) ou o perfil corrente do formulário (LPI:838-848). O diálogo exige sexo, **marca e raça** (SNDLG:41-64) e, ao confirmar, a tela **grava o perfil do SN nos estados do formulário** (LPI:2406-2411) e chama `handleSalvar({ skipSnConfirmation: true, snProfile })` (LPI:2413). Cada SN recebe `animal_id` novo (LPI:956).

---

## 7. Validações antes de salvar

### 7.1 Na tela — ordem exata de `handleSalvar`

| # | Regra | Linha | Efeito |
|---|---|---|---|
| 0 | `isSaving` → ignora (clique duplo) | LPI:793 | return |
| 1 | Data civil válida | LPI:796-799 | toast |
| 2 | Data não futura | LPI:800-803 | toast |
| 3 | Nº obrigatório | LPI:804-808 | toast + foco Nº |
| 4 | Peso > 0, exceto Saída Morte/Doação/Transferência | LPI:809-815 | toast + foco Peso |
| 5 | Saída exige motivo | LPI:816-819 | toast |
| 6 | Morte exige causa | LPI:820-823 | toast |
| 7 | `exitRequiresDocument` (Abate sempre; Venda se `exigir_documento_venda`) exige embarque **e** documento | LPI:826-833; `src/modules/operations/domain/closingPendencies.js:9-14` | toast |
| 8 | SN sem confirmação → abre diálogo SN | LPI:838-848 | return |
| 9 | Cadastro (não SN) exige `marcaId` | LPI:849-852 | toast |
| 10 | Manejo/Saída (não SN) exige `animalIdSelecionado` (reabre resolução) | LPI:853-857 | toast (duplo, ver B-17) |
| 11 | Duplicidade no dia (número + marca), exceto edição e SN | LPI:868-875 | toast |
| 12 | Animal inativo (último registro por data com `status_animal === 'Inativo'`), Manejo/Saída, não edição | LPI:877-882 | toast |
| 13 | Cadastro duplicado (número + marca já tem histórico), não edição | LPI:883-887 | toast |
| 14 | Avisos de conferência (faixa de peso, variação %, GMD) → diálogo com justificativa obrigatória | LPI:888-893; WWARN:38-57; diálogo LPI:2326-2341 | return; reentra com `skipOutlierConfirmation` |
| 15 | Venda/Abate: rendimento em (0, 100] | LPI:894-901 | toast |

### 7.2 No serviço e no adaptador (valem também para importação)

| Regra | Linha |
|---|---|
| Permissão `weighing.write` (criar) / `weighing.edit` (editar/excluir); sem sessão com provedor ativo → recusa | WSVC:16-24, 54, 200, 219 |
| Remove `valor_pago_cabeca`, `valor_venda_total`, `valor_arroba`, `valor_arroba_abate`, `valor_total_abate` sem `commercial.write` | WSVC:26-35 |
| Data obrigatória/válida/não futura; peso > 0 salvo Saída Morte/Doação/Transferência | WMAP:51-79 |
| Cadastro duplicado **para o mesmo `animal_id`** | WADP:172-174 |
| Evento anterior à data do Cadastro | WADP:175-177 |
| Saída com eventos posteriores (retroativa) | WADP:178-183 |
| Qualquer evento na data da saída ou depois | WADP:184-190 |
| `id` duplicado | WADP:330 |

**Não existem no serviço:** duplicidade no mesmo dia, Cadastro duplicado por número + marca (a tela gera `animal_id` novo), animal inativo com evento **antes** da saída, bloqueio de dia/sessão fechada. Essas regras só existem na tela (B-22).

---

## 8. Construção do payload em `handleSalvar`

1. `isSN`, `numeroDigitado` (maiúsculas), `numeroNorm` (LPI:835-837).
2. `cadastroSelecionado`: no Cadastro, o registro em edição; nos demais, `animalSelecionado` (LPI:859-861). `registrosMesmaIdentidade` = histórico por `animal_id` ou por número+marca (LPI:862-866).
3. `setIsSaving(true)` (LPI:903).
4. Ganho de **pré-visualização** com `calculateWeightGain` (LPI:908-916) — o serviço recalcula e sobrescreve (WSVC:63-77).
5. Lote/apartação (LPI:919-943) — detalhado na seção 17.
6. Cálculo comercial `calculateCarcassTrade` só em Venda/Abate com peso (LPI:947-951; COMM:44-58).
7. Documento e embarque selecionados (LPI:953-954).
8. `animalIdAtual` (LPI:955-958): SN → id do registro em edição ou **novo**; Cadastro → id do registro em edição ou novo; Manejo/Saída → `animalIdSelecionado`.
9. Perfil do animal (LPI:964-983): SN usa `snProfile`; Cadastro usa o formulário e a categoria efetiva; Manejo/Saída usa `animalSelecionado` + `animalRegistro` (ids, categoria, era).
10. Origem do rendimento (LPI:985-987).
11. Objeto `data` (LPI:989-1053).

---

## 9. O que acontece EXATAMENTE após salvar

### 9.1 Sequência de execução (sucesso)

| Passo | Linha | Ação |
|---|---|---|
| 1 | LPI:1056-1059 | Novo: `await weighingService.createEntry(data)` → `toast.success('✓ Salvo!')` → `await refreshAnimalSeries(savedEntry.animal_id)` (recarrega **só** a série desse animal em `pesagens`, LPI:556-574) |
| 1′ | LPI:1060-1072 | Edição: `await weighingService.updateEntry(editingId, data)`; se o original é Cadastro, `propagateAnimalProfile` (só consolida `animal_id` em legados sem id, AHSVC:4-14); `toast.success('✓ Atualizado!')`; `refreshAnimalSeries(idAntigo, idNovo)` |
| 2 | LPI:1074 | `setEditingId(null); setAnimalIdSelecionado(""); setPeso("")` |
| 3 | LPI:1077 | Só Cadastro: `setCategoriaSelecao(CATEGORIA_AUTOMATICA); setEra('')` |
| 4 | LPI:1078 | Cadastro com `window.__sequenciaBrincos`: monta `usadosAtualizados = numerosUsados + numeroAnimal.trim()` e chama `avancar` (SEQ:123-148). `ok=false` → `toast.info('✅ Sequência finalizada!')` + `setNumeroAnimal("")`; `ok=true` → a própria sequência chama `setNumeroAnimal(próximo)` e agenda foco no Peso (SEQ:145-146); `pulos>0` → `toast.info('⏭️ N pulado(s)')`. Sem sequência (ou fora do Cadastro): `setNumeroAnimal("")` |
| 5 | LPI:1079 | `setObservacao("")` |
| 6 | LPI:1080 | `setDocumentacao("")` (estado morto) |
| 7 | LPI:1081 | `setAvisoTela(null)` |
| 8 | LPI:1082 | `salvarConfiguracaoTipoAtual()` — grava o **fechamento (closure) antigo** dos ~40 estados de contexto em `configuracoesPorTipoRef[tipoManejo]` (V-01) |
| 9 | LPI:1083 | Foco: Cadastro com `window.__sequenciaBrincos` → `setTimeout(() => peso.focus(), 100)`; caso contrário `numeroInputRef.focus()` imediato |
| 10 | LPI:1087 | `finally`: `setIsSaving(false)` |

Erro (LPI:1084-1086): `toast.error('Erro: ' + message)`; nenhum estado é limpo (o formulário fica intacto para correção).

Efeitos derivados: `animalIdSelecionado=''` dispara `setAnimalRegistro(null)` (LPI:341) → `animalSelecionado=null` → a faixa de desempenho some (LPI:1596).

### 9.2 Zerado x preservado (resumo)

- **Zerados:** `editingId`, `animalIdSelecionado` (→ `animalRegistro`), `peso`, `numeroAnimal` (ou avançado), `observacao`, `avisoTela`, `documentacao`; no Cadastro também `categoriaSelecao` (→ Automático) e `era`.
- **Preservados:** `dataPesagem`, `tipoManejo`, `motivoSaida`, `causaMorte`, `sexo`, `raca/racaId`, `marca/marcaId`, `apartacaoSelecionada`, `loteTransferencia`, todos os campos de compra, venda (inclusive `valorVendaTotal`), abate (inclusive `valorTotalAbate`), `embarqueSelecionadoDoc`, `documentoSelecionado`, toggles `mostrar*`, estado da sequência, filtros/ordem/página da grade, `painelResumoTipo`.
- **Onde o foco vai:** Nº (padrão) ou Peso (Cadastro com sequência ativa) — inclusive quando a sequência acabou de terminar e o Nº foi limpo (B-10).

Conclusão para a missão (2): a tela **já preserva quase todo o contexto após salvar**, mas (a) preserva também dados que são do animal (V-02, V-03, V-08), (b) o contexto só existe em memória e é fragmentado por tipo (R-02, R-03), (c) edição e SN contaminam o contexto (V-05, V-06, V-07), (d) a categoria manual é tratada como dado do animal (R-05).

---

## 10. Caminho de gravação detalhado

### 10.1 `weighingService.createEntry` (WSVC:53-103)
1. Permissão + remoção de valores comerciais (WSVC:54).
2. `validateUiPayload` (WSVC:55).
3. `existingSeries = listAllEntries({ animalId })` (WSVC:59-62) — índice `animal_id` (repositório `src/storage/indexedDb/repositories/index.js:49-79`).
4. Manejo → `calculateWeightGain({ history: existingSeries, date, weight })` (WSVC:63-69); outros tipos → nulos.
5. `uiToStorageRecord` (WSVC:78; WMAP:81-113): colunas `data_pesagem`, `peso_kg`, `lote_id`, `animal_id`, `tipo_pesagem`, `observacao` + `legacy_payload` filtrado pela allowlist.
6. `weighingDataAdapter.createEntry` (WSVC:79).
7. Se existe evento com data posterior → `recalculateWeightSeriesForKeys` do animal (WSVC:81-88) → `recalculateWeightSeries` (WSER:10-46) → `bulkUpdateEntries` com `systemDerived` (WADP:668-709).
8. Retorna o view model (WSVC:90; WMAP:115-150).

### 10.2 `weighingDataAdapter.createEntry` (WADP:297-391)
- `animalId = payload.animal_id || ui.animal_id || (Cadastro ? uuid : null)` (WADP:303).
- `validateAnimalChronology` fora da transação (WADP:309).
- Transação `rw` em `pesagens, auditoria, sessoesPesagem, animalLotes, categoriasAnimal` (+ `animais, movimentosAnimais` com animal; + `animalIdentificadores, marcas, racas, propriedades` no Cadastro) (WADP:311-317).
- **Sessão**: sem `ui.sessao_id`, procura sessão **aberta** da data; se não houver, cria `newSession` `ABERTA`, `operador: ui.operador || 'LOCAL'`, `marca_padrao_id/apartacao_padrao_id/tipo_manejo_padrao/snapshot = null` (WADP:318-329, 96-114).
- **Categoria**: `stampAutomaticCategory` — Cadastro automático pelo peso; Manejo/Saída só se o animal v7 é automático; sem peso/faixa herda a última categoria (WADP:197-207, 331-334).
- `pesagens.add` (WADP:335).
- **Cadastro**: se não existe `animais` com esse id, resolve `marca_id`/`raca_id` (id da tela se ativo; senão **cria** marca/raça pelo nome — WADP:38-63, 339-340), propriedade padrão, cria `animais` (WADP:116-142) e identificador `VISUAL` (WADP:144-163, 342-343).
- **Lotes/movimentos** (WADP:346-371): Saída fecha a permanência aberta; lote diferente do atual fecha e abre `animalLotes`; movimento `Entrada` (Cadastro), motivo (Saída) ou `Mudança de lote`.
- Retroativo → `rebuildAnimalLotProjection` (WADP:372-378, 260-286).
- Auditoria `CRIAR` com ator (WADP:379-387, 73-75).
- `rebuildAnimalStateProjection` (WADP:215-258): situação, data/motivo de saída, último peso válido, categoria/era automáticas, lote/apartação atuais.

### 10.3 Edição (`updateEntry`)
WSVC:199-216 mescla o existente com o payload e recalcula a série de **ambas** as identidades; WADP:393-436 valida cronologia ignorando o próprio id, carimba categoria, atualiza `animais` quando é Cadastro (WADP:411-430), **sempre** reconstrói a projeção de lotes (WADP:431), audita `ATUALIZAR` com antes/depois (WADP:432) e reconstrói o estado (WADP:433). Não altera `sessao_id` nem `movimentosAnimais` (B-10).

### 10.4 Exclusão / "Desfazer"
`handleExcluir` só abre a confirmação (LPI:1092-1094; botão "Desfazer" LPI:2044). `confirmarExclusaoLancamento` → `deleteEntriesRespectingHistory` (AHSVC:16-24; bloqueia Cadastro com histórico, AHIST:121-141) → `bulkDeleteEntries` com recálculo (WSVC:137-142) → exclusão lógica + auditoria `CANCELAR` + projeções (WADP:753-775) → `loadAllData()` completo (LPI:1105). Não cancela `movimentosAnimais`, `animais` nem `animalIdentificadores` (B-21).

---

## 11. Troca de modo (`handleTipoManejoChange`, LPI:407-413)

1. Mesmo tipo → nada (LPI:408).
2. `salvarConfiguracaoTipoAtual()` guarda ~40 estados do tipo atual (LPI:399-401).
3. `setTipoManejo(novoTipo)`.
4. `aplicarConfiguracaoTipo(novoTipo)` restaura os estados do novo tipo, com fallback nos padrões da empresa (LPI:402-406).
5. Zera `editingId`, `numeroAnimal`, `animalIdSelecionado`, `peso`, `observacao`, `avisoTela` (LPI:412) — **descarta uma edição em curso sem aviso**.
6. Não mexe em `dataPesagem`, no estado interno da `SequenciaBrincos` nem no foco.
7. Troca de motivo de saída zera apenas a causa (LPI:1319).

---

## 12. Edição

- Origem: menu "Editar" da grade do dia (LPI:2122) ou `?editar=<id>` vindo da Relação (LPI:510-527; links em `src/pages/PesagensIndividuais.jsx:844, 1009`).
- `handleEditar` (LPI:1111-1163) restaura o registro inteiro **por cima do contexto**, sem salvar a configuração do tipo atual; não restaura GTA/NF-e/frete/observações de venda e abate (não são gravados); aplica apartação/lote só quando o registro os tem (LPI:1133-1134); foco no Nº (LPI:1162).
- Cadastro em edição: a categoria manual volta pelo efeito LPI:349-357.
- Botão "Cancelar" (só em edição, LPI:1550-1573): ver R-01.

---

## 13. Persistência de contexto existente

| Mecanismo | O que guarda | Linha |
|---|---|---|
| `configuracoesPorTipoRef` (useRef) | contexto por tipo, **só em memória**; perdido ao sair da rota (página lazy, `src/pages.config.js:7`) ou recarregar | LPI:398-406 |
| `localStorage` | só colunas da grade: `colunas_ordem_lancamento_pesagens`, `colunas_visiveis_lancamento_pesagens`, `colunas_modelo_lancamento_pesagens` (`d17d2r31`) | LPI:453, 457-499 |
| `appSettings` (`getSetting/setSetting`) | só `resumo-personalizado:<empresa>` | LPI:382-384, 392-396; `src/modules/settings/application/settingsService.js:3-11` |
| Configuração da empresa (`appConfigService` via POL) | marca/raça/apartação padrão, rendimento padrão, documento na venda, política de avisos | POL:82-96 |
| `sessoesPesagem` | tem `marca_padrao_id`, `apartacao_padrao_id`, `tipo_manejo_padrao`, `local`, `snapshot` — **sempre null** na criação | WADP:96-114 |
| `sessionStorage` | não usado | — |
| `window.__sequenciaBrincos` | cursor da sequência, global e volátil | SEQ:120-157 |
| `SAIDLG` (`perfis-saida:<empresa>`) | perfis de venda/abate — componente **não montado** | SAIDLG:19, 32 |

---

## 14. Sequência automática de identificadores

- Componente `SequenciaBrincos` sempre montado; visível só com `tipoManejo==='Cadastro' && mostrarSequenciaBrinco` (LPI:1631; SEQ:161).
- Entradas: checkbox "Brinco inicial" (`usarSequencia`), inicial, final, direção `crescente`/`decrescente` (SEQ:163-204).
- Formato aceito: `/^([A-Za-z]*)(\d+)$/` → prefixo + número com o mesmo número de dígitos (SEQ:11-22).
- `numerosUsados` = `numero_animal` de **todas** as pesagens com o mesmo **texto** de marca (sem id, sem normalização de caixa) (LPI:682).
- **Iniciar** (SEQ:81-118): procura o primeiro número livre a partir do inicial na direção escolhida, até o final (SEQ:39-66); guarda cursor em `sequenciaRef`; `setNumeroAnimal(formatado)`; foco no Peso. Sem final, o laço não tem limite (o segundo `while`, SEQ:54-63, é inalcançável). Valor fora do formato: "ativa" sem cursor (SEQ:84-92, ver V-12).
- **Avançar** (SEQ:123-148, chamado em LPI:1078 após cada Cadastro salvo): marca o número atual como usado, procura o próximo livre (±1), atualiza `pulados`, define o Nº e agenda foco no Peso; esgotado → desativa e devolve `ok:false`.
- **Reiniciar** (SEQ:217-227) só zera o cursor.
- Nada é persistido; não usa `faixasIdentificadores`/`excecoesIdentificadores` (stores existem em SCHEMA:78-79, sem serviço de estoque — `identifierInventoryService` não existe).

---

## 15. Categoria automática x manual (Cadastro)

- Seletor: "Automático" + categorias ativas do sexo, na ordem do cadastro (LPI:1458-1463; CAT:43-45).
- Rótulo mostra a sugestão "(Nome · era N)", "(sem faixa para este peso)" ou "(pelo peso)" (LPI:1449-1456).
- Sugestão: primeira categoria ativa do sexo cuja faixa de peso (inclusiva) contém o peso digitado (LPI:247-250; CAT:48-50).
- Trocar o sexo invalida categoria manual de outro sexo → Automático (LPI:360-363).
- Gravação (LPI:971): `categoria_id = categoriaEfetiva?.id`, `categoria_automatica = (seleção === Automático)`, `era = eraOfCategory(categoria) ?? era legado`.
- Adaptador recalcula e carimba a categoria das pesagens de animais automáticos (WADP:197-207) e a projeção do animal pelo último peso válido (WADP:232-243).
- Após salvar, Cadastro volta a Automático (LPI:1077).
- Manejo/Saída: categoria vem do registro v7 `animais` (LPI:981-982), carregado de forma assíncrona (LPI:339-344; B-07).
- SN: categoria escolhida no diálogo (SNDLG:89-98), resolvida em LPI:964-969.

---

## 16. Sessões de pesagem (`sessao_id`)

- A tela **nunca** envia `sessao_id` nem `operador`; não existe seletor ou indicador de sessão no Lançamento.
- O adaptador vincula à sessão aberta da data ou cria uma nova `ABERTA` com operador `LOCAL` (WADP:318-329).
- Fechamento do dia (`closeWeighingDay`, OIS:16-37) marca `FECHADA`; um lançamento posterior nessa data **cria outra sessão aberta** para o mesmo dia, sem bloqueio nem aviso (B-09). Reabrir: OIS:39-42.
- Importação cria sessões por data com operador `IMPORTACAO` (WADP:597-602).
- Relatórios exibem `sessao_label` (`src/modules/reporting/infrastructure/reportSources/eventRows.js:107`).

---

## 17. Apartação e lote

- Seleção: `apartacaoSelecionada` (LPI:1972, troca zera a transferência), `loteTransferencia` com opções "Automático" (`''`), "-- Sem Lote --" (`NENHUM`) ou um lote da apartação, com "[FECHADO]" quando cheio (LPI:1984-1998); diálogo "Usar" (LPI:2354-2355).
- Pré-visualização "Lote destino" (LPI:2000-2013).
- Regra ao salvar (LPI:919-943):
  - `NENHUM` → sem lote, apartação mantida.
  - Lote escolhido → lote + apartação; **se o lote não pertence à apartação atual, grava apartação e lote nulos**.
  - Automático com peso → `getLoteAutomatico` (LPI:779-786): primeiro lote cuja faixa contém o peso, não fechado e não cheio; **se nenhum lote serve, a apartação também não é gravada**.
- "Cheio" = `fechado` ou contagem de **todas as pesagens** com aquele `lote_id` ≥ `quantidade_maxima` (LPI:768-776) — conta eventos, não animais presentes.
- Persistência de permanência: `animalLotes` + `movimentosAnimais` no adaptador (WADP:346-371).
- Resumo lateral de lotes por dia/total (RLOTES:8-83).

---

## 18. Embarque e documento na saída

- Botão "Documentação" abre `GerenciarEmbarquesDialog`; "Usar no lançamento" aplica embarque + documento (LPI:1371, 2371-2381; `src/components/embarque/GerenciarEmbarquesDialog.jsx:282`).
- Seletores duplicados: painel Abate (LPI:1829-1855) e linha de apartação (LPI:2014-2039). Trocar o embarque zera o documento (LPI:1832, 2017).
- Obrigatoriedade: Abate sempre; Venda conforme política (LPI:826-833).
- Gravação: `embarque_id`, `embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero` (formatado GTA+NF-e), `motorista_nome`, `placa_carreta` para **qualquer Saída** (LPI:1040-1046).
- Rodapé em Abate mostra totais do documento/embarque (RODAPE:49-63); tabela do painel Abate (LPI:1856-1881).
- Os números de GTA/NF-e **digitados** nos painéis de venda e abate não são gravados (B-01); só o documento do embarque é.

---

## 19. Causa de morte

- Seletor só com Saída/Morte, obrigatório (LPI:1333-1344, 820-823), opções do cadastro `causasMorte` ativo (LPI:1340).
- Valor gravado = **nome** (`value={item.nome}`, LPI:1340; `causa_morte`, LPI:993). `causa_morte_id` é permitido (WMAP:18), mas nunca é enviado.
- `exigeObservacao` da causa é carregado (`legacyCatalogBridge.js:61`) e **ignorado** pela tela.
- Trocar o motivo zera a causa (LPI:1319); salvar **não** zera (V-03).
- Peso opcional em Morte (LPI:810).

---

## 20. Valores comerciais

- Visibilidade: `podeVerValores = auth.can('commercial.values')` (LPI:452); campos de valor em compra/venda/abate só aparecem com a permissão (LPI:1639, 1746, 1893); colunas comerciais filtradas (LPI:80, 504); resumo de venda e arrobas só com a permissão (LPI:2283, 2295, 2309).
- Gravação: o serviço remove valores digitados sem `commercial.write` (WSVC:26-35). OPERADOR não tem `commercial.write` (`src/modules/auth/domain/permissionService.js:28`).
- Cálculo canônico: carcaça = peso vivo × rendimento / 100; arrobas = carcaça / 15; valor estimado = arrobas × preço (COMM:7, 44-58). Pré-visualização em LPI:218-225, 1771-1778, 1918-1925.
- Rendimento: inicial = padrão da empresa (origem `PADRAO_EMPRESA`), ao digitar vira `INFORMADO` (LPI:158-161, 1769, 1916); gravado com a origem só quando válido (LPI:1031-1032).
- `valor_venda_total` / `valor_total_abate` são digitados por lançamento (não são calculados) e preservados após salvar (V-02).
- Exportar CSV do dia (LPI:1178-1272): colunas visíveis, `;`, BOM, números com vírgula, moeda formatada (`fmtCurrency`), datas dd/mm/aaaa — formato "amigável", não reimportável; exige `reports.export` (LPI:2267).

---

## 21. Teclado, leitor e balança

| Gesto | Efeito | Linha |
|---|---|---|
| Abertura da tela | `autoFocus` no Nº | LPI:1503 |
| Enter no Nº | resolve o animal; se ok, foco no Peso | LPI:1503 |
| Tab/blur no Nº | resolve o animal | LPI:1496-1502 |
| Enter no Peso | `handleSalvar()` | LPI:1516, 1166-1175 |
| Escolha de marca (Cadastro) | foco no Nº | LPI:1476 |
| Animal aplicado (único ou escolhido no seletor) | foco no Peso | LPI:284 |
| Após salvar | foco no Nº ou no Peso (sequência) | LPI:1083 |
| Leitor tipo teclado (código + Enter) | funciona pelo mesmo Enter do Nº | LPI:1503 |
| Botão de balança | só `toast.info('Integração com balança ainda não configurada.')` | LPI:1520-1529 |
| Topo do shell | "Balança não configurada" / "RFID não configurado" | `src/components/modelobase1/layout/ModeloBase1AppShell.jsx:91, 160-168` |
| Esc / clique fora | diálogos **não** fecham | `scripts/verify-ui-consistency.mjs` (asserções sobre `src/components/ui/dialog.jsx`) |

Não há atalhos globais (F-keys, Ctrl+S), nem Enter em Observação, nem integração serial/HID.

---

## 22. Bugs e problemas encontrados

### 22.1 Vazamento (dado do animal anterior que fica)

| ID | Problema | Evidência |
|---|---|---|
| **V-01** | `salvarConfiguracaoTipoAtual()` após salvar grava o **fechamento antigo**: `categoriaSelecao` manual e `era` do animal recém-salvo vão para a configuração do Cadastro, embora LPI:1077 tenha voltado para Automático. Trocar de tipo e voltar restaura a categoria do animal anterior. | LPI:1077 × 1082; 399-401; 405 |
| **V-02** | `valorVendaTotal` e `valorTotalAbate` (total **por registro**) não são zerados: o próximo animal é gravado com o mesmo total. | LPI:1074-1083 (ausentes); 1029, 1038 |
| **V-03** | `causaMorte` não é zerada após salvar: a validação passa sem reescolher e o próximo animal herda a causa. | LPI:1074-1083; 820-823; 993 |
| **V-04** | Embarque/documento escolhidos em Venda/Abate continuam no estado ao trocar o motivo para Morte/Doação/Transferência/Outros (só a causa é zerada) e são gravados nesses motivos, cujos seletores nem aparecem. | LPI:1319; 1040-1046; 2014, 2027 |
| **V-05** | `handleEditar` sobrescreve o contexto (tipo, motivo, causa, compra, comprador, frigorífico, valores, rendimentos, embarque, documento) sem salvar o contexto anterior; depois de Atualizar ou Cancelar, esses valores do registro editado ficam para os próximos lançamentos e ainda vão para a configuração do tipo. | LPI:1111-1163; 1082; 1553-1568 |
| **V-06** | Editar registro **sem** apartação/lote herda `apartacaoSelecionada`/`loteTransferencia` do contexto; ao Atualizar, grava apartação/lote que o registro não tinha (ou, com lote de outra apartação, anula a apartação). | LPI:1133-1134; 921-943 |
| **V-07** | Confirmar um SN grava sexo/raça/marca/categoria do SN nos estados do Cadastro: os Cadastros seguintes (não SN) herdam o perfil do SN. | LPI:2406-2411 |
| **V-08** | Em Manejo/Saída, `aplicarAnimalSelecionado` escreve sexo/raça/era/marca do animal nos estados de contexto; não são zerados e servem de fallback no payload (`animalSelecionado?.sexo \|\| sexo`), no perfil SN herdado quando não há SN anterior e na configuração por tipo. | LPI:277-282; 974; 843; 400 |
| **V-09** | `loteTransferencia` manual não é zerado: todos os animais seguintes vão para o mesmo lote, ignorando o lote automático por peso. (Pode ser contexto desejado — decisão pendente.) | LPI:1074-1083; 927-934 |
| **V-10** | Dados de venda/abate/compra continuam gravados com o painel oculto (`mostrar*` falso): o operador não vê o que está sendo gravado. | LPI:1703, 1822, 1632 × 1018-1038 |
| **V-11** | A sequência continua ativa com o painel escondido (a verificação pós-salvar olha só `window.__sequenciaBrincos`). | SEQ:161; LPI:1078, 1083 |
| **V-12** | Início fora do formato `prefixo+dígitos` deixa a sequência "ativa" sem cursor: a cada Cadastro salvo, `avancar` devolve `ok:false` sem desativar, mostra "Sequência finalizada!" e limpa o Nº. | SEQ:84-92, 125; LPI:1078 |

### 22.2 Reset indevido (contexto que é zerado)

| ID | Problema | Evidência |
|---|---|---|
| **R-01** | "Cancelar" a edição zera `motivoSaida` e `causaMorte`, volta sexo para "M" e marca/raça/rendimentos/categoria para os padrões da empresa: o contexto anterior à edição (já sobrescrito por `handleEditar`) não é restaurado; o tipo fica o do registro editado. | LPI:1553-1568; 289-295 |
| **R-02** | Trocar de modo descarta a edição sem aviso; a apartação/lote é **por tipo**: a apartação escolhida em Manejo não vale em Saída/Cadastro. | LPI:412; 400, 405 |
| **R-03** | O contexto vive só em `useRef`: sair da rota ou recarregar perde tipo, motivo, apartação, comprador, documento, sequência; a data volta para hoje e o tipo para Manejo. | LPI:398, 109, 136; `src/pages.config.js:7` |
| **R-04** | Corrida na abertura: quando os catálogos chegam, os três contextos por tipo são reinicializados e os padrões são reaplicados ao formulário, apagando o que o operador já tenha alterado. | LPI:319, 321 |
| **R-05** | Categoria manual volta para Automático a cada Cadastro: um lote inteiro da mesma categoria manual exige reescolher a cada animal. (Hoje é intencional: comentário em LPI:1075-1076 — decisão pendente.) | LPI:1077 |

### 22.3 Outros defeitos, perdas de dados e riscos

| ID | Problema | Evidência |
|---|---|---|
| **B-01** | **Perda silenciosa**: GTA, NF-e, frete e observações dos painéis de Venda e Abate são exibidos e editáveis, mas não entram no payload nem na allowlist. | LPI:1781-1815, 1927-1962 × 989-1053; WMAP:6-19 |
| **B-02** | Painel Abate liga NF-e e Frete aos estados da **Venda**. | LPI:1939, 1949 |
| **B-03** | Lote automático sem lote compatível descarta também a apartação; lote de transferência fora da apartação anula apartação e lote. | LPI:927-943 |
| **B-04** | Ocupação de lote conta todas as pesagens com `lote_id` (eventos repetidos, animais que já saíram), contra ADR-023 (ocupação por `animalLotes`). Lote com `peso_maximo` nulo nunca é escolhido automaticamente (`<= null`). | LPI:768-786; `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:156` |
| **B-05** | Mensagem "Exclusão concluída" usa `tipo: 'info'`, que a faixa não renderiza. | LPI:1101-1104 × 1580 |
| **B-06** | SN em Manejo/Saída gera `animal_id` novo sem Cadastro: o adaptador não cria `animais`, a projeção retorna null e o animal nunca aparece como cadastrado. | LPI:956; WADP:336-345, 217-218; AHIST:22-25 |
| **B-07** | Corrida em Manejo/Saída: `animalRegistro` é carregado de forma assíncrona; um Enter rápido grava `categoria_id: null` e `categoria_automatica: true` no payload de animal com categoria manual (o adaptador não corrige, pois retorna cedo). | LPI:339-344, 981-982; WADP:199 |
| **B-08** | Sequência: prefixo com minúsculas não bate com `numerosUsados` (texto cru) nem com o número gravado em maiúsculas; decrescente sem final pode gerar 0 ou negativos; `setNumeroAnimal` da sequência não normaliza. | SEQ:13, 20, 39-52, 145; LPI:682, 836 |
| **B-09** | Dia fechado não bloqueia o lançamento: o adaptador cria outra sessão `ABERTA` na mesma data; operador sempre `LOCAL`. | WADP:318-329; OIS:16-37 |
| **B-10** | Edição que muda a data mantém o `sessao_id` antigo; edição não atualiza `movimentosAnimais` (tipo/motivo/lote antigos). Após sequência esgotada, o foco vai para o Peso com o Nº vazio. | WADP:393-436; LPI:1083 |
| **B-11** | Função canônica aceita peso nulo como 0: `Number(null)` é finito em `calculateWeightGain`, e `recalculateWeightSeries` empurra eventos sem peso para o histórico. Hoje é inalcançável (saída é terminal), mas é latente para importação e para qualquer evento sem peso gravado em `pesagens`. | WCALC:21; WSER:42; WMAP:90 |
| **B-12** | `findLatestSnProfile` usa raça fixa `'Nelore'` como padrão, contra ADR-025 (sem valores fixos). | SN:24; comentário LPI:66-67 |
| **B-13** | Causa de morte, vendedor, comprador e frigorífico gravados por **nome** (sem ids de cadastro); `exigeObservacao` ignorado. | LPI:1340, 1657, 1733, 1889 |
| **B-14** | O comentário diz que o adaptador "recusa marca/raça não cadastradas (MARCA_NAO_CADASTRADA/RACA_NAO_CADASTRADA)"; esses códigos não existem e o adaptador **cria** marca/raça pelo nome. | LPI:1003-1004 × WADP:38-63, 339-340, 414-415 |
| **B-15** | Peso médio do dia conta registros sem peso como 0. | LPI:690 |
| **B-16** | `confirmarExclusaoLancamento` sem try/catch (erro do serviço vira promessa rejeitada sem toast). | LPI:1096-1106 |
| **B-17** | Manejo/Saída com número ambíguo mostra dois toasts ao salvar. | LPI:853-856 + 373 |
| **B-18** | SN exige raça; Cadastro normal aceita "Não informada". | SNDLG:52-55 × LPI:1466-1473 |
| **B-19** | Página inteira recarrega todas as pesagens da empresa na abertura e após exclusão (custo linear no volume). | LPI:533-554, 1105 |
| **B-20** | Cálculo duplicado: o ganho é calculado na tela e recalculado no serviço (o valor da tela é descartado). | LPI:908-916 × WSVC:63-77 |
| **B-21** | "Desfazer" um Cadastro remove só a pesagem: `animais`/`animalIdentificadores` ficam órfãos; recadastrar o mesmo número+marca cria um segundo animal, e a importação (`bulkCreateEntries`) casaria a identidade com o órfão. `movimentosAnimais` não é cancelado. | WADP:753-775, 513-523; LPI:883 |
| **B-22** | Duplicidade no dia, animal inativo por `status_animal` e Cadastro duplicado por número+marca **só na tela**; o serviço não bloqueia (importação não se beneficia). | LPI:868-887 × WADP:165-191 |

### 22.4 Código morto

| ID | Item | Evidência |
|---|---|---|
| D-01 | `GerenciarSaidasDialog` não é importado em lugar nenhum; usa `appSettings perfis-saida:*` e rendimento fixo `'50'`. | SAIDLG:14-15, 19; grep sem usos |
| D-02 | `avaliarIdentificacaoAnimal`/`montarOpcaoMarca` não usados; o ramo de botões `avisoTela.opcoes` é inalcançável. | LOOK:5-10, 26-67; LPI:1584-1588 |
| D-03 | Estado `documentacao` sem uso. | LPI:147, 1080 |
| D-04 | `totaisDocsAbate` não usado e soma campos inexistentes; `todasPesagensAbate` trivial. | LPI:734-764 |
| D-05 | `dbReady` constante, `queryClient`, `SortIcon`, `CardHeader`, `CardTitle`, `legacyAnimalKey` não usados. | LPI:94, 87, 673-678, 7, 48 |
| D-06 | Fragmento vazio para Cadastro/Manejo na barra. | LPI:1384-1386 |
| D-07 | Prop `onAtivoChange` da sequência nunca é passada. | SEQ:24; LPI:1631 |

---

## 23. Divergências entre documentos antigos e o código

| Documento | Afirmação | Código atual |
|---|---|---|
| `docs/evidence/auditoria-master-produto-pecuario/TARGET-LAUNCH-FLOW.md:10, 65` | contexto da sessão persistido no lugar de `configuracoesPorTipoRef` | não implementado; ref em memória (LPI:398) |
| idem `:40` | lote automático por ocupação em `animalLotes` | contagem de pesagens (LPI:768-776) |
| idem `:43` | bloqueios no serviço: inativo, duplicidade no dia, sessão fechada | só na tela / inexistente (B-09, B-22) |
| idem `:51` | Venda/Abate por operação aberta; "nada é digitado por animal" | campos digitados por lançamento (LPI:1703-1966) |
| `docs/evidence/auditoria-master-produto-pecuario/ANIMAL-REGISTRATION-FLOW.md:36, 70` | sequência por `faixasIdentificadores`; remover blocos de compra e sequência do Lançamento | ambos ainda na tela (LPI:1375-1382, 1631-1700) |
| `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:123-129` (ADR-019) | `SequenciaBrincos` vira visão de `identifierInventoryService`; remover `window.__sequenciaBrincos` | serviço inexistente; global em uso (SEQ:122) |
| idem `:156` (ADR-023) | ocupação de lote por `animalLotes`, nunca por pesagens | B-04 |
| idem `:40-45` (ADR-007) e `:146-150` (ADR-022) | Sanidade fora do produto; retorno exige nova ADR e módulo próprio | coerente com o código (sem Sanidade); **a missão futura exige nova ADR** |
| idem `:128` (ADR-019) | "Estoque" significa somente identificadores; nada de medicamentos | a missão (produtos/medicamentos) contradiz — nova ADR |
| `docs/evidence/auditoria-master-produto-pecuario/UX-FLOW-AUDIT.md:34` | apartação precisa ser reescolhida quando o operador limpa | salvar preserva a apartação; Cancelar reaplica só a padrão (LPI:1566) |
| Comentário LPI:1003-1004 | adaptador recusa marca/raça não cadastradas | adaptador cria (B-14) |

---

## 24. Onde um painel de Sanidade caberia no layout ModeloBase1 atual

Opções, da mais natural para a menos:

1. **Painel de detalhe no formulário** (mesmo padrão de Compra/Venda/Abate): novo `.d17d-detail-panel` logo após `SequenciaBrincos`/Compra (entre LPI:1631-1700 e 1702), aberto por um botão-ícone na barra. O **slot já existe**: o fragmento vazio `(tipoManejo === 'Cadastro' || tipoManejo === 'Manejo') && <></>` em **LPI:1384-1386**. Grade de 4 colunas já estilizada (CSS:945-948). Serve para "programa/procedimento da sessão + produtos a aplicar neste animal".
2. **Coluna lateral de resumo**: nova opção `sanidade` no seletor `painelResumoTipo` (LPI:1391-1401) e novo ramo em LPI:2281-2311 dentro de `.d17d-summary-column` (≥300px, ocupa a altura toda — CSS:984, 1988-1992). Serve para o checklist do protocolo do dia / pendências de aplicação por lote, sem ocupar a faixa do formulário.
3. **Faixa do animal** (`.d17d-animal-performance`, LPI:1596-1628): uma seção "Sanidade" (última aplicação, carência ativa) ao lado de Animal · Última · Ganho; hoje a grade tem 3 colunas + tendência + aviso (CSS:2805-2810, 2869-2875).
4. **Linha de apartação** (`.d17d-apartation-fields`, LPI:1969-2055): um seletor compacto de "Protocolo da sessão" (164px, CSS:3936-3940), como contexto.

Restrições que a implementação precisará tratar explicitamente:

- Gate `scripts/verify-ui-consistency.mjs:20` **proíbe** `/sanidade|sanit[aá]ri/i` em LPI; `:185` exige que `src/pages/ConfiguracoesSanidade.jsx` não exista.
- `scripts/verify-dexie-storage.mjs:33-35` exige que as stores `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal` **não existam** após o upgrade (removidas na v6, SCHEMA:31-44; `src/storage/indexedDb/db.js:27-44`) → usar **nomes novos** numa v8 ou mudar o gate conscientemente.
- `sanidade_ids`/`sanidades` são proibidos no `legacy_payload` (WMAP:23-25, 124-125; `scripts/verify-payload-allowlist.mjs:28`; `scripts/verify-perf-baseline-contract.mjs:195`) → aplicações **não** devem viver em `pesagens`; stores próprias com `pesagem_id`/`sessao_id` opcionais. Também evita B-11 (evento sem peso no cálculo de GMD).
- ADR-007/ADR-022 exigem nova ADR; ADR-019 restringe "estoque" a identificadores.
- Formato legado exportado na migração v7 (`programasSanidade`, `medicamentos` em `cadastros-auxiliares:sanidade:*`, `scripts/verify-v7-migration.mjs:100, 262-270`; `src/storage/migrations/v7Backfill.js:659-705`) pode servir de fonte de importação.

---

## 25. Funções canônicas para reuso (lançamento e importação)

| Função | Local | Contrato |
|---|---|---|
| `calculateWeightGain({ history, date, weight })` | WCALC:13-35 | referência anterior = evento do mesmo animal com data **estritamente** anterior e peso finito; `dias` UTC; `ganho` 2 casas; `gmd` 3 casas (0 se dias=0) |
| `recalculateWeightSeries(entries, affectedKeys)` | WSER:10-46 | agrupa por `id:<animal_id>` ou `legacy:<NÚMERO::MARCA>`; ordena data → created → id; só Manejo recebe derivados; Cadastro/Saída ficam nulos |
| `animalIdentityKey(entry)` | WSER:48-50 | chave de identidade da série |
| `recalculateAllWeightSeries()` / `recalculateWeightSeriesForKeys` | WSVC:144-197 | carrega a série (por índice quando há `animal_id`) e grava só os 5 derivados (`systemDerived`, sem auditoria) |
| `buildWeightPreview({ history, date, weight, editingId })` | WPREV:6-30 | pré-visualização (ignora o próprio registro e datas ≥ data) |
| `evaluateWeighingWarnings({ weight, date, history, policy })` | WWARN:38-57 | códigos `WEIGHT_RANGE`, `WEIGHT_CHANGE`, `GMD_RANGE` |
| `suggestCategory`, `categoriesForSex`, `eraOfCategory` | CAT:43-56 | categoria automática por sexo + faixa de peso inclusiva |
| `calculateCarcassTrade`, `normalizeCarcassYield`, `resolveCarcassYield` | COMM:15-58 | 1 @ = 15 kg de carcaça; rendimento (0,100] |
| `exitRequiresDocument(motivo, salesPolicy)` | `src/modules/operations/domain/closingPendencies.js:9-14` | Abate sempre; Venda por política |
| `parseBrazilianNumber`, `parseCivilDate`, `isFutureCivilDate` | BRV:4-68 | números pt-BR/ISO, datas ISO ou dd/mm/aaaa |
| `validateUiPayload`, `uiToStorageRecord`, `filterLegacyPayload`, `storageRecordToViewModel` | WMAP:30-150 | allowlist ADR-027; peso opcional só em Saída Morte/Doação/Transferência |
| `getRegisteredAnimals`, `buildAnimalLookupIndex`, `getAnimalHistory`, `sameAnimal`, `legacyAnimalKey`, `buildDeletionPlan` | AHIST:6-141 | animal = registro Cadastro; identidade por `animal_id` ou NÚMERO::MARCA |
| `isSnIdentifier`, `normalizeAnimalIdentifier`, `findLatestSnProfile` | SN:1-28 | SN = `/^SN\s*\d*$/i` |
| `situacaoFromExitReason` | `src/storage/indexedDb/normalize.js:35-38` | motivo → enum de situação |
| `weighingService.createEntry / updateEntry / bulkCreateEntries / bulkUpdateEntries / bulkDeleteEntries` | WSVC:53-142, 199-231 | caminho autorizado de gravação |
| `weighingDataAdapter.bulkCreateEntries(payloads, { importMetadata })` | WADP:442-666 | idempotência por `arquivo_hash` (`importacoes`), cronologia por animal no lote, sessões por data, cria animais/identificadores/marcas/raças; recálculo total depois (WSVC:113) |

---

## 26. Riscos para a implementação

1. Separar "contexto" de "perfil do animal" exige desmembrar `sexo/raca/marca/era/categoriaSelecao`, hoje compartilhados entre Cadastro e Manejo/Saída (LPI:118-126, 277-282).
2. Persistir contexto (appSettings ou `sessoesPesagem`) muda a semântica de `configuracoesPorTipoRef` e do efeito de abertura (LPI:319, 321) — risco de reintroduzir R-04 ou vazar contexto entre usuários/dias.
3. Gates que fixam o texto de LPI por regex (`scripts/verify-ui-consistency.mjs`, `verify-operational-customization.mjs:177-223`, `verify-animal-history-integrity.mjs:60-83`, `verify-weighing-access.mjs:88-100`) quebram com refatoração de nomes/estrutura.
4. A importação não herda as validações de tela (B-22) nem a separação sessão/dia fechado (B-09); precisa das mesmas regras no serviço.
5. B-11 (peso nulo como 0) e B-21 (animal órfão) afetam diretamente a reconstrução cronológica e a conciliação por identidade.
6. B-01/B-02 (campos não gravados) — corrigir muda o contrato do `legacy_payload` (allowlist WMAP:6-19 e gate `verify-payload-allowlist.mjs`).
7. Sanidade colide com ADR-007/022/019 e com gates (seção 24).
8. A tela carrega todas as pesagens da empresa (B-19); um painel de Sanidade que também carregue tudo agrava o custo.
