# Checklist da release 1.5.5

Versão 1.5.5 (primeira gerada no GitHub Actions) · Dexie 8 · backup 3 · `signed=false`.

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.5.5.
- [x] CHANGELOG `## [1.5.5] — 2026-10-29`.
- [x] Docs de usuário citam 1.5.5.

## Validações
- [ ] `npm run release:version-contract:verify`
- [ ] `npm run docs:user:verify`
- [ ] `npm run dist:unsigned` (workflow "Gerar instalador"), com `packaged:build:verify`
- [ ] Conferir `Pesagens Individuais Setup 1.5.5.exe` nos Artifacts / Releases
