# Relatórios

Os relatórios respondem às perguntas do dia a dia: **quantas cabeças tem em cada lote, quanto pesam,
quanto ganharam, quem saiu**. Desde a versão 1.4.0 eles abrem **resumidos** e aparecem na tela como
**a folha que sai na impressora**: cabeçalho da fazenda com o logo, seções por grupo, subtotais e total
geral. Os números da tela, da impressão, do PDF e dos arquivos são **sempre os mesmos**. O Excel (XLSX)
traz também o bloco "TOTAL POR" da folha; o CSV e o JSON trazem uma linha por grupo e o total geral; as
notas existem só na folha.

## 1. Abrir

1. No menu, clique em **Relatórios**. Abre direto a tela no estilo do MAKGESTAO, no último relatório que
   você usou (na primeira vez, em **Pesagens**).
2. Para ver outro, escolha no campo **Relatório**, o primeiro do quadro de filtros. Os relatórios aparecem
   separados por assunto: Rebanho, Pesagens, Desempenho, Movimentação, Saídas, Comercial, Embarques e, para
   OPERADOR e CONSULTA, Controle. Só aparecem os que o seu perfil pode abrir.
3. Cada relatório tem os seus **tipos**, no campo **Tipo Relatório** (item 5).

**Relatórios salvos:** no menu **⋯** (ao lado de Imprimir) fica **Salvar como meu relatório…**. Os relatórios
que você salvou abrem pelo próprio campo **Relatório**, no grupo **Meus relatórios**.

O relatório **lembra como você o deixou** (tipo, período, filtros, orientação, colunas): ao voltar nele,
abre do mesmo jeito. Isso vale só para o seu usuário. Links e modelos de versões anteriores continuam
abrindo.

## 2. Os relatórios

| Assunto | Relatório | Abre em | Tipos |
|---|---|---|---|
| Rebanho | **Rebanho atual** (1.4.2: com peso e data de entrada, ganho e GMD desde a entrada e último GMD; GMD médio nos resumos) | Por Lote | Por Lote, Por Apartação/Lote, Por Apartação, Por Categoria, Por Raça, Por Marca, Por Sexo, Por Situação, Por Faixa de Peso, Analítico (Lista de Animais), Sem Pesagem Recente |
| Rebanho | **Ocupação de lotes** | Por Apartação | Por Apartação, Por Apartação/Lote, Analítico |
| Pesagens | **Pesagens** (Relatório de Pesagens Individuais) | Por Apartação (Resumo por Data) | Os 5 tipos do MAKGESTAO: Analítico, Sintético (Matriz), Por Apartação/Lote, Por Apartação (Resumo por Data) e Vendas |
| Pesagens | **Fechamento do dia** | Por Sessão (Lista) | Por Sessão (Lista), Resumo por Sessão, Por Apartação/Lote, Com Pendências, Analítico |
| Desempenho | **Desempenho** (1.4.2: com **Dias Médios** nos resumos; os dias são sempre média, nunca soma) | Por Lote | Por Lote, Por Apartação/Lote, Por Apartação, Por Categoria, Por Raça, Por Marca, Por Sexo, Por Faixa de Peso, Analítico (Animal por Animal), Perdendo Peso |
| Movimentação | **Movimentação de lotes** | Por Lote | Por Lote, Por Apartação/Lote, Mudanças de Lote, Por Lote Anterior, Por Marca, Por Sexo, Analítico |
| Saídas | **Saídas** | Por Motivo | Por Motivo, Por Lote, Por Categoria, Por Marca, Por Data, Mortes por Causa, Mortes por Lote, Mortes por Categoria, Analítico, Mortes (Lista) |
| Comercial | **Comercial** (só ADMIN e GESTOR) | Vendas | **Vendas** (o relatório de venda do MAKGESTAO), **Abates** (por frigorífico) e **Compras** (por origem) |
| Embarques | **Romaneio de embarque** | Por Embarque/Documento | Por Embarque/Documento, Por Embarque, Romaneio (Lista por Documento), Analítico |
| Embarques | **Embarques: previsto × realizado** | Por Embarque | Por Embarque, Por Destino, Analítico |

"Vendas do período", "Abates do período" e "Compras do período" viraram os tipos do **Comercial**: links,
favoritos e modelos deles abrem o Comercial no tipo certo (a troca fica registrada na auditoria).

