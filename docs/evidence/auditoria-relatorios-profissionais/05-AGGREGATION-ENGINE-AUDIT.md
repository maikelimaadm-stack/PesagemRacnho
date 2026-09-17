# 05 — Resumos, totais e agregações

Legenda de confiabilidade: **alta** (fórmula correta e nulos tratados), **média** (correta para dados comuns, com
brecha documentada), **baixa** (resultado pode ser errado em uso normal).

Regra transversal observada: `hasNumber` (Fechamento/Ficha) exclui `null/undefined/''` corretamente; já
`Number(x) || 0` e `Number(null)` (que vale `0`, um número finito) **transformam nulo em zero**. O peso é nulo
legitimamente em Saída por Morte/Doação/Transferência (`weighingMapper.js:56`) e GMD/ganho/dias são nulos em Cadastro
e Saída (`weighingSeries.js:26-28`).

## 1. Primitivas de domínio (reutilizáveis)

| Nome | Fórmula no código | Fonte | Null | Zero | Arredond. | Formato | Unidade | Uso | Confiab. | Reutil. |
|---|---|---|---|---|---|---|---|---|---|---|
| Referência anterior | última entrada com `data < atual` e `Number.isFinite(Number(peso))` | `weighingCalculations.js:20-22` | **peso null passa como 0** | 0 aceito | — | — | — | série, avisos | média | sim |
| Dias | `round((UTC(atual) − UTC(anterior)) / 86 400 000)` | `weighingCalculations.js:30` | sem anterior → null | mesmo dia excluído | inteiro | `fmtInt` | dias | série | alta | sim |
| Ganho | `Number((peso − pesoAnterior).toFixed(2))` | `:31` | sem anterior → null | — | 2 casas | `fmtNum` | kg | série | alta | sim |
| GMD do intervalo | `dias>0 ? Number((ganho/dias).toFixed(3)) : 0` | `:32` | sem anterior → null | `dias<=0` → **0** | 3 casas sobre ganho arredondado | `fmtNum(,3)` | kg/dia | série | alta | sim |
| Série do animal | agrupa por `id:<animal_id>` ou `legacy:NUM::MARCA`; só **Manejo** recebe derivados | `weighingSeries.js:10-46` | peso null entra no histórico | — | herda | — | — | persistência | alta | sim |
| Carcaça estimada | `peso × rendimento / 100` | `commercialCalculations.js:18` | peso ≤0 → null | rendimento inválido → **50** (`:5-9`) | — | `fmtNum` | kg | Lançamento, Venda | média | sim |
| Arrobas | `carcaça / 15` | `:19` | null | — | — | `fmtNum` | @ | idem | média | sim |
| Valor estimado | `arrobas × preço` (preço ≥0) | `:25` | preço null → null | 0 → 0 | — | `fmtCurrency` | R$ | idem | alta | sim |
| Categoria automática + era | 1ª categoria ativa do sexo (menor `ordem`) com `min ≤ peso ≤ max`; era = `categoria.era` | `categorySuggestion.js:26-56`; gravada em `weighingDataAdapter.js:187-196` | peso null/≤0 → sem categoria | — | — | — | — | gravação | alta | sim |
| Avisos de conferência | faixa de peso; variação %; `|gmd|` acima do limite (política configurável) | `weighingWarnings.js:22-56` | ignora sem dado | — | 1/3 casas | — | — | Lançamento | alta | sim |
| `weighing.summary` | soma/média/min/max de `peso_kg > 0` | `repositories/index.js:94-105` | exclui do cálculo, **conta no total** | exclui | — | — | kg | **não usado** | alta | sim |

**Quando os derivados são calculados e gravados** (`weighingService.js`): criar recalcula e sobrescreve o que a tela
mandou (só Manejo; `:26-75`); editar/excluir recalculam as chaves afetadas (`:165-195`); importação, edição e exclusão
em lote recalculam **a base inteira** (`:77-108`). Os 5 campos (`data_anterior`, `peso_anterior`, `dias`, `ganho`,
`gmd`) vão para o `legacy_payload`, **sem versão de fórmula**.

## 2. Agregações das telas (não reutilizáveis: escritas dentro de componentes)

