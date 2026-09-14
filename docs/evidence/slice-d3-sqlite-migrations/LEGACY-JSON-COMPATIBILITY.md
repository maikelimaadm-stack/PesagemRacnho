# LEGACY-JSON-COMPATIBILITY — Slice D.3

## Caminho do JSON atual

| Ambiente | Caminho |
|----------|---------|
| Dev | `{projeto}/data/pesagens.json` |
| Produção | `%APPDATA%/pesagens-individuais/data/pesagens.json` |

## JSON foi preservado

**Sim.** Nenhuma alteração em `electron/db.cjs`. Nenhum overwrite, move ou delete do JSON.

SQLite criado como arquivo separado: `pesagens.db` no mesmo diretório `data/`.

## Detecção implementada

Função: `detectLegacyJsonStorage(dataDir)` em `legacyJsonStorage.cjs`

Retorno:
```json
{
  "exists": true,
  "path": ".../pesagens.json",
  "sizeBytes": 12345,
  "readable": true,
  "estimatedRecords": 42
}
```

IPC: `database:legacy:detect`

## Dry-run de análise

Função: `analyzeLegacyJsonForMigration(dataDir)`

- Lê JSON read-only
- Conta registros por entidade (8 arrays legados)
- `wroteToSqlite: false` sempre
- `dryRun: true` sempre

IPC: `database:legacy:analyze`

Entidades contadas: PesagemIndividual, Apartacao, LoteApartacao, SanidadeAnimal, ConfiguracaoSanidade, ItemSanidade, Embarque, DocumentoEmbarque

## Migração real

**Não implementada neste slice.** Planejada para Slice D.5.

Campo `legacy_payload` em `weighing_entries` preparado para armazenar snapshot JSON durante importação futura.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Dois storages divergentes | D.4/D.5 unificam via feature flag |
| Usuário edita JSON manualmente | Migração D.5 com checksum/contagem |
| pesagens.db legado (sql.js) | Detectar e documentar em D.5 |
