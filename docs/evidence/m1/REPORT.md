# REPORT — M1 Fundação do número

```
ETAPA: M1 — Fundação do número (GMD confiável, regressão, pesagem suspeita)
VERSÃO: 1.5.0          BRANCH: program/m1-fundacao-numero (a partir de program/e1-relatorios 3ec5e43)
STATUS: CONCLUÍDA
```

Pré-requisito: o registro do Windows desta máquina ainda mostra a **1.4.0 instalada**, e não a 1.4.2. A v1 do prompt
parou nesse ponto. A v2 manda executar, e por isso a etapa seguiu; o pré-requisito fica registrado aqui. Pasta conferida:
`C:/Users/maike/Desktop/projeto/MAKGESTAO-main`, branch `program/e1-relatorios`, commit `3ec5e43`. Primeiro commit da
etapa: `8acd1b7` (especificação e prompt).

**main e fast-forward:** a `main` está em `6cccb5f`, atrás da linha da 1.4.2. Ela é ancestral de
`program/m1-fundacao-numero` (ff possível, sem conflito). Para avançar seria preciso a autorização da responsável e
`git merge --ff-only program/m1-fundacao-numero` estando na `main`. Nesta etapa a main não avançou e nada foi enviado
(push).

## 1. O que foi feito

- **GMD com qualidade.** Todo GMD agora diz se é **confiável**, **não confiável** (intervalo curto) ou **sem GMD**.
  - GMD de intervalo menor que o mínimo (padrão **21 dias**) aparece **em cinza** com o aviso "intervalo curto (N dias)".
    Ele fica **fora** de todas as contas: média, GMD ponderado, subtotal, total, "Calcular", Matriz, linhas de resumo e
    gráficos.
  - O rodapé diz "GMD de N de M cab.".
  - Quando não há conta, o GMD é **null**, nunca 0.
  - O que está gravado no banco **não mudou**: a qualidade é calculada na leitura.
- **Intervalo mínimo do GMD** em Configurações › Relatórios: 7, 14, 21 ou 28 dias, padrão 21, para ADMIN e GESTOR.
  Valor inválido vira 21.
- **GMD (regressão)**: coluna opcional, nunca no padrão. Fica em "Adicionar coluna…" do Desempenho e do Rebanho atual,
  e na Ficha do Animal.
  - Conta: mínimos quadrados ponderados por recência (exp(−idade/60)) nos últimos 120 dias.
  - Num animal com 4 pesagens, o valor fica entre o menor e o maior GMD dos intervalos. O gate confere isso em 400
    animais de teste.
- **Pesagens para conferir** (Manutenção › Controle; OPERADOR e CONSULTA em Relatórios › Controle). Aponta três
  casos:
  - provável erro de balança ou digitação: mais de 25 %, ou perda acima de 10 % em menos de 14 dias;
  - fora da curva do lote: MAD robusto, lote com pelo menos 8 animais;
  - perda possível: até 5 % em até 28 dias.

  Cada linha tem **Corrigir** (abre a pesagem para editar no Lançamento, com auditoria) e **Ver ficha do animal**.
  **Só aponta: nada sai das médias nesta etapa.** A exclusão entra na M2, junto com a resolução gravada (decisão 3).
  "Qualidade dos dados › Manejo sem GMD" mostra também "intervalo curto (N dias)".
- **Repesagem no mesmo dia** (Lançamento): a pergunta é **"Esse animal já foi pesado hoje. Repesar?"**.
  - **Repesar (substitui)** cancela a pesagem de hoje com o motivo "repesagem" (fica na auditoria) e grava a nova numa
    única transação.
  - **Cancelar** não grava nada.
  - O GMD nunca é calculado entre duas pesagens do mesmo dia; o gate confere.
- **As duas arrobas com nome.** Toda coluna de arroba diz qual é, em tela, folha, Excel, CSV e PDF:
  - **"(@ vivo ÷30)"**, com o divisor em uso;
  - **"(@ carcaça)"**.

  O total misto é **recusado** no motor e no menu do cabeçalho. A ajuda de uma linha está em Configurações ›
  Relatórios. Sem rendimento, a @ de carcaça fica vazia (nada de 50 % inventado).
