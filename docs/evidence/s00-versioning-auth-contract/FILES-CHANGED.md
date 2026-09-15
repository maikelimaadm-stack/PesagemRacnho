# S-00.1 — Arquivos criados e alterados (marco 1.1.18)

Worktree `C:\Users\maike\Desktop\projeto\MAKGESTAO-1.1.18`, branch `release/1.1.18`, derivada de
`e4d4278` (antes do esquema v7). Caminhos relativos à raiz. Nenhum arquivo em `MAKGESTAO-main`
foi editado; os documentos marcados "copiado" vieram de lá em leitura.

## Criados

| Arquivo | Conteúdo |
|---|---|
| `src/versioning/versionInfo.js` | quatro eixos (`APP_VERSION`, `DB_SCHEMA_VERSION`=6, `BACKUP_FORMAT_VERSION`=2, `RELEASE_MANIFEST_VERSION`=2), marcadores (`UI_CONTRACT_VERSION`=`ModeloBase1-R34`, `DATA_CONTRACT_VERSION`=1, `DATA_BUILD_ID`=`schema-v6`, reexport de `UI_BUILD_ID/UI_MODEL/UI_VERSION`), `BUILD_INFO` via `__BUILD_INFO__` com fallback nulo em Node, `describeVersions()` |
| `scripts/verify-version-contract.mjs` | gate (a)–(f) + `--self-test` (2 fixtures positivas, 11 negativas em pasta temporária); exporta `verifyVersionContract`, `readAppVersionFallback` |
| `docs/engineering/VERSIONING.md` | quatro eixos, SemVer PATCH/MINOR/MAJOR, marcadores, onde cada um vive, gate, marcos 1.1.18…1.6.0, passo a passo |
| `docs/engineering/RELEASE-POLICY.md` | build limpo, pastas `release/` × `release-unsigned/`, `signed=false` sem Authenticode, sequência obrigatória, checksum/manifesto, gates, rollback, tag após gate, sem publicação remota sem autorização, teste físico declarado |
| `docs/engineering/AUTH-THREAT-MODEL.md` | o que o login local de 1.2.0 protege e o que não protege; sem criptografia total do banco; PBKDF2; recovery key; sessão em memória; fora de escopo |
| `docs/release/1.1.18/RELEASE-NOTES.md` | notas do marco (instalador não gerado; teste físico NÃO EXECUTADO) |
| `docs/release/1.1.18/RELEASE-CHECKLIST.md` | só o que foi executado de verdade |
| `docs/evidence/STATE-OF-REPO-BEFORE.md` | copiado do repositório principal |
| `docs/evidence/s00-baseline-recovery/{REPORT,FILES-CHANGED,TESTS,RISKS,ROLLBACK}.md` | evidência da S-00.0 |
| `docs/evidence/s00-versioning-auth-contract/{REPORT,FILES-CHANGED,TESTS,RISKS,ROLLBACK}.md` | evidência desta fatia |

## Alterados

| Arquivo | Mudança |
|---|---|
| `package.json` | `version` 1.1.17 → 1.1.18; script `release:version-contract:verify`; `test:quick` e `test:full` chamam o gate logo após `release:current-only:verify` |
| `package-lock.json` | `version` e `packages[""].version` → 1.1.18 (somente essas duas linhas) |
| `src/lib/appVersion.js` | fallback `'1.1.16'` → `'1.1.18'` |
| `vite.config.js` | `define.__BUILD_INFO__` = `{ gitCommit: git rev-parse --short HEAD (try/catch → null), buildTimestamp: ISO }`; nada mais mudou |
| `src/storage/indexedDb/backup/backupService.js` | `const BACKUP_FORMAT_VERSION = 2` substituída por `import { BACKUP_FORMAT_VERSION } from '../../../versioning/versionInfo.js'` (valor 2; comportamento idêntico). `schema.js` não foi tocado |
| `scripts/generate-release-manifest.mjs` | manifesto formato 2 (campos em `VERSIONING.md` §4), `version` mantido para `verify-packaged-ui-build.mjs`, `signed: false` fixo, `export const RELEASE_MANIFEST_VERSION`, `buildReleaseManifest`/`writeReleaseManifest`/`resolveGitCommit` exportados, execução só quando é o módulo principal |
| `src/pages/ManutencaoSistema.jsx` | importa `describeVersions`/`BUILD_INFO`; bloco **Versões** no cartão Status do banco (Aplicativo, Esquema do banco, Formato do backup, Manifesto, Build commit · data, Contrato UI/dados); "Copiar diagnóstico" inclui os mesmos campos. Sem as palavras proibidas por `verify-maintenance-ui-contract.mjs` e `verify-desktop-smoke.mjs` |
| `CHANGELOG.md` | os três blocos "Não lançado" (Tela Mãe 14/09, design Lançamento 09/09, F0) consolidados em `## [1.1.18] — 2026-09-14` com Added/Changed/Fixed/Removed/Migration/Security, incluindo as entregas do marco; histórico 1.1.16 e anteriores intacto |
| `docs/user/INSTALACAO-WINDOWS.md` | cita 1.1.18, diz que o instalador ainda não foi gerado, explica onde conferir as versões |
| `docs/user/TESTE-MAQUINA-LIMPA.md` | cita 1.1.18 (NÃO EXECUTADO) e os valores esperados no bloco Versões |
| `.gitignore` | `release/` e `release-unsigned/` ancorados na raiz (`/release/`, `/release-unsigned/`): o padrão antigo ignorava `docs/release/**`, e as notas/checklist da versão nunca entrariam no git |
| `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` | copiado (ADR-041…048) |
| `docs/arquitetura-produto/10-MODELO-PRODUTO-2.0.md` | copiado (rev. 2, marcos 1.1.18…1.6.0) |
| `docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md` | copiado (rev. 2) |
| `docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md` | copiado (rev. 2) |
| `docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` | copiado (rev. 2) |
| `docs/arquitetura-produto/14-MIGRACOES.md` | copiado; idêntico ao já existente (sem diff) |

## Não alterados (de propósito)

`src/storage/indexedDb/schema.js` (`DB_VERSION = 6`), `src/components/modelobase1/uiBuildInfo.js`,
`electron/**`, `src/Layout.jsx`, `src/pages.config.js`, todos os demais gates. Nenhuma dependência
nova; `node_modules` é junção para o repositório principal.
