# Usuários e perfis

Cada pessoa que usa o programa tem o seu próprio **usuário** (login + senha) e
um **perfil**, que define o que ela pode fazer. Existem três perfis fixos:

| Perfil | Para quem | Resumo |
|---|---|---|
| **ADMIN** | Responsável pelo sistema | Faz tudo, inclusive gerenciar usuários, restaurar backup, limpar dados e alterar configurações. |
| **GESTOR** | Escritório / gerência | Lança e consulta pesagens, mantém os cadastros, fecha sessões, consulta relatórios e cria backups. Não gerencia usuários nem restaura/limpa dados. |
| **OPERADOR** | Curral / campo | Lança pesagens e faz o cadastro rápido de animais. Consulta os cadastros, mas não os altera. Não acessa relatórios, backup nem configurações. |

Não é possível criar outros perfis nem editar permissões: o programa esconde
o que o perfil não pode fazer e também recusa a ação por dentro, mesmo que
alguém tente pelo caminho errado.

## O que cada perfil pode fazer

| Ação | ADMIN | GESTOR | OPERADOR |
|---|---|---|---|
| Lançar pesagens e manejos | sim | sim | sim |
| Consultar e editar pesagens | sim | sim | sim |
| Cadastrar animal (cadastro rápido no lançamento) | sim | sim | sim |
| Consultar cadastros (marcas, raças, parceiros etc.) | sim | sim | sim |
| Criar, alterar e inativar cadastros | sim | sim | não |
| Operações comerciais e embarques (versões seguintes) | sim | sim | não |
| Fechar e reabrir sessão de pesagem | sim | sim | não |
| Relatórios | sim | sim | não |
| Criar backup completo | sim | sim | não |
| Restaurar backup | sim | não | não |
| Limpar dados operacionais / Reset completo | sim | não | não |
| Continuar migração manualmente (Manutenção) | sim | não | não |
| Gerenciar usuários | sim | não | não |
| Configurações do sistema | sim | não | não |

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
- Cada pessoa com o próprio usuário: assim o histórico mostra quem fez o quê.
