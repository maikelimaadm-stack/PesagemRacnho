# NEXT-SLICE-D3-READINESS — Slice D.1

## Estado atual após D.1

- Electron shell funcional com IPC (`window.pesagemApp.entities.*`)
- Storage: JSON em `electron/db.cjs` → `pesagens.json`
- Lint limpo, build OK
- Código offline/Base44 morto removido do `src/`
- UI inalterada visualmente
- 8 entidades JSON: PesagemIndividual, Apartacao, LoteApartacao, SanidadeAnimal, ConfiguracaoSanidade, ItemSanidade, Embarque, DocumentoEmbarque

## O que está pronto para D.3

| Item | Status |
|------|--------|
| IPC handlers no main process | ✅ Pronto para trocar backend |
| Interface `db.entities.*` estável | ✅ UI não precisa mudar imediatamente |
| Instalador NSIS | ✅ Existente |
| Auditoria e schema proposto | ✅ Em `docs/auditoria/` |
| Código morto offline removido | ✅ D.1 concluído |
| Lint/build verdes | ✅ |

## O que ainda precisa ser cuidado

1. **Compilação better-sqlite3 no Windows** — plano B: sql.js no main process
2. **Migração JSON → SQLite** — script one-shot com validação de contagem
3. **Atomic writes** — substituir `writeFileSync` direto
4. **Rollback** — feature flag `STORAGE_BACKEND=sqlite|json` por 1 versão (recomendação auditoria)
5. **Dados legados** — `data/pesagens.db` (sql.js antigo) pode existir em máquinas antigas
6. **Refatoração gradual** — `db.entities.*` → repository (pode ser D.3 ou D.4)

## Recomendação para SQLite

- **better-sqlite3** no main process (`electron/sqlite/db.cjs`)
- WAL mode + transações
- Migration `001_initial.sql` espelhando entidades JSON atuais
- Manter mesma interface IPC para minimizar mudanças na UI
- Script `migrate-from-json.cjs` com assert `count(JSON) === count(SQLite)`

## Arquivos candidatos para repository

| Arquivo atual | Papel futuro |
|---------------|--------------|
| `electron/db.cjs` | Substituído por `electron/sqlite/db.cjs` |
| `src/api/db.js` | Proxy IPC — manter interface, trocar backend |
| `src/pages/LancamentoPesagensIndividuais.jsx` | Consumidor — extrair queries no D.4 |
| `src/pages/PesagensIndividuais.jsx` | Consumidor — extrair queries no D.4 |

## Arquivos candidatos para migration

| Arquivo | Conteúdo |
|---------|----------|
| `electron/sqlite/migrations/001_initial.sql` | Schema 8 tabelas |
| `electron/sqlite/migrate-from-json.cjs` | Import one-shot de `pesagens.json` |
| `electron/sqlite/migrations/meta.json` | Controle de versão |

## Próximo slice recomendado

**Slice D.3 — SQLite + migrations**
