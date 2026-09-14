# LINT-BUILD-VERIFY (D.16)

Todos PASS (2026-07-20):
- lint, build
- test:quick (Dexie-centric)
- test:full (Dexie-centric, 20 passos OK)
- storage:all:verify (dexie, first-run, backup, import-restore, ui-contract,
  ui-first-run-persistence, maintenance-ui-flow, sqlite-detached)
- docs:user:verify (docs/release/1.1.0)
- installer:sqlite:verify (better-sqlite3 legado empacotado)
- e2e:installed:verify (estrito, Setup 1.1.0)
- release:checksum, release:manifest, dist

Suites reorganizadas: `test:quick`/`test:full` Dexie-centric; SQLite legado
movido para `test:legacy-sqlite` (opcional, ainda callable).

## rg final — classificação
- Fluxo operacional (src): 0 SQLite / 0 IPC de banco → corrigido/esperado.
- "Banco SQLite não inicializado" no renderer: 0 → removido.
- `maintenance:backup:sqlite`: só em electron legado + scripts antigos → legado.
- better-sqlite3: dependência **legada** (não operacional) → legado morto.
- db.entities operacional: 0; login/permiss/cloud: 0 → esperado.
- versão 1.1.0; 1.0.2/1.0.1/1.0.0 só em histórico/docs → documentação.
