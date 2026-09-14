# ROOT-CAUSE-DEEP-DIVE (D.14)

## Fato-chave
A mensagem exata "Banco SQLite não inicializado" só é lançada por
`getConnection()` (sqliteConnection.cjs) quando `dbInstance` é null. Desde o D.12,
todos os caminhos de manutenção chamam `ensureDatabaseReady` antes. Se o banco
fosse inabrível, a mensagem seria "Não foi possível preparar o banco"
(DB_READY_FAILED) — não "não inicializado". Logo, o app que falhou fisicamente
**não continha o fix** → problema de identidade/instalação de build.

## Hipóteses do enunciado — veredito
1. Versão instalada não é 1.0.1 — **provável**; resolvido por 1.0.2 + versão visível.
2. app.asar instalado não contém a correção — coberto por packaged:source:verify
   (1.0.2) + versão visível.
3. Backup chama canal antigo — **descartado**: contrato + preload provam o canal.
4. ensureDatabaseReady sem path no runtime — **tratado**: runtime SSOT +
   fallback + erro claro se não configurado.
5. databaseReady path indefinido/diferente — **tratado**: SSOT único.
6. main não configura paths antes dos IPCs — **corrigido**: configureDatabaseRuntime
   no início do whenReady, antes de registrar IPC.
7. getConnection ainda chamado em algum caminho físico — mitigado: wrapper cobre
   todos os handlers; serviços também ensureDatabaseReady.
8. logs não escritos — **corrigido**: app.log criado no bootstrap + eventos.
9. sem permissão p/ criar userData/data — o log e o diagnóstico agora expõem isso
   (databaseReadyStatus/lastError).
10. UI mostra mensagem genérica antiga — a UI mostra a mensagem real do backend
    (adapter.unwrap) + diagnóstico com lastError.

## Correção estrutural (D.14)
Runtime SSOT (`databaseRuntime.cjs`) + `ensureDatabaseReady` baseado nele +
wrapper `withDatabaseReady` em todos os handlers + diagnóstico (`getDiagnosticInfo`)
+ log local. Se o problema persistir, o app.log e o diagnóstico apontam a causa
(build antigo vs. permissão vs. path), acabando com a correção às cegas.
