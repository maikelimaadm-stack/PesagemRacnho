# LINT-BUILD-VERIFY

Execução real das suítes em 2026-07-16 (Windows, ambiente do desenvolvedor).

## Resultados

| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test:quick | PASS |
| npm run test (= test:full) | PASS — 30 passos `OK` |
| npm run test:full | PASS — 30 passos `OK` |
| npm run desktop:smoke:verify | PASS |
| npm run installer:sqlite:verify | PASS |
| npm run e2e:installed:verify | PASS (artefatos) |
| D9_LAUNCH_PACKAGED=1 e2e:installed:verify | PASS (launch real do exe — feito no D.10) |
| npm run data:preservation:verify | PASS |
| npm run docs:user:verify | PASS |
| npm run release:checksum | PASS |
| npm run release:manifest | PASS |
| npm run dist | NÃO reexecutado (sem mudança funcional; artefato 1.0.0 revalidado) |

## Busca final de conformidade (rg)
Padrão do plano executado sobre `src electron scripts package.json docs/user
docs/release CHANGELOG.md`. Classificação:

- **legacyWeighingBridge** → 3 ocorrências, todas em
  `scripts/verify-desktop-smoke.mjs` como **assertiva de remoção**
  (`'legacyWeighingBridge.js removed'`). O arquivo NÃO existe. → esperado.
- **db.entities.** → 0 em src/electron. → esperado (fluxo é SQLite-only).
- **login / senha / permiss / role / auth** em src/electron → 4, todas
  `role="checkbox"`/`role="combobox"` (ARIA) e CSS. → falso positivo.
- **admin / cloud / server / sync** em src/electron → 0 (fora de `*FileSync`).
  → esperado.
- **better-sqlite3 / asarUnpack** → presentes em package.json. → esperado.
- **deleteAppDataOnUninstall** → `false` (package.json). → esperado (preserva dados).
- **writeFileSync / readFileSync** → scripts e serviços de backup/export/import.
  → esperado.

Sem login/permissões implementados. Sem bridge legado. Sem `db.entities` em
fluxo operacional.
