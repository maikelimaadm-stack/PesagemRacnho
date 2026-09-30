# Instalação no Windows

Versão deste guia: **1.4.1**. O instalador chama-se
**Pesagens Individuais Setup 1.4.1.exe**.

## Como instalar

1. Execute o arquivo **Pesagens Individuais Setup 1.4.1.exe**.
2. Siga as telas do instalador.
3. Você pode escolher a pasta de instalação.
4. Ao terminar, o atalho é criado.

## Como abrir

- Atalho na **área de trabalho**, ou
- **Menu Iniciar** → Pesagens Individuais

## Primeira abertura

Em um computador novo, o programa abre na **Configuração Inicial** para você
criar o primeiro administrador (nome, login e senha). Depois disso, toda
abertura pede login. Veja `LOGIN.md`.

## Segurança do instalador

A distribuição oficial exige assinatura digital Authenticode válida. Antes de
instalar, confira em **Propriedades > Assinaturas Digitais** o publicador, a
cadeia confiável e o carimbo de tempo, e compare o SHA-256 com o
`release-manifest.json` da release (campos `installer.sha256`,
`installer.sizeBytes` e `signed`).

Não desative Defender, SmartScreen, WDAC ou App Control para executar um pacote.
Um build sem assinatura pode ser gerado em `release-unsigned/` apenas para
diagnóstico local (`signed: false` no manifesto); ele não é instalador oficial
e pode ser corretamente bloqueado por uma política corporativa do Windows.

## Como atualizar da 1.3.x (ou de uma 1.4.0 de teste) para a 1.4.1

1. Abra a versão atual e crie um **backup completo** em **Backup e Manutenção**. Guarde o arquivo
   fora do computador (pen drive ou outra pasta).
2. Feche **todas** as janelas do programa.
3. Execute o **Setup 1.4.1** por cima da instalação atual.
4. Abra o programa e faça o login. A barra superior mostra **v1.4.1**.

A 1.4.1 (como a 1.4.0) **não muda o banco** (continua na versão 8): não há migração automática nem backup
pré-migração. Só os favoritos, recentes e modelos de relatório são convertidos para os relatórios
novos, na primeira vez que cada pessoa abre **Relatórios** (sem apagar nada; fica na auditoria).
Detalhes e como voltar para a 1.3.2 em `docs/release/1.4.0/MIGRATION-1.3.0-TO-1.4.0.md`.

O pacote de teste da 1.4.1 não é assinado: o Defender/SmartScreen pode avisar ou retirar o arquivo
da pasta. Não desative a proteção; veja **Segurança do instalador** acima.

## Como atualizar sem perder dados (1.1.x → 1.2.0)

1. Abra a versão antiga e crie um **backup completo** em **Manutenção**.
   Confira o nome, o tamanho e o SHA-256 e guarde o arquivo fora do computador
   (pen drive ou outra pasta). Este passo é obrigatório.
2. Feche o programa.
3. Execute o **Setup 1.2.0** por cima da instalação atual.
4. Abra o programa. Na **primeira abertura**, a versão 1.2.0 faz uma
   **migração automática** do banco:
   - primeiro ela grava e confere um **backup pré-migração** na pasta de dados
     (subpasta `backups`, arquivo `pre-migration-v7-<data>.json`);
   - só depois converte os dados para o novo formato e monta os cadastros
     (marcas, raças, categorias, parceiros, propriedades, causas de morte) a
     partir do que já existia;
   - a tela mostra o andamento. **Não feche o programa** durante a migração.
     Se o computador desligar no meio, abra de novo: a migração continua de onde
     parou, sem duplicar nada.
5. Ao terminar, aparece a **Configuração Inicial** para criar o administrador
   (as versões antigas não tinham usuários). Depois, faça o login.
6. Em **Backup e Manutenção**, clique em **Verificar integridade** e confira
   o **Status** (versão 1.2.0, banco versão 7).

Se o backup pré-migração não puder ser gravado, a migração **não começa**: o
programa mostra o motivo e não altera o banco. Nesse caso, libere espaço em
disco ou verifique permissões da pasta de dados e abra de novo.

Se a mensagem for sobre a tabela `lotes` com registros, abra a versão antiga,
exporte/limpe esses dados pela Manutenção e repita a atualização.

**Atenção:** depois da migração o banco fica no formato novo (versão 7) e a
versão antiga (1.1.x) **não consegue abri-lo**. Para voltar, use o backup
criado antes da atualização. O passo a passo está em
`docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md`.

Os dados operacionais ficam no perfil local do aplicativo, **fora** da pasta do
programa. Atualizar ou reinstalar não deve apagá-los. Mesmo assim, crie e valide
um backup completo antes de atualizar.

## Desinstalação

Desinstalar o programa **não apaga automaticamente** os dados do usuário (configuração do instalador).

Se quiser apagar tudo, faça isso manualmente só depois de confirmar que tem backup.
