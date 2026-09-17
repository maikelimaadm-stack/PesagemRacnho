# STATE-BEFORE — preflight da reconciliação operacional (Sanidade · Lançamento · Importação/Exportação)

**Levantado em:** 17/09/2026, 06:24–06:45 (UTC−4) · **Branch:** `program/sanity-launch-import` · **HEAD:** `d44d5b9`
· **Ambiente:** Windows 11 Home 10.0.26200, Node v24.18.0, npm 11.16.0, git 2.55.0.windows.3.

**Regra desta coleta:** somente leitura. Nenhum arquivo de código, gate, configuração ou documento
foi alterado; a única escrita no repositório é este documento. Não houve `build`, `dist`,
servidor, instalação nem `git` que altere estado. Sondas auxiliares (seção 7) rodaram no
scratchpad da sessão, fora do repositório, com `fake-indexeddb` em memória. `git status --short`
continuou vazio depois de todos os gates e sondas.

A fonte da verdade é o código em `d44d5b9`. Quando um documento antigo diverge, a divergência
está dita explicitamente (seção 10).

---

## 0. Resumo executivo

| Item | Estado real |
|---|---|
| Árvore de trabalho | **limpa** (`git status --short` e `git diff --stat` vazios) |
| Branch atual | `program/sanity-launch-import`, **no mesmo commit** de `program/reporting-1.3.0` (`d44d5b9`), sem commits próprios |
| Versão do app | **1.2.0** (`package.json:6`), esquema Dexie **7**, backup formato **3**, manifesto de release formato **2** |
| Tags | `v1.1.17-baseline`, `v1.1.18`, `v1.2.0-rc1` (anotadas). Não existe `v1.2.0` nem `v1.3.0-rc1` |
| Programa de relatórios | **pausado** no checkpoint `d44d5b9` (decisão de produto de 17/09/2026); há 31 commits depois de `v1.2.0-rc1` |
| `npm.cmd run test:quick` | **VERDE**: 56 de 56 comandos (lint + 55 gates/selftests), saída 0, 1 min 43 s (06:26:25 → 06:28:08) |
| Gates que só estão no `test:full` (rodados à parte, sem build/e2e) | 6 verdes e **1 VERMELHO**: `maintenance:ui:verify` (asserção desatualizada, seção 6) → **`test:full` está vermelho hoje** |
| Scripts `verify-*.mjs` fora do `package.json` | 4; `verify-audit-actor.mjs` **falha** (seção 6.3) |
| `reports:sensitive-data:verify` | falha rara conhecida **confirmada**, com uma correção: o SHA-256 que está no JSON é determinístico; os vetores aleatórios são o `emissionId` (UUID) e o `fileName` (carimbo UTC + prefixo do UUID) (seção 7) |
| Sanidade | retirada do produto (ADR-022); **6 gates hoje impedem a volta** do jeito antigo (seção 9.1) |

---

## 1. Git

### 1.1 `git status --short`

```text
(vazio — árvore limpa; conferido antes e depois do test:quick e dos gates avulsos)
```

### 1.2 `git branch --show-current`

```text
program/sanity-launch-import
```

### 1.3 `git log --oneline --decorate -20`

```text
d44d5b9 (HEAD -> program/sanity-launch-import, program/reporting-1.3.0) chore(reporting): checkpoint before pausing the reporting program
00e6731 test(operations): check closing pendencies through the shared rule
075bfc5 fix(security): fail closed without session, strip commercial input, guard backups
16cd433 fix(reporting): label filters, filter descriptions, template safety, screen reuse
fb689bd fix(reporting): data review fixes (legacy identity, shipments, stays, arrobas)
e9ec822 style(reporting): dark theme contrast for catalog and report screen
e990035 feat(reporting): add xlsx emission
151cbc9 test(reporting): catalog gate with hand-checked family results
e6e3af0 feat(reporting): add remaining report families
8a0d57b refactor(fechamento): shared pendency rules and canonical aggregation
2005e46 test(reporting): R4 print and pdf contract gates with real Electron evidence
3a57237 feat(reporting): add pdf emission
4cf8c58 feat(reporting): add professional print output
adedb72 docs(reporting): R3 catalog, templates and export evidence
0ec4311 style(reporting): use explicit unicode escapes in accent-stripping regex
b4a1143 test(reporting): R3 gates for templates, permissions, csv/json parity and sensitive data
700d2fe feat(reporting): add professional report catalog and report screen
a123b20 feat(reporting): add canonical csv and json exports
a38ca48 feat(reporting): add saved report templates
18a4885 docs(reporting): R2 grouping and aggregates evidence
```

### 1.4 `git diff --stat`

```text
(vazio)
```

### 1.5 Branches locais (`git for-each-ref refs/heads`)

| Branch | Commit | Data | Observação |
|---|---|---|---|
| `main` | `77eeb3b` | 14/09 | = `v1.1.17-baseline`; nada da 1.1.18/1.2.0 foi integrado em `main` |
| `release/1.1.18` | `4d81b50` | 14/09 | = `v1.1.18` |
| `preview/1.2.0-demo` | `8977497` | 15/09 | — |
| `program/pesagens-master-evolution` | `a465123` | 16/09 | registro do RC1 (`docs(release): 1.2.0-rc1 candidate record`), um commit depois da tag |
| `program/reporting-1.3.0` | `d44d5b9` | 17/09 | programa de relatórios pausado |
| `program/sanity-launch-import` | `d44d5b9` | 17/09 | **atual**; criada a partir do checkpoint, sem commits próprios |

`git rev-list --count HEAD` = 60; `main..HEAD` = 59 commits. `git stash list` vazio.

### 1.6 Tags (`git tag --list`)

| Tag | Commit | Data da tag | Mensagem |
|---|---|---|---|
| `v1.1.17-baseline` | `77eeb3b` | 14/09 17:58 | Baseline 1.1.17 antes do Programa 2.0 |
| `v1.1.18` | `4d81b50` | 14/09 20:20 | Marco 1.1.18 — baseline verde + contrato de versão (Dexie 6, backup 2); sem instalador; teste físico NÃO EXECUTADO |
| `v1.2.0-rc1` | `3b27958` | 16/09 20:58 | 1.2.0 release candidate 1 (unsigned diagnostic; physical test pending) |

