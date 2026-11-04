# Configurações, Parametrização e Balança

As preferências e as regras ficam em telas diferentes, cada uma com a sua permissão. Cada valor é editado em um
lugar só.

| Tela | O que tem | Quem altera |
|---|---|---|
| **Sistema › Configurações** | **Geral:** marca, raça e propriedade padrão do Lançamento. **Segurança:** bloqueio por inatividade e tentativas de login. | Administrador |
| **Sistema › Parametrização** | Regras de negócio, cada seção com seu botão **Salvar seção**. Veja a lista abaixo. | Administrador; o Gestor altera **GMD e indicadores** |
| **Sistema › Balança e Equipamentos** | Balança ativa (S3, por Bluetooth ou COM), conexão, estabilidade da leitura e simulador. | Administrador |
| **Sistema › Usuários** | Usuários e papéis. | Administrador |

Seções da **Parametrização**:

- **Pesagens e alertas:** peso mínimo e máximo, alerta de GMD, variação máxima e intervalo de pesagem.
- **GMD e indicadores:** divisor da arroba e intervalo mínimo do GMD.
- **Comercial e saídas:** documento obrigatório na venda e rendimento de carcaça padrão.
- **Idade, era e categorias.**
- **Sanidade e carência:** um atalho para as posologias.
- **Calendário de seca e águas.**
- **Metas e cenários.**

Cada seção da Parametrização mostra **"alterações não salvas"** enquanto houver mudança pendente. Ela tem os
botões **Salvar seção** e **Descartar alterações**.

Mudar uma regra vale **daqui em diante**. Pesagens já gravadas não são reescritas.

## Bip de peso estável

Com a **pesagem automática** ligada no Lançamento, o sistema toca **um bip curto (cerca de 1 segundo)** quando o peso
do animal estabiliza e fica liberado para salvar.

- Toca **uma vez por animal**. Não repete enquanto o animal fica parado na balança, nem quando ele mexe e volta ao
  mesmo peso.
- **Não toca com a balança vazia** ou com peso zero.
- Depois de salvar, só toca de novo quando a balança mostrar o próximo animal: plataforma vazia ou peso bem
  diferente. É a mesma regra que impede reaproveitar o peso do animal anterior.
- Para desligar, desmarque **Bip curto (1 toque) quando o peso estabilizar** em **Sistema › Balança e Equipamentos**.

## O Lançamento lembra a sua lida

Durante a sessão, sair da tela de Lançamento (para a Relação, a Ficha do Animal ou outro menu) e voltar mantém o
que você montou:

- o tipo de movimentação e o **Motivo da Entrada**;
- marca, sexo, raça e categoria;
- a **sequência de brincos**, com o próximo número;
- os painéis abertos;
- a **pesagem automática**. Ela religa sozinha quando a balança estiver conectada.

Trocar entre Entrada, Manejo e Saída também mantém o contexto de cada tipo. O número do animal e o peso nunca são
guardados.

Com a **pesagem automática ligada**, trocar entre Entrada, Manejo e Saída **não zera o Peso**: o campo continua com
o peso da balança e com o mesmo estado (estável, estabilizando ou esperando o próximo animal). Antes, o campo ficava
vazio até o animal se mexer, porque a balança só manda leitura quando o número muda. Salvar continua exigindo peso
estável e novo: o peso já usado no animal anterior não serve para o próximo.

## Quadro de peso e lote destino

Ao lado da **Distribuição de Lotes** (painel Apartação) há um quadro opcional que mostra, em letra grande, o mesmo
peso do campo **Peso** e o **lote destino**, para ler de longe.

- Para abrir, clique no ícone de balança ao lado do título **Distribuição de Lotes**. Para fechar, use o **X** do quadro.
- O botão de setas alterna entre **Grande** e **Pequeno**.
- A cor indica o estado da balança: verde = estável, amarelo = estabilizando, cinza = peso já usado (esperando o
  próximo animal), azul = peso digitado.
- O lote segue a mesma regra do campo **Lote destino**: o lote escolhido em **Transferência de Lote**, ou o lote
  automático pela faixa de peso (**Não encontrado** quando nenhum lote aceita). Com o atalho de lote ligado e mais
  de um lote na faixa, mostra as teclas (F11, F12…).
- O quadro só mostra: o peso salvo continua sendo o da balança, conferido no Salvar.
- Aberto ou fechado, e o tamanho, ficam lembrados neste computador.