## 2A. Montar o relatório do seu jeito (1.4.1)

**Pelo título da coluna, na folha:** clique no título de qualquer coluna para abrir o menu:

| Opção | O que faz |
|---|---|
| **Ordenar** | Maior/menor primeiro (ou A-Z/Z-A) |
| **Calcular** | Troca a conta da coluna: Soma, Média, Mínimo, Máximo ou Contagem (só as que fazem sentido para ela). No Analítico, liga a conta nos subtotais e no total |
| **Agrupar por esta coluna** | Vira um nível de agrupamento (até 3), com subtotal |
| **Subtotal/Total desta coluna** | Põe a conta padrão da coluna na linha de subtotal e no TOTAL GERAL |
| **Ocultar coluna** | Tira a coluna da folha |
| **Adicionar coluna…** | Põe outra coluna ou total do relatório |

**Largura:** arraste a borda do título para alargar ou estreitar a coluna (duplo clique volta ao automático). A
largura vale também na impressão e no PDF e fica guardada.

**Mais filtros…:** no quadro de filtros, ao lado dos botões, lista todas as outras colunas do relatório (ex.:
Motivo da saída, Comprador, Peso). Escolha uma, marque os valores ou a condição, e ela vira um botão com contador.

**Colunas Painel / Colunas Detalhes / Colunas Visíveis:** marque, desmarque e arraste para mudar a ordem. Coluna
marcada aparece sempre na folha, mesmo sem valor no período (com "-"). A escolha fica guardada para cada tipo e
para o seu usuário.

**Novo relatório:** no fim do campo **Relatório**, clique em **➕ Novo relatório…**:
1. dê um **Nome** (ex.: "Pesagem por Marca");
2. escolha a **Base** (Pesagens, Rebanho atual, Desempenho, Saídas, Comercial…);
3. escolha **Quem vê**: "Só eu" ou "A empresa" (esta só para ADMIN e GESTOR).

Ele abre como um relatório ("Relatório de Pesagem por Marca"). Ajuste pelo título das colunas, pelos filtros e pelo
Tipo Relatório. Quando houver mudança, aparece **Salvar alterações** ao lado de Imprimir. No menu ⋯ ficam **Salvar
como…**, **Renomear** e **Excluir**. Os seus relatórios aparecem no campo **Relatório**, no grupo **Meus
relatórios**. Um relatório seu nunca mostra mais do que o seu perfil pode ver.

Se você mudou um relatório seu e tenta trocar de relatório ou voltar sem salvar, o programa pergunta
**Salvar as alterações?** — **Salvar e sair**, **Sair sem salvar** (volta como estava) ou **Cancelar**.
O Excel, o CSV e o PDF de um relatório seu saem com o nome dele (ex.: `pesagem-por-marca_….xlsx`, e a aba
e o título do Excel "Pesagem por Marca").

## 3. Resumido ou Detalhado

No alto da tela há o botão **Resumido | Detalhado**:

- **Resumido** — aparece como **a folha** (item 7): uma linha por grupo, com os totais em colunas,
  subtotal de cada seção e total geral. É exatamente o que sai na impressão e no PDF.
- **Detalhado** — todos os animais (ou pesagens) de cada grupo numa **grade** que dá para ordenar e
  filtrar pelo título da coluna, com o subtotal no fim de cada grupo. O botão
  **Ver como folha** (ícone de folha, ao lado) mostra o Detalhado no formato da impressão; clique de novo
  para voltar à grade.

**Clique num grupo da folha** (o título da seção, como "APARTAÇÃO: ENGORDA", ou o nome na linha, como
"E1") para ver só os animais dele no Detalhado. Aparece o selo **Detalhe: Apartação: Engorda**; o **x** do
selo volta ao Resumido.

**Ordenar o Resumido:** use **Ordenar por** na barra de filtros ou clique no título de uma coluna de
total da folha (ex.: GMD médio) — maior primeiro; clique de novo para inverter. Grupos de segundo nível
continuam dentro do seu grupo. A impressão e os arquivos saem na mesma ordem.

Sem nenhum agrupamento, a folha do Resumido mostra só o **Total geral** e a dica "Escolha Agrupar por"
(ou um Tipo de relatório) para ver os grupos.

## 4. A barra de filtros

