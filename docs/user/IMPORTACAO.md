# Importação — trazer uma planilha para o sistema

A Importação traz para o sistema o que está numa planilha: **pesagens, saídas, cadastros e aplicações de sanidade**. Ela é um assistente de sete etapas e **nada é gravado antes de você confirmar**: o sistema lê o arquivo, compara com o que já existe e mostra, linha por linha, o que aconteceria.

No menu, abra **Operação › Importação**. Você também chega lá pela Relação de Pesagens, em **Mais opções › Importar CSV**, e pela tela de Sanidade, na aba **Aplicações › Importar aplicações** (que já abre o assistente no tipo certo).

## Quem pode fazer o quê

| Ação | Administrador | Gestor | Operador | Consulta |
|---|---|---|---|---|
| Abrir a Importação e analisar um arquivo | ✔ | ✔ | ✔ | — |
| Gravar pesagens, manejos e saídas | ✔ | ✔ | ✔ | — |
| Importar cadastros mestres (marcas, raças, causas, categorias) | ✔ | ✔ | — | — |
| Importar aplicações de sanidade | ✔ | ✔ | ✔ | — |
| Marcar “Criar cadastros que faltam” (marcas, raças, causas, programas, medicamentos) | ✔ | ✔ | — | — |

Quem não pode gravar pesagens vê a mensagem de acesso não permitido em vez da tela. Quem não pode gravar cadastros encontra as opções de cadastro desligadas, com a explicação do porquê.

## As sete etapas

| Etapa | O que você faz |
|---|---|
| **1. Arquivo** | Escolhe o CSV e confere nome, tamanho, quantas linhas e qual separador o sistema reconheceu. Aqui também dá para baixar os modelos de planilha. |
| **2. Tipo** | Responde se o arquivo tem mais de uma pesagem do mesmo animal. |
| **3. Colunas** | Liga cada coluna do arquivo a um campo do sistema. |
| **4. Regras** | Diz como ler datas e decimais, define a categoria e os valores iguais para todas as linhas. |
| **5. Conciliação** | Vê o resumo do que o sistema entendeu. Nada foi gravado ainda. |
| **6. Conferência** | Confere linha por linha e baixa o relatório de conciliação. |
| **7. Resultado** | Vê o que foi gravado e baixa o comprovante. |

A trilha no topo mostra em que etapa você está. Dá para **voltar** a qualquer momento; para **avançar**, a etapa atual precisa estar completa.

## Antes de começar: baixe o modelo

Na etapa **Arquivo** há modelos prontos:

- **Modelo de pesagens** — Data, NumeroAnimal, Marca, Sexo, Raça, Categoria, Peso, Apartação, Lote, Observação.
- **Modelo de saídas** — Data, NumeroAnimal, Marca, MotivoSaida, CausaMorte, Peso, Observação.
- **Modelo de aplicações de sanidade** — Data, NumeroAnimal, Marca, Programa, Medicamento, Dose, Unidade, Via, Observação.

Quando o tipo já está escolhido (por exemplo, ao entrar pela tela de Sanidade), aparece só o modelo daquele tipo.

Os modelos trazem **só o que você digita**. Peso anterior, data anterior, dias, ganho e GMD **não entram na planilha**: o sistema calcula tudo sozinho, pela data de cada pesagem do animal.

Salve a planilha como **CSV (separado por ponto e vírgula)**. O sistema também aceita vírgula e tabulação, e reconhece o separador sozinho.

## A pergunta da etapa Tipo

> **O arquivo tem mais de uma pesagem do mesmo animal?**

- **Sim — conciliar automaticamente (recomendado).** O sistema ordena as linhas por data: a pesagem mais antiga de cada animal novo vira **Cadastro** e as seguintes viram **Manejo**. Se o animal já existe no sistema, todas entram como Manejo — a não ser que o arquivo traga pesagem **mais antiga que o Cadastro** dele: aí a mais antiga passa a ser o Cadastro e o Cadastro antigo vira Manejo (veja "Cadastrei o animal hoje e quero importar as pesagens antigas" nas perguntas comuns). A ordem das linhas no arquivo não importa: vale a data.
- **Não — todas as linhas são do mesmo tipo.** Aí você escolhe entre **Cadastros de animais**, **Manejos** ou **Saídas**. Nesse modo, duas linhas do mesmo animal viram conflito.
- **Cadastros mestres.** Para uma planilha só de nomes: cada nome preenchido vira uma marca, raça, causa de morte ou categoria.
- **Aplicações de sanidade.** Para uma planilha de vacinas, vermífugos e tratamentos já aplicados: cada linha é uma aplicação ligada a um animal. Veja a seção própria mais abaixo.

**Saídas** têm fluxo próprio: o motivo da saída é obrigatório (Venda, Abate, Morte, Doação, Transferência, Outros) e o peso é opcional em Morte, Doação e Transferência.

## A linha de aferição do arquivo

A partir da etapa Colunas aparece uma linha como esta:

> 120 linhas · 80 animais diferentes · 30 animais com mais de uma linha (máx. 3 linhas para o mesmo animal)

