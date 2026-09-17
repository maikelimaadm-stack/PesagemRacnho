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