`v1.2.0-rc1` é ancestral de `HEAD`. `git log v1.2.0-rc1..HEAD` = **31 commits**: `a465123` (registro do RC1),
os commits R1–R6 do programa de relatórios, `075bfc5` (falha fechada sem sessão, remoção de valores
comerciais digitados sem permissão, proteção de backup), `00e6731` e o checkpoint `d44d5b9`.
Consequência: **o instalador RC1 não contém** as correções de segurança de `075bfc5` nem nada do programa de relatórios.

---

## 2. Versões

| Eixo | Valor | Onde está declarado |
|---|---|---|
| APP_VERSION | `1.2.0` | `package.json:6`; `package-lock.json:3` e `:9` (`packages[""]`); fallback em `src/lib/appVersion.js:5`; reexportado em `src/versioning/versionInfo.js:15,38` |
| DB_SCHEMA_VERSION | `7` | `src/storage/indexedDb/schema.js:6` (`DB_VERSION = 7`) → `src/versioning/versionInfo.js:19` |
| Nome do banco | `pesagens-individuais` | `src/storage/indexedDb/schema.js:5` |
| BACKUP_FORMAT_VERSION | `3` | `src/versioning/versionInfo.js:20` |
| Identificador do formato de backup | `pesagens-individuais-indexeddb-backup` | `src/storage/indexedDb/schema.js:7` |
| RELEASE_MANIFEST_VERSION | `2` | `src/versioning/versionInfo.js:21` |
| UI_CONTRACT_VERSION | `ModeloBase1-2.0` | `src/versioning/versionInfo.js:22` |
| DATA_CONTRACT_VERSION | `2` | `src/versioning/versionInfo.js:23` |
| DATA_BUILD_ID | `'schema-v7'` (literal, não interpolado de propósito) | `src/versioning/versionInfo.js:24-27` |
| UI_BUILD_ID / UI_VERSION | `d17d2r33-design-lancamento-2026-09-10` / `D.17D.2R33` | `src/components/modelobase1/uiBuildInfo.js:1,3` |
| Manifesto de emissão de relatório | `MANIFEST_FORMAT_VERSION = 1` | `src/modules/reporting/application/reportExportService.js:21` |

Stores vigentes (v7): 23 — `src/storage/indexedDb/schema.js:51-82`; confirmado pelo gate `storage:dexie:verify` (`"stores": 23, "dbVersion": 7`).
Histórico de versões Dexie no código: `db.version(5)`, `db.version(6)` com upgrade que apaga as stores e campos
de sanidade, `db.version(7)` — `src/storage/indexedDb/db.js:28-50`.

Qualquer mudança de esquema (ex.: stores de Sanidade) mexe em `DB_VERSION`, no literal `DATA_BUILD_ID`
(`versionInfo.js:27`, cuja coerência é verificada por `release:version-contract:verify`), provavelmente em
`BACKUP_FORMAT_VERSION`, e exige migração/gate novos.

---

## 3. Programa de relatórios: pausado no checkpoint `d44d5b9`

- Registro da pausa: **somente** na mensagem do commit `d44d5b9` (17/09/2026 06:23:59): “Paused by product decision
  (2026-09-17). Work in progress kept as-is”. Itens em andamento citados: `readByKeys` (leitura única da store para
  conjuntos grandes de chaves; 36k: de 94 s para 2–4 s), listas de valores únicos preguiçosas nos filtros, scripts de
  benchmark, rascunho da documentação de relatórios e **rascunho do checklist 1.3.0 “(not reviewed)”**.
- Arquivos do checkpoint (24): `docs/release/1.3.0/RELEASE-CHECKLIST.md`, `docs/reporting/*.md` (10 contratos),
  `docs/user/RELATORIOS.md`, `scripts/measure-report-performance.mjs`, `scripts/verify-reports-performance.mjs`,
  `src/modules/perf/reportBench.js`, `src/modules/reporting/infrastructure/reportSources/readByKeys.js` e ajustes em
  `MakColumnMenu.jsx`, `MakFilterPill.jsx`, `ReportView.jsx`, `PesagensIndividuais.jsx` e nas fontes de relatório.
- Nenhum documento no repositório registra a pausa (busca por “paus” em `docs/reporting`, `docs/release/1.3.0`,
  `docs/user/RELATORIOS.md` e `docs/evidence/reporting-program` não encontra nada sobre isso).
- Evidências: `docs/evidence/reporting-program/` tem só `R0-preflight`, `R0-foundation-fixes`, `R1`, `R2`, `R3`, `R4`.
  Não há pasta de evidência de R5 (famílias/desempenho) nem R6 (XLSX), embora os commits existam (`e6e3af0`, `e990035`).
  O script `perf:reports` aponta para `docs/evidence/reporting-program/R5-report-families-performance/bench`
  (`package.json:101`), pasta que não existe.
- `docs/release/1.3.0/RELEASE-CHECKLIST.md`: todos os itens desmarcados; pede versão 1.3.0, mas `package.json` continua 1.2.0
  e o `CHANGELOG.md` não tem bloco `[1.3.0]` nem “Não lançado” (o primeiro bloco é `## [1.2.0] — 2026-09-16`, `CHANGELOG.md:6`).
- `reports:performance:verify` (`package.json:100`, 8 GB de heap) **não** está em `test:quick` nem em `test:full` e não foi rodado.
- Falha rara conhecida em `reports:sensitive-data:verify`: ver seção 7.

---

## 4. Scripts npm relevantes

### 4.1 Suítes

| Script | Composição | Linha |
|---|---|---|
| `test:quick` | 56 comandos encadeados com `&&` (lint + 55 gates/selftests), sem build | `package.json:67` |
| `test:full` | 56 comandos, **inclui `build`** e `e2e:installed:verify:dev` | `package.json:68` |
| `test` | `npm run test:full` | `package.json:69` |
| `storage:all:verify` | 10 gates de storage/migração/payload | `package.json:31` |

Só em `test:full`: `build`, `storage:all:verify` (que traz `storage:backup`, `storage:import-restore`, `storage:ui-contract`),
`weighing:mapper:verify`, `maintenance:ui:verify`, `maintenance:dialog:verify`, `docs:user:verify`, `e2e:installed:verify:dev`.
Só em `test:quick`: os 5 gates de storage avulsos (já contidos em `storage:all`), `packaged:build:selftest`, `docs:user:selftest`.

**Fora das duas suítes:** `packaged:source:verify`, `packaged:ui-build:verify`, `packaged:build:verify`, `e2e:installed:verify`,
`release:signature:verify`, `release:version-contract:selftest`, `reports:performance:verify` e os `diagnostic:*`.