É a contagem do **seu arquivo**, antes de qualquer análise. Se houver animais repetidos e o modo escolhido não for o conciliado, o sistema avisa e oferece o botão **Conciliar automaticamente**, que troca o modo e refaz a análise.

## Etapa Colunas

Cada coluna do arquivo tem um seletor com o campo do sistema. O sistema já sugere pelo nome da coluna ("Nº", "Brinco", "PesoKg" e outros apelidos são reconhecidos). Corrija o que estiver errado e marque **Não usar esta coluna** no que não interessa.

Só aparecem campos que **alguém digita**. Números internos do sistema e valores calculados (peso anterior, dias, ganho, GMD) não são oferecidos — e não devem estar na planilha.

Se faltar uma coluna obrigatória, a tela diz qual é e não deixa avançar.

## Etapa Regras

- **Formato das datas** e **separador dos decimais**: deixe em "Reconhecer sozinho" se não souber.
- **Categoria dos animais**: da planilha, uma categoria fixa para todos, ou **automática pelo peso** (usa faixa de peso e sexo). A automática vale **só para os animais criados no Cadastro**; manejos nunca mudam a categoria de um animal que já existe.
- **Valores iguais para todas as linhas**: marca, raça, sexo, apartação, lote e motivo da saída. O que vier na coluna do arquivo sempre vence o valor fixo.
- **Criar cadastros que faltam**: use quando a planilha cita cadastros que ainda não existem — marcas, raças e causas de morte nas pesagens; programas/procedimentos e medicamentos nas aplicações de sanidade. Exige permissão de cadastros; eles são criados **antes** dos registros.
- **Modelos de mapeamento**: salve as escolhas com um nome e reaproveite na próxima planilha do mesmo formato. O modelo guarda só as escolhas, nunca os dados do arquivo.

## Etapa Conciliação — o que cada número quer dizer

| Contagem | Significado |
|---|---|
| Linhas lidas | Quantas linhas de dados o arquivo tem. |
| Linhas a gravar | O que será criado. |
| Animais encontrados / Animais novos | Quantos já existiam e quantos serão criados. |
| Cadastros / Manejos / Saídas | Que tipo de registro cada linha virou. |
| Já existem | Linhas idênticas a algo que já está no sistema: não são gravadas de novo. |
| Ignoradas | Linhas que não pertencem a este tipo de importação. |
| Possíveis duplicidades | Mesma data, mesmo animal e mesmo peso repetidos. |
| Ambiguidades | Mais de um animal atende à linha (informe a marca para separar). |
| Conflitos | O arquivo diz uma coisa e o sistema diz outra. |
| Erros | Falta informação ou o valor não é aceito. |
| Cadastros mestres ausentes | Marcas, raças, causas ou categorias citadas e ainda não cadastradas. |
| Categorias resolvidas pelo peso / não resolvidas | Resultado da categoria automática. |

Quando há **erro, conflito ou ambiguidade**, a tela avisa em vermelho: **"Ainda não dá para importar"**, e o botão Importar fica desligado. Corrija o arquivo (ou os cadastros) e clique em **Refazer análise**.

A seção **Animais com várias linhas** mostra o que o sistema decidiu para cada animal repetido, por exemplo:

> 101 · ALFA — 3 linhas: 01/12/2025 Cadastro, 15/01/2026 Manejo, 01/03/2026 Manejo

## Etapa Conferência

A tabela traz uma linha por linha do arquivo, com a situação colorida:

| Situação | O que acontece |
|---|---|
| **NOVO** | Será gravada. |
| **JÁ EXISTE** | Já está no sistema; nada será gravado de novo. |
| **POSSÍVEL DUPLICIDADE** | Repetição do mesmo animal, data e peso. |
| **CONFLITO** | O arquivo discorda do sistema: resolva antes de gravar. |
| **ERRO** | Falta informação ou o valor não é aceito. |
| **AMBÍGUO** | Mais de um animal atende à linha. |
| **IGNORADA** | Fora deste tipo de importação. |

Use o seletor **Mostrar** para filtrar por situação e o botão **Baixar relatório de conciliação** para abrir o resultado no Excel.

## Gravar

O botão **Importar** abre uma confirmação com o que será gravado. Vale **fazer um backup antes** de importar um arquivo grande: abra **Sistema › Backup e Restauração** e clique em **Criar backup agora** (a Importação de planilha não faz backup sozinha). O **JSON técnico** exportado pelo sistema é importado no fim desta tela, em **Importar JSON de pesagens (técnico)**, que faz backup antes.

Durante a gravação aparece a barra de progresso. Não feche a janela.

## Etapa Resultado

Mostra tudo que foi gravado: cadastros, manejos, saídas, animais novos e conciliados, duplicidades ignoradas, séries recalculadas e cadastros mestres criados. Use **Baixar resultado** para guardar o comprovante.

Se aparecer **"Nada novo para gravar"**, é porque o arquivo já tinha sido importado: **nada é duplicado**.

