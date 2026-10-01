# M1 — Fundação do número (1.5.0, SEM mudança de esquema)

Primeira etapa do PLANO-MELHORIAS-2026-10-01. Não depende de nenhuma etapa pendente do Plano Mestre 2.
Base real: 1.4.2 (Dexie v8), linha `program/e1-relatorios` em `3ec5e43`.

## Problema medido na 1.4.2

`src/modules/weighing/domain/weighingCalculations.js` calcula:

```js
const gmd = dias > 0 ? Number((ganho / dias).toFixed(3)) : 0;
```

Sem piso de intervalo. Uma pesagem de conferência 2 dias depois gera GMD de vários kg/dia, e esse número
entra na folha, no gráfico, no Excel, no CSV e no PDF, além de puxar o GMD médio do lote e o `weightedGmd`.
O enchimento do trato digestivo vale cerca de 5 % do peso vivo (20 a 26 kg num sobreano): num intervalo de
7 dias isso é ±3 kg/dia de GMD inventado; em 28 dias cai para ~0,8; em 56 dias ~0,4. É por isso que a
Datamars, mesmo com várias pesagens por dia, usa janela de 21 dias e só mostra o ADG depois de 28.

Além disso: o GMD usa só 2 pontos (atual e anterior mais recente), não existe tratamento de valor fora da
curva (um "480" digitado "4800" entra em tudo) e não existe ação explícita de repesagem no mesmo dia.

## Resultado esperado

Nenhum número de GMD mentiroso sai do app. GMD passa a ter QUALIDADE declarada, existe um GMD por regressão
para quem tem 3 ou mais pesagens, as pesagens fora da curva aparecem numa lista para conferir, e as duas
arrobas do produto (peso vivo e carcaça) nunca mais podem ser somadas na mesma coluna.

---

## 1. Qualidade do GMD (regra de intervalo)

### 1.1 Contrato (CONGELADO — os outros agentes dependem dele)

`calculateWeightGain({ history, date, weight, diasMinimos })` passa a devolver DOIS campos novos, sem
remover nem renomear nenhum existente:

```js
{
  dataAnterior, pesoAnterior, dias, ganho, gmd,   // iguais à 1.4.2
  gmdQualidade,   // 'CONFIAVEL' | 'NAO_CONFIAVEL' | 'SEM_GMD'
  gmdMotivo       // null | 'intervalo curto (N dias)' | 'sem pesagem anterior'
}
```

Regras:

| Situação | gmdQualidade | gmd | Exibição | Entra em média/agregado |
|---|---|---|---|---|
| Sem pesagem anterior com peso | `SEM_GMD` | `null` | `-` | não |
| `dias` entre 1 e `diasMinimos − 1` | `NAO_CONFIAVEL` | valor calculado | cinza + aviso "intervalo curto (N dias)" | **não** |
| `dias >= diasMinimos` | `CONFIAVEL` | valor calculado | normal | sim |

- `gmd` deixa de ser `0` quando não há cálculo possível: passa a ser `null` (0 é um número e mente).
- `diasMinimos` vem de Configurações › Relatórios, campo novo `gmd_dias_minimos`, opções **7, 14, 21, 28**,
  **padrão 21**. Ausente ou inválido → 21.
- O FATO gravado não muda: `pesagens.gmd` continua recebendo o valor calculado. A qualidade é DERIVADA,
  calculada na leitura. Nenhuma migração, nenhum backfill.

### 1.2 Onde a qualidade tem de ser respeitada

1. Folha de todos os relatórios (coluna GMD), subtotal, total e "Calcular" do cabeçalho interativo.
2. `weightedGmd` e qualquer agregação de GMD: só somam ganho e dias de intervalos `CONFIAVEL`.
3. Rodapé no padrão que a 1.4.2 já usa: **"GMD de N de M cab."** quando N < M.
4. Gráficos de GMD (GMD por grupo, faixas de GMD): só `CONFIAVEL`.
5. Ficha do animal (curva e tabela) e Lançamento (faixa de desempenho do animal).
6. CSV, XLSX e PDF: paridade com a tela, incluindo o aviso e o rodapé.
7. Qualidade dos dados: "Manejo sem GMD" passa a mostrar também o motivo `intervalo curto`.

### 1.3 Mudança visível ao usuário (registrar no CHANGELOG como **Changed**)

Relatórios de períodos com pesagens muito próximas vão mostrar GMD médio DIFERENTE da 1.4.2 — porque agora
o intervalo curto não entra na média. Isso é correção, não regressão, e tem de estar escrito em
`docs/user/RELATORIOS.md` e nas notas da versão, com a frase simples: "GMD de intervalo menor que 21 dias
aparece em cinza e não entra na média, porque o enchimento do boi atrapalha a conta".

