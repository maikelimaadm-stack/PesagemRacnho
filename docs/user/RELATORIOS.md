# Relatórios

Os relatórios respondem às perguntas do dia a dia: **quantas cabeças tem em cada lote, quanto pesam,
quanto ganharam, quem saiu**. Desde a versão 1.4.0 eles abrem **resumidos**: uma linha por lote (ou
categoria, raça, marca…) com os totais em colunas. Os números da tela, da impressão e dos arquivos são
**sempre os mesmos**.

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

## 2. Os 12 relatórios

| Assunto | Relatório | Abre | Para que serve |
|---|---|---|---|
| Rebanho | **Rebanho atual** | Resumido por lote | Cabeças, peso médio e peso total de hoje — por lote, categoria, raça, marca, sexo, faixa de peso |
| Rebanho | **Ocupação de lotes** | Resumido por apartação | Animais de cada lote contra a capacidade |
| Pesagens | **Pesagens** | Resumido por sessão | Pesagens do período — por sessão, dia, lote, tipo, operador |
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

- **Resumido** — uma linha por grupo, com os totais em colunas. Exemplo (Rebanho atual):

  | Lote atual | Cabeças | Peso médio (kg) | Peso total (kg) |
  |---|---|---|---|
  | E1 | 26 | 282,62 | 7.348,00 |
  | Leves | 17 | 238,88 | 4.061,00 |
  | **Total geral** | **100** | **296,84** | **29.684,00** |

- **Detalhado** — todos os animais (ou pesagens) de cada grupo, com subtotal no fim de cada grupo.

**Clique no nome de um grupo** no Resumido (ex.: "E1") para ver só os animais dele no Detalhado. Aparece
o selo **Detalhe: Lote atual: E1**; o **x** do selo volta ao Resumido.

**Ordenar o Resumido:** clique no título de uma coluna de total (ex.: GMD) para ordenar os grupos por ela
(maior primeiro; clique de novo para inverter). Grupos de segundo nível continuam dentro do seu grupo.
A impressão e os arquivos saem na mesma ordem.

Sem nenhum agrupamento, o Resumido mostra só o **Total geral** e a dica "Escolha Agrupar por".

## 4. Agrupar por

Ao lado do botão Resumido | Detalhado há o **Agrupar por**: escolha Lote, Categoria, Raça, Marca… e a
tabela muda na hora, sem abrir janela.

Para agrupar em **dois ou três níveis** (ex.: Apartação › Lote), use o botão de camadas (**Níveis de
agrupamento**) ao lado. No Resumido, o primeiro nível aparece em negrito e os demais em colunas à
direita.

Animais sem valor na coluna do grupo ficam no grupo **"Não informado"**, sempre por último.

## 5. Escolher o período

No alto, à direita: **Hoje**, **Ontem**, **Últimos 7/30/90/365 dias**, **Mês atual**, **Mês anterior**,
**Ano atual** ou **Personalizado** (data inicial e final).

Pesagens, Desempenho, Movimentação, Saídas, Comercial e Embarques pedem período. **Rebanho atual** e
**Ocupação de lotes** não têm período: mostram a situação de hoje ("estado atual").

## 6. Filtrar

**Filtros rápidos** (faixa acima da tabela, com borda tracejada): um clique liga e outro desliga.

| Relatório | Filtro rápido |
|---|---|
| Rebanho atual | Sem pesagem há mais de 30 dias |
| Pesagens | Somente entradas e saídas |
| Desempenho | Somente perdendo peso |
| Movimentação de lotes | Somente mudanças de lote no período |
| Saídas | Somente mortes |

**Pílulas de filtro**: uma por coluna. Clique, marque os valores ou digite a condição. O **x** limpa
aquele filtro; **Limpar filtros** limpa todos. Pílulas com **cadeado** são condições fixas do relatório
(ex.: "Motivo = Venda" em Vendas do período).

Dicas: acentos e maiúsculas não importam ("nelore" acha "Nelore"); números aceitam vírgula (`450,5`);
filtros de colunas diferentes se somam. O **Rebanho atual** já abre só com animais **Ativos**; esse
filtro pode ser tirado.

## 7. Totais

Botão **Σ (Totais)**: escolha o que calcular. No Resumido, cada total é uma coluna; no Detalhado, aparece
no subtotal de cada grupo e no **Total geral**.

Como ler:

- **"—" significa sem valor.** Valor em branco **não** conta como zero.
- Número com **sublinhado pontilhado**: a conta usou só as linhas que tinham valor (passe o mouse para
  ver "calculado com 3 de 5 valores").