- **Paridade.** CSV e XLSX ganham a coluna **"Aviso do GMD"**. O XLSX traz o GMD em cinza e o rodapé. O PDF tem o
  cinza e a nota do rodapé.
- **Faixa do animal no Lançamento, Ficha do Animal e Relação de Pesagens.** O GMD de intervalo curto aparece apagado
  e fica fora do GMD médio.

**Como foi feito:**
- O integrador congelou o contrato antes de soltar os agentes: `gmdQuality.js` (três estados, motivos, opções e o
  formatador compartilhado `gmdExibicao`), o campo `gmd_dias_minimos` e a interface da regressão.
- Quatro agentes trabalharam em paralelo, em cópias separadas, cada um dono dos seus arquivos: A domínio, B pesagem
  suspeita, C apresentação, D repesagem e Configurações. As arrobas foram feitas logo depois do C, no mesmo trabalho.
- A integração seguiu a ordem A → C → B → D. Os pedidos entre agentes (arquivo de um, mudança pedida por outro) foram
  aplicados pelo integrador.

**Evidências (massa de TESTE):**
- `m1-pesagens-analitico.pdf` e `m1-desempenho-analitico.pdf`: GMD em cinza nos intervalos de 5 e 10 dias e o rodapé
  "GMD de 5 de 9 cab. · GMD em cinza = intervalo menor que 21 dias: não entra na média".
- `*-p1.png`: imagem da 1ª página de cada PDF.
- Conferido à mão: o GMD geral do Desempenho, 0,583, é (9+8+56+64+24) ÷ (56+63+49+45+63) = 161 ÷ 276. Usa só os 5
  animais confiáveis.

## 2. Arquivos criados / alterados

Novos:
- `src/modules/weighing/domain/gmdQuality.js` (contrato), `weightRegression.js`, `weightOutliers.js`, `repesagem.js`;
- `src/modules/reporting/domain/gmdColumns.js` e `arrobaColumns.js`;
- gates `scripts/verify-weighing-interval-rule.mjs`, `verify-weighing-regression.mjs`, `verify-weighing-outlier.mjs`,
  `verify-reports-gmd-confiabilidade.mjs`, `verify-reports-arroba-rotulos.mjs` e `verify-weighing-repesagem.mjs`.

Alterados:
- `weighingCalculations.js`, `weighingService.js` e `weighingDataAdapter.js` (motivo opcional no cancelamento,
  repesagem);
- `appConfigService.js` (`gmd_dias_minimos`);
- motor de relatórios: fontes, agregações, folha, cabeçalho interativo, gráficos, exportadores, definições e colunas;
- `ReportView.jsx`, `ReportTable.jsx`, `reportUi.js`, `FichaAnimal.jsx`, `animalWeightCurve.js`;
- `LancamentoPesagensIndividuais.jsx`, `weightPreview.js`, `Configuracoes.jsx` e `PesagensIndividuais.jsx` (Relação);
- `controle.js` e `controlSources.js`;
- versão 1.5.0 (`package.json`, lock, `appVersion.js`);
- docs: `RELATORIOS.md`, `GUIA-RAPIDO.md`, `USUARIOS.md`, `INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md`;
- `CHANGELOG.md` e `docs/release/1.5.0/`.

## 3. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` (108 passos, rodado UMA vez, após a integração) | **104 verdes, 4 vermelhos** (ver abaixo) |
| `release:current-only:verify` / `release:version-contract:verify` | vermelhos no test:quick porque o build ainda era o 1.4.2; **verdes** depois do `dist:unsigned` 1.5.0 |
| `reports:relation-parity:verify` | vermelho no test:quick: o gate conferia o texto antigo da carga da Relação, que o integrador mudou de propósito (mínimo do GMD); gate ajustado → **verde** |
| `reports:arroba-rotulos:verify` | vermelho no test:quick: "Pesagens para conferir" (agente B) também tem colunas de arroba e não estava na lista do gate das arrobas (escrito em paralelo); incluído e conferido → **verde** |
| Gates novos: `weighing:interval-rule`, `weighing:regression`, `weighing:outlier`, `reports:gmd-confiabilidade`, `reports:arroba-rotulos`, `weighing:repesagem` | **verdes**, todos com casos negativos (os agentes provaram que o código anterior reprova) |
| Ampliados: `weighing:calculations`, `reports:gmd`, `reports:weighted-gmd`, `animal:weight-curve`, `reports:charts` | verdes |
| `npm run lint` | verde |
| `reports:performance:verify` (massa de 36 mil; fora do quick e do full) | **verde** rodando sozinho. Pesagens 365 dias: p95 1,36 s; Rebanho: 1,16 s; Desempenho: 1,01 s; CSV de 365 dias: 0,38 s (na 1.4.2 eram 0,78 s). Numa 1ª rodada o CSV deu 2,9 s, porque eu rodava outros 6 gates ao mesmo tempo; a 1.4.2 medida na mesma máquina passou, e o CSV medido isolado leva 13 ms. Não é regressão. |
| `dist:unsigned` | OK |

