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