### 4.2 Gates por área (Q = em `test:quick`; F = em `test:full`)

| Área | Script npm | Arquivo | Q | F |
|---|---|---|---|---|
| Storage | `storage:dexie:verify` | `scripts/verify-dexie-storage.mjs` | x | x (via all) |
| Storage | `storage:first-run:verify` | `scripts/verify-dexie-first-run.mjs` | x | x |
| Storage | `storage:ui-contract:verify` | `scripts/verify-dexie-ui-contract.mjs` | — | x |
| Storage | `storage:ui-first-run-persistence:verify` | `scripts/verify-dexie-ui-first-run-persistence.mjs` | x | x |
| Storage | `storage:maintenance-ui-flow:verify` | `scripts/verify-dexie-maintenance-ui-flow.mjs` | x | x |
| Storage | `storage:legacy-detached:verify` | `scripts/verify-no-legacy-storage.mjs` | x | x |
| Storage | `storage:all:verify` | agregado | — | x |
| Migração | `migration:v7:verify` | `scripts/verify-v7-migration.mjs` | x | x |
| Backup | `storage:backup:verify` | `scripts/verify-dexie-backup.mjs` | — | x |
| Backup/Import | `storage:import-restore:verify` | `scripts/verify-dexie-import-restore.mjs` | — | x |
| Pesagem | `weighing:calculations:verify` | `scripts/verify-weighing-calculations.mjs` | x | x |
| Pesagem | `weighing:mapper:verify` | `scripts/verify-weighing-mapper.mjs` | — | x |
| Pesagem | `payload:allowlist:verify` | `scripts/verify-payload-allowlist.mjs` | x | x |
| Pesagem | `category-projection:verify` | `scripts/verify-category-projection.mjs` | x | x |
| Pesagem | `enterprise:hardening:verify` (CSV, números/datas BR, idempotência e cronologia de importação, recálculo retroativo) | `scripts/verify-enterprise-hardening.mjs` | x | x |
| Histórico do animal | `animal:history-integrity:verify` | `scripts/verify-animal-history-integrity.mjs` | x | x |
| Importação | `import:selection:verify` | `scripts/verify-import-selection.mjs` | x | x |
| Auth | `auth:local:verify` | `scripts/verify-local-auth.mjs` | x | x |
| Auth | `auth:access:verify` | `scripts/verify-access-policy.mjs` | x | x |
| Auth | `auth:permissions:verify` | `scripts/verify-auth-permissions.mjs` | x | x |
| Auth | `auth:maintenance-access:verify` | `scripts/verify-maintenance-access.mjs` | x | x |
| Auth | `auth:weighing-access:verify` | `scripts/verify-weighing-access.mjs` | x | x |
| Auth (sem script npm) | — | `scripts/verify-audit-actor.mjs`, `verify-auth-bootstrap.mjs`, `verify-auth-crypto.mjs`, `verify-auth-recovery.mjs` | — | — |
| UI | `ui:locale-dialog:verify` | `scripts/verify-brazilian-format-contract.mjs` | x | x |
| UI | `ui:operational-customization:verify` | `scripts/verify-operational-customization.mjs` | x | x |
| UI | `ui:scrollbar-contract:verify` | `scripts/verify-scrollbar-contract.mjs` | x | x |
| UI | `ui:consistency:verify` | `scripts/verify-ui-consistency.mjs` | x | x |
| UI | `ui:shell-settings:verify` | `scripts/verify-shell-settings-ui.mjs` | x | x |
| UI/Cadastros | `registry:master:verify`, `registry:ui:verify` | `scripts/verify-master-registry.mjs`, `verify-registry-ui.mjs` | x | x |
| Manutenção | `maintenance:ui:verify` | `scripts/verify-maintenance-ui-contract.mjs` | — | x |
| Manutenção | `maintenance:dialog:verify` | `scripts/verify-maintenance-dialog-contract.mjs` | — | x |
| Exportação (relatórios) | `reports:csv-parity:verify`, `reports:json-manifest:verify`, `reports:xlsx-parity:verify`, `reports:print-contract:verify`, `reports:pdf-contract:verify`, `reports:sensitive-data:verify` | `scripts/verify-reports-*.mjs` | x | x |
| Exportação (Manutenção) | coberta dentro de `storage:backup:verify` (`exportPesagensCsv`/`Json`, `scripts/verify-dexie-backup.mjs:60-63`) | — | — | x |
| Relatórios (demais) | `reports:definitions/filters/columns/relation-parity/index-prefilter/grain/grouping/aggregates/subtotals/grand-total/unique-animals/null-semantics/weighted-gmd/templates/permissions/catalog:verify` | `scripts/verify-reports-*.mjs` | x | x |
| Versão/Release | `release:current-only:verify`, `release:version-contract:verify`, `packaged:build:selftest` | — | x | x (selftest só Q) |
| Runtime/Electron | `runtime:legacy:verify`, `main:boot:verify`, `preload:contract:verify`, `desktop:smoke:verify` | — | x | x |
| Docs | `docs:user:selftest` (Q) / `docs:user:verify` (F) | `scripts/verify-user-docs.mjs` | x | x |
| Desempenho | `perf:contract:verify` (Q/F); `reports:performance:verify` (fora) | — | x | x |

**Não existe gate** para o CSV exportado pela Relação (`exportarCSV`) nem para o parser de importação CSV da Relação
(`handleFileUpload`): a busca por `exportarCSV`, `ID_Externo`, `tipoManejoImport` e `handleFileUpload` em `scripts/`
não encontra nada. `import:selection:verify` testa só as funções de domínio `applyImportLotSelection` e
`splitImportRowsByRegistry` (`scripts/verify-import-selection.mjs:3-6`).

---

## 5. Resultado real do `npm.cmd run test:quick`

- **Resultado: VERDE.** Código de saída `0`. Início 2026-09-17T06:26:25-04:00, fim 06:28:08 (**1 min 43 s**).
- 56 de 56 comandos executados na ordem declarada; nenhum abortou a cadeia `&&`. `lint` (`eslint .`) não mostrou nenhum aviso.
- As mensagens `[ipc] AppError: Orientação inválida`, `Documento de impressão inválido`, `Documento de impressão grande demais`,
  `Extensão não permitida (.exe)`, `Extensão não permitida (.pdf)` e `Arquivo vazio` aparecem no log de
  `reports:pdf-contract:verify`: são os casos negativos esperados (códigos `REPORT_IPC_00x`), e o gate passa.