Os dois ajustes de gate mexeram só no gate, não no código. Os dois gates foram rodados de novo, sozinhos, e ficaram
verdes. O `test:full` não foi rodado, como o prompt pede (nada de esquema mudou).

**Instalador 1.5.0:**
- `C:\Users\maike\Desktop\projeto\INSTALAR-ESTE-1.5.0\Pesagens Individuais Setup 1.5.0.exe`
- 92.249.245 bytes
- **SHA-256 `328289188524d85478b23efa539aca3d1a303a3d24de91554f964c97651ccdba`**, igual ao do `.sha256`, do manifesto e
  da cópia
- manifesto: `appVersion 1.5.0`, `gitCommit 4145e31`, sem "-dirty"

## 4. Migração

Nenhuma. Esquema Dexie 8 e backup formato 3, sem mudança. Nenhum campo novo é gravado:
- a qualidade do GMD é derivada na leitura;
- o motivo "repesagem" vai no campo `motivo` da auditoria, que já existe;
- `gmd_dias_minimos` é uma chave a mais no `report-settings`, que já existe (ausente = 21).

## 5. O que NÃO foi feito e por quê

- **Pesagem suspeita não sai das médias**, por decisão 3: a exclusão exige gravar a resolução, que é esquema (M2).
- Farol, previsão, sanidade, balança, atualizador e nada das etapas M2 a M6.
- "@ de carcaça produzida": o gráfico "@ produzidas" continua sendo **@ de peso vivo** e agora diz isso no rótulo. A
  troca da fórmula é a decisão D2 do plano e a M1 §5 só pede rótulo (ver pergunta 7).
- O CSV do rodapé do Lançamento (`exportWeighingCsv`, contrato de reimportação) continua sem a coluna de aviso (ver
  pergunta 10).
- Trilha visual: nada de layout. **Precisa da trilha visual:**
  - token ou classe única para o "cinza do GMD": hoje usa as cores que já existiam (folha `--mk-gray-500`, grade
    `text-muted-foreground`, faixa do Lançamento com opacidade .45);
  - botão grande do diálogo de repesagem: o rodapé padrão fixa 28 px;
  - coluna ⋮ de ações na grade de Controle;
  - cabeçalhos de arroba mais longos ("Média (@ vivo ÷30)") na folha em retrato;
  - KPI do GMD (regressão) na Ficha: hoje é texto na legenda da curva;
  - cartão de Configurações › Relatórios com dois campos e duas linhas de ajuda.

## 6. Riscos e pendências

- **Mudança visível:** períodos com pesagens próximas mostram GMD médio diferente da 1.4.2. Está no CHANGELOG, nas
  notas da versão e em RELATORIOS.md.
- Os nomes de coluna de arroba mudaram no CSV, XLSX e JSON (ex.: "Peso em arrobas (@)" → "Peso (@ vivo ÷30)"). Quem
  lê esses arquivos pelo nome precisa ajustar.
- A repesagem usa uma transação com sub-transações (provada só com fake-indexeddb). Precisa do aceite no app instalado.
- "Manejo sem GMD" por intervalo curto pode encher a Qualidade dos dados em fazenda com pesagens diárias (pergunta 9).
- Teste físico (balança, impressora, curral): **não executado**. Fica para a responsável, no app instalado.

## 7. Como a responsável testa (no app instalado — antes, instalar a 1.4.2 ou direto a 1.5.0, com backup)

