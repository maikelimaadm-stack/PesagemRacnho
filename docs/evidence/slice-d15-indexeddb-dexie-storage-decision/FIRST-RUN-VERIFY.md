# FIRST-RUN-VERIFY

`storage:first-run:verify` (Node + fake-indexeddb) — PASS.

Cenário: nenhum banco existe → `ensureStorageReady()` abre e cria os 12 stores
automaticamente → uso imediato (create + stats) sem configuração → reabrir mantém
dados.

Resultado:
```json
{ "firstRunAuto": true, "userMustConfigure": false, "userMustInstallSqlite": false, "nativeModule": false, "stores": 12 }
```

Diferença-chave vs. SQLite: não há estado "não inicializado". Dexie/IndexedDB é
embutido no Chromium/Electron; o banco nasce ao abrir, no renderer.
