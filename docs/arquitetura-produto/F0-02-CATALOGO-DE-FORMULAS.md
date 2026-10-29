# F0-02 — Catálogo de fórmulas existentes

Levantamento das fórmulas **implementadas** na 1.1.17, com o arquivo de origem,
o teste que as protege e a comparação com as fórmulas canônicas do
[02-ARQUITETURA-DE-DOMINIO.md](./02-ARQUITETURA-DE-DOMINIO.md) §5 e das
métricas do [04-RELATORIOS-E-INDICADORES.md](./04-RELATORIOS-E-INDICADORES.md) §3.

## 1. Ganho, dias e GMD

**Origem:** `src/modules/weighing/domain/weighingCalculations.js` (`calculateWeightGain`)  
**Série:** `src/modules/weighing/domain/weighingSeries.js` (`recalculateWeightSeries`)  
**Teste:** `scripts/verify-weighing-calculations.mjs`, `verify-enterprise-hardening.mjs`

| Item | Implementação atual | Canônico (02 §5) | Divergência |
|---|---|---|---|
| Referência anterior | última pesagem **do mesmo animal** com `data_pesagem < data atual` e peso numérico; registros futuros e do mesmo dia são ignorados | idem | nenhuma |
| `ganho_kg` | `peso_atual − peso_anterior`, arredondado a 2 casas | `peso_atual_kg − peso_anterior_kg` | arredondamento não está no canônico (registrar como regra de apresentação) |
| `dias` | diferença de datas civis em UTC (`Date.UTC`), sem fuso | diferença de datas civis | nenhuma |
| `gmd_kg_dia` | `ganho / dias` a 3 casas **quando `dias > 0`; caso contrário `0`** | somente quando `dias > 0`; mesmo dia **não produz GMD** | **D1:** o código devolve `0` onde o canônico pede ausência (`null`). Como registros do mesmo dia nunca são escolhidos como anterior, `dias` nunca é 0 na prática; alinhar para `null` na F1 sem impacto de dados |
| Elegibilidade por tipo | só `tipo_manejo === 'Manejo'` recebe ganho/GMD; `Cadastro` e `Saída` gravam `null` | pesagem é fato; derivados reconstruíveis | **D2:** Saída com peso não recebe ganho/GMD; o relatório REP-302 (peso vivo na venda) precisa decidir se o ganho até a saída entra na série. Registrar decisão em ADR antes da F3 |
| Recálculo retroativo | após criar/editar/excluir, a série do animal (ou de todos) é recomposta e gravada em `legacy_payload` | recomposição transacional | **D3:** o recálculo lê a base inteira (`listEntries()`), ver baseline F0; corrigir na F1 |
| Chave da série | `id:<animal_id>` ou `legacy:<NÚMERO::MARCA>` para registros sem `animal_id` | animal canônico | compatibilidade legada preservada |

## 2. Alertas de conferência (outliers)

**Origem:** `src/modules/weighing/domain/weighingWarnings.js`  
**Teste:** `scripts/verify-enterprise-hardening.mjs`

| Alerta | Regra | Parâmetro padrão |
|---|---|---|
| `WEIGHT_RANGE` | peso fora de `[minimumWeightKg, maximumWeightKg]` | 20 a 1500 kg |
| `WEIGHT_CHANGE` | `|ganho| / peso_anterior × 100 > maximumWeightChangePercent` | 35 % |
| `GMD_RANGE` | `|gmd| > maximumAbsoluteGmdKg` | 5 kg/dia |

Os limites são constantes em código (`DEFAULT_WEIGHT_WARNING_POLICY`). O alvo
(03 §7) pede configuração controlada e versionada; a justificativa digitada é
gravada em `justificativa_alerta` e os códigos em `alertas_confirmados`.

## 3. Carcaça, arrobas e valor estimado

**Origem:** `src/modules/weighing/domain/commercialCalculations.js` (`calculateCarcassTrade`, `normalizeCarcassYield`)  
**Teste:** `scripts/verify-enterprise-hardening.mjs`

| Item | Implementação | Canônico | Divergência |
|---|---|---|---|
| Rendimento | informado pela UI; inválido (≤ 0, > 100 ou não numérico) cai no padrão **50 %** | rendimento informado/estimado explícito | **D4:** o fallback silencioso para 50 % contraria "valor informado ≠ valor calculado" (02 §4.8). A tela bloqueia rendimento inválido antes de salvar, então o fallback só age em importação/dados legados; registrar origem do rendimento (`informado`/`padrao`) na F6 |
| `carcaca_kg` | `peso_vivo × rendimento / 100` | idem | nenhuma |
| `arrobas` | `carcaca_kg / 15` | idem | nenhuma |
| `valor_estimado` | `arrobas × preco_por_arroba` quando preço ≥ 0 | idem | nenhuma |
| Separação de conceitos | `liveWeightKg`, `carcassWeightKg`, `arrobas`, `estimatedValue` gravados separadamente | ADR-012 | nenhuma |

Campos gravados na Saída: `rendimento_carcaca`, `peso_carcaca_estimado`,
`quantidade_arrobas`, `valor_arroba`/`valor_arroba_abate`,
`valor_venda_total`/`valor_total_abate`. Não existe cálculo de receita líquida,
frete, comissão ou margem (REP-302/304 — Planejado).

## 4. Regra de apartação automática

**Origem:** `src/pages/LancamentoPesagensIndividuais.jsx` (`getLoteAutomatico`, `isLoteCheio`)  
**Teste:** nenhum unitário (só contratos de UI)

