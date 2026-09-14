# MAINTENANCE-FIRST-RUN-BACKUP-VERIFY

## Script
`scripts/verify-maintenance-first-run-backup.mjs`
(npm run `maintenance:first-run-backup:verify`).

## Cenário
Reproduz o bug físico do D.12 e prova a correção:
1. userData temporário limpo; `pesagens.db` NÃO existe.
2. `connection.resetConnectionForTests()` → conexão fechada (`isOpen() === false`)
   — exatamente o estado em que o bug ocorria.
3. Chama `maintenance.createSqliteBackup(dataDir)` (mesmo serviço da tela).
4. Chama `maintenance.createFullDataBackup(dataDir)`.
5. Chama `runIntegrityCheck()` e `runQuickCheck()`.

## Resultado (2026-07-20)
`maintenance first-run backup: PASS`
```json
{
  "dbCreatedDuringBackup": true,
  "sqliteBackup": {
    "sha256": "274fd497bd249b503245996b6641116f834225d0a5d981224eed4449e7eb9717",
    "sizeBytes": 274432
  },
  "fullBackupFiles": 3,
  "integrity": "ok",
  "quickCheck": "ok",
  "errorBancoNaoInicializado": false
}
```
(o SHA256 do backup varia por execução — o backup carrega timestamps/estado.)

## Arquivos de backup gerados
- Backup SQLite: `<tmp>/data/backups/sqlite/pesagens-db-backup-*.db` + `.manifest.json`
- Backup completo: `<tmp>/data/backups/full/full-data-backup-*/` (3 arquivos + manifest)

## Confirmação de que o erro NÃO ocorreu
O teste falha (exit 1) se `createSqliteBackup` lançar qualquer erro — em especial
`SQLITE_CONN_001: "Banco SQLite não inicializado"`. Resultado: PASS, ou seja, o
backup funcionou com a conexão inicialmente fechada, provando a auto-recuperação.

## Cobertura nos gates
Adicionado a `test:quick` e `test:full`. Rodado também pós-dist (com o instalador
novo) → PASS.
