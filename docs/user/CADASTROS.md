# Cadastros

Desde a versão 1.2.0 o programa tem cadastros próprios para as informações que
se repetem em muitos lançamentos. A regra é simples: **cadastre antes, escolha
no lançamento**. Em vez de digitar "Nelore" ou o nome do comprador toda vez,
você escolhe em uma lista, e o programa passa a saber que se trata sempre do
mesmo item.

Menu **Cadastros**:

| Cadastro | Serve para |
|---|---|
| **Marcas** | Marca a fogo (ou marca do dono) que identifica de quem é o animal. Faz parte da identidade do animal junto com o número. |
| **Raças** | Raça do animal (Nelore, Angus, Cruzado etc.). |
| **Categorias** | Classificação do animal por sexo e idade (Bezerro, Garrote, Novilha, Boi, Vaca, Touro...). |
| **Parceiros** | Compradores, vendedores, frigoríficos, transportadores e donos de marca. Uma pessoa ou empresa é um único parceiro, mesmo que tenha vários papéis. |
| **Propriedades** | Fazendas/propriedades: a sua (própria) e as de terceiros (origem de compras, destino de transferências). |
| **Causas de Morte** | Motivos usados na saída por morte. |

Quem pode alterar: **ADMIN** e **GESTOR**. **OPERADOR** só consulta (as listas
aparecem, mas sem os botões de criar, editar e inativar).

## Regras comuns a todos os cadastros

- **Nome único.** O programa compara os nomes ignorando maiúsculas/minúsculas e
  espaços a mais. "Nelore", "NELORE" e " nelore " são o mesmo nome; o segundo é
  recusado com uma mensagem clara.
- **Padrão.** Alguns cadastros aceitam **um** item marcado como padrão (marca,
  raça e propriedade). O padrão já vem escolhido no cadastro rápido do curral,
  para digitar menos; você troca quando o animal for diferente.
- **Inativar em vez de excluir.** Se o item já foi usado em algum animal ou
  lançamento, ele **não pode ser excluído**: use **Inativar**. O item inativo
  some das listas de escolha, mas continua aparecendo nos registros antigos.
  Para voltar a usar, **Reative**.
- **Excluir** só funciona quando nada usa o item. Mesmo assim o programa apenas
  marca o registro como excluído (não apaga fisicamente), e a ação fica no
  histórico.
- **Renomear não reescreve o passado.** Se você renomear uma marca ou raça, os
  lançamentos antigos continuam guardando o texto da época; as telas passam a
  mostrar o nome atual porque o vínculo é feito pelo cadastro, não pelo texto.
- **Histórico.** Criar, alterar, inativar e excluir ficam registrados com o
  usuário que fez.
- **Contagem de uso.** A lista mostra quantos animais (ou operações) usam cada
  item, para você saber o impacto antes de inativar.

## Marcas

Campos: **Nome** (obrigatório), **Abreviação** (até 6 letras, aparece nas
tabelas), **Proprietário** (um parceiro com o papel "dono de marca"),
**Propriedade**, **Padrão** e **Observação**.

A marca é parte da identidade do animal: o **mesmo número pode existir em
marcas diferentes**, e o programa pergunta qual você quer quando encontra o
número em mais de uma marca. Por isso uma marca digitada errada em versões
antigas criava um "animal novo". Com o cadastro isso deixa de acontecer.

## Raças

Campos: **Nome**, **Abreviação**, **Grupo** (Zebuíno, Taurino, Cruzado, Outro;
serve só para agrupar relatórios), **Padrão** e **Ordem** (posição na lista).

A raça padrão substitui o antigo "Nelore" fixo do programa. Cadastre só as raças
que você usa: lista curta é mais rápida no curral.

## Categorias

Campos: **Nome**, **Sexo aplicável** (Macho, Fêmea ou Ambos), **Idade mínima**
e **Idade máxima** em meses (opcionais) e **Ordem**.

O programa já vem com as categorias usuais (Bezerro, Bezerra, Garrote, Novilha,
Boi, Vaca, Touro). Você pode editar, inativar ou criar outras. Quando o animal
tem data de nascimento, o programa **sugere** a categoria pela idade e pelo
sexo, mas nunca troca sozinho uma categoria que você informou.

## Parceiros

Campos: **Nome**, **Tipo** (pessoa física ou jurídica), **CPF/CNPJ** (opcional,
mas único quando informado; veja "CPF/CNPJ com máscara" abaixo), **Papéis** (Comprador,
Vendedor, Frigorífico, Transportador, Proprietário de marca; pode marcar
vários), **Telefone**, **E-mail**, **Cidade**, **UF**, **Registro SIF** (só para
frigorífico), **Rendimento padrão** (sugestão de rendimento de carcaça para
frigorífico/comprador) e **Observação**.

