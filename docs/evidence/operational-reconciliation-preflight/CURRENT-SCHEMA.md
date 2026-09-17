# CURRENT-SCHEMA — mapa do armazenamento atual (preflight da reconciliação operacional)

| Campo | Valor |
|---|---|
| Data | 17/09/2026 |
| Branch / HEAD | `program/sanity-launch-import` / `d44d5b9` (árvore limpa) |
| Método | Somente leitura do código (Read/Grep/Glob e `git show`/`git tag` sem alterar estado). Nenhum servidor, nenhum gate executado. |
| Fonte da verdade | O código em `src/`, `scripts/` e `electron/`. Quando um documento antigo diverge, a divergência está marcada como **DIVERGÊNCIA** e prevalece o código. |
| Dexie instalado | `4.4.5` (`package.json:128` declara `^4.4.4`) |
| Uso | Base para desenhar: Sanidade como stores próprias, contexto do Lançamento, Importação/Exportação reconstruídas e importação que refaz a série cronológica. **Nada foi implementado.** |

---

## 0. Respostas diretas

1. **Versão atual do banco:** `DB_VERSION = 7` (`src/storage/indexedDb/schema.js:6`). Nome `pesagens-individuais` (`schema.js:5`). 23 stores (`schema.js:51-82`).
2. **Histórico Dexie declarado:** `version(5)` → `version(6)` (remove 3 stores de sanidade, `upgrade` limpa `sanidade_ids/sanidades` das pesagens) → `version(7)` (remove `lotes`, cria 9 stores, `upgrade` leve de enums). `src/storage/indexedDb/db.js:28-65`.
3. **A v7 já foi distribuída?** **Não como release final, mas existem bancos v7 reais.** Existe a tag `v1.2.0-rc1` → commit `3b27958` (16/09/2026) e o instalador `release-unsigned/Pesagens Individuais Setup 1.2.0.exe` com manifesto `dbSchemaVersion 7` (`docs/release/1.2.0/RC1.md:5,10`), classificado `distribution: unsigned-diagnostic` (`RC1.md:11`) e com status **"Candidato. Promover para `v1.2.0` somente após o teste físico"** (`RC1.md:24`). Não há tag `v1.2.0`. Antes dele houve um instalador de 15/09 (`cc024d8-dirty`, `RC1.md:15`, commit de 15/09/2026) e, segundo o registro do programa (não verificável pelo código), um banco de desenvolvimento v7 com usuário de teste. Conclusão operacional: **tratar a v7 como congelada** — qualquer máquina que abriu o RC ou o build de 15/09 tem `verno = 7` e `appSettings['migration:v7']`.
4. **Menor bump seguro para adicionar stores:** **`DB_VERSION = 8`** com `STORES_V8 = { ...STORES_V7, <novas stores> }`, sem stores removidas, `upgrade()` vazio ou apenas transformações leves e idempotentes, e o trabalho pesado num backfill v8 resumível. Editar `STORES_V7` "no lugar" **não é seguro** (ver §3.6: o Dexie 4 aplica "schema patch" silencioso, sem backup pré-migração, sem estado técnico e com `verno` fracionário). Versão fracionária (`7.1`) é aceita pelo Dexie (`node_modules/dexie/dist/dexie.js:6001`), mas quebra as convenções literais do repositório (`migration:v7.1`, `schema-v7.1`, `pre-migration-v7.1-…`, fórmula `dbVersion <= 6`).
5. **Declarar a v8 hoje NÃO basta:** o coordenador executa **somente o backfill da versão vigente** (`BACKFILLS[DB_VERSION]`, `src/storage/migrations/migrationCoordinator.js:31,126`). Com `DB_VERSION = 8`: banco novo deixaria de receber os seeds da v7; banco v6 (1.1.17/1.1.18) pularia o backfill v7 inteiro; restore de backup v6 também. É obrigatório transformar o coordenador numa **cadeia ordenada de backfills** (§5.3).
6. **Backup pré-migração obrigatório:** sim, disparado automaticamente por `openWithMigration` sempre que `verno instalado < DB_VERSION` (`migrationCoordinator.js:189-197`). Fail-closed: sem porta de arquivos, falha de gravação ou SHA-256/tamanho divergentes → `MIGRATION_BACKUP_FAILED` e o banco **não** é aberto na versão nova (`src/storage/migrations/preMigrationBackup.js:42-84`). Não há nada a "registrar" para a v8 ganhar isso — basta o bump.
7. **Migrações resumíveis:** sim na v7 (checkpoint por lote de 500 gravado **na mesma transação** do lote, `src/storage/migrations/v7Backfill.js:471-503`). O mecanismo é por arquivo de backfill; a v8 precisa implementar o seu.
8. **Backup:** `BACKUP_FORMAT = 'pesagens-individuais-indexeddb-backup'` (`schema.js:7`), `BACKUP_FORMAT_VERSION = 3` (`src/versioning/versionInfo.js:20`). Stores incluídas = `STORE_NAMES = Object.keys(STORES)` **automático** (`schema.js:92`, `src/storage/indexedDb/backup/backupService.js:87`). Toda store nova entra no backup sem código adicional.
9. **"Limpar dados operacionais":** apaga toda store que NÃO estiver em `MASTER_REGISTRY_STORES ∪ PROTECTED_STORES` (`backupService.js:272-276`). Store nova sem classificação é **apagada** por padrão. **"Reset completo":** apaga tudo exceto `backupHistory` e roda os backfills (`backupService.js:299-304`).
10. **Auditoria:** store `auditoria` (`schema.js:66`), **quatro gravadores distintos** sem função canônica única (§10). Ator = `usuario_id` + `usuario_nome_snapshot`.
11. **`importacoes`:** índice único `&arquivo_hash` (`schema.js:67`); só `bulkCreateEntries` grava, sempre `status: 'CONCLUIDA'`, dentro da mesma transação das pesagens (`src/modules/weighing/infrastructure/weighingDataAdapter.js:457-462,652-662`). Não há vínculo pesagem → importação.

---

## 1. Arquivos lidos

| Arquivo | Papel |
|---|---|
| `src/storage/indexedDb/schema.js` | Constantes, `STORES_V5/V6/V7`, stores removidas, classificação de stores, enums |
| `src/storage/indexedDb/db.js` | Instância Dexie singleton, cadeia `version(5..7)`, `ensureStorageReady` |
| `src/storage/indexedDb/normalize.js` | `normalizeName`, `situacaoFromExitReason`, `SESSION_OPERATOR_FIELD`, `civilDateFromIso` |
| `src/storage/indexedDb/repositories/genericRepository.js` | CRUD genérico com soft delete e bloqueio de escrita |
| `src/storage/indexedDb/repositories/index.js` | Repositórios por store, `weighing.listByPeriodo`, `read/writeAppSetting` |
| `src/storage/indexedDb/auditActor.js` | Provedor de ator (usuário da sessão) para a auditoria |
| `src/storage/indexedDb/backup/backupService.js` | Backup, export CSV/JSON, restore, limpeza, reset, importação JSON |
| `src/storage/indexedDb/health/health.js` | `logicalIntegrity`, `databaseStats` |
| `src/storage/storageAdapter.js` | Fachada única |
| `src/storage/migrations/migrationCoordinator.js` | Inspeção, backup pré-migração, estado PENDENTE, abertura, backfills |
| `src/storage/migrations/migrationState.js` | Estado técnico `migration:vN`, bloqueio de escrita |
| `src/storage/migrations/preMigrationBackup.js` | Backup físico pré-migração |
| `src/storage/migrations/v7Backfill.js` | Backfill B1..B12 |
| `src/modules/maintenance/application/maintenanceService.js` | Autorização e confirmação textual |
| `src/modules/maintenance/infrastructure/maintenanceDataAdapter.js` | Backup físico de segurança antes de import/restore/limpeza/reset; diagnóstico |
| `src/modules/weighing/infrastructure/weighingDataAdapter.js` | Transações de pesagem (lidas para §12) |
| `src/modules/weighing/application/weighingService.js`, `domain/weighingSeries.js`, `domain/weighingCalculations.js`, `domain/weighingMapper.js` | Recalculo de série e mapeamento |
| `src/modules/auth/application/authAudit.js`, `auditContext.js`; `src/modules/catalog/application/masterRegistryService.js`; `src/modules/settings/application/appConfigService.js` | Gravadores de auditoria |
| `src/api/db.js`, `src/components/DbBootstrap.jsx`, `src/versioning/versionInfo.js`, `electron/main.cjs` | Bootstrap, versões, gravação física |
| `scripts/verify-dexie-storage.mjs`, `verify-v7-migration.mjs`, `verify-dexie-backup.mjs`, `verify-dexie-import-restore.mjs`, `verify-dexie-first-run.mjs`, `verify-dexie-ui-first-run-persistence.mjs`, `verify-dexie-maintenance-ui-flow.mjs`, `verify-no-legacy-storage.mjs`, `verify-version-contract.mjs`, `verify-animal-history-integrity.mjs` | Gates de storage/backup/restore/first-run |
| `docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md`, `14-MIGRACOES.md`, `docs/release/1.2.0/*` | Confrontados com o código (divergências em §14) |
| `node_modules/dexie/dist/dexie.js` | Comportamento real de abertura/versão do Dexie 4.4.5 |

---

## 2. Identidade e constantes (`schema.js`)

