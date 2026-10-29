# 14 — Migrações (contrato de implementação)

**Programa 2.0 · 14/09/2026 · ADR-038, ADR-021, ADR-022, ADR-023, ADR-034.**

## 1. Regra central

O upgrade do Dexie não pode destruir dados. Antes de abrir o banco numa versão que exige migração:

```text
detectar versão atual → backup lógico completo → SHA-256 → gravar fisicamente →
validar (tamanho + hash relidos) → só então abrir na versão nova → backfill resumível → verificar
```

Se o backup falhar: **MIGRAÇÃO BLOQUEADA** (fail closed) — o banco não é aberto na versão nova, a tela mostra o diagnóstico e o app não aceita escrita.

## 2. `src/storage/migrations/migrationCoordinator.js`

```js
export async function inspectDatabase()                 // { exists, currentVersion, targetVersion, needsMigration, blockers[] }
export async function prepareMigration({ files })       // backup pré-migração + validação; devolve { backupPath, sha256, size } ou lança MIGRATION_BACKUP_FAILED
export async function openWithMigration({ files, onProgress }) // inspect → prepare (se necessário) → db.open() → runPendingBackfills → { migrated, report }
export async function runPendingBackfills({ onProgress })      // reentrante; lê appSettings['migration:vN'] e continua do checkpoint
export async function getMigrationState(version)        // estado técnico
export async function dryRunBackfill(version)           // relatório sem gravar (usado em Manutenção e na evidência)
```

Detecção: `Dexie.exists(DB_NAME)`; versão atual via `new Dexie(DB_NAME).open()` em modo dinâmico (`db.verno`), fechado em seguida. Bloqueios pré-v7: store `lotes` com registros → `MIGRATION_BLOCKED_LOTES` (o usuário exporta/limpa pela Manutenção antes).

Backup pré-migração: mesmo formato do backup completo (`createFullBackup` sobre a instância dinâmica, formato da versão de origem), nome `pre-migration-v<alvo>-YYYYMMDD-HHmmss.json`, gravado por `window.pesagemApp.files.writeUserFile({ subdir: 'backups' })`, validado por tamanho e SHA-256 relidos; registrado em `backupHistory('pre-migration')`. Sem ponte de arquivos (navegador de desenvolvimento): bloqueado, salvo `localStorage['pesagens.dev.allowUnsafeMigration']==='1'` — nunca no pacote.

## 3. Estado técnico (`appSettings`)

Chaves `migration:v7`, `migration:v8` (estado técnico, não catálogo):

```json
{ "versao": 7, "status": "PENDENTE|EM_ANDAMENTO|CONCLUIDA|FALHOU", "started_at": "...", "last_checkpoint": "B7:localId=12500",
  "processed": 12500, "total": 36000, "finished_at": null, "error": null, "backup": { "path": "...", "sha256": "...", "size": 123 },
  "relatorio": { "marcas": 5, "racas": 4, "parceiros": 3, "animaisAtualizados": 12000, "identificadores": 12000, "colisoesMarca": [], "saidasSemMotivo": 0 } }
```

## 4. Reentrância

- Cada passo (B1…B12 do documento 12 §5) é idempotente: só grava o que ainda falta (verifica por `nome_normalizado`, por `marca_id == null`, por `tipo === 'visual_marca'`, etc.).
- Lotes de 500 registros por cursor de `localId`; checkpoint após cada lote.
- Fechar o app no meio e reabrir → `runPendingBackfills` continua do checkpoint; nunca duplica.
- O `upgrade()` do Dexie só faz o que é seguro dentro da transação de versão (enums simples); o pesado é backfill.

## 5. Falha

- Erro em um lote: registra `status='FALHOU'`, `error`, mantém o backup, **bloqueia escrita** (flag `migrationBlocked` no `storageAdapter`; serviços de escrita lançam `MIGRATION_BLOCKED`), mostra diagnóstico com "Copiar diagnóstico".
- Retomada manual em Manutenção (ADMIN, `maintenance.migrate`): "Continuar migração" chama `runPendingBackfills`.
- Rollback lógico: restaurar o backup pré-migração pelo próprio Manutenção (o restore de formato anterior grava e depois roda o backfill novamente).

## 6. Restore cruzado

- `dryRunRestore` devolve `schemaUpgradeRequired`, `ignoredStores`, `newStores`.
- `applyRestore` de backup com `dbVersion < atual`: grava, converte enums mínimos e agenda `runPendingBackfills` na sequência; só então registra sucesso.
- Backups `formatVersion 2` continuam restauráveis; `formatVersion 3` acrescenta `dataContractVersion`, `uiBuildId`, `schemaVersion`.

## 7. Documentação por release

`docs/release/<versão>/MIGRATION-<de>-TO-<para>.md` (1.1.17→1.2.0; 1.3.0; 1.4.0; 2.0.0) com: pré-requisitos, backup, passos, relatório esperado, rollback, tempo medido nas massas (vazia, pequena, 36 mil, 250 mil).

## 8. Gates

- `migration:v7:verify` (`scripts/verify-v7-migration.mjs`): massas vazia, pequena e 36 mil (a 250 mil em `test:full`): contagens, ids preenchidos, payload limpo, `lotes` removida, enums, reentrância (interromper no meio e continuar sem duplicar), bloqueio sem backup, colisão de marca não fundida, tempo registrado.
- `storage:backup:verify` e `storage:import-restore:verify` atualizados: formato 3; restore de backup v2/v6 → backfill; usuários no backup.