Um frigorífico que também compra bezerros é **um único** parceiro com dois
papéis. Nas versões seguintes, vendas, abates e embarques apontam para o
parceiro, e não para o nome digitado.

Os antigos "Cadastros Comerciais" (compradores, vendedores e frigoríficos em
listas separadas) foram convertidos automaticamente em parceiros na primeira
abertura da versão 1.2.0, unindo registros com o mesmo CPF/CNPJ ou o mesmo nome.

### CPF/CNPJ com máscara (1.4.0)

Nas fichas de **Parceiros** e de **Propriedades**, o campo **CPF/CNPJ** se
formata enquanto você digita:

| Você digita | Aparece |
|---|---|
| até 11 números | CPF `000.000.000-00` |
| 12 a 14 números | CNPJ `00.000.000/0000-00` |
| letras nas 12 primeiras posições | CNPJ alfanumérico `12.ABC.345/01DE-35` (em maiúsculas) |

- **Colar** também funciona, com ou sem pontuação e até com o rótulo na frente
  (digitado ou colado): "123.456.789-01", "12345678901", "CNPJ: 11.222.333/0001-81",
  "CNPJ-12.345.678/0001-90", "12abc34501de35".
- **CNPJ alfanumérico** só é salvo se estiver completo e com os dígitos
  verificadores certos; se não, o **Salvar** avisa "o CNPJ alfanumérico está
  incompleto ou com os dígitos verificadores errados" e nada é gravado.
- Cabem no máximo **14** posições; a tecla a mais é ignorada.
- Dá para corrigir no meio: o cursor fica onde você está e o Backspace logo
  depois de um ponto apaga o número antes dele.
- O que é **guardado** continua sem pontuação (só os números, ou o CNPJ
  alfanumérico com as letras). Ao abrir a ficha de novo, o documento aparece
  formatado. A dica de formato aparece quando você clica no campo.

## Propriedades

Campos: **Nome**, **Tipo** (Própria ou Terceiro), **Parceiro** (dono, quando
for de terceiro), **Município**, **UF**, **Código oficial** (o código usado na
GTA, sem validação) e **Padrão**.

O programa cria uma propriedade própria chamada **"Propriedade principal"** na
primeira abertura, marcada como padrão. Renomeie para o nome da sua fazenda.
Vendedores que tinham "propriedade" escrita em texto ganham uma propriedade de
terceiro ligada a eles.

### Cabeçalho dos relatórios (1.4.0)

Na ficha da propriedade, o cartão **Cabeçalho dos relatórios** define o que sai
no alto de cada relatório impresso: **Produtor / razão social**, **Endereço**,
**CPF/CNPJ**, **Inscrição estadual**, **Mostrar CPF/CNPJ e IE no cabeçalho**,
**Telefone** e **Logo** (PNG ou JPG; o programa reduz sozinho para até 400
pixels de largura e 300 KB). Ao lado, a **pré-visualização** mostra como vai
sair. Vale para a propriedade **Padrão** e para o relatório filtrado por aquela
propriedade. O logo vai no backup e volta na restauração. Veja
`RELATORIOS.md`, item "Cabeçalho da propriedade".

## Causas de Morte

Campos: **Nome**, **Categoria** (Doença, Acidente, Predação, Parto,
Desconhecida, Outra), **Descrição**, **Exige observação** (quando marcado, a
saída por morte só é aceita com uma observação preenchida) e **Ordem**.

As causas cadastradas na versão anterior foram mantidas com os mesmos
registros.

## De onde vieram os dados na atualização

Na primeira abertura da versão 1.2.0 o programa monta os cadastros a partir do
que já existia nos seus lançamentos:

- **Marcas** e **raças**: cada texto diferente que aparecia nos animais vira um
  item. Grafias que só diferem em maiúsculas/espaços são unidas em um item só
  (para marcas, apenas quando a união não fizer dois animais diferentes ficarem
  com o mesmo número; nesse caso o programa mantém as marcas separadas e avisa
  no relatório da migração).
- **Categorias**: as sete categorias usuais são criadas.
- **Parceiros**: vindos dos Cadastros Comerciais e dos compradores antigos.
- **Propriedades**: a "Propriedade principal" e as propriedades dos vendedores.
- **Causas de morte**: as mesmas do cadastro anterior.

Depois da atualização, revise as listas: junte, renomeie ou inative o que
estiver duplicado ou fora de uso. Veja também `docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md`.
