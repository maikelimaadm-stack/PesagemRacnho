# S-00.0 — Testes

## 1. Baseline individual (tag `v1.1.17-baseline`, 14/09/2026)

Fonte: `docs/evidence/program-2.0/phase-00/GATES.md` §1 (cada script executado isoladamente).

- 26 verdes, 2 vermelhos: `ui:operational-customization:verify` e `ui:consistency:verify`.
- Não executados individualmente: `e2e:installed:verify` (exige pacote instalado) e
  `packaged:*` (exigem release).

## 2. Prova de causa (executada nesta worktree, 14/09/2026)

```text
$ git show v1.1.17-baseline:src/pages/LancamentoPesagensIndividuais.jsx | grep -c GerenciarSaidasDialog
0
```

## 3. Após a correção (`8c79022`)

`npm.cmd run test:quick` → exit 0, 20/20:

```text
lint · release:current-only · runtime:legacy · ui:locale-dialog · ui:operational-customization ·
animal:history-integrity · import:selection · ui:scrollbar-contract · ui:consistency ·
weighing:calculations · perf:contract · enterprise:hardening · main:boot · preload:contract ·
storage:dexie · storage:first-run · storage:ui-first-run-persistence · storage:maintenance-ui-flow ·
storage:legacy-detached · desktop:smoke
```

## 4. Reprodução no marco 1.1.18

A mesma suíte, com o gate `release:version-contract:verify` acrescentado, foi executada na
worktree `release/1.1.18`: resultado em `docs/evidence/s00-versioning-auth-contract/TESTS.md`
(21/21). Os dois gates corrigidos continuam verdes sem nenhuma alteração adicional.
