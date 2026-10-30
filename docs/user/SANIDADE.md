# Sanidade — programas, medicamentos e aplicações

A Sanidade registra **o que foi aplicado em cada animal**: vacinas, vermífugos, tratamentos e outros procedimentos. Tudo fica no próprio computador, junto das pesagens, e entra no backup.

No menu, abra **Operação › Sanidade**. A tela tem três abas:

| Aba | Para que serve |
|---|---|
| **Programas/Procedimentos** | Lista do que se faz no rebanho (ex.: Vermifugação, Vacinação contra aftosa). |
| **Medicamentos/Produtos** | Produtos usados, com unidade, dose e via padrão. |
| **Aplicações** | Histórico de tudo que foi aplicado, por animal e por período. |

## Quem pode fazer o quê

| Ação | Administrador | Gestor | Operador | Consulta |
|---|---|---|---|---|
| Ver a tela e o histórico | ✔ | ✔ | ✔ | ✔ |
| Cadastrar, editar, inativar e reativar programas e medicamentos | ✔ | ✔ | — | — |
| Registrar aplicação (no Lançamento ou avulsa) | ✔ | ✔ | ✔ | — |
| Importar aplicações de uma planilha | ✔ | ✔ | ✔ | — |
| Cancelar aplicação | ✔ | ✔ | ✔ | — |

Quem não pode gravar vê os botões ocultos e abre os cadastros em **Consultar** (somente leitura).

## Exemplo 1 — cadastrar o programa "Vermifugação"

1. Abra a aba **Programas/Procedimentos** e clique em **Novo**.
2. Preencha:
   - **Nome:** Vermifugação
   - **Tipo:** Vermifugação
   - **Ordem:** 1 (opcional; define a posição nas listas)
   - **Descrição:** Vermifugação de rotina na entrada do período das águas (opcional)
3. Clique em **Salvar** (ou tecle Enter).

Não é possível ter dois programas **ativos** com o mesmo nome.

## Exemplo 2 — cadastrar o medicamento "Produto X" (10 ml, subcutânea)

1. Abra a aba **Medicamentos/Produtos** e clique em **Novo**.
2. Preencha:
   - **Nome:** Produto X
   - **Princípio ativo** e **Fabricante:** como estão na bula (opcionais)
   - **Unidade padrão:** ml
   - **Dose padrão:** 10
   - **Via de aplicação:** Subcutânea (SC)
   - **Carência (dias):** o número de dias da bula (opcional)
3. Clique em **Salvar**.

A **dose padrão** é uma referência. Quando ela é só um número (como `10`), o sistema já preenche a dose ao aplicar. Quando é um texto (como `1 ml / 50 kg`), ela aparece apenas como lembrete e você digita a dose aplicada. O sistema **não calcula dose pelo peso**.

A **carência** é informativa: aparece como lembrete e não bloqueia vendas nem abates.

## Exemplo 3 — aplicar no Lançamento, animal após animal

É o jeito mais rápido no curral: a aplicação é gravada **junto com a pesagem**.

1. Abra **Lançamento** no tipo **Cadastro** ou **Manejo**.
2. Informe o animal e o peso normalmente.
3. Abra o painel **Sanidade** e clique em **Adicionar aplicação**.
4. Escolha **Programa/Procedimento:** Vermifugação e **Medicamento/Produto:** Produto X. A dose (10), a unidade (ml) e a via (SC) vêm preenchidas; altere se precisar.
5. Para vermifugar o lote inteiro em sequência, marque **Aplicar esta configuração aos próximos animais**.
6. Salve o lançamento. A mensagem de sucesso informa quantas aplicações foram gravadas.
7. Passe para o próximo animal: a mesma aplicação já vem pronta. Desmarque a opção quando terminar.

A aplicação recebe a **data da pesagem** e fica ligada a ela. Se a pesagem ou qualquer aplicação tiver erro, **nada é gravado** — corrija e salve de novo. Registrar sanidade no lançamento é opcional.

## Exemplo 4 — aplicação avulsa (sem pesar)

Use quando o animal foi medicado fora de um dia de pesagem.

1. Abra a aba **Aplicações** e clique em **Registrar aplicação**.
2. Em **Animal**, digite o número e/ou a marca (ex.: `1234` ou `1234 ABC`) e escolha o animal na lista.
3. Informe a **Data** (não pode ser futura), o **Programa/procedimento** e/ou o **Medicamento/produto** (pelo menos um dos dois), a **Dose**, a **Unidade**, a **Via** e, se quiser, uma **Observação**.
4. Clique em **Registrar**.

