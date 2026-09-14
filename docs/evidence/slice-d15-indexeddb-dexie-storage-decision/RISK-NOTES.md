# RISK-NOTES (D.15)

## Riscos reduzidos pela decisão Dexie
- Módulo nativo (better_sqlite3.node), rebuild por ABI, app.asar.unpacked → eliminados no fluxo Dexie.
- Conexão SQLite no main / "Banco SQLite não inicializado" → não existem no modelo Dexie.
- Superfície de antivírus (sem .node) → reduzida.

## Riscos ainda existentes
- **Cutover da UI não feito e não validável por mim**: reescrever adapters/pages
  às cegas repetiria "script verde, físico vermelho". Precisa de validação física.
- **Consultas SQL → índices Dexie**: consultas do app são simples, mas qualquer
  relatório com JOIN precisará ser reescrito com cuidado.
- **Integridade lógica ≠ PRAGMA integrity_check**: cobertura diferente.
- **Migração de dados** de instalações SQLite existentes: não implementada (foco
  em instalação nova). Se houver pesagens.db com dados, precisa de importador.
- **Causa raiz do físico ainda não confirmada**: o erro exato aponta para build
  antigo. Dexie remove a fragilidade, mas o diagnóstico D.14 (app.log/versão) é o
  que confirma se a Maike roda o build novo.
- Ícone default; sem code signing.

## Riscos aceitos
- SQLite mantido como legado morto neste slice (remoção após validar).

## Mitigações
Camada Dexie validada por 6 gates; SQLite intacto como fallback; decisão e
inventário documentados; cutover planejado e explícito em NEXT-STEPS.
