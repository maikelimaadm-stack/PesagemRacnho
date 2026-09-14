# ROOT-CAUSE-DEEP-DIVE

## Duas camadas do problema

### Camada 1 — código (já tratada no D.12, reforçada no D.13)
`getConnection()` lança `SQLITE_CONN_001: "Banco SQLite não inicializado"` quando
a conexão está fechada. Os serviços de manutenção usavam `getConnection()` sem
garantir inicialização. Correção: `ensureDatabaseReady` em todos os handlers e
serviços.

### Camada 2 — identidade de build (a real causa do D.13)
Todos os instaladores até o D.12 se chamavam **1.0.0**. Sem versão visível e sem
prova de conteúdo do pacote, era impossível saber se o app instalado continha o
fix. A mensagem "Banco SQLite não inicializado" (e não "Falha ao abrir banco")
indica que o app que falhou era um build **sem** `ensureDatabaseReady` no caminho.

## Por que os testes anteriores não pegaram (e o que mudou)
- D.12 testava o **service direto** com o helper que abre a conexão antes. Não
  exercia o caminho "conexão fechada via handler do botão".
- D.13: novo teste chama o **handler IPC real** (`maintenance:backup:sqlite`) com
  a conexão fechada (fake `ipcMain`), e um **teste de contrato** valida a cadeia
  botão→service→adapter→preload→canal→handler→ensureDatabaseReady.
- D.13: `packaged:source:verify` abre o `app.asar` e prova que o build 1.0.1
  contém `ensureDatabaseReady` nos arquivos certos.

## Hipóteses do enunciado — veredito
1. Setup antigo usado por engano (nome 1.0.0) — **provável**; resolvido com 1.0.1.
2. Antivírus/cache manteve binário antigo — possível; mitigado por 1.0.1 + log.
3. dist novo mas app não substituído — possível; 1.0.1 força novo artefato.
4. Fix no source mas não no app.asar — **descartado agora** por packaged:source:verify.
5. UI chama fluxo diferente — **descartado** por REAL-UI-BACKUP-FLOW + contrato.
6. IPC chama getConnection sem ensureDatabaseReady — **descartado**: wrapper `ready`
   cobre todos os handlers.
7. Circular dependency — **eliminada**: `ensureDatabaseReady` extraído para
   `databaseReady.cjs` independente (ver CIRCULAR-DEPENDENCY-AUDIT).
8. backupService com caminho que lança SQLITE_CONN_001 — **descartado**: chama
   ensureDatabaseReady no início.
9. Teste não exercia o caminho do botão — **corrigido** (teste via handler real).
10. App continua 1.0.0 — **corrigido** (1.0.1 + versão visível).

## Correção final
`ensureDatabaseReady` (módulo independente) no caminho real do botão + pacote
1.0.1 provado + versão visível + log local.
