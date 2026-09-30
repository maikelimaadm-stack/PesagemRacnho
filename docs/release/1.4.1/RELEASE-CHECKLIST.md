# Checklist da release 1.4.1

Versão 1.4.1 (1.4.0 + E1F) · esquema Dexie 8 (sem mudança) · backup formato 3 · `signed=false` · branch
`program/e1-relatorios` (main só avança com autorização da responsável).

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.4.1.
- [x] CHANGELOG `## [1.4.1] — 2026-09-30`.
- [x] `INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md` citam a 1.4.1.

## Validações automatizadas
- [ ] `npm run test:quick` completo verde.
- [ ] `npm run release:version-contract:verify`.
- [ ] `npm run docs:user:verify`.
- [ ] Tudo commitado ANTES do build (manifesto com `gitCommit` sem "-dirty").
- [ ] `npm run dist:unsigned` (build + checksum + manifesto + `diagnostic:packaged:source:verify` +
      `diagnostic:packaged:build:verify` (packaged:build:verify) + `diagnostic:e2e:verify`).
- [ ] SHA-256 do `Pesagens Individuais Setup 1.4.1.exe` no REPORT da E1F e cópia em `..\INSTALAR-ESTE-1.4.1\`.

## Teste físico
- [ ] Balança, impressora, curral: **não executado** (teste da responsável).
