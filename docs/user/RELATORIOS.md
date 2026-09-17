# Relatórios

Os relatórios mostram as pesagens, o rebanho, o desempenho, as saídas e os controles da fazenda com
filtros, grupos e totais — e deixam imprimir ou salvar em arquivo. Os números da tela, da impressão e
dos arquivos são **sempre os mesmos**.

## 1. Abrir

1. No menu, clique em **Relatórios**.
2. Aparece o **catálogo**: cartões separados por assunto (Rebanho, Pesagens, Desempenho, Movimentação,
   Saídas, Comercial, Embarques, Controle, Cadastros).
3. Clique no cartão do relatório. Para voltar, use o botão **Relatórios** no alto da tela.

No catálogo:

| Aba | O que mostra |
|---|---|
| **Todos** | Todos os relatórios que o seu perfil pode abrir, mais os indisponíveis (em cinza) |
| **Favoritos** | Os que você marcou com a **estrela** (no cartão ou dentro do relatório) |
| **Meus relatórios** | Modelos salvos: os seus pessoais e os compartilhados com a empresa |
| **Recentes** | Os últimos relatórios e modelos que você abriu |

Use a caixa **Procurar relatório ou modelo** para achar pelo nome. O cartão mostra o que é cada linha
(ex.: "uma linha por pesagem"), as métricas principais e um cadeado quando o relatório exige permissão
especial (Valores comerciais, Auditoria, Usuários, Fechamento).

## 2. Escolher o período

No alto, à direita:

- escolha **Hoje**, **Ontem**, **Últimos 7/30/90/365 dias**, **Mês atual**, **Mês anterior** ou
  **Ano atual**; ou
- escolha **Personalizado** e informe a data inicial e a final.

Relatórios de pesagens, desempenho, saídas e movimentação **sempre** pedem período. Relatórios de estado
atual (Inventário, Rebanho por…, Ocupação de lotes, Cadastros) não têm período: mostram a situação de
hoje. O período aparece por extenso na tela e no papel, por exemplo "Últimos 30 dias = 18/08/2026 a
16/09/2026".

Alguns relatórios têm um campo a mais, como **Dias sem pesagem (mais de)** em "Animais sem pesagem
recente".

## 3. Filtrar

**Pílulas de filtro** (faixa acima da tabela): há uma pílula por coluna visível. Clique, marque os
valores ou digite a condição. O **x** da pílula limpa aquele filtro; **Limpar filtros** limpa todos.

**Menu da coluna** (no cabeçalho da tabela): abre o filtro com condição (Contém, É igual a, Maior que,
Entre, Antes de, Está vazio…), além de **Ocultar coluna**. Clicar no nome da coluna ordena (crescente
ou decrescente).

Dicas:

