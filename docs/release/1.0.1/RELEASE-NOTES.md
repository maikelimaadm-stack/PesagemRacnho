# Notas da versão 1.0.1

Pesagens Individuais — sistema desktop offline. Correção de bug.

## Correção
- Corrigida falha em que o backup podia exibir "Banco SQLite não inicializado"
  no app instalado.
- A tela de Manutenção agora garante que o banco SQLite esteja pronto
  (ensureDatabaseReady) antes de backup, backup completo, exportação, importação,
  restauração e verificação de integridade.
- Adicionado teste de regressão que exercita o caminho real do botão de backup
  (mesmo handler IPC), simulando a primeira abertura.
- Adicionada verificação de que o código corrigido entrou no pacote (app.asar).
- Adicionada identificação de **Versão** e caminho do **Banco** na seção de
  Diagnóstico da tela de Manutenção, para confirmar qual build está rodando.
- Adicionado log local simples em `userData/logs/app.log` (offline, sem
  telemetria) para diagnóstico.

## Não inclui
- login
- permissões
- usuários/admin
- cloud
- servidor
- sincronização online
- assinatura digital do instalador

## Observações
- Use somente o instalador **Pesagens Individuais Setup 1.0.1.exe**.
- Dados continuam em `%APPDATA%\pesagens-individuais\data\pesagens.db`.
- Atualizar/reinstalar não apaga dados.
- Ícone default do Electron; instalador sem assinatura (SmartScreen pode alertar).
