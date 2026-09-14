# FIRST-RUN-PERSISTENCE

storage:ui-first-run-persistence:verify (Node + fake-indexeddb) - PASS.

Cenario (weighingService, mesmo da UI): banco Dexie limpo -> ensureStorageReady (first-run automatico) -> createEntry -> fechar/reabrir -> listEntries confirma persistencia -> update reflete -> delete (soft) some.
Sem configuracao, sem SQLite, sem modulo nativo.
