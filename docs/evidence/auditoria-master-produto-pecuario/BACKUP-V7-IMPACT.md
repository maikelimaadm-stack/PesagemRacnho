# BACKUP-V7-IMPACT — Impacto da v7 em backup, restauração e importação JSON

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Contrato atual (`backupService.js`)

- Formato `pesagens-individuais-indexeddb-backup`, `formatVersion 2`; manifesto com `dbVersion`, `appVersion`, `counts`, `stores` (= `STORE_NAMES`, derivado de `STORES`); `integrity.sha256` sobre o JSON sem o bloco `integrity`.
- `readBackup`: recusa formato desconhecido, hash divergente, `dbVersion` maior que o do app, contagem divergente; stores ausentes nascem vazias (`allowLegacy`).
- `applyRestore`: exige `safetyEvidence` (backup físico com path/size/sha256), limpa **todas** as stores e regrava sem `localId`; confere contagens; registra `backupHistory('restore')`.
- `applyImportPesagens`: JSON de pesagens → `bulkCreateEntries` com hash idempotente.
- `clearAllData`: preserva `appSettings` e `backupHistory`.

## 2. O que muda com a v7

| Item | Impacto | Ação necessária no plano |
|---|---|---|
| Stores novas | entram automaticamente em `STORE_NAMES`, no backup e no restore | nenhuma no formato; `formatVersion` → 3 para registrar a mudança |
| Store `lotes` removida | backups v6 contêm `lotes`; `applyRestore` itera `STORE_NAMES` (v7), então `lotes` do backup é ignorada silenciosamente | aceitável (store vazia); o dry-run deve **listar** stores ignoradas |
| Backup v6 restaurado em app v7 | stores novas vazias; `animais.marca_id` etc. nulos; `pesagens` sem colunas promovidas | após o restore, executar o **backfill v7** (mesma rotina da migração) e registrar em `backupHistory('backfill-v7')`; sem isso, a UI v7 mostra marcas vazias |
| Backup v7 em app v6 | recusado por `dbVersion` maior (regra existente) | manter |
| `manifest.counts` | inclui stores novas | ok |
| Enums convertidos (`situacao`, `status`) | backup v6 traz valores antigos | o backfill converte; o dry-run mostra "backup de esquema anterior: será convertido" |
| `appSettings` catálogos | backup v6 contém `cadastros-auxiliares:*`; app v7 não os lê | o backfill migra para as stores **se** as stores estiverem vazias; senão ignora e registra |
| `clearAllData` | continua preservando `appSettings` | rever: com catálogos em stores, "limpar dados" apaga marcas/raças/parceiros; decidir se cadastros mestres são "dados" ou "estrutura" (DEC-018) |
| Importação JSON de pesagens (`weighing-entries-export`) | entradas trazem `legacy_payload` com marca/raça texto | importação resolve por nome normalizado, como o CSV |
| `safetyEvidence` na migração | hoje a migração de versão roda na abertura sem backup | o plano deve criar backup físico automático antes de abrir na v7 pela primeira vez (Electron tem a ponte `writeUserFile`; no navegador de desenvolvimento, aviso) |

## 3. Regras propostas

1. **Nenhum restore cruza versão sem backfill**: `applyRestore` lê `manifest.dbVersion`; se menor que a atual, agenda o backfill na mesma sequência e só depois registra sucesso.
2. `dryRunRestore` passa a devolver `schemaUpgradeRequired: true/false` e a lista de stores ignoradas/novas.
3. `formatVersion 3` documenta: stores v7, enums, colunas promovidas. Backups `formatVersion 2` continuam restauráveis.
4. Massa de teste (`testMass.js`) gera dados v7 (marcas/raças por id) para os gates `storage:backup:verify` e `storage:import-restore:verify`.

## 4. Documentação do usuário afetada

`docs/user/BACKUP-E-RESTAURACAO.md` (mensagem de "backup de versão anterior: conversão automática"), `GUIA-RAPIDO.md` (novos cadastros), `TESTE-MAQUINA-LIMPA.md` (roteiro com marca/raça cadastradas e restauração de backup v6).

## 5. Risco residual

Um backup v6 restaurado e **não** backfilled deixa `marca_id` nulo em animais; a UI deve tratar nulo como "marca não resolvida" e o `logicalIntegrity` deve apontar. Isso é critério de aceite do slice de migração.