## Exemplo 5 — importar aplicações de uma planilha

Use quando as aplicações já foram feitas e estão anotadas numa planilha (uma linha por aplicação).

1. Abra a aba **Aplicações**.
2. Em **Mais opções › Baixar modelo de importação**, pegue a planilha pronta com as colunas
   **Data, NumeroAnimal, Marca, Programa, Medicamento, Dose, Unidade, Via, Observação**.
3. Preencha e salve como **CSV (separado por ponto e vírgula)**.
4. Clique em **Importar aplicações**. O assistente de Importação abre já no tipo **Aplicações de sanidade**.
5. Siga as etapas do assistente. Na **Conferência** você vê, linha por linha, qual aplicação será criada para qual animal — **nada é gravado antes de você confirmar**.

O que o sistema exige:

- o **animal precisa existir** (ele é encontrado pelo número + marca; sem marca, um número repetido em duas marcas vira ambiguidade);
- cada linha precisa de **programa, medicamento ou os dois**;
- **programa e medicamento são reconhecidos pelo nome**. Se ainda não estiverem cadastrados, ou você cadastra antes (abas Programas/Procedimentos e Medicamentos/Produtos), ou marca **Criar cadastros que faltam** na etapa Regras do assistente — isso exige permissão de cadastros, e o programa criado assim nasce com o tipo **Outro**;
- a **data** não pode ser futura nem ficar fora da vida do animal (antes do cadastro ou depois da saída);
- **dose, unidade e via** seguem as mesmas listas da tela. A planilha não tem coluna de peso: o sistema **não calcula dose pelo peso**.

As aplicações importadas entram como **origem Avulsa** e **não criam pesagem nenhuma**. Importar o mesmo arquivo duas vezes **não duplica**: a aplicação repetida (mesmo animal, data, programa, medicamento e dose) aparece como **JÁ EXISTE** e não é gravada.

O passo a passo completo do assistente está em `IMPORTACAO.md`.

## Consultar o histórico

Na aba **Aplicações**, use a faixa de filtros:

- **Animal:** número ou marca;
- **Período:** data inicial e final;
- **Programa** e **Medicamento**;
- **Incluir canceladas:** mostra também o que foi cancelado.

As colunas mostram data, animal, marca, programa, medicamento, dose, via, observação, **responsável** (usuário que registrou), **origem** (*Lançamento* ou *Avulsa* — aplicações importadas de planilha entram como Avulsa) e **situação** (*Aplicada* ou *Cancelada*). A pesquisa da barra e os filtros de cada coluna refinam o que já está na tela; **Mais opções › Configurar colunas** escolhe e ordena as colunas.

Na **Ficha do Animal**, a seção **Sanidade** lista todas as aplicações daquele animal, das mais recentes para as mais antigas, com as canceladas marcadas e o motivo do cancelamento.

## Cancelar uma aplicação

1. Na aba **Aplicações**, marque **uma** aplicação.
2. Clique em **Cancelar aplicação**.
3. Escreva o **motivo** (obrigatório) e confirme.

A aplicação **não é apagada**: continua no histórico como *Cancelada*, com a data do cancelamento e o motivo (use **Incluir canceladas** para vê-la). Quando uma pesagem é excluída, as aplicações registradas com ela são canceladas automaticamente com o motivo "pesagem cancelada".

## Inativar programas e medicamentos

Selecione o cadastro e clique em **Inativar**. Ele some das listas de escolha do Lançamento e das aplicações novas, mas o histórico continua mostrando o nome. Para voltar a usar, selecione e clique em **Reativar**.

## O que a Sanidade NÃO faz

- **Estoque** de medicamentos (entradas, saídas, saldo, lotes e validade do produto);
- **Compras** e custos de medicamentos;
- **Prescrição** ou receituário veterinário;
- **Calendário** ou agenda de próximas aplicações e alertas de reforço;
- **Cálculo de dose** pelo peso do animal (nem na tela, nem na importação);
- **Bloqueio por carência** em vendas e abates;
- Diagnóstico, prontuário clínico, financeiro ou documentos fiscais.

## Dados e backup

Programas, medicamentos e aplicações ficam em áreas próprias do banco local e entram no **backup completo** (veja `BACKUP-E-RESTAURACAO.md`). Toda gravação, inativação e cancelamento fica registrada na auditoria com o usuário responsável.

## Posologias, dose sugerida e carência

### Posologia (aba Posologias)

A posologia é a **regra de dose** de um medicamento, tirada da bula, do receituário ou do protocolo do
veterinário responsável. Ela pode ser de dois modos:

