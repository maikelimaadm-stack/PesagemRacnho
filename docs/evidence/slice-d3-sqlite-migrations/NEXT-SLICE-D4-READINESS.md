# NEXT-SLICE-D4-READINESS — Slice D.3

## Estado após D.3

- SQLite operacional em `{dataDir}/pesagens.db`
- Migration 001 aplicada
- 3 repositories prontos (weighing, animal, lot)
- IPC completo e testado via scripts
- JSON legado intacto e funcional para UI
- Healthcheck e detecção legacy disponíveis

## O que está pronto

| Item | Status |
|------|--------|
| Schema SQLite | ✅ |
| Migrations versionadas | ✅ |
| Repositories CRUD | ✅ |
| IPC seguro | ✅ |
| Healthcheck | ✅ |
| Legacy detection (dry-run) | ✅ |
| Scripts de verificação | ✅ |

## O que ainda falta

1. **Adapter layer** — `db.entities.PesagemIndividual.*` → weighingRepository
2. **Feature flag** — `STORAGE_BACKEND=json|sqlite`
3. **UI pagination** — PesagensIndividuais carrega tudo do JSON hoje
4. **Entidades secundárias** — Apartacao, Sanidade, Embarque no SQLite
5. **Migração de dados** — D.5

## Como trocar a UI para repository

Ordem recomendada:

1. Criar `electron/database/adapters/entityAdapter.cjs`
2. Implementar `PesagemIndividual` primeiro (maior impacto)
3. Feature flag: se `sqlite`, IPC `db:*` delega para repositories
4. Manter JSON como fallback 1 versão
5. Testar create/edit/delete/list na UI
6. Expandir para demais entidades

## Arquivos candidatos

| Arquivo | Ação D.4 |
|---------|----------|
| `electron/db.cjs` | Manter como fallback JSON |
| `electron/database/adapters/` | Novo — bridge entities → repos |
| `electron/main.cjs` | Roteamento por STORAGE_BACKEND |
| `src/pages/LancamentoPesagensIndividuais.jsx` | Sem mudança visual; backend transparente |
| `src/pages/PesagensIndividuais.jsx` | Paginação via weighing:list |

## Próximo slice recomendado

**Slice D.4** — Repository/adapter de pesagens e transição controlada da UI para SQLite.
