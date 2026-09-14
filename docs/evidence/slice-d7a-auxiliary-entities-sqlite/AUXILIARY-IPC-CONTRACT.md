# AUXILIARY-IPC-CONTRACT — Slice D.7A

## Handlers

### Apartacoes

apartacoes:create|update|delete|get|list|count

### LoteApartacoes

lote-apartacoes:create|update|delete|get|list|count

### Migração

auxiliary:migration:status|dry-run|apply

## Payload / resposta

Contrato padrão `{ ok, data }` / `{ ok:false, error:{code,message,details} }` via `wrapIpcHandler`.

## Error codes

AUX_MAP_001, AUX_REPO_001, AUX_IPC_001, AUX_MIGRATION_001, AUX_LEGACY_001

## Segurança

Sem stack trace no renderer; paths de migração via dataDir no main.