| Constante | Valor | Linha |
|---|---|---|
| `DB_NAME` | `'pesagens-individuais'` | `schema.js:5` |
| `DB_VERSION` | `7` | `schema.js:6` |
| `BACKUP_FORMAT` | `'pesagens-individuais-indexeddb-backup'` | `schema.js:7` |
| `STORES` | `STORES_V7` | `schema.js:89` |
| `STORE_NAMES` | `Object.keys(STORES)` (23, na ordem de declaração) | `schema.js:92` |
| `DOMAIN_STORES` | `STORE_NAMES` sem `appSettings`, `backupHistory` | `schema.js:95` |
| `MASTER_REGISTRY_STORES` | `marcas, racas, categoriasAnimal, parceiros, propriedades, causasMorte, faixasIdentificadores, excecoesIdentificadores` | `schema.js:98-107` |
| `PROTECTED_STORES` | `usuarios, appSettings, backupHistory` | `schema.js:110` |
| `USERS_STORE` / `USUARIO_ROLES` | `'usuarios'` / `ADMIN, GESTOR, OPERADOR, CONSULTA` | `schema.js:113-114` |
| Enums | `ANIMAL_SITUACOES`, `IDENTIFICADOR_TIPOS`, `SESSAO_STATUS`, `LOTE_SITUACOES`, `PARCEIRO_PAPEIS`, `FAIXA_TIPOS`, `FAIXA_SITUACOES`, `EXCECAO_MOTIVOS` | `schema.js:117-125` |

Versionamento correlato (`src/versioning/versionInfo.js`): `DB_SCHEMA_VERSION = DB_VERSION` (`:19`), `BACKUP_FORMAT_VERSION = 3` (`:20`), `DATA_CONTRACT_VERSION = 2` (`:23`), `DATA_BUILD_ID = 'schema-v7'` **literal** (`:27`; o gate `verify-version-contract.mjs:170-171` exige `schema-v${DB_SCHEMA_VERSION}` e `verify-packaged-build.mjs:46` procura o literal no bundle).

---

## 3. Histórico de versões Dexie

### 3.1 Como o Dexie recebe as versões (`db.js`)

- Singleton `_db` (`db.js:21,25-26`). `getDb()` declara, em ordem: `db.version(5).stores(STORES_V5)` (`:28`); `db.version(6).stores({ ...STORES_V6, ...REMOVED_STORES_V6 }).upgrade(...)` (`:29-49`); `db.version(7).stores({ ...STORES_V7, ...REMOVED_STORES_V7 }).upgrade(...)` (`:50-65`).
- Padrão do repositório: **cada versão recebe o conjunto completo das stores daquela versão** mais o mapa de removidas com valor `null` (o Dexie apaga a store). As definições antigas ficam como constantes históricas em `schema.js` e são importadas pelo `db.js` e pelos gates (`verify-dexie-storage.mjs:12`, `verify-v7-migration.mjs:17`).
- `ensureStorageReady()` abre se estiver fechado (`db.js:74-80`); `getDbVersion()` devolve a constante `DB_VERSION`, **não** o `verno` instalado (`db.js:82-84`).
- Um banco v5 aberto pelo app atual executa, na mesma transação `versionchange`, o `upgrade` da v6 e depois o da v7.

### 3.2 v5 (histórica) — 18 stores

`STORES_V5 = { ...STORES_V6, configuracoesSanidade, itensSanidade, sanidadesAnimal }` (`schema.js:33-38`):

| Store removida na v6 | Índices da v5 |
|---|---|
| `configuracoesSanidade` | `++localId, &id, empresa_id, nome, tipo, ativo, created_at, updated_at, deleted_at` |
| `itensSanidade` | `++localId, &id, configuracao_id, nome, ativo, created_at, updated_at, deleted_at` |
| `sanidadesAnimal` | `++localId, &id, animal_id, pesagem_id, configuracao_id, data_aplicacao, status, created_at, updated_at, deleted_at` |

### 3.3 v6 (1.1.17 / 1.1.18) — 15 stores

- Stores: `pesagens, apartacoes, loteApartacoes, embarques, documentosEmbarque, animais, lotes, animalIdentificadores, movimentosAnimais, animalLotes, sessoesPesagem, auditoria, importacoes, appSettings, backupHistory` (`schema.js:12-29`). **15**, não 16 (ver DIVERGÊNCIA D1).
- Removidas: as 3 de sanidade (`REMOVED_STORES_V6`, `schema.js:40-44`).
- `upgrade` (`db.js:31-48`): em `pesagens`, apaga `sanidade_ids`/`sanidades` da linha e do `legacy_payload` (objeto ou string JSON; string inválida fica intacta). **Não houve backup pré-migração na v5→v6** (o coordenador só existe desde a v7): os dados das 3 stores de sanidade da v5 foram destruídos fisicamente.
- `v1.1.18` também é v6 (`git show v1.1.18:src/storage/indexedDb/schema.js` → `DB_VERSION = 6`).

### 3.4 v7 (1.2.0-rc1) — 23 stores

Removida: `lotes` (`REMOVED_STORES_V7`, `schema.js:84-86`). `upgrade` (`db.js:52-64`), idempotente e sem apagar dados:
- `sessoesPesagem`: `Aberta/Fechada/Cancelada → ABERTA/FECHADA/CANCELADA`; `local = null` se ausente.
- `loteApartacoes`: `situacao = fechado ? 'FECHADO' : 'ABERTO'` se ausente; `ativo = true` se ausente.
- `apartacoes`: `ativo = true` se ausente.

Diferenças de índice v6 → v7:

| Store | Mudança |
|---|---|
| `apartacoes` | + `ativo` |
| `loteApartacoes` | − `lote_id`; + `situacao`, `categoria_id` |
| `embarques` | + `parceiro_id` |
| `animais` | + `marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data` |
| `animalIdentificadores` | + `tipo`, `[marca_id+valor_normalizado]`, `faixa_id` |
| `sessoesPesagem` | + `[data+local]`, `operador_usuario_id` |
| `auditoria` | + `usuario_id` |
| `lotes` | removida |
| novas | `marcas, racas, categoriasAnimal, parceiros, propriedades, causasMorte, faixasIdentificadores, excecoesIdentificadores, usuarios` |

### 3.5 Tabela das 23 stores vigentes

Legenda: **PK** = chave primária; **Único** = índices `&`; **Limpar** = efeito de "Limpar dados operacionais"; **Reset** = efeito de "Reset completo"; **Isenta** = gravável sob bloqueio de migração pelo repositório genérico.

| # | Store | Índices (`schema.js`) | PK | Único | Classe | Limpar | Reset | Isenta | Repositório (`repositories/index.js`) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `pesagens` | `id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, created_at, updated_at, deleted_at` (`:53-54`) | `++localId` | — (`id` **não** é único) | operacional | apaga | apaga | não | `weighingRepository`/`weighing` (`:19,46`) |
| 2 | `apartacoes` | `id, nome, ativo, created_at, updated_at, deleted_at` (`:55`) | `++localId` | — | operacional | apaga | apaga | não | `apartacaoRepository` (`:20`) |
| 3 | `loteApartacoes` | `id, apartacao_id, situacao, categoria_id, created_at, updated_at, deleted_at` (`:56`) | `++localId` | — | operacional | apaga | apaga | não | `loteApartacaoRepository` (`:21`) |
| 4 | `embarques` | `id, data, status, parceiro_id, …` (`:57`) | `++localId` | — | operacional | apaga | apaga | não | `shipmentRepository` (`:22`) |
| 5 | `documentosEmbarque` | `id, embarque_id, tipo, …` (`:58`) | `++localId` | — | operacional | apaga | apaga | não | `shipmentDocumentRepository` (`:23`) |
| 6 | `animais` | `&id, empresa_id, identificacao_normalizada, situacao, marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data, …` (`:59-60`) | `++localId` | `id` | operacional (projeção) | apaga | apaga | não | `animalRepository` (`:24`) |
| 7 | `animalIdentificadores` | `&id, animal_id, tipo, [tipo+valor_normalizado], [marca_id+valor_normalizado], faixa_id, ativo, …` (`:61-62`) | `++localId` | `id` | operacional | apaga | apaga | não | `animalIdentifierRepository` (`:26`) |
| 8 | `movimentosAnimais` | `&id, animal_id, tipo, data_evento, lote_origem_id, lote_destino_id, …` (`:63`) | `++localId` | `id` | operacional | apaga | apaga | não | `animalMovementRepository` (`:27`) |
| 9 | `animalLotes` | `&id, animal_id, lote_id, inicio, fim, …` (`:64`) | `++localId` | `id` | operacional (projeção) | apaga | apaga | não | `animalLotRepository` (`:28`) |
| 10 | `sessoesPesagem` | `&id, data, [data+local], status, operador, operador_usuario_id, …` (`:65`) | `++localId` | `id` | operacional | apaga | apaga | não | `weighingSessionRepository` (`:29`) |
| 11 | `auditoria` | `&id, entidade, entidade_id, acao, usuario_id, created_at` (`:66`) | `++localId` | `id` | operacional (!) | **apaga** | apaga | **sim** | `auditRepository` (`:30`) |
| 12 | `importacoes` | `&id, &arquivo_hash, status, created_at, updated_at` (`:67`) | `++localId` | `id`, `arquivo_hash` | operacional | apaga | apaga | não | `importRepository` (`:31`) |
| 13 | `appSettings` | `key` (`:68`) | `key` (inline) | `key` | protegida | preserva | apaga | não (`writeAppSetting` bloqueia) | `read/writeAppSetting` (`:109-120`) |
| 14 | `backupHistory` | `++localId, id, tipo, created_at` (`:69`) | `++localId` | — | protegida | preserva | **preserva** | n/a (grava direto) | `recordBackupHistory` (`backupService.js:29-39`) |
| 15 | `marcas` | `&id, empresa_id, nome_normalizado, ativo, …` (`:71`) | `++localId` | `id` | mestre | preserva | apaga | não | `marcaRepository` (`:33`) |
| 16 | `racas` | idem (`:72`) | `++localId` | `id` | mestre | preserva | apaga | não | `racaRepository` (`:34`) |
| 17 | `categoriasAnimal` | idem (`:73`) | `++localId` | `id` | mestre | preserva | apaga | não | `categoriaAnimalRepository` (`:35`) |
| 18 | `parceiros` | `&id, empresa_id, nome_normalizado, documento, *papeis, ativo, …` (`:74`) | `++localId` | `id` | mestre | preserva | apaga | não | `parceiroRepository` (`:36`) |
| 19 | `propriedades` | `&id, empresa_id, nome_normalizado, tipo, parceiro_id, ativo, …` (`:75`) | `++localId` | `id` | mestre | preserva | apaga | não | `propriedadeRepository` (`:37`) |
| 20 | `causasMorte` | `&id, empresa_id, nome_normalizado, ativo, …` (`:76`) | `++localId` | `id` | mestre | preserva | apaga | não | `causaMorteRepository` (`:38`) |
| 21 | `faixasIdentificadores` | `&id, empresa_id, tipo, marca_id, situacao, ativo, …` (`:78`) | `++localId` | `id` | mestre | preserva | apaga | não | `faixaIdentificadorRepository` (`:39`) |
| 22 | `excecoesIdentificadores` | `&id, faixa_id, [faixa_id+numero], motivo, …` (`:79`) | `++localId` | `id` | mestre | preserva | apaga | não | `excecaoIdentificadorRepository` (`:40`) |
| 23 | `usuarios` | `&id, empresa_id, &login_normalizado, role, ativo, …` (`:81`) | `++localId` | `id`, `login_normalizado` | protegida | preserva | apaga | **sim** | `usuarioRepository` (`:41`) |

