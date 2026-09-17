# 09 — Catálogo de métricas

Só métricas com fonte real. Convenções para todas:
- **Ausente ≠ zero**: valores nulos são excluídos e contados em `n_ausentes`; sem valor elegível o resultado é `null` (tela “—”).
- Médias declaram se são **simples** ou **ponderadas**.
- Arredondamento só na apresentação/exportação, nunca antes de agregar.

Suporte: **✔** dados atuais suficientes · **◐** possível com ressalva · **✖** sem fonte confiável.

| Métrica | Fórmula canônica | Unidade | Entidade base (grão) | Agregável | Agrupável | Suporte | Observação |
|---|---|---|---|---|---|---|---|
| Animais | `count(animais)` com situação no filtro | cab. | animal_current | ✔ (soma entre grupos disjuntos) | ✔ | ✔ | fonte `animais` |
| Animais únicos | `countDistinct(animal_id)` na população | cab. | event | ✖ (não soma entre grupos) | ✔ | ✔ | recalcular no total geral |
| Pesagens | `count(eventos)` | eventos | event | ✔ | ✔ | ✔ | declarar se inclui Cadastro/Saída |
| Peso atual | `animais.ultimo_peso_kg` | kg | animal_current | — | ✔ | ◐ | é o peso do **último evento**; Saída sem peso deixa null |
| Peso médio | `avg(peso_kg válidos)` | kg | event ou animal | ✔ (recalcular) | ✔ | ✔ | por evento ≠ por animal |
| Peso mínimo / máximo / amplitude | `min`, `max`, `max − min` | kg | event/animal | ✔ | ✔ | ✔ | — |
| Peso total | `sum(peso_kg válidos)` | kg | event (instantâneo) / animal_current | ✔ | ✔ | ✔ | somar eventos de datas diferentes **não é estoque**; para estoque usar `animais` |
| Ganho do intervalo | `payload.ganho` (Manejo) | kg | event | ✔ | ✔ | ◐ | só Manejo; recalculado em cascata |
| Ganho total do animal no período | `peso_último − peso_primeiro` dentro do período | kg | animal_period | ✔ | ✔ | ✔ | calcular a partir dos eventos com peso |
| Ganho médio | `avg(ganho por animal)` | kg | animal_period | ✔ | ✔ | ✔ | — |
| Dias | `payload.dias` (evento) ou `data_última − data_primeira` (animal) | dias | event / animal_period | ✔ | ✔ | ✔ | — |
| GMD do intervalo | `payload.gmd` | kg/dia | event | — | ✔ | ◐ | arredondado a 3 casas na gravação; `dias<=0` grava 0 (D1) |
| GMD médio simples | `avg(gmd dos intervalos Manejo)` | kg/dia | event | ✔ (recalcular) | ✔ | ✔ | rotular “simples” |
| **GMD ponderado** | `Σ ganho / Σ dias`, **emparelhados por linha válida** | kg/dia | event ou animal_period | ✔ (recalcular) | ✔ | ✔ | **não existe hoje**; métrica padrão recomendada para grupos |
| GMD do animal no período | `(peso_último − peso_primeiro) / dias` | kg/dia | animal_period | ✔ | ✔ | ✔ | exige ≥2 pesagens com peso |
| Quantidade por situação | `count(animais) group by situacao` | cab. | animal_current | ✔ | ✔ | ✔ | — |
| Entradas | `count(eventos Cadastro)` no período | cab. | event | ✔ | ✔ | ✔ | compra não tem operação própria |
| Saídas | `count(eventos Saída)` no período | cab. | event | ✔ | ✔ | ✔ | Saída é única por animal (cronologia) |
| Mortes / vendas / abates / doações / transferências | `count(Saída) by motivo_saida` | cab. | event | ✔ | ✔ | ✔ | motivo em texto enum |
| Compras | `count(Cadastro com valor_pago_cabeca)` | cab. | event | ◐ | ◐ | ◐ | não há marcação explícita de compra |
| Taxa de mortalidade | `mortes / animais expostos no período` | % | animal_period | ◐ | ◐ | ◐ | denominador (animais-dia ou estoque médio) precisa de `animalLotes`/eventos; **definir antes de exibir** |
| Arrobas estimadas | `payload.quantidade_arrobas` (gravado) | @ | event (Saída) | ✔ | ✔ | ◐ | rendimento da época; **não recalcular** com outra regra |
| Valor estimado | `quantidade_arrobas × valor_arroba` | R$ | event | ✔ | ✔ | ◐ | distinguir de informado |
| Valor informado | `payload.valor_venda_total` / `valor_total_abate` / `valor_pago_cabeca` | R$ | event | ✔ | ✔ | ◐ | sensível (`commercial.values`) |
| Preço médio por @ | `Σ valor / Σ arrobas` (ponderado) | R$/@ | event | ✔ | ✔ | ◐ | hoje é média simples (`ResumoVendaDia`) |
| Quantidade por lote (atual) | `count(animais where lote_atual_id)` | cab. | animal_current | ✔ | ✔ | ✔ | — |
| Ocupação | `animais no lote / quantidade_maxima` | % | lot | ✔ | ✔ | ◐ | capacidade 0/ausente → null, não 999999 |
| Capacidade | `loteApartacoes.quantidade_maxima` | cab. | lot | ✔ | ✔ | ✔ | — |
| Animais por faixa de peso | `count(animais) by faixa(ultimo_peso_kg)` | cab. | animal_current | ✔ | ✔ | ✔ | faixas do relatório ou das categorias |
| Animais sem pesagem recente | `count(animais ATIVO where hoje − ultima_pesagem_data > N)` | cab. | animal_current | ✔ | ✔ | ✔ | `intervalo_pesagem_dias` já existe em `operational-defaults` |
| Animais perdendo peso | `count(animais where último gmd < 0)` ou ganho do período < 0 | cab. | animal_period | ✔ | ✔ | ✔ | — |
| Pendências | GMD<0; sem lote; saída sem documento | eventos | event | ✔ | ✔ | ✔ | regras do Fechamento |
| Identificadores disponíveis/usados | — | — | — | — | — | ✖ | `faixasIdentificadores` sem gravador |
| Idade / nascimento | — | — | — | — | — | ✖ | decisão de 16/09: nascimento não é usado |
| Receita líquida, frete, margem | — | — | — | — | — | ✖ | frete/descontos de venda não persistidos |
