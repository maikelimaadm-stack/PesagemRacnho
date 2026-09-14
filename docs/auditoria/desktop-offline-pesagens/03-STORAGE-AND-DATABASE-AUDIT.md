# 03 — Auditoria de Storage e Banco de Dados

## Como os dados são salvos hoje

### Respostas diretas

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | IndexedDB? | ❌ Não (removido) |
| 2 | localStorage? | ⚠️ Apenas preferências UI + `empresa_selecionada_id` |
| 3 | Memória React? | ✅ Cache em `useState` no lançamento; React Query na listagem |
| 4 | Arquivo local? | ✅ **`pesagens.json`** via Electron main |
| 5 | API externa? | ❌ |
| 6 | Mock? | ❌ |
| 7 | JSON local? | ✅ **Principal** |
| 8 | Abstração base44Client? | ❌ Substituída por `src/api/db.js` |
| 9 | Confiável para produção? | ❌ |
| 10 | Migration? | ❌ |
| 11 | Schema version? | ❌ |
| 12 | Backup? | ❌ Automático ausente; manual via copiar arquivo |
| 13 | Export/import? | ⚠️ CSV import na listagem; sem export/import JSON oficial |
| 14 | Transação? | ❌ |
| 15 | Validação antes de salvar? | ⚠️ Apenas na UI (toast), não no adapter |
| 16 | Risco duplicidade? | ⚠️ Médio — validação só no frontend |
| 17 | Risco perda de lançamentos? | ⚠️ Alto em crash durante write |
| 18 | Risco corrupção? | ⚠️ Alto — write síncrono do arquivo inteiro |

---

## Implementação atual (`electron/db.cjs`)

```txt
Arquivo: pesagens.json
Formato: { "PesagemIndividual": [...], "Apartacao": [...], ... }
Operações: list, filter, create, bulkCreate, update, delete, clearAll
Persistência: fs.writeFileSync a cada mutação
IDs: crypto.randomUUID ou fallback local_*
Timestamps: created_date, updated_date (ISO string)
```

### Localização do arquivo

| Ambiente | Caminho |
|----------|---------|
| Desenvolvimento | `{projeto}/data/pesagens.json` |
| Instalado (produção) | `%APPDATA%/pesagens-individuais/data/pesagens.json` |

Evidência: `electron/main.cjs` → `getDataDir()`.

---

## Classificação do armazenamento

### **PROVISÓRIO — INSEGURO PARA PRODUÇÃO**

**Motivos:**

1. **Sem atomic write** — se o app crashar durante `writeFileSync`, o JSON pode corromper.
2. **O(n) por operação** — reescreve arquivo completo; degrada com volume.
3. **Sem constraints** — duplicatas, FKs e integridade dependem 100% da UI.
4. **Sem WAL/journal** — impossível recovery parcial.
5. **Sem versionamento** — evolução de schema arriscada.
6. **clearAll() exposto** — botão "Limpar dados" no lançamento apaga tudo sem backup.

**Aceitável apenas para:** protótipo, demo, volumes muito baixos (<500 registros), ambiente controlado.

---

## Histórico de storage no projeto

| Fase | Storage | Status |
|------|---------|--------|
| Original | Base44 cloud | Removido |
| Intermediário | IndexedDB (localDb) | Removido |
| Intermediário | sql.js → pesagens.db | Removido |
| **Atual** | JSON pesagens.json | Ativo |

**Dados legados:** `data/pesagens.db` pode existir em máquinas antigas — **não há migração automática** para JSON.

---

## Conflito entre camadas de estado

| Camada | Risco |
|--------|-------|
| React Query cache (listagem) | Pode ficar stale se outra tela mutar sem invalidar |
| useState local (lançamento) | `loadAllData()` manual — não sincroniza automaticamente com listagem |
| localStorage | Não conflita com negócio |
| JSON file | Fonte única de verdade quando Electron ativo |

**Risco:** Usuário salva na tela de lançamento → abre listagem → pode precisar refresh manual (`refetch`).

---

## Mapa de chamadas de persistência

### PesagensIndividuais.jsx
- `db.entities.PesagemIndividual.list/bulkCreate/update/delete`
- `db.entities.Apartacao.list`, `LoteApartacao.list`

### LancamentoPesagensIndividuais.jsx
- CRUD completo em 8 entidades
- `clearAllData()` — operação destrutiva

### Componentes
- `GerenciarApartacoesDialog` — CRUD + propagação rename em cascata
- `GerenciarEmbarquesDialog` — CRUD embarque/documento
- `GerenciarSanidades` — CRUD sanidade

**Padrão:** acesso direto `db.entities.*` — **sem repository**.

---

## Recomendação de banco definitivo

Ver `10-FINAL-RECOMMENDATION.md` — **SQLite** com:

- `schema_migrations`
- transações
- índices em `data_pesagem`, `numero_animal`, `lote_id`
- soft delete
- backup automático diário