Observações estruturais importantes:
- `[marca_id+valor_normalizado]` **não é único** (`schema.js:62`): a unicidade VISUAL por marca é garantida só por lógica e pela verificação de integridade (`health.js:87-104`). DIVERGÊNCIA D3.
- `pesagens.id`, `apartacoes.id`, `loteApartacoes.id`, `embarques.id`, `documentosEmbarque.id`, `backupHistory.id` **não são únicos**: o mesmo id de domínio pode ter várias linhas; o repositório genérico escolhe a linha ativa mais recente (`genericRepository.js:40-51`).
- `sessoesPesagem` já tem campos de contexto de lançamento gravados como `null`: `marca_padrao_id`, `apartacao_padrao_id`, `tipo_manejo_padrao`, `snapshot`, `motivo_reabertura` (`weighingDataAdapter.js:104-108`; backfill `v7Backfill.js:624-628`) — sem índice. Relevante para "preservar o contexto do Lançamento".
- Campos de `categoriasAnimal` gravados pelo código: `sexo_aplicavel`, `peso_min_kg`, `peso_max_kg`, `era`, `ordem` (`v7Backfill.js:278-286`). DIVERGÊNCIA D2.

### 3.6 Comportamento real do Dexie 4.4.5 que afeta a v8

Lido em `node_modules/dexie/dist/dexie.js` (análise estática do código da biblioteca; nenhum cenário foi executado — confirmar com um gate antes de depender disso):
- **Versão nativa = `verno × 10`** (`dexie.js:4512`; `version()` arredonda para uma casa, `:6001`). v7 = versão IndexedDB 70.
- **Banco mais novo que o declarado abre mesmo assim.** Em `VersionError`, o Dexie repete `indexedDB.open(nome)` sem versão (`dexie.js:4599-4603`) e só recusa se o esquema declarado tiver stores/índices que **faltam** no instalado (`verifyInstalledSchema`, `dexie.js:4013-4018`). Consequência: **o app 1.2.0-rc1 (v7) abrirá sem erro um banco já migrado para v8 aditiva**, ignorando as stores novas: o backup dele omite essas stores (usa `STORE_NAMES` antigo), o restore/limpeza não as tocam e as pesagens editadas/canceladas ficam dessincronizadas das aplicações de sanidade. Não há bloqueio de downgrade no coordenador (`inspectDatabase` só compara `currentVersion < targetVersion`, `migrationCoordinator.js:49,59`).
- **Esquema estendido sem bump é "remendado" em silêncio.** Se o esquema declarado tiver algo a mais que o instalado na mesma versão, o Dexie avisa no console e sobe a versão nativa em +1 (ex.: 70 → 71), cria o que falta e pode criar a store `$meta` (`dexie.js:3768-3775,4566-4571`). Nenhum `upgrade()` roda e o coordenador não vê migração (o `verno` dinâmico vira 7.1, que não é `< 7`). Por isso **editar `STORES_V7` no lugar contorna o backup pré-migração (ADR-038)**.

---

## 4. Abertura, migração e bloqueio (estado atual)

### 4.1 Sequência de boot

`DbBootstrap` (`src/components/DbBootstrap.jsx:15`) → `bootstrapLocalDb` (`src/api/db.js:49-75`) → `storage.migration.openWithMigration({ files: window.pesagemApp.files, onProgress })` (`src/api/db.js:52`).

`openWithMigration` (`migrationCoordinator.js:181-227`):
1. `inspectDatabase()` (`:40-63`): `Dexie.exists`; abre dinâmico (`openDynamic`, `:33-37`) e lê `probe.verno` e as stores. Bloqueador único existente: `currentVersion < targetVersion` **e** store `lotes` com registros → `MIGRATION_BLOCKED_LOTES` (`:49-58`).
2. Bloqueador → `setWriteBlocked` e lança (`:183-187`); o banco não é tocado.
3. `needsMigration` → `prepareMigration` (`:70-83`) → `createPreMigrationBackup` sobre a instância dinâmica da versão de origem. Qualquer erro → `setWriteBlocked` + lança (`:190-197`).
4. `recordPendingMigrationBeforeOpen` (`:91-118`): grava **na versão antiga** `appSettings['migration:v<DB_VERSION>'] = PENDENTE` com a referência do backup (fecha a janela de crash entre backup e abertura). Se já existir estado não concluído, só completa `backup`.
5. `hooks.beforeOpen` (gates) (`:200`).
6. `ensureStorageReady()` → o Dexie executa os `upgrade()` declarados (`:202`).
7. Reconciliação pós-abertura (`:203-213`) + `backupHistory('pre-migration', backup)`.
8. Estado `FALHOU` → abre somente leitura (`setWriteBlocked`), **retomada manual** (`:214-219`).
9. `runPendingBackfills({ origem: exists ? 'upgrade-vN' : 'fresh' })` (`:221`). Falha no backfill **não lança**: devolve `blocked: true` (`:223-226`).

`bootstrapLocalDb` só relança `MIGRATION_BLOCKED_LOTES` e `MIGRATION_BACKUP_FAILED` como `MIGRATION_BLOCKED` (`src/api/db.js:12,66-70`); outros erros viram `STORAGE_UNAVAILABLE` com `ready: false` **sem lançar** (`:71-73`), e `DbBootstrap` renderiza o app mesmo assim (`DbBootstrap.jsx:16-19` não olha `result.ready`).

### 4.2 Backup pré-migração (`preMigrationBackup.js`)

- Disparo: automático em `openWithMigration` quando `needsMigration` (§4.1 passo 3). Não há backup em banco novo (`verify-v7-migration.mjs:467`).
- Porta de arquivos obrigatória (`window.pesagemApp.files.writeUserFile`). Sem porta: `MIGRATION_BACKUP_FAILED` com `reason: 'NO_FILES_PORT'` (`:43-51`), exceto `localStorage['pesagens.dev.allowUnsafeMigration'] === '1'` (só navegador de desenvolvimento), que devolve `{ skipped: true }` (`:9,25-31,44-46`).
- Conteúdo: `createFullBackupFromDb(sourceDb, { reason: 'pre-migration', automatic: true, dbVersion: sourceVersion })` (`:55-59`) — **todas as stores instaladas** (`db.tables`), no formato da versão de origem.
- Arquivo: `backups/pre-migration-v<alvo>-AAAAMMDD-HHmmss.json` (`:13-16`), JSON indentado.
- Gravação física (`electron/main.cjs:123-144`): arquivo temporário → `fsync` → `rename` atômico → releitura e SHA-256 do disco.
- Validação: `path` presente, `size` igual ao gerado e SHA-256 relido igual (`:78-84`); senão `VALIDATION_MISMATCH`.
- Retorno guardado no estado técnico: `{ path, sha256, size, filename, backupId, sourceVersion, targetVersion, counts, createdAt }` (`:86-96`).

### 4.3 Estado técnico (`migrationState.js`)

- Chave `appSettings['migration:v<N>']` (`:10`). Status `PENDENTE | EM_ANDAMENTO | CONCLUIDA | FALHOU` (`:3-8`).
- Forma (`emptyMigrationState`, `:43-61`): `versao, status, origem, started_at, last_checkpoint, passo, cursor, passos_concluidos[], processed, total, finished_at, error, backup, relatorio`.
- `relatorio` padrão é **específico da v7** (`emptyMigrationReport`, `:21-41`) e é usado para qualquer versão; `writeMigrationState` faz merge raso (`:70-75`).
- `readMigrationState` devolve `null` quando nunca registrado (`:64-67`).

### 4.4 Backfill v7 (resumível)

- Passos `B1..B12` (`v7Backfill.js:25`), executores `STEP_RUNNERS` (`:720-733`):
  B1 marcas (colisões ADR-021) · B2 raças · B3 categorias (seed) · B4 causas de morte (ids preservados) · B5 parceiros · B6 propriedades · B7 animais (cursor) · B8 identificadores (cursor) · B9 enums de sessões/lotes/apartações (uma transação, `:612`) · B10 limpeza de `legacy_payload` (cursor) · B11 remoção das chaves legadas de `appSettings` após validação e exportação da sanidade (`:695-707`) · B12 contagens + `logicalIntegrity({ enforceV7: true })` (`:712-718`).