---

## 2. GMD por regressão (3 ou mais pesagens)

Novo arquivo puro `src/modules/weighing/domain/weightRegression.js`, sem Dexie e sem React.

```js
computeWeightedGmd(points, { janelaDias = 120, tauDias = 60, hoje })
// points: [{ data: 'YYYY-MM-DD', peso: Number }]  (já limpos, só CONFIAVEL/úteis)
// → { gmd, n, diasCobertos, erroPadrao, qualidade }  |  null quando não dá
```

- Janela: só pesagens dos últimos `janelaDias` (120) a contar de `hoje`.
- Peso de cada ponto por recência: `w = Math.exp(-idadeEmDias / tauDias)` (meia-vida ≈ 42 dias).
- Inclinação por mínimos quadrados ponderados, com médias ponderadas de dia e peso:
  `b = Σ w·(d − d̄w)·(p − p̄w) / Σ w·(d − d̄w)²`.
- `erroPadrao` a partir da variância residual ponderada; piso de 0,08 kg/dia (vai ser usado na previsão, na
  M3; aqui só precisa estar calculado e testado).
- Com 2 pontos: devolve a conta simples (equivale à reta por 2 pontos).
- Com menos de 2 pontos, ou `diasCobertos < 14`: devolve `null` com `qualidade: 'SEM_GMD'`.

Entrega na interface: coluna **"GMD (regressão)"** disponível em "Adicionar coluna…" nos relatórios de
ANIMAL_PERIOD e ANIMAL_CURRENT, e na ficha do animal. **Não** entra no padrão de nenhum relatório —
o GMD entre pesagens consecutivas continua sendo o padrão, para a folha não mudar de significado sozinha.

---

## 3. Pesagem suspeita (valor fora da curva)

Novo arquivo puro `src/modules/weighing/domain/weightOutliers.js`.

```js
medianAbsoluteDeviation(values)      // mediana e MAD
classifyWeighing({ pesoAtual, pesoAnterior, dias, gmd, gmdMedianaLote, madLote })
// → { classe, motivo }
// classe: 'OK' | 'SUSPEITA_ERRO' | 'SUSPEITA_LOTE' | 'PERDA_POSSIVEL'
```

Regras, na ordem:

1. `SUSPEITA_ERRO` — variação absoluta de peso maior que **25 %** do peso anterior; ou perda maior que
   **10 %** do peso vivo em menos de **14 dias**. Motivo: "provável erro de balança ou digitação".
2. `SUSPEITA_LOTE` — `|gmd − gmdMedianaLote| > 3,5 × 1,4826 × madLote` (MAD robusto do lote no mesmo
   período, com no mínimo 8 animais no lote; menos que isso não classifica). Motivo: "fora da curva do lote".
3. `PERDA_POSSIVEL` — perda de até 5 % do peso vivo em até 28 dias, animal presente e sem evento de saída.
   Motivo: "perda possível — verificar sanidade". **Não** é erro: é alerta de manejo.
4. `OK` — o resto.

### Interface: aba Controle › "Pesagens para conferir"

Reaproveitar o `ReportView` como as outras listas de Manutenção › Controle. Colunas: animal, data, peso,
peso anterior, dias, ganho, GMD, classe, motivo, lote, operador, origem. Ordenável e exportável.

Ações por linha (usando o que já existe, sem esquema novo):
- **Corrigir** → abre o fluxo de cancelamento com motivo + novo lançamento já existente.
- **Ver ficha do animal**.

### DECISÃO DESTA ETAPA (importante)

Nesta etapa a pesagem suspeita é **apontada, não excluída**: ela continua entrando nas médias. Excluir
exigiria gravar a resolução ("perda real" x "erro") e isso é campo novo, logo esquema — vai na M2 junto com a
condição da pesagem. Motivo: se a exclusão entrar antes da resolução, uma perda REAL fica fora da conta para
sempre e ninguém consegue trazer de volta. Registrar isso no REPORT.

---

## 4. Repesagem no mesmo dia

No Lançamento, ao gravar peso de um animal que **já tem pesagem com peso na mesma data**:

- Diálogo ModeloBase1, botão grande, texto de curral: **"Esse animal já foi pesado hoje. Repesar?"**
  - **Repesar (substitui)** → cancela a pesagem anterior de hoje com motivo "repesagem" (fluxo de
    cancelamento que já existe, com auditoria) e grava a nova.
  - **Cancelar** → não grava nada.
- Nunca calcular GMD entre duas pesagens do mesmo dia (já é o comportamento: a busca do anterior usa
  `entryDate < currentDate`). Acrescentar teste que garante isso.