- `git status --short` continuou vazio depois da suíte.

Gates executados (todos OK):

1. `lint`
2. `release:current-only:verify` — “somente a versão atual 1.2.0 está presente”
3. `release:version-contract:verify`
4. `runtime:legacy:verify`
5. `ui:locale-dialog:verify`
6. `ui:operational-customization:verify`
7. `animal:history-integrity:verify` — massa de 36.000 registros / 12.000 animais, índice em 257,7 ms, 5.000 buscas em 1,1 ms
8. `import:selection:verify` — `noSilentRegistryCreation: true`, `unknownRowsRejectedWithoutOption: true`
9. `ui:scrollbar-contract:verify`
10. `ui:consistency:verify`
11. `ui:shell-settings:verify`
12. `weighing:calculations:verify` — `previousOnly`, `futureDateIgnored`, `zeroGainPreserved`, `dateIntervalInDays`
13. `perf:contract:verify`
14. `enterprise:hardening:verify` — `importIdempotency`, `importCanonicalProjection`, `importChronologyPolicy`, `retroactiveRecalculation`, `atomicBulk`
15. `registry:master:verify`
16. `registry:ui:verify`
17. `auth:local:verify`
18. `auth:access:verify`
19. `auth:permissions:verify`
20. `auth:maintenance-access:verify`
21. `auth:weighing-access:verify`
22. `payload:allowlist:verify` — lista permitida com 55 chaves; proibidas: `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal`, `sanidade_ids`, `sanidades`
23. `category-projection:verify` — `saida-sem-peso`, `edicao-da-saida`, `peso-fora-de-faixa`, `manual-preservada`, `cenario-da-regressao`
24. `reports:definitions:verify` — 61 definições
25. `reports:filters:verify`
26. `reports:columns:verify`
27. `reports:relation-parity:verify`
28. `reports:index-prefilter:verify`
29. `reports:grain:verify`
30. `reports:grouping:verify`
31. `reports:aggregates:verify`
32. `reports:subtotals:verify`
33. `reports:grand-total:verify`
34. `reports:unique-animals:verify`
35. `reports:null-semantics:verify`
36. `reports:weighted-gmd:verify`
37. `reports:templates:verify`
38. `reports:permissions:verify`
39. `reports:csv-parity:verify`
40. `reports:json-manifest:verify`
41. `reports:sensitive-data:verify` — `{"gate":"reports:sensitive-data:verify","ok":true}` **nesta execução**
42. `reports:print-contract:verify`
43. `reports:pdf-contract:verify`
44. `reports:catalog:verify`
45. `reports:xlsx-parity:verify`
46. `migration:v7:verify` — lote de 500, passos B1–B12, 6 testes negativos
47. `main:boot:verify`
48. `preload:contract:verify`
49. `storage:dexie:verify` — 23 stores, v7, upgrade v6→v7 (`lotesRemoved`, `enumsConverted`)
50. `storage:first-run:verify`
51. `storage:ui-first-run-persistence:verify`
52. `storage:maintenance-ui-flow:verify`
53. `storage:legacy-detached:verify`
54. `packaged:build:selftest`
55. `docs:user:selftest`
56. `desktop:smoke:verify`

---

## 6. Gates fora do `test:quick` (rodados individualmente, sem `build`/`e2e`)

Rodados para medir o estado das áreas da missão (importação/backup/mapper/manutenção), porque o `test:quick`
não os cobre. Eles gravam só em `os.tmpdir()`, nunca no repositório.

### 6.1 Gates que só estão no `test:full`

| Gate | Resultado | Destaques |
|---|---|---|
| `storage:backup:verify` | OK | formato 3, 23 stores no backup, `csvCount 2`, `jsonCount 2`, restore de formato 2 → backfill `CONCLUIDA`, `ignoredStores: ["lotes"]`, `newStores: 9` |
| `storage:import-restore:verify` | OK | importação JSON dry-run + apply com hash idempotente; negativos: import sem evidência, arquivo repetido, restore sem evidência, payload trocado entre dry-run e apply |
| `storage:ui-contract:verify` | OK | contrato do `storageAdapter` (UI → serviço → Dexie) |
| `weighing:mapper:verify` | OK | lista permitida com 55 chaves; 7 proibidas; projeções `status_animal`, `created_date`, `updated_date` |
| `maintenance:dialog:verify` | OK | — |
| `docs:user:verify` | OK | 12 documentos (versão 1.2.0) |
| **`maintenance:ui:verify`** | **FALHOU** | `FAIL: service validates ADMIN profile via auditActor when an actor exists` |

Não rodados (proibidos nesta coleta ou dependentes de pacote): `build`, `e2e:installed:verify(:dev)`,
`packaged:*:verify`, `release:signature:verify`, `reports:performance:verify`.

### 6.2 Diagnóstico de `maintenance:ui:verify` (vermelho)

- Asserção: `scripts/verify-maintenance-ui-contract.mjs:80` procura, no texto do serviço, `profile !== 'ADMIN'` e `function actorIdentity`.
- Código atual: `src/modules/maintenance/application/maintenanceService.js:13-27` autoriza pela matriz
  (`requireMaintenanceAction` → `can(actor.role, action)`, com falha fechada). Não há mais `actorIdentity` nem `profile !== 'ADMIN'`.
- Histórico, conferido com `git show <rev>:src/modules/maintenance/application/maintenanceService.js | grep -c …`:

  | Revisão | Ocorrências de `profile !== 'ADMIN'` / `function actorIdentity` |
  |---|---|
  | `8a826bf` (onda 1) | 2 |
  | `9349a8f~1` | 2 (linhas 12 e 21) |
  | `9349a8f` — `fix(auth): enforce destructive maintenance permissions` (16/09) | **0** |
  | `075bfc5` | 0 |
  | `d44d5b9` (HEAD) | 0 |

  O padrão sumiu em `9349a8f`, commit que **já está em `v1.2.0-rc1`** (`git merge-base --is-ancestor 9349a8f v1.2.0-rc1` verdadeiro).
