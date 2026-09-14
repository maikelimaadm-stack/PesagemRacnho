# BASE44-RESIDUAL-SCAN — Slice D.1

## Comando usado

```bash
rg -n "base44|@base44/sdk|createClient|appParams|appId|functionsVersion|serverUrl|requiresAuth|appBaseUrl|base44.com|telemetry_sdk|pendingPesagensDB|editingOfflineId|setEditingOfflineId|_offlineId" .
```

Escopo adicional em código-fonte:

```bash
rg -n "base44|SQLite|pendingPesagens|_offlineId|editingOfflineId" src/ electron/
```

## Achados

| Local | Termo | Classificação |
|-------|-------|---------------|
| `src/` | — | **Nenhum achado** |
| `electron/` | — | **Nenhum achado** |
| `package.json` | `appId` | **Falso positivo** — config electron-builder (`com.pesagens.individuais`) |
| `docs/auditoria/desktop-offline-pesagens/*` | base44, offline, SQLite | **Documentação de auditoria** — histórico e plano futuro; não alterado |
| `node_modules/` | vários | **Ignorado** — dependências de terceiros |
| `dist/` | bundle antigo | **Artefato de build** — regenerado por `npm run build` |

## Classificação

- **Funcional:** 0 resíduos Base44 ou offline em código-fonte
- **Comentário/documentação:** apenas em `docs/auditoria/` (intencional)
- **Arquivo morto:** nenhum arquivo Base44 encontrado
- **Falso positivo:** `appId` em `package.json` (electron-builder)

## Resíduos funcionais

**Nenhum.** Base44 foi removida em slices anteriores; este slice removeu o último código offline morto que referenciava padrões da fila Base44.

## Resíduos apenas nominais

| Item | Local | Motivo para manter |
|------|-------|-------------------|
| `db.entities.*` | `src/api/db.js`, páginas | API compatível com SDK antigo; funciona via IPC JSON; refatorar no D.3/D.4 |
| `empresa_id`, `created_date`, `updated_date` | entidades JSON | Campos herdados do modelo Base44; migration SQLite tratará |
| `appId` | `package.json` | Identificador do instalador Electron, não Base44 |

## Ações tomadas

- Removido `pendingPesagensDB`, `_offlineId`, `editingOfflineId`, `setEditingOfflineId` de todo `src/`
- Corrigido texto `DbBootstrap.jsx` (SQLite → JSON provisório)
- Nenhuma remoção de `db.entities.*` (dívida técnica documentada)

## Pendências

- Refatorar nomenclatura `db.entities.*` para repository pattern (Slice D.3/D.4)
- Migrar campos legados Base44 para schema SQLite formal (Slice D.3)