- **Reentrância:** `runV7Backfill` (`:745-807`) lê o estado; se `CONCLUIDA` devolve `alreadyDone` (`:747`). Passos concluídos ficam em `passos_concluidos` (`:779-786`). Passos por cursor usam `localId` em lotes de `BATCH_SIZE = 500` (`:24`) e gravam o checkpoint **na mesma transação** do lote (`:480-497`). Passos sem cursor são idempotentes por construção (ex.: `planMarcas` casa por texto/normalizado, B3 considera inclusive excluídas, `:272`).
- `maxBatches` limita trabalho por chamada (gates); `hooks.beforeStep` injeta falhas (`:772-775`).
- Falha: grava `FALHOU` com `{ code, message, passo, at }` e lança `MIGRATION_FAILED` (`:800-806`).
- Sanidade legada (ADR-022): B11 exporta `cadastros-auxiliares:sanidade:*` para `exports/sanidade-export-<stamp>.json` (`:667-682`) e só então apaga as chaves; sem porta de arquivos a chave de sanidade é **preservada** (`:700-704`; `verify-v7-migration.mjs:428-431`).
- `dryRunV7` relata sem gravar (`:814-866`).

### 4.5 Bloqueio de escrita

- Flag de processo em memória `writeBlock` (`migrationState.js:88`), ligada por `setWriteBlocked` (`:98-101`), desligada por `clearWriteBlock` (`:103-105`) — só `runPendingBackfills` em sucesso (`migrationCoordinator.js:130-131`) e `applyRestore` sem conversão (`backupService.js:245-248`) a desligam.
- `assertWritable(operation, { store })` lança `MIGRATION_BLOCKED` (`:117-126`), exceto para `WRITE_BLOCK_EXEMPT_STORES = ['usuarios', 'auditoria']` (`:86`) **quando a store é informada**.
- Quem respeita: todos os verbos de escrita do repositório genérico (passam `store`, `genericRepository.js:38`), inclusive os do `masterRegistryService`, que grava por `repo.create/update/remove` (`masterRegistryService.js:278,309,326,342,363,382`) dentro de `withTransaction` (a gravação da auditoria dele é direta, `:210`, mas a store é isenta); `writeAppSetting` (sem store → sempre bloqueia, `repositories/index.js:116`), o que também barra `updateAppConfig` antes da sua auditoria (`appConfigService.js:282,288`); os verbos do `weighingDataAdapter` (`:298,394,446,670,754`, sem store); `recordAccessEvent`, que chama sem store e por isso **é bloqueado** (evento descartado por `tryRecordAccessEvent`, `authAudit.js:53,63-70`).
- Quem **não** respeita: `recordBackupHistory` (`backupService.js:29-39`), `applyRestore`, `clearOperationalData` e `resetAllData` (nenhum chama `assertWritable`), e as gravações diretas `db.table(...)` do próprio backfill.

### 4.6 Retomada

Manutenção › "Continuar migração": `maintenanceService.resumeMigration` exige `maintenance.migrate` (`maintenanceService.js:119-122`) → `storage.migration.runPendingBackfills({ files })` (`maintenanceDataAdapter.js:147-149`). `getMigrationStatus`/`dryRunMigration` consultam **só `DB_VERSION`** (`migrationCoordinator.js:157-169`; `maintenanceDataAdapter.js:139-145`); o resumo do diagnóstico lê campos do relatório v7 (`maintenanceDataAdapter.js:177-184`).

---

## 5. Como declarar a v8 no padrão do repositório (derivado do código)

> Esta seção descreve **onde** e **o que** muda. Os trechos são contratos de desenho, não código implementado.

### 5.1 `schema.js`

- Manter `STORES_V5`, `STORES_V6`, `REMOVED_STORES_V6`, `STORES_V7`, `REMOVED_STORES_V7` **intactos** (bancos v5/v6/v7 dependem deles).
- Acrescentar `STORES_V8 = { ...STORES_V7, <novas stores> }` e, se houver, índices novos em stores existentes (índices só acrescentados são seguros; trocar PK ou tipo de índice força recriação da store — `dexie.js:3928-3934`).
- `DB_VERSION = 8`; `STORES = STORES_V8`. `STORE_NAMES`/`DOMAIN_STORES` se atualizam sozinhos.
- Decidir a classificação de cada store nova: catálogo de sanidade (programas/procedimentos, produtos/medicamentos) **precisa ser incluído em `MASTER_REGISTRY_STORES`** para sobreviver a "Limpar dados operacionais"; aplicações por animal ficam operacionais (apagadas) por omissão (§8).
- Convenções que as stores novas devem seguir (docs 12 §1 e código): `++localId`, `&id`, `empresa_id`, `created_at`, `updated_at`, `deleted_at`; cadastros com `nome`, `nome_normalizado`, `ativo` (reuso de `createMasterRegistryService`, `masterRegistryService.js:136`, que exige índices `nome_normalizado` e `empresa_id`, `:179,194-197`).
- Restrições de nome impostas por gates: nenhuma store com `template` ou `report` no nome (`scripts/verify-reports-templates.mjs:15`).
- **Não reutilizar** os nomes da v5 (`configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal`): `readBackup` só ignora stores ausentes de `STORE_NAMES` (`backupService.js:167`), então um backup antigo que ainda contenha essas stores (formato v5) seria restaurado **para dentro** das stores novas com a forma legada.

### 5.2 `db.js`

Padrão a seguir (idêntico ao da v7):

```js
db.version(8)
  .stores({ ...STORES_V8 })          // sem REMOVED_* se nada for removido
  .upgrade(async (tx) => { /* opcional: só transformações leves e idempotentes */ });
```

Manter `version(5)`, `version(6)` e `version(7)` com seus `upgrade()` (bancos v5/v6 ainda chegam por essa cadeia). O comentário do cabeçalho (`db.js:5-9`) passa a citar a v8.

### 5.3 Coordenador — mudanças obrigatórias (bloqueadoras)

Hoje tudo é "versão única":

| Ponto | Código atual | Efeito com `DB_VERSION = 8` sem mudança |
|---|---|---|
| Registro de backfills | `BACKFILLS = { [7]: … }` (`migrationCoordinator.js:31`) | — |
| Execução | `BACKFILLS[DB_VERSION]` apenas (`:126`); ausência → `{ completed: true, alreadyDone: true }` sem rodar nada (`:127`) | banco novo sem seeds (quebra `verify-v7-migration.mjs:458-474` e `verify-dexie-backup.mjs:158`); banco v6 → v8 sem B1..B12; restore de backup v6 sem conversão |
| Estado PENDENTE antes de abrir | só `migration:v<DB_VERSION>` (`:95-113,143-154`) | v6 → v8 não marca v7 como pendente |
| Estado FALHOU no boot | só `DB_VERSION` (`:214-219`) | falha da v7 numa cadeia não seria detectada |
| Restore de esquema anterior | grava PENDENTE só para `getDbVersion()` (`backupService.js:231-237`) e checa só esse estado (`:241-244`) | idem |
| Reset | `runPendingBackfills({ origem: 'reset' })` (`backupService.js:303-304`) | sem seeds v7 |
| Manutenção/diagnóstico | `getMigrationState(DB_VERSION)`, `dryRunBackfill(DB_VERSION)` (`:157-169`) | `dryRunMigration` lança `MIGRATION_UNKNOWN_VERSION` se a v8 não tiver backfill; v7 some da tela |
| Integridade | `readMigrationState(db, 7)` fixo (`health.js:24`) | continua correto para o contrato v7; não existe gate de contrato v8 |
| `backupHistory` | `migration-v${DB_VERSION}` (`:132`), `backfill-v${getDbVersion()}` (`backupService.js:261`) | rótulos só da última versão |

Contrato proposto: `BACKFILLS` ordenado por versão; `runPendingBackfills` percorre as versões `≤ DB_VERSION` em ordem crescente, pula as `CONCLUIDA` e para na primeira falha, bloqueando a escrita; `recordPendingMigrationBeforeOpen`/`applyRestore` marcam como PENDENTE toda versão `> origem` que tenha backfill; `openWithMigration` verifica `FALHOU` em qualquer versão da cadeia; `getMigrationState`/`dryRunBackfill` aceitam versão e a Manutenção lista a cadeia. O backfill v8 segue o molde de `runV7Backfill` (estado próprio `migration:v8`, passos nomeados, cursor + checkpoint na mesma transação, relatório próprio — não reutilizar `emptyMigrationReport` da v7).

### 5.4 Backup pré-migração da v7 para a v8

Nada a acrescentar para disparar (é automático). Dois ajustes de consistência:
- `formatVersion = dbVersion <= 6 ? 2 : BACKUP_FORMAT_VERSION` (`backupService.js:54`): se `BACKUP_FORMAT_VERSION` subir para 4, o backup pré-migração de um banco v7 sairia rotulado 4. Trocar por mapa versão → formato.
- O manifesto sempre grava `schemaVersion: DB_SCHEMA_VERSION`, `dataContractVersion`, `uiBuildId`, `appVersion` do **app novo** (`backupService.js:59,67-69`) mesmo quando `dbVersion` é da origem: no pré-migração v7→v8 sairia `dbVersion: 7` com `schemaVersion: 8`. As decisões de restore usam `manifest.dbVersion` (`:149,170`), então é só inconsistência de metadado, mas confunde diagnóstico.
- O formato JSON não muda ao acrescentar stores: leitores tratam stores ausentes como `newStores` (`backupService.js:143-171`) e o app v7 recusa backup de banco mais novo (`DEXIE_BACKUP_005`, `:149-153`). Subir `BACKUP_FORMAT_VERSION` não é exigido pelo leitor; subir `DATA_CONTRACT_VERSION` é decisão de contrato.

### 5.5 `versionInfo.js`

`DATA_BUILD_ID` é **literal** e precisa virar `'schema-v8'` (`versionInfo.js:24-27`; gate `verify-version-contract.mjs:170-171`; marcador procurado no bundle por `verify-packaged-build.mjs:46`).

### 5.6 Transações do Lançamento/Importação