| Nome | Fórmula | Fonte | Null | Zero | Unidade | Onde | Confiab. |
|---|---|---|---|---|---|---|---|
| Relação — Animais únicos | `Map` por `animal_id \|\| NUM::MARCA` sobre filtrados | `PesagensIndividuais.jsx:361-367` | — | — | animais | rodapé | média |
| Relação — Animais ativos | última entrada por chave com `status_animal==='Ativo'` | `:368` | status ausente = Ativo | — | animais | rodapé | média (depende do filtro de data) |
| Relação — Peso atual estimado | Σ `Number(peso)\|\|0` da última pesagem dos ativos | `:369` | **null→0** | conta | kg | rodapé | média |
| Relação — Média da última pesagem | `pesoAtual / ativos.length` | `:370` | **null no denominador** | — | kg | rodapé | média |
| Relação — pesoTotal/Médio, arroba (peso vivo ÷ 15), GMD/ganho/dias médios | médias simples | `:357-386` | `\|\|0` | — | — | **código morto** | baixa |
| Lançamento — estatísticas | total; machos/fêmeas por `filter(sexo)`; `Σ(peso\|\|0)/total` | `LancamentoPesagensIndividuais.jsx:680-686` | **null→0 no denominador** | — | registros/kg | rodapé | média (conta lançamentos) |
| Rodapé por marca | qtd +1; peso `\|\|0`; média | `PesagensResumoRodape.jsx:9-27` | null→0 | — | kg | rodapé | média |
| `resumoDoc`/`resumoEmbarque` | idem, sobre **todas** as pesagens do documento/embarque | `Lancamento…jsx:694-720` | null→0 | — | — | Abate | média |
| `totaisDocsAbate` | soma de campos inexistentes → `NaN` | `Lancamento…jsx:749-758` | — | — | — | **código morto com bug** | baixa |
| `ResumoEmbarque` | embarcados M/F por pesagem; Falta = `max(0, prev − emb)` | `ResumoEmbarque.jsx:10-38,74` | `\|\|0` | — | cabeças | Abate | média (pesagens) |
| `ResumoLotes` | qtd de pesagens no lote; peso médio; @ = `quantidade_arrobas ?? peso/30` | `ResumoLotes.jsx:10-26` | null→0 | — | — | Apartação | **baixa** (modo Total soma histórico; 50% fixo) |
| Ocupação do lote (apartação) | `pesagens.filter(lote_id).length >= (quantidade_maxima\|\|999999)` | `Lancamento…jsx:763-770` | — | máx. 0 → 999999 | pesagens | lote automático | **baixa** |
| Fechamento — ocupação | `min(100, pesagens_do_dia/capacidade×100)` | `FechamentoDia.jsx:93-101` | — | cap. 0 → 0% | % | card | média |
| `ResumoVendaDia` — preço médio/@ | média **simples** de `valor_arroba > 0` | `ResumoVendaDia.jsx:18-23` | exclui | exclui | R$/@ | Venda | média |
| `ResumoVendaDia` — valor total | informado se >0, senão estimado | `:26-31` | estimativa null→0 | — | R$ | Venda | média (mistura sem sinalizar) |
| `ResumoVendaDia` — rendimento médio | Σ yield / total | `:33-37` | **null vira 50** | — | % | Venda | baixa |
| `ResumoPersonalizado` — count | `rows.length` | `ResumoPersonalizado.jsx:20` | — | — | registros | painel | alta |
| `ResumoPersonalizado` — sum/average/min/max/difference | `rows.map(Number(row[f])).filter(Number.isFinite)` | `:21-27` | **CRÍTICO: `Number(null)=0` passa** → média e mínimo de GMD/ganho/dias diluídos | vazio → 0 | — | painel | **baixa** |
| `ResumoPersonalizado` — ratio (Σ÷Σ) | `Σ(f\|\|0)/Σ(divisor\|\|0)` | `:18,28` | não emparelha numerador e denominador | 0 → 0 | — | painel | média |
| Fechamento — peso total | `Σ(Number(peso)\|\|0)` | `FechamentoDia.jsx:75` | neutro na soma | — | kg | KPI | alta |
| Fechamento — peso médio | `total / rows.length` (“kg por animal”) | `:145` | null no denominador | vazio → 0 | kg | KPI | média |
| Fechamento — GMD médio | média simples de `hasNumber(gmd)` | `:77-78` | exclui | vazio → `0,000` | kg/dia | KPI | média |
| Fechamento — @ carcaça | `total × rendimento_padrao/100/15` | `:192` | — | — | @ | card | baixa (inclui Cadastro/Manejo) |
| Ficha — ganho total / GMD médio | `(último\|\|0) − (primeiro\|\|0)`; `/ dias` | `FichaAnimal.jsx:113-115` | **Saída sem peso vira −peso inicial** | dias 0 → 0 | kg, kg/dia | KPI | média |
| Ficha — @ carcaça | `peso × 0,5 / 15` | `:142` | null→0 | — | @ | KPI | baixa |
| Contagens do banco | linhas sem `deleted_at` por store | `health.js:145-158` | — | — | — | Manutenção | alta |

