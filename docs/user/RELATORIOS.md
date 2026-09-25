# Relatórios

Os relatórios respondem às perguntas do dia a dia: **quantas cabeças tem em cada lote, quanto pesam,
quanto ganharam, quem saiu**. Desde a versão 1.4.0 eles abrem **resumidos** e aparecem na tela como
**a folha que sai na impressora**: cabeçalho da fazenda com o logo, seções por grupo, subtotais e total
geral. Os números da tela, da impressão, do PDF e dos arquivos são **sempre os mesmos**. O Excel (XLSX)
traz também o bloco "TOTAL POR" da folha; o CSV e o JSON trazem uma linha por grupo e o total geral; as
notas existem só na folha.

## 1. Abrir

1. No menu, clique em **Relatórios**.
2. Aparece o **catálogo**. No topo ficam os seus **favoritos**; depois os relatórios separados por
   assunto: Rebanho, Pesagens, Desempenho, Movimentação, Saídas, Comercial e Embarques.
3. Clique no cartão. Para voltar, use o botão **Relatórios** no alto da tela.

Use a caixa **Procurar relatório ou modelo**. Ela também acha pelos nomes antigos: procurar "mortes"
mostra **Saídas**; procurar "raça" mostra **Rebanho atual** e **Desempenho**.

| Aba | O que mostra |
|---|---|
| **Todos** | Favoritos no topo e os 12 relatórios que o seu perfil pode abrir |
| **Favoritos** | Os que você marcou com a **estrela** (no cartão ou dentro do relatório) |
| **Meus relatórios** | Modelos salvos: os seus pessoais e os compartilhados com a empresa |
| **Recentes** | Os últimos relatórios e modelos que você abriu |

O relatório **lembra como você o deixou** (tipo, período, agrupamento, filtros, orientação): ao voltar
nele, abre do mesmo jeito. Isso vale só para o seu usuário; os modelos salvos (item 10) continuam iguais.

## 2. Os 12 relatórios

| Assunto | Relatório | Abre | Para que serve |
|---|---|---|---|
| Rebanho | **Rebanho atual** | Resumido por lote | Cabeças, peso médio e peso total de hoje — por lote, categoria, raça, marca, sexo, faixa de peso |
| Rebanho | **Ocupação de lotes** | Resumido por apartação | Animais de cada lote contra a capacidade |
| Pesagens | **Pesagens** | Resumido por sessão | Pesagens do período — por sessão, apartação e data, lote, data, tipo, operador |
| Pesagens | **Fechamento do dia (imprimível)** | Detalhado | Conferência do dia, com as pendências da tela Fechamento do Dia |
| Desempenho | **Desempenho** | Resumido por lote | Peso inicial e final, ganho e GMD do período |
| Movimentação | **Movimentação de lotes** | Resumido por lote | Quem passou por cada lote, quantos dias ficou, quem mudou de lote |
| Saídas | **Saídas** | Resumido por motivo | Vendas, abates, mortes, doações e transferências do período |
| Comercial | **Vendas do período** | Detalhado | Vendas com peso, arrobas, preço da @ e valor |
| Comercial | **Abates do período** | Detalhado | Abates com frigorífico, rendimento, arrobas e valor |
| Comercial | **Compras do período** | Detalhado | Compras com valor por cabeça |
| Embarques | **Romaneio de embarque** | Resumido por embarque › documento | Animais embarcados por documento |
| Embarques | **Embarques: previsto × realizado** | Resumido por embarque | O que foi previsto contra o que saiu |

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

Fica logo abaixo do nome do relatório, igual em todos os relatórios:

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
mesmo animal (as que dão ganho e GMD). Cadastro e Saída não contam como "com anterior".

Para agrupar em **dois ou três níveis** (ex.: Apartação › Data › Lote), use o botão de camadas
(**Níveis de agrupamento**). Animais sem valor na coluna do grupo ficam no grupo **"Não informado"**,
sempre por último. Sessões são agrupadas em **ordem de data** (não em ordem alfabética do texto).

Pesagens, Desempenho, Movimentação, Saídas, Comercial e Embarques pedem período. **Rebanho atual** e
**Ocupação de lotes** não têm período: mostram a situação de hoje ("estado atual").

## 5. Tipo de relatório

Cada relatório traz os seus tipos prontos. Escolher um tipo troca de uma vez o agrupamento, o modo
(Resumido/Detalhado) e os totais; os seus filtros continuam. Se você mudar o agrupamento na mão, o tipo
passa a mostrar **Personalizado**.

Em **Pesagens**:

| Tipo | Como sai |
|---|---|
| **Resumo por Sessão** | Como Pesagens abre: uma linha por sessão |
| **Por apartação (resumo por data)** | Seção por apartação, dentro dela uma tabela por data com uma linha por lote, e no fim da apartação o **TOTAL POR LOTE** |
| **Por lote** | Uma linha por lote |
| **Por data** | Uma linha por data (sem a Faixa exigida, que é de cada lote) |
| **Analítico por animal** | Detalhado, uma linha por pesagem |

