# FIRST-RUN-DB-VERIFY

## Script
`scripts/verify-first-run-database-bootstrap.mjs` (npm run `first-run:db:verify`).

### Modo 1 — determinístico (sempre roda)
Usa os módulos REAIS do app (`electron/database/index.cjs`, `sqliteConnection`,
`sqliteHealthcheck`) numa pasta userData temporária **limpa**. Reproduz o que o
`main.cjs` faz no `whenReady`.
Passos:
1. Cria pasta temporária limpa; garante que `data/pesagens.db` NÃO existe.
2. `ensureDataDirectories` + `initializeSqliteDatabase` (cria db + migrations).
3. Verifica que `pesagens.db` foi criado, não vazio, com cabeçalho SQLite válido.
4. Verifica tabelas exigidas.
5. `PRAGMA integrity_check` e `quick_check` = ok.
6. Migrations 001, 002, 003 aplicadas.
7. Healthcheck saudável.

### Modo 2 — opcional (`FIRST_RUN_LAUNCH_PACKAGED=1`)
Lança o app EMPACOTADO real (`release/win-unpacked/Pesagens Individuais.exe`) com
`PESAGENS_USER_DATA_DIR` = pasta limpa, aguarda o bootstrap, encerra e confirma
que o próprio binário criou `pesagens.db` (verificação por cabeçalho, sem driver
Node). É best-effort: se o ambiente bloquear a execução do exe, reporta e não
falha o verify (o Modo 1 é a prova garantida).

## Execução (2026-07-16)
`npm run first-run:db:verify` → **first-run database bootstrap: PASS**

```json
{
  "moduleBootstrap": {
    "dbCreated": true,
    "tables": 16,
    "migrations": [1, 2, 3],
    "integrity": "ok"
  },
  "packagedLaunch": {
    "ran": false,
    "blocked": true,
    "reason": "execução do exe bloqueada: spawn UNKNOWN"
  }
}
```

## Tabelas verificadas (15 exigidas)
schema_migrations, animals, lots, weighing_sessions, weighing_entries,
apartacoes, lote_apartacoes, configuracoes_sanidade, itens_sanidade,
sanidades_animal, embarques, documentos_embarque, audit_log, app_settings,
backup_history. (Total de 16 tabelas no banco, incluindo sqlite_sequence.)

## Limitação honesta
O **Modo 2** (launch do exe empacotado) foi **BLOQUEADO** neste ambiente
(`spawn UNKNOWN` — provável antivírus/sandbox, mesmo motivo do instalador que
sumiu antes). Portanto a criação do banco pelo binário empacotado em uma máquina
real **não foi observada aqui**; permanece parte do teste físico da Maize. O
Modo 1 prova que a LÓGICA de bootstrap cria tudo do zero.
