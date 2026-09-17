# R0 preflight — estado antes das alterações (16/09/2026)

Branch: `program/pesagens-master-evolution` · HEAD `cc024d8` · versão em arquivo 1.2.0 (não consolidada) · Dexie v7 · backup format 3.

## git status --short
```text
 M CHANGELOG.md
 M docs/release/1.2.0/RELEASE-CHECKLIST.md
 M package-lock.json
 M package.json
 M scripts/generate-release-manifest.mjs
 M scripts/verify-animal-history-integrity.mjs
 M scripts/verify-local-auth.mjs
 M scripts/verify-master-registry.mjs
 M scripts/verify-operational-customization.mjs
 M scripts/verify-packaged-build.mjs
 M scripts/verify-perf-baseline-contract.mjs
 M scripts/verify-registry-ui.mjs
 M scripts/verify-ui-consistency.mjs
 M scripts/verify-v7-migration.mjs
 M scripts/verify-version-contract.mjs
 M src/components/cadastros/CadastroAuxiliarPage.jsx
 M src/components/cadastros/registryFormModel.js
 M src/components/mak/MakFilterPill.jsx
 M src/components/mak/MakFilterRail.jsx
D  src/components/mak/MgFilterPanel.jsx
 M src/components/mak/MgTablePanelStrip.jsx
 M src/components/pesagens/ConfirmarAnimalSnDialog.jsx
 M src/index.css
 M src/lib/appVersion.js
 M src/modules/catalog/domain/registryDefinitions.js
 M src/modules/catalog/domain/seeds.js
 M src/modules/operations/application/operationalInsightsService.js
 M src/modules/operations/domain/categorySuggestion.js
 M src/modules/perf/testMass.js
 M src/modules/weighing/domain/weighingMapper.js
 M src/modules/weighing/infrastructure/weighingDataAdapter.js
 M src/pages/LancamentoPesagensIndividuais.jsx
 M src/pages/PesagensIndividuais.jsx
 M src/storage/indexedDb/normalize.js
 M src/storage/migrations/v7Backfill.js
 M src/styles/auxiliary-registries.css
 M src/styles/d17b-modelobase1.css
 M src/versioning/versionInfo.js
?? docs/evidence/auditoria-relatorios-profissionais/
?? release-archive/
?? src/components/mak/mgIcons.js

```

## git log --oneline --decorate -15
```text
cc024d8 (HEAD -> program/pesagens-master-evolution) fix(integration): finish users-store rename in storage gates/adapter; settings permission assertion
4b673fc wip(onda-1): second partial state after interruption (auth screens rev.2, launch selectors, gates)
917052c docs: consolidated current documentation snapshot (2026-09-15 pause)
66e7c67 wip(onda-1): partial state of the review-fix wave (interrupted) + pause checkpoint 2026-09-15
10aa042 chore(ui-parity): keep the ModeloBase1 reference rendering harness in the repo (scripts/ui-parity)
c55a8ed docs(changelog): [1.1.17] block for the diagnostic build; build: mark dirty trees in gitCommit (-dirty)
939a49e merge: release/1.1.18 into program (version contract rev.2, engineering docs, CHANGELOG [1.1.18], s00 evidence)
8a826bf wip(phase-1): agents' deliverables (storage v7 migration, auth local, master registries, perf mass v7, QA/docs, registry pages, shell/settings) — pre-review snapshot
daddf7f release: 1.1.18 — baseline recovery, version contract, engineering docs (no schema change)
c467d4c docs(ui-parity): register the ModeloBase1 list-style sample sent by the owner (cadcps/empresas reference)
6c87155 feat(integration): wire AuthGate, routes, menu groups/permissions, v7 enums and new gates (phase 1 integration, part 1)
bd0bb70 docs(program): ADR-041..048 (DEC-023..030), contracts rev.2 (usuarios, 4 papéis, recovery key, 4 eixos de versão, marcos 1.1.18..1.6.0) and STATE-OF-REPO-BEFORE
deac4a3 feat(versioning): add versionInfo (five axes + build ids) and audit actor bridge; phase 0 evidence
986c502 feat(storage): introduce Dexie v7 schema (structure only)
e4d4278 docs(program): phase 0 contracts (product 2.0, local auth, data v7/v8, versioning, migrations) and gate/perf evidence

```