Nos relatórios sem tipos próprios aparecem **Resumo por <agrupamento padrão>** (ou **Lista por …**, nos
que abrem no Detalhado), quando o relatório tem agrupamento padrão, e sempre **Analítico (uma linha por
registro)**.

O Tipo só aparece escolhido quando está aplicado por inteiro (agrupamento, modo e totais; no Detalhado,
também as colunas). Se você mudar os totais ou as colunas, ele passa a mostrar **Personalizado**; escolher
o Tipo de novo volta ao jeito dele.

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

1. **Cabeçalho**: logo da fazenda à esquerda; no centro o produtor, a fazenda, o endereço e, se você
   quiser, CPF/CNPJ, inscrição estadual e telefone (item 8); à direita o período e a data/hora de emissão.
   Na impressão ele se repete em todas as páginas.
2. **Título**: "Relatório de <nome do relatório> (Sintético)" no Resumido, "(Analítico)" no Detalhado — em
   Pesagens, "**Relatório de Pesagens Individuais (Sintético)**" —, e à direita o modo e os níveis (ex.:
   Resumido · Apartação › Data › Lote).
3. **Seções** por nível de agrupamento: **APARTAÇÃO: ENGORDA** › **DATA: 28/02/2026** › tabela com uma
   linha por lote.
4. **Subtotal** no fim de cada tabela, na mesma coluna de cada valor (ex.: "Subtotal 28/02/2026 · Lotes: 3").
5. Com três níveis, no fim de cada seção de primeiro nível vem o **TOTAL POR LOTE – ENGORDA**: os lotes
   daquela apartação somados em todas as datas, e a linha **Total Engorda**.
6. **TOTAL GERAL** no fim, calculado sobre todas as linhas filtradas.
7. **Notas** (como ler os números) e o **rodapé**: filtros usados, "@ = peso vivo ÷ 30" (ou ÷ 15), quem
   emitiu e quando, versão do programa e **Página X de Y**.

Colunas de Pesagens na folha: **Qtd** (cabeças), **Faixa exigida (kg)** do lote, **Menor**, **Maior**,
**Peso médio**, **Média (@)**, **Peso total**, **Total (@)**, **Ganho médio** (kg e @), **Ganho total**
(kg e @), **Dias médios**, **GMD médio (kg/dia)**, **Machos** e **Fêmeas**. Peso em kg sai com 1 casa, @
com 2 e GMD com 3.

Regras da folha:

- **Cada número fica sob o título da sua coluna** — sempre (o programa confere isso a cada versão).
- **Coluna sem nenhum valor no relatório inteiro some** (ex.: Fêmeas num relatório só de machos). As
  colunas escondidas aparecem numa nota. Para vê-las mesmo assim, use o botão **Mostrar colunas vazias**
  (olho riscado) no alto; ele vale também para a impressão.
- **GMD sem pesagem anterior aparece "—", nunca "0,000"**, e fica fora da média. A nota diz com quantos
  animais o GMD foi calculado, por exemplo "GMD calculado com 48 de 50 animais".
- **Faixa exigida** é a faixa de peso do **cadastro atual do lote** e só aparece na linha do lote (nunca
  no subtotal da data, da apartação ou no total geral, onde juntaria lotes diferentes).
- Contagem zero em Machos/Fêmeas aparece "—".
- **Orientação Automática** tenta retrato; se as colunas não couberem, usa paisagem e letra menor. Se nem
  assim couber, o programa avisa antes de imprimir (nunca corta coluna calado).

**A arroba da folha.** Média (@), Total (@) e o ganho em @ usam a arroba de **peso vivo**: peso ÷ 30 (o
padrão) ou peso ÷ 15. Quem escolhe é o ADMIN ou o GESTOR em **Configurações › Relatórios › Divisor da
arroba** (o GESTOR vê em Configurações só essa seção). O divisor usado aparece no rodapé de cada folha. Isso não muda a @ de carcaça do Comercial (carcaça ÷ 15).

## 8. Cabeçalho da propriedade

O cabeçalho da folha vem do cadastro da **Propriedade** (Cadastros › Propriedades › abrir a propriedade),
no cartão **Cabeçalho dos relatórios**:

| Campo | Onde aparece |
|---|---|
| **Produtor / razão social** | Linha grande do cabeçalho (sem ele, vai o nome da propriedade) |
| **Endereço** | Linha do endereço, seguida do município e da UF da propriedade |
| **CPF/CNPJ** e **Inscrição estadual** | Só se **Mostrar CPF/CNPJ e IE no cabeçalho** = Sim |
| **Telefone** | Abaixo do endereço |
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

Botão **Salvar modelo** (disquete): guarda colunas, filtros, período, agrupamento, totais, **Resumido ou
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
| Pesagens por período/sessão/lote e apartação/operador/origem, Entradas e saídas | **Pesagens** (Agrupar por; filtro "Somente entradas e saídas") |
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
