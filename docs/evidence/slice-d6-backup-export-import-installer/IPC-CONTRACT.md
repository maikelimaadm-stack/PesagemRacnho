# IPC-CONTRACT — Slice D.6

## Handlers

| Canal | Função |
|-------|--------|
| `maintenance:backup:sqlite` | createSqliteBackup |
| `maintenance:backup:full` | createFullDataBackup |
| `maintenance:backup:list` | listBackups |
| `maintenance:backup:verify` | verifyBackup |
| `maintenance:integrity:check` | runIntegrityCheck |
| `maintenance:integrity:quick-check` | runQuickCheck |
| `maintenance:database:stats` | getDatabaseStats |
| `maintenance:export:weighing-json` | exportWeighingEntriesToJson |
| `maintenance:export:weighing-csv` | exportWeighingEntriesToCsv |
| `maintenance:import:weighing-json:dry-run` | dryRunImport |
| `maintenance:import:weighing-json:apply` | applyImport |
| `maintenance:restore:sqlite:dry-run` | dryRunRestore |
| `maintenance:restore:sqlite:apply` | applyRestore |

## Payload

Filtros/options como objetos JSON. Paths como string absoluta dentro de `dataDir`.

## Resposta sucesso

```json
{ "ok": true, "data": {} }
```

## Resposta erro

```json
{
  "ok": false,
  "error": {
    "code": "BACKUP_002",
    "message": "Mensagem segura",
    "details": {}
  }
}
```

Stack traces não são enviados ao renderer (`wrapIpcHandler` + `toIpcError`).

## Error codes

BACKUP_001–004, EXPORT_001–002, IMPORT_001–005, RESTORE_001–003, INTEGRITY_001, PATH_001, INSTALLER_001–002.

## Validações de path

- Resolve absoluto
- Deve estar sob `dataDir`
- Não aceita diretório como arquivo
- Restore exige extensão `.db`
