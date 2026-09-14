# 07 — Plano de Migração de Storage

## Estado atual dos dados

| Fonte | Local | Existe? | Conteúdo |
|-------|-------|---------|----------|
| JSON atual | `data/pesagens.json` | ✅ | 8 arrays vazios (ambiente auditado) |
| SQLite legado | `data/pesagens.db` | ⚠️ Pode existir em máquinas antigas | Formato sql.js |
| IndexedDB | Browser | ⚠️ Só se rodou versão antiga no browser | Obsoleto |
| Base44 cloud | Remoto | ❌ Descontinuado | — |

**Dados reais hoje:** Provavelmente **vazios ou mínimos** no ambiente de desenvolvimento auditado. Em produção, assumir que usuários podem ter JSON com lançamentos reais.

---

## Objetivo da migração

JSON provisório → **SQLite definitivo** com rollback e validação de contagem.

---

## Fase 1 — Backup/exportação do estado atual

**Ações:**
1. Copiar `pesagens.json` → `pesagens.json.bak.{timestamp}`
2. Exportar via script read-only: contagem por entidade
3. Se existir `pesagens.db`, exportar para JSON intermediário (script one-shot com sql.js — **somente na migração**)
4. Gerar manifest:

```json
{
  "exported_at": "ISO",
  "schema_version": "json-v1",
  "counts": { "PesagemIndividual": N, ... },
  "checksum_sha256": "..."
}
```

**Rollback:** Restaurar `.bak` file.

---

## Fase 2 — Criação SQLite + migrations

**Ações:**
1. Criar `electron/sqlite/` com better-sqlite3
2. Tabela `schema_migrations (version, applied_at)`
3. Migration v001: tabelas iniciais
4. Banco em `{userData}/data/pesagens.db`

**Rollback:** Deletar `.db` novo; app continua lendo JSON (modo compat).

---

## Fase 3 — Importação controlada

**Ações:**
1. Ler JSON exportado
2. Importar em transação única por entidade
3. Validar FKs (lote → apartação, pesagem → lote)
4. Log de registros rejeitados

**Rollback:** `ROLLBACK` transação; JSON intacto.

---

## Fase 4 — Validação contagem e integridade

**Checklist:**
- [ ] count(JSON) === count(SQLite) por entidade
- [ ] Amostra 10 pesagens: campos críticos iguais
- [ ] Soma pesos por dia igual
- [ ] Nenhum lote_id órfão
- [ ] App abre e lista dados corretamente

---

## Fase 5 — Troca do repository

**Ações:**
1. `db.js` aponta para SQLite via IPC (mesma interface)
2. Feature flag `STORAGE_BACKEND=sqlite|json` por 1 versão
3. Monitorar erros

**Rollback:** Flag `json` + restaurar backup.

---

## Fase 6 — Remoção storage antigo

**Ações:**
1. Remover `electron/db.cjs` JSON
2. Remover scripts init-db
3. Arquivar JSON como `pesagens.json.migrated`
4. Documentar em CHANGELOG

**Rollback:** Manter `.bak` por 90 dias.

---

## Testes de migração

| Cenário | Esperado |
|---------|----------|
| Base vazia | SQLite criado; 0 registros |
| 100 pesagens fictícias | Contagem 100; GMD preservado |
| JSON corrompido | Falha controlada; JSON backup intacto |
| JSON + .db legado | Migração preferir JSON mais recente (por mtime) |
| Duplicata id | Rejeitar ou upsert documentado |

---

## Compatibilidade temporária

Durante fases 2-5, manter **dual-read** somente se necessário. Preferir **big-bang controlado** com backup porque volume atual é baixo.

---

## Dados IndexedDB (legado browser)

Se usuário tinha dados só no IndexedDB:
1. Fornecer export one-time via versão bridge (não implementada)
2. Ou considerar perdido — documentar claramente

**Risco:** BAIXO se sempre usou desktop recente.
