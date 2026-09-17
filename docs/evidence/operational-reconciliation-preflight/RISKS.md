# RISKS — riscos priorizados da reconciliação operacional (Sanidade · Lançamento · Importação/Exportação)

| Campo | Valor |
|---|---|
| Data | 17/09/2026 |
| Branch / HEAD | `program/sanity-launch-import` / `d44d5b9` |
| Modo | Somente leitura. A única escrita é este documento. Nenhum gate, servidor, build ou `git` que altere estado foi executado nesta revisão. |
| Fontes | `STATE-BEFORE.md`, `CURRENT-SCHEMA.md`, `CURRENT-LAUNCH-FLOW.md`, `CURRENT-IMPORT-EXPORT-CONTRACT.md`, `SANITY-CURRENT-STATE.md`, `CURRENT-WEIGHING-DOMAIN.md` (mesma pasta) e as descobertas dos auditores |
| Reverificação no código | `src/storage/migrations/migrationCoordinator.js`, `preMigrationBackup.js`, `v7Backfill.js` (B11 e runner); `src/storage/indexedDb/schema.js`, `db.js`, `backup/backupService.js`, `health/health.js`; `src/api/db.js`; `src/components/DbBootstrap.jsx`; `src/modules/weighing/application/weighingService.js`; `src/modules/weighing/infrastructure/weighingDataAdapter.js` (1-800); `src/modules/weighing/domain/weighingSeries.js`, `weighingCalculations.js`, `weighingMapper.js`; `src/modules/animals/domain/animalHistory.js`, `application/animalHistoryService.js`; `src/modules/maintenance/application/maintenanceService.js`, `infrastructure/maintenanceDataAdapter.js`; `src/pages/LancamentoPesagensIndividuais.jsx` (265-414, 525-584, 786-1175, 1380-1387, 2398-2415); `src/pages/ManutencaoSistema.jsx` (grep); `src/pages/PesagensIndividuais.jsx` (grep); `electron/main.cjs:110-149`; `electron/ipc/dialogIpc.cjs:25-59`; `node_modules/dexie/dist/dexie.js` (3990-4018, 4520-4614); gates em `scripts/` (grep de sanidade, versão e categoria; `verify-animal-history-integrity.mjs:100-160`; `verify-maintenance-ui-contract.mjs:76-81`; `verify-reports-sensitive-data.mjs:20-59`); `package.json:31,67,68`; evidências de desempenho em `docs/evidence/program-2.0/phase-00/`, `phase-01/perf/BASELINE.md`, `docs/evidence/f0-baseline/BASELINE.md` |
| Fonte da verdade | O código em `d44d5b9`. Onde um documento (inclusive deste preflight) diverge, a divergência está na §9. |

---

## 0. Como ler

### 0.1 Prioridade

| Nível | Critério | Quando tratar |
|---|---|---|
| **P0** | Perde, corrompe ou duplica dado do usuário sem aviso; abre o banco em versão nova sem backup; ou torna a missão impossível de aceitar (regra contraditória, gate que proíbe a entrega, suíte que não prova nada) | Antes do primeiro commit de produto da frente afetada. O gate da mitigação precisa existir e estar verde antes do código |
| **P1** | Resultado errado, não determinístico ou enganoso; custo que inviabiliza 36 mil/250 mil registros; lacuna que vira P0 num cenário plausível | Dentro da frente, antes do release candidate |
| **P2** | Rastreabilidade, diagnóstico, documentação ou dívida sem corrupção de dados | Pode ficar para depois, com registro |

### 0.2 Grau de confirmação

- **C** — confirmado por leitura do código nesta revisão.
- **C\*** — caminho confirmado por leitura; o cenário de falha não foi executado.
- **E** — estimativa feita sobre medição existente; precisa de medição própria.
- **D** — depende de decisão de produto ou arquitetura.

### 0.3 Gates

- **novo**: script ainda não existe. O nome segue o padrão do repositório (`area:tema:verify` → `scripts/verify-*.mjs`). **Nenhum gate foi criado.**
- **ajuste**: gate existente muda.
- Suíte: **Q** = `test:quick`; **F** = `test:full`; **R** = gate de release (fora das suítes, com evidência registrada em `docs/evidence/`).

---

## 1. Resumo executivo

**Contagem:** 13 riscos P0, 18 P1 e 10 P2.

| ID | Risco P0 | Frente | Conf. | Gate que prova |
|---|---|---|---|---|
| P0-01 | Suítes atuais não servem de critério de aceite (`test:full` vermelho; gates da área fora do `test:quick`) | Processo | C | `test:full` verde registrado; `auth:audit-actor:verify` |
| P0-02 | **Brecha no fail-closed:** erro sem código antes da abertura deixa o app abrir o banco na versão nova sem backup (em banco v5, apaga as stores de sanidade) | Storage | C\* | `migration:fail-closed:verify` (novo) |
| P0-03 | Coordenador de versão única: subir para v8 pula o backfill v7 (banco novo, v6, restore, reset) | Storage | C | `migration:chain:verify` (novo) |
| P0-04 | Editar `STORES_V7` ou usar versão fracionária contorna o backup pré-migração dos bancos v7 já existentes | Storage | C | `storage:dexie:verify` (ajuste) |
| P0-05 | Backup completo montado em memória pode não caber em 250 mil registros (bloqueia migração, restauração e importação JSON) | Storage/desempenho | E | `perf:backup:verify` (novo) |
| P0-06 | Nomes e classificação das stores de Sanidade (restore cru de linhas v5; "Limpar" apaga o catálogo) | Sanidade | C | `storage:dexie:verify` e `storage:backup:verify` (ajustes) |
| P0-07 | Gates e ADRs vigentes proíbem a Sanidade; risco de enfraquecer proteções ou implementar sem ADR | Sanidade/processo | C/D | `ui:consistency:verify` (ajuste) |
| P0-08 | Pesagem e aplicações de sanidade fora de uma transação única, sem ciclo de vida conjunto | Sanidade/Lançamento | C | `sanity:launch-atomic:verify` (novo) |
| P0-09 | Lançamento grava dados de um animal no próximo; preservar o contexto sem separar os estados amplifica o defeito | Lançamento | C | `launch:context:verify` (novo) |
| P0-10 | Identidade ambígua na importação resolve em silêncio para o animal errado | Importação | C | `import:reconcile:verify` (novo) |
| P0-11 | "Nunca dois Cadastros" só é garantido por `animal_id` | Domínio | C | `weighing:identity:verify` (novo) |
| P0-12 | Recálculo da série e conclusão da importação fora da transação (derivados nulos + hash bloqueia nova tentativa; nova tentativa no Lançamento duplica) | Domínio/Importação | C / C\* | `weighing:atomic-recalc:verify` (novo) |
| P0-13 | Regra "categoria automática só no Cadastro" contraria o código, dois gates e a decisão de 16/09 | Domínio | D + C | `category-projection:verify`, `animal:history-integrity:verify` (ajustes) |

Mensagens principais:

1. **Achado novo, fora dos documentos do preflight (P0-02):** o fail-closed da ADR-038 só vale para erros com código. Um `RangeError` na serialização indentada do backup pré-migração (`src/storage/migrations/preMigrationBackup.js:64-66`, fora de `try`) chega a `bootstrapLocalDb` sem código. O app renderiza assim mesmo (`src/api/db.js:71-73`; `src/components/DbBootstrap.jsx:15-20`), e a primeira leitura abre o banco na versão declarada (`src/storage/indexedDb/db.js:74-80`). Esse é exatamente o cenário de base grande (P0-05).
2. **A v8 não pode ser declarada** antes de a cadeia de backfills existir e estar provada (P0-03). A subida de versão também não pode ser feita editando a v7 (P0-04).
3. **O Lançamento já grava valores de um animal no seguinte** (`valor_venda_total`, `valor_total_abate`, `causa_morte`, embarque/documento em motivo errado, categoria manual). A missão 2 ("preservar contexto") precisa começar pela separação dos estados (P0-09).
4. **Três regras da missão pedem decisão antes do código:** categoria só no Cadastro (P0-13), primeiro evento de animal inexistente = Cadastro (P0-10/P0-11) e a lista campo a campo de contexto × dado do animal (P0-09). Ver §6.
5. **Não existe nenhuma medição de importação nem de backup em 250 mil.** A única referência de recálculo total é a F0: salvar custava 3,2 s p95 no Chromium com 36 mil e 64,5 s no Node com 250 mil (`docs/evidence/f0-baseline/BASELINE.md:13,27`). A importação, a edição coletiva e a exclusão pela tela continuam usando esse recálculo total (P1-12).
6. **O `test:full` está vermelho** e os gates de backup, importação/restauração e mapper não rodam no `test:quick` (P0-01). Isso precisa ser resolvido antes que qualquer gate abaixo sirva de prova.

---

## 2. Afirmações críticas conferidas no código

| Tema | Resultado | Evidência |
|---|---|---|
| Perda de dados na migração v8 | **Confirmado**, e **ampliado** (P0-02, P0-03): cadeia inexistente; brecha para erro sem código; em banco v5, o upgrade v6 apaga as stores de sanidade | `migrationCoordinator.js:31,124-139,191-196`; `preMigrationBackup.js:53-84`; `src/api/db.js:12,66-73`; `DbBootstrap.jsx:15-20,66-76`; `db.js:29-49,74-80` |
| Backup/restore entre versões | **Confirmado.** Restore só marca PENDENTE na versão vigente; commit antes do backfill; `ignoredStores` por nome; `formatVersion` binário; `DEXIE_BACKUP_005` só lê o manifesto | `backupService.js:54,67-69,149-153,161-171,213-263` |
| Downgrade (app v7 abrindo banco v8) | **Confirmado por leitura da biblioteca, não executado.** Em `VersionError` o Dexie reabre sem versão, e só recusa se o esquema declarado tiver algo a mais que o instalado | `dexie.js:4599-4603,4013-4018`; `migrationCoordinator.js:46,59` |
| Recálculo de série retroativo | **Confirmado.** No Lançamento, o recálculo roda em outra transação e só quando há data estritamente maior; na importação, roda sobre a base inteira depois de a importação ter sido marcada `CONCLUIDA` | `weighingService.js:79-88,105-115,144-197,237-245`; `weighingDataAdapter.js:652-662` |
| Dois Cadastros | **Confirmado.** A verificação é só por `animal_id`; Cadastro sem id ganha UUID novo; excluir um Cadastro deixa animal e identificador VISUAL ativos | `weighingDataAdapter.js:165-191,303,580-582,753-775`; `LancamentoPesagensIndividuais.jsx:883-887` |
| Identidade ambígua | **Confirmado.** Mapa `NÚMERO::MARCA` em texto, último vence, inclui animais inativos; cria animal a partir de qualquer tipo de evento; linhas SN da mesma marca viram um animal | `weighingDataAdapter.js:36,453,508-523,553-574` |
| Vazamento de campos entre animais no Lançamento | **Confirmado** (V-01 a V-08) | `LancamentoPesagensIndividuais.jsx:277-282,399-405,820-823,993,1029,1038,1040-1046,1074-1083,1111-1163,2406-2411` |
| Transação pesagem + sanidade | **Confirmado.** Cinco escopos fixos de transação, sem stores de sanidade; validação cronológica fora da transação | `weighingDataAdapter.js:309,311-315,402-403,450,713,759` |
| Conflito de nomes com as stores de sanidade v5 | **Confirmado.** O restore ignora por nome e faz `bulkAdd` cru; o gate exige a ausência dos nomes antigos | `backupService.js:167,217-222`; `schema.js:33-44`; `scripts/verify-dexie-storage.mjs:33-35` |
| Gates que afirmam ausência de sanidade | **Confirmado** | `scripts/verify-ui-consistency.mjs:20,185,233`; `verify-registry-ui.mjs:77`; `verify-master-registry.mjs:62`; `verify-dexie-storage.mjs:59`. Os que devem continuar valendo: `verify-dexie-storage.mjs:18-39`, `verify-payload-allowlist.mjs:24,28`, `verify-weighing-mapper.mjs:58,62`, `verify-perf-baseline-contract.mjs:195` |
| Desempenho 36 mil/250 mil da importação | **Confirmado o desenho O(N); sem medição.** A transação lê stores inteiras, projeta por animal e, depois dela, o recálculo regrava todas as pesagens sem comparar valores | `weighingDataAdapter.js:487-528,650,703-707`; `weighingSeries.js:36-41`; `weighingService.js:113`; `docs/evidence/program-2.0/phase-01/perf/BASELINE.md:6-23` (não há métrica de importação) |

