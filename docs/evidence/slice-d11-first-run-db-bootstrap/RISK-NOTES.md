# RISK-NOTES (D.11)

## Riscos resolvidos/mitigados
- Instalador ausente → **regenerado**; checksum/manifest voltaram a passar.
- Dúvida sobre criação automática do banco → **validada por automação** do zero
  (first-run:db:verify): pasta + pesagens.db + migrations + integrity.
- e2e tolerava Setup.exe ausente → **endurecido** (estrito por padrão).
- Bootstrap agora garante `data/` explicitamente e loga o `dataDir`.

## Riscos ainda existentes
- **Teste físico em máquina limpa**: PENDENTE. A execução do exe empacotado foi
  bloqueada neste ambiente (antivírus/sandbox), então a criação real do banco no
  app instalado não foi observada aqui.
- **Antivírus/SmartScreen**: instalador não assinado pode ser quarentenado
  (o Setup.exe já sumiu uma vez). Reforça a necessidade de code signing futuro.
- **Ícone default** (sem asset de marca).
- **Init do SQLite é engolido** por try/catch (por requisito: app abre mesmo sem
  banco). Falhas ficam só em log; a UI de Manutenção é quem expõe ao usuário.

## Riscos aceitos por simplicidade
- Sem login/permissões/cloud/servidor.
- Sem configuração de banco pelo usuário (o app cria tudo sozinho).

## Mitigações
Bootstrap automático + logs `[bootstrap]`/`[sqlite]` + first-run:db:verify +
docs de usuário + tela de Manutenção + deleteAppDataOnUninstall=false.