- Prova de que é só essa asserção: uma cópia do gate no scratchpad, com a linha 80 desligada e o `root` absoluto,
  termina `OK verify-maintenance-ui-contract` (`statusVersions 7`, `migrationCard`, `twoLevelClear`, `diagnosticWithoutCredentials`).
  As demais asserções do serviço (`:73-79, :81`) passam no código atual.
- Classificação: **gate desatualizado** (o código ficou mais rígido; o teste textual não acompanhou), não é defeito do produto.
  Efeito: **`npm run test:full` falha hoje** em `maintenance:ui:verify` (o gate roda depois de `build`), e já falharia em `v1.2.0-rc1`.
  O `test:quick` não o inclui, por isso o RC1 foi registrado só como “`test:quick` verde”.

### 6.3 Scripts `verify-*.mjs` sem script npm

| Script | Resultado | Observação |
|---|---|---|
| `scripts/verify-auth-bootstrap.mjs` | OK | — |
| `scripts/verify-auth-crypto.mjs` | OK | — |
| `scripts/verify-auth-recovery.mjs` | OK | — |
| `scripts/verify-audit-actor.mjs` | **FALHOU** | `AUTH_FORBIDDEN … papel Sem papel não possui a permissão weighing.write`, em `verify-audit-actor.mjs:47` (`createEntry` “sem sessão”). Coerente com a falha fechada de `weighingService.js:16-26` (`requireWeighingPermission`: com provedor de ator e sem sessão, recusa; a linha `if (hasActorProvider()) throw forbiddenError(null, action)` foi introduzida por `075bfc5`, depois do RC1). O script espera gravar sem sessão (`:49-50`). Último commit do script: `4b673fc` (onda 1). |

---

## 7. `reports:sensitive-data:verify`: a falha rara conhecida

### 7.1 Confirmação pela leitura do gate

- `scripts/verify-reports-sensitive-data.mjs:24`: `SECRET_VALUES = ['3000', '3.000', '9,33', 'Valor venda', 'Preço/@', '@ carcaça']`.
- `:49-57`: para `CONSULTA`, gera CSV e JSON de `pesagens.periodo` e verifica **por substring**:
  `assert.ok(!content.includes(secret), …)` (`:53`). A verificação cobre o conteúdo **inteiro** do arquivo, com o manifesto junto.
- O JSON é `{ manifest, ...body }` serializado (`src/modules/reporting/application/reportExportService.js:97-100`).
  Dentro do manifesto: `emissionId` (`:43`), vindo de `crypto.randomUUID()` (`src/modules/reporting/application/reportService.js:29`),
  e `fileName` (`:87`), montado por `exportFileName` (`:27-30`) como `<slug>_<AAAAMMDD-HHMMSS em UTC>_<8 primeiros caracteres do emissionId>.json`.
  Também entra `contentSha256` (`:98`). O `sha256` do arquivo é calculado **depois** da serialização (`:100`) e fica fora do conteúdo.
- O CSV (`src/modules/reporting/infrastructure/exporters/csvExporter.js:28-36`) não traz manifesto, UUID nem carimbo: é determinístico.

**Confirmado:** `'3000'` pode casar dentro de um valor hexadecimal ou numérico aleatório do JSON, e aí o gate falha sem que haja vazamento real.

### 7.2 Correção do enunciado (o código diverge da descrição)

O **SHA-256 do JSON (`contentSha256`) não é aleatório** na árvore atual: é o hash do corpo, e o corpo é determinístico
com a massa fixa. Os vetores aleatórios são **dois**:

1. `emissionId` (UUID v4): 15 janelas hexadecimais de 4 caracteres, totalmente aleatórias → P ≈ 15/65.536 ≈ **2,3 × 10⁻⁴** por execução.
2. `fileName`: carimbo **UTC** `HHMMSS` contém `3000` quando `MM=30, SS=00` ou quando `HH∈{03,13,23}, MM=00, SS∈00–09`
   → 54 s por dia → P ≈ **6,25 × 10⁻⁴** se a execução cair num horário qualquer do dia. (O prefixo do UUID no nome repete os mesmos caracteres de `emissionId`, sem aleatoriedade nova.)

Estimativa total: ≈ **8,5 × 10⁻⁴** por execução do gate (cerca de 1 em 1.200).

### 7.3 Evidência empírica (scratchpad, `fake-indexeddb` em memória, sem escrita no repo)

- Sonda com 5 semeaduras × 400 emissões = **2.000 JSON da CONSULTA**: 0 ocorrências de `3000`; **1 único `contentSha256`**
  (`185e797396f480fdc55659dbf37e0fa9d4038c825acedc63ca064e27c4c1e496`) → corpo determinístico; CSV sem ocorrência.
- Injeção determinística sobre o mesmo view model:

| Caso | `jsonContains3000` | Onde casou |
|---|---|---|
| `generatedAt 10:15:42Z`, UUID neutro (linha de base) | false | — |
| UUID `…-eeee3000eeee` | **true** | `"emissionId"` |
| UUID `3000aaaa-…` | **true** | `"emissionId"` e `"fileName"` |
| `generatedAt 10:30:00.500Z` | **true** | `"fileName": "…_20260917-103000_…"` |
| `generatedAt 13:00:07.500Z` | **true** | `"fileName": "…_20260917-130007_…"` |
| `generatedAt 10:30:05.500Z` | false | — |

### 7.4 Riscos associados (sem correção aplicada)

- Mudar a massa, uma definição de coluna ou o formato do corpo muda `contentSha256`. Com chance de ≈ 61/65.536 ≈ 9 × 10⁻⁴
  por mudança, o novo hash pode conter `3000`, e aí a falha vira **determinística**.
- A falha rara não está documentada em lugar nenhum do repositório.

---

## 8. Estado das releases (`docs/release/*`)