O Dexie recusa acesso a tabela fora do escopo da transação. Integrar aplicações de sanidade ao salvamento exige acrescentar as stores novas às listas de escopo: `createEntry` (`weighingDataAdapter.js:311-315`), `updateEntry` (`:403`), `bulkCreateEntries` (`:450`), `bulkUpdateEntries` (`:713`), `bulkDeleteEntries` (`:759`). Ver §12.

### 5.7 Integridade

`logicalIntegrity` já checa id nulo/duplicado de toda store de `DOMAIN_STORES` (`health.js:27-35`), portanto cobre stores novas automaticamente. Referências (aplicação → animal/pesagem/produto/programa) precisam de blocos novos no mesmo estilo de `health.js:106-117`, com um gate de contrato v8 análogo a `v7Contract` (`health.js:24-25`).

### 5.8 Gates que precisam ser atualizados

| Gate | Ponto fixo em v7 |
|---|---|
| `scripts/verify-dexie-storage.mjs:59` | `DB_VERSION === 7` |
| `scripts/verify-dexie-backup.mjs:115,145,157` | `readMigrationState(db, 7)`; `:158` espera 7 categorias após reset (continua válido se a cadeia rodar v7) |
| `scripts/verify-dexie-import-restore.mjs:101,122` | `readMigrationState(db, 7)`; `:122` espera estado `null` após restore da própria versão |
| `scripts/verify-v7-migration.mjs:169,266,295,345,458-474` | `db.verno === DB_VERSION` após migrar v6 (continua, mas o nome do arquivo pré-migração passa a `pre-migration-v8-…`, `:158`); caso F (banco novo) exige seeds |
| `scripts/verify-version-contract.mjs:170` | `DATA_BUILD_ID` |
| `scripts/verify-packaged-build.mjs:46` | marcador `schema-v<N>` |
| `scripts/verify-dexie-first-run.mjs:22` | `db.tables.length === STORE_NAMES.length` (automático) |
| `scripts/verify-no-legacy-storage.mjs:50-54` | todo `*DataAdapter.js` em `src/modules` deve importar `storageAdapter` (vale para um adapter de sanidade) |
| `scripts/verify-perf-baseline-contract.mjs:120` | massa de teste só com stores existentes (automático) |
| `docs/release/1.3.0/RELEASE-CHECKLIST.md:3,12` | declara "esquema Dexie 7" / `dbSchemaVersion 7` para 1.3.0 |

Observação de cobertura: `storage:backup:verify` e `storage:import-restore:verify` **não estão em `test:quick`**, só em `storage:all:verify`/`test:full` (`package.json:31,67,68`).

### 5.9 Conflito com o plano v8 já reservado

`docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md:89-100,133` reserva a v8 (marco 1.5.0) para `operacoesComerciais` e colunas promovidas em `pesagens`/`embarques`; o código já antecipa isso (`masterRegistryService.js:105` conta `operacoesComerciais`; `:119` cita `causa_morte_id` "coluna promovida na v8"). Também `ADR-019` diz que "estoque" é só identificadores, "nada de medicamentos" (`08-DECISOES-ARQUITETURAIS.md:128`) e `ADR-022` retirou a sanidade. **Usar a v8 para Sanidade/Importação exige decisão explícita** de renumerar o plano comercial (ex.: v9) e revisar ADR-019/ADR-022.

---

## 6. Backup completo

### 6.1 Estrutura (`createFullBackupFromDb`, `backupService.js:47-82`)

```text
{
  format: BACKUP_FORMAT, formatVersion, version: APP_VERSION, dbVersion, createdAt,
  manifest: { format, formatVersion, backupId (UUID), appVersion, dbVersion, createdAt, reason, automatic,
              counts{store:n}, stores[nomes],
              (formatVersion >= 3) schemaVersion, dataContractVersion, uiBuildId },
  stores: { <store>: [linhas cruas, inclusive localId] },
  integrity: { algorithm: 'SHA-256', sha256: sha256(JSON.stringify(<tudo menos integrity>)) }
}
```

- Stores: `storeNames || db.tables` (`:48`). Backup manual/segurança passa `STORE_NAMES` (`:85-88`) → **automático**. Pré-migração usa as tabelas instaladas (`preMigrationBackup.js:55-59`).
- Inclui `usuarios` com `password_hash`/`password_salt` (nunca senha) (`verify-dexie-backup.mjs:54-55`), `appSettings` (estado técnico, configurações, modelos de relatório), `backupHistory`, `auditoria`, `importacoes`.
- Formatos: 1 = legado sem `formatVersion` (`dryRunRestore`, `:190`); 2 = bancos ≤ v6; 3 = v7 (`:54`).
- Leitura **sem transação única**: cada `toArray()` é uma leitura separada (`:50-52`), então o snapshot não é garantidamente consistente entre stores se houver gravação concorrente.
- Tudo é montado em memória e serializado com `JSON.stringify(backup, null, 2)` (`maintenanceDataAdapter.js:42`; `preMigrationBackup.js:64`).

### 6.2 Backup físico de segurança (Manutenção)

`persistFullBackup` (`maintenanceDataAdapter.js:40-54`): `createFullBackup` → `backups/backup-completo-<stamp>.json` → `backupHistory('full-durable', { backupId, reason, path, size, fileSha256, payloadSha256, counts })`. Usado antes de importação JSON (`:112-116`), restore (`:128-131`), limpeza (`:151-155`) e reset (`:157-161`). A camada de storage exige a evidência `{ path, size > 0, sha256 hex64 }` (`backupService.js:174-180`). **A importação CSV da Relação não cria backup físico prévio** (`src/pages/PesagensIndividuais.jsx:562-564` chama `weighingService.bulkCreateEntries` direto).

### 6.3 Exportações atuais

- `exportPesagensCsv` (`backupService.js:97-104`): colunas `id, data_pesagem, peso_kg, animal_id, lote_id, tipo_pesagem, operador, origem, observacao, created_at, updated_at` lidas do **topo** da linha; `operador` e `origem` vivem em `legacy_payload`, então saem sempre vazias. Não exporta número do animal, marca, sexo, GMD etc. Não é reimportável pela importação CSV da Relação, que procura cabeçalhos `data`, `numero animal/animal`, `peso` (`PesagensIndividuais.jsx:369-387`).
- `exportPesagensJson` (`:107-121`): linhas cruas (`type: 'weighing-entries-export'`). Reimportado no mesmo banco, tudo é duplicado por `id`.

---

## 7. Restore entre versões

### 7.1 Validações (`readBackup`, `backupService.js:123-172`)

| Código | Condição | Efetivo? |
|---|---|---|
| `DEXIE_BACKUP_001` | `format` diferente ou sem `stores` (`:125-129`) | sim |
| `DEXIE_BACKUP_003` | SHA-256 recalculado diverge (`:130-137`) | sim |
| `DEXIE_BACKUP_004` | sem `integrity` e `allowLegacy = false` (`:138-142`) | **nunca** (ninguém passa `allowLegacy: false`) |
| `DEXIE_BACKUP_002` | stores vigentes ausentes e `allowLegacy = false` (`:143-148`) | **nunca** |
| `DEXIE_BACKUP_005` | `manifest.dbVersion > getDbVersion()` (`:149-153`) | sim (só olha `manifest`, não o `dbVersion` do topo) |
| `DEXIE_BACKUP_006` | `manifest.counts[store] ≠ stores[store].length` (`:154-160`) | sim |

Stores ausentes → `newStores` (nascem vazias); stores desconhecidas → `ignoredStores`; o payload do chamador não é mutado (`:161-171`).

### 7.2 `dryRunRestore` (`:183-203`)

Devolve `format, formatVersion, version, manifest, integrity ('SHA-256 válido' | 'backup legado sem SHA-256'), counts, sourceDbVersion, targetDbVersion, schemaUpgradeRequired, ignoredStores, newStores, usuarios`.

### 7.3 `applyRestore` (`:213-263`)

1. `readBackup` + evidência física obrigatória (`:214-216`).
2. **Uma transação `rw` sobre todas as `STORE_NAMES`**: `clear()` + `bulkAdd` sem `localId` (os `localId` são **regenerados**) + verificação de contagem (`:217-227`). Índices únicos (`&id`, `&arquivo_hash`, `&login_normalizado`) abortam tudo se o backup tiver duplicatas.
3. Substitui também `appSettings` (estado técnico, configurações) e **`backupHistory`** (o histórico anterior se perde; só o registro `restore` novo é acrescentado, `verify-dexie-import-restore.mjs:116-121`).
4. `schemaUpgradeRequired` → estado `migration:v<DB_VERSION>` PENDENTE com `origem: 'restore-v<origem>'` (`:231-237`).
5. Backfill se houve conversão ou se o estado restaurado não está `CONCLUIDA` (`:241-244`); senão `clearWriteBlock()` (`:245-248`).
6. `backupHistory('restore', …)` e `backfill-v<N>` (`:250-261`).

Falha do backfill depois do passo 2: os dados já foram substituídos (transação comitada), `runPendingBackfills` bloqueia a escrita e lança; o registro `restore` **não** é gravado. Nenhum `assertWritable` protege o restore.

### 7.4 Matriz de compatibilidade

| Origem | App v7 (atual) | App v8 (projetado, com cadeia) |
|---|---|---|
| Backup formato 1/2 de banco v6 (`lotes` presente) | restaurável; `lotes` ignorada; 9 stores novas vazias; backfill v7 roda (`verify-dexie-backup.mjs:87-132`) | restaurável; exige v7 **e** v8 na cadeia |
| Backup formato 3 de banco v7 | restore direto, sem backfill se `migration:v7` restaurado estiver `CONCLUIDA` ou ausente | `schemaUpgradeRequired`; stores v8 vazias; backfill v8 |
| Backup de banco v8 | **recusado** (`DEXIE_BACKUP_005`) | restore direto |
| Banco IndexedDB v8 aberto pelo app v7 | **abre sem erro** (Dexie 4, §3.6); stores v8 ignoradas por backup/restore/limpeza | n/a |
| Backup com stores de nomes da v5 (`configuracoesSanidade` …) | ignoradas | se os nomes forem reutilizados, **seriam restauradas** nas stores novas |
| Restore do backup pré-migração como "rollback" | — | reescreve os dados da v7 **dentro do esquema v8** e reexecuta o backfill v8; não volta o banco para v7 |