---

## 3. Riscos P0

### P0-01 — Suítes atuais não servem de critério de aceite

**Frente:** processo · **Confirmação:** C (execução registrada em `STATE-BEFORE.md` §5-§6; asserções relidas)

**Evidência**
- `test:full` falha em `maintenance:ui:verify`: `scripts/verify-maintenance-ui-contract.mjs:80` exige `profile !== 'ADMIN'` e `function actorIdentity`, que não existem mais. O serviço autoriza pela matriz (`src/modules/maintenance/application/maintenanceService.js:16-26`).
- `storage:backup:verify`, `storage:import-restore:verify` e `weighing:mapper:verify` só rodam via `test:full` (`package.json:31,68`; nenhum deles está na linha `:67`).
- `scripts/verify-audit-actor.mjs:47` falha com `AUTH_FORBIDDEN`: espera gravar sem sessão, contra a falha fechada de `weighingService.js:16-24`. O script não está no `package.json`.
- `build` e `e2e:installed:verify:dev` não rodaram no preflight (`STATE-BEFORE.md:311-312`). O `test:full` completo nunca foi observado verde neste HEAD.

**Cenário de falha:** a v8 quebra o restore de backup v6 e o `test:quick` continua verde. O `test:full` já estava vermelho, então a falha nova passa como se fosse a antiga.

**Mitigação**
1. Checkpoint 0, em commit próprio antes da missão: alinhar `verify-maintenance-ui-contract.mjs:80` a `requireMaintenanceAction` + `can`; alinhar `verify-audit-actor.mjs` à falha fechada (com sessão explícita, ou sem provedor de ator) e ligá-lo no `package.json`.
2. Levar `storage:backup:verify`, `storage:import-restore:verify` e `weighing:mapper:verify` para o `test:quick`, medindo o tempo. Os três passaram isolados (`STATE-BEFORE.md:303-306`).
3. Registrar em evidência um `test:full` completo e verde (com `build` e `e2e`) no ponto de partida.
4. Tratar P1-17 (gate instável) no mesmo checkpoint.

**Gate:** execução real de `test:full` registrada; `auth:audit-actor:verify` (script existente com novo nome, Q); revisão de `package.json:67` confirmando os três gates.

---

### P0-02 — Brecha no fail-closed: erro sem código antes da abertura abre o banco na versão nova sem backup

**Frente:** storage/migração · **Confirmação:** C\* · **Ausente dos documentos do preflight.** `CURRENT-SCHEMA.md:21` trata o fail-closed como absoluto.

**Evidência (encadeamento)**
1. `createPreMigrationBackup` converte em `MIGRATION_BACKUP_FAILED` só os erros de leitura (`preMigrationBackup.js:54-62`), gravação (`:70-76`) e validação (`:78-84`). `JSON.stringify(backup, null, 2)`, `TextEncoder` e SHA (`:64-66`) ficam **fora** de `try`, e um `RangeError` sai sem `code`.
2. `openWithMigration` relança o erro original (`migrationCoordinator.js:191-196`). O mesmo vale para erro em `inspectDatabase` (`:182`) e em `recordPendingMigrationBeforeOpen` (`:198-199`).
3. `bootstrapLocalDb` só bloqueia `MIGRATION_BLOCKED_LOTES` e `MIGRATION_BACKUP_FAILED` (`src/api/db.js:12,67-70`). Qualquer outro erro vira `ready: false` **sem lançar** (`:71-73`).
4. `DbBootstrap` recebe o resultado, mostra o aviso de somente leitura e renderiza o app (`src/components/DbBootstrap.jsx:15-20,66-76`).
5. A primeira leitura de qualquer serviço chama `ensureStorageReady` → `db.open()` na versão declarada, sem guarda (`db.js:74-80`). O Dexie executa os `upgrade()`.
6. Num banco v5 (1.1.16 ou anterior), o upgrade v6 **apaga fisicamente** `configuracoesSanidade`, `itensSanidade` e `sanidadesAnimal` e remove `sanidade_ids`/`sanidades` das pesagens (`db.js:29-49`; `schema.js:40-44`). Nesse caso o backup pré-migração era a única cópia (`SANITY-CURRENT-STATE.md:38`).
7. Na abertura seguinte, `needsMigration` é falso (`migrationCoordinator.js:59`) e o backfill roda sem nenhum backup.

**Cenário de falha:** base grande (P0-05) atualiza para v8. O backup estoura em `:64`, o app abre com o aviso e a tela inicial sobe o banco para v8 sem backup. Com banco v5, a sanidade antiga é destruída.

**Mitigação**
1. Envolver todo o pré-abertura (inspeção, backup inteiro, estado PENDENTE) num `try` que converte qualquer erro em `MigrationError` com código de bloqueio (`MIGRATION_BACKUP_FAILED` ou um novo `MIGRATION_PREOPEN_FAILED`, incluído em `PRE_OPEN_BLOCK_CODES`).
2. Guarda de abertura em `ensureStorageReady`: com bloqueio pré-abertura registrado, recusar `open()`. A flag precisa ser distinta do `writeBlock` de falha de backfill, que exige o banco aberto.
3. `DbBootstrap` não renderiza `children` quando `ready === false`.

**Gate:** `migration:fail-closed:verify` (novo, Q)
- Banco v6 com dados e porta de arquivos falsa; `RangeError` forçado na serialização indentada (substituição temporária de `JSON.stringify` quando `space === 2`) → `bootstrapLocalDb` lança `MIGRATION_BLOCKED`; `storage.ensureReady()` rejeita em seguida; a abertura dinâmica mostra `verno === 6`.
- Banco v5 com linhas em `configuracoesSanidade` e a mesma falha → as três stores continuam existindo.
- Erro injetado em `inspectDatabase` e em `recordPendingMigrationBeforeOpen` → mesmo resultado.
- Controle positivo: sem falha injetada, `pre-migration-v<alvo>-*.json` é gravado e a migração conclui.

---

### P0-03 — Coordenador de versão única: subir para v8 pula o backfill v7

**Frente:** storage/migração · **Confirmação:** C

**Evidência**
- `BACKFILLS = { [V7_VERSION]: … }` (`migrationCoordinator.js:31`). `runPendingBackfills` executa só `BACKFILLS[DB_VERSION]` e, sem entrada, devolve `alreadyDone` sem executar nada (`:126-127`).
- PENDENTE antes de abrir e checagem de `FALHOU` só para `DB_VERSION` (`:95-113,214-219`). `getMigrationState`/`dryRunBackfill` usam só a versão vigente (`:157-169`), e a Manutenção os chama sem versão (`maintenanceDataAdapter.js:139-145`).
- Restore marca PENDENTE só em `getDbVersion()` (`backupService.js:231-248`); reset também chama só o backfill vigente (`:303-304`).
- Seeds e conversão v6 vivem nos passos B1–B12, que só rodam se `migration:v7` não estiver `CONCLUIDA` (`v7Backfill.js:745-807`).
- A integridade aplica só o contrato v7 (`health.js:24-25`).

**Cenário de falha** (`DB_VERSION = 8` sem cadeia): banco novo nasce sem as 7 categorias, a raça e a propriedade padrão; um banco da 1.1.17/1.1.18 (v6) chega à v8 sem B1–B12 (animais sem `marca_id`, chaves legadas sem exportar); restore de backup v5/v6 e reset têm o mesmo problema.

**Mitigação**
1. `BACKFILLS` ordenado; `runPendingBackfills` percorre as versões ≤ `DB_VERSION` em ordem crescente, pula as `CONCLUIDA`, para na primeira falha e bloqueia a escrita informando a versão.
2. `recordPendingMigrationBeforeOpen` e `applyRestore` marcam PENDENTE toda versão maior que a origem que tenha backfill; `openWithMigration` procura `FALHOU` em qualquer versão da cadeia.
3. `getMigrationState`/`dryRunBackfill` por versão; a Manutenção lista a cadeia; a v8 tem relatório próprio (não reutilizar `emptyMigrationReport` da v7, `migrationState.js:21-41`).
4. `logicalIntegrity` com contrato por versão.
5. Implementar e provar a cadeia **antes** de subir `DB_VERSION`, com um backfill v8 fictício no gate.

**Gate:** `migration:chain:verify` (novo, Q)
- Banco novo → `migration:v7` e `migration:v8` `CONCLUIDA`; 7 categorias, raça e propriedade padrão.
- Banco v6 com dados → B1–B12 e v8 executados em ordem; export de sanidade em `exports/`.
- Banco v5 → stores v5 removidas só depois do backup (em conjunto com P0-02).
- Restore de backup v6 no app v8 → as duas versões `CONCLUIDA`.
- Reset → seeds recriados.
- Falha injetada no B7 → a v8 não roda, `FALHOU` na v7, escrita bloqueada; "Continuar migração" conclui v7 e v8.
- Ajustes: `migration:v7:verify` roda dentro da cadeia (`scripts/verify-v7-migration.mjs:148,169,295,345,458-474`); `storage:backup:verify` (`scripts/verify-dexie-backup.mjs:115,145,157-158`) e `storage:import-restore:verify` (`scripts/verify-dexie-import-restore.mjs:101,122`) checam v7 e v8.
- **R (manual, com evidência):** instalar o RC1 real, lançar dados, instalar o build v8 e conferir o arquivo de backup pré-migração, os estados técnicos e as contagens.

---

### P0-04 — v7 congelada: editar `STORES_V7` ou usar versão fracionária contorna o backup pré-migração

**Frente:** storage · **Confirmação:** C (comportamento do Dexie: C\*, leitura de `dexie.js`)

