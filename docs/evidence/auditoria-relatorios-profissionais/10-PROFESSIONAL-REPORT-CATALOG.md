# 10 — Catálogo de relatórios profissionais

Classificação:
**PRONTO COM DADOS ATUAIS** · **PRONTO COM PEQUENO SERVICE** · **REQUER NOVO ÍNDICE** · **REQUER NOVA MODELAGEM** · **NÃO DEVE SER FEITO AGORA**.

“Pequeno service” = leitura + agregação pura, sem schema. “Novo índice” = sobe versão Dexie (fora desta fase).

## A — Rebanho (grão `animal_current`)

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| A1 | Inventário atual do rebanho | `animais` + cadastros | PRONTO COM PEQUENO SERVICE | Saída sem peso zera categoria (G-P0-02) |
| A2 | Rebanho por marca / raça / categoria / sexo / era | `animais` | PRONTO COM PEQUENO SERVICE | categoria null até configurar faixas |
| A3 | Rebanho por situação | `animais.situacao` (indexado) | PRONTO COM DADOS ATUAIS | — |
| A4 | Rebanho por faixa de peso | `animais.ultimo_peso_kg` | PRONTO COM PEQUENO SERVICE | peso do último evento |
| A5 | Animais sem pesagem recente | `animais.ultima_pesagem_data` (indexado) + `intervalo_pesagem_dias` | PRONTO COM PEQUENO SERVICE | — |
| A6 | Rebanho em uma data passada | `pesagens` + `animalLotes` reconstruídos | REQUER NOVA MODELAGEM | não há snapshot; reconstrução custosa e `movimentosAnimais` não confiável |

## B — Pesagens (grão `event`)

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| B1 | Relação de pesagens por período (paridade com a tela) | `pesagens` por `data_pesagem` | PRONTO COM PEQUENO SERVICE | primeira fatia recomendada |
| B2 | Pesagens por sessão | `pesagens.sessao_id` + `sessoesPesagem` | PRONTO COM PEQUENO SERVICE | duas sessões na mesma data |
| B3 | Pesagens por lote / apartação | `lote_id` indexado; apartação no payload | PRONTO COM PEQUENO SERVICE | agrupar por id |
| B4 | Pesagens por operador | `created_by_user_id` | PRONTO COM PEQUENO SERVICE | registros antigos sem usuário |
| B5 | Pendências de pesagem (GMD<0, sem lote, alerta confirmado) | payload | PRONTO COM PEQUENO SERVICE | reaproveitar regra do Fechamento |
| B6 | Importações e origem dos registros | `payload.origem` + `importacoes` | PRONTO COM PEQUENO SERVICE | sem `importacao_id` na pesagem |

## C — Desempenho (grão `animal_period`)

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| C1 | GMD e ganho por animal no período | `pesagens` com peso | PRONTO COM PEQUENO SERVICE | ≥2 pesagens |
| C2 | Desempenho por lote / marca / raça / categoria (GMD ponderado) | idem + `animais` | PRONTO COM PEQUENO SERVICE | GMD ponderado é novo; categoria histórica só desde 16/09 |
| C3 | Animais perdendo peso | idem | PRONTO COM PEQUENO SERVICE | — |
| C4 | Curva de peso / evolução mensal | idem | PRONTO COM PEQUENO SERVICE (tabela) | gráfico fica para depois (sem biblioteca) |
| C5 | Projeção de peso / data de abate | — | NÃO DEVE SER FEITO AGORA | métrica sem fonte validada |

## D — Movimentação

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| D1 | Entradas e saídas no período | `pesagens` por `tipo_pesagem` | PRONTO COM PEQUENO SERVICE | — |
| D2 | Mudanças de lote | `animalLotes` | PRONTO COM PEQUENO SERVICE | ids recriados a cada edição |
| D3 | Extrato de movimentação por animal | Ficha + `animalLotes` | PRONTO COM PEQUENO SERVICE | não usar `movimentosAnimais` |
| D4 | Balanço (estoque inicial + entradas − saídas = final) | eventos + reconstrução | REQUER NOVA MODELAGEM | depende de A6 |

