# LINT-BUILD-VERIFY (D.11)

Execução real em 2026-07-16 (Windows).

## Gates Node (antes do dist — better-sqlite3 em ABI utilizável)
| Comando | Resultado |
|---|---|
| npm run lint | PASS |
| npm run build | PASS |
| npm run test:quick | PASS (inclui first-run:db:verify) |
| npm run test (= test:full) | PASS (30+ passos; inclui first-run:db:verify e e2e dev-permissivo) |
| npm run test:full | PASS |
| npm run first-run:db:verify | PASS (16 tabelas, migrations 1/2/3, integrity ok) |
| npm run data:preservation:verify | PASS |
| npm run docs:user:verify | PASS |

## Regeneração + validação de release (depois do dist)
| Comando | Resultado |
|---|---|
| npm run dist | PASS (exit 0) — Setup.exe regenerado |
| npm run release:checksum | PASS — SHA256 9d8c97bc...945a |
| npm run release:manifest | PASS — version 1.0.0, novo sha256 |
| npm run e2e:installed:verify (estrito) | PASS — Setup.exe + .sha256 + manifest exigidos |
| npm run desktop:smoke:verify | PASS |
| npm run installer:sqlite:verify | PASS |
| FIRST_RUN_LAUNCH_PACKAGED=1 first-run:db:verify | PASS (Modo 1); Modo 2 (launch do exe) BLOQUEADO pelo ambiente |

## Critério de aceite 10 — e2e deve FALHAR sem Setup.exe (PROVADO)
Teste reversível: renomeado o instalador para ausente → `npm run e2e:installed:verify`
saiu com **exit 1** e `FAIL: release final: "Pesagens Individuais Setup 1.0.0.exe"
deve existir`. Instalador restaurado → e2e volta a PASS. O modo estrito é o padrão;
permissivo só com `E2E_DEV_PERMISSIVE=1` ou `ALLOW_MISSING_SETUP=1`.

## Nota sobre npm run dist neste ciclo
`npm run dist` foi executado no D.11 (regeneração do instalador, exit 0, novo
SHA256 9d8c97bc...945a). As edições posteriores foram apenas em scripts/docs
(fora de `build.files`), então o instalador atual já contém o bootstrap
corrigido (`electron/main.cjs`); dist não foi reexecutado para evitar churn de
hash sem mudança funcional empacotável.

## Busca final (rg) — classificação
- `PESAGENS_USER_DATA_DIR`: só em `electron/main.cjs` (override guardado, test-only)
  e `scripts/verify-first-run-database-bootstrap.mjs`. → esperado / documentação.
- `userData` / `pesagens.db`: em `electron/main.cjs` (getDataDir → userData/data). → esperado.
- login/senha/permiss/role/auth/admin/cloud/server/db.entities/legacyWeighingBridge
  reais em src/electron: **0** (apenas `role=` ARIA). → falso positivo / esperado.
- better-sqlite3 / asarUnpack / deleteAppDataOnUninstall=false: presentes/confirmados. → esperado.

Sem login/permissões. `db.entities` não operacional. `legacyWeighingBridge` inexistente.