**Evidência**
- Bancos v7 reais já existem: instalador RC1 com `dbSchemaVersion 7` e build de 15/09 (`CURRENT-SCHEMA.md:18`; `docs/release/1.2.0/RC1.md:5,10,15,24`).
- Com esquema estendido sem subir a versão, o Dexie avisa no console, sobe a versão nativa, cria o que falta e não executa `upgrade()` (`dexie.js:4566-4571,3768-3775`). O coordenador não enxerga migração (`migrationCoordinator.js:46,59`).
- `DATA_BUILD_ID = 'schema-v7'` é literal (`src/versioning/versionInfo.js:27`) e está amarrado a `scripts/verify-version-contract.mjs:170-171` e `scripts/verify-packaged-build.mjs:46`.
- `formatVersion = dbVersion <= 6 ? 2 : …` (`backupService.js:54`) e `pre-migration-v<alvo>` (`preMigrationBackup.js:15`) pressupõem versão inteira.

**Cenário de falha:** alguém acrescenta `aplicacoesSanidade` direto em `STORES_V7`. Os bancos do RC1 ganham a store sem backup e sem estado técnico, e passam a existir dois esquemas diferentes com o rótulo `schema-v7`.

**Mitigação:** `DB_VERSION = 8`; `STORES_V8 = { ...STORES_V7, <novas> }`; `STORES_V5/V6/V7` e `REMOVED_*` imutáveis; `db.version(8)` sem remoções e com `upgrade()` leve e idempotente; `DATA_BUILD_ID = 'schema-v8'`.

**Gate:** `storage:dexie:verify` (ajuste, Q)
- Parametrizar `scripts/verify-dexie-storage.mjs:59`.
- Fixar o SHA-256 de `JSON.stringify` de `STORES_V5`, `STORES_V6` e `STORES_V7`: o gate falha se alguém editar.
- Banco criado com `STORES_V7` e aberto por `openWithMigration` com porta falsa → `pre-migration-v8-*.json` gravado e `migration:v8` registrado.
- `release:version-contract:verify` (existente, Q) cobre `DATA_BUILD_ID`.

---

### P0-05 — Backup completo em memória pode não caber em 250 mil registros

**Frente:** storage/desempenho · **Confirmação:** E (**nunca medido**)

**Evidência**
- Todo backup lê cada store inteira (`backupService.js:48-52`) e serializa tudo para calcular o SHA (`:80`). Quem chama serializa de novo, com indentação: pré-migração (`preMigrationBackup.js:64-66`) e backups de segurança antes de importar, restaurar, limpar e resetar (`maintenanceDataAdapter.js:42,113,129,152,158`). A string atravessa o IPC inteira (`electron/main.cjs:123-129`).
- Linha média de `pesagens` = 1 136 bytes em JSON compacto (`docs/evidence/program-2.0/phase-00/payload-size-36k.json`; `PERFORMANCE.md:10`). Com 250 mil linhas, dá cerca de 284 MB só de `pesagens`.
- Cada criação grava auditoria com o registro completo em `depois` (`weighingDataAdapter.js:379-387,637`), e uma edição gerou 2 550 bytes (`PERFORMANCE.md:15`). Com uma linha de auditoria por evento, o JSON compacto passa da ordem de 500 MB antes da indentação. Isso é próximo do limite de comprimento de string do V8, que é da ordem de 2^29 caracteres em 64 bits (referência externa, confirmar na medição). O resultado depende de quanta auditoria a base real tem.
- A migração 1.1.17 → 1.2.0 com 250 mil está "a medir" (`docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md:176`). A F0 com 250 mil já exigiu heap de 8 GB no Node (`PERFORMANCE.md:31`). R-06 de `docs/evidence/auditoria-master-produto-pecuario/TARGET-PERFORMANCE-RISKS.md:25`.
- As aplicações de sanidade somam uma linha por aplicação por animal.

**Cenário de falha:** base grande atualiza para v8. O backup falha e o app não abre na versão nova (ou cai em P0-02, se o erro sair sem código). Ou o ADMIN tenta restaurar, o backup de segurança prévio falha e a restauração fica impossível, justamente na recuperação de desastre.

**Mitigação**
1. Medir pré-migração, backup de segurança e restore com 36 mil e 250 mil, com auditoria realista e volume de aplicações, **antes** de fechar o desenho da v8.
2. Se o resultado passar de ~50% do limite ou do orçamento de memória: backup em partes (um arquivo por store ou NDJSON, com SHA incremental e manifesto com SHA por parte) e `BACKUP_FORMAT_VERSION = 4`, mantendo a leitura dos formatos 1 a 3; sem indentação nos backups automáticos; SHA calculado sobre a mesma string gravada.
3. Ler as stores dentro de uma única transação somente leitura, para o backup ser consistente entre stores (`backupService.js:50-52`).

**Gate:** `perf:backup:verify` (novo; 36 mil em F, 250 mil em R). Gera massa v7 com auditoria por evento e aplicações; executa `createPreMigrationBackup` com porta falsa gravando em diretório temporário, o equivalente a `persistFullBackup` e `applyRestore` do arquivo. Exige sucesso e tamanho/SHA relidos iguais, e registra tempo e pico de heap em evidência. Se 250 mil ficar abaixo de 50% do limite, o risco cai para P1.

---

### P0-06 — Nomes e classificação das stores de Sanidade

**Frente:** Sanidade/storage · **Confirmação:** C

**Evidência**
- `readBackup` ignora só stores ausentes de `STORE_NAMES` (`backupService.js:167`) e o restore faz `bulkAdd` cru (`:217-222`). Com os nomes `configuracoesSanidade`/`itensSanidade`/`sanidadesAnimal` reutilizados (`schema.js:33-38`), linhas no formato v5 entrariam nas stores novas. `scripts/verify-dexie-storage.mjs:33-35` exige que esses nomes não existam.
- "Limpar dados operacionais" apaga toda store fora de `MASTER_REGISTRY_STORES ∪ PROTECTED_STORES` (`backupService.js:272-276`; `schema.js:98-110`). Uma store sem classificação é apagada.
- O backfill v7 apaga toda chave `cadastros-auxiliares:*` sempre que roda, inclusive depois de um restore (`v7Backfill.js:29,701-705`).
- `programasSanidade` e `medicamentos` já são nomes de buckets legados em camelCase (`scripts/verify-v7-migration.mjs:100`; `SANITY-CURRENT-STATE.md` §3.1).

**Cenário de falha:** o ADMIN limpa os dados operacionais no início da safra e perde o cadastro de medicamentos. Ou restaura um backup v5 e as stores novas recebem linhas com `configuracao_id` e sem `empresa_id`.

**Mitigação**
1. Nomes novos, diferentes dos v5, fixados na ADR-049.
2. Catálogo (programas/procedimentos, produtos/medicamentos) em `MASTER_REGISTRY_STORES`; aplicações ficam operacionais.
3. Classificação explícita e exaustiva: lista `OPERATIONAL_STORES` e asserção de que cada store pertence a exatamente uma classe.
4. Nenhuma configuração nova com o prefixo `cadastros-auxiliares:`. O legado entra só por mapeamento explícito (P1-04).

**Gate**
- `storage:dexie:verify` (ajuste, Q): mantém `:18-39` e acrescenta "nenhuma store de `STORES` tem nome de `REMOVED_STORES_V6`".
- `storage:backup:verify` (ajuste; Q depois de P0-01): backup formato 2 de banco v5 com as três stores → `ignoredStores` as contém e as stores novas ficam vazias; toda store de `STORE_NAMES` está em exatamente uma classe; `clearOperationalData` preserva o catálogo de sanidade e apaga as aplicações; `src/` não contém `cadastros-auxiliares:` fora de `v7Backfill.js`.

---

### P0-07 — Gates e ADRs vigentes proíbem a Sanidade

**Frente:** Sanidade/processo · **Confirmação:** C (gates) / D (ADR)

**Evidência**
- Quebram na primeira linha de sanidade: `scripts/verify-ui-consistency.mjs:20` (regex sobre o arquivo inteiro do Lançamento), `:185`, `:233`; `scripts/verify-registry-ui.mjs:77-79`; `scripts/verify-master-registry.mjs:62` (`REGISTRY_DEFINITIONS.length === 6`); `scripts/verify-dexie-storage.mjs:59`.
- **Precisam continuar valendo:** `scripts/verify-dexie-storage.mjs:18-39`; `scripts/verify-payload-allowlist.mjs:24,28`; `scripts/verify-weighing-mapper.mjs:58,62`; `scripts/verify-perf-baseline-contract.mjs:195`; lista proibida em `src/modules/weighing/domain/weighingMapper.js:23-25`.
- ADR-007 (`docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:40-45`) e ADR-022 (`:146-150`) exigem nova ADR. A ADR-019 diz que "estoque" é só de identificadores, "nada de medicamentos" (`:128`). A ADR-034 reserva a v8 a operações comerciais (`:221-226`). Próximos números livres: ADR-049 e DEC-031 (`SANITY-CURRENT-STATE.md:14`).

**Cenário de falha:** para o `test:quick` voltar a passar, a asserção `:20` é apagada junto com as de payload. `sanidade_ids` volta ao `legacy_payload` e eventos sem peso entram na série (P1-07).

**Mitigação**
1. ADR-049 aprovada antes do código: substitui ADR-007 e ADR-022; delimita a ADR-019 (catálogo sem estoque; carência informativa ou bloqueante); fixa nomes, versão (P1-05), permissões (P2-05) e destino do legado (P1-04).
2. No mesmo commit da primeira linha de sanidade no Lançamento, trocar a asserção negativa por um contrato positivo. As asserções de payload nunca saem.
3. Regra de revisão: uma asserção só é removida se outra equivalente entrar no mesmo commit.

**Gate**
- `ui:consistency:verify` (ajuste, Q): contrato positivo (painel com componentes ModeloBase1; payload montado sem chaves de sanidade; nenhum catálogo em `appSettings`) e checagem de que `08-DECISOES-ARQUITETURAIS.md` contém `## ADR-049` quando o módulo de sanidade existir.
- `registry:ui:verify` e `registry:master:verify` (ajuste) com as páginas e definições novas.
- Gates de payload inalterados.

---

### P0-08 — Pesagem e aplicações de sanidade fora de uma transação única

**Frente:** Sanidade/Lançamento · **Confirmação:** C (escopos e fluxo atuais)

**Evidência**
- Escopos fixos: `createEntry` (`weighingDataAdapter.js:311-315`), `updateEntry` (`:403`), `bulkCreateEntries` (`:450`), `bulkUpdateEntries` (`:713`), `bulkDeleteEntries` (`:759`). O Dexie recusa acesso a tabela fora do escopo.
- Cancelar só toca `pesagens`, `animais`, `animalLotes` e `auditoria` (`:759-773`). Hoje isso já deixa `movimentosAnimais` ativos apontando para pesagem cancelada (`health.js:106-108`).
- `validateAnimalChronology` roda antes e fora da transação (`:309`, `:402`).
- O Lançamento chama o serviço e só depois atualiza o estado (`LancamentoPesagensIndividuais.jsx:1057-1059`). A duplicidade do dia é checada contra esse estado em memória (`:868-875`); o serviço não checa.
- Aplicação gravada como evento em `pesagens` é proibida (ADR-027; `weighingMapper.js:23-25`) e seria tratada como peso 0 (P1-07).

