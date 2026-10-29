# Checklist da release 1.5.6

Versão 1.5.6 (Electron 44, listas atualizadas entre telas) · Dexie 8 · backup 3 · `signed=false`.

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.5.6.
- [x] CHANGELOG `## [1.5.6] — 2026-10-29`.
- [x] Docs de usuário citam 1.5.6.

## Validações
- [ ] `npm run release:version-contract:verify`
- [ ] `npm run docs:user:verify`
- [ ] `npm run test:quick` e `npm run e2e:electron:verify` (workflow Testes)
- [ ] `npm run dist:unsigned` (workflow "Gerar instalador"), com `packaged:build:verify`
- [ ] Balança real: conexão, pesagem automática e estabilização no Electron 44
- [ ] Conferir `Pesagens Individuais Setup 1.5.6.exe` nos Artifacts / Releases
