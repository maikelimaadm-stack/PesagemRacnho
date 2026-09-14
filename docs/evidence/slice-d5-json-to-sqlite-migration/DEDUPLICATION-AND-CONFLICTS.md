# DEDUPLICATION-AND-CONFLICTS — Slice D.5

## Estratégia por id

Se `id` do JSON já existe em `weighing_entries` (não deletado), registro é **ignorado** (`toSkip`).

## Estratégia por hash

IDs ausentes no legado são gerados via `stableIdFromRecord()` — hash SHA256 do payload normalizado, prefixo `legacy-`. Idempotente entre execuções.

## Estratégia por campos fortes

Deduplicação intra-JSON por `id` resolvido. Duplicatas no mesmo batch com mesmo id são ignoradas após a primeira ocorrência.

## Conflitos encontrados

Nenhum conflito crítico nos testes sintéticos. Array `conflicts` reservado para divergências futuras de payload (registro não sobrescreve SQLite existente).

## Como foram tratados

- Duplicata por id → skip
- Registro inválido → skip + contagem em `invalid`
- Id existente no SQLite → skip

## Riscos

- Registros legados com ids diferentes mas mesmo animal/data/peso podem coexistir (comportamento conservador — não apaga)
- Próximo slice pode adicionar reconciliação manual se necessário
