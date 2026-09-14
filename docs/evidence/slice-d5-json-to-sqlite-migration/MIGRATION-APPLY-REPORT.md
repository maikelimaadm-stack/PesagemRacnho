# MIGRATION-APPLY-REPORT — Slice D.5

## Ambiente de teste

Script: `scripts/verify-legacy-pesagem-migration-apply.mjs`

## Resultado do apply

| Métrica | Valor |
|---------|-------|
| Backup criado | Sim (`{tempDir}/backups/`) |
| Inseridos | 2 |
| Ignorados | 0 |
| Inválidos | 1 |
| Conflitos | 0 |
| Status salvo | `completed` |
| Audit log | 2 entradas (`acao = migrate`) |
| JSON preservado | Sim (arquivo original intacto) |

## Registros migrados

- `origem = legacy-json-migration`
- `sync_status = local`
- `version = 1`
- Campos extras preservados em `legacy_payload`

## Resultado

**PASS** — `OK verify-legacy-pesagem-migration-apply`