## E — Saídas e mortalidade (grão `exit`)

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| E1 | Saídas por motivo | `pesagens` Saída | PRONTO COM PEQUENO SERVICE | motivo em texto enum |
| E2 | Mortes por causa | `payload.causa_morte` (nome) | PRONTO COM PEQUENO SERVICE | agrupamento por nome |
| E3 | Taxa de mortalidade | eventos + denominador | NÃO DEVE SER FEITO AGORA | denominador não definido (decisão) |

## F — Comercial

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| F1 | Vendas do período (cab., kg, @, R$) | payload Saída/Venda | PRONTO COM PEQUENO SERVICE | valores sensíveis; comprador em texto; exigir `commercial.values` |
| F2 | Abates do período (rendimento, @, R$) | payload Saída/Abate | PRONTO COM PEQUENO SERVICE | `rendimento_origem` descartado (G-P0-03) |
| F3 | Compras (valor pago por cabeça) | payload Cadastro | PRONTO COM PEQUENO SERVICE | compra sem marcação explícita |
| F4 | Por comprador / frigorífico com totais confiáveis | — | REQUER NOVA MODELAGEM | parceiros não referenciados por id |
| F5 | Operação comercial (lote de venda, margem, frete, líquido) | — | REQUER NOVA MODELAGEM | `operacoesComerciais` não existe |
| F6 | Resultado econômico / custo por arroba | — | NÃO DEVE SER FEITO AGORA | sem custos no sistema |

## G — Embarques e documentos (grão `shipment_document`)

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| G1 | Romaneio de embarque | `documentosEmbarque` + Saídas | PRONTO COM PEQUENO SERVICE | varredura das Saídas (sem índice) |
| G2 | Previsto × realizado (machos/fêmeas) | `qtd_prev_*` + Saídas | PRONTO COM PEQUENO SERVICE | — |
| G3 | Saídas sem documento | payload | PRONTO COM PEQUENO SERVICE | GTA/NF-e de venda/abate não persistidos |
| G4 | Embarques por frigorífico/parceiro indexado | — | REQUER NOVO ÍNDICE + modelagem | `parceiro_id` nunca gravado |

## H — Controle e auditoria

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| H1 | Fechamento do dia (versão imprimível) | `FechamentoDia` | PRONTO COM PEQUENO SERVICE | números não congelados |
| H2 | Trilha de auditoria por entidade/usuário/período | `auditoria` (bons índices) | PRONTO COM PEQUENO SERVICE | contém valores; só ADMIN (`audit.read`) |
| H3 | Qualidade dos dados | `health.js` logicalIntegrity | PRONTO COM PEQUENO SERVICE | — |
| H4 | Histórico de backups | `backupHistory` | PRONTO COM DADOS ATUAIS | sem usuário |
| H5 | Registro de exportações/emissões | — | REQUER NOVA MODELAGEM | auditoria não registra exportação |

## I — Cadastros

| # | Relatório | Fonte | Classificação | Ressalva |
|---|---|---|---|---|
| I1 | Listagens de cadastros (marcas, raças, categorias, parceiros…) | stores de cadastro | PRONTO COM DADOS ATUAIS | já existem na tela + CSV |
| I2 | Uso de cadastros | contadores atuais | PRONTO COM PEQUENO SERVICE | N+1 hoje; contagem de parceiros por nome |
| I3 | Faixas de identificadores | — | NÃO DEVE SER FEITO AGORA | store sem gravador |
| I4 | Usuários e perfis | `usuarios` via `sanitize` | PRONTO COM PEQUENO SERVICE | nunca campos de senha/recuperação |

## Resumo

| Classificação | Quantidade |
|---|---|
| PRONTO COM DADOS ATUAIS | 3 (A3, H4, I1) |
| PRONTO COM PEQUENO SERVICE | 30 |
| REQUER NOVO ÍNDICE | 1 (G4, junto com modelagem) |
| REQUER NOVA MODELAGEM | 5 (A6, D4, F4, F5, H5) |
| NÃO DEVE SER FEITO AGORA | 4 (C5, E3, F6, I3) |
| **Total** | **43** |

**Não requerem índice novo para a primeira onda**: todos os relatórios de período usam `data_pesagem`; os de
estado atual usam índices de `animais` ou varredura de stores pequenas.
