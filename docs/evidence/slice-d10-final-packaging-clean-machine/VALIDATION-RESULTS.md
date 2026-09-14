# VALIDATION-RESULTS

Execução real das suítes em 2026-07-16 (ambiente do desenvolvedor, Windows).

## npm run test:quick
**PASS.** Etapas: `lint` → `db:verify` (healthcheck) → `weighing:sqlite-only:verify`
→ `maintenance:ui:verify` → `d7b:sqlite-only:verify` → `desktop:smoke:verify`.

Healthcheck confirmou migrations 001–003 aplicadas e as 16 tabelas esperadas,
`healthy: true`, `missingTables: []`. Tabelas em PT reais presentes:
`configuracoes_sanidade`, `itens_sanidade`, `sanidades_animal`, `embarques`,
`documentos_embarque`, `apartacoes`, `lote_apartacoes`.

## npm run test (test:full)
**PASS.** Gate completo executado: `lint` + `build` + todas as verificações
(healthcheck, migrations, repositories, weighing mapper/adapter, migração
legado dry-run/apply/idempotency, manutenção backup/export/import/restore/
integrity/ui/dialog, auxiliares, d7b schema/repos/migração/ui-contract,
`installer:sqlite:verify`, `e2e:installed:verify`, `desktop:smoke:verify`).
Nenhum FAIL ou erro.

## npm run e2e:installed:verify (artefatos)
**PASS.** Validou no `release/win-unpacked`:
- `Pesagens Individuais.exe` empacotado
- `resources/app.asar`
- `resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node`
- Metadados: productName, version 1.0.0, appId `com.pesagens.individuais`,
  artifactName correto.
- Data dir esperado: `%APPDATA%/pesagens-individuais/data`.

## D9_LAUNCH_PACKAGED=1 npm run e2e:installed:verify (launch real)
**PASS.** `"execution": "packaged exe launched briefly then killed"`,
`"limitation": null`. O executável instalado abre e é encerrado sem erro —
smoke de execução real do binário empacotado.

## Não coberto por automação (requer máquina/usuário reais)
- Instalação do Setup.exe do zero e uso pelo atalho.
- Criação/persistência de pesagem entre reaberturas.
- Backup/CSV/JSON/integridade pela UI de Manutenção com dados reais.
- Reinstalação por cima preservando dados.
- Restauração de backup `.db`.
Estes itens estão no checklist `docs/user/TESTE-MAQUINA-LIMPA.md` e no registro
`CLEAN-MACHINE-TEST-RECORD.md`.
