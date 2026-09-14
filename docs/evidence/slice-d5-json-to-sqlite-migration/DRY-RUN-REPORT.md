# DRY-RUN-REPORT — Slice D.5

## Ambiente de teste

Script: `scripts/verify-legacy-pesagem-migration-dry-run.mjs`

Dados sintéticos: 3 registros (2 válidos, 1 inválido — peso 0).

## Resultado do dry-run

| Métrica | Valor |
|---------|-------|
| Total legado | 3 |
| Válidos | 2 |
| Inválidos | 1 |
| Duplicados | 0 |
| Já existentes no SQLite | 0 |
| A inserir | 2 |
| Conflitos | 0 |

## Validações

- Dry-run **não grava** no SQLite (count permanece 0)
- Registros inválidos detectados com amostra em `invalidSamples`
- Duplicatas detectadas por `id` e presença no SQLite

## Resultado

**PASS** — `OK verify-legacy-pesagem-migration-dry-run`
