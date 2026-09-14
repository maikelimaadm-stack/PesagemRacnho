# RISK-NOTES (D.13)

## Riscos eliminados
- Ambiguidade de build (todos 1.0.0) → **1.0.1** + versão visível na UI + prova
  do app.asar (`packaged:source:verify`).
- Dependência circular no inicializador → módulo independente `databaseReady.cjs`.
- Teste que não exercia o caminho do botão → teste via handler IPC real + contrato.
- Dúvida se o pacote contém o fix → provado por extração do app.asar.

## Riscos reduzidos
- "Banco SQLite não inicializado" em fluxo recuperável → todos os pontos de
  entrada chamam `ensureDatabaseReady`. Guard técnico mantido para casos
  não-recuperáveis (permissão/disco), agora com log local para diagnóstico.

## Riscos ainda existentes
- **Teste físico em máquina limpa com o instalador 1.0.1**: PENDENTE. A execução
  do exe empacotado é bloqueada neste ambiente (antivírus/sandbox).
- Ícone default do Electron.
- Sem code signing (instalador não assinado pode ser quarentenado).
- Se a Maize instalar por cima sem confirmar a versão, ainda pode rodar build
  antigo — mitigado pela **Versão visível** na tela de Manutenção.

## Riscos aceitos por simplicidade
- Sem login/permissões/usuários/cloud/servidor.
- Sem configuração manual de banco.

## Mitigações
`ensureDatabaseReady` idempotente e independente + versão visível + log local +
gates de contrato/pacote/handler-real + docs de teste físico atualizadas.
