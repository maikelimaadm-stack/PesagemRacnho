# NEXT-SLICE-D5-READINESS — Slice D.4

## Estado após D.4
- Tela lançamento: CRUD pesagens via weighingService
- Novos → SQLite | Legado → bridge JSON
- Mapper + IPC testados

## O que está pronto para D.5
- legacy_payload com snapshot completo
- detectLegacyJson / analyzeLegacyJson (main)
- mergeHybridEntries para validação contagem
- Scripts verify existentes

## Dados legados detectados
Via `database:legacy:detect` — contagem por entidade em pesagens.json

## Estratégia recomendada de migração
1. Backup pesagens.json.bak.{timestamp}
2. analyzeLegacyJsonForMigration (dry-run counts)
3. Script migrate-from-json.cjs em transação
4. Assert count(JSON PesagemIndividual) === count(SQLite)
5. Feature flag STORAGE_BACKEND=sqlite
6. Remover bridge

## Como validar antes/depois
- Contagem por entidade
- Amostra 10 registros campos críticos
- Soma pesos por dia
- App abre e lista

## Arquivos candidatos
- `electron/database/migrate-from-json.cjs` (novo D.5)
- `legacyWeighingBridge.js` (remover)
- `PesagensIndividuais.jsx` (migrar CRUD)

## Gates recomendados
- count match
- zero orphan lote_id
- npm run weighing:hybrid:verify pós-migração com dados reais em staging

## Próximo slice
**D.5 — Migração controlada JSON → SQLite + desativação bridge**
