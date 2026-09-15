# S-00.1 — Contrato de versão, ADRs e governança (marco 1.1.18)

**Marco:** 1.1.18 (PATCH; ADR-047) · **Data:** 14/09/2026 · **Worktree:**
`C:\Users\maike\Desktop\projeto\MAKGESTAO-1.1.18`, branch `release/1.1.18`, derivada de `e4d4278`
(baseline verde + ADRs 018–040 + contratos fase 0, **antes** do esquema v7) · **Regra do marco:**
baseline verde + contrato de versão + governança, **sem esquema novo** — `DB_VERSION = 6`,
`BACKUP_FORMAT_VERSION = 2`, sem login, stores ou telas novas.

## 1. Objetivo

Deixar 1.1.18 coerente para rollback e `git bisect`: uma só versão em todos os lugares, quatro eixos
de versão que nunca se confundem, manifesto de release com identidade de build, gate que prova tudo
isso, decisões (ADR-041…048) e documentos de engenharia que os marcos 1.2.0…1.6.0 vão seguir, e o
diagnóstico dos dois gates vermelhos registrado como evidência (S-00.0).

## 2. O que foi feito

| Entrega | Onde | Resultado |
|---|---|---|
| Contrato de versão | `src/versioning/versionInfo.js` | `APP_VERSION` (1.1.18), `DB_SCHEMA_VERSION` (6), `BACKUP_FORMAT_VERSION` (2), `RELEASE_MANIFEST_VERSION` (2), `UI_CONTRACT_VERSION` (`ModeloBase1-R34`), `DATA_CONTRACT_VERSION` (1), `DATA_BUILD_ID` (`schema-v6`), reexport de `UI_BUILD_ID/UI_MODEL/UI_VERSION`, `BUILD_INFO` (`__BUILD_INFO__`, fallback nulo em Node), `describeVersions()` |
| Fallback do app | `src/lib/appVersion.js` | `'1.1.18'` |
| Marcadores de build | `vite.config.js` | `__BUILD_INFO__ = { gitCommit: git rev-parse --short HEAD (try/catch → null), buildTimestamp: ISO }`; bundle gerado contém `gitCommit:"e4d4278"` |
| Fonte única do formato de backup | `src/storage/indexedDb/backup/backupService.js` | importa `BACKUP_FORMAT_VERSION` de `versionInfo.js` (2); `schema.js` intacto; backup idêntico |
| Manifesto formato 2 | `scripts/generate-release-manifest.mjs` | `releaseManifestVersion`, `productName`, `appVersion` (+ `version` para `verify-packaged-ui-build.mjs`), `dbSchemaVersion`, `backupFormatVersion`, `uiBuildId`, `dataBuildId`, `uiContract`, `dataContract`, `gitCommit`, `buildTimestamp`, `platform`, `arch`, `installer{file,sha256,sizeBytes,builtAt}`, `signed:false` (fixo até Authenticode, ADR-039), `distribution`, `features`; `buildReleaseManifest`/`writeReleaseManifest` exportados |
| Gate | `scripts/verify-version-contract.mjs` + `release:version-contract:verify` em `test:quick`/`test:full` | checagens (a)–(f); `--self-test` com 2 fixtures positivas e 11 negativas |
| UI | `src/pages/ManutencaoSistema.jsx` | bloco **Versões** no cartão Status do banco e no "Copiar diagnóstico" (Aplicativo, Esquema do banco, Formato do backup, Manifesto, Build commit · data, Contrato UI/dados); sem as palavras proibidas pelos gates de Manutenção/smoke |
| Docs de engenharia | `docs/engineering/VERSIONING.md`, `RELEASE-POLICY.md`, `AUTH-THREAT-MODEL.md` | português claro; nada prometido que não exista (o threat model declara que em 1.1.18 não há login) |
| CHANGELOG | `CHANGELOG.md` | três blocos "Não lançado" → `## [1.1.18] — 2026-09-14` com Added/Changed/Fixed/Removed/Migration/Security; 1.1.16 e anteriores intactos |
| Release docs | `docs/release/1.1.18/RELEASE-NOTES.md`, `RELEASE-CHECKLIST.md` | instalador "não gerado neste marco"; teste físico NÃO EXECUTADO; só o executado está marcado |
| Docs do usuário | `docs/user/INSTALACAO-WINDOWS.md`, `TESTE-MAQUINA-LIMPA.md` | citam 1.1.18 sem afirmar que existe instalador |
| Versão | `package.json`, `package-lock.json` | 1.1.18 nos três campos (edição sincronizada; diff de 2 linhas no lock) |
| ADRs e contratos | `docs/arquitetura-produto/08, 10, 11, 12, 13, 14`, `docs/evidence/STATE-OF-REPO-BEFORE.md` | copiados do repositório principal (14 já era idêntico) |
| Evidências | `docs/evidence/s00-baseline-recovery/`, `docs/evidence/s00-versioning-auth-contract/` | REPORT, FILES-CHANGED, TESTS, RISKS, ROLLBACK |
| Governança Git | `.gitignore` | `release/` → `/release/` e `/release-unsigned/`: o padrão antigo ignorava `docs/release/**` (confirmado com `git check-ignore`), o que deixaria notas e checklist fora do commit |

