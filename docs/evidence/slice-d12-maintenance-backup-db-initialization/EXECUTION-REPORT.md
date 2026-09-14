# EXECUTION-REPORT — D.12

## Slice
D.12 — Correção do bug "Banco SQLite não inicializado" no backup do app instalado.

## Data
2026-07-20

## Branch / Commit
N/A — git não disponível neste ambiente.

## Objetivo
Backup (e toda a manutenção) funcionar logo após instalar/abrir, sem o usuário
configurar banco nem instalar SQLite, corrigindo a CAUSA (não a mensagem).

## Bug
`SQLITE_CONN_001: "Banco SQLite não inicializado"` ao criar backup, porque os
handlers/serviços chamavam `getConnection()` sem garantir a inicialização e não
havia inicializador central com recuperação. Ver ROOT-CAUSE.md e REPRODUCTION.md.

## Correção
Inicializador central idempotente `ensureDatabaseReady(dataDir)` compartilhado
por todos os handlers de manutenção/banco e pelo backupService. Ver
DATABASE-READY-SINGLETON.md.

## Arquivos alterados
- electron/database/sqliteConnection.cjs (+ isOpen)
- electron/database/index.cjs (+ ensureDatabaseReady; initializeSqliteDatabase delega)
- electron/database/maintenance/backupService.cjs (ensureDatabaseReady em backups)
- electron/ipc/maintenanceIpc.cjs (wrapper `ready` em todos os handlers)
- electron/ipc/databaseIpc.cjs (ensureDatabaseReady em healthcheck/migrations)
- package.json (script maintenance:first-run-backup:verify + em test:quick/test:full)
- docs/user/TESTE-MAQUINA-LIMPA.md, docs/release/1.0.0/RELEASE-CHECKLIST.md,
  docs/evidence/.../CLEAN-MACHINE-TEST-RECORD.md,
  docs/evidence/final-clean-machine-validation/FINAL-VALIDATION-REPORT.md

## Arquivos criados
- scripts/verify-maintenance-first-run-backup.mjs
- docs/evidence/slice-d12-maintenance-backup-db-initialization/ (10 arquivos)
- release/... (Setup.exe + .sha256 + manifest regenerados)

## Instalador
- Antes: SHA256 9d8c97bc...945a (D.11)
- Depois: **SHA256 292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52**
- Versão mantida em 1.0.0.

## Resultado
**CONCLUÍDO** na parte automatizável. Bug reproduzido e corrigido na causa;
gate de regressão criado e verde; instalador regenerado. Teste físico em máquina
limpa com o novo instalador permanece PENDENTE (responsabilidade da Maike).