**Cenário de falha:** a tela grava a pesagem e depois, numa segunda chamada, as aplicações. A segunda chamada falha e fica pesagem sem aplicação; o operador tenta de novo e a pesagem é duplicada, agora com aplicações. Ou: "Desfazer" a pesagem deixa as aplicações ativas com `pesagem_id` cancelado.

**Mitigação**
1. Um único ponto de serviço (ex.: `createEntry` com `aplicacoes[]`), com as stores de sanidade no escopo da mesma transação, autorização no serviço e auditoria por aplicação com o mesmo `auditRow` (`weighingDataAdapter.js:73-75`).
2. Id do evento gerado uma vez por submissão e reutilizado na nova tentativa. O adapter já recusa id repetido (`:330`), então a nova tentativa fica idempotente.
3. Cancelar ou editar a pesagem trata as aplicações na mesma transação: cancela junto; mudança de data acompanha ou é recusada, conforme a ADR-049. Cronologia da aplicação: data ≥ Cadastro e < Saída.
4. `logicalIntegrity`: aplicação com `animal_id`, `pesagem_id` ou produto órfão vira issue.

**Gate:** `sanity:launch-atomic:verify` (novo, Q)
- Pesagem + 2 aplicações → tudo gravado, com auditoria.
- Falha injetada na segunda aplicação → nenhuma pesagem, nenhuma aplicação, nenhuma sessão nova.
- Nova tentativa com o mesmo id → um único conjunto gravado.
- Cancelar a pesagem → aplicações canceladas, com auditoria.
- Aplicação com data ≥ Saída → recusada.
- `logicalIntegrity` acusa órfãos.
- CONSULTA recusado no serviço.

---

### P0-09 — Lançamento grava dados de um animal no próximo

**Frente:** Lançamento · **Confirmação:** C

**Evidência (conferida)**
- Depois de salvar, só são limpos `editingId`, `animalIdSelecionado`, `peso`, Nº, `observacao`, `documentacao`, aviso e, no Cadastro, categoria/era (`LancamentoPesagensIndividuais.jsx:1074-1081`).
- **V-01:** `salvarConfiguracaoTipoAtual()` (`:1082`) grava o fechamento com os valores antigos (`:399-401`), desfazendo na configuração do tipo o reset de `:1077`. A configuração é reaplicada em `:405`.
- **V-02:** `valorVendaTotal` e `valorTotalAbate` continuam no estado e entram no payload do próximo animal (`:1029`, `:1038`).
- **V-03:** `causaMorte` continua; a validação `:820-823` passa sem nova escolha, e a causa é gravada em `:993`.
- **V-04:** embarque e documento vão para o payload de qualquer motivo de Saída (`:1040-1046`).
- **V-05/V-06:** `handleEditar` sobrescreve o contexto (`:1111-1163`) e só troca apartação/lote se o registro os tiver (`:1133-1134`).
- **V-07:** confirmar um SN grava o perfil do SN no contexto do Cadastro (`:2406-2411`).
- **V-08:** `aplicarAnimalSelecionado` escreve sexo, raça, era e marca do animal nos estados de contexto (`:277-282`), usados depois como fallback (`:843`, `:974`).

**Cenário de falha:** o GESTOR lança 30 vendas e digita o valor total só no primeiro animal; os outros 29 são gravados com o mesmo `valor_venda_total`. Com Sanidade na mesma estrutura, a dose ou o produto de um animal passaria para o seguinte.

**Mitigação**
1. Extrair da página um módulo puro com dois estados: `contexto` (data, tipo, motivo, apartação, regra de lote, embarque/documento só para Venda/Abate, comprador/frigorífico, preço/@, rendimento, sequência, programa sanitário da sessão) e `dadosDoAnimal` (Nº, `animal_id`, peso, observação, valor total do animal, causa da morte, categoria manual, perfil do animal em Manejo/Saída, aplicações e doses). A lista final, campo a campo, é a decisão D-4.
2. Uma única `limparDadosDoAnimal()` depois de salvar; o contexto é salvo a partir do snapshot submetido, nunca do fechamento.
3. `montarPayload(contexto, dadosDoAnimal, catálogos)` puro, que anula os campos que não pertencem ao tipo ou ao motivo.
4. Edição num rascunho separado: Atualizar e Cancelar restauram o contexto anterior; SN não altera o contexto.

**Gate:** `launch:context:verify` (novo, Q; testa o módulo puro, sem DOM)
- Salvar Venda com total 3000 e depois outro animal sem digitar → payload sem `valor_venda_total`.
- Morte com causa e depois outro animal → a validação exige a causa.
- Venda com embarque, depois troca para Morte → `embarque_id` nulo.
- Editar e cancelar → contexto igual ao de antes.
- Confirmar SN → contexto do Cadastro inalterado.
- Categoria manual não reaparece ao trocar de tipo e voltar.
- Ajustes de `ui:consistency:verify` e `ui:operational-customization:verify` (P1-14).

---

### P0-10 — Identidade ambígua na importação resolve em silêncio para o animal errado

**Frente:** Importação/domínio · **Confirmação:** C

**Evidência**
- A chave é o texto `NÚMERO::MARCA` com `trim` + `toUpperCase` (`weighingDataAdapter.js:36,453`). O mapa é montado com os identificadores e depois com **todos** os animais não excluídos, que sobrescrevem as entradas (`Map.set`, último vence) sem filtro de situação (`:508-523`).
- `animal_id` do payload tem precedência (`:554`). Sem casamento, o adapter cria animal a partir de **qualquer** tipo de evento, com a marca padrão quando a marca vem vazia (`:492`, `:556-574`).
- Todas as linhas `SN` da mesma marca caem na mesma chave (`:553`). No Lançamento cada SN é um animal (`LancamentoPesagensIndividuais.jsx:956`).
- O índice `[marca_id+valor_normalizado]` existe (`schema.js:62`) e não é usado para resolver animal. A unicidade só é diagnosticada (`health.js:87-104`), embora a ADR-020 a exija no serviço, dentro da transação (`08-DECISOES-ARQUITETURAIS.md:133-135`).
- As normalizações divergem: `weighingDataAdapter.js:36`; `src/modules/animals/domain/animalHistory.js:1`; `src/modules/animals/domain/snAnimal.js:3-4`; `src/modules/catalog/domain/normalize.js:4-9`; `src/modules/reporting/domain/filterEngine.js:59-65`.

**Cenário de falha:** existem dois animais ativos "120 / ABC" (Cadastro desfeito e refeito, P0-11). Um arquivo com 200 Manejos do "120" vai inteiro para o último indexado, e o GMD mistura dois animais. Ou um brinco reaproveitado casa com o animal vendido e o arquivo inteiro aborta.

**Mitigação**
1. Um resolvedor canônico único para Lançamento, dry-run e gravação: VISUAL ativo por `[marca_id+valor_normalizado]`, com normalização única, devolvendo 0, 1 ou N candidatos com a situação de cada um.
2. N candidatos → linha pendente de conciliação (nunca "último vence"). Um candidato inativo → pendência com opção explícita. Nenhum → regra "primeiro evento cronológico = Cadastro" (D-5) ou pendência. Marca vazia → pendência, não marca padrão. SN → nunca agrupa.
3. Diagnóstico prévio das duplicidades existentes antes de a unicidade virar bloqueio.

**Gate:** `import:reconcile:verify` (novo, Q), bloco de identidade
- Dois animais ativos com a mesma identidade → linhas pendentes, nada gravado.
- Animal vendido com o mesmo número → pendência com motivo.
- Marca vazia → pendência.
- Três linhas SN → três animais ou rejeição, conforme decisão.
- "12  A" e "12 A" resolvem igual no Lançamento, no dry-run e na gravação.
- Dry-run e gravação chegam ao mesmo resultado.

---

### P0-11 — "Nunca dois Cadastros" só vale por `animal_id`

**Frente:** domínio/Importação/Lançamento · **Confirmação:** C

**Evidência**
- `validateAnimalChronology` compara o Cadastro por `animal_id` (`weighingDataAdapter.js:172-174`) e não recusa Cadastro com data posterior a eventos já existentes (`:165-191`). A importação repete essa lógica (`:580-582`).
- Cadastro sem `animal_id` recebe UUID novo (`:303`). A checagem por número + marca só existe na tela (`LancamentoPesagensIndividuais.jsx:883-887`).
- Excluir um Cadastro sem histórico cancela só a pesagem; `animais` e o VISUAL continuam ativos (`weighingDataAdapter.js:753-775`). O Lançamento aceita então um novo Cadastro com a mesma identidade, o que gera dois animais ativos (`health.js:97-100` acusa).
- Um animal criado pela importação a partir de Manejo não tem Cadastro e não aparece no Lançamento (`animalHistory.js:22-25`); o Cadastro manual desse número é bloqueado pela tela (`:883-887`).
- A exclusão pelo Lançamento passa por `deleteEntriesRespectingHistory` → `bulkDeleteEntries` (`src/modules/animals/application/animalHistoryService.js:16-23`).

**Cenário de falha:** uma importação histórica (Cadastro + Manejos) roda sobre uma base com Cadastros desfeitos e refeitos. Cada caminho cria ou escolhe um animal diferente.

**Mitigação:** unicidade pela identidade canônica, validada no serviço e dentro da transação (ADR-020); recusa de Cadastro com data posterior ao primeiro evento do animal; exclusão de Cadastro inativa VISUAL e animal na mesma transação; fluxo de saneamento com dry-run para animais sem Cadastro (promover o primeiro evento ou criar o Cadastro na conciliação).

**Gate:** `weighing:identity:verify` (novo, Q), exercitado pelo serviço e não pela tela
- Segundo Cadastro da mesma identidade sem `animal_id` → recusado.
- Cadastro com data posterior a um Manejo → recusado.
- Excluir Cadastro sem histórico → VISUAL inativo; um novo Cadastro reutiliza ou recusa, conforme decisão.
- Diagnóstico na massa de 36 mil com duplicidades injetadas → contagem correta.
- `animal:history-integrity:verify` (ajuste).

---

### P0-12 — Recálculo da série e conclusão da importação fora da transação

**Frente:** domínio/Importação/Lançamento · **Confirmação:** C; a duplicação na nova tentativa do Lançamento é C\*

**Evidência**
- Importação: `importacoes` é gravada com `status: 'CONCLUIDA'` dentro da transação (`weighingDataAdapter.js:652-662`). O recálculo roda depois, em outra transação e sobre a base inteira (`weighingService.js:112-113,144-146,152-153`).
- Se o recálculo falhar, os derivados ficam nulos e a nova tentativa é recusada pelo hash (`weighingDataAdapter.js:457-462`).
- `listEntries` engole o erro e devolve `[]` (`weighingService.js:237-245`), e o recálculo total vira um no-op silencioso.
- Lançamento retroativo: a gravação é commitada (`weighingService.js:79`) e o recálculo vem depois (`:81-88`). A exceção vira `WEIGHING_SAVE_001` (`:99-102`). A tela mostra o erro sem limpar o formulário nem atualizar o estado (`LancamentoPesagensIndividuais.jsx:1057-1059,1084-1086`). A checagem de duplicidade do dia usa esse estado em memória (`:868-875`) e o serviço não checa duplicidade.