**Todos os relatórios usam a tela do MAKGESTAO:** no alto, "Relatório de <nome>" e o botão verde
**Imprimir** (com Excel, PDF e o menu ⋯ ao lado); no quadro de filtros, **Data Início**, **Data Fim**,
**Orientação** (Retrato ou Paisagem), **Tipo Relatório**, **Ordenar Por** e **Pesagem Anterior** (nos relatórios de
pesagem), depois do campo **Relatório**; nos relatórios sem período (Rebanho atual, Ocupação de lotes) aparece
"Estado atual (hoje)" no lugar das datas. Os botões
**Lotes, Apartações, Sexo, Raças, Era, Marcas, Status** e **Limpar Filtros** (o botão mostra quantos estão
marcados, ex.: **Lotes (2)**). No Sintético aparecem **Linhas (Eixo Y)** e **Colunas (Eixo X)**; no Analítico,
**Agrupar Por** e **Colunas**; em Vendas, **Mostrar Detalhes**. Abaixo do quadro vem sempre a folha, do jeito
que sai na impressão.

Referência dos campos (a Manutenção › aba Controle continua com a barra abaixo):

| Campo | Para que serve |
|---|---|
| **Data início / Data fim** | O período (digite dd/mm/aaaa ou use o calendário) |
| **Período** | Atalhos: Hoje, Ontem, Últimos 7/30/90/365 dias, Mês atual, Mês anterior, Ano atual ou Personalizado |
| **Orientação** | Automática, Retrato ou Paisagem — vale para a folha na tela, a impressão e o PDF |
| **Tipo de relatório** | Os jeitos prontos de ver o relatório (item 5) |
| **Agrupar por** | Lote, Categoria, Raça, Marca… — a folha muda na hora |
| **Ordenar por** | Padrão do relatório, data (mais recente/mais antiga), nome do grupo ou um total (maior/menor) |
| **Pesagem anterior** | Todos, Com pesagem anterior ou Sem pesagem anterior (relatórios de pesagem) |

Abaixo dela ficam os **botões de filtro**: **Lotes, Apartações, Sexo, Raças, Era, Marcas, Categoria e
Status** — só aparecem os que o relatório tem. Clique, marque um ou mais valores e confirme; o botão
passa a mostrar quantos estão marcados, por exemplo **Lotes (2)**. O **x** do botão limpa aquele filtro;
o botão **Limpar filtros** (funil) limpa todos. O filtro por **Proprietário** chega junto com o cadastro
de donos dos animais (próxima etapa).

**Pesagem anterior:** "Com pesagem anterior" mostra só as pesagens que têm uma pesagem anterior válida do
mesmo animal (as que dão ganho e GMD). O Cadastro não conta como "com anterior"; a Saída com peso (venda,
abate) conta, e a Saída sem peso não.

Para agrupar em **dois ou três níveis** (ex.: Apartação › Data › Lote), use o botão de camadas
(**Níveis de agrupamento**). Animais sem valor na coluna do grupo ficam no grupo **"Não informado"**,
sempre por último. Sessões são agrupadas em **ordem de data** (não em ordem alfabética do texto).

Pesagens, Desempenho, Movimentação, Saídas, Comercial e Embarques pedem período. **Rebanho atual** e
**Ocupação de lotes** não têm período: mostram a situação de hoje ("estado atual").

## 5. Tipo de relatório

Cada relatório traz os seus tipos prontos. Escolher um tipo troca de uma vez o agrupamento, o modo e as
colunas; os seus filtros continuam.

**Pesagens** ("Relatório de Pesagens Individuais") tem os mesmos 5 tipos do MAKGESTAO e abre em **Por
Apartação (Resumo por Data)**:

| Tipo | Como sai |
|---|---|
| **Analítico (Detalhado)** | Uma linha por pesagem. **Agrupar Por**: Lote, Apartação, Sexo e Raça — clique na ordem em que quer os níveis (até 3; clicar de novo tira). Subtotal de cada grupo com animais, peso médio e GMD médio, e o total geral. |
| **Sintético (Matriz)** | Tabela cruzada: **Linhas (Eixo Y)** × **Colunas (Eixo X)**, cada um entre Lote, Apartação, Sexo, Raça e Mês. Cada célula mostra Qtd (animais), Peso médio e GMD médio; a linha e a coluna **TOTAL** são recalculadas com todos os animais (nunca soma de médias). Escolher o mesmo eixo nos dois lados troca os eixos de lugar. Clique numa célula para ver os animais dela. |
| **Por Apartação/Lote** | Por apartação, uma tabela com uma linha por lote e o total da apartação. |
| **Por Apartação (Resumo por Data)** | Apartação › data › lote, com o subtotal de cada data, o **TOTAL POR LOTE** da apartação e o **TOTAL GERAL**. |
| **Vendas (Detalhado)** | Só as saídas por venda: Métrica/Valor, **Totais por marca**, **Totais por comprador**, o quadro de cada comprador (**Mostrar Detalhes** abre a lista de animais) e o **TOTAL GERAL**. |