| Pasta | Conteúdo | Estado |
|---|---|---|
| `1.0.0` … `1.1.17` (20 pastas; não existe `1.1.12`; 23 pastas no total) | `RELEASE-CHECKLIST.md`, `RELEASE-NOTES.md`; `1.1.15` também tem `DIAGNOSTICO-BLOQUEIO-INSTALACAO.md` | históricas |
| `1.1.18` | notas + checklist | tag `v1.1.18` existe, mas o checklist ainda traz desmarcados “Commit do marco na branch `release/1.1.18`” e “Tag local `v1.1.18` após o gate” (`RELEASE-CHECKLIST.md:50-51`) → **documento desatualizado**. Sem instalador; teste físico “NÃO EXECUTADO” |
| `1.2.0` | `RELEASE-NOTES.md`, `RELEASE-CHECKLIST.md`, `MIGRATION-1.1.17-TO-1.2.0.md`, `RC1.md` | **Candidato**. `RC1.md:5-13`: tag `v1.2.0-rc1` → `3b27958`; Setup `release-unsigned/Pesagens Individuais Setup 1.2.0.exe`, 92.036.329 bytes, SHA-256 `fd44a5ee…c0c6`; `signed: false`, `distribution: unsigned-diagnostic`; “Promover para `v1.2.0` somente após o teste físico” (`RC1.md:24`). Checklist: gates avulsos, `test:full`, assinatura, teste instalado e fechamento (merge em `main`, tag `v1.2.0`) **desmarcados** |
| `1.3.0` | só `RELEASE-CHECKLIST.md` (rascunho não revisado, do checkpoint) | nada executado; versão não subida |

Diretórios de artefatos (ignorados pelo git, `.gitignore:5-7`):
- `release/`: vazio.
- `release-unsigned/`: Setup 1.2.0 + `.blockmap` + `.sha256` + `release-manifest.json` + `win-unpacked/` (16/09 20:57).
  O manifesto confere com o RC1: `appVersion 1.2.0`, `dbSchemaVersion 7`, `backupFormatVersion 3`, `gitCommit 3b27958`, `installer.sha256 fd44a5ee…`, `signed false`.
  Declara `features.importJson: true` e `exportCsv/exportJson: true`.
- `release-archive/1.1.17/`: pacote antigo guardado.
- `dist/` existe no disco (build anterior; não foi regerado nesta coleta).

---

## 9. Âncoras de código das quatro frentes (estado atual, sem proposta)

### 9.1 Sanidade: retirada e o que hoje bloqueia a volta

- Decisão: **ADR-022** (`docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md:146-150`) retira a tela, o grupo do registry
  e as chaves `cadastros-auxiliares:sanidade:*`, e diz: “Retorno exige nova ADR e módulo próprio.” Reafirma a ADR-007 (`:40`).
- Stores antigas (v5): `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal` (`schema.js:33-38`; índices `animal_id`,
  `pesagem_id`, `configuracao_id`, `data_aplicacao`, `status`), apagadas na v6 (`schema.js:40-44`, `db.js:29-49`,
  que também remove `sanidade_ids`/`sanidades` de `pesagens` e do `legacy_payload`).
- Migração v7 (B11): exporta as chaves `cadastros-auxiliares:sanidade:*` para `exports/sanidade-export-<carimbo>.json`
  na pasta de dados do app e depois as apaga; sem porta de arquivos, preserva as chaves (`src/storage/migrations/v7Backfill.js:30, 661-682, 695-706`).
  Formato de exemplo usado pelo gate: `{ programasSanidade: [{ id, nome }], medicamentos: [] }` (`scripts/verify-v7-migration.mjs:100`).
  O relatório da migração tem o campo `sanidade` (`src/storage/migrations/migrationState.js:38`).
- Pasta vazia `src/modules/health/application/` existe no disco desde 08/09 e **não é rastreada pelo git** (`git ls-files src/modules/health` vazio).
- **Gates que hoje impedem a volta da Sanidade** (qualquer implementação terá de revisá-los com uma ADR nova):
  1. `scripts/verify-ui-consistency.mjs:20`: o Lançamento não pode conter `/sanidade|sanit[aá]ri/i`.
  2. `scripts/verify-ui-consistency.mjs:185`: `src/pages/ConfiguracoesSanidade.jsx` não pode existir.
  3. `scripts/verify-registry-ui.mjs:77-79`: a mesma página não pode existir.
  4. `scripts/verify-dexie-storage.mjs:33-35`: o banco aberto não pode ter `configuracoesSanidade`, `itensSanidade` nem `sanidadesAnimal` (reusar esses nomes quebra o gate).
  5. `scripts/verify-payload-allowlist.mjs:24,28`, `scripts/verify-weighing-mapper.mjs:58,62` e `scripts/verify-perf-baseline-contract.mjs:195`: `sanidade_ids` e `sanidades` proibidos no `legacy_payload`. A lista está em `src/modules/weighing/domain/weighingMapper.js:24`, e o mapper as apaga em `:124-125`.
  6. `scripts/verify-v7-migration.mjs:262-270, 428-431`: contrato de exportação/remoção das chaves de sanidade.
- Notas da 1.2.0 anunciam a remoção da tela (`docs/release/1.2.0/RELEASE-NOTES.md:48-50`).

### 9.2 Lançamento: salvar e limpar

- Página: `src/pages/LancamentoPesagensIndividuais.jsx` (2.420 linhas); `handleSalvar` em `:789`.
- Montagem do payload: derivados vão da tela só para `Manejo` (`:1047-1052`), mas o serviço **recalcula** (seção 9.3).
- Gravação: `weighingService.createEntry` (`:1057`) / `updateEntry` (`:1061`); ao editar um `Cadastro`, `propagateAnimalProfile` (`:1063-1065`).
- **O que é limpo depois de salvar** (`:1074-1083`): `editingId`, `animalIdSelecionado`, `peso`, `numeroAnimal` (salvo com
  sequência de brincos ativa em `Cadastro`), `observacao`, `documentacao`, `avisoTela`; em `Cadastro`, também
  `categoriaSelecao → Automático` e `era`. Depois chama `salvarConfiguracaoTipoAtual()`.
- **O que fica**: a configuração por tipo de manejo guardada em `configuracoesPorTipoRef` (`:399-401`), com sexo, raça, marca,
  categoria, apartação/lote, sequência, dados de compra (inclusive `valorPagoCabeca`, GTA, NF-e, frete), motivo de saída/causa
  da morte, dados de venda/abate (inclusive `valorVendaTotal`, `valorArroba`, rendimentos) e embarque/documento. Fica só na
  memória (ref) e é reaplicada ao trocar de tipo (`:402-411`). A data de pesagem não está nessa configuração e não é limpa no bloco `:1074-1083`.

### 9.3 Funções canônicas de cálculo (as mesmas que a importação inteligente precisa usar)

