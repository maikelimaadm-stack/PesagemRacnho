# EXECUTION-REPORT — D.14

## Slice
D.14 — Hotfix 1.0.2: runtime SSOT do banco + diagnóstico local + backup garantido.

## Data
2026-07-20

## Branch / Commit
N/A — git não disponível.

## Objetivo
Corrigir a falha persistente "Banco SQLite não inicializado" no app instalado e
tornar o app auto-diagnosticável (versão real, caminho do banco, caminho do log,
exportar diagnóstico), com prova de que o pacote 1.0.2 contém tudo.

## Falha física
Após o D.13 (1.0.1), o backup ainda falhou no app instalado. A mensagem exata é a
do `getConnection()`, indicando que o build instalado não continha o fix
(problema de identidade de build). Ver PHYSICAL-FAILURE-REPORT / ROOT-CAUSE.

## Correção técnica
- `electron/database/databaseRuntime.cjs` — SSOT dos caminhos (userData, dataDir,
  databasePath, appVersion), configurado uma vez no `app.whenReady()`.
- `databaseReady.cjs` usa o runtime SSOT (fallback a override em testes) e loga
  início/sucesso/falha; normaliza falha como `DB_READY_FAILED`.
- `maintenanceIpc` usa wrapper único `withDatabaseReady(channel, fn)` em todos os
  handlers, com log de canal + database path.
- `backupService` continua se autoprotegendo com ensureDatabaseReady.
- IPC `app:getDiagnosticInfo` + `electron/diagnostics.cjs` (buildDiagnosticInfo).
- Tela de Manutenção mostra Versão/Banco/Caminho do banco/Log e "Copiar diagnóstico".
- Log local `userData/logs/app.log` com eventos de bootstrap e manutenção.
- Bump para **1.0.2**; novos testes `installed:runtime:diagnostic:verify` e
  `packaged:source:verify` ampliado.

## Arquivos criados
- electron/database/databaseRuntime.cjs, electron/diagnostics.cjs
- scripts/verify-installed-runtime-diagnostic.mjs
- docs/release/1.0.2/*, docs/evidence/slice-d14-runtime-db-diagnostic-hotfix/* (18)
- release/Pesagens Individuais Setup 1.0.2.exe + .sha256 + manifest

## Arquivos alterados
- electron/database/databaseReady.cjs, main.cjs, preload.cjs,
  ipc/maintenanceIpc.cjs, src/pages/ManutencaoSistema.jsx
- package.json (1.0.2 + scripts), scripts/verify-packaged-source-contains-backup-fix.mjs,
  scripts/verify-maintenance-ui-backup-flow-contract.mjs
- CHANGELOG.md, docs/user/TESTE-MAQUINA-LIMPA.md, CLEAN-MACHINE-TEST-RECORD.md,
  FINAL-VALIDATION-REPORT.md

## Instalador
- Antes: 1.0.1 (23863975...)
- Depois: **1.0.2**, SHA256 `eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303`

## Resultado
**CONCLUÍDO** na parte automatizável, com prova de pacote e diagnóstico de
runtime. Teste físico com o **1.0.2** permanece PENDENTE (execução do exe
bloqueada neste ambiente). Se ainda falhar, o app.log + "Copiar diagnóstico"
darão o ponto exato.
