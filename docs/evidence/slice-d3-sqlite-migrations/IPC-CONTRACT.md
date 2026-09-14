# IPC-CONTRACT — Slice D.3

## Handlers

### Database

| Channel | Descrição |
|---------|-----------|
| `database:healthcheck` | Status do banco SQLite |
| `database:migrations:status` | Migrations aplicadas/pendentes |
| `database:legacy:detect` | Detecta pesagens.json |
| `database:legacy:analyze` | Dry-run contagem por entidade JSON |

### Weighing

| Channel | Descrição |
|---------|-----------|
| `weighing:create` | Cria entry |
| `weighing:update` | Atualiza entry |
| `weighing:delete` | Soft delete |
| `weighing:get` | Busca por id |
| `weighing:list` | Lista paginada |
| `weighing:summary` | Totais (count, peso) |
| `weighing:count` | Contagem |

### Animals / Lots

| Channel | Descrição |
|---------|-----------|
| `animals:upsert` | Cria/atualiza animal |
| `animals:get` | Por id |
| `animals:find` | Busca textual |
| `animals:list` | Lista paginada |
| `lots:upsert` | Cria/atualiza lote |
| `lots:get` | Por id |
| `lots:find` | Busca textual |
| `lots:list` | Lista paginada |

### App (auxiliares)

| Channel | Descrição |
|---------|-----------|
| `app:getSqlitePath` | Caminho do .db |
| `app:getSqliteInitError` | Erro de init, se houver |
| `app:openSqliteFile` | Abre .db no SO |

## Payload esperado (exemplos)

### weighing:create

```json
{
  "data_pesagem": "2026-07-09",
  "peso_kg": 320.5,
  "animal_id": "uuid",
  "lote_id": "uuid",
  "observacao": "texto"
}
```

### weighing:list

```json
{
  "dataInicial": "2026-07-01",
  "dataFinal": "2026-07-31",
  "limit": 100,
  "offset": 0
}
```

## Resposta de sucesso

```json
{
  "ok": true,
  "data": { }
}
```

## Resposta de erro

```json
{
  "ok": false,
  "error": {
    "code": "SQLITE_REPO_001",
    "message": "peso_kg deve ser maior que zero",
    "details": {}
  }
}
```

## Error codes

| Code | Significado |
|------|-------------|
| SQLITE_CONN_001 | Falha ao abrir banco |
| SQLITE_DIR_001 | Falha ao criar diretório |
| SQLITE_MIG_001 | Falha ao executar migration |
| SQLITE_MIG_002 | Migration duplicada/fora de ordem |
| SQLITE_SCHEMA_001 | Schema inválido |
| SQLITE_REPO_001 | Erro de repository/validação |
| SQLITE_IPC_001 | Erro genérico IPC |

## Validações

- `peso_kg` obrigatório e > 0 (create/update)
- `data_pesagem` obrigatória (create)
- `limit` default 100, max 1000
- `offset` default 0
- Listagens filtram `deleted_at IS NULL`
- Prepared statements em todos os repositories