**Colunas:** nos tipos Por Apartação, o botão **Colunas Painel** escolhe quais totais aparecem e em que
ordem. O padrão é Lote, Qtd, Faixa Exigida, Menor, Maior, Peso Médio, Média (@), Peso Total, GMD Médio,
Machos e Fêmeas; Total (@), Ganho Médio (kg e @), Ganho Total (kg e @) e Dias Médios ficam disponíveis.
No Analítico e em Vendas, **Colunas** escolhe as colunas da lista (ex.: Data anterior, Peso anterior,
Observação). A escolha fica guardada **para cada tipo e para cada usuário**: ao voltar ao tipo, ele abre
como você deixou.

**Ordenar Por** (as 8 opções do antigo): Data (Mais Recente), Data (Mais Antiga), Peso (Maior), Peso
(Menor), GMD (Maior), GMD (Menor), Animal (A-Z) e Lote (A-Z). No Analítico e em Vendas ordena as linhas
(dentro de cada grupo). Nos resumidos, "Data" ordena as datas, e Peso/GMD ordenam os lotes dentro de cada
data ou apartação pelo peso médio/GMD médio; Animal e Lote deixam os lotes em ordem alfabética. Na Matriz,
Peso/GMD ordenam as linhas pelo total da linha e "Data" inverte os meses. GMD e peso vazios ficam sempre
por último; "Animal (A-Z)" põe o 2 antes do 10.

**A conta do valor em Vendas:** vale o valor total digitado na saída. Sem ele, o valor é **peso ÷ divisor
da @ × valor da @** (como no MAKGESTAO); sem valor da @, a venda fica sem valor ("-") e fora da soma. A
**Média valor da arroba** é ponderada pelas arrobas de cada venda.

Um modelo salvo antes desta versão num tipo que saiu ("Resumo por Sessão", "Por lote", "Por data",
"Analítico por animal") abre no tipo novo mais próximo (a troca fica registrada na auditoria). Nos outros
relatórios aparecem **Resumo por <agrupamento padrão>** e **Analítico (uma linha por registro)**. Se você
agrupar pela barra genérica (nos outros relatórios), o tipo passa a mostrar **Personalizado**.

## 6. Filtrar

**Filtros rápidos** (faixa acima da tabela, com borda tracejada): um clique liga e outro desliga.

| Relatório | Filtro rápido |
|---|---|
| Rebanho atual | Sem pesagem há mais de 30 dias |
| Pesagens | Somente entradas e saídas |
| Desempenho | Somente perdendo peso |
| Movimentação de lotes | Somente mudanças de lote no período |
| Saídas | Somente mortes |

