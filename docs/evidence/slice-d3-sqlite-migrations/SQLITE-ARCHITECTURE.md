# SQLITE-ARCHITECTURE — Slice D.3

## Local do banco

| Ambiente | Caminho |
|----------|---------|
| Dev | `{projeto}/data/pesagens.db` |
| Produção | `%APPDATA%/pesagens-individuais/data/pesagens.db` |

Subpastas criadas automaticamente: `backups/`, `logs/`

JSON legado (preservado): `{dataDir}/pesagens.json`

## Processo responsável

- **Main process Electron** (`electron/main.cjs`) — único processo com acesso ao SQLite
- Módulos em `electron/database/`
- Renderer **não importa** better-sqlite3

## Como o renderer acessa

```
React → window.pesagemApp.weighing.* / .database.*
      → preload.cjs (contextBridge)
      → ipcRenderer.invoke('weighing:create', ...)
      → ipcMain handler (electron/ipc/)
      → repository (electron/database/repositories/)
      → better-sqlite3 (main process)
```

Fluxo principal da UI (pesagens) ainda usa:
```
React → db.entities.* → ipc 'db:*' → electron/db.cjs (JSON)
```

## PRAGMAs

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA user_version = 1;
```

## Fluxo de abertura

1. `app.whenReady()`
2. `getDataDir()` — dev ou userData
3. `jsonDb.initDatabase(dataDir)` — JSON (UI)
4. `sqliteDb.initializeSqliteDatabase(dataDir)`:
   - `openConnection()` → cria dirs, abre `pesagens.db`
   - `runMigrations()` → aplica pendentes em transação
   - `runHealthcheck()` → valida tabelas e PRAGMAs
5. `registerDatabaseIpc()` + `registerWeighingIpc()`

## Fluxo de erro

- Falha SQLite: log em console main; JSON continua funcional
- IPC: `wrapIpcHandler` captura exceções → `{ ok: false, error: { code, message } }`
- Stack trace **não** exposto ao renderer
- `app:getSqliteInitError` disponível para diagnóstico

## Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| better-sqlite3 | Preferência da auditoria; compilou OK no Windows |
| .cjs no electron/ | Consistência com main.cjs, db.cjs |
| SQLite paralelo ao JSON | D.3 = fundação; troca UI em D.4/D.5 |
| schema_migrations separado | Executor cria tabela; 001 cria domínio |
| legacy_payload TEXT | Preserva dados JSON na migração futura |
| Soft delete (deleted_at) | Integridade + auditoria |
