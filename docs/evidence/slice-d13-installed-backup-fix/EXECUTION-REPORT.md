# EXECUTION-REPORT — D.13

## Slice
D.13 — Correção real do backup no app instalado + versionamento 1.0.1 + prova de
código empacotado.

## Data
2026-07-20

## Branch / Commit
N/A — git não disponível.

## Objetivo
Corrigir definitivamente "Banco SQLite não inicializado" no backup do app
instalado, tornar o build identificável (1.0.1) e PROVAR que o pacote contém a
correção.

## Falha física
Após o D.12, o app instalado ainda falhou no backup. A mensagem exata
("Banco SQLite não inicializado", do getConnection) indica que o build instalado
não continha o fix — causa de identidade de build (todos os instaladores eram
1.0.0). Ver PHYSICAL-FAILURE-REPORT e ROOT-CAUSE-DEEP-DIVE.

## Correção técnica
- `ensureDatabaseReady` extraído para módulo independente
  `electron/database/databaseReady.cjs` (sem ciclo).
- Usado por maintenanceIpc (todos handlers), databaseIpc, backupService,
  exportService, importService, index.cjs.
- Bump para **1.0.1**; versão visível na tela de Manutenção; log local em
  `userData/logs/app.log`.
- Novos testes: `packaged:source:verify` (prova do app.asar),
  `maintenance:ui-backup-flow:verify` (contrato do botão), e
  `maintenance:first-run-backup:verify` reescrito para exercer o handler IPC real.

## Arquivos alterados
- electron/database/index.cjs, sqliteConnection.cjs (isOpen, D.12),
  maintenance/backupService.cjs, exportService.cjs, importService.cjs,
  legacyPesagemMigration.cjs
- electron/ipc/maintenanceIpc.cjs, databaseIpc.cjs
- electron/main.cjs (logger + app:getReleaseInfo), electron/preload.cjs
- src/pages/ManutencaoSistema.jsx (versão/banco no Diagnóstico)
- package.json (version 1.0.1 + scripts), scripts/verify-user-docs.mjs,
  scripts/verify-maintenance-first-run-backup.mjs
- CHANGELOG.md, docs/user/TESTE-MAQUINA-LIMPA.md, docs/release/*, evidências

## Arquivos criados
- electron/database/databaseReady.cjs
- electron/logging/appLogger.cjs
- scripts/verify-packaged-source-contains-backup-fix.mjs
- scripts/verify-maintenance-ui-backup-flow-contract.mjs
- docs/release/1.0.1/* , docs/evidence/slice-d13-installed-backup-fix/* (15)
- release/Pesagens Individuais Setup 1.0.1.exe + .sha256 + manifest

## Instalador
- Antes: 1.0.0 (D.12, 292c399d...)
- Depois: **1.0.1**, SHA256 `23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7`

## Resultado
**CONCLUÍDO** na parte automatizável, com prova de que o pacote 1.0.1 contém a
correção. Teste físico em máquina limpa com o instalador **1.0.1** permanece
PENDENTE (execução do exe bloqueada neste ambiente).