## 3. Respostas diretas

| Pergunta | Resposta |
|---|---|
| NULL vira zero silenciosamente? | **Sim**, em `ResumoPersonalizado.jsx:21` (grave), `Lancamento…jsx:684,703,717,735`, `PesagensResumoRodape.jsx:16`, `ResumoLotes.jsx:21,23`, `ResumoEmbarque.jsx:15`, `ResumoVendaDia.jsx:14`, `FechamentoDia.jsx:75,97,109,145`, `FichaAnimal.jsx:113,138,142`, Relação `:358,369`, e nas exportações de Fechamento (`:119`) e Ficha (`:132`). Na série: `weighingCalculations.js:21`, `weighingSeries.js:42`. |
| Pesagens contadas como animais? | **Sim**: Total Machos/Fêmeas, ocupação de lote, embarcados, `ResumoLotes`, “peso médio por animal” do Fechamento. Só Relação (`:361-367`) e Fechamento (`:76`) contam animais distintos. |
| Média simples × ponderada de GMD? | **Não há distinção.** Todas são simples; a Ficha usa, sem rotular, um ponderado primeiro→último. |
| Peso da pesagem ou atual do animal? | Sempre o **snapshot da pesagem**. “Peso atual” = última pesagem do conjunto (na Relação, do conjunto **filtrado**). Nenhum resumo lê `animais.ultimo_peso_kg`. |
| Resumos respeitam filtros? | Relação sim (exceto `doc_qtd`). No Lançamento, `estatisticas`/marcas/`ResumoLotes` “Dia” sim; `ResumoLotes` “Total”, Venda, Personalizado, Embarque e `resumoDoc` **não**. Nenhum depende das colunas visíveis. |
| Três fórmulas de arroba | domínio correto (`carcaça/15`); Relação `peso/15` (morto); `ResumoLotes` `peso/30`; Ficha 50% fixo. |

## 4. Métricas que não existem

Mediana, desvio-padrão, GMD ponderado explícito, mortalidade/taxa, entradas × saídas por período, saldo de lote,
lotação por permanência (`animalLotes` existe e nenhum resumo lê), receita líquida, frete, margem, produtividade da
sessão, versão de fórmula.

## 5. `F0-02-CATALOGO-DE-FORMULAS.md` × código (escrito para 1.1.17)

| Item | Estado atual |
|---|---|
| D1 GMD 0 quando `dias<=0` | ainda aberto (`weighingCalculations.js:32`) |
| D2 só Manejo recebe ganho | ainda assim |
| D3 recálculo lê a base inteira | parcial: criar/editar/excluir leem só o animal; lote/importação/legado ainda leem tudo |
| D4 fallback 50% e origem do rendimento | **bug**: a tela calcula `rendimento_origem` (`Lancamento…jsx:1026`), mas a chave **não está na allowlist** (`weighingMapper.js:6-17`) e é descartada; edição cai em `INFORMADO` (`:1148`) |
| D5 sem GMD ponderado | aberto |
| D6 duplicidade só na UI | aberto |
| D8 `localeCompare` sem `Intl.Collator` | aberto (`animalHistory.js:88-89`) |
| §2 limites de alerta em código | desatualizado: configuráveis (`weighingWarnings.js:22-36`) |
| §5 “média = soma ÷ registros com valor numérico” | impreciso: null conta como 0 |
| `F0-01` `categoria_id` “planejado”, era/nascimento | desatualizado: categoria por peso e era da categoria (16/09) |

## 6. Recomendação para o motor de agregação

Criar **um único módulo puro de agregações** (sem React) com operações `count`, `countDistinct(chave)`, `sum`, `avg`,
`weightedAvg(num, den)` com **emparelhamento por linha**, `min`, `max`, `range`, `ratio`, todas com a regra:
**valor ausente é excluído e contado à parte** (`n_validos`, `n_ausentes`), e resultado `null` quando não há valor
elegível (a UI mostra “—”). As agregações das telas atuais não devem ser reaproveitadas; as primitivas de domínio sim.