---

## 8. "Limpar dados operacionais" × "Reset completo"

| Aspecto | Limpar dados operacionais | Reset completo |
|---|---|---|
| Serviço | `maintenanceService.clearOperationalData` (`maintenanceService.js:125-129`) | `maintenanceService.resetAllData` (`:132-136`) |
| Permissão | `maintenance.clear` (ADMIN) via `can(role, action)` (`:16-26`) | `maintenance.reset` (ADMIN) |
| Confirmação | texto `LIMPAR` (`:10,28-34`) | texto `RESET` (`:11`) + `confirmedByAdmin: true` fixo (`:135`) |
| Senha reverificada | não | **não** (DIVERGÊNCIA D6) |
| Backup físico antes | `persistFullBackup('pre-clear-operational')` (`maintenanceDataAdapter.js:152`) | `persistFullBackup('pre-reset-all')` (`:158`) |
| Storage | `backupService.js:269-279` | `backupService.js:291-307` |
| Regra | apaga `STORE_NAMES − (MASTER_REGISTRY_STORES ∪ PROTECTED_STORES)` numa transação | apaga `STORE_NAMES − ['backupHistory']` numa transação, depois `runPendingBackfills({ origem: 'reset' })` |
| Apaga (v7) | `pesagens, apartacoes, loteApartacoes, embarques, documentosEmbarque, animais, animalIdentificadores, movimentosAnimais, animalLotes, sessoesPesagem, auditoria, importacoes` | as 22 stores acima + `marcas … usuarios, appSettings` |
| Preserva (v7) | `marcas, racas, categoriasAnimal, parceiros, propriedades, causasMorte, faixasIdentificadores, excecoesIdentificadores, usuarios, appSettings, backupHistory` | `backupHistory` |
| Recria | nada (estado técnico e configurações ficam) | estado `migration:v7` CONCLUIDA e seeds (7 categorias, propriedade padrão, raça Nelore) (`verify-dexie-backup.mjs:157-158`); sem usuários → Configuração Inicial |
| Registro | `backupHistory('clear-operational', { cleared })` | `backupHistory('reset-all', { cleared })` |
| Auditoria | nenhuma linha em `auditoria` (e a própria `auditoria` é apagada) | idem |
| Bloqueio de migração | não verificado | não verificado |

Consequências diretas:
- Store nova **não classificada** é apagada por "Limpar" e por "Reset" — classificar catálogos de sanidade em `MASTER_REGISTRY_STORES`.
- "Limpar" apaga `importacoes`: depois dela o mesmo arquivo pode ser importado de novo.
- "Limpar" preserva `faixasIdentificadores/excecoesIdentificadores`, cujos `animal_id`/`proximo` passam a apontar para animais apagados (sem checagem de integridade).
- Texto da tela (`src/pages/ManutencaoSistema.jsx:639`) diz "Apaga pesagens, animais, sessões, lotes e embarques" e omite `apartacoes`, `documentosEmbarque`, `identificadores`, `movimentos`, `auditoria`, `importacoes` (DIVERGÊNCIA D7).

---

## 9. Saúde / integridade

### 9.1 `logicalIntegrity({ enforceV7 })` (`health.js:21-141`)

Contrato v7 ativo quando `appSettings['migration:v7'].status === 'CONCLUIDA'` ou forçado (`:24-25`). Verificações:

| # | Verificação | Linhas |
|---|---|---|
| 1 | Toda store de `DOMAIN_STORES`: linha sem `id`; `id` duplicado (conta linhas soft-deletadas também) | `:27-35` |
| 2 | `loteApartacoes.apartacao_id` órfão (ativos) | `:38-43` |
| 3 | `pesagens` ativas: `data_pesagem` civil válida; peso > 0 salvo Saída por Morte/Doação/Transferência; `animal_id`, `lote_id`, `embarque_id`, `documento_embarque_id`, `sessao_id` órfãos (lê payload mesclado) | `:56-67` |
| 4 | `documentosEmbarque.embarque_id` órfão | `:69-71` |
| 5 | (v7) `animais.marca_id` obrigatório e `situacao` no enum | `:74-79` |
| 6 | `animalIdentificadores.animal_id` órfão; (v7) `tipo` no enum | `:81-85` |
| 7 | Unicidade de identificador ativo: VISUAL por `(marca_id, valor)`; demais por `(tipo, valor)` | `:87-104` |
| 8 | `movimentosAnimais`: `animal_id` e `pesagem_id` órfãos (contra pesagens **ativas**); `data_evento` válida | `:106-110` |
| 9 | `animalLotes`: `animal_id`, `lote_id` órfãos; `inicio` válido; `fim ≥ inicio` | `:112-117` |
| 10 | `usuarios` ativos com `password_hash` e `password_salt` (cita só id/login) | `:123-128` |
| 11 | `sessoesPesagem`: `data` válida; (v7) `status` no enum e `operador_usuario_id` existente | `:130-138` |

Retorno: `{ ok, result: 'ok' | 'issues', issues[], v7Contract }` (`:140`). Consumidores: Manutenção (`maintenanceDataAdapter.js:86-93`), diagnóstico (`:195-210`, até 50 problemas), passo B12 (`v7Backfill.js:715`).

Não verifica: `auditoria`, `importacoes`, `embarques.parceiro_id`, `marcas/propriedades` referências, `faixas/exceções`, coerência das projeções de `animais` (`ultimo_peso_kg`, `situacao`, `lote_atual_id`) com as pesagens, coerência dos derivados de GMD com `recalculateWeightSeries`. Lê stores inteiras com `toArray()` várias vezes (ex.: `pesagens` em `:52` e `:56`).

### 9.2 `databaseStats` (`health.js:143-160`)

Contagem por store (ativos, exceto `appSettings`/`backupHistory` que contam tudo) + `dbVersion` = constante.

### 9.3 Como estender

Acrescentar blocos no mesmo arquivo seguindo o padrão `active(name)` + `Set` de ids + `issues.push('<store> <id>: <motivo>')`; gate de contrato por `readMigrationState(db, 8)`; para série/GMD, recalcular com `recalculateWeightSeries` (sem gravar) e comparar os cinco campos derivados.

---

## 10. Auditoria

### 10.1 Store

`auditoria: '++localId, &id, entidade, entidade_id, acao, usuario_id, created_at'` (`schema.js:66`). Leitura para relatório por intervalo de `created_at` (`src/modules/reporting/infrastructure/reportSources/controlSources.js:179`).

### 10.2 Ator

- Storage: `setActorProvider(fn)` (`auditActor.js:12-14`) registrado pelo auth (`src/modules/auth/application/authSession.js:54`). `getActor()` → `{ usuario_id, usuario_nome_snapshot }` ou nulos (`auditActor.js:33-40`). `hasActorProvider()` diferencia app × gate (`:53-55`).
- Auth tem uma segunda implementação: `auditContext.getActor()` (sessão) e `actorFields(actor)` (ator explícito → sessão) (`auditContext.js:9-26`).
- `masterRegistryService` usa uma terceira ordem: sessão → ator explícito → nulo (`masterRegistryService.js:202-207`).

### 10.3 Gravadores (não há função canônica única)

| Gravador | Entidade / ações | Campos | Transação |
|---|---|---|---|
| `auditRow` em `weighingDataAdapter.js:73-75` | `pesagens` / `CRIAR` (com `depois` completo, `:379-387`, `:637`), `ATUALIZAR` individual (com `antes` e `depois` completos, `:432`), `ATUALIZAR` em massa (`resumo`, `campos_alterados`, `:737-743`), `CANCELAR` (`antes` completo, `motivo`, `:766`) | `id, entidade, entidade_id, acao, antes?, depois?, resumo?, campos_alterados?, origem ('manual'|'importacao'|'edicao-coletiva'), operador, motivo?, created_at, usuario_id, usuario_nome_snapshot` | mesma transação da gravação da pesagem |
| `audit()` em `masterRegistryService.js:209-222` | nome da store do cadastro / ações do serviço | `id, entidade, entidade_id, acao, resumo, campos_alterados[], antes?, depois?, usuario_id, usuario_nome_snapshot, created_at` | `withTransaction`: store + `auditoria` (`:232-234`) |
| `recordAccessEvent` em `authAudit.js:39-57` | `usuarios` / `LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA, ALTERACAO_USUARIO` (`:13-19`) | `id, entidade, entidade_id, acao, resumo (≤200), campos_alterados (sanitizados), detalhes?, usuario_id, usuario_nome_snapshot, created_at`; recusa chaves sigilosas (`:21-33`) | isolada; bloqueada sob migração e descartada (`:53,63-70`) |
| `updateAppConfig` em `src/modules/settings/application/appConfigService.js:288-297` | `appSettings` / `ATUALIZAR` | `id, entidade, entidade_id (chave), acao, resumo, campos_alterados, usuario_id, usuario_nome_snapshot, created_at` | fora de transação com o `settings.set` (`:282`) |

Não auditados em `auditoria`: backup, restore, limpeza, reset, migração, importação como operação (só as pesagens criadas), criação de sessão, projeções de animal, `recalculo-automatico` (`bulkUpdateEntries` com `audit: false`, `weighingService.js:181-185`). Esses eventos só vão para `backupHistory`, sem ator (`backupService.js:29-39`). DIVERGÊNCIA D5.

---

## 11. `importacoes`

### 11.1 Esquema e campos gravados

