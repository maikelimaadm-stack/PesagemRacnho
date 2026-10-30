# Checklist da release 1.6.0

Versão 1.6.0 (missão pesagens-integrada) · Dexie 9 · backup 3 (+ `.anexos`) · `signed=false` · **sem tag**.

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.6.0.
- [x] CHANGELOG `## [1.6.0] — 2026-10-30`.
- [x] Docs de usuário citam 1.6.0 e o banco 9.

## Validações
- [x] `npm run release:version-contract:verify`
- [x] `npm run docs:user:verify`
- [x] `npm run test:quick` e `npm run e2e:electron:verify` (workflow Testes)
- [ ] `npm run dist:unsigned` (workflow "Gerar instalador"), com `packaged:build:verify`
- [ ] Migração real 1.5.x → 1.6.0 numa cópia do banco do proprietário (backup pré-migração gerado e verificado)
- [ ] P16 — balança S3 física no Windows (`VALIDACAO-MANUAL-WINDOWS-S3.md`)
- [ ] P18 — proteção da main (ação do proprietário, `RECOMENDACAO-P18.md`)
- [ ] Merge e tag **somente** pelo proprietário
