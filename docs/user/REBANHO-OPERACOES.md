# Rebanho — Entradas, Saídas, Movimentações e Inventário

Estas telas registram **o que acontece com o rebanho**: quem entrou, quem saiu e para onde cada animal foi.
Pesar **não é obrigatório** para registrar uma entrada, uma saída ou uma movimentação. Quando houver peso, ele é
gravado como pesagem, igual ao Lançamento.

No menu, abra **Rebanho** e escolha uma das telas:

| Tela | O que registra |
|---|---|
| **Entradas** | Compra, Transferência recebida, Nascimento e Ajuste de inventário (entrada) |
| **Saídas** | Venda, Abate, Transferência enviada, Morte, Doação e Ajuste de inventário (saída) |
| **Movimentações** | Mudança de lote ou de propriedade, sem pesagem |
| **Inventário** | Saldo do período, conferido animal por animal |

## Quem pode fazer o quê

| Ação | Administrador | Gestor | Operador | Consulta |
|---|---|---|---|---|
| Ver as telas e o inventário | ✔ | ✔ | ✔ | ✔ |
| Lançar, salvar rascunho e confirmar | ✔ | ✔ | ✔ | — |
| Cancelar uma operação confirmada | ✔ | ✔ | ✔ | — |

## Como funciona uma operação

1. Clique em **Nova entrada**, **Nova saída** ou **Nova movimentação**.
2. Preencha o **cabeçalho**:
   - a data e o tipo da operação;
   - o parceiro (vendedor, comprador ou frigorífico);
   - as propriedades e o lote de destino;
   - GTA e NF-e, quando se aplicam;
   - o valor total e a observação.
3. Inclua os **animais**:
   - **na Entrada**, uma linha por animal novo (número, marca a fogo, sexo, raça, peso);
   - **na Saída e na Movimentação**, escolha animais ativos. Para adicionar vários de uma vez, filtre por
     número, lote, sexo ou raça e clique em **Adicionar todos**.
4. Clique em **Conferir e confirmar**. A conferência mostra dois tipos de mensagem:
   - **Bloqueios** impedem a confirmação. Exemplos: animal repetido, identificação repetida, identificação
     já em uso.
   - **Avisos** pedem que você marque **Conferi os avisos acima** antes de confirmar. Exemplos: quantidade
     diferente da prevista, animal sem peso, animal sem número.
5. Para continuar depois, use **Salvar rascunho**. Para jogar fora o rascunho, use **Descartar**.

A confirmação grava **tudo ou nada**. Se um animal tiver problema (por exemplo, já ter saído do rebanho),
nenhum animal da operação é gravado, e a mensagem diz qual animal causou o problema.

## Entradas

- **Animal sem peso** fica **pendente de pesagem**. O sistema não inventa peso, nem 0 kg.
  - Quando o animal for pesado pela primeira vez, faça o **Cadastro** no Lançamento com o mesmo número e marca.
  - O sistema reconhece o animal da entrada e não cria um segundo animal nem uma segunda entrada.
- **Animal sem número** fica **pendente de identificação**.
- **Nascimento**:
  - pode registrar a **mãe**, se você souber qual é;
  - grava a data de nascimento como a data da operação.

## Saídas

- **Venda e Abate** exigem o peso. Ele pode ser o peso da balança ou o peso **informado no negócio**; informe
  a origem em **Origem do peso**.
- **Morte, Doação e Transferência** aceitam saída sem peso.
- **Ajuste de inventário** exige uma justificativa. Use quando a contagem física não bate com o sistema.
- Cada animal tem **uma saída só**. Uma saída gera a pesagem de Saída, com o motivo, que aparece na Relação de
  Pesagens e nos relatórios como sempre.

## Movimentações

- **Mudança de lote:** o animal passa para o lote de destino a partir da data informada. A pesagem seguinte no
  lote novo não gera outra mudança de lote.
- **Mudança de propriedade:** troca a propriedade do animal. Se você também escolher um lote, troca o lote
  junto.

## Cancelar

Abra a operação confirmada, escreva o **motivo** e clique em **Cancelar operação**.

- O efeito sobre o rebanho é desfeito. Exemplo: a venda cancelada devolve o animal ao rebanho.
- O histórico fica guardado, com o motivo do cancelamento.
- **Entrada:** não pode ser cancelada se o animal já tiver pesagens ou movimentações depois dela. Cancele
  essas antes.
- **Operações legadas**, criadas na atualização a partir das pesagens antigas, se corrigem pela
  **Relação de Pesagens**.

## Inventário

Escolha o período e, se quiser, filtre por lote, propriedade, sexo, raça, marca ou categoria. Depois clique
em **Calcular**. A conta é:

> saldo inicial + entradas + nascimentos − saídas − mortes ± ajustes = saldo final

- O saldo considera a **data de cada evento**, não a situação de hoje. O saldo de 31/03 mostra o rebanho de
  31/03, mesmo que um animal tenha sido vendido depois.