Índices `++localId, &id, &arquivo_hash, status, created_at, updated_at` (`schema.js:67`). Campos gravados por `bulkCreateEntries` (`weighingDataAdapter.js:465-471,653-659`): `id, arquivo_hash, arquivo_nome, arquivo_tamanho, origem ('csv' | 'json'), status: 'CONCLUIDA', linhas_total, registros_criados, animais_criados, movimentos_criados, created_at, updated_at, deleted_at`. Nenhum outro status é gravado; não há `usuario_id`, mapeamento de colunas, relatório de erros por linha nem vínculo com as pesagens.

### 11.2 Uso atual

| Caminho | Hash | Backup físico prévio | Onde |
|---|---|---|---|
| Relação › Importar CSV | SHA-256 do **texto do arquivo** | não | `PesagensIndividuais.jsx:355-356,562-564` |
| Manutenção › Importar JSON | SHA-256 do **payload serializado** | sim | `backupService.js:344-352`; `maintenanceDataAdapter.js:112-116` |

Fluxo da Relação (fatos): um único `tipo_manejo` para o arquivo inteiro (`PesagensIndividuais.jsx:553-560`); derivados do arquivo (`data_anterior … gmd`) são descartados (`:408-414`); marcas/raças desconhecidas podem ser criadas **antes** e **fora** da transação da importação (`:520-532`); `id_externo` vai para o `legacy_payload` (permitido, `weighingMapper.js:9`).

### 11.3 Idempotência e armadilhas

- Checagem: `where('arquivo_hash').equals(hash).first()` e erro só se ativo e `CONCLUIDA` (`weighingDataAdapter.js:457-462`). Como o índice é **único**, qualquer registro anterior com o mesmo hash (soft-deletado ou de outro status) faz o `add` final lançar `ConstraintError` e abortar a transação inteira.
- Idempotência é **por arquivo inteiro**: o mesmo conteúdo com um byte diferente (outro hash) ou reimportado após "Limpar dados operacionais" duplica pesagens de Manejo (a validação cronológica só barra Cadastro repetido e eventos após Saída, `:580-591`).
- Chave de identidade da importação: texto `NÚMERO::MARCA` (`:453,512-523`), não `marca_id`.
- Rastro por linha: só `legacy_payload.origem = 'importacao'` (`:607`), `animais.origem`, `movimentosAnimais.origem`, `animalLotes.origem` (`:568,635,627`). Nenhum `importacao_id`.

---

## 12. Transações Dexie de gravação

### 12.1 Pesagens (`weighingDataAdapter.js`)

| Função | Stores no escopo `rw` | Grava dentro | Fora da transação |
|---|---|---|---|
| `createEntry` (`:297-391`) | sempre `pesagens, auditoria, sessoesPesagem, animalLotes, categoriasAnimal`; + `animais, movimentosAnimais` se há `animal_id`; + `animalIdentificadores, marcas, racas, propriedades` se Cadastro (`:311-315`) | sessão aberta do dia (cria se não houver), pesagem, animal + identificador VISUAL (Cadastro), fecha/abre `animalLotes`, movimento (Entrada/Saída/Mudança de lote), reconstrução de `animalLotes` se retroativo, auditoria `CRIAR`, projeção do animal (`:317-389`) | `validateAnimalChronology` roda **antes** (`:309`); no serviço, leitura da série e `calculateWeightGain` antes (`weighingService.js:60-77`) e recálculo dos posteriores **depois**, em outra transação (`:86-88`) |
| `updateEntry` (`:393-436`) | `pesagens, animais, animalLotes, auditoria, marcas, racas, categoriasAnimal` (`:403`) | pesagem, perfil do animal (Cadastro), `animalLotes` reconstruído, auditoria `ATUALIZAR`, projeção | cronologia antes (`:402`); recálculo da série depois (`weighingService.js:208-210`); **`movimentosAnimais` não é atualizado** |
| `bulkCreateEntries` (`:442-666`) | `pesagens, animais, animalIdentificadores, movimentosAnimais, animalLotes, sessoesPesagem, auditoria, importacoes, marcas, racas, propriedades, categoriasAnimal` (`:450`) | checagem de hash, marcas/raças novas, animais, identificadores, sessões, pesagens, movimentos, `animalLotes`, auditorias, projeções, registro `importacoes` (`:456-664`) | `recalculateAllWeightSeries()` da **base inteira** depois (`weighingService.js:113`) |
| `bulkUpdateEntries` normal (`:710-750`) | `pesagens, animais, animalLotes, auditoria, categoriasAnimal` (`:713`) | pesagens, auditoria resumida, `animalLotes`, projeções; cronologia validada **dentro** | recálculo depois (`weighingService.js:133`) |
| `bulkUpdateEntries` `systemDerived` (`:673-708`) | só `pesagens` (`:703`) | os cinco derivados (`data_anterior, peso_anterior, dias, ganho, gmd`) no payload filtrado | — (é o próprio recálculo) |
| `bulkDeleteEntries` (`:753-775`) | `pesagens, animais, animalLotes, auditoria, categoriasAnimal` (`:759`) | soft delete, auditoria `CANCELAR`, `animalLotes`, projeções | recálculo depois (`weighingService.js:140,225`); **`movimentosAnimais` fica ativo** apontando para pesagem cancelada |

Consequências:
- O salvamento de uma pesagem e o recálculo de GMD das pesagens posteriores **não são atômicos**; um fechamento no meio deixa derivados desatualizados até o próximo recálculo.
- `movimentosAnimais` não acompanha edição/cancelamento (o próprio catálogo de relatórios registra isso, `src/modules/reporting/definitions/operacional.js:95`) e a verificação de integridade passa a acusar `pesagem_id órfão` após cancelar um Cadastro/Saída/mudança de lote (`health.js:108`).
- `rebuildAnimalStateProjection` usa `where('id').equals(animalId).first()` (`:217`): com ids repetidos pode pegar a linha antiga e, se ela estiver soft-deletada, pular a projeção — o mesmo defeito que o repositório genérico corrige (`genericRepository.js:40-51`).

### 12.2 Outras transações de escrita

| Local | Escopo |
|---|---|
| `masterRegistryService.js:232-234` | store do cadastro + `auditoria` |
| `v7Backfill.js:480-497` | store do passo + `appSettings` (checkpoint) |
| `v7Backfill.js:612` | `sessoesPesagem, loteApartacoes, apartacoes` |
| `backupService.js:217` | todas as `STORE_NAMES` (restore) |
| `backupService.js:274` | stores operacionais (limpeza) |
| `backupService.js:300` | todas menos `backupHistory` (reset) |
| `src/modules/perf/testMass.js:427` | massa de teste |

O repositório genérico não abre transação explícita (cada verbo é uma operação implícita; `bulkCreate` faz leituras e depois `bulkAdd`, `genericRepository.js:106-126`).

---

## 13. Funções canônicas (contratos atuais)

| Função | Local | Contrato |
|---|---|---|
| `getDb()` / `ensureStorageReady()` | `db.js:25-68` / `:74-80` | Singleton Dexie com a cadeia de versões; abre se fechado; retorna a instância |
| `getDbVersion()` | `db.js:82-84` | Constante `DB_VERSION` (não o instalado) |
| `inspectDatabase()` | `migrationCoordinator.js:40-63` | `{ exists, currentVersion, targetVersion, needsMigration, blockers[], stores[] }` sem abrir na versão nova |
| `prepareMigration({ files, inspection })` | `migrationCoordinator.js:70-83` | Backup pré-migração validado ou `null`; lança `MIGRATION_BLOCKED_LOTES`/`MIGRATION_BACKUP_FAILED` |
| `openWithMigration({ files, onProgress, hooks })` | `migrationCoordinator.js:181-227` | inspect → backup → PENDENTE → open → backfill; lança só bloqueios pré-abertura |
| `runPendingBackfills({ onProgress, maxBatches, files, hooks, origem })` | `migrationCoordinator.js:124-139` | Reentrante; **só `DB_VERSION`**; sucesso limpa bloqueio; falha bloqueia e relança |
| `createPreMigrationBackup({ sourceDb, sourceVersion, targetVersion, files })` | `preMigrationBackup.js:42-97` | Grava e valida (tamanho + SHA-256 relidos) ou lança; `skipped` só em dev |
| `readMigrationState(db, v)` / `writeMigrationState(db, v, patch)` | `migrationState.js:64-75` | Estado em `appSettings['migration:vN']`; merge raso |
| `assertWritable(op, { store })` | `migrationState.js:117-126` | Lança `MIGRATION_BLOCKED` salvo stores isentas |
| `runV7Backfill(db, opts)` / `dryRunV7(db)` | `v7Backfill.js:745-807` / `:814-866` | Molde de backfill resumível |
| `createRepository(store)` | `genericRepository.js:30-160` | CRUD com soft delete, linha ativa mais recente, bloqueio de escrita |
| `createFullBackupFromDb(db, opts)` / `createFullBackup()` | `backupService.js:47-82` / `:85-88` | Backup JSON com manifesto e SHA-256 |
| `dryRunRestore(payload)` / `applyRestore(payload, { safetyEvidence, files })` | `backupService.js:183-203` / `:213-263` | Validação e substituição integral com conversão de esquema |
| `clearOperationalData({ safetyEvidence })` / `resetAllData({ safetyEvidence, confirmedByAdmin, files })` | `backupService.js:269-279` / `:291-307` | Limpeza em dois níveis |
| `recordBackupHistory(tipo, detalhes)` | `backupService.js:29-39` | Best-effort, sem ator, sem bloqueio |
| `logicalIntegrity({ enforceV7 })` / `databaseStats()` | `health.js:21-141` / `:143-160` | Diagnóstico sem gravação |
| `getActor()` / `hasActorProvider()` / `getCurrentActor()` | `auditActor.js:33-40,53-55,58-60` | Ator da auditoria e papel |
| `recordAccessEvent(evento)` | `authAudit.js:39-57` | Auditoria de acesso sem segredos |
| `createEntry` / `updateEntry` / `bulkCreateEntries` / `bulkUpdateEntries` / `bulkDeleteEntries` | `weighingDataAdapter.js:297,393,442,668,753` | Transações da §12 |
| `calculateWeightGain({ history, date, weight })` | `src/modules/weighing/domain/weighingCalculations.js:13-35` | Anterior estritamente de data menor com peso; `dias` em dias UTC; `ganho` 2 casas; `gmd` 3 casas (0 se `dias ≤ 0`) |
| `recalculateWeightSeries(entries, affectedKeys)` | `src/modules/weighing/domain/weighingSeries.js:10-46` | Agrupa por `id:<animal_id>` ou `legacy:<chave>`; ordena por data, criação, id; só `Manejo` recebe derivados; devolve patches |
| `animalIdentityKey(entry)` | `weighingSeries.js:48-50` | Chave de agrupamento da série |
| `uiToStorageRecord` / `storageRecordToViewModel` / `filterLegacyPayload` | `weighingMapper.js:81-113` / `:115-150` / `:30-36` | Mapeamento com lista permitida do `legacy_payload` (`:6-25`; `sanidade_ids`/`sanidades` proibidas) |