**Cenário de falha:** uma importação de histórico termina com GMD nulo em milhares de eventos e não pode ser repetida. No Lançamento, um retroativo que falha no recálculo é salvo duas vezes quando o operador tenta de novo.

**Mitigação**
1. Recalcular os animais afetados dentro da mesma transação: a função pura já existe (`weighingSeries.js:10-46`) e basta carregar a série por `animal_id` no escopo. Alternativa: duas fases, com `importacoes.status = EM_ANDAMENTO` virando `CONCLUIDA` só depois do recálculo, e uma retomada que refaz os derivados.
2. O caminho de recálculo propaga o erro de leitura (não usa `listEntries`).
3. Id do evento reutilizado na nova tentativa (P0-08, item 2).

**Gate:** `weighing:atomic-recalc:verify` (novo, Q)
- Falha injetada no recálculo da importação → nada gravado, ou `status ≠ CONCLUIDA` com nova tentativa permitida e completa.
- `createEntry` retroativo com falha injetada → nova tentativa com o mesmo id não duplica.
- Leitura falhando durante o recálculo → erro propagado.
- Após sucesso → derivados iguais ao oráculo `recalculateWeightSeries` aplicado à base inteira.

---

### P0-13 — Regra "categoria automática só no Cadastro" contraria código, gates e decisão registrada

**Frente:** domínio/Importação · **Confirmação:** D + C

**Evidência**
- Hoje Manejo, Saída com peso e edição carimbam categoria e era no evento (`weighingDataAdapter.js:197-207,331-334,407-409`). A projeção reclassifica o animal pelo último evento com peso de qualquer tipo (`:232-243`); o comentário em `:131` descreve isso.
- A importação não carimba nenhum evento, mas a projeção reclassifica o animal (`:650`). A edição coletiva também não carimba (`:713-749`).
- Dois gates exigem a reclassificação: `scripts/verify-animal-history-integrity.mjs:131-140` ("Manejo recalcula") e `scripts/verify-category-projection.mjs:26-29`.
- A ADR-028 fala em faixa etária e em sugestão que nunca sobrescreve valor informado (`08-DECISOES-ARQUITETURAIS.md:186-192`). O código usa peso e sobrescreve `era` (`weighingDataAdapter.js:206`).

**Cenário de falha:** a importação passa a aplicar categoria só no Cadastro enquanto o Lançamento reclassifica no Manejo. A mesma série produz categorias diferentes conforme o caminho, contrariando o item 4 da missão ("mesmas funções").

**Mitigação:** registrar a decisão (DEC-031 ou ADR) antes da importação; uma função de domínio para a categoria do evento e para a projeção, usada por `createEntry`, `updateEntry`, `bulkUpdateEntries` e pela importação; inverter ou manter os dois gates de forma coerente com a decisão.

**Gate:** `category-projection:verify` e `animal:history-integrity:verify` (ajuste, Q) na regra decidida, mais um caso de paridade em `weighing:rule-parity:verify` (P1-08): a mesma série gravada por `createEntry` e por importação dá a mesma `categoria_id` e a mesma `era` nos eventos e no animal.

---

## 4. Riscos P1

### P1-01 — Downgrade silencioso: o app 1.2.0-rc1 abre um banco v8

- **Confirmação:** C\* (leitura de `dexie.js`, não executado).
- **Evidência:** em `VersionError` o Dexie reabre sem versão (`dexie.js:4599-4603`) e só recusa se o esquema declarado tiver algo que falta no instalado (`:4013-4018`). `inspectDatabase` não bloqueia `currentVersion > targetVersion` (`migrationCoordinator.js:46,59`). O backup do app antigo usa o `STORE_NAMES` e o `dbVersion` constantes dele (`backupService.js:85-88`; `db.js:82-84`). O instalador RC1 existe (`STATE-BEFORE.md:408-409`).
- **Cenário de falha:** um testador reinstala o RC1 depois da versão com v8. O app antigo abre o banco, cancela pesagens (deixando aplicações órfãs) e gera um backup que omite a sanidade, rotulado `dbVersion 7`. Restaurado no app novo, esse backup zera a sanidade.
- **Mitigação:** (1) guarda de downgrade no coordenador a partir da v8 (banco com versão maior que a do app → bloqueio pré-abertura), que protege versões futuras; (2) para o RC1 já distribuído não há correção retroativa: o procedimento de release proíbe reinstalar versões anteriores e o documento de migração avisa; (3) o backup grava também a versão instalada (`db.verno`), e o restore de backup com versão menor que a instalada avisa quais stores serão zeradas.
- **Gate:** `storage:downgrade-guard:verify` (novo, Q): executa o comportamento do Dexie (banco com store a mais aberto por declaração menor → abre), confirmando a leitura estática; banco v9 aberto pelo app v8 → bloqueio; backup registra a versão instalada.

### P1-02 — Restauração entre versões: commit antes do backfill e stores novas zeradas sem aviso

- **Confirmação:** C.
- **Evidência:** a substituição é commitada antes do backfill (`backupService.js:217-248`); o registro `restore` só é gravado no fim (`:250-261`); restore, limpeza e reset não chamam `assertWritable` (`:213-307`); stores ausentes no backup nascem vazias (`:161-171`) e o dry-run só as lista (`:198-199`); restaurar o backup pré-migração não devolve o esquema v7 (`CURRENT-SCHEMA.md` §7.4).
- **Cenário de falha:** o restore de um backup v6 no app v8 falha no B7. Os dados já foram trocados, não há linha `restore` no histórico e o usuário não sabe que backup está no banco. Ou o usuário restaura o backup pré-migração como "rollback" e perde todas as aplicações lançadas depois da migração.
- **Mitigação:** gravar `restore` antes do backfill, com status; dry-run explícito ("Sanidade: N aplicações atuais serão apagadas"); a tela de restauração explica que restaurar o pré-migração não volta a versão; decidir e documentar a isenção de bloqueio de escrita do restore.
- **Gate:** `storage:import-restore:verify` (ajuste, levado para Q): restore v6 no app v8 com falha injetada no backfill v7 → histórico `restore` com backfill `FALHOU`, escrita bloqueada, e a retomada conclui v7 e v8; backup v7 restaurado sobre banco v8 com aplicações → dry-run lista as stores que serão zeradas, com contagem.

### P1-03 — Metadados do backup pré-migração

- **Confirmação:** C.
- **Evidência:** `formatVersion = dbVersion <= 6 ? 2 : BACKUP_FORMAT_VERSION` (`backupService.js:54`); o manifesto grava `appVersion`, `schemaVersion` e `dataContractVersion` do app novo (`:59,67-69`) mesmo no pré-migração, que passa `dbVersion` da origem (`preMigrationBackup.js:55-59`).
- **Cenário de falha:** `BACKUP_FORMAT_VERSION` sobe para 4 (P0-05) e o pré-migração de um banco v7 sai rotulado formato 4 com `schemaVersion: 8`.
- **Mitigação:** mapa versão → formato; manifesto do pré-migração com as versões da origem e um campo separado para o app que gerou.
- **Gate:** `storage:backup:verify` (ajuste): backup de instância v7 feito no app v8 → formato e `schemaVersion` da origem.

### P1-04 — Sanidade legada sem caminho de volta

- **Confirmação:** C.
- **Evidência:** o B11 exporta e depois apaga as chaves `cadastros-auxiliares:sanidade:*` (`v7Backfill.js:661-707`), com destino `<dataDir>/exports/` (`:674-676`; `electron/main.cjs:116-121`), não `docs/evidence/program-2.0/` como diz a ADR-022 (`08-DECISOES-ARQUITETURAIS.md:149-150`). A Manutenção não mostra `relatorio.sanidade` (`src/pages/ManutencaoSistema.jsx:470-480` lista outros campos, e `sanidade` não aparece no arquivo). O B11 exporta só chaves de configuração, nunca aplicações (`:661-665`). As aplicações v5 só sobrevivem em backups pré-migração, que usam `db.tables` (`preMigrationBackup.js:55-59`; `backupService.js:48`); restaurar descarta essas stores (`backupService.js:167`).
- **Cenário de falha:** um usuário da 1.1.17 com programas e medicamentos atualiza. Os dados vão para um arquivo que ninguém lê; quando a Sanidade voltar, ele recadastra tudo com ids novos.
- **Mitigação:** ADR-049 decide o destino. Importador explícito de `sanidade-export-*.json` e da chave retida (`SEM_PORTA_DE_ARQUIVOS`, `v7Backfill.js:670-672,700-704`), com dry-run, mapeamento camelCase → snake_case e ids preservados. Importador opcional de aplicações a partir de `backups/pre-migration-v7-*.json` de bancos v5. A Manutenção passa a mostrar `relatorio.sanidade`.
- **Gate:** `sanity:legacy-import:verify` (novo, Q): fixture no formato de `v7Backfill.js:675` + chave retida → dry-run lista registros e mapeamento; a gravação cria o catálogo com ids preservados; a segunda execução não cria nada; `migration:v7:verify` continua inalterado.

### P1-05 — Numeração: a v8 está reservada a operações comerciais

- **Confirmação:** C/D.
- **Evidência:** ADR-034 (`08-DECISOES-ARQUITETURAIS.md:221-226`) e ADR-025 (`:166`); `docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md:89-100`. O código já antecipa: `masterRegistryService.js:105` conta `operacoesComerciais`, `:119` fala em "coluna promovida na v8", `src/modules/reporting/definitions/controle.js:91-92` cita a "modelagem v8" e `migrationCoordinator.js:30` diz "A v8 entra aqui na Fase 3".
- **Cenário de falha:** a Sanidade entra como v8, o plano comercial continua escrito como v8 e o próximo programa monta um backfill "v8" que já existe.
- **Mitigação:** a ADR-049 renumera (v8 = Sanidade e metadados de importação; v9 = comercial) e atualiza os documentos 12/14 e os comentários. Uma v8 conjunta não é recomendada, porque aumenta o alcance da migração.
- **Gate:** `migration:chain:verify` afirma as chaves de `BACKFILLS` e que `STORES_V8 − STORES_V7` é exatamente a lista da ADR-049.

### P1-06 — Ordem dentro do dia não determinística

- **Confirmação:** C.
- **Evidência:** a importação ordena por data e `id` (`weighingDataAdapter.js:550`), com o mesmo `created_at` para todas as linhas (`:610`) e ids UUID (`:479`). Na série, a ordem é data → `created_at` → id (`weighingSeries.js:5-8`), e `calculateWeightGain` fica com o primeiro de datas iguais (`weighingCalculations.js:20-22`). A projeção usa o último (`weighingDataAdapter.js:27-30,220-232`). Manejo + Saída no mesmo dia passa ou aborta conforme o UUID (`:586-591`).
- **Cenário de falha:** um arquivo com Manejo e Venda do mesmo animal no mesmo dia aborta ou passa por acaso. Numa repesagem, o GMD usa a primeira pesagem e a ficha mostra a última.
- **Mitigação:** chave de ordem explícita (linha do arquivo ou sequência) preservada no evento, em coluna ou store de itens de importação, nunca no `legacy_payload` (ADR-027); um único `eventOrder` compartilhado; política de repesagem (D-6).
- **Gate:** `weighing:rule-parity:verify` (P1-08) com o caso "mesmo dia" repetido em 50 sementes de UUID → resultado idêntico; `weighing:calculations:verify` (ajuste): a referência da série é o mesmo evento que a projeção escolhe.

