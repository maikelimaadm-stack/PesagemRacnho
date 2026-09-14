# D7B-IPC-CONTRACT

## Handlers

Registrados em `electron/ipc/sanidadeEmbarqueIpc.cjs` via `registerSanidadeEmbarqueIpc`.

### CRUD prefixes
- health-configs:*
- health-items:*
- animal-health-events:*
- shipments:*
- shipment-documents:*

Cada um: create, update, delete, get, list, count.

### Migration
- d7b:migration:status
- d7b:migration:sanidade:dry-run
- d7b:migration:sanidade:apply
- d7b:migration:embarque:dry-run
- d7b:migration:embarque:apply

## Payload

Objetos JSON planos com campos de domínio PT. Filters: empresaId, limit, offset, ids de FK.

## Resposta sucesso

```json
{ "ok": true, "data": {} }
```

## Resposta erro

```json
{
  "ok": false,
  "error": { "code": "D7B_REPO_001", "message": "Mensagem segura", "details": {} }
}
```

## Error codes

- D7B_MAP_001 — payload inválido
- D7B_REPO_001 — erro repository
- D7B_IPC_001 — erro IPC (wrap)
- D7B_MIGRATION_001 — falha migração
- D7B_LEGACY_001 — falha ler JSON legado
- D7B_CONFLICT_001 — conflito crítico

## Segurança

- wrapIpcHandler sem stack trace ao renderer
- prepared statements
- soft delete
- preload expõe APIs tipadas (`healthConfigs`, `healthItems`, `animalHealthEvents`, `shipments`, `shipmentDocuments`)