## 3. Decisões tomadas durante a fatia

1. **`RELEASE_MANIFEST_VERSION` tem dono: o gerador.** `versionInfo.js` declara o mesmo valor para a
   UI, e o gate (f) prova a igualdade importando os dois módulos. Se um dia divergirem, `test:quick`
   falha antes de qualquer pacote.
2. **`signed` não aceita override.** O gerador grava `false` sempre; quando houver certificado, a
   mudança será de código, com ADR, não de variável de ambiente.
3. **O gate também entra em `test:full`.** O enunciado pedia `test:quick`; `test:full` é o gate de
   release e já exigia `docs:user:verify`, então o gate de versão só antecipa a mesma falha.
4. **`.gitignore` corrigido** (ver §2). Sem isso o marco não seria coerente: `docs:user:verify` passa
   na árvore local e falharia em qualquer clone.
5. **`database` mantido no manifesto** (`engine`, `storage`, `preservesDataOnUninstall`): informação
   útil já existente no formato 1; não conflita com os campos exigidos.
6. **Bloco Versões calculado no carregamento do módulo** (constantes de build), não por IPC: a página
   continua mostrando `Versão:` do Electron (`getDiagnosticInfo`) ao lado de `Aplicativo:` do bundle,
   o que permite detectar pacote inconsistente.

## 4. Resultado dos gates (detalhe em `TESTS.md`)

| Comando | Exit | Tempo |
|---|---|---|
| `npm.cmd run lint` | 0 | 18 s |
| `npm.cmd run build` | 0 | 71 s |
| `npm.cmd run release:version-contract:verify` | 0 | < 1 s |
| `node scripts/verify-version-contract.mjs --self-test` | 0 (13/13) | < 1 s |
| `npm.cmd run docs:user:verify` | 0 | 2 s |
| `npm.cmd run test:quick` | 0 (**21/21**) | 40 s |
| `npx eslint src/pages/ManutencaoSistema.jsx` | 0 | — |

Nenhum gate foi afrouxado; nenhum gate existente precisou de alteração.

## 5. Não feito / pendente (deliberado)

- Instalador 1.1.18 **não gerado** (`dist`/`dist:unsigned` proibidos no marco); gates de pacote,
  checksum, manifesto real e e2e instalado não executados. Teste físico **NÃO EXECUTADO**.
- Commit e tag `v1.1.18`: responsabilidade do orquestrador (nenhum comando git de escrita executado
  aqui; apenas `git show`, `git log`, `git status`, `git diff`, `git check-ignore`, `git rev-parse`).
- Integração com `program/pesagens-master-evolution`: `versionInfo.js` daquela branch (backup 3,
  `ModeloBase1-2.0`, `DATA_CONTRACT_VERSION = 2`) vai conflitar com este; ver `RISKS.md` #2.
- `docs/release/1.1.17/` existe apenas no repositório principal e continua fora do git de lá (o
  `.gitignore` antigo); este marco não a recria.

## 6. Referências

ADR-037, ADR-039, ADR-047, ADR-048 (`docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md`);
`13-VERSIONAMENTO-RELEASE.md` rev. 2; `10-MODELO-PRODUTO-2.0.md` §4; `docs/evidence/STATE-OF-REPO-BEFORE.md`;
`docs/evidence/program-2.0/phase-00/GATES.md`; `docs/evidence/s00-baseline-recovery/REPORT.md`.
