# Login e usuários: como entrar no programa

A partir da versão 1.2.0 o programa pede **login e senha**. Isso funciona
totalmente **sem internet**: os usuários ficam guardados no próprio computador,
junto com os dados das pesagens. Não existe conta na nuvem nem senha padrão.

## Primeira execução (Configuração Inicial)

Na primeira vez que o programa abre em um computador (ou depois de um
"Reset completo"), ele não tem nenhum usuário. Aparece a tela
**Configuração Inicial**, que cria o primeiro administrador:

1. Informe o **Nome do administrador** (como você quer aparecer no sistema).
2. Informe o **Login** (nome curto, sem espaços; ele não diferencia
   maiúsculas de minúsculas).
3. Informe a **Senha** e repita em **Confirmar senha**.
   - Mínimo de 6 caracteres.
   - Senhas fracas são recusadas (por exemplo `123`, `123456`, `admin` ou
     uma senha igual ao login).
4. Clique em **Criar administrador**. O programa volta para a tela de login.

Esse primeiro usuário tem o perfil **ADMIN** (veja `USUARIOS.md`). Guarde a
senha em um lugar seguro: **não existe recuperação automática de senha**.
Se o único administrador esquecer a senha, ninguém consegue entrar. Por isso,
recomendamos criar um segundo usuário ADMIN logo após a configuração inicial.

Se você atualizou de uma versão anterior (1.1.x), a Configuração Inicial
aparece uma única vez, depois que a migração dos dados terminar. Seus dados
de pesagem não mudam.

## Entrar (login)

1. Digite o **Login** e a **Senha**.
2. Clique em **Entrar**.

Se o login ou a senha estiverem errados, o programa mostra a mesma mensagem
("Login ou senha inválidos") sem dizer qual dos dois falhou. Isso é proposital.

Depois de **5 tentativas erradas seguidas** com o mesmo login, o programa
bloqueia novas tentativas por **30 segundos**. Espere e tente de novo.

A tela de login mostra a versão do programa no rodapé, para conferência.

## Trocar a senha na primeira entrada

Quando um administrador cria o seu usuário ou redefine a sua senha, o
programa exige que você **troque a senha na primeira entrada**. Você informa a
senha atual (a que recebeu) e a nova senha duas vezes. Só depois disso as telas
do sistema aparecem.

## Trocar a própria senha

Qualquer usuário pode trocar a própria senha quando quiser:

1. Clique no seu nome, no canto superior da tela (menu do usuário).
2. Escolha **Trocar senha**.
3. Informe a senha atual, a nova senha e a confirmação.

As regras são as mesmas da senha inicial (mínimo 6 caracteres, nada trivial).

## Bloquear a tela

Quando você se afasta do computador, use **Bloquear** no menu do usuário. A
tela de bloqueio esconde os dados e pede a **senha do mesmo usuário** para
continuar. Nada é perdido: o que estava aberto continua onde estava.

O programa também **bloqueia sozinho** depois de um tempo sem uso (padrão:
**60 minutos** sem teclado ou mouse). O administrador pode mudar esse tempo nas
configurações do sistema; o valor `0` desliga o bloqueio automático.

Na tela de bloqueio, **Trocar usuário** volta para a tela de login, para outra
pessoa entrar com o próprio login.

## Sair

**Sair**, no menu do usuário, encerra a sessão e volta para a tela de login.
Fechar o programa também encerra a sessão: ao abrir de novo, é preciso entrar.

## O que fica registrado

Cada lançamento, alteração, exclusão, backup, restauração e limpeza guarda
**quem fez** (nome e perfil do usuário). Isso aparece no histórico e no
diagnóstico. Registros feitos antes da versão 1.2.0 ficam sem usuário.

## Segurança das senhas

- A senha **nunca** é gravada em texto. O programa guarda apenas um código
  derivado dela (hash com sal aleatório por usuário), que não permite descobrir
  a senha original.
- A senha não aparece em backups textuais de diagnóstico, exportações CSV nem
  em mensagens de erro.
- O backup completo leva os usuários junto (com o código derivado, nunca a
  senha). Veja `BACKUP-E-RESTAURACAO.md`.
