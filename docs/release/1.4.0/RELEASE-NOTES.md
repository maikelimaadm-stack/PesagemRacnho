# Pesagens Individuais 1.4.0 — notas da versão

Data: 25/09/2026 · Esquema Dexie 8 (sem mudança) · Backup formato 3 · Instalador não assinado.

## O que muda para quem usa

### Relatórios mais curtos e diretos
- Os relatórios agrupados abrem **resumidos**: uma linha por lote (ou categoria, raça, marca…) com
  **Cabeças, Peso médio, Peso total, GMD** em colunas. Acabou a lista de 300 animais para saber
  quantos tem em cada lote.
- O botão **Resumido | Detalhado** troca a visão. **Clique no nome do lote** para ver só os animais
  dele; o **x** do selo "Detalhe" volta ao resumo.
- **Agrupar por** fica na barra: escolha Lote, Categoria, Raça… e a tabela muda na hora.
- **Filtros rápidos** de um clique: "Somente mortes", "Somente perdendo peso", "Sem pesagem há mais
  de 30 dias", "Somente entradas e saídas", "Somente mudanças de lote no período".
- O que aparece na tela é o que sai na impressão A4; no Excel (XLSX), no CSV e no JSON vão os mesmos
  números, uma linha por grupo; o XLSX leva também o bloco "TOTAL POR" da folha (as notas ficam só na
  folha).

### O relatório virou uma folha (E1B)
- O Resumido aparece na tela **como a folha impressa**: cabeçalho com o **logo e os dados da fazenda**,
  seções por apartação e data, subtotal sob cada coluna, **TOTAL POR LOTE** de cada apartação,
  **TOTAL GERAL**, e no rodapé os filtros, "@ = peso vivo ÷ 30", quem emitiu, a hora e **Página X de Y**.
  A mesma folha sai na impressora e no PDF, em retrato ou paisagem.
- **Pesagens › Tipo "Por apartação (resumo por data)"**: Qtd, Faixa exigida, Menor, Maior, Peso médio,
  Média @, Peso total, Total @, Ganho médio e total (kg e @), Dias médios, GMD médio, Machos e Fêmeas.
- Os três erros do relatório antigo não voltam: **colunas sempre alinhadas**, **GMD "—"** (nunca
  "0,000") quando não há pesagem anterior, e **coluna vazia some**.
- **Barra de filtros** igual em todos os relatórios: datas, período, orientação, **Tipo de relatório**,
  agrupar, **ordenar**, **pesagem anterior** e os botões Lotes, Apartações, Sexo, Raças, Era, Marcas,
  Categoria e Status (com contador e Limpar).
- **Cadastro da Propriedade › Cabeçalho dos relatórios**: produtor, endereço, CPF/CNPJ, IE, telefone e
  **logo** (o programa ajusta o tamanho), com pré-visualização.
- **Configurações › Relatórios**: divisor da arroba de peso vivo (30 ou 15).
- OPERADOR e CONSULTA veem **Pendências de pesagem** e **Qualidade dos dados** em Relatórios › Controle.

### Ajustes finais (E1C)
- A folha de Pesagens sai com o título **"Relatório de Pesagens Individuais (Sintético)"**.
- **Excel (XLSX)** com o bloco **TOTAL POR LOTE – <apartação>** igual ao da folha, com os mesmos números.
- **CPF/CNPJ com máscara** nas fichas de Parceiros e Propriedades (CPF, CNPJ e CNPJ alfanumérico), ao
  digitar e ao colar.
- O **GESTOR** passa a ajustar o **divisor da @** em Configurações › Relatórios (só essa seção).
- **Tema escuro:** o texto digitado nas fichas de Cadastros voltou a aparecer.
- **Configurações:** salvar com o "Rendimento de carcaça padrão" em branco voltou a funcionar.

### Relatório de Pesagens Individuais igual ao MAKGESTAO (E1D)
- **Tela e folha como as do MAKGESTAO:** "Relatório de Pesagens Individuais" com o botão verde Imprimir,
  quadro com Data Início, Data Fim, Orientação, Tipo Relatório, Ordenar Por e Pesagem Anterior, e os botões
  Lotes, Apartações, Sexo, Raças, Era, Marcas, Status e Limpar Filtros. Na folha, "kg" em cada peso, subtotal
  em linha de texto e "-" no zero. As contas continuam as corretas (cada animal conta uma vez; GMD ponderado).