| Função | Local | Contrato atual |
|---|---|---|
| `calculateWeightGain({ history, date, weight })` | `src/modules/weighing/domain/weighingCalculations.js:13-35` | referência = pesagem **estritamente anterior** (`<`, mesmo dia e futuro fora) com peso finito, a mais recente; `dias` por dia UTC arredondado; `ganho` com 2 casas; `gmd` com 3 casas (`0` se `dias ≤ 0`); sem anterior → tudo `null` |
| `recalculateWeightSeries(entries, affectedKeys)` | `src/modules/weighing/domain/weighingSeries.js:10-46` | agrupa por `animalIdentityKey` (`id:<animal_id>` ou `legacy:<número+marca>`, `:4`); ordena por `data_pesagem`, `created_date/created_at`, `id` (`:5-8`); **só `Manejo` recebe derivados**, `Cadastro`/`Saída` recebem `null` (`:26-28`); gera patch para **todos** os eventos do grupo, tenham mudado ou não (`:36-41`); entra no histórico só evento com peso finito (`:42`) |
| `animalIdentityKey(entry)` | `weighingSeries.js:48-50` | chave de identidade da série |
| `buildWeightPreview({ history, date, weight, editingId })` | `src/components/pesagens/weightPreview.js:6-30` | prévia na tela, com a mesma `calculateWeightGain`; exclui o próprio registro em edição e pesos ≤ 0 |
| `weighingService.createEntry` | `src/modules/weighing/application/weighingService.js:53-103` | exige `weighing.write` (`:54`) e descarta valores comerciais sem `commercial.write` (`:28-35`); calcula derivados só para `Manejo` (`:63-69`); recalcula a série do animal só se houver evento posterior (`:81-88`) |
| `weighingService.bulkCreateEntries` | `weighingService.js:105-115` | caminho da importação; depois do adapter chama `recalculateAllWeightSeries()` (`:113`), que relê **toda** a base (`:152-153`) |
| `recalculateWeightSeriesForKeys` | `weighingService.js:148-197` | por animal quando há `animal_id`; base inteira quando há identidade legada; grava com `bulkUpdateEntries(..., { systemDerived: true, audit: false })` |
| Cronologia (lançamento) | `src/modules/weighing/infrastructure/weighingDataAdapter.js:165-191` | um `Cadastro` por animal; nada antes do cadastro; `Saída` retroativa bloqueada se houver evento posterior; nada na data da saída definitiva nem depois |
| Categoria automática | `weighingDataAdapter.js:197-207` (`stampAutomaticCategory`) | usada em `createEntry` (`:332`) e `updateEntry` (`:407`); **não é usada em `bulkCreateEntries`** |

### 9.4 Importação atual (dois caminhos)

**(a) CSV pela Relação** (`src/pages/PesagensIndividuais.jsx`):
- Leitura/mapeamento: `handleFileUpload` (`:347-499`); hash SHA-256 do texto (`:355-356`); `parseCsv` (`:357`);
  cabeçalhos normalizados sem acento, espaço e sublinhado (`:364-387`).
- Coluna `id` é mapeada (`:370`) mas **não é usada** no registro (`:395-415`).
- Derivados do arquivo são **ignorados de propósito** (`:408-414`); linhas `SN` também ficam sem derivados (`:431-439`).
- Obrigatórios: número, **peso > 0** e data (`:418-429`). Uma `Saída` sem peso (morte) não pode ser importada.
- Cadastros: marca e raça resolvidas por nome normalizado, **sem criação silenciosa** na tela (`:447-448`); criação só com opção explícita e `registry.write` (`:520-532`).
- Vínculo de lote/apartação por nome (`:453-492`, `applyImportLotSelection` em `:501-513`).
- **Um único `tipo_manejo` para o arquivo inteiro** (`tipoManejoImport`, `:153`, aplicado em `:556-559`). Um arquivo não consegue trazer Cadastro + Manejos + Saída.
- Gravação atômica: `weighingService.bulkCreateEntries(registros, { importMetadata })` (`:562-564`), com `operador: 'LOCAL'`.

**(b) JSON pela Manutenção** (`src/storage/indexedDb/backup/backupService.js`):
- `dryRunImportPesagens` (`:310-325`): contagem, duplicados por `id`, inválidos sem data.
- `applyImportPesagens` (`:328-355`): exige evidência de backup (`requireDurableSafetyEvidence`, `:329`), pula `id` existentes, hash SHA-256 do payload, chama o mesmo `bulkCreateEntries`, registra `backupHistory('import')`.
- Consumido por `src/modules/maintenance/infrastructure/maintenanceDataAdapter.js:109-116` (`dryRunImportWeighingJson` / `applyImportWeighingJson`, que grava um backup completo `pre-import` antes, `:113`).

**Adapter comum** `weighingDataAdapter.bulkCreateEntries` (`:442-666`):
- Idempotência por arquivo: `importacoes.arquivo_hash` único (`schema.js:67`); repete → erro “Arquivo já importado” (`:457-462`).
- `id` duplicado no lote ou já existente → erro (`:477-484`).
- Resolve animal por `animal_id` ou `NÚMERO::MARCA` (`:453, 512-523, 554`); cria animal e identificador `VISUAL` quando não acha (`:556-574`).
- **Cria marcas e raças desconhecidas silenciosamente** dentro do lote (`resolveInBatch`, `:496-506, 558-559, 640-641`). A proteção “sem criação silenciosa” existe só na tela/domínio (9.4a).
- Ordena o lote por `data_pesagem` e `id` (`:550`) e aplica as regras de cronologia **dentro do lote**
  (`:577-595`); o primeiro erro aborta a transação inteira (não há relatório de conciliação por linha).
- Cria sessões por data (`:597-602`), movimentos (`:616-636`), permanência em lote (`animalLotes`), auditoria `origem: 'importacao'` (`:637`) e reconstrói a projeção do animal (`:650`).
- Não aplica categoria automática (ver 9.3).

### 9.5 Exportação atual (três caminhos que não conversam)

1. **CSV da Relação** (`PesagensIndividuais.jsx:720-750`, permissão `reports.export` em `:166, :882`): cabeçalhos
   `ID;ID_Externo;Data;NumeroAnimal;Sexo;Raça;Era;Marca;Peso;Lote;Apartação;Observação;DataAnterior;PesoAnterior;Dias;Ganho;GMD`,
   números/datas em formato BR, BOM, separador `;`, **sem escape** (`r.join(';')`, `:742`: um `;`, aspas ou quebra de linha em
   `observacao` quebram o arquivo) e **sem `tipo_manejo`, motivo de saída ou valores**. O arquivo só volta pelo importador
   como um único tipo escolhido na tela (9.4a).
