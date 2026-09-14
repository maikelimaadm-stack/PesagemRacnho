# DATABASE-SCHEMA — Slice D.3

## Tabelas

| Tabela | Propósito |
|--------|-----------|
| schema_migrations | Controle de versão |
| animals | Cadastro de animais |
| lots | Lotes/pastos |
| weighing_sessions | Sessões de pesagem |
| weighing_entries | Lançamentos individuais de peso |
| audit_log | Trilha de auditoria |
| app_settings | Configurações chave-valor |
| backup_history | Histórico de backups |

## Campos principais

### weighing_entries (núcleo do domínio)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | TEXT PK | UUID |
| data_pesagem | TEXT NOT NULL | ISO date |
| peso_kg | REAL NOT NULL | CHECK > 0 |
| animal_id | TEXT FK | → animals |
| lote_id | TEXT FK | → lots |
| session_id | TEXT FK | → weighing_sessions |
| legacy_payload | TEXT | JSON serializado do registro antigo |
| deleted_at | TEXT | Soft delete |
| sync_status | TEXT | Default 'local' |
| version | INTEGER | Optimistic locking |

## Constraints

- `FOREIGN KEY` em weighing_entries → animals, lots, weighing_sessions
- `CHECK (peso_kg > 0)` em weighing_entries
- `UNIQUE(version)` em schema_migrations
- Soft delete via `deleted_at IS NULL` nas queries

## Índices

```
idx_weighing_entries_data
idx_weighing_entries_animal
idx_weighing_entries_lote
idx_weighing_entries_session
idx_weighing_entries_deleted
idx_animals_brinco
idx_lots_nome
```

## Relações

```
lots ← weighing_sessions.lote_id
lots ← weighing_entries.lote_id
animals ← weighing_entries.animal_id
weighing_sessions ← weighing_entries.session_id
```

## Campos preparados para futuro

| Campo | Uso futuro |
|-------|------------|
| legacy_payload | Migração JSON → SQLite (D.5) |
| sync_status, device_id | Sync cloud (não implementado) |
| version | Concorrência otimista |
| audit_log | Rastreabilidade |
| backup_history | Rotina de backup automático |