- **Cabeças** conta cada animal uma vez, mesmo pesado várias vezes. O total de cabeças **não** é a soma
  dos grupos quando o mesmo animal aparece em dois grupos (ex.: Cadastro e Manejo).
- **GMD (kg/dia)** do grupo = soma dos ganhos ÷ soma dos dias. Exemplo: A ganhou 10 kg em 10 dias e B
  40 kg em 20 dias → GMD do grupo = 50 ÷ 30 = **1,667**. O **GMD simples** (média dos GMD) seria 1,500.
  Animal com uma pesagem só no período fica fora do GMD.
- O **Total geral** é sempre calculado sobre **todas** as linhas filtradas — nunca é a soma das linhas
  da tela.

## 8. Salvar modelo

Botão **Salvar modelo** (disquete): guarda colunas, filtros, período, agrupamento, totais, **Resumido ou
Detalhado** e a ordem do Resumido — **nunca os dados**.

| Visibilidade | Quem vê | Quem pode criar |
|---|---|---|
| **Pessoal (só você)** | Só você | Todos os perfis |
| **Compartilhado com a empresa** | Todos que podem abrir o relatório | ADMIN e GESTOR |

Um modelo nunca libera mais do que o seu perfil permite: colunas de valor somem para quem não pode vê-las.

## 9. Exportar e imprimir

**Exportar** (verde): CSV (Excel pt-BR), XLSX (Excel), JSON com manifesto e PDF (A4). No Resumido o
arquivo sai com **a mesma tabela resumida da tela**; no Detalhado, com todas as linhas.

**Imprimir** (impressora): A4 com cabeçalho (fazenda, relatório, período, filtros, "Agrupado por" e o
modo). O Resumido cabe em **A4 retrato** na grande maioria dos casos. Se não couber, aparece o aviso
"Este relatório possui muitas colunas para impressão." com as opções: usar paisagem, reduzir
totais/colunas, exportar CSV ou continuar. Nenhuma coluna é escondida sem você saber.

Cada emissão tem um número e um código de conferência (SHA-256). Junto do CSV, XLSX e PDF é salvo um
arquivo `.manifest.json` com quem emitiu, quando, o período, os filtros e o modo.

## 10. Onde foram parar os relatórios antigos

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
auditoria como "relatório consolidado".

## 11. Aba Controle (Backup e Manutenção)

Em **Backup e Manutenção**, a aba **Controle** reúne os relatórios de conferência do sistema: **Trilha de
auditoria** (quem fez o quê), **Qualidade dos dados**, **Histórico de backups** e **Pendências de
pesagem**. Abrem na mesma tela de relatório, com o botão **Manutenção** para voltar.

## 12. O que cada perfil pode fazer

| Perfil | Abrir relatórios | Imprimir / exportar / PDF | Preços e valores | Auditoria | Modelo compartilhado |
|---|---|---|---|---|---|
| **ADMIN** | Todos | Sim | Sim | Sim | Sim |
| **GESTOR** | Todos | Sim | Sim | Sim | Sim |
| **OPERADOR** | Rebanho, Pesagens, Desempenho, Movimentação, Saídas, Embarques | **Não** | Não | Não | Não |
| **CONSULTA** | Os mesmos do OPERADOR | Sim (sem valores) | Não | Não | Não |

- **Fechamento do dia**, **Histórico de backups** e **Trilha de auditoria**: só ADMIN e GESTOR.
- **Comercial** (Vendas, Abates, Compras): só ADMIN e GESTOR.
- Quem não pode ver valores vê os relatórios normalmente, sem as colunas e totais de preço, valor,
  arrobas e carcaça — também no Resumido e nos arquivos.
- Senhas e chaves de recuperação **nunca** aparecem em relatório.

## 13. Relatórios comerciais: dados legados

Vendas, Abates e Compras levam o selo **COMERCIAL — DADOS LEGADOS/POR EVENTO**: valores, comprador e
frigorífico vêm do que foi **digitado em cada lançamento**; arrobas = carcaça ÷ 15 com o rendimento
gravado; o preço médio da arroba é ponderado pelas arrobas. Use como conferência dos lançamentos, não como
fechamento financeiro. (A venda no curral com recibo e acerto por dono chega numa próxima versão.)

**Mortes:** o relatório Saídas mostra a **quantidade** de mortes. A **taxa** de mortalidade (%) ainda não
é calculada.

## 14. Atalho do Fechamento do Dia

Na tela **Fechamento do Dia**, o botão **Imprimir fechamento** abre o "Fechamento do dia (imprimível)" já
com a data do dia, agrupado por sessão e com as mesmas pendências da tela.