### P1-07 — Peso ausente tratado como 0 nas funções canônicas

- **Confirmação:** C.
- **Evidência:** `Number(entry.peso)` com `null` dá 0, que é finito (`weighingCalculations.js:21`); a série empilha qualquer `Number()` finito (`weighingSeries.js:25,42`); o view model devolve `peso: null` (`weighingMapper.js:139`). A semântica correta já existe em `weightOf` (`weighingDataAdapter.js:210-213`), mas o domínio puro não a usa. Hoje é inalcançável, porque nada pode ser lançado depois de uma Saída.
- **Cenário de falha:** uma importação que reconstrói a série permite evento depois de uma Saída sem peso (reversão, correção) e grava `peso_anterior = 0` com ganho igual ao peso inteiro.
- **Mitigação:** uma função única `pesoMedido`, com a semântica de `weightOf`, usada por `calculateWeightGain`, `recalculateWeightSeries` e pela prévia.
- **Gate:** `weighing:calculations:verify` (ajuste, Q): histórico com peso `null`, `''` e `0` é ignorado; uma série construída com Saída sem peso seguida de Manejo não produz `peso_anterior = 0`.

### P1-08 — Regras duplicadas ou que só existem na tela

- **Confirmação:** C.
- **Evidência:** `validateAnimalChronology` roda fora da transação (`weighingDataAdapter.js:309,402`) e a importação tem uma cópia própria (`:529-595`). Só na tela: duplicidade no dia (`LancamentoPesagensIndividuais.jsx:868-875`), animal inativo (`:877-882`), já cadastrado (`:883-887`), documento (`:826-833`), rendimento (`:894-901`) e avisos (`:888-893`). Dia fechado não bloqueia (`weighingDataAdapter.js:318-329,597-602`), contra a ADR-030 (`08-DECISOES-ARQUITETURAIS.md:199-203`). `validateUiPayload` não valida `tipo_manejo` nem `motivo_saida` (`weighingMapper.js:51-79`). Erro de validação do serviço aborta o lote sem número de linha (`weighingService.js:108-111`).
- **Cenário de falha:** o mesmo evento é recusado no Lançamento e aceito na importação, ou o contrário. O relatório de conciliação não aponta a linha.
- **Mitigação:** uma função pura `validarEventos(estadoAtual, eventos)` usada por `createEntry` (dentro da transação), `updateEntry`, `bulkUpdateEntries`, dry-run e gravação da importação; políticas de sessão fechada, duplicidade e documento no serviço; enum de tipo e motivo validado; erro com o índice da linha.
- **Gate:** `weighing:rule-parity:verify` (novo, Q). Uma tabela de cenários roda por `createEntry`, pelo dry-run e pela gravação, e exige a mesma decisão, o mesmo código e a linha informada. Cenários: duplicidade no dia, animal inativo, Cadastro duplicado por identidade, evento antes do Cadastro, Saída retroativa, evento após Saída, dia fechado, Abate sem documento, Venda/Abate sem rendimento, data futura.

### P1-09 — Idempotência só por hash do arquivo

- **Confirmação:** C.
- **Evidência:** o hash é da string decodificada do CSV (`PesagensIndividuais.jsx:355`) ou do objeto JSON re-serializado (`backupService.js:344-345`), com índice único e checagem só de `CONCLUIDA` (`weighingDataAdapter.js:457-462`; `schema.js:67`). A coluna `ID` é mapeada e nunca usada (`PesagensIndividuais.jsx:370`), e toda linha ganha UUID novo (`weighingDataAdapter.js:479`). O serviço não checa animal + data. A opção "criar cadastros" grava antes e fora da transação (`PesagensIndividuais.jsx:520-532,550-552`).
- **Cenário de falha:** o operador abre o CSV no Excel, salva de novo e reimporta: todos os Manejos são duplicados. Uma importação falha por cronologia depois de criar marcas, e as marcas ficam.
- **Mitigação:** chave natural por linha (animal canônico + data + tipo, com o peso para detectar conflito); `importacao_id` e linha de origem numa store de itens de importação; conflito igual → ignorar, diferente → pendência; criação de cadastros dentro da transação da importação.
- **Gate:** `import:reconcile:verify` (novo, Q), bloco de idempotência: mesmo conteúdo com CRLF ou colunas reordenadas → nenhum registro novo; arquivos sobrepostos → só os novos; mesma chave com peso diferente → pendência; falha depois de "criar cadastros" → nenhuma marca criada.

### P1-10 — Criação silenciosa de marca e raça no adapter

- **Confirmação:** C.
- **Evidência:** `resolveRegistryId` insere na store (`weighingDataAdapter.js:54-63`) e é usado no Cadastro e na edição (`:339-340,414-415`); `resolveInBatch` faz o mesmo na importação (`:496-506,640-641`), sem `registry.write` e sem auditoria. O resumo `noSilentRegistryCreation: true` cobre só a página e o domínio (`scripts/verify-import-selection.mjs:69-82`; `scripts/verify-operational-customization.mjs:241-257`). O comentário em `LancamentoPesagensIndividuais.jsx:1003-1004` afirma que o adapter recusa, com códigos que não existem.
- **Cenário de falha:** uma importação JSON (IMP-2), que não tem o filtro da página, cria "NELORE " e "NELORE" como cadastros distintos, sem autor.
- **Mitigação:** o adapter nunca cria cadastro; texto não resolvido vira erro ou pendência; criação só pelo `masterRegistryService`, com `registry.write`, dentro da transação da importação.
- **Gate:** `import:reconcile:verify`, bloco de cadastros, no nível do adapter: IMP-2 com marca desconhecida → recusada e `marcas` sem linha nova; `createEntry` de Cadastro com texto desconhecido e sem `marca_id` → recusado. Ajuste de `import:selection:verify` para o resumo refletir o adapter.

### P1-11 — Importação retroativa: `animalLotes`, movimentos e sessões

- **Confirmação:** C.
- **Evidência:** a importação só abre e fecha lotes de forma incremental, sem reconstrução (`weighingDataAdapter.js:616-631`). Um retroativo fecha o lote aberto com `fim` anterior ao `inicio` (`health.js:116` acusa). `movimentosAnimais` só recebe inserções (`:357-371,632-636`) e não é cancelado junto com a pesagem (`:759-773`; `health.js:108`). Dia com sessão `FECHADA` ganha outra sessão `ABERTA` (`:318-329,597-602`), contra a ADR-030, que também diz que sessões de importação nascem `FECHADA`.
- **Cenário de falha:** a importação de um histórico antigo sobre animais já lotados deixa períodos de lote invertidos, e o relatório operacional mostra o lote errado. Uma importação num dia já fechado muda o Fechamento sem aviso.
- **Mitigação:** `rebuildAnimalLotProjection` por animal afetado, dentro da transação; movimentos reconstruídos ou cancelados junto com o evento; política de dia fechado (D-7).
- **Gate:** `import:retroactive:verify` (novo, Q): evento importado antes do período de lote atual → nenhum `fim < inicio` e `logicalIntegrity` sem issues; importação em dia fechado → recusa ou pendência; cancelar uma Saída → movimento cancelado.

### P1-12 — Desempenho da importação e do recálculo total em 36 mil/250 mil

- **Confirmação:** C (desenho) / E (custo).
- **Evidência:** dentro da transação a importação lê `marcas`, `racas`, `propriedades`, `animais`, `animalIdentificadores`, `pesagens`, `sessoesPesagem` e `animalLotes` inteiras (`weighingDataAdapter.js:487-493,508-510,525-527`), faz uma busca por id por linha (`:478-484`) e, por animal afetado, lê as pesagens e `categoriasAnimal.toArray()` (`:219,235,650`). Depois, `recalculateAllWeightSeries` lê a base inteira (`weighingService.js:113,152-153`), gera patch para todo evento sem comparar valores (`weighingSeries.js:36-41`) e atualiza linha a linha, trocando `updated_at` (`weighingDataAdapter.js:703-707`). A exclusão pelo Lançamento e pela Relação também dispara o recálculo total (`animalHistoryService.js:22`; `weighingService.js:140`). O JSON da IMP-2 chega pelo IPC sem limite de tamanho (`electron/ipc/dialogIpc.cjs:43-53`); o CSV é lido inteiro no renderer (`PesagensIndividuais.jsx:357,497`). **Nenhuma medição de importação existe** (`docs/evidence/program-2.0/phase-01/perf/BASELINE.md:6-23`). Referência: o recálculo total por gravação custava 3,2 s p95 no Chromium com 36 mil e 64,5 s no Node com 250 mil (`docs/evidence/f0-baseline/BASELINE.md:13,27`); a F1 removeu isso só do `createEntry` (`docs/arquitetura-produto/F1-STATUS.md:16-19`).
- **Cenário de falha:** importar 5 mil eventos numa base de 250 mil trava a janela por dezenas de segundos ou minutos. O "Desfazer" do Lançamento custa o mesmo.
- **Mitigação:** recalcular só as chaves afetadas (tornar `recalculateWeightSeriesForKeys` pública, ler pelo índice `animal_id` e gravar só as linhas cujo valor mudou); resolver identidade por índice, em lotes (`anyOf`); dry-run sem gravação, com progresso; blocos com checkpoint por grupo de animais (atomicidade por animal) quando o arquivo passar do orçamento; exclusão pelo Lançamento recalcula só o animal.
- **Gate:** `perf:import:verify` (novo; 36 mil em F, 250 mil em R), registrando tempo e heap. Em Q, com massa pequena, uma asserção determinística: depois de importar N eventos de k animais, só as pesagens desses k animais têm `updated_at` alterado; o mesmo depois de um "Desfazer" no Lançamento, para um animal. Orçamentos fixados na primeira medição (referências atuais: salvar p95 < 250 ms e abrir o Lançamento < 1 s com 36 mil, `docs/evidence/program-2.0/phase-00/PERFORMANCE.md:57`).

### P1-13 — Persistência do contexto do Lançamento

- **Confirmação:** C.
- **Evidência:** o contexto vive só em `useRef` (`LancamentoPesagensIndividuais.jsx:398`). Quando os catálogos chegam, os três contextos são reinicializados e os padrões reaplicados (`:319-321`). `sessoesPesagem` já tem `marca_padrao_id`, `apartacao_padrao_id`, `tipo_manejo_padrao` e `snapshot`, sempre gravados nulos (`weighingDataAdapter.js:104-107`).
- **Cenário de falha:** um contexto persistido sem chave de usuário e data leva o comprador ou o motivo de ontem, ou de outro operador, para os lançamentos de hoje. Ou os padrões chegam depois de o operador já ter alterado a marca e sobrescrevem a escolha.
- **Mitigação:** contexto persistido por usuário + empresa + data + tipo (ou na sessão), contendo só os campos da lista de contexto; padrões aplicados só quando não há contexto persistido; invalidação no logout e na troca de dia.
- **Gate:** `launch:context:verify`: catálogos chegando depois da alteração não sobrescrevem; outro usuário não herda o contexto; troca de dia; o contexto persistido nunca contém campo de `dadosDoAnimal`.

