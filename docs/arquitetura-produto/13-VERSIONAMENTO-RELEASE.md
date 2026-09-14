# 13 — Versionamento e política de release (contrato de implementação)

**Programa 2.0 · 14/09/2026 · ADR-037, ADR-039, ADR-040.**

## 1. Cinco versões, um único módulo

`src/versioning/versionInfo.js`:

```js
import { APP_VERSION } from '../lib/appVersion.js';            // derivada de package.json (Vite define __APP_VERSION__)
import { DB_VERSION } from '../storage/indexedDb/schema.js';   // DB_SCHEMA_VERSION
import { UI_BUILD_ID, UI_MODEL, UI_VERSION } from '../components/modelobase1/uiBuildInfo.js';

export const DB_SCHEMA_VERSION = DB_VERSION;        // 7 na 1.2.0, 8 na 1.4.0
export const BACKUP_FORMAT_VERSION = 3;             // 2 até 1.1.17
export const UI_CONTRACT_VERSION = 'ModeloBase1-2.0';
export const DATA_CONTRACT_VERSION = 2;             // 1 até 1.1.17; 3 na v8
export const DATA_BUILD_ID = 'schema-v7';           // 'schema-v8' na 1.4.0
export { APP_VERSION, UI_BUILD_ID, UI_MODEL, UI_VERSION };
export function describeVersions() { return { app, dbSchema, backupFormat, uiContract, dataContract, uiBuildId, dataBuildId }; }
```

Regras: `APP_VERSION` nunca é digitada em outro lugar; `backupService` importa `BACKUP_FORMAT_VERSION` daqui; `uiBuildInfo.js` continua sendo o dono de `UI_BUILD_ID` (atualizado a cada release visual: `2.0-modelobase1-r<N>`); `DATA_BUILD_ID` muda quando o esquema muda.

## 2. Onde as versões aparecem

| Lugar | Conteúdo |
|---|---|
| Manutenção › Status | Aplicativo, Banco (schema), Backup (formato), Build UI, Build dados, Contrato UI, Contrato dados, Instalador (nome do Setup quando empacotado) |
| Copiar diagnóstico | as mesmas + perfil do usuário atual, estado de migração (`migration:vN`), status do IndexedDB, último backup; **nunca senha/hash** |
| Login | versão do app, discreta |
| Topbar | versão do app |
| `release-manifest.json` | `version, dbSchema, backupFormat, uiContract, dataContract, uiBuildId, dataBuildId, installer{file,sha256,sizeBytes,builtAt}, signed, distribution` |
| Backup JSON | `manifest.appVersion, dbVersion, formatVersion, dataContractVersion, uiBuildId` |

## 3. Roadmap de releases

| Versão | Conteúdo | Schema | Backup |
|---|---|---|---|
| 1.2.0 | Git, ADRs, gates verdes, login local, usuários/RBAC, Dexie v7, cadastros mestres, sanidade removida, migration coordinator | 7 | 3 |
| 1.3.0 | faixas/exceções, identificadores, Animais/Ficha, Apartações/Lotes, Lançamento enxuto | 7 | 3 |
| 1.4.0 | Dexie v8, operações comerciais, embarques, parceiros por id, retorno de frigorífico | 8 | 3 |
| 1.5.0 | sessões, fechamento, snapshot, pendências, relatórios mínimos, auditoria melhorada | 8 | 3 |
| 2.0.0 | estabilização, migrações certificadas, UI final, instalador, máquina limpa, docs | 8 | 3 |

## 4. Política de release (cada versão)

1. `package.json` e `package-lock.json` sincronizados na versão.
2. `npm run release:clean` → `npm run build` → `electron-builder --win` (assinado em `release/`; sem certificado, `dist:unsigned` em `release-unsigned/` com `signed=false`).
3. `packaged:build:verify` (`scripts/verify-packaged-build.mjs`): versão do `package.json` = `app.asar` = manifesto; `app.asar` contém `UI_BUILD_ID`, `DB_SCHEMA_VERSION` e `DATA_BUILD_ID`; `dist/assets` contém os mesmos marcadores; `Setup` não é anterior aos bundles (mtime) e o nome é `Pesagens Individuais Setup X.Y.Z.exe`; `release-manifest.json` com SHA-256 e tamanho conferidos. Substitui/estende `verify-packaged-ui-build.mjs`.
4. `release:checksum` (`.sha256`) e `release:manifest` (campos de §2).
5. Nunca reutilizar `.exe` antigo; `release:current-only:verify` garante um único Setup da versão atual.
6. Notas de release em `docs/release/<versão>/RELEASE-NOTES.md` + `RELEASE-CHECKLIST.md`; `docs/user` atualizado; `docs:user:verify` verde.
7. Teste instalado (abre, login, banco, persistência, backup, fechar/abrir, versão, UI). Sem GUI disponível ao agente → `MANUAL PENDENTE`, nunca "aprovado".
8. Tag `vX.Y.Z` só após o gate da release.

## 5. CHANGELOG

Um bloco por versão, sem múltiplos "Não lançado":

```
## [1.2.0] — 2026-09-XX
### Added
### Changed
### Fixed
### Removed
### Migration
### Security
```

O bloco "Não lançado" existente é consolidado no primeiro release do programa.

## 6. Git

- `main`: só integrações de release (merge de `program/2.0` com tag).
- `program/2.0`: integração contínua do programa; commits semânticos (`feat(auth): …`, `feat(storage): …`, `test(...)`, `docs(...)`, `refactor(launch): …`).
- Agentes trabalham em áreas disjuntas na mesma árvore ou em worktrees próprias; **nunca** dois agentes no mesmo arquivo compartilhado (`schema.js`, `package.json`, `pages.config.js`, `Layout.jsx`, `d17b-modelobase1.css`, `verify-ui-consistency.mjs`, `CHANGELOG.md`, `App.jsx`), que pertencem ao coordenador.
- Tags: `v1.1.17-baseline` (existente), `v1.2.0`, `v1.3.0`, `v1.4.0`, `v1.5.0`, `v2.0.0`.
