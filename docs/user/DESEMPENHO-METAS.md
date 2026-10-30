# Desempenho, metas e projeções

## Painel de Desempenho (Relatórios › Desempenho)

Escolha a **janela** (de/até) e até **duas** formas de agrupar: raça, sexo, era, categoria produtiva, lote,
origem, estação ou propriedade. Depois clique em **Calcular**.

O painel responde:

- **Quem rende mais.** Para cada grupo, o painel mostra:
  - quantos animais e quantos intervalos entraram;
  - os dias observados e o ganho total;
  - o **GMD ponderado** (ganho total ÷ dias);
  - a média e o intervalo de confiança do GMD individual;
  - quantos ganharam, perderam ou mantiveram o peso, e quantos ficaram sem GMD.
- **Grupo com amostra pequena.** Com menos de 3 animais com GMD, o grupo aparece como **"sem dados
  suficientes"**, nunca como zero, e fica fora do ranking.
- **Quem está perdendo peso agora.** É o último intervalo confiável de cada animal.
- **Seca.** O painel mostra quando ela começa e termina (pelo calendário) e quantos dias de seca cada lote
  teve.
- **Metas.** Mostra quantos animais estão acima, no alvo ou abaixo, sem amostra ou em **conflito** de metas.
- **Comparar com o ano anterior.** Mostra o GMD da mesma janela no ano anterior e a variação.

Regras do cálculo:

- O GMD usa só intervalos entre duas pesagens com pelo menos o **mínimo de dias** de
  **Configurações › Relatórios**.
- Cada intervalo conta para o lote, a era e a estação **do início** do intervalo.
- Um intervalo que atravessa estações (menos de 80% numa só) aparece como **"Mista"**.

Os botões **CSV**, **Excel** e **PDF** exportam exatamente as tabelas da tela.

## Projeção de peso

No fim do painel, escolha o animal e a data alvo.

- A projeção parte do **último peso real** do animal e soma, dia a dia, o GMD do cenário. Cada dia usa a
  estação do calendário da propriedade.
- Ela aparece nos cenários **conservador, base e otimista**, quando eles estão cadastrados.
- A projeção **nunca é gravada como pesagem**.

**Exemplo:** 300 kg em 01/01, janeiro a 0,200 kg/dia (31 dias = 6,2 kg) e fevereiro a 0,300 kg/dia (28 dias =
8,4 kg) dão **314,6 kg em 01/03**.

Duas pesagens, em 01/01 e em 01/03, dão o GMD do **intervalo**. Elas **não** dizem quanto o animal ganhou em
janeiro nem em fevereiro.

## Calendário de seca e águas (Sistema › Parametrização)

Cadastre o período de cada propriedade e ano: Águas, Transição ou Seca, com início, fim e **fonte** (configurado
ou observado).

- Períodos do mesmo escopo não podem se sobrepor.
- O período de uma propriedade prevalece sobre o de "todas as propriedades".
- Sem calendário, o painel mostra "sem calendário": nenhum período é inventado.

## Metas e cenários (Sistema › Parametrização)

Existem três tipos de meta:

- **GMD:** kg por dia;
- **Peso numa data:** por exemplo, 450 kg em 30/11;
- **Cenário de projeção:** GMD por estação, por mês ou um GMD único, em três versões: conservador, base e
  otimista.

Toda meta tem um escopo e uma vigência.

- **Precedência:** animal > lote > coorte (raça/sexo/era/estação) > propriedade > geral.
- **Conflito:** duas metas do mesmo nível para o mesmo animal aparecem como **CONFLITO**, e nenhuma é aplicada
  em silêncio. Para mudar uma meta, **encerre** a anterior com um motivo; o encerramento é auditado.
