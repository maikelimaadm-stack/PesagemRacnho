# EXECUTION-REPORT — D.16

## Slice
D.16 — Cutover operacional para IndexedDB/Dexie + release 1.1.0.

## Data
2026-07-20

## Branch / Commit
N/A — git não disponível.

## O que foi feito
Trocado o fluxo operacional do app de SQLite (via IPC) para **IndexedDB/Dexie**
(renderer). Todos os dataAdapters + a tela de Manutenção agora usam
`src/storage/storageAdapter.js`. Nenhum CRUD/manutenção operacional passa por
SQLite/IPC de banco. Versão 1.1.0; instalador gerado.

## Cutover (adapters → storageAdapter Dexie)
- weighing, auxiliary (apartações/lotes), health (sanidade), shipments (embarques)
- maintenance (backup/export/import/restore/integridade/stats)
- weighingService: removidas chamadas diretas a window.pesagemApp/SQLite
- bootstrapLocalDb (api/db.js): ensureStorageReady (Dexie)
- migrationStatus.js (legado SQLite) removido

## IPC restante (só arquivos/dialogs/diagnóstico)
- dialog:select-import-json (import/restore), app:writeUserFile (novo: salvar
  backup/export em userData), app:getReleaseInfo, app:getDiagnosticInfo.
- CRUD de banco NÃO usa mais IPC.

## Versão / release
- package.json 1.0.2 → 1.1.0
- release/Pesagens Individuais Setup 1.1.0.exe
- SHA256 616a3059566a5f9a2f7f1a0e68967c891dd18991111eb54c74f634531ba04a49
- 1.0.2 removido de release/

## better-sqlite3
Mantido como **legado morto** (justificado). Fluxo operacional 100% destacado
(gate storage:sqlite-detached). Ver SQLITE-DETACHMENT.md.

## Gates (todos PASS)
lint, build, test:quick, test:full (Dexie-centric, 20 OK), storage:all:verify
(8 gates), docs:user:verify, installer:sqlite:verify, e2e:installed:verify,
release:checksum, release:manifest.

## Limite honesto
Não consigo rodar o app instalado/Electron para validar a UI de ponta a ponta.
lint+build+gates cobrem imports/contratos/comportamento Dexie em Node, mas a
confirmação final das telas é o teste físico da Maike com o 1.1.0. A diferença:
com Dexie NÃO há SQLite no caminho do usuário, então "Banco SQLite não
inicializado" não pode ocorrer.