---

## 5. As duas arrobas não se somam

O produto já tem, corretamente, DUAS arrobas (não unificar, não escolher uma):

| Arroba | Onde | Conta | Rótulo obrigatório |
|---|---|---|---|
| @ de **peso vivo** | relatórios, `arroba_divisor` (15 ou 30, padrão 30, Configurações › Relatórios) | `peso ÷ divisor` | "@ de peso vivo (÷ 30)" — o divisor em uso aparece no rótulo |
| @ de **carcaça** | comercial, `quantidade_arrobas` | `peso × rendimento% / 100 ÷ 15` | "@ de carcaça" |

Tarefas:

1. Revisar TODOS os rótulos de coluna, cabeçalho de folha, Excel, CSV e PDF: nenhuma coluna de arroba pode
   se chamar só "@" ou "Arrobas". O divisor em uso tem de estar visível no rótulo da @ de peso vivo.
2. Proibição dura: subtotal, total, "Calcular" e "Adicionar coluna…" **não podem** somar, mediar ou totalizar
   uma coluna de @ de peso vivo junto com uma de @ de carcaça. Se as duas estiverem na mesma folha, cada uma
   tem seu próprio total.
3. Em Configurações › Relatórios, texto de ajuda de uma linha explicando a diferença, em linguagem de curral:
   "@ de peso vivo é o peso do boi dividido por 30 (ou 15). @ de carcaça é o que o frigorífico paga:
   peso × rendimento ÷ 15."
4. Rendimento: manter a ordem de origem que já existe (informado > padrão da empresa > padrão do parceiro) e
   continuar devolvendo vazio quando não houver rendimento. **Não** inventar 50 %.

---

## 6. Gates novos (registrar em `test:quick`)

| Gate | Cobre |
|---|---|
| `weighing:interval-rule:verify` | 3 estados de qualidade; limites 7/14/21/28; `dias = 0`; sem anterior; `gmd null` em vez de 0; `gmd_dias_minimos` inválido cai em 21 |
| `weighing:regression:verify` | 2, 3 e 6 pontos; ponderação por recência; janela de 120 dias; erro padrão com piso; `null` com menos de 2 pontos ou menos de 14 dias |
| `weighing:outlier:verify` | 25 %; 10 % em 14 dias; MAD com e sem os 8 animais mínimos; perda possível; ordem das regras |
| `reports:gmd-confiabilidade:verify` | média, subtotal, total, `weightedGmd`, gráficos e rodapé "GMD de N de M cab." ignoram `NAO_CONFIAVEL`; paridade tela / CSV / XLSX / PDF |
| `reports:arroba-rotulos:verify` | nenhuma coluna "@" sem qualificação; divisor no rótulo; proibição de total misto |
| `weighing:repesagem:verify` | diálogo, cancelamento com motivo "repesagem", auditoria, GMD não usa o mesmo dia |

Gates existentes que vão precisar de ajuste (ampliar, nunca enfraquecer): `weighing:calculations:verify`,
`reports:gmd:verify`, `reports:weighted-gmd:verify`, `animal:weight-curve:verify`, `reports:charts:verify`.

---

## 7. Aceite humano (a responsável testa no app instalado)

1. Pesar um animal hoje e repesar o MESMO animal amanhã: o GMD aparece em cinza com "intervalo curto
   (1 dia)" e o GMD médio do lote **não muda** por causa dele.
2. Trocar `gmd_dias_minimos` para 28: um intervalo de 21 dias passa a cinza; voltar para 21 e ele volta ao
   normal.
3. Animal com 4 pesagens: acrescentar a coluna "GMD (regressão)" e conferir que o valor fica entre o menor e
   o maior GMD dos intervalos.
4. Digitar 4800 em vez de 480: a pesagem aparece em Controle › "Pesagens para conferir" como provável erro,
   e o botão Corrigir abre o cancelamento.
5. Numa folha com as duas arrobas, cada uma tem seu total e os rótulos dizem qual é qual.
6. Exportar a mesma folha em CSV, Excel e PDF: mesmos números, mesmos avisos, mesmo rodapé.

---

## 8. O que NÃO entra nesta etapa

- Nenhuma mudança de esquema (condição de pesagem, metas por época e estado materializado são a M2).
- Nenhuma previsão de peso, data de alvo ou farol (M3).
- Nada de sanidade (M4), balança (M5) ou atualizador (M6).
- Nada de visual: layout, CSS, cor, posição de botão, navegação. A única exceção é o cinza do GMD não
  confiável e o diálogo de repesagem, que são comportamento — use o que já existe no ModeloBase1 e, se
  faltar algo, registre no REPORT como "precisa da trilha visual".