## Importar aplicações de sanidade

Use este tipo quando você tem **as aplicações já feitas numa planilha**: uma linha por aplicação.

**Por onde entrar.** O caminho natural é **Operação › Sanidade › aba Aplicações › Importar aplicações**: o assistente abre já no tipo certo. Em **Mais opções › Baixar modelo de importação** você pega a planilha pronta. Também dá para escolher o tipo direto na etapa **Tipo** do assistente.

**As colunas.**

| Coluna | O que vai nela |
|---|---|
| **Data** | Data da aplicação. Não pode ser futura. |
| **NumeroAnimal** e **Marca** | Identificam o animal, como nas pesagens. O animal **precisa já existir**. |
| **Programa** | Nome do programa/procedimento (ex.: Vermifugação). |
| **Medicamento** | Nome do medicamento/produto (ex.: Ivermectina 1%). |
| **Dose**, **Unidade**, **Via** | Dose aplicada (ex.: 4,5), unidade (ml, mg, g, dose, comprimido, UI) e via (SC, IM, IV, Oral, Pour-on, Tópica, Intranasal, Outra). |
| **Observação** | Texto livre. |

Preencha **Programa, Medicamento ou os dois** — pelo menos um é obrigatório em cada linha. A planilha **não tem coluna de peso**: o sistema **não calcula dose pelo peso**.

**Como o sistema resolve cada linha.**

- O **animal** é encontrado pelo número + marca (a mesma regra das pesagens). Animal que não existe é **erro**; número que serve para mais de um animal é **ambiguidade** — informe a marca para separar.
- **Programa** e **medicamento** são reconhecidos **pelo nome**, sem diferenciar acentos nem maiúsculas. Nome que ainda não está cadastrado vira **cadastro ausente**: ou você cadastra antes, em **Operação › Sanidade**, ou marca **Criar cadastros que faltam** na etapa Regras (exige permissão de cadastros). Programa ou medicamento **inativo** é recusado: reative antes de importar.
- A **data** precisa estar dentro da vida do animal: não antes do Cadastro nem depois da saída.
- **Nenhuma pesagem é criada.** A aplicação fica ligada ao animal, na data do próprio evento, e aparece no histórico da aba Aplicações e na Ficha do Animal, com **origem Avulsa**.

**Repetir não duplica.** Se a mesma aplicação (mesmo animal, data, programa, medicamento e dose) já estiver no sistema, a linha vem como **JÁ EXISTE** e não é gravada. Importar o mesmo arquivo duas vezes não cria nada de novo.

Na etapa **Conferência**, a coluna que mostra a categoria nas pesagens passa a mostrar **a aplicação** de cada linha (por exemplo, `Aftosa / Vacina aftosa · 5 ml · SC`).

## Perguntas comuns

**Importei o mesmo arquivo duas vezes. E agora?**
Nada acontece. O sistema reconhece o que já gravou e ignora. A tela até avisa, na Conciliação, que aquele arquivo já foi importado antes.

**A planilha traz peso anterior, dias e GMD. Posso deixar?**
Pode, mas esses valores **não são importados**: o sistema recalcula a série do animal pela data. Se o valor da planilha for diferente do recalculado, isso aparece como observação na conferência.

**O número do brinco na planilha está com zero na frente (01016) ou com ",0" (1016,0).**
O sistema reconhece: "01016", "1016,0" e "1016.0" encontram o animal **1016** já cadastrado, e o número dele não muda. Na Conciliação aparece o aviso "N linhas casaram com animais existentes por número parecido", com os exemplos. Número com letra ("A01" e "A1") continua diferente. Número igual ao cadastrado sempre vence. Se o número da planilha só é parecido com o de dois animais ("007", com os animais "07" e "7" na mesma marca), a linha fica **ambígua**: corrija o número na planilha.

**Cadastrei o animal hoje e quero importar as pesagens antigas dele.**
Use **Sim — conciliar automaticamente**. Se o arquivo traz pesagens mais antigas que o Cadastro já gravado, a mais antiga passa a ser o **Cadastro** e o Cadastro de hoje vira **Manejo**, com dias, ganho e GMD calculados. A Conciliação mostra a troca antes de gravar (por exemplo: "O Cadastro de 29/09/2026 do animal 701 passa a Manejo; o novo Cadastro é 02/06/2026."). Nos tipos Manejos, Cadastros e Saídas, pesagem anterior ao Cadastro continua sendo conflito.

**O sistema disse que a marca não está cadastrada.**
Cadastre a marca antes (**Cadastros › Marcas**) ou volte à etapa Regras e marque **Criar marcas, raças e causas que faltam**.

**A importação parou no meio.**
Refaça a análise e importe de novo: a gravação continua de onde parou, sem duplicar o que já entrou.

**Importei aplicações de sanidade e o programa saiu com o tipo “Outro”.**
É o esperado quando o programa foi criado pela própria importação: a planilha só traz o nome. Abra **Operação › Sanidade › Programas/Procedimentos** e ajuste o tipo e a descrição.
