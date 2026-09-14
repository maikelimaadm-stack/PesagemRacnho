# 02 — Auditoria de Desacoplamento Base44

## Metodologia

Busca em `src/`, `electron/`, `package.json` por:

`base44`, `@base44/sdk`, `createClient`, `appParams`, `serverUrl`, `AuthContext`, `IndexedDBManager`, `localDb`, `base44Client`, URLs externas.

**Escopo:** código-fonte do projeto (excluindo `node_modules`).

---

## Resultado: Base44 removida do código-fonte

| Item | Status |
|------|--------|
| `@base44/sdk` no package.json | ❌ Ausente |
| Pasta `base44/` | ❌ Ausente |
| `base44Client.js` | ❌ Removido |
| `localDb.js` (IndexedDB) | ❌ Removido |
| `IndexedDBManager.jsx` | ❌ Removido |
| Chamadas HTTP a base44.com | ❌ Nenhuma em `src/` |
| Auth remota / tokens | ❌ Nenhum |
| PWA / service worker | ❌ Nenhum |

**Conclusão:** A remoção da Base44 no código foi **substancial**, não apenas cosmética.

---

## Resíduos e inconsistências (nomenclatura / legado)

| ID | Arquivo | Evidência | Risco | Ação recomendada |
|----|---------|-----------|-------|------------------|
| B-01 | `src/api/db.js` | API `db.entities.*` imita contrato Base44 (`list`, `filter`, `create`, `bulkCreate`) | MÉDIO | Renomear para `repository`/`storage` no slice D.4 |
| B-02 | `src/api/db.js` | `ensureEmpresaId()` + `DEFAULT_EMPRESA_ID = 'local'` | BAIXO | Manter temporariamente; remover quando multi-empresa não for necessário |
| B-03 | `src/components/DbBootstrap.jsx` | Texto diz "banco SQLite" mas storage é JSON | MÉDIO | Corrigir texto no slice D.1 |
| B-04 | `LancamentoPesagensIndividuais.jsx` | `pendingPesagensDB = []` — fila offline Base44 morta | ALTO | Remover código morto D.1 |
| B-05 | `LancamentoPesagensIndividuais.jsx` | `_offlineId`, badges "P", `editingOfflineId` referenciado mas não definido | ALTO | Remover ou reimplementar D.1 |
| B-06 | `GerenciarEmbarquesDialog.jsx` | Comentários "pendentes offline" | BAIXO | Limpar comentários D.1 |
| B-07 | Campos de entidade | `empresa_id`, `created_date`, `updated_date` — padrão Base44 | BAIXO | Manter até migration SQLite |
| B-08 | `electron/preload.cjs` | Nomes de entidade idênticos ao Base44 | BAIXO | OK durante transição |

---

## Wrapper local fingindo Base44?

**Sim, parcialmente.** `src/api/db.js` expõe `db.entities.EntityName` com os mesmos métodos que o SDK Base44 usava. Isso **facilitou a migração** mas **confunde a arquitetura** porque não é Base44 nem SQLite — é JSON file.

---

## Comunicação externa

| Tipo | Encontrado |
|------|------------|
| fetch/axios em src | ❌ |
| URLs https em src | ❌ |
| navigator.onLine | ❌ |
| Supabase CDN | ❌ (PWAInstaller removido) |

**Offline real no renderer:** Sim, desde que aberto via Electron (IPC disponível).

---

## Classificação final Base44

| Aspecto | Status |
|---------|--------|
| Dependência SDK | ✅ Removida |
| Comunicação remota | ✅ Removida |
| Nomenclatura legada | ⚠️ Presente |
| Fila offline IndexedDB | ⚠️ Código morto |
| Documentação interna | ⚠️ Desatualizada (SQLite vs JSON) |

**Risco global Base44:** **BAIXO** para dependência remota; **MÉDIO** para confusão arquitetural e código morto.
