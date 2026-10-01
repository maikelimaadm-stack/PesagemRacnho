# REPORT — E1G GMD em todos os relatórios e gráficos de peso e ganho (versão 1.4.2)

**ETAPA:** E1G, pedido direto da responsável em 30/09/2026 (`docs/plano-mestre/E1G-GMD-E-GRAFICOS.md`).
**VERSÃO:** **1.4.2**, esquema Dexie 8 e backup formato 3, sem mudança. **BRANCH:** `program/e1-relatorios`, de
`2c6bd0d` até o build em `ad4e752`, mais o commit deste REPORT; a main continua em `6cccb5f`.

**STATUS: CONCLUÍDA.** test:quick integrado com 102 passos: 99 verdes no primeiro giro. Os 2 de release
estavam vermelhos porque o build ainda era o da 1.4.1, e ficaram verdes depois do build. O `reports:charts`
foi corrigido (ver §2). Instalador **Setup 1.4.2** gerado e copiado para `..\INSTALAR-ESTE-1.4.2\`.

## 1. Por que o GMD não aparecia (diagnóstico com massa de TESTE)

1. **Desempenho:** contava só as pesagens DENTRO do período e exigia 2 nele. Quem pesa por aparte, com meses
   entre as pesagens, ficava sem GMD no relatório inteiro.
2. **A folha escondia a coluna GMD** quando nenhuma linha tinha valor, em vez de mostrar "-".
3. **Rebanho atual** não tinha GMD.
4. **Venda e abate com peso** nunca recebiam GMD.
5. **Importação:** o mesmo brinco escrito de outro jeito ("01016", "1016,0") virava animal NOVO, o que partia
   a série e deixava o GMD vazio.

Os dados reais não foram abertos. Para saber se o caso 5 aconteceu com os seus dados, veja **Qualidade dos
dados › Números parecidos** (item novo).

## 2. O que foi feito

**GMD**
- Venda/abate com peso: ganho e GMD desde a última pesagem. Na primeira abertura da 1.4.2, o programa recalcula
  uma vez esses campos. Ele regrava só o que muda, nada é apagado e o recálculo fica na auditoria como "Sistema".
- Desempenho: o peso inicial é a última pesagem antes do período. Agora o GMD bate com o de Pesagens.
- Dias, Ganho e GMD nunca somem da folha; o rodapé diz "GMD de N de M cab." quando falta para alguém.
- Rebanho atual: Peso e Data de entrada, Ganho/Dias/GMD desde a entrada e Último GMD; "GMD médio" nos resumos.
- Qualidade dos dados: "Animal com uma pesagem só", "Manejo sem GMD" (com o motivo) e "Números parecidos".
- Importação:
  - "01016", "1016,0" e "1016.0" casam com o 1016; "1.000" (milhar) não casa com o 1;
  - "Dt.Ant." e "Peso Ant." são reconhecidos;
  - histórico anterior ao Cadastro: a pesagem mais antiga vira o Cadastro, com aviso antes de gravar.

**Gráficos** (SVG próprio, sem biblioteca, funcionam sem internet; mesmos números da folha)

| Relatório | Gráficos |
|---|---|
| Pesagens | Evolução do peso médio · GMD por grupo · Ganho e @ por mês · Distribuição do peso |
| Desempenho | GMD por grupo · Peso inicial × final · Animais por faixa de GMD · Distribuição do peso final |
| Rebanho atual | Distribuição do peso atual · GMD médio por lote |
| Ficha do Animal | Curva de peso com as datas na escala certa e GMD de cada trecho |

Botão **Folha | Gráficos**:
- tem dica, legenda que liga e desliga séries e "Ver tabela";
- o clique numa barra abre a folha daquele grupo;
- funciona em tema claro e escuro.

Impressão/PDF com "gráficos + folha" ou "só os gráficos"; Excel com aba "Gráficos".

Capturas (massa de TESTE):
- `graficos-pesagens-claro.png` e `graficos-pesagens-escuro.png`;
- `graficos-desempenho.png`;
- `graficos-rebanho.png`;
- `ficha-curva-de-peso.png`: a venda aparece com 463 dias, +12 kg e GMD 0,026;
- `pdf-graficos-pesagens.png`.

**Como foi feito:**
- 3 trilhas em paralelo, cada uma com um revisor que achou e corrigiu bugs:
  - "1.000" casava com o animal 1;
  - recálculo regravava o histórico inteiro dos vendidos;
  - leitura lenta do Rebanho;
  - detalhe pelo gráfico trocava o detalhe aberto;
  - texto técnico na tela.
- Na integração, corrigi:
  - a mesma regra de "número parecido" na Qualidade dos dados;
  - o gate `reports:gmd`, que dependia do dia: virou 01/10 durante o teste;
  - o gate `reports:charts`, que esperava GMD diferente entre Pesagens e Desempenho — agora os dois dão o
    mesmo, como pedido.

## 3. Gates e instalador

| Comando | Resultado |
|---|---|
| `npm run test:quick` (102 passos) | verde, depois do build e da correção do `reports:charts` |
| Gates novos | `reports:gmd`, `import:identity`, `reports:charts`, `reports:charts-print`, `reports:charts-state`, `animal:weight-curve` — verdes, com casos negativos |
| `dist:unsigned` / `release:current-only:verify` / `release:version-contract:verify` | OK |

**Instalador 1.4.2:**
- `C:\Users\maike\Desktop\projeto\INSTALAR-ESTE-1.4.2\Pesagens Individuais Setup 1.4.2.exe`
- 92.236.751 bytes
- **SHA-256 `779a34ec8f0725822feb5e6ea9daff7dee985122355fc834831f69c9a47abb0a`**, igual ao do `.sha256`, do manifesto e da cópia
- manifesto: `appVersion 1.4.2`, `gitCommit ad4e752`, sem "-dirty"

## 4. Pendências e perguntas

1. **Limpeza da pasta (pedido anterior):** apagar instaladores antigos e pastas temporárias foi bloqueado pela
   proteção do sistema. A lista para apagar à mão foi entregue no chat. Agora entra também
   `INSTALAR-ESTE-1.4.1`, se a 1.4.2 for instalada.
2. Animal que passa por Manejo e é vendido **no mesmo dia**: a venda compara com a pesagem anterior ao dia, e o
   ganho desse animal conta duas vezes no GMD médio de Pesagens. Quer que a venda no mesmo dia de um Manejo
   compare com esse Manejo?
3. "Animal com uma pesagem só" também lista os animais SN (sem número), que por natureza têm uma pesagem só.
   Quer escondê-los desse apontamento?
4. Fora desta etapa: gráfico nativo do Excel, meta/farol de GMD (E7) e "categoria no início do período".
5. As perguntas dos REPORTs da E1D e da E1E continuam abertas.
