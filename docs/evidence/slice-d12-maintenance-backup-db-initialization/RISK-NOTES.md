# RISK-NOTES (D.12)

## Riscos eliminados
- "Banco SQLite não inicializado" ao fazer backup logo após instalar — corrigido
  na causa (inicializador central `ensureDatabaseReady` em todos os handlers de
  manutenção/banco e no backupService).
- Serviços de manutenção assumindo conexão viva sem recuperação — agora
  auto-recuperam de forma idempotente.

## Riscos reduzidos
- Falha silenciosa do init de startup: mesmo que o init do `whenReady` falhe, o
  primeiro clique em Backup/Manutenção reabre o banco. (Se o banco for
  genuinamente inabrível — permissão/disco — o erro técnico ainda aparece, mas
  fora de fluxo recuperável.)

## Riscos ainda existentes
- **Teste físico em máquina limpa com o instalador D.12 (SHA256 292c399d...)**:
  PENDENTE. A execução do exe empacotado é bloqueada neste ambiente
  (antivírus/sandbox), então backup no app instalado real não foi observado aqui.
- Ícone default do Electron.
- Sem code signing (instalador não assinado pode ser quarentenado).

## Riscos aceitos por simplicidade
- Sem login/permissões/usuários/cloud/servidor.
- Sem configuração manual de banco (o app cria/abre tudo sozinho).

## Mitigações
- `ensureDatabaseReady` idempotente + singleton único de conexão.
- Gate de regressão `maintenance:first-run-backup:verify` em test:quick/test:full.
- Logs `[bootstrap]`/`[sqlite]` no main; tela de Manutenção mostra status do banco.
