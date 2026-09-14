# RISK-NOTES (D.14)

## Riscos eliminados
- Path do banco frágil/indefinido no runtime → **runtime SSOT** configurado no
  bootstrap, antes dos IPCs.
- Impossível saber qual build está instalado → **versão visível** + diagnóstico
  copiável + `packaged:source:verify` do 1.0.2.
- Sem visibilidade de onde falha → **app.log** com bootstrap/ensure/backup.

## Riscos reduzidos
- "Banco SQLite não inicializado" em fluxo recuperável → entradas usam
  ensureDatabaseReady; falha real vira `DB_READY_FAILED` com log. Guard técnico
  mantido para caso não-recuperável.

## Riscos ainda existentes
- **Teste físico com o 1.0.2**: PENDENTE (execução do exe bloqueada neste ambiente).
  Se ainda falhar, agora há app.log + diagnóstico para apontar a causa real.
- Ícone default; sem code signing (antivírus pode quarentenar).
- Se a Maike não desinstalar/checar a versão, pode rodar build antigo — mitigado
  pela versão visível e pela instrução explícita.

## Riscos aceitos por simplicidade
- Sem login/permissões/usuários/cloud/servidor; sem config manual de banco.

## Mitigações
Runtime SSOT + ensureDatabaseReady idempotente + wrapper withDatabaseReady +
diagnóstico + app.log + gates de pacote/contrato/runtime.
