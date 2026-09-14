# DATA-PRESERVATION

## Script
`scripts/verify-data-preservation-scenario.mjs` (npm run `data:preservation:verify`).

Usa os **módulos reais** do app (nenhum mock de schema):
- `electron/database/sqliteConnection.cjs`
- `electron/database/sqliteMigrations.cjs`
- `electron/database/repositories/weighingRepository.cjs` (+ animal/lot)
- `electron/database/maintenance/index.cjs`

## Cenário verificado (em diretório temporário)
1. Cria banco SQLite temporário e roda migrations (001–003).
2. Insere 2 pesagens de teste (animal + lote + entradas).
3. Roda migrations de novo → **idempotente** (não duplica; contagem de
   `schema_migrations` inalterada).
4. Confirma que os dados continuam (2 entradas).
5. Cria backup (`createSqliteBackup`) e valida o checksum (`verifyBackup`).
6. Adiciona uma entrada pós-backup (para provar o efeito do restore).
7. Restaura o backup (`applyRestoreSqliteBackup`) — cria backup de segurança
   pré-restore.
8. Confirma que o estado volta ao do backup: 2 entradas originais presentes,
   entrada pós-backup ausente.

## Execução (2026-07-16)
`npm run data:preservation:verify` → **OK verify-data-preservation-scenario**.

```json
{
  "migrations": 3,
  "entriesAfterInsert": 2,
  "backupSha256": "4e37033cd6b83cc4e142c8f359b346651ebfcc70850ed45f7fbbb2d3cdb1e3fb",
  "restoredEntries": 2,
  "dataPreserved": true
}
```

## Conclusão
Migração repetida não perde dados e o ciclo backup→restore preserva o estado
salvo. Isto valida, em automação, a promessa de "não perder dados ao atualizar/
reinstalar" — a validação física correspondente é o teste de máquina limpa.
