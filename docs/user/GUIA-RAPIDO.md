# Guia rápido — Pesagens Individuais

Sistema **offline e gratuito** para controlar pesagens individuais no computador. Não precisa de internet nem de conta na nuvem.

## Como abrir e entrar

1. Clique no atalho **Pesagens Individuais** na área de trabalho, ou abra pelo Menu Iniciar.
2. Na tela de **login**, digite o seu usuário e a sua senha e clique em **Entrar**.
3. Na primeira vez que o programa é aberto, aparece a **Configuração Inicial** para criar o administrador. Veja `LOGIN.md`.

Cada pessoa tem o próprio usuário e um perfil (**ADMIN**, **GESTOR** ou **OPERADOR**). O menu mostra só o que o seu perfil pode usar. Veja `USUARIOS.md`.

## O menu

| Grupo | Telas |
|---|---|
| **Operação** | Lançamento · Relação de Pesagens · Fechamento · Ficha do Animal |
| **Cadastros** | Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de Morte |
| **Sistema** | Usuários · Backup e Manutenção |

Na barra superior ficam o seu nome e perfil, a versão do programa, o tema claro/escuro e o menu do usuário (**Bloquear**, **Trocar senha**, **Sair**).

A tela de Sanidade foi retirada nesta versão; os grupos **Rebanho** (Animais, Apartações e Lotes, Identificadores) e **Comercial** (Operações, Embarques) chegam nas versões seguintes.

## Antes de pesar: os cadastros

Cadastre uma vez e escolha no lançamento: **Marcas**, **Raças**, **Categorias**, **Parceiros**, **Propriedades** e **Causas de Morte**. Marque a marca, a raça e a propriedade **padrão** para digitar menos no curral. Veja `CADASTROS.md`.

## Como lançar uma pesagem

1. No menu, abra **Lançamento**.
2. Informe o número do animal e a marca (a padrão já vem escolhida), o peso e o que mais for pedido.
3. Salve o lançamento.

Animal novo é cadastrado ali mesmo (cadastro rápido), com raça e categoria escolhidas da lista.

## Como consultar registros

1. Abra **Relação de Pesagens**.
2. Use os filtros da tela para encontrar o que precisa.

## Embarque

Na tela de lançamento, use a documentação de embarque para organizar saídas (GTA, NF-e etc.).

## Como fazer backup

1. Abra **Backup e Manutenção**.
2. Clique em **Criar backup completo**.
3. Confira nome, tamanho e SHA-256 na mensagem de sucesso e no catálogo da tela.

O backup leva tudo: pesagens, animais, cadastros e usuários. Veja `BACKUP-E-RESTAURACAO.md`.

## Como verificar se o banco está saudável

1. Abra **Backup e Manutenção**.
2. Clique em **Verificar integridade**.
3. Se aparecer "Banco íntegro.", está tudo certo.

Na mesma tela, o **Status** mostra a versão do programa, a versão do banco, o formato de backup e os identificadores de build. Essas informações vão junto no **Copiar diagnóstico**.

## Se algo der errado

1. Faça um **backup** imediatamente (ADMIN ou GESTOR).
2. Anote a mensagem de erro (use **Copiar diagnóstico** na tela de Backup e Manutenção; a senha nunca vai no diagnóstico).
3. Não apague a pasta de dados do programa nem edite manualmente o backup JSON.
4. Consulte também `BACKUP-E-RESTAURACAO.md`, `INSTALACAO-WINDOWS.md` e `LOGIN.md`.
