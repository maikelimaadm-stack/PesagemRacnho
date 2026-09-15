# Checklist da release 1.1.18

Marco 1.1.18 (baseline + contrato de versão, sem esquema novo). Marcado só o que foi executado de
verdade nesta árvore (`release/1.1.18`, derivada de `e4d4278`). Política:
`docs/engineering/RELEASE-POLICY.md`.

## Versão e documentação

- [x] `package.json` e `package-lock.json` (`version` e `packages[""].version`) em 1.1.18.
- [x] Fallback de `src/lib/appVersion.js` em 1.1.18.
- [x] `CHANGELOG.md` com bloco `## [1.1.18] — 2026-09-14` (Added/Changed/Fixed/Removed/Migration/Security) e
      sem blocos "Não lançado".
- [x] `docs/release/1.1.18/RELEASE-NOTES.md` e este checklist.
- [x] `docs/user/INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md` citam 1.1.18 sem afirmar que existe instalador.
- [x] ADR-041…048, contratos 10–14 (rev. 2) e `STATE-OF-REPO-BEFORE.md` presentes na árvore.
- [x] `docs/engineering/VERSIONING.md`, `RELEASE-POLICY.md`, `AUTH-THREAT-MODEL.md`.

## Automatizado (executado nesta árvore em 14/09/2026)

- [x] `npm run lint`.
- [x] `npm run build` (vite build; `__APP_VERSION__` e `__BUILD_INFO__` injetados).
- [x] `npm run release:version-contract:verify`.
- [x] `node scripts/verify-version-contract.mjs --self-test` (fixtures positivas e negativas).
- [x] `npm run docs:user:verify`.
- [x] `npm run test:quick` (21 verificações, incluindo o gate de versão).
- [x] `npx eslint src/pages/ManutencaoSistema.jsx`.
- [x] Gates que inspecionam a página de Manutenção (`maintenance:ui`, `desktop:smoke`,
      `storage:maintenance-ui-flow`, `storage:legacy-detached`) verdes após o cartão Versões.

Resultados e tempos: `docs/evidence/s00-versioning-auth-contract/TESTS.md`.

## Pacote (não executado neste marco)

- [ ] `npm run release:clean` → `npm run build` → electron-builder — **instalador não gerado neste marco**.
- [ ] `packaged:source:verify` / `packaged:ui-build:verify` — exigem pacote.
- [ ] `release:checksum` / `release:manifest` — exigem pacote.
- [ ] `e2e:installed:verify` — exige pacote instalado.
- [ ] Assinatura Authenticode e carimbo de tempo — sem certificado; `signed=false`.

## Manual / físico

- [ ] Instalação interativa em máquina limpa — **NÃO EXECUTADO**.
- [ ] Teste com balança real — **NÃO EXECUTADO**.
- [ ] Teste com bastão RFID real — **NÃO EXECUTADO**.
- [ ] Conferência visual do cartão Versões no app empacotado — **NÃO EXECUTADO** (verificado só por
      gates estáticos e build).

## Git (responsabilidade do orquestrador)

- [ ] Commit do marco na branch `release/1.1.18`.
- [ ] Tag local `v1.1.18` após o gate.
- [ ] Nenhuma publicação remota sem autorização.