Além dos botões da barra, há **pílulas de filtro** para as demais colunas e o filtro pelo **título da
coluna** na grade do Detalhado. Pílulas com **cadeado** são condições fixas do relatório (ex.: "Motivo =
Venda" em Vendas do período).

Dicas: acentos e maiúsculas não importam ("nelore" acha "Nelore"); números aceitam vírgula (`450,5`);
filtros de colunas diferentes se somam. O **Rebanho atual** já abre só com animais **Ativos**; esse
filtro pode ser tirado.

## 7. A folha do relatório

A folha é a mesma na tela, na impressão e no PDF (A4):

1. **Cabeçalho**: logo da fazenda à esquerda; no centro o produtor, a fazenda e o endereço com o
   município-UF e, só se você ligar a opção na propriedade, CPF/CNPJ, inscrição estadual e telefone (item 8).
   Na impressão ele se repete em todas as páginas.
2. **Título**: em Pesagens, "**Relatório de Pesagens Individuais (Analítico)**" só no tipo **Analítico**; nos
   outros quatro tipos (inclusive **Vendas**) "**(Sintético)**", como no MAKGESTAO. Nos demais relatórios (e
   em Pesagens com **Personalizado**), "(Sintético)" no Resumido e "(Analítico)" no Detalhado. Junto do título,
   só o **Período: dd/mm/aaaa a dd/mm/aaaa**.
3. **Seções** por nível de agrupamento: **APARTAÇÃO: ENGORDA** › **DATA: 28/02/2026** › tabela com uma
   linha por lote.
4. **Subtotal** no fim de cada tabela, na mesma coluna de cada valor (ex.: "Subtotal 28/02/2026 · Lotes: 3").
5. Com três níveis, no fim de cada seção de primeiro nível vem o **TOTAL POR LOTE – ENGORDA**: os lotes
   daquela apartação somados em todas as datas, e a linha **Total Engorda**.
6. **TOTAL GERAL** no fim, calculado sobre todas as linhas filtradas.
7. **Rodapé**, só com o essencial: filtros usados (numa linha), "@ = peso vivo ÷ 30" (ou ÷ 15) quando a
   folha tem arroba, quem emitiu e quando, e **Página X de Y**. Se o seu perfil não vê alguma coluna (valores
   comerciais), o rodapé avisa quantas foram omitidas. A folha não leva mais notas explicativas.

Colunas de Pesagens na folha: **Qtd** (cabeças), **Faixa exigida (kg)** do lote, **Menor**, **Maior**,
**Peso médio**, **Média (@)**, **Peso total**, **Total (@)**, **Ganho médio** (kg e @), **Ganho total**
(kg e @), **Dias médios**, **GMD médio (kg/dia)**, **Machos** e **Fêmeas**. Peso em kg sai com 1 casa, @
com 2 e GMD com 3.

Regras da folha:

- **Cada número fica sob o título da sua coluna** — sempre (o programa confere isso a cada versão).
- **Coluna sem nenhum valor no relatório inteiro some** (ex.: Fêmeas num relatório só de machos). Para
  vê-las mesmo assim, use o botão **Mostrar colunas vazias** (olho riscado) no alto; ele vale também para a
  impressão. **Exceção (1.4.2): Dias, Ganho e GMD nunca somem** — sem valor, aparecem "-".
- **GMD sem pesagem anterior aparece "—", nunca "0,000"**, e fica fora da média. Quando falta GMD para
  alguém, o rodapé diz "GMD de N de M cab.".
- **Venda e abate com peso têm GMD (1.4.2)**: contra a última pesagem antes da saída. O Cadastro e a saída
  sem peso (morte, por exemplo) continuam sem GMD.
- **Faixa exigida** é a faixa de peso do **cadastro atual do lote** e só aparece na linha do lote (nunca
  no subtotal da data, da apartação ou no total geral, onde juntaria lotes diferentes).
- Contagem zero em Machos/Fêmeas aparece "—".
- **Orientação Automática** tenta retrato; se as colunas não couberem, usa paisagem e letra menor. Se nem
  assim couber, o programa avisa antes de imprimir (nunca corta coluna calado).

**A arroba da folha.** Média (@), Total (@) e o ganho em @ usam a arroba de **peso vivo**: peso ÷ 30 (o
padrão) ou peso ÷ 15. Quem escolhe é o ADMIN ou o GESTOR em **Configurações › Relatórios › Divisor da
arroba** (o GESTOR vê em Configurações só essa seção). O divisor usado aparece no rodapé de cada folha. Isso não muda a @ de carcaça do Comercial (carcaça ÷ 15).

## 7A. Gráficos (1.4.2)

Em **Pesagens**, **Desempenho** e **Rebanho atual**, acima da folha, o botão **Folha | Gráficos** troca a
vista. Os gráficos usam **os mesmos números da folha**: o mesmo período, os mesmos filtros e o mesmo detalhe.
Trocar de vista não refaz o relatório.

| Relatório | Gráficos |
|---|---|
| Pesagens | **Evolução do peso médio** (uma linha por lote, apartação, sexo, raça ou marca; mês, data ou sessão; troca para GMD médio) · **GMD médio por grupo** · **Ganho de peso por mês** (kg ou @) · **Distribuição do peso** (faixas, com a última pesagem de cada animal) |
| Desempenho | **GMD médio por grupo** · **Peso inicial × peso final** · **Animais por faixa de GMD** (perdendo peso em vermelho) · **Distribuição do peso final** |
| Rebanho atual | **Distribuição do peso atual** · **GMD médio por lote** |

- Passe o mouse (ou use Tab) para ver os valores; **clique numa barra** para abrir a folha só daquele grupo
  (o × da pílula "Detalhe" volta).
- Na legenda, clique numa série para escondê-la ou mostrá-la. **Ver tabela** mostra os números do gráfico.
- Grupo sem GMD não vira barra zero: aparece escrito embaixo ("Sem GMD: Lote 03 (4 cab.)").
- **Imprimir/PDF** na vista Gráficos: os gráficos vêm antes e a folha começa em página nova. No menu **⋯**
  há **Imprimir só os gráficos** e **PDF só dos gráficos**. O **Excel** ganha a aba **Gráficos** com os
  números de cada gráfico.
- A vista e as escolhas de cada gráfico ficam guardadas como o resto do relatório (e em "Meus relatórios").

**GMD no Desempenho (1.4.2):** o peso inicial de cada animal é a **última pesagem antes do período** (quando
existe). Assim quem pesa por aparte, com meses entre as pesagens, tem GMD, e o número bate com o de Pesagens.
Os **dias** aparecem como **média** ("Dias Médios"): no título da coluna, **Calcular** troca para Mínimo ou
Máximo; no Analítico a conta de Dias vem marcada em **Média** (desmarque e marque outra para mudar).

**Ficha do Animal:** a **Curva de peso** usa as datas na escala certa; passe o mouse num ponto para ver peso,
dias, ganho e GMD daquele trecho.

## 8. Cabeçalho da propriedade

O cabeçalho da folha vem do cadastro da **Propriedade** (Cadastros › Propriedades › abrir a propriedade),
no cartão **Cabeçalho dos relatórios**:

| Campo | Onde aparece |
|---|---|
| **Produtor / razão social** | Linha grande do cabeçalho (sem ele, vai o nome da propriedade) |
| **Endereço** | Linha do endereço, seguida do município e da UF da propriedade |
| **CPF/CNPJ**, **Inscrição estadual** e **Telefone** | Só se **Mostrar CPF/CNPJ, IE e telefone no cabeçalho** = Sim (nasce desmarcado) |
| **Logo** | À esquerda do cabeçalho |

**Logo:** clique em **Escolher logo**, escolha um arquivo **PNG ou JPG**. O programa reduz sozinho para no
máximo 400 pixels de largura e 300 KB — não precisa preparar a imagem. **Trocar** escolhe outra;
**Remover** tira o logo. Ao lado aparece a **pré-visualização** "Assim vai sair nos relatórios". O logo
vai junto no backup e volta na restauração.

**Qual propriedade vai no cabeçalho:** a do filtro do relatório, quando o relatório está filtrado (ou
detalhado) por uma única propriedade — marcada na lista ou em "igual a" (texto em "contém", "começa com"
ou "termina com" não escolhe, porque pode pegar outra fazenda); senão, a propriedade marcada como
**Padrão**. Sem propriedade cadastrada, vai só o nome do sistema.

## 9. Totais

Botão **Σ (Totais)**: escolha o que calcular. No Resumido, cada total é uma coluna; no Detalhado, aparece
no subtotal de cada grupo e no **Total geral**.

Como ler:

- **"—" significa sem valor.** Valor em branco **não** conta como zero.
- Número com **sublinhado pontilhado** (só na tela): a conta usou só as linhas que tinham valor (passe o
  mouse para ver "calculado com 3 de 5 valores").
- **Qtd / Cabeças** conta cada animal uma vez, mesmo pesado várias vezes. O total de cabeças **não** é a
  soma dos grupos quando o mesmo animal aparece em dois grupos (ex.: Cadastro e Manejo).
- **GMD (kg/dia)** do grupo = soma dos ganhos ÷ soma dos dias. Exemplo: A ganhou 10 kg em 10 dias e B
  40 kg em 20 dias → GMD do grupo = 50 ÷ 30 = **1,667**. O **GMD simples** (média dos GMD) seria 1,500.
  Pesagem sem pesagem anterior fica fora do GMD.
- O **Total geral** é sempre calculado sobre **todas** as linhas filtradas — nunca é a soma das linhas
  da tela.

## 10. Salvar modelo

**Salvar como meu relatório…** (menu ⋯, disquete; abre a janela "Salvar modelo"): guarda colunas, filtros, período, agrupamento, totais, **Resumido ou
Detalhado** e a ordem do Resumido — **nunca os dados**.

| Visibilidade | Quem vê | Quem pode criar |
|---|---|---|
| **Pessoal (só você)** | Só você | Todos os perfis |
| **Compartilhado com a empresa** | Todos que podem abrir o relatório | ADMIN e GESTOR |

Um modelo nunca libera mais do que o seu perfil permite: colunas de valor somem para quem não pode vê-las.
Um modelo antigo (de antes da 1.4.0) abre no **Resumido** se tiver agrupamento e no **Detalhado** se não
tiver.

## 11. Imprimir, PDF e arquivos

No alto, à direita:

- **Imprimir** (verde) — imprime **a folha** em A4, na orientação escolhida na barra.
- **Excel** — planilha XLSX com os mesmos números da tela: no Resumido, uma linha por grupo (apartação,
  data e lote, cada um no seu nível) e o Total geral; com três níveis (ex.: Por apartação), no fim de cada
  apartação vem também o bloco **TOTAL POR LOTE – ENGORDA** igual ao da folha (título, uma linha por
  lote e a linha **Total Engorda**; a Faixa exigida só nas linhas de lote). No Detalhado, todas as linhas.
  Os números são números de verdade (dá para somar e filtrar no Excel); totais em kg com 1 casa; as
  linhas de dados do Detalhado saem com as casas da coluna. As notas ficam só na folha.
- **PDF** — a mesma folha em A4, com **Página X de Y** no rodapé de cada página.
- **⋯ (Outros formatos)** — **CSV** (Excel pt-BR) e **JSON com manifesto**.

Se a folha não couber na página, aparece o aviso "Este relatório possui muitas colunas para impressão."
com as opções: usar paisagem, reduzir totais/colunas, exportar ou continuar. Nenhuma coluna é escondida
sem você saber.

No CSV do Resumido, a coluna **grupo** traz o caminho completo (ex.: "Engorda > Lote 01"), para você
poder ordenar ou filtrar no Excel sem perder de qual apartação é cada lote. O CSV não leva o bloco
"TOTAL POR": é uma linha por grupo e o total geral.

Cada emissão tem um número e um código de conferência (SHA-256). Junto do CSV, XLSX e PDF é salvo um
arquivo `.manifest.json` com quem emitiu, quando, o período, os filtros, o modo e o divisor da @.

## 12. Onde foram parar os relatórios antigos

Na versão 1.4.0 os 51 relatórios da lista viraram estes 12, mais 4 de controle na Manutenção. **Nada
se perdeu**: favoritos, recentes, modelos
salvos e links antigos continuam abrindo o que abriam — agora dentro do relatório novo, já agrupado e
filtrado do mesmo jeito. No catálogo, um favorito antigo aparece com o nome de antes (ex.: **Rebanho por
raça**) e a marca "Visão salva de antes da 1.4.0".

| Antes | Agora |
|---|---|
| Inventário atual do rebanho, Rebanho por marca/raça/categoria/sexo/situação/lote/apartação/faixa de peso, Animais sem pesagem recente | **Rebanho atual** (Agrupar por; filtro "Sem pesagem há mais de 30 dias") |
| Pesagens por período/sessão/lote e apartação/operador/origem, Entradas e saídas | **Pesagens** (abre a mesma seleção do relatório antigo, como "Personalizado") |
| Desempenho individual/por lote/por marca/raça/categoria/sexo/apartação, Animais perdendo peso, Distribuição por faixa de peso | **Desempenho** (Agrupar por; filtro "Somente perdendo peso") |
| Mudanças de lote, Permanência em lotes | **Movimentação de lotes** (filtro "Somente mudanças de lote no período") |
| Saídas por motivo, Mortes por período/causa/categoria/lote | **Saídas** (Agrupar por; filtro "Somente mortes") |
| Trilha de auditoria, Qualidade dos dados, Histórico de backups, Pendências de pesagem | **Backup e Manutenção › aba Controle** |
| Relatórios de cadastros (Marcas, Raças…) | As próprias telas de **Cadastros** já listam e exportam |

A troca dos favoritos, recentes e modelos para os relatórios novos é automática e fica registrada na
auditoria como "relatório consolidado". Um modelo convertido mostra exatamente os mesmos animais de
antes: se ele filtrava a mesma coluna da condição do relatório antigo (ex.: "Só saídas" em "Entradas e
saídas"), a condição antiga aparece como pílula com **cadeado**, somada ao filtro do modelo. Se dois
modelos de mesmo nome caíram no mesmo relatório novo, o segundo ganha o nome antigo entre parênteses,
por exemplo **Machos (Rebanho por sexo)**.

Favoritos e modelos que você tinha em Auditoria, Qualidade dos dados, Histórico de backups, Pendências
de pesagem ou nos relatórios de Cadastros continuam em **Favoritos** e **Meus relatórios** (com a
marca "Relatório da aba Controle" ou "Relatório fora da lista") para abrir ou excluir.

## 13. Aba Controle (Backup e Manutenção)

Em **Backup e Manutenção**, a aba **Controle** reúne os relatórios de conferência do sistema: **Trilha de
auditoria** (quem fez o quê), **Qualidade dos dados**, **Histórico de backups** e **Pendências de
pesagem**. Abrem na mesma tela de relatório, com o botão **Manutenção** para voltar (a tela de
Manutenção volta como estava, sem refazer a verificação). Ali não há estrela nem "Salvar modelo":
favoritos e modelos ficam em Relatórios.

Quem não abre Backup e Manutenção (OPERADOR e CONSULTA) encontra **Pendências de pesagem** e
**Qualidade dos dados** na própria tela de Relatórios, no grupo **Controle**.

**Faltando GMD? (1.4.2)** A **Qualidade dos dados** aponta: **Animal com uma pesagem só** (sem GMD por
falta de pesagem anterior), **Manejo sem GMD** (com o motivo, ex.: mesma data da anterior, sem peso) e
**Números parecidos** ("07" e "7" da mesma marca — o mesmo animal escrito de dois jeitos, o que parte a
série de pesagens em dois).

## 14. O que cada perfil pode fazer

| Perfil | Abrir relatórios | Imprimir / exportar / PDF | Preços e valores | Auditoria | Modelo compartilhado |
|---|---|---|---|---|---|
| **ADMIN** | Todos | Sim | Sim | Sim | Sim |
| **GESTOR** | Todos | Sim | Sim | Sim | Sim |
| **OPERADOR** | Rebanho, Pesagens, Desempenho, Movimentação, Saídas, Embarques e, no grupo Controle, Pendências de pesagem e Qualidade dos dados | **Não** | Não | Não | Não |
| **CONSULTA** | Os mesmos do OPERADOR | Sim (sem valores) | Não | Não | Não |

- **Fechamento do dia**, **Histórico de backups** e **Trilha de auditoria**: só ADMIN e GESTOR.
- **Comercial** (Vendas, Abates, Compras): só ADMIN e GESTOR.
- Quem não pode ver valores vê os relatórios normalmente, sem as colunas e totais de preço, valor,
  arrobas de carcaça e carcaça (Comercial) — também no Resumido e nos arquivos. A **@ de peso vivo** da
  folha (Média @, Total @, ganho em @ = kg ÷ 30 ou 15) não é valor comercial e aparece para todos.
- Senhas e chaves de recuperação **nunca** aparecem em relatório.
- O **cabeçalho da propriedade** é editado por quem altera Cadastros (ADMIN e GESTOR) e o **divisor da
  @** em Configurações › Relatórios (ADMIN e GESTOR); todos os perfis que abrem o relatório veem a folha
  com eles.

## 15. Relatórios comerciais: dados legados

Vendas, Abates e Compras levam o selo **COMERCIAL — DADOS LEGADOS/POR EVENTO**: valores, comprador e
frigorífico vêm do que foi **digitado em cada lançamento**; arrobas = carcaça ÷ 15 com o rendimento
gravado; o preço médio da arroba é ponderado pelas arrobas. Use como conferência dos lançamentos, não como
fechamento financeiro. (A venda no curral com recibo e acerto por dono chega numa próxima versão.)

**Mortes:** o relatório Saídas mostra a **quantidade** de mortes. A **taxa** de mortalidade (%) ainda não
é calculada.

## 16. Atalho do Fechamento do Dia

Na tela **Fechamento do Dia**, o botão **Imprimir fechamento** abre o "Fechamento do dia (imprimível)" já
com a data do dia, agrupado por sessão e com as mesmas pendências da tela.
