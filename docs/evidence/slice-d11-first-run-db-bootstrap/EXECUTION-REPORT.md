# EXECUTION-REPORT — D.11 (First-run DB bootstrap)

## Slice
D.11 — Garantir que o banco SQLite seja criado automaticamente na primeira
abertura do app instalado + regenerar o instalador ausente.

## Data
2026-07-16

## Branch / Commit
N/A — git não disponível neste ambiente.

## Problema (relatado)
Instalador levado para outra máquina; o banco não apareceu/criou para uso
imediato. Requisito: instalar → abrir → app cria pasta+banco+migrations sozinho,
sem o usuário configurar nada.

## Diagnóstico
- O bootstrap **já existia e está correto** em `electron/main.cjs` →
  `app.whenReady()` → `initializeSqliteDatabase(dataDir)` (cria `data/`, cria
  `pesagens.db`, roda migrations) **antes** de `createWindow()`.
- Packaged usa `app.getPath('userData')/data` — nunca Program Files.
- A falha de abrir o banco (`SQLITE_CONN_001`) é **engolida** por try/catch: o app
  abre, mas o SQLite fica quebrado. Em dev isso apareceu por ABI do módulo nativo
  (better-sqlite3 estava compilado para Node). No app empacotado, o rebuild do
  electron-builder resolve o ABI — por isso **regenerar o instalador** faz parte
  do fix. (better-sqlite3 v12 é N-API, ABI-estável Node/Electron.)

## Mudanças de código (mínimas, sem UI/schema/arquitetura)
- `electron/main.cjs`:
  - Override de userData **test-only** via `PESAGENS_USER_DATA_DIR` (guardado,
    não exposto na UI, não é config de usuário final).
  - Garantia explícita de `mkdirSync(dataDir, {recursive:true})` + log
    `[bootstrap] dataDir:` no início do `whenReady`, antes de qualquer storage.

## Scripts / infra
- Novo `scripts/verify-first-run-database-bootstrap.mjs` + npm `first-run:db:verify`.
- `scripts/verify-installed-app-e2e.mjs` endurecido: release final exige Setup.exe
  + .sha256 + manifest (modo permissivo só com `E2E_DEV_PERMISSIVE=1`).
- `first-run:db:verify` adicionado a `test:quick` e `test:full`; `test:full` usa
  `e2e:installed:verify:dev` (permissivo) pré-release; o estrito roda pós-dist.

## Instalador
Regenerado com `npm run dist`. Novo SHA256:
`9d8c97bc71ff6e7a51c873e26bc67155fd7bb815df54d7ed16f661a3cb75945a`.

## Resultado
**CONCLUÍDO** na parte automatizável. First-run bootstrap validado do zero por
automação (16 tabelas, migrations 001–003, integrity ok). Execução do app
empacotado neste ambiente foi **bloqueada** (antivírus/sandbox) — o teste físico
em máquina limpa real permanece PENDENTE (responsabilidade da Maike).
