# EXECUTION-REPORT — Slice D.7A

## Slice

D.7A — Migração planejada das entidades auxiliares restantes para SQLite

## Data

2026-07-13

## Branch

N/A — git não disponível

## Commit

N/A — git não disponível

## Objetivo

Migrar Apartacao e LoteApartacao do JSON para SQLite com migrations, repositories, IPC, services, migração idempotente e UI sem alteração visual.

## Arquivos alterados

- electron/main.cjs, electron/preload.cjs
- electron/database/sqliteSchema.cjs, sqliteHealthcheck.cjs
- package.json
- src/pages/PesagensIndividuais.jsx, LancamentoPesagensIndividuais.jsx
- src/components/pesagens/GerenciarApartacoesDialog.jsx
- src/modules/weighing/infrastructure/legacyWeighingBridge.js (comentário)

## Arquivos criados

- electron/database/migrations/002_auxiliary_entities.sql
- electron/database/repositories/apartacaoRepository.cjs
- electron/database/repositories/loteApartacaoRepository.cjs
- electron/database/auxiliaryLegacyMigration.cjs
- electron/ipc/auxiliaryIpc.cjs
- src/modules/auxiliary/**
- scripts/verify-auxiliary-*.mjs, auxiliary-test-helper.mjs
- docs/evidence/slice-d7a-auxiliary-entities-sqlite/*

## Entidades migradas

Apartacao, LoteApartacao

## Entidades não migradas

Sanidade*, Embarque*, DocumentoEmbarque

## Resumo

Migration 002 cria apartacoes/lote_apartacoes. Repositories + IPC + apartacaoService. Migração legado com backup/dry-run/apply. Telas de pesagens usam service. Bridge pesagens mantida inativa.

## Resultado

**SUCESSO**
