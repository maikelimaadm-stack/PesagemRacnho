# Checklist da release 1.5.0

Versão 1.5.0 (1.4.2 + M1 — fundação do número) · esquema Dexie 8 (sem mudança) · backup formato 3 · `signed=false` · branch
`program/m1-fundacao-numero` (main só avança com autorização da responsável).

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.5.0.
- [x] CHANGELOG `## [1.5.0] — 2026-10-01`.
- [x] `INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md` citam a 1.5.0.

## Validações automatizadas
- [ ] `npm run test:quick` completo verde.
- [ ] `npm run release:version-contract:verify`.
- [ ] `npm run docs:user:verify`.
- [ ] Tudo commitado ANTES do build (manifesto com `gitCommit` sem "-dirty").
- [ ] `npm run dist:unsigned` (build + checksum + manifesto + `diagnostic:packaged:source:verify` +
      `diagnostic:packaged:build:verify` (packaged:build:verify) + `diagnostic:e2e:verify`).
- [ ] SHA-256 do `Pesagens Individuais Setup 1.5.0.exe` no REPORT da M1 e cópia em `..\INSTALAR-ESTE-1.5.0\`.

## Teste físico
- [ ] Balança, impressora, curral: **não executado** (teste da responsável).
