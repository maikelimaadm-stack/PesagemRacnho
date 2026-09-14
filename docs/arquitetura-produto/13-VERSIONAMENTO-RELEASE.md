# 13 — Versionamento e política de release (contrato de implementação)

**Programa 1.1.17 → 1.6.0 · ADR-047, ADR-048 (DEC-030) · revisão 2 (14/09/2026).**

## 1. Quatro versões que nunca se confundem

| Eixo | Onde vive | Valor no início | Regra |
|---|---|---|---|
| App SemVer | `package.json` → Electron `app.getVersion()`; renderer via constante de build (`__APP_VERSION__`, Vite) | 1.1.17 | PATCH correção; MINOR funcionalidade/store/migração compatível; MAJOR quebra deliberada de backup/export/API local |
| `DB_SCHEMA_VERSION` | `src/storage/indexedDb/schema.js` (`DB_VERSION`) | 6 → 7 (1.2.0) → 8 (1.5.0) | só muda com migração testada e backup prévio |
| `BACKUP_FORMAT_VERSION` | módulo de backup (importado de `src/versioning/versionInfo.js`) | 2 → 3 (1.2.0) | formato anterior continua restaurável |
| `RELEASE_MANIFEST_VERSION` | `scripts/generate-release-manifest.mjs` | 1 → 2 (1.1.18) | muda quando o manifesto ganha/perde campos |

Marcadores de build (não são versões): `UI_BUILD_ID`, `DATA_BUILD_ID`, `UI_CONTRACT_VERSION`, `DATA_CONTRACT_VERSION`, `gitCommit`, `buildTimestamp` — todos reunidos por `describeVersions()` em `src/versioning/versionInfo.js`. `gitCommit`/`buildTimestamp` entram como constantes de build (`__BUILD_INFO__`, Vite) quando disponíveis.

## 2. Onde aparecem

| Lugar | Conteúdo |
|---|---|
| Sistema › Backup e Manutenção › Status (e "Sobre") | app, esquema, formato de backup, manifesto, commit/build, contrato UI/dados |
| Copiar diagnóstico | idem + papel do usuário atual + estado de migração + último backup; nunca senha/hash/recovery |
| Login e topbar | versão do app, discreta |
| `release-manifest.json` | `releaseManifestVersion, appVersion, dbSchemaVersion, backupFormatVersion, gitCommit, buildTimestamp, platform, arch, installer{file,sha256,sizeBytes,builtAt}, signed, distribution, uiBuildId, dataBuildId, uiContract, dataContract` |
| Backup JSON | `manifest.appVersion, dbVersion, formatVersion, dataContractVersion, uiBuildId` |

## 3. Marcos

| Marco | Conteúdo | Esquema | Backup |
|---|---|---|---|
| 1.1.18 | baseline verde (S-00.0), contrato de versão, ADRs, docs de engenharia, gate `release:version-contract`, notas e CHANGELOG; **sem esquema novo** | 6 | 2 |
| 1.2.0 | Dexie v7 (usuários, cadastros, identidade), preflight/backfill, backup 3, login/papéis/recovery, telas de cadastros, Lançamento seleciona cadastros | 7 | 3 |
| 1.3.0 | faixas/exceções, identificadores, resolução indexada, tela Faixas | 7 | 3 |
| 1.4.0 | lançamento enxuto, Apartações/Lotes, contexto de sessão | 7 | 3 |
| 1.5.0 | Dexie v8, operações comerciais, embarques, relatórios mínimos | 8 | 3 |
| 1.6.0 | sessão real, fechamento, Animais/ficha, auditoria consolidada | 8 | 3 |

Cada marco deixa `package.json`, CHANGELOG, `docs/release/<versão>/` e evidência coerentes (rollback/bisect). Nenhum marco é publicado remotamente sem autorização; tags locais só após o gate do marco.

## 4. Política de release

1. `package.json` e `package-lock.json` sincronizados.
2. `release:clean` → `build` → electron-builder (assinado em `release/`; sem certificado, `dist:unsigned` em `release-unsigned/`, `signed=false`).
3. `packaged:build:verify` (versões = `app.asar` = manifesto; marcadores no bundle e no asar; Setup não anterior aos bundles; nome `Pesagens Individuais Setup X.Y.Z.exe`).
4. `release:version-contract:verify`: `package.json` = manifesto = `docs/release/<versão>/`; nenhum release anterior sobrescrito; artefatos antigos nunca aparecem como "current"; CHANGELOG com bloco `## [versão]` e data real.
5. `release:checksum` (`.sha256`) e `release:manifest`.
6. Notas, checklist e `MIGRATION-*.md` em `docs/release/<versão>/`; `docs/user` atualizado; `docs:user:verify` verde.
7. Teste instalado automatizado (smoke) + teste físico declarado EXECUTADO só com evidência humana; caso contrário NÃO EXECUTADO.
8. Tag `vX.Y.Z` após o gate.

## 5. CHANGELOG

Um bloco por versão com data real: `## [X.Y.Z] — AAAA-MM-DD` e seções Added / Changed / Fixed / Removed / Migration / Security. Sem múltiplos "Não lançado".

## 6. Git e fatias

`main` = baseline; `program/pesagens-master-evolution` = integração; `slice/sNN-*` quando possível. Dono único por fatia; arquivos compartilhados (`schema.js`, `package.json`, `pages.config.js`, `Layout.jsx`, `App.jsx`, `d17b-modelobase1.css`, `verify-ui-consistency.mjs`, `CHANGELOG.md`, `vite.config.js`) pertencem ao orquestrador. Sem merge/push em `main` e sem release remota sem autorização.
