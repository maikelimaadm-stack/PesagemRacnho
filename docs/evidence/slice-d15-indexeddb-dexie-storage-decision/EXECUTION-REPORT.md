# EXECUTION-REPORT — D.15

## Slice
D.15 — Decisão arquitetural + fundação de armazenamento IndexedDB/Dexie.

## Data
2026-07-20

## Branch / Commit
N/A — git não disponível.

## Decisão
Adotar **IndexedDB/Dexie** como armazenamento operacional, aposentando o SQLite
nativo (better-sqlite3) do fluxo operacional. Motivo: elimina módulo nativo,
`app.asar.unpacked`, conexão no main process e a própria mensagem "Banco SQLite
não inicializado". Ver STORAGE-DECISION.md e SQLITE-DEPENDENCY-INVENTORY.md.

## O que foi ENTREGUE e VALIDADO nesta etapa (fundação)
- `dexie` (dependência) + `fake-indexeddb` (devDependency de teste) instalados.
- Camada Dexie completa em `src/storage/indexedDb/`:
  - schema.js (12 stores versionados), db.js (first-run automático),
  - repositories (CRUD/soft-delete/bulk/count + weighing summary),
  - backup/backupService.js (backup completo JSON, export CSV/JSON, import
    dry-run/apply, restore dry-run/apply),
  - health/health.js (integridade lógica + stats).
- `src/storage/storageAdapter.js` — facade único (UI → service → adapter → Dexie),
  sem IPC de banco.
- 6 verify scripts (Node + fake-indexeddb), todos PASS:
  storage:dexie / first-run / backup / import-restore / ui-contract / sqlite-detached.
- Adicionados a test:quick e test:full. `test:full` → PASS (40 passos OK) com
  Dexie E SQLite convivendo.

## O que NÃO foi feito (staged — honesto)
- **Cutover da UI**: as pages/adapters ainda usam SQLite via IPC. Reescrever os
  5 dataAdapters + o proxy `db.entities` para o storageAdapter é a etapa seguinte
  — e ela NÃO pode ser validada por mim (não consigo rodar o app instalado). Fazer
  isso às cegas repetiria o padrão "script verde, físico vermelho".
- **Remoção de better-sqlite3 / código SQLite**: mantido como legado morto (a
  própria spec autoriza manter se remover for arriscado). Fluxo SQLite intacto.
- **Bump 1.1.0 / instalador**: NÃO gerado. Subir "1.1.0 = migração Dexie" com a
  UI ainda em SQLite seria rótulo enganoso e criaria mais um build ambíguo. O
  1.1.0 deve sair QUANDO a UI estiver em Dexie e validada fisicamente.

## Resultado
Fundação Dexie **real e validada** (first-run, CRUD, backup, import/restore,
integridade), destacada de SQLite. Migração de UI + remoção de SQLite + release
1.1.0 = próximos passos, dependentes de validação física. Ver NEXT-STEPS.md.