---

## 14. Divergências documento × código

| Id | Documento | Código (prevalece) |
|---|---|---|
| D1 | `12-MODELO-DADOS-V7-V8.md:131` diz v6 = 16 stores | `STORES_V6` tem 15 (`schema.js:12-29`) |
| D2 | `12-…:62` categorias com `idade_min_meses/idade_max_meses`; `:112` B7 estima `nascimento` pela era com `nascimento_estimado=true` | Categorias por `peso_min_kg/peso_max_kg/era` (`v7Backfill.js:278-286`); `nascimento = null`, `nascimento_estimado = false` (`:529-533`) |
| D3 | `12-…:77` "o índice `[marca_id+valor_normalizado]` garante a unicidade por marca" | Índice não é único (`schema.js:62`); unicidade só por verificação (`health.js:87-104`) |
| D4 | `14-MIGRACOES.md:21` fluxo `inspect → prepare → open → backfill`; `:50` "flag `migrationBlocked` no `storageAdapter`"; `:66` massa 250 mil em `test:full` | Há gravação de PENDENTE antes de abrir (`migrationCoordinator.js:91-118,198-201`); flag em `migrationState.js:88` com isenção de `usuarios`/`auditoria` (`:86`); gate só tem 36 mil opcional (`verify-v7-migration.mjs:479`) e nenhum 250 mil |
| D5 | `docs/release/1.2.0/RELEASE-NOTES.md:42` "todo lançamento, alteração, backup, restauração e limpeza registra quem fez" | Backup/restore/limpeza/reset só em `backupHistory`, sem ator (`backupService.js:29-39,250,277,305`) |
| D6 | `RELEASE-NOTES.md:38` e ADR-032 (`08-DECISOES-ARQUITETURAIS.md:212-214`): reset exige senha; comentário `backupService.js:286-288` "senha reverificada no serviço" | `maintenanceService.resetAllData` só checa papel e texto `RESET` (`maintenanceService.js:132-136`) |
| D7 | Tela: "Apaga pesagens, animais, sessões, lotes e embarques" (`ManutencaoSistema.jsx:639`) | Apaga também `apartacoes, documentosEmbarque, animalIdentificadores, movimentosAnimais, animalLotes, auditoria, importacoes` (`backupService.js:272-276`) |
| D8 | `RELEASE-NOTES.md:48-50` sanidade exportada para `docs/evidence/program-2.0/` | Exporta para `exports/` na pasta de dados do usuário (`v7Backfill.js:676`) |
| D9 | `migrationState.js:81-85` diz que `auditoria` isenta serve para "registrar o evento de acesso" | `recordAccessEvent` chama `assertWritable` sem store e é bloqueado (`authAudit.js:53`) |
| D10 | `12-…:89-100` e ADR-019/022 reservam v8 para `operacoesComerciais` e excluem medicamentos/sanidade | Missão atual quer v8 para Sanidade/Importação — decisão pendente (§5.9) |
| D11 | `docs/release/1.3.0/RELEASE-CHECKLIST.md:3,12` "esquema Dexie 7" | Depende da ordem de release se a v8 entrar antes |
| D12 | `RELEASE-NOTES.md` 1.2.0 "Perfis fixos ADMIN, GESTOR e OPERADOR" | `USUARIO_ROLES` inclui `CONSULTA` (`schema.js:114`) |

---

## 15. Problemas encontrados no código (para o desenho)

1. **Coordenador de versão única** (`migrationCoordinator.js:31,126`): impede qualquer v8 sem refatorar a cadeia (§5.3).
2. **Downgrade silencioso** pelo Dexie 4 (§3.6) sem bloqueador no coordenador.
3. **Schema patch silencioso** se alguém estender `STORES_V7` sem bump (§3.6).
4. `formatVersion` binário e manifesto com `schemaVersion` do app novo no backup pré-migração (`backupService.js:54,67-69`).
5. `allowLegacy` nunca é `false`: backup sem SHA-256 e com stores faltando é sempre aceito (`backupService.js:138-148`).
6. `DEXIE_BACKUP_005` só lê `manifest.dbVersion` (`backupService.js:149`).
7. Restore substitui `backupHistory` e não protege contra falha do backfill após o commit (`backupService.js:217-248`).
8. Restore/limpeza/reset ignoram o bloqueio de escrita.
9. `movimentosAnimais` não é mantido em edição/cancelamento → integridade acusa órfãos (`weighingDataAdapter.js:403,759`; `health.js:108`).
10. `validateAnimalChronology` fora da transação em `createEntry`/`updateEntry` (`weighingDataAdapter.js:309,402`) — janela de corrida.
11. Recálculo de GMD fora da transação de gravação e, na importação, sobre a base inteira (`weighingService.js:86-88,113`).
12. `rebuildAnimalStateProjection` com `.first()` cru (`weighingDataAdapter.js:217`).
13. `importacoes.&arquivo_hash` + checagem só de `CONCLUIDA` → `ConstraintError` em reimportação de registro soft-deletado (`weighingDataAdapter.js:457-462`; `schema.js:67`).
14. Idempotência só por arquivo; nenhum vínculo pesagem → importação (§11.3).
15. Importação CSV da Relação sem backup físico prévio; cadastros criados fora da transação (`PesagensIndividuais.jsx:520-564`).
16. `exportPesagensCsv` exporta `operador`/`origem` sempre vazios e não é reimportável (`backupService.js:100-102`).
17. Relatório `payloadsLimpos` nunca é incrementado no B10 (`v7Backfill.js:578-598`; campo em `migrationState.js:34`).
18. "Limpar dados operacionais" apaga a trilha de auditoria e não audita a si mesma (`backupService.js:272-277`).
19. Reset sem senha reverificada (D6).
20. `bootstrapLocalDb` devolve `ready: false` sem lançar e `DbBootstrap` renderiza o app mesmo assim (`src/api/db.js:71-73`; `DbBootstrap.jsx:16-19`).
21. `recalculateWeightSeries` empilha no histórico entradas com peso `null` porque `Number(null) === 0` é finito (`weighingSeries.js:42`), e `calculateWeightGain` aceitaria esse 0 como peso anterior (`weighingCalculations.js:21`); hoje é mascarado porque nada é aceito depois de uma Saída, mas a importação que reconstrói séries precisa tratar isso.
22. Quatro gravadores de auditoria com três resoluções de ator diferentes (§10).
23. `logicalIntegrity` com `readMigrationState(db, 7)` fixo e leituras integrais repetidas (`health.js:24,52,56`).

---

## 16. Riscos para a implementação

- **R1 — Bancos v7 existentes:** o RC e o build de 15/09 criaram bancos v7; alterar a v7 em vez de subir para v8 quebra a garantia de backup pré-migração e deixa dois esquemas com o mesmo rótulo `schema-v7`.
- **R2 — Sanidade legada irrecuperável ou parcial:** as stores da v5 foram apagadas sem backup na v6; as chaves `cadastros-auxiliares:sanidade:*` só sobrevivem em `appSettings` se a exportação falhou (`v7Backfill.js:700-704`), no arquivo `exports/sanidade-export-*.json` ou no `backups/pre-migration-v7-*.json`. Numa cadeia v6 → v7 → v8, o B11 da v7 apaga as chaves antes de o backfill v8 conseguir lê-las.
- **R3 — Rollback:** depois da v8, o app v7 abre o banco (Dexie 4) e opera ignorando as stores novas; restaurar o backup pré-migração no app v8 não devolve o esquema v7.
- **R4 — Classificação de stores:** esquecer um catálogo de sanidade em `MASTER_REGISTRY_STORES` faz "Limpar dados operacionais" apagá-lo.
- **R5 — Escopo de transação:** qualquer escrita de sanidade dentro do salvamento de pesagem exige incluir as stores em cinco listas de escopo (§5.6); omissão gera erro de execução só no caminho afetado.
- **R6 — Atomicidade do recálculo:** a importação inteligente não pode depender do recálculo pós-commit atual se precisar de série consistente ao final; o recálculo da base inteira na importação escala mal em 36 mil/250 mil.
- **R7 — Conflito de numeração com o plano comercial v8 e com ADR-019/ADR-022** (§5.9).
- **R8 — Gates acoplados à v7** (§5.8): subir a versão sem ajustá-los deixa `test:quick` vermelho; `storage:backup:verify` e `storage:import-restore:verify` só rodam em `test:full`.
- **R9 — Memória no backup:** backup inteiro montado e serializado em memória no renderer; stores novas volumosas (aplicações por animal) aumentam o pico.
- **R10 — Nomes legados:** reutilizar `configuracoesSanidade/itensSanidade/sanidadesAnimal` faria backups antigos restaurarem linhas com forma da v5 nas stores novas.