1. Faça o backup em Backup e Manutenção e instale o **Setup 1.5.0** por cima. A barra mostra **v1.5.0**.
2. Pese um animal hoje e repese o MESMO animal amanhã. No relatório de Pesagens (Analítico), o GMD dele aparece **em
   cinza** com "intervalo curto (1 dia)", e o GMD médio do lote **não muda** por causa dele.
3. Configurações › Relatórios › **Intervalo mínimo do GMD** = 28: um intervalo de 21 dias passa a cinza. Volte para 21
   e ele volta ao normal.
4. Desempenho › Adicionar coluna… › **GMD (regressão)** num animal com 4 pesagens: o valor fica entre o menor e o maior
   GMD dos intervalos.
5. Lance 4800 em vez de 480. Em Manutenção › Controle › **Pesagens para conferir**, ela aparece como "provável erro de
   balança ou digitação"; **Corrigir** abre a pesagem no Lançamento e **Ver ficha do animal** abre a ficha.
6. No Lançamento, lance de novo o peso de um animal já pesado hoje: aparece **"Esse animal já foi pesado hoje.
   Repesar?"**. Repesar substitui; Cancelar não grava.
7. Numa folha com as duas arrobas (ex.: Comercial com carcaça e peso vivo), cada uma tem o seu total e os rótulos
   dizem qual é qual.
8. Exporte a mesma folha em CSV, Excel e PDF: mesmos números, coluna "Aviso do GMD" e o mesmo rodapé "GMD de N de M
   cab.".

## 8. Perguntas para a responsável

1. **Aviso de GMD alto no Lançamento** (acima de 5 kg/dia): ele continua aparecendo num intervalo curto (ex.: repesar
   no dia seguinte, de 400 para 408 kg = 8 kg/dia). Suprimir esse aviso quando o intervalo é curto?
2. **Corrigir** abre a edição auditada da pesagem no Lançamento. O aceite 4 diz "abre o cancelamento". Quer que abra
   direto o diálogo de exclusão (cancelamento)?
3. **Perda possível**, ao pé da letra (até 5 % em até 28 dias): perda de 5 a 10 % em menos de 14 dias, ou de 5 a 25 %
   com 14 dias ou mais, fica sem aviso. Toda perda que não é erro deveria virar "perda possível"?
4. **MAD do lote = 0** (metade ou mais do lote com o mesmo GMD): qualquer diferença viraria "fora da curva". Pular a
   regra nesse caso, ou pôr um piso?
5. A **repesagem** vale só para Manejo sobre Manejo. Venda/abate no mesmo dia de um Manejo, e Cadastro de hoje,
   continuam recusados (o peso do Cadastro se corrige com Editar). E as aplicações de sanidade da pesagem de hoje são
   canceladas junto: preferem que passem para a pesagem nova?
6. **Ordenar e filtrar por GMD** usam o número que aparece, inclusive o cinza (um GMD de 2 dias, 5,0, fica no topo de
   "GMD (Maior)"). O cinza deve ir para o fim, junto com os "sem GMD"?
7. **"@ de carcaça produzida"** (D2): o gráfico "@ produzidas" ainda é @ de peso vivo (agora rotulado). Trocar para a
   fórmula de carcaça numa próxima etapa? E o "Valor @" das Vendas: hoje Valor Total = Qtd (@ vivo ÷30) × Valor @, e com
   o divisor 15 o valor dobra. De qual arroba é esse preço?
8. **Rótulo curto das arrobas**: "(@ vivo ÷30)" e "(@ carcaça)" em todo lugar. As formas da tabela da spec ficaram nas
   descrições, porque rótulo que começa com "@" ganha apóstrofo no CSV. Confirma?
9. "Manejo sem GMD" por **intervalo curto** está com gravidade MÉDIA. Em fazenda com pesagens diárias, isso enche a
   Qualidade dos dados. Prefere BAIXA?
10. O **CSV do rodapé do Lançamento** (reimportável) deve ganhar o aviso do GMD também, ou fica como contrato de
    reimportação?
11. **Regressão com 2 pontos**: o erro padrão sai no piso (0,08), porque não há resíduo. Para a previsão da M3, deve
    ser "não estimável"?
12. GMD (regressão) no **Desempenho**: a janela de 120 dias conta a partir do **fim do período**; no Rebanho e na Ficha,
    de **hoje**. Confirma?