- **proporcional ao peso**: por exemplo, 1 ml a cada 50 kg;
- **tabela de faixas da bula**: peso mínimo, peso máximo e a dose de cada faixa.

1. Clique em **Nova posologia** e preencha:
   - princípio ativo, apresentação, indicação e via;
   - o modo e a unidade;
   - o arredondamento, se a bula pedir (nenhum, ao mais próximo, para cima ou para baixo, com o passo);
   - a dose mínima e a máxima;
   - a **carência de carne** e a **de leite**, em dias;
   - a fonte e o início da vigência.
2. **Carência:** campo vazio = **desconhecida**. Isso é diferente de **0 dias**.
3. **Aprovar:** só um **responsável técnico** aprova (nome e registro), e só quando a regra está completa.
4. **Depois de aprovada,** a posologia não se edita. Para mudar, crie uma **nova versão**; a anterior vira
   "Substituída". A dose **padrão em texto** do medicamento continua apenas como referência.
5. **Testar:** em **Testar**, digite um peso para ver a dose calculada. Nada é gravado.

### Dose sugerida (Lançamento e aplicação avulsa)

Com uma posologia **aprovada e vigente**, o painel de Sanidade mostra a **dose sugerida** pelo peso do animal.

- **No Lançamento,** é usado o peso da tela. Na pesagem automática, a sugestão só aparece com o peso **estável**
  da balança.
- **Na aplicação avulsa,** é usado o **último peso registrado**, com aviso se for antigo.

Usar a sugestão é opcional:

1. Clique em **Usar dose sugerida**, ajuste a dose se necessário e marque **Confirmo a dose aplicada**.
2. O registro guarda a dose sugerida, a dose aplicada, o peso usado e uma **cópia da regra**. Se a posologia
   mudar depois, as aplicações antigas não mudam.
3. Se o peso mudar depois da sugestão, a dose calculada é desfeita e precisa ser recalculada.

O sistema não calcula dose quando:

- a posologia está em rascunho, incompleta ou vencida;
- o animal não tem peso;
- o peso é estimado;
- o peso está fora das faixas da bula.

Nesses casos, você pode aplicar a sua própria dose manualmente.

### Carência

O fim da carência é **a data da aplicação + os dias de carência**, contados no calendário. Eles vêm da
posologia ou, sem posologia, da carência do medicamento.

- **Saída para abate** de animal em carência de carne é **bloqueada**. Para liberar, um gestor registra a
  **liberação técnica**: responsável técnico, motivo, evidência (laudo, documento) e data. A liberação fica na
  operação e na auditoria.
- **Venda, transferência e doação** de animal em carência mostram um aviso que precisa ser conferido.
- **Aplicação de medicamento sem carência cadastrada** tem **carência desconhecida**. Ela nunca é tratada como zero
  e **não vence com o tempo**: uma aplicação de 181 dias, ou de anos atrás, continua pendente. As dos últimos 180
  dias aparecem como alerta recente. A pendência só se resolve de dois jeitos:
  - **Esclarecer a carência:** em **Sanidade › Aplicações**, selecione a aplicação e use **Esclarecer carência**.
    Informe os dias, a fonte (bula, receituário ou laudo) e o responsável técnico. O fim da carência é contado a
    partir da data da aplicação, e o registro fica na auditoria.
    Os dias precisam ser um número inteiro, de 0 a 9999. São recusados:
    - campo vazio ou só com espaços;
    - texto, decimal ou número negativo;
    - números com separador, como `1.000` ou `1,5`.

    Nada disso vira zero. **Zero dias** só é aceito com a caixa **"Confirmo que a fonte indica carência de 0 dia"**
    marcada, e essa confirmação fica registrada;
  - **Liberação técnica documentada** na operação de abate, como abaixo.

  Enquanto estiver pendente:
  - no **abate**, ela **bloqueia** a saída. Só libera com a liberação técnica **documentada**: responsável, motivo
    e **evidência** (bula, receituário ou laudo), com **data no dia ou depois do tratamento**. Só conferir o aviso
    não basta;
  - na **venda, transferência e doação**, ela mostra um aviso que precisa ser conferido.
- O **abate lançado direto no Lançamento** (Saída › Abate) segue a mesma regra. Com carência aberta ou
  desconhecida, ele é recusado. Faça o abate em **Rebanho › Saídas**, onde a liberação técnica é registrada.
- Aplicação cancelada não conta. Carência de 0 dia libera no mesmo dia. Carência já vencida não prende.
- Isto é uma **proteção operacional do sistema**, não uma decisão veterinária automática.