### P1-14 — Gates por regex na página do Lançamento quebram com a refatoração

- **Confirmação:** C.
- **Evidência:** `scripts/verify-ui-consistency.mjs` lê o arquivo do Lançamento (`:20`); também `verify-operational-customization.mjs:177-223`, `verify-animal-history-integrity.mjs:60-83` e `verify-weighing-access.mjs:88-100` (`CURRENT-LAUNCH-FLOW.md:666`). Nove scripts citam o arquivo (grep em `scripts/`).
- **Cenário de falha:** a extração de P0-09 muda os nomes, os gates quebram e as asserções são apagadas sem substituto.
- **Mitigação:** extrair primeiro a lógica para módulos puros com gates de comportamento; depois trocar cada asserção textual pela equivalente comportamental, no mesmo commit.
- **Gate:** `launch:context:verify` e revisão; inventário das asserções substituídas registrado em evidência.

### P1-15 — Exportação sem contrato

- **Confirmação:** C.
- **Evidência:** o CSV da Relação não escapa campos (`PesagensIndividuais.jsx:742`) e não tem Tipo nem Motivo (`:721`); o do Lançamento só troca `;` (`LancamentoPesagensIndividuais.jsx:1183-1188,1263`); o do Fechamento grava peso ausente como `0,00` (`src/pages/FechamentoDia.jsx:128`); o "Backup do dia" não tem hash e leva valores comerciais (`FechamentoDia.jsx:133-136`); o CSV da Manutenção sai com `operador` e `origem` vazios (`backupService.js:100`); a permissão existe só na UI (`PesagensIndividuais.jsx:166`). O CSV canônico já existe (`src/modules/reporting/infrastructure/exporters/csvExporter.js:16-36`; `src/modules/reporting/domain/reportFormatting.js:62-97`). Nenhum gate cobre as exportações das telas (`STATE-BEFORE.md:217-220`).
- **Cenário de falha:** uma observação com `;` desloca as colunas e a reimportação grava o peso na coluna errada, ou rejeita a linha. O CSV "amigável" reimportado perde Tipo e Motivo.
- **Mitigação:** dois contratos versionados: **amigável** (escape e proteção contra fórmula canônicos, permissão verificada no serviço) e **reimportação** (cabeçalhos estáveis em snake_case, datas ISO, decimal declarado, `id`, `animal_id`, número + `marca_id`, `tipo_manejo`, `motivo_saida`, `causa_morte_id`, ordem no dia, versão do contrato).
- **Gate:** `export:roundtrip:verify` (novo, Q): exportar para reimportação → dry-run na mesma base dá 0 novos e 0 pendências; em base vazia com os cadastros → mesma série e mesmos derivados; campos com `;`, aspas, quebra de linha e `=` preservados ou protegidos; CONSULTA sem `commercial.values` → nenhuma coluna comercial em nenhum formato.

### P1-16 — Leitura do CSV só em UTF-8

- **Confirmação:** C.
- **Evidência:** `reader.readAsText(file, 'UTF-8')` (`PesagensIndividuais.jsx:497`); a opção de criar cadastros cria a partir do texto lido (`:520-532`).
- **Cenário de falha:** um CSV salvo pelo Excel pt-BR em Windows-1252 com a opção de criar cadastros ligada cria "NELORE M�CHO".
- **Mitigação:** detectar BOM e UTF-8 inválido; ler como Windows-1252 com aviso, ou recusar; nunca criar cadastro contendo U+FFFD.
- **Gate:** `import:reconcile:verify`: arquivo Windows-1252 com "Apartação" e "É" → lido corretamente ou recusado com mensagem; nenhum cadastro com U+FFFD.

### P1-17 — `reports:sensitive-data:verify` instável pode virar falha fixa

- **Confirmação:** C.
- **Evidência:** `SECRET_VALUES` contém `'3000'` (`scripts/verify-reports-sensitive-data.mjs:24`) e a busca é por substring no conteúdo inteiro, manifesto incluído (`:53`). O manifesto traz `emissionId` aleatório e um carimbo UTC no nome do arquivo (`STATE-BEFORE.md` §7, `reportExportService.js:27-30,43,87,97-99`).
- **Cenário de falha:** a missão mexe na população ou nas colunas compartilhadas com a Relação, o corpo muda e o novo `contentSha256` contém `3000`. O gate passa a falhar sempre.
- **Mitigação:** comparar os segredos célula a célula no corpo (sem o manifesto), ou fixar `emissionId` e horário dentro do gate.
- **Gate:** o próprio gate (ajuste): `emissionId` com `3000` e horário 10:30:00 injetados → passa; controle negativo com vazamento real → falha.

### P1-18 — Painel de Sanidade e custo de abertura do Lançamento

- **Confirmação:** C (carga atual) / E (efeito do painel).
- **Evidência:** a tela carrega todas as pesagens da empresa (`LancamentoPesagensIndividuais.jsx:533-554`). Abrir o Lançamento com 36 mil já custa 2 866 ms p95 no Node (`docs/evidence/program-2.0/phase-01/perf/BASELINE.md:10`), e a reconstrução do índice leva 883 ms p95 no Chromium (`phase-00/PERFORMANCE.md:38`). O espaço vazio para o painel está em `:1384-1386`.
- **Cenário de falha:** o painel lê todas as aplicações com `toArray()` e a abertura passa de 1 s com folga.
- **Mitigação:** o painel lê aplicações pelo índice `animal_id` ou `sessao_id`, sob demanda; só o catálogo pequeno fica em memória.
- **Gate:** `perf:contract:verify` (ajuste) com massa de aplicações; medição de abertura do Lançamento no Chromium com 36 mil e aplicações, abaixo de 1 s.

---

## 5. Riscos P2

| ID | Risco | Evidência | Mitigação | Gate |
|---|---|---|---|---|
| P2-01 | `readBackup` permissivo: `allowLegacy` nunca é `false`, e `DEXIE_BACKUP_005` lê só `manifest.dbVersion` | `backupService.js:123,138-153` | Parâmetros explícitos por chamador; checar também o `dbVersion` do topo | `storage:backup:verify` (ajuste): backup sem manifesto com `dbVersion` maior é recusado |
| P2-02 | Operações sem linha em `auditoria` (importação como operação, restauração, limpeza, reset, recálculo); `importacoes` sem `usuario_id`; quatro gravadores de auditoria; reset sem reverificação de senha, contra a ADR-032 | `backupService.js:29-39,250,277,305`; `weighingDataAdapter.js:653-659`; `weighingService.js:181-185`; `maintenanceService.js:132-136`; `08-DECISOES-ARQUITETURAIS.md:212-214` | Linha de auditoria com ator para importação, restauração e limpeza; `usuario_id` em `importacoes`; aplicações auditadas pelo mesmo gravador das pesagens | `import:reconcile:verify` exige a auditoria da operação |
| P2-03 | Dry-run da Manutenção enganoso: "Válidos" sempre "—" e "Conflitos" sempre 0; o nome do arquivo não chega a `importacoes` | `ManutencaoSistema.jsx:570,573` × `backupService.js:324,348` | Alinhar os campos; repassar `fileName` | `maintenance:ui:verify` (ajuste) |
| P2-04 | O relatório da importação não serve para conciliar: linha do erro ≠ linha física; só 10 erros exibidos, sem exportação | `csvParser.js:51` (conforme `CURRENT-IMPORT-EXPORT-CONTRACT.md` §3.2); `PesagensIndividuais.jsx:1461` | Relatório por linha física, exportável | `import:reconcile:verify` |
| P2-05 | Nenhuma ação separa "pesar" de "aplicar medicamento"; o gate fixa 28 ações | `permissionService.js:18-48`; `scripts/verify-auth-permissions.mjs:84` | Decidir na ADR-049 (ações existentes ou nova ação) | `auth:permissions:verify` só muda se houver ação nova |
| P2-06 | Nome de módulo `health` ambíguo e diretório vazio não versionado | `src/modules/health/application/`; `src/storage/indexedDb/health/health.js` | Nome explícito para o módulo de sanidade | Revisão |
| P2-07 | `logicalIntegrity` lê as stores inteiras várias vezes e tem o contrato v7 fixo; aplicações aumentam o custo | `health.js:24,27-35,45-56` | Leitura única por store; contrato por versão (P0-03) | `perf:backup:verify` registra também o tempo da integridade |
| P2-08 | Resíduos: `payloadsLimpos` nunca incrementado; derivados gravados também no topo da linha; `GerenciarSaidasDialog` órfão; comentário falso sobre recusa de marca | `v7Backfill.js:578-598`; `weighingDataAdapter.js:691-696`; `CURRENT-LAUNCH-FLOW.md` D-01; `LancamentoPesagensIndividuais.jsx:1003-1004` | Limpar na frente correspondente | Revisão |
| P2-09 | A branch carrega trabalho de relatórios não revisado (`readByKeys`, listas preguiçosas, checklist 1.3.0) | `STATE-BEFORE.md:135-142` | Commits da missão separados por frente; não misturar com R5/R6 | Revisão de diff por frente |
| P2-10 | Documentação divergente (§9) | §9 | Atualizar junto com cada ADR ou frente | `docs:user:verify` (ajuste) quando tocar docs de usuário |

---

## 6. Decisões que precisam existir antes do código

| ID | Decisão | Por quê | Riscos |
|---|---|---|---|
| D-1 | **ADR-049 — Sanidade:** substitui ADR-007/022; limites da ADR-019 (catálogo sem estoque; carência informativa ou bloqueante); nomes e índices das stores; vínculos (`animal_id`, `pesagem_id` opcional, `sessao_id`, lote/apartação); permissões; destino do legado | ADRs vigentes proíbem a volta; gates dependem dos nomes | P0-06, P0-07, P0-08, P1-04, P2-05 |
| D-2 | Numeração: v8 = Sanidade (+ metadados de importação) e v9 = comercial, ou v8 conjunta | ADR-034 reserva a v8; o código antecipa | P1-05, P0-03, P0-04 |
| D-3 | **DEC-031 — categoria automática:** só no Cadastro, ou reclassificação no Manejo (regra de 16/09) | Contradição entre a missão, o código e dois gates | P0-13 |
| D-4 | Lista campo a campo de **contexto × dado do animal** (valor total por animal? lote manual? categoria manual por lote? produtos e doses?) | A mitigação de P0-09 depende dela | P0-09, P1-13 |
| D-5 | Política de identidade: primeiro evento de animal inexistente = Cadastro ou pendência; número reaproveitado depois da saída; SN na importação; marca vazia | O resolvedor canônico precisa dessas regras | P0-10, P0-11 |
| D-6 | Política dentro do dia: repesagem, um evento por animal por dia, Manejo + Saída no mesmo dia | Ordem hoje não determinística | P1-06 |
| D-7 | Dia com sessão fechada (ADR-030): recusar, pendência ou reabrir com motivo; sessões de importação | Código diverge da ADR | P1-08, P1-11 |
| D-8 | Formato de backup para bases grandes, se a medição exigir | Pode mudar `BACKUP_FORMAT_VERSION` | P0-05, P1-03 |
| D-9 | Saneamento dos animais já importados sem Cadastro | Beco sem saída no Lançamento | P0-11 |