```text
lote_sugerido = primeiro lote da apartação selecionada, na ordem de cadastro, tal que
  peso_minimo ≤ peso ≤ peso_maximo
  e lote não fechado
  e contagem(pesagens com lote_id = lote) < quantidade_maxima (padrão 999999)
```

Divergências com 02 §4.7 (ADR-010): sem prioridade explícita (usa ordem da
lista), sem `E`/`OU`, sem política de dado ausente, sem versão de regra, sem
registro de "sugerido × decidido". A contagem de ocupação percorre **todas as
pesagens** a cada avaliação (custo O(N) por animal). A regra deve migrar para um
motor puro em `src/modules/drafting/` na F4; a F1 deve ao menos usar a projeção
`animalLotes` aberta em vez de contar pesagens.

## 5. Resumos e métricas existentes na tela

**Origem:** `src/components/pesagens/ConfigurarResumosDialog.jsx`, `ResumoPersonalizado.jsx`, `PesagensResumoRodape.jsx`, `ResumoLotes.jsx`, `ResumoVendaDia.jsx`; `src/storage/indexedDb/repositories/index.js` (`weighing.summary`)

| Métrica atual | Definição implementada | Métrica canônica (04 §3) | Observação |
|---|---|---|---|
| Contar registros | quantidade de linhas no escopo | Pesagens | não distingue animais únicos |
| Somar / Média / Menor / Maior | sobre `peso`, valores comerciais, `dias`, `ganho`, `gmd` | Peso total, Peso médio, Ganho total, Ganho médio, GMD médio simples | **D5:** "Média" é soma ÷ quantidade de registros com valor numérico; para GMD isso é o *GMD médio simples*. Não existe *GMD ponderado* (Σganho ÷ Σdias) |
| Maior menos menor | amplitude | — | não canônica; manter como métrica de painel |
| Dividir a soma por outro campo | Σcampo ÷ Σdivisor | permite Σganho ÷ Σdias = GMD ponderado manualmente | documentar como caminho provisório |
| Escopos | dia, histórico, apartação, cadastro, manejo, saída, venda, abate | população explícita | falta período livre e lote |
| Agrupamentos | apartação, lote, tipo, motivo de saída, sexo, marca | dimensões 04 §2 | falta raça, era, sessão, comprador |
| `weighing.summary` (repositório) | total, soma, média, mínimo e máximo de `peso_kg > 0` | Peso total/médio | nulos são excluídos (correto) |

## 6. Regras de validação cronológica

**Origem:** `src/modules/weighing/infrastructure/weighingDataAdapter.js` (`validateAnimalChronology`) e `weighingMapper.js` (`validateUiPayload`)  
**Teste:** `verify-enterprise-hardening.mjs`, `verify-brazilian-format-contract.mjs`

- data civil válida, nunca futura (`isFutureCivilDate` usa a data local do computador);
- peso finito e > 0, exceto Saída por Morte, Doação ou Transferência;
- um único Cadastro por animal;
- nenhum evento anterior ao Cadastro;
- nenhum evento em data ≥ Saída definitiva;
- Saída retroativa recusada se houver eventos posteriores;
- duplicidade no mesmo dia: **só na UI** (`pesagensDia`), não no serviço — **D6:** a política de duplicidade (02 §4.4) precisa descer para o domínio na F1/F2.

## 7. Formatação e parsing brasileiro

**Origem:** `src/modules/weighing/domain/brazilianValues.js`, `src/components/common/formatNumber.js`  
**Teste:** `verify-brazilian-format-contract.mjs`

- `parseBrazilianNumber`: aceita `1.000,00`, `1,000.50`, `-10,50`; um único ponto seguido de 1–2 casas é decimal;
- `parseCivilDate`: aceita ISO `YYYY-MM-DD` e `DD/MM/AAAA`, valida bissexto, ano 1900–2200;
- apresentação: inteiro `1.000`, decimal `1.000,00`, moeda `R$ 1.000,00`, data `DD/MM/AAAA`; unidade só no rótulo.

## 8. Integridade e backup

- `logicalIntegrity` (`src/storage/indexedDb/health/health.js`): ids ausentes/duplicados por store, referências órfãs (animal, lote, embarque, documento, sessão), datas inválidas, identificador ativo duplicado entre animais, intervalos de lote inválidos;
- backup: SHA-256 do JSON sem o bloco `integrity`, manifesto com contagem por store, versão do banco e do app; restauração recusa banco mais novo e divergência de contagem.

## 9. Divergências a resolver (resumo)

| ID | Divergência | Fase | Impacto em dados |
|---|---|---|---|
| D1 | GMD `0` em vez de `null` quando `dias = 0` | F1 | nenhum (caso não ocorre) |
| D2 | Saída com peso não entra na série de ganho | ADR antes da F3 | recálculo se mudar |
| D3 | recálculo lê a base inteira a cada gravação | F1 | nenhum |
| D4 | rendimento inválido cai silenciosamente em 50 % | F6 | marcar origem do rendimento |
| D5 | não existe GMD ponderado; "média" é simples | F3 | nenhum |
| D6 | duplicidade do dia só na UI | F1/F2 | nenhum |
| D7 | apartação sem prioridade, versão nem explicação; ocupação por contagem O(N) | F1 (custo) / F4 (motor) | nenhum |
| D8 | `getRegisteredAnimals` ordena 12 mil animais com `localeCompare('pt-BR', { numeric: true })` criando um collator a cada comparação: 1,7 s dos 2,0 s da reconstrução do índice na massa de 36 mil (perfil de CPU). O gate `animal:history-integrity` não detecta porque sua massa já nasce ordenada. Reutilizar `Intl.Collator` e ordenar só na apresentação | F1 | nenhum |