## git diff --stat
```text
 CHANGELOG.md                                       |  43 ++++
 docs/release/1.2.0/RELEASE-CHECKLIST.md            |  45 ++--
 package-lock.json                                  |   4 +-
 package.json                                       |   2 +-
 scripts/generate-release-manifest.mjs              |  12 +-
 scripts/verify-animal-history-integrity.mjs        |  43 ++++
 scripts/verify-local-auth.mjs                      |   2 +-
 scripts/verify-master-registry.mjs                 |  26 ++-
 scripts/verify-operational-customization.mjs       |  55 +++--
 scripts/verify-packaged-build.mjs                  |  16 +-
 scripts/verify-perf-baseline-contract.mjs          |  10 +-
 scripts/verify-registry-ui.mjs                     |  13 +-
 scripts/verify-ui-consistency.mjs                  |  17 +-
 scripts/verify-v7-migration.mjs                    |  13 +-
 scripts/verify-version-contract.mjs                |   5 +-
 src/components/cadastros/CadastroAuxiliarPage.jsx  | 139 ++++-------
 src/components/cadastros/registryFormModel.js      |   9 +-
 src/components/mak/MakFilterPill.jsx               |  11 +-
 src/components/mak/MakFilterRail.jsx               |  77 +++---
 src/components/mak/MgTablePanelStrip.jsx           |   4 +-
 .../pesagens/ConfirmarAnimalSnDialog.jsx           |  65 ++----
 src/index.css                                      |   6 +-
 src/lib/appVersion.js                              |   2 +-
 src/modules/catalog/domain/registryDefinitions.js  |  29 ++-
 src/modules/catalog/domain/seeds.js                |  19 +-
 .../application/operationalInsightsService.js      |   2 +-
 .../operations/domain/categorySuggestion.js        |  87 +++----
 src/modules/perf/testMass.js                       |  35 ++-
 src/modules/weighing/domain/weighingMapper.js      |   2 +
 .../weighing/infrastructure/weighingDataAdapter.js |  65 ++++--
 src/pages/LancamentoPesagensIndividuais.jsx        | 140 +++++------
 src/pages/PesagensIndividuais.jsx                  | 212 +----------------
 src/storage/indexedDb/normalize.js                 |  10 -
 src/storage/migrations/v7Backfill.js               |  46 +---
 src/styles/auxiliary-registries.css                |  15 +-
 src/styles/d17b-modelobase1.css                    | 260 +++++++++++++++++----
 src/versioning/versionInfo.js                      |   5 +-
 37 files changed, 800 insertions(+), 746 deletions(-)

```

## Triagem

| Grupo | Decisão |
|---|---|
| Versão 1.2.0 (package.json/lock, appVersion, versionInfo, CHANGELOG, RELEASE-CHECKLIST, generate-release-manifest) | válido → checkpoint |
| Paridade UI ModeloBase1 (MakFilterPill/Rail, MgTablePanelStrip, mgIcons.js novo, MgFilterPanel removido, CSS d17b/auxiliary, index.css, CadastroAuxiliarPage, registryFormModel, PesagensIndividuais) | válido → checkpoint |
| Categoria automática por peso (categorySuggestion, registryDefinitions, seeds, weighingDataAdapter, weighingMapper, v7Backfill, normalize, Lancamento, ConfirmarAnimalSnDialog, operationalInsightsService, testMass) | válido → checkpoint (contém a regressão P0 G-P0-02, corrigida em R0) |
| Gates ajustados (verify-*) | válido → checkpoint |
| docs/evidence/auditoria-relatorios-profissionais | válido → checkpoint |
| `release-archive/` (instaladores 1.1.17 binários) | **não versionar** — artefato local; permanece não rastreado |

Nenhum stash foi usado. Nenhuma tag criada.