- **Os 5 tipos do antigo:** Analítico (Detalhado), Sintético (Matriz), Por Apartação/Lote, Por Apartação
  (Resumo por Data), que é o tipo com que o relatório abre, e Vendas (Detalhado).
- **Sintético (Matriz):** Linhas × Colunas entre Lote, Apartação, Sexo, Raça e Mês; cada célula com Qtd, Peso
  médio e GMD; linha e coluna TOTAL.
- **Vendas:** o relatório de venda do antigo (Métrica/Valor, totais por marca e por comprador, quadro de cada
  comprador com **Mostrar Detalhes**, TOTAL GERAL). Valor total = o digitado; sem ele, peso ÷ 30 × valor da @.
- **Analítico:** botões **Agrupar Por** Lote, Apartação, Sexo e Raça; colunas do antigo.
- **Colunas** escolhidas por tipo e guardadas para cada usuário; **Ordenar Por** com as 8 opções do antigo.
- Folha mais enxuta em todos os relatórios (sem "Emitido em" no cabeçalho e sem notas longas); telefone no
  cabeçalho só com a opção marcada.
- Grade de **Parceiros e Propriedades** com CPF/CNPJ formatado; a pesquisa acha com ou sem pontuação.

### Menos relatórios na lista
- A lista caiu de **51 para 12** relatórios: Rebanho atual, Ocupação de lotes, Pesagens, Fechamento do
  dia, Desempenho, Movimentação de lotes, Saídas, Vendas, Abates e Compras do período, Romaneio de
  embarque e Embarques previsto × realizado.
- **Nada se perdeu.** "Rebanho por raça", "Mortes por causa", "Desempenho por lote" e os outros
  viraram jeitos de ver os 12. Favoritos, recentes, modelos salvos e links antigos continuam abrindo o
  que abriam, já agrupados e filtrados como antes. A busca do catálogo acha pelo nome antigo.
- Auditoria, Qualidade dos dados, Histórico de backups e Pendências de pesagem foram para **Backup e
  Manutenção › aba Controle**.
- Os relatórios de cadastros saíram da lista: as telas de Cadastros já listam e exportam.

### Correções
- **Relação de Pesagens:** o diálogo coletivo **"Data, apartação e lote"** fechava a tela com erro no
  instalador 1.3.2. Corrigido.
- **Importação:** dois cliques seguidos em **Aplicar** com o mesmo arquivo agora gravam uma vez só.
- **Backup e Manutenção:** em telas de 1440×900 os cartões ficavam uns por cima dos outros. Corrigido.
- **Relatórios por sessão:** as sessões agora saem em ordem de data (antes, em ordem de texto).
- **Detalhado:** a data do grupo aparece como 28/02/2026 (antes 2026-02-28).

## Atualização
- Feche todas as janelas da versão anterior antes de executar o **Setup 1.4.0**.
- O banco continua no esquema 8: **não há migração de banco** nem backup pré-migração nesta versão.
- Na primeira vez que alguém abrir **Relatórios**, os favoritos, recentes e modelos salvos dessa
  pessoa são convertidos para os relatórios novos. É automático, não apaga nada e fica registrado na
  auditoria como "Relatório consolidado". Detalhes em `MIGRATION-1.3.0-TO-1.4.0.md`.
- Depois de instalar, abra **Cadastros › Propriedades**, a propriedade padrão, e preencha o cartão
  **Cabeçalho dos relatórios** (e o logo) para ele sair nas folhas. Sem isso, o cabeçalho mostra só o
  nome da propriedade.

## Assinatura
- O pacote continua **não assinado** e pode gerar aviso do SmartScreen/Defender (ou ser retirado da
  pasta pelo antivírus). Não desative a proteção; a correção definitiva continua sendo uma assinatura
  Authenticode confiável.

## Teste físico
- Balança, impressora e curral: **não executados** nesta versão. A folha A4 (retrato e paisagem) foi
  conferida só em PDF gerado pelo Electron do projeto, com as mesmas opções do aplicativo; a impressão
  numa impressora de verdade fica para o teste da responsável.