- Acentos e maiúsculas não importam: "nelore" encontra "Nelore".
- Números aceitam vírgula: `450,5`.
- Datas são dias do calendário (sem problema de fuso).
- Filtros de colunas diferentes se somam (precisa atender a todos).
- Pílulas com **cadeado** são condições fixas do próprio relatório (ex.: "Ganho < 0" em "Animais
  perdendo peso", "Motivo = Morte" em "Mortes"). Não dá para removê-las.
- O Inventário já abre filtrando **Ativo**; esse filtro você pode tirar.

## 4. Colunas

Botão **Colunas**: marque, desmarque e reordene as colunas. Você só vê as colunas que o seu perfil
permite (por exemplo, preços e valores não aparecem para quem não tem permissão de valores comerciais).

## 5. Agrupar (até 3 níveis)

Botão **Agrupar**: escolha até **3 níveis** (ex.: Apartação › Lote › Sexo). Use **Subir**/**Descer**
para mudar a ordem e a seta para inverter a ordem dos grupos. **Remover agrupamento** volta à lista
simples.

- Cada grupo mostra quantos registros tem e, no fim, um **Subtotal**.
- Linhas sem valor na coluna do grupo ficam no grupo **"Não informado"**, sempre por último.

## 6. Totais

Botão **Totais**: escolha o que calcular em cada subtotal e no **Total geral** (Soma, Média simples,
Mínimo, Máximo, Animais únicos, GMD ponderado…). Só aparecem contas que fazem sentido para a coluna
(não existe "soma de GMD", por exemplo).

Como ler os totais:

- **"—" significa sem valor.** Valor em branco **não** conta como zero. Pesos 100, (vazio) e 200 dão
  média **150**, não 100.
- **"n de N"** ao lado do total: quantos valores entraram na conta de quantas linhas. Ex.: "150,00
  (2 de 3)" = uma linha estava sem peso.
- **Registros × Animais únicos**: num relatório de pesagens, um animal pesado 3 vezes são 3 registros e
  1 animal. Os animais únicos nunca são somados entre grupos.
- **GMD simples × GMD ponderado**:
  - GMD simples = média dos GMD de cada animal.
  - GMD ponderado = soma dos ganhos ÷ soma dos dias. É o GMD do lote.
  - Exemplo: animal A ganhou 10 kg em 10 dias (1,0 kg/dia); B ganhou 40 kg em 20 dias (2,0 kg/dia).
    Simples = **1,500**; ponderado = 50 ÷ 30 = **1,667** kg/dia.
  - Animal com uma só pesagem no período não tem ganho nem GMD ("—") e fica fora do ponderado.
- O **Total geral** é sempre calculado sobre **todas** as linhas filtradas, mesmo que a tabela esteja
  mostrando só uma página. Subtotais também.
- Somar o peso de um relatório de pesagens **não** é o peso do rebanho (o mesmo animal pode ter sido
  pesado várias vezes). Para o peso do rebanho, use o **Inventário atual do rebanho**.

No rodapé da tabela: Registros, Animais únicos, linhas por página (50, 100, 250 ou 500) e páginas.

## 7. Salvar modelo

Botão **Salvar modelo**: guarda colunas, filtros, período, agrupamentos, totais e ordenação — **nunca os
dados**. Informe um nome (até 80 letras).

| Visibilidade | Quem vê | Quem pode criar |
|---|---|---|
| **Pessoal (só você)** | Só você | Todos os perfis |
| **Compartilhado com a empresa** | Todos que podem abrir o relatório | ADMIN e GESTOR |

Os modelos ficam na aba **Meus relatórios**. Ao abrir um modelo compartilhado, colunas que o seu perfil
não pode ver são retiradas e aparece um aviso — um modelo nunca libera mais do que o seu perfil permite.
Para salvar alterações em outro nome, marque **Salvar como novo modelo**.

## 8. Exportar arquivos

Botão **Exportar** (verde). Todos os formatos levam **a mesma população e os mesmos totais da tela**.

| Formato | Para que serve | Onde fica |
|---|---|---|
| **CSV (Excel pt-BR)** | Abrir no Excel com vírgula decimal | Pasta de dados do aplicativo, subpasta `relatorios` |
| **XLSX (Excel)** | Planilha com números de verdade (dá para somar) e aba **Manifesto** | Você escolhe a pasta na janela "Salvar relatório" |
| **JSON com manifesto** | Guardar ou conferir os dados com todos os detalhes | Pasta `relatorios` |
| **PDF (A4)** | Enviar ou arquivar o relatório pronto | Você escolhe a pasta na janela "Salvar relatório em PDF" |

Cada emissão recebe um número de emissão e um código de conferência (SHA-256), mostrados na mensagem de
sucesso. Junto do CSV, do XLSX e do PDF é salvo um arquivo `.manifest.json` com quem emitiu, quando, o
período, os filtros e o código de conferência.

No mesmo menu escolha a **Orientação**: Automática, Retrato ou Paisagem.

## 9. Imprimir

Botão **Imprimir**: abre a impressão do Windows. O papel sai em A4 com cabeçalho (relatório, período,
filtros, agrupamento, quem emitiu), cabeçalho da tabela repetido em cada página, subtotais, total geral
e rodapé "Página X de Y".

A orientação automática usa **retrato** até 8 colunas que caibam e **paisagem** acima disso. Se nem
assim couber, aparece o aviso **"Este relatório possui muitas colunas para impressão."** com as opções:

- **Usar paisagem** (quando estava em retrato);
- **Reduzir colunas** (abre o botão Colunas);
- **Exportar CSV**;
- **Continuar mesmo assim**.

Nenhuma coluna é escondida sem você saber.

## 10. O que cada perfil pode fazer

| Perfil | Abrir relatórios | Imprimir / exportar / PDF | Preços e valores | Auditoria | Modelo compartilhado |
|---|---|---|---|---|---|
| **ADMIN** | Todos | Sim | Sim | Sim | Sim |
| **GESTOR** | Todos, menos "Usuários" | Sim | Sim | Sim | Sim |
| **OPERADOR** | Pesagens, rebanho, desempenho, movimentação, saídas, embarques, qualidade dos dados e cadastros | **Não** | Não | Não | Não |
| **CONSULTA** | Os mesmos do OPERADOR | Sim (sem valores) | Não | Não | Não |

- **Fechamento do dia**, **Histórico de backups** e **Trilha de auditoria**: só ADMIN e GESTOR.
- Os relatórios **Comercial** (Vendas, Abates, Compras): só ADMIN e GESTOR.
- Quem não tem permissão de valores vê "Saídas por motivo" e "Pesagens por período" normalmente, só
  que sem as colunas de preço, valor, arrobas e carcaça.
- Senhas e chaves de recuperação **nunca** aparecem em relatório, para nenhum perfil.

## 11. Relatórios indisponíveis

Aparecem em cinza no catálogo com "Indisponível" e o motivo. Não é defeito: o sistema ainda não guarda
a informação necessária, e o relatório não é "inventado".

| Relatório | Por que está indisponível |
|---|---|
| Rebanho em data passada | O sistema não guarda uma fotografia do rebanho por data |
| Balanço de estoque | Depende do rebanho em data passada |
| **Taxa de mortalidade** | Falta definir a base da conta (estoque médio ou animais-dia) |
| Totais por comprador/frigorífico | Comprador e frigorífico são texto digitado, sem cadastro vinculado |
| Operação comercial agregada | Não existe registro de operação comercial (lote de venda, frete, líquido) |
| Resultado econômico / custo por arroba | O sistema não registra custos |
| Projeção de peso e data de abate | Ainda não há cálculo validado |
| Embarques por parceiro | O embarque não grava o parceiro |
| Faixas de identificadores | Ainda não há onde cadastrar |
| Registro de emissões de relatórios | A auditoria ainda não registra exportações (os manifestos ficam na pasta `relatorios`) |

**Mortes:** os relatórios "Mortes por período / causa / categoria / lote" mostram a **quantidade** de
mortes. A **taxa** de mortalidade (%) não é calculada.

## 12. Relatórios comerciais: dados legados

Vendas, Abates e Compras levam o selo **COMERCIAL — DADOS LEGADOS/POR EVENTO**. Quer dizer:

- valores, comprador, frigorífico e origem vêm do que foi **digitado em cada lançamento**;
- não há vínculo com o cadastro de Parceiros nem soma por operação de venda;
- arrobas = carcaça ÷ 15, usando o rendimento gravado no lançamento; sem rendimento, as arrobas ficam
  "—";
- o preço médio da arroba é **ponderado pelas arrobas**.

Use esses números como conferência dos lançamentos, não como fechamento financeiro.

## 13. Atalho do Fechamento do Dia

Na tela **Fechamento do Dia**, o botão **Imprimir fechamento** abre o relatório "Fechamento do dia
(imprimível)" já com a data do dia, agrupado por sessão e com as mesmas pendências da tela.