2. **CSV/JSON da Manutenção** (`backupService.js:97-104` e `:107-121`): CSV com campos crus de storage
   (`id,data_pesagem,peso_kg,animal_id,lote_id,tipo_pesagem,operador,origem,observacao,created_at,updated_at`, separador `,`,
   sem número/marca do animal); JSON `weighing-entries-export` com os registros inteiros, reimportável por 9.4b.
3. **Relatórios** (`src/modules/reporting/application/reportExportService.js`): CSV/JSON/XLSX canônicos, com manifesto e
   SHA-256, permissões por coluna sensível, paridade com a tela coberta por gates (seção 4.2).

---

## 10. Divergências documento × código

| # | Documento | Diz | Código/estado real |
|---|---|---|---|
| D1 | `docs/release/1.2.0/RC1.md:12` | “`test:quick` verde (33)” | em `3b27958` o `test:quick` tinha 34 comandos (lint + 33 gates), o que confere; hoje tem **56** (lint + 55, `package.json:67`). O número do RC1 não vale para o HEAD |
| D2 | `docs/release/1.2.0/RELEASE-CHECKLIST.md:31` | `npm run master-registry:verify` | o script chama-se `registry:master:verify` (`package.json:71`) |
| D3 | `docs/release/1.2.0/RELEASE-CHECKLIST.md:14` | bloco `## [1.2.0] — 2026-09-15` | `CHANGELOG.md:6` = `## [1.2.0] — 2026-09-16` |
| D4 | `docs/release/1.1.18/RELEASE-CHECKLIST.md:50-51` | commit/tag do marco pendentes | tag `v1.1.18` existe (`4d81b50`) |
| D5 | `docs/release/1.2.0/RELEASE-NOTES.md:52-53` | “Removido: Diálogo legado ‘Gerenciar saídas’” | `src/components/pesagens/GerenciarSaidasDialog.jsx` **continua na árvore**, órfão (nenhum import em `src/`), ainda lendo `perfis-saida:*` |
| D6 | ADR-022 (`08-DECISOES-ARQUITETURAIS.md:149-150`) | dados de sanidade exportados para `docs/evidence/program-2.0/` | a migração grava em `exports/` na pasta de dados do app (`v7Backfill.js:676`) |
| D7 | `scripts/verify-dexie-backup.mjs:3` (comentário) | “`usuariosLocais` no backup” | a store é `usuarios` (`schema.js:81`); `verify-local-auth.mjs:50` confirma que `usuariosLocais` não existe |
| D8 | `docs/release/1.3.0/RELEASE-CHECKLIST.md:3` | versão 1.3.0 | `package.json:6` = 1.2.0; sem bloco `[1.3.0]` no CHANGELOG |
| D9 | memória de trabalho (programa reporting) | “R0 feito” | R1–R6 implementados e o programa **pausado** em `d44d5b9` |
| D10 | Enunciado da falha rara do sensitive-data | “UUID/SHA-256 aleatório no JSON” | o SHA-256 no JSON (`contentSha256`) é determinístico; os aleatórios são `emissionId` e o carimbo UTC em `fileName` (seção 7) |
| D11 | `import:selection:verify` → `noSilentRegistryCreation: true` | importação não cria cadastro em silêncio | vale para tela/domínio; o adapter `bulkCreateEntries` cria marca/raça desconhecida em silêncio (`weighingDataAdapter.js:496-506, 640-641`) |
| D12 | `docs/user/EXPORTAR-DADOS.md:8,16` | JSON serve para “importar depois no app” | só o JSON da Manutenção é reimportável; o CSV da Relação não carrega o tipo de manejo (9.5) |

---

## 11. Riscos para o desenho da implementação

1. **`test:full` vermelho** (`maintenance:ui:verify`, 6.2) e `verify-audit-actor.mjs` quebrado (6.3): antes de usar o `test:full` como critério de aceite, alinhar esses testes ao contrato de falha fechada. Hoje o verde do `test:quick` esconde isso.
2. **Gate instável** `reports:sensitive-data:verify` (≈ 1 falha a cada 1.200 execuções; pode virar falha fixa se o corpo mudar). Qualquer mudança de massa, colunas ou exportação pode acendê-lo.
3. **Sanidade**: exige ADR nova (ADR-022), esquema v8 (`DB_VERSION`, `DATA_BUILD_ID` literal, provavelmente `BACKUP_FORMAT_VERSION`), migração v7→v8 com gate, backup/restore das novas stores, revisão dos 6 gates de 9.1 e **nomes de stores diferentes** dos removidos na v6 (ou revisão de `verify-dexie-storage.mjs:33`). Aplicações por animal não podem voltar como `sanidade_ids`/`sanidades` no `legacy_payload` (lista proibida).
4. **Importação**: um tipo por arquivo; exige peso > 0; primeiro erro de cronologia aborta tudo; o adapter cria cadastros em silêncio; a importação não aplica categoria automática; `recalculateAllWeightSeries` relê a base inteira e regrava todos os eventos de todos os grupos (custo com 36k/250k registros); a idempotência é só por hash do arquivo inteiro (o mesmo conteúdo com um byte diferente passa).
5. **Série cronológica**: com eventos no mesmo dia, a ordem cai em `created_at` e depois em `id` (`weighingSeries.js:5-8`), e o lote importado é ordenado só por data e `id` (`weighingDataAdapter.js:550`). Um Cadastro e um Manejo na mesma data podem sair em ordem diferente da real. `calculateWeightGain` ignora referência do mesmo dia.
6. **Exportação**: o CSV da Relação não é reimportável como histórico (falta tipo/motivo) e não escapa campos; três formatos coexistem sem contrato comum de colunas.
7. **Lançamento**: o contexto por tipo mora numa ref (se perde ao sair da tela), e valores por animal (`valorVendaTotal`, `valorPagoCabeca`, GTA/NF-e) **continuam** depois de salvar; a separação entre “contexto” e “dado do animal” ainda não existe no código.
8. **Base de trabalho**: a branch atual carrega trabalho não revisado do programa de relatórios (`readByKeys`, listas preguiçosas, rascunhos de docs e checklist 1.3.0). O RC1 físico, se testado, valida um build 31 commits atrás do HEAD e sem `075bfc5`.
9. **Cobertura**: não há gate para o CSV de importação/exportação da Relação (4.2); os gates de backup/import-restore/mapper só rodam no `test:full`.