- **Operações canceladas** não entram na conta.
- **Por lote ou por propriedade:** as transferências internas aparecem separadas. Elas não contam como compra
  nem como venda.
- **Conferência:** o saldo é comparado com o cadastro dos animais. As **divergências** aparecem por animal,
  com o motivo. **Nada é corrigido automaticamente**: corrija na operação ou na pesagem de origem.
- **CSV** exporta o resumo, a lista de animais do saldo final e as divergências.

## Idade, era, dentição e rastreabilidade (Ficha do Animal)

Abra o animal em **Rebanho › Animal**. O quadro **Identidade, idade e rastreabilidade** mostra cada dado com
sua **fonte** e sua **certeza**.

- **Nascimento.** Use **Corrigir nascimento/idade** e escolha uma das formas:
  - **Data exata**;
  - **Mês e ano estimados**: a idade aparece como faixa, por exemplo "11 a 12 meses";
  - **Idade declarada** em uma data, por exemplo "18 meses em 10/01/2026";
  - **Desconhecida**.

  Informe sempre a fonte (documento da compra, declaração do vendedor…). A correção fica registrada na
  auditoria.
- **Idade.** É calculada para o dia de hoje e muda sozinha com o calendário, sem precisar pesar o animal.
  Quando o nascimento é desconhecido, aparece "Idade desconhecida": nenhuma data é inventada.
- **Era.** É a faixa de **idade**, configurável em **Sistema › Parametrização**. A classe por **peso** dos
  lançamentos antigos continua guardada como histórico e aparece separada.
- **Categoria produtiva** (garrote, novilha, matriz…). Você grava na ficha. Se a Parametrização ligar a
  sugestão, o sistema sugere uma pela idade e pelo sexo; a categoria gravada sempre prevalece.
- **Dentição.** Registre o que foi **observado** (0, 2, 4, 6 ou 8 dentes) e a data. A dentição nunca é deduzida
  da idade.
- **Identificadores.** Aplique um brinco, RFID ou SISBOV ao animal ou faça a **troca** (perdido, danificado
  ou retirado). O animal continua o mesmo, e o código antigo fica no histórico.
- **Dossiê.** Os botões **Dossiê CSV** e **JSON** exportam origem, documentos, propriedades, lotes, sanidade
  com carência, dentição, destino e a lista do que **não foi informado**. O dossiê é interno: **não é
  certificado** SISBOV, EUDR nem documento oficial.

## Identificadores (estoque de brincos)

Abra **Cadastros › Identificadores**.

- **Receber:** escolha o tipo e informe uma faixa (prefixo, início e fim) ou uma lista de códigos.
  - Se algum código já estiver no estoque, o recebimento inteiro é cancelado.
  - "SN" não é código de estoque.
  - O SISBOV tem 15 dígitos.
- **Situação de cada código:**
  - Disponível, Reservado ou Aplicado;
  - Perdido, Danificado, Devolvido ou Bloqueado.

  O saldo é contado pelo histórico de cada código.
- **Aplicar no animal:** é feito na Ficha do Animal, e o saldo muda uma única vez. Um código **SISBOV ou RFID**
  que já foi aplicado nunca volta ao estoque.
- **Conferência física:** cole os códigos contados no almoxarifado. A tela mostra o que **falta** e o que
  **sobra**. Nada é ajustado sozinho.

## Marcas a Fogo

O cadastro **Marcas** passou a se chamar **Marcas a Fogo**, que é a marca a ferro no animal. Os dados e as
planilhas de importação continuam iguais, e a coluna **Marca** dos modelos continua aceita. Brinco, RFID e
SISBOV ficam em **Identificadores**.

## Documentos e anexos

Na consulta de uma **operação** e na **Ficha do Animal**, o quadro **Documentos** registra os documentos ligados
a ela: GTA, NF-e, romaneio, laudo, comprovante, certificado, evidência sanitária ou outro.

1. Clique em **+ Documento** e informe o tipo, o número, a data e o emissor.
2. Para guardar o arquivo, clique em **Anexar arquivo** e escolha o arquivo no seu computador.
   - Formatos aceitos: PDF, imagem, XML, TXT ou CSV.
   - Tamanho máximo: 25 MB.
   - O arquivo é copiado para a pasta **anexos**, dentro da pasta de dados do aplicativo. O banco guarda só a
     "impressão digital" (SHA-256) do arquivo.
3. **Cancelar documento** pede um motivo. O arquivo continua guardado.

### Anexos no backup

- **Criar backup agora** grava o arquivo do backup e, ao lado dele, a pasta
  **`backup-completo-….anexos`** com todos os anexos, cada um conferido.
- **Anexo que sumiu** da pasta de anexos impede o backup de ser chamado de completo, e o aviso diz quantos
  faltam.
- **Ao copiar o backup** para um pendrive, leve o **arquivo `.json` e a pasta `.anexos`** juntos.
- **Na restauração,** os anexos voltam da pasta `.anexos` ao lado do arquivo escolhido. Se a pasta não estiver
  lá, o aplicativo avisa quantos anexos faltaram.
