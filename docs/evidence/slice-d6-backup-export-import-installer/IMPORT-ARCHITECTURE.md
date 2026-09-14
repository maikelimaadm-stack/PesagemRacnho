# IMPORT-ARCHITECTURE — Slice D.6

## Dry-run

`dryRunImportWeighingEntriesFromJson` valida estrutura, registros, duplicados e conflitos sem gravar.

## Apply

1. Dry-run
2. Backup SQLite pré-importação
3. Transação INSERT
4. Audit log (`acao=import`, `origem=json-import`)
5. `backup_history`
6. Rollback automático em erro (`IMPORT_004`)

## Deduplicação

Por `id` (existente no SQLite ou duplicado no arquivo). IDs ausentes via hash estável do mapper legado.

## Conflitos

Não sobrescreve registros existentes. Conta como skip/duplicate.

## Backup pré-importação

Obrigatório; falha com `IMPORT_003` se backup falhar.

## Transação

SQLite transaction wrapping todos os inserts.

## Rollback

Automático via falha da transaction better-sqlite3.

## Audit log

Uma entrada por registro inserido.

## FK

`animal_id` / `lote_id` / `session_id` inexistentes são anulados (payload original preservado em `legacy_payload`).
