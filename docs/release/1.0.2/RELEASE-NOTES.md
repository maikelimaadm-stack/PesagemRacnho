# Notas da versão 1.0.2

Pesagens Individuais — sistema desktop offline. Hotfix.

## Correção (hotfix)
- Hotfix para falha persistente de inicialização do banco SQLite no app
  instalado ("Banco SQLite não inicializado" ao fazer backup).
- O banco agora usa um **runtime central de caminhos** (SSOT), configurado no
  início do app, antes de qualquer operação.
- O **backup garante o banco pronto** antes de executar (e todos os fluxos de
  Manutenção também).
- A tela de **Manutenção mostra diagnóstico local**: Versão, caminho do banco,
  caminho do log, status — e botão "Copiar diagnóstico".
- Adicionado **log local** em `%APPDATA%\pesagens-individuais\logs\app.log`
  (offline, sem telemetria).
- Adicionados testes de pacote (`app.asar`), de fluxo da UI e de diagnóstico de
  runtime.

## Não inclui
- login
- permissões
- usuários/admin
- cloud
- servidor
- sincronização online
- assinatura digital do instalador

## Importante
- Use SOMENTE o instalador **Pesagens Individuais Setup 1.0.2.exe**.
- Na tela de Manutenção, confirme **Versão: 1.0.2**. Se não for 1.0.2, você está
  com um build antigo — desinstale e instale o 1.0.2.
- Se o backup falhar, use "Copiar diagnóstico" e envie o arquivo
  `%APPDATA%\pesagens-individuais\logs\app.log`.
