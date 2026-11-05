# Checklist da release 1.6.2

Versão 1.6.2 · Dexie 9 · backup 3 · `signed=false` · **sem tag**.

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.6.2.
- [x] CHANGELOG `## [1.6.2] — 2026-11-05`.
- [x] Docs de usuário citam 1.6.2 (instalação e teste em máquina limpa).

## Validações
- [x] `npm run release:version-contract:verify`
- [x] `npm run docs:user:verify`
- [x] `npm run test:quick` e E2E do Lançamento e dos filtros (workflow Testes)
- [ ] `npm run dist:unsigned` (workflow "Gerar instalador"), com `packaged:build:verify`
- [ ] Balança S3 física no Windows: balança sem tara, "Liberar peso"
