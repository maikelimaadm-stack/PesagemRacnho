# Instalação no Windows

## Como instalar

1. Execute o arquivo **Pesagens Individuais Setup … .exe**.
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
