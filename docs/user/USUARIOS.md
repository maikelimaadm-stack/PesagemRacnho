# Usuários e perfis

Cada pessoa que usa o programa tem o seu próprio **usuário** (login + senha) e
um **perfil**, que define o que ela pode fazer. Existem quatro perfis fixos:

| Perfil | Para quem | Resumo |
|---|---|---|
| **ADMIN** | Responsável pelo sistema | Faz tudo, inclusive gerenciar usuários, restaurar backup, limpar dados e alterar configurações. |
| **GESTOR** | Escritório / gerência | Lança e consulta pesagens, mantém os cadastros, fecha sessões, vê os valores comerciais, consulta, imprime e exporta relatórios e cria backups. Não gerencia usuários nem restaura/limpa dados. |
| **OPERADOR** | Curral / campo | Lança pesagens e faz o cadastro rápido de animais. Consulta os cadastros, mas não os altera. Abre os relatórios de curral (sem valores), mas não imprime nem exporta. Não acessa backup nem configurações. |
| **CONSULTA** | Quem só acompanha (sócio, contador, veterinário) | Só consulta: vê pesagens, cadastros e os relatórios de curral, **sem valores comerciais**, e pode imprimir e exportar o que vê. Não lança, não edita nem cadastra nada, e não acessa backup nem configurações. |

Não é possível criar outros perfis nem editar permissões: o programa esconde
o que o perfil não pode fazer e também recusa a ação por dentro, mesmo que
alguém tente pelo caminho errado.

## O que cada perfil pode fazer

| Ação | ADMIN | GESTOR | OPERADOR | CONSULTA |
|---|---|---|---|---|
| Lançar pesagens e manejos | sim | sim | sim | não |
| Consultar pesagens | sim | sim | sim | sim |
| Editar pesagens | sim | sim | sim | não |
| Cadastrar animal (cadastro rápido no lançamento) | sim | sim | sim | não |
| Consultar cadastros (marcas, raças, parceiros etc.) | sim | sim | sim | sim |
| Criar, alterar e inativar cadastros | sim | sim | não | não |
| Ver valores comerciais (preço, valor de venda) | sim | sim | não | não |
| Operações comerciais e embarques (versões seguintes) | sim | sim | não | não |
| Fechar e reabrir sessão de pesagem | sim | sim | não | não |
| Abrir relatórios (OPERADOR e CONSULTA: os de curral, sem valores e sem Comercial) | sim | sim | sim | sim |
| Imprimir e exportar relatórios (CONSULTA: só o que vê, sem valores) | sim | sim | não | sim |
| Compartilhar modelo de relatório com a empresa | sim | sim | não | não |
| Criar backup completo | sim | sim | não | não |
| Restaurar backup | sim | não | não | não |
| Limpar dados operacionais / Reset completo | sim | não | não | não |
| Continuar migração manualmente (Manutenção) | sim | não | não | não |
| Gerenciar usuários | sim | não | não | não |
| Configurações › Relatórios (divisor da @ de peso vivo) | sim | sim | não | não |
| Demais Configurações (Geral, Curral, Comercial, Segurança) | sim | não | não | não |

O GESTOR vê **Sistema › Configurações** no menu, mas a tela mostra para ele só
o cartão **Relatórios**. OPERADOR e CONSULTA não veem Configurações.

Nos relatórios, quem não vê valores comerciais (OPERADOR e CONSULTA) recebe as
mesmas linhas, só sem as colunas de valor; na folha impressa, o rodapé avisa
quantas colunas foram omitidas pelo perfil. Veja `RELATORIOS.md`.

## Tela Usuários (somente ADMIN)

Menu **Sistema › Usuários**.

### Criar um usuário

1. Clique em **Novo usuário**.
2. Informe **Nome**, **Login**, **Perfil** e uma **senha inicial**.
3. Salve.

O login precisa ser único (o programa ignora maiúsculas/minúsculas ao
comparar). Na primeira entrada, a pessoa é obrigada a trocar a senha inicial.

### Alterar nome, login ou perfil

Selecione o usuário e clique em **Editar**. A senha **não** é alterada por aqui.

### Redefinir a senha de alguém

Selecione o usuário e use **Redefinir senha**. Informe uma senha temporária; a
pessoa terá de trocá-la na próxima entrada. Use isso quando alguém esquecer a
senha.

### Desativar e reativar

Um usuário que saiu da equipe deve ser **desativado**, nunca excluído. O
usuário desativado não consegue entrar, mas continua aparecendo no histórico
de tudo o que fez. Para voltar, basta **reativar**.

**Regra importante:** o programa **nunca deixa desativar o último ADMIN
ativo**. Sempre precisa existir pelo menos um administrador que consiga entrar.
Se quiser trocar o administrador, primeiro crie o novo ADMIN e só depois
desative o antigo.

### Excluir

Usuários não são apagados. Isso protege o histórico (auditoria) de lançamentos,
backups e restaurações, que guarda quem fez cada ação.

## Lista de usuários

A lista mostra nome, login, perfil, situação (ativo/inativo) e o último acesso.
Ela **nunca** mostra senhas nem o código derivado da senha.

## Usuários e backup

- O backup completo inclui os usuários. Ao restaurar um backup, os usuários
  do backup **substituem** os atuais e o programa pede login de novo.
- Um backup de versão antiga (1.1.x) não tem usuários: depois de restaurá-lo,
  o programa volta para a **Configuração Inicial** e é preciso criar o
  administrador de novo. Isso é esperado. Veja `BACKUP-E-RESTAURACAO.md`.
- "Limpar dados operacionais" **preserva** os usuários. Só o "Reset completo"
  apaga tudo, inclusive usuários.

## Dicas

- Tenha pelo menos **dois** usuários ADMIN, para nunca ficar trancado fora.
- Use OPERADOR para quem só pesa no curral: menos opções na tela e menos
  risco de alteração acidental de cadastros.
- Use CONSULTA para quem só precisa ver e imprimir relatórios, sem lançar nada
  e sem ver preços.
- Cada pessoa com o próprio usuário: assim o histórico mostra quem fez o quê.
