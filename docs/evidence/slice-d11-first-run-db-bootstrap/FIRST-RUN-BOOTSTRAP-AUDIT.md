# FIRST-RUN-BOOTSTRAP-AUDIT

Auditoria dos pontos exigidos (Part 2 do D.11).

| # | Verificação | Resultado |
|---|---|---|
| 1 | Onde o banco é inicializado | `electron/main.cjs` `app.whenReady()` → `sqliteDb.initializeSqliteDatabase(dataDir)` |
| 2 | Init acontece no app instalado | SIM (mesmo caminho dev/packaged; só o `dataDir` difere) |
| 3 | Init antes da UI precisar do banco | SIM — ocorre antes de `createWindow()` e do registro de IPC |
| 4 | `app.getPath('userData')` disponível no momento certo | SIM — usado dentro de `whenReady` (app já pronto) |
| 5 | Pasta `data/` criada automaticamente | SIM — `ensureDataDirectories` (mkdir recursive) + agora `mkdirSync` explícito no whenReady |
| 6 | `pesagens.db` criado automaticamente | SIM — `new Database(path)` em `openConnection` |
| 7 | Migrations rodam automaticamente | SIM — `runMigrations` aplica 001–003 pendentes |
| 8 | Falha de migration visível | SIM — `AppError SQLITE_MIG_001` + log `[sqlite] init failed:` |
| 9 | Renderer depende de banco antes do main iniciar | NÃO bloqueante — main inicializa banco antes de liberar IPC; renderer usa IPC |
| 10 | Diferença dev vs packaged | Só o caminho: dev = `<repo>/data`; packaged = `userData/data`. Lógica idêntica |

## Detalhe da ordem (main.cjs, whenReady)
```
whenReady
  → getDataDir()                (packaged: userData/data)
  → mkdirSync(dataDir)          (garante a pasta — first-run)
  → jsonDb.initDatabase(dataDir)
  → sqliteDb.initializeSqliteDatabase(dataDir)
        openConnection → ensureDataDirectories + new Database(pesagens.db) + PRAGMAs
        runMigrations (001,002,003)
        pragma user_version=1
        healthcheck
  → migrações legadas (best-effort, não bloqueiam)
  → registra IPC
  → createWindow()
```

## Causa provável do relato "banco não apareceu"
`new Database()` falhando por ABI do módulo nativo em runtime não empacotado, ou
módulo nativo não carregável no destino. Mitigação: instalador regenerado com
rebuild do electron-builder (@electron/rebuild p/ Electron 35.7.5). better-sqlite3
v12 é N-API (ABI-estável), reduzindo o risco de mismatch.

## Observação honesta
O erro de init é engolido (app abre com SQLite quebrado). Mantido assim de
propósito: os requisitos 8/9 do D.11 pedem que o app **abra mesmo com banco
inexistente**. A criação automática cobre o caso normal; o log expõe falhas.