---

## 7. Ordem recomendada de tratamento

1. **Etapa 0 — base confiável:** P0-01 e P1-17. Saída: `test:full` completo e verde registrado.
2. **Etapa 1 — decisões:** D-1 a D-9 registradas (ADR-049, DEC-031 e seguintes).
3. **Etapa 2 — fundação de storage, ainda sem stores novas:** P0-02 (fail-closed), P0-03 (cadeia provada com backfill v8 fictício), P0-05 (medição), P1-01 (guarda de downgrade), P1-02, P1-03.
4. **Etapa 3 — domínio canônico compartilhado:** P0-11, P0-10 (resolvedor), P0-12, P0-13, P1-06, P1-07, P1-08. Toda regra vira função pura com gate de paridade antes de ser usada pela importação.
5. **Etapa 4 — Lançamento:** P1-14 (extração com gates de comportamento), P0-09, P1-13.
6. **Etapa 5 — Sanidade:** P0-04 (v8), P0-06, P0-07, P0-08, P1-04, P1-05, P1-18. Se a importação também precisar de stores novas no mesmo release, fazer **uma** subida de versão com as duas.
7. **Etapa 6 — Importação:** P1-09, P1-10, P1-11, P1-16, P1-12, P2-04.
8. **Etapa 7 — Exportação:** P1-15.
9. **Release:** `perf:backup:verify` e `perf:import:verify` com 250 mil; teste físico de atualização RC1 → build v8 com dados reais; checklist sem reinstalação de versão anterior (P1-01).

---

## 8. Mapa de gates

### 8.1 Gates novos (propostos; nenhum existe)

| Gate | Script proposto | Suíte | Riscos | Pré-requisito |
|---|---|---|---|---|
| `auth:audit-actor:verify` | `scripts/verify-audit-actor.mjs` (existente, sem script npm) | Q | P0-01 | Alinhar ao fail-closed |
| `migration:fail-closed:verify` | `scripts/verify-migration-fail-closed.mjs` | Q | P0-02 | — |
| `migration:chain:verify` | `scripts/verify-migration-chain.mjs` | Q | P0-03, P1-05 | Coordenador em cadeia |
| `perf:backup:verify` | `scripts/verify-backup-performance.mjs` | F (36 mil) / R (250 mil) | P0-05, P2-07 | Massa com auditoria |
| `storage:downgrade-guard:verify` | `scripts/verify-downgrade-guard.mjs` | Q | P1-01 | Guarda no coordenador |
| `sanity:launch-atomic:verify` | `scripts/verify-sanity-launch-atomic.mjs` | Q | P0-08 | D-1, stores v8 |
| `sanity:legacy-import:verify` | `scripts/verify-sanity-legacy-import.mjs` | Q | P1-04 | D-1 |
| `launch:context:verify` | `scripts/verify-launch-context.mjs` | Q | P0-09, P1-13, P1-14 | D-4, módulo puro extraído |
| `weighing:identity:verify` | `scripts/verify-weighing-identity.mjs` | Q | P0-11 | D-5 |
| `weighing:atomic-recalc:verify` | `scripts/verify-weighing-atomic-recalc.mjs` | Q | P0-12 | — |
| `weighing:rule-parity:verify` | `scripts/verify-weighing-rule-parity.mjs` | Q | P1-06, P1-08, P0-13 | D-3, D-6, D-7 |
| `import:reconcile:verify` | `scripts/verify-import-reconcile.mjs` | Q | P0-10, P1-09, P1-10, P1-16, P2-02, P2-04 | Resolvedor canônico |
| `import:retroactive:verify` | `scripts/verify-import-retroactive.mjs` | Q | P1-11 | D-7 |
| `perf:import:verify` | `scripts/verify-import-performance.mjs` | Q (asserção de `updated_at`) / F (36 mil) / R (250 mil) | P1-12 | Recálculo por chave |
| `export:roundtrip:verify` | `scripts/verify-export-roundtrip.mjs` | Q | P1-15 | Contratos de exportação |

### 8.2 Gates existentes que mudam

| Gate | Arquivo:linha | Mudança | Riscos |
|---|---|---|---|
| `maintenance:ui:verify` | `scripts/verify-maintenance-ui-contract.mjs:80` | Asserção alinhada à matriz de permissões; campos do dry-run | P0-01, P2-03 |
| `storage:backup:verify` | `scripts/verify-dexie-backup.mjs:115,145,157-158` | Levar para Q; v7 + v8; caso backup v5; classificação de stores; metadados do pré-migração | P0-01, P0-03, P0-06, P1-03, P2-01 |
| `storage:import-restore:verify` | `scripts/verify-dexie-import-restore.mjs:101,122` | Levar para Q; restore com falha no meio da cadeia; stores zeradas no dry-run | P0-01, P0-03, P1-02 |
| `weighing:mapper:verify` | `scripts/verify-weighing-mapper.mjs:58-65` | Levar para Q; **proibições mantidas** | P0-01, P0-07 |
| `storage:dexie:verify` | `scripts/verify-dexie-storage.mjs:33-35` (manter), `:59` (parametrizar) | Snapshot SHA de `STORES_V5/V6/V7`; abertura v7 → v8 com backup; nomes v5 proibidos | P0-04, P0-06 |
| `migration:v7:verify` | `scripts/verify-v7-migration.mjs:148,169,295,345,458-474` | Roda dentro da cadeia; contrato B11 mantido (`:262-270,428-431`) | P0-03, P1-04 |
| `release:version-contract:verify` | `scripts/verify-version-contract.mjs:170-171` | Automático com `DATA_BUILD_ID = 'schema-v8'` | P0-04 |
| `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs:20,185,233` | Contrato positivo de Sanidade; presença da ADR-049 | P0-07, P1-14 |
| `registry:ui:verify` / `registry:master:verify` | `scripts/verify-registry-ui.mjs:60-79`; `scripts/verify-master-registry.mjs:62` | Páginas e definições novas | P0-07 |
| `category-projection:verify` / `animal:history-integrity:verify` | `scripts/verify-category-projection.mjs:26-29`; `scripts/verify-animal-history-integrity.mjs:131-140` | Regra decidida em D-3 | P0-13, P0-11 |
| `weighing:calculations:verify` | `scripts/verify-weighing-calculations.mjs` | Peso ausente ignorado; referência da série igual à da projeção | P1-06, P1-07 |
| `import:selection:verify` | `scripts/verify-import-selection.mjs:69-82` | Resumo `noSilentRegistryCreation` passa a cobrir o adapter | P1-10 |
| `reports:sensitive-data:verify` | `scripts/verify-reports-sensitive-data.mjs:24,53` | Comparação célula a célula no corpo | P1-17 |
| `perf:contract:verify` | `scripts/verify-perf-baseline-contract.mjs:120,195` | Massa com aplicações; proibições de payload mantidas | P1-18 |
| Mantidos sem mudança | `scripts/verify-dexie-storage.mjs:18-39`; `scripts/verify-payload-allowlist.mjs:24-30` | Provam que a v5 não volta e que a sanidade não entra no payload | P0-06, P0-07 |

---

## 9. Divergências e correções registradas nesta revisão

| # | Documento | Afirma | Código (prevalece) |
|---|---|---|---|
| 1 | `CURRENT-SCHEMA.md:21` e §4.2 | O backup pré-migração é fail-closed (sem porta, falha de gravação ou SHA divergente bloqueiam) | Vale só para erros com código. Erro em `preMigrationBackup.js:64-66`, em `inspectDatabase` ou em `recordPendingMigrationBeforeOpen` chega sem código a `src/api/db.js:71-73`; o app renderiza e a primeira leitura abre o banco na versão nova (`db.js:74-80`). Ver P0-02. **Nenhum documento do preflight registra isso** |
| 2 | `CURRENT-SCHEMA.md` §11.3 | Reimportar depois de "Limpar dados operacionais" duplica pesagens de Manejo | **Incorreto.** "Limpar" também apaga `pesagens` (`backupService.js:272-276`), então a reimportação recria os registros uma vez. Os vetores reais de duplicação são o arquivo salvo de novo com outro hash e arquivos sobrepostos (P1-09) |
| 3 | ADR-020 (`08-DECISOES-ARQUITETURAIS.md:133-135`) | Unicidade VISUAL verificada no serviço, dentro da transação | Só diagnóstico (`health.js:87-104`); a importação resolve com "último vence" (`weighingDataAdapter.js:508-523`) |
| 4 | ADR-030 (`08-DECISOES-ARQUITETURAIS.md:199-203`) | Sessão fechada recusa eventos no serviço; sessões de importação nascem `FECHADA` | Nada é recusado; importação e lançamento criam sessão `ABERTA` (`weighingDataAdapter.js:96-114,318-329,597-602`) |
| 5 | ADR-028 (`08-DECISOES-ARQUITETURAIS.md:186-192`) | Categoria por faixa etária; sugestão nunca sobrescreve valor informado | Categoria por faixa de peso; o carimbo sobrescreve `era` de animal automático (`weighingDataAdapter.js:197-207`) |
| 6 | ADR-032 (`08-DECISOES-ARQUITETURAIS.md:212-214`) e comentário `backupService.js:286-288` | Reset exige a senha do usuário atual | Só papel + texto `RESET` (`maintenanceService.js:132-136`) |
| 7 | ADR-022 (`08-DECISOES-ARQUITETURAIS.md:149-150`) | Sanidade exportada para `docs/evidence/program-2.0/` | Exportada para `<dataDir>/exports/` na máquina do usuário (`v7Backfill.js:674-676`) |
| 8 | ADR-019 (`08-DECISOES-ARQUITETURAIS.md:128-129`) | "Nada de medicamentos"; `SequenciaBrincos` vira visão do `identifierInventoryService` | A missão reintroduz medicamentos (nova ADR necessária); o serviço não existe |
| 9 | `docs/arquitetura-produto/F1-STATUS.md:16-19` | Recálculo por `animal_id` | Verdade para criar, editar e excluir um registro; importação, edição coletiva e exclusão pela tela continuam com recálculo total (`weighingService.js:113,133,140`; `animalHistoryService.js:22`) |
| 10 | Memória `pesagens-categoria-por-peso` (16/09) × missão | "Manejo reclassifica" × "categoria automática só no Cadastro" | O código e os gates seguem a memória (P0-13); decisão pendente D-3 |
| 11 | Comentário `LancamentoPesagensIndividuais.jsx:1003-1004` | O adapter recusa marca/raça não cadastradas | O adapter cria (`weighingDataAdapter.js:54-63,339-340`); os códigos citados não existem |
| 12 | `import:selection:verify` → `noSilentRegistryCreation: true` | A importação não cria cadastro em silêncio | Vale para a página e o domínio; o adapter cria (`weighingDataAdapter.js:496-506,640-641`) |
