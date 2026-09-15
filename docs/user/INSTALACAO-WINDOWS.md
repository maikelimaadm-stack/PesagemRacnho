# Instalação no Windows

Versão atual do aplicativo: **1.1.18**. O instalador desta versão **ainda não foi gerado**;
quando existir, o arquivo se chamará `Pesagens Individuais Setup 1.1.18.exe` e virá
acompanhado do SHA-256 e do manifesto da release. Até lá, use somente instaladores
anteriores que você já tenha validado, e siga as regras de segurança abaixo.

## Como instalar

1. Execute o arquivo **Pesagens Individuais Setup X.Y.Z.exe** da versão desejada
   (confira o nome, a versão e o SHA-256 publicados antes de executar).
2. Siga as telas do instalador.
3. Você pode escolher a pasta de instalação.
4. Ao terminar, o atalho é criado.

## Como abrir

- Atalho na **área de trabalho**, ou
- **Menu Iniciar** → Pesagens Individuais

## Atalhos

- Área de trabalho: **Pesagens Individuais**
- Menu Iniciar: **Pesagens Individuais**

## Segurança do instalador

A distribuição oficial exige assinatura digital Authenticode válida. Antes de
instalar, confira em **Propriedades > Assinaturas Digitais** o publicador, a cadeia
confiável e o carimbo de tempo, e compare o SHA-256 com o manifesto da release.

Não desative Defender, SmartScreen, WDAC ou App Control para executar um pacote.
Um build sem assinatura pode ser gerado em `release-unsigned/` apenas para
diagnóstico local; ele não é instalador oficial e pode ser corretamente bloqueado
por uma política corporativa do Windows.

## Como conferir a versão instalada

Abra **Sistema › Backup e Manutenção**. No cartão **Status do banco**, o bloco **Versões**
mostra Aplicativo, Esquema do banco, Formato do backup, Manifesto, Build e Contrato
UI/dados. Em 1.1.18 os valores esperados são: aplicativo 1.1.18, esquema do banco 6,
formato do backup 2, manifesto 2. O botão **Copiar diagnóstico** copia os mesmos dados
para enviar ao suporte.

## Como atualizar sem perder dados

1. Feche o app.
2. Instale a versão nova por cima (ou execute o Setup novo).
3. Abra o app novamente.

Os dados operacionais ficam no perfil local do aplicativo, **fora** da pasta do
programa. Atualizar ou reinstalar não deve apagá-los. Mesmo assim, crie e valide
um backup completo antes de atualizar.

## Desinstalação

Desinstalar o programa **não apaga automaticamente** os dados do usuário (configuração do instalador).

Se quiser apagar tudo, faça isso manualmente só depois de confirmar que tem backup.
