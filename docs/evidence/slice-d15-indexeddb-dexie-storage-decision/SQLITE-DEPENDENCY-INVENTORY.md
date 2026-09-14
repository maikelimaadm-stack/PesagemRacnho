# SQLITE-DEPENDENCY-INVENTORY

Mapa do que depende de SQLite/better-sqlite3 hoje, com classificação para a
migração para Dexie/IndexedDB.

Legenda: **substituir** (equivalente Dexie) · **remover** (após validar) ·
**manter temp.** (legado morto até validar) · **legado** (backup/migração).

## Dependência de módulo nativo
| Item | Classificação |
|---|---|
| `better-sqlite3` (package.json dependencies + files + asarUnpack) | remover (após validar) |
| `postinstall: electron-builder install-app-deps` | remover/ajustar |

## Main process / infraestrutura (electron/database — ~4300 LOC)
| Item | Classificação |
|---|---|
| sqliteConnection.cjs | manter temp. → remover |
| databaseRuntime.cjs, databaseReady.cjs | manter temp. → remover |
| sqliteMigrations.cjs + migrations/*.sql (001–003) | legado (referência do schema) |
| sqliteHealthcheck.cjs, sqliteSchema.cjs, sqliteErrors.cjs | manter temp. → remover |
| index.cjs (initializeSqliteDatabase) | substituir (no-op/remover) |

## Repositories SQLite (electron/database/repositories/*)
weighingRepository, animalRepository, lotRepository, apartacaoRepository,
loteApartacaoRepository, healthConfigRepository, healthItemRepository,
animalHealthEventRepository, shipmentRepository, shipmentDocumentRepository,
repoHelpers → **substituir** por repositórios Dexie no renderer.

## IPC de banco (electron/ipc/*)
| Handler | Classificação |
|---|---|
| databaseIpc.cjs (healthcheck/migrations) | remover (Dexie no renderer) |
| weighingIpc.cjs | substituir → Dexie renderer |
| auxiliaryIpc.cjs (apartacao/lote) | substituir → Dexie renderer |
| sanidadeEmbarqueIpc.cjs | substituir → Dexie renderer |
| maintenanceIpc.cjs (backup/export/import/restore/integridade) | substituir → Dexie backup/export |
| dialogIpc.cjs (escolher/salvar arquivo, abrir pasta) | **manter** (FS/dialogs continuam via IPC) |

## Renderer — camada de troca (ponto único)
| Adapter | Hoje chama | Vira |
|---|---|---|
| src/api/db.js (`db.entities` Proxy) | window.pesagemApp.entities → db:* (JSON) | repositórios Dexie |
| weighing/infrastructure/weighingDataAdapter.js | window.pesagemApp.weighing (SQLite) | Dexie weighingRepo |
| auxiliary/infrastructure/auxiliaryDataAdapter.js | window.pesagemApp.apartacoes/loteApartacoes | Dexie |
| health/infrastructure/healthDataAdapter.js | window.pesagemApp.healthConfigs/... | Dexie |
| shipments/infrastructure/shipmentDataAdapter.js | window.pesagemApp.shipments/... | Dexie |
| maintenance/infrastructure/maintenanceDataAdapter.js | window.pesagemApp.maintenance | Dexie backup/export |

**Insight-chave:** a UI (pages/services/domain mappers) NÃO muda — só os
adapters. Esse é o ponto de troca contido.

## Legado a preservar
- `electron/db.cjs` (JSON) e `pesagens.json`: **legado/backup** — não apagar.
- migrations SQL: **legado** (documentam o schema; base para os stores Dexie).

## dialogs/FS que continuam via IPC (não são banco)
Escolher arquivo de import, salvar export em disco, abrir pasta de dados,
diagnóstico local (versão/log). Continuam no main via `dialogIpc` + `app:*`.
