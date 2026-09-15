# Versionamento — Pesagens Individuais

**Vigente desde 1.1.18 (14/09/2026).** Base normativa: ADR-037, ADR-039, ADR-047 e ADR-048
(`docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md`) e o contrato
`docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` (revisão 2). Este documento explica, em
linguagem de engenharia, como os números são usados no código e nos gates. Onde houver diferença,
as ADRs prevalecem.

## 1. Quatro eixos que nunca se confundem

| Eixo | Constante | Onde vive (fonte única) | Valor em 1.1.18 | Quando muda |
|---|---|---|---|---|
| Versão do aplicativo | `APP_VERSION` | `package.json` → Vite injeta `__APP_VERSION__`; fallback literal em `src/lib/appVersion.js`; Electron lê `app.getVersion()` do mesmo `package.json` | 1.1.18 | a cada release (SemVer, §2) |
| Esquema do banco | `DB_SCHEMA_VERSION` (= `DB_VERSION`) | `src/storage/indexedDb/schema.js` | 6 | só com migração testada e backup físico prévio (documento 14) |
| Formato do backup | `BACKUP_FORMAT_VERSION` | `src/versioning/versionInfo.js` (o módulo de backup importa daqui) | 2 | quando o JSON de backup ganha/perde campos ou stores; o formato anterior continua restaurável |
| Formato do manifesto de release | `RELEASE_MANIFEST_VERSION` | `scripts/generate-release-manifest.mjs` (dono); `versionInfo.js` reexporta o mesmo valor para a UI | 2 | quando `release-manifest.json` ganha/perde campos |

Os quatro números são independentes. Uma release PATCH pode subir o app sem tocar no esquema; uma
release MINOR pode subir esquema e formato de backup ao mesmo tempo; o manifesto muda por razões
de ferramenta, não de produto. O gate `release:version-contract:verify` prova que
`RELEASE_MANIFEST_VERSION` é o mesmo no gerador e em `versionInfo.js`.

`src/versioning/versionInfo.js` reúne tudo em `describeVersions()`:

```js
{
  app, dbSchema, backupFormat, releaseManifest,
  uiContract, dataContract, uiBuildId, dataBuildId, uiModel, uiVersion,
  gitCommit, buildTimestamp
}
```

## 2. SemVer do aplicativo

| Parte | Regra | Exemplos |
|---|---|---|
| **PATCH** (1.1.17 → 1.1.18) | correção, refatoração, documentação, gates, marcadores de build; **nenhum** contrato persistente muda (esquema, formato de backup, export/import, IPC) | 1.1.18: contrato de versão, gate novo, docs de engenharia, correção de dois gates |
| **MINOR** (1.1.x → 1.2.0) | funcionalidade nova; store nova; migração de esquema **compatível** (backup anterior continua restaurável; dados existentes preservados por backfill) | 1.2.0: Dexie v7, usuários, cadastros mestres, backup formato 3 |
| **MAJOR** (1.x → 2.0) | quebra deliberada de backup, export/import ou API local; exige plano de conversão documentado | ainda não previsto no roadmap |

Regras práticas:

- Toda versão nasce de `package.json` e `package-lock.json` sincronizados (`version` e
  `packages[""].version`). O fallback de `src/lib/appVersion.js` acompanha para que gates Node e
  ferramentas de migração vejam a mesma versão sem o bundler.
- Nunca reutilizar um número: se 1.1.18 foi taggeada e algo precisa mudar, nasce 1.1.19.
- Pré-release (`1.2.0-rc.1`) só se houver distribuição de candidato; hoje não há.

## 3. Marcadores de build (não são versões)

| Marcador | Onde | Uso |
|---|---|---|
| `UI_BUILD_ID`, `UI_MODEL`, `UI_VERSION` | `src/components/modelobase1/uiBuildInfo.js` (dono: agente de UI) | prova que o bundle empacotado é o mesmo da árvore (`packaged:ui-build:verify`) |
| `UI_CONTRACT_VERSION` | `versionInfo.js` (`ModeloBase1-R34` em 1.1.18) | identifica o contrato visual protegido por `ui:consistency:verify` |
| `DATA_CONTRACT_VERSION` | `versionInfo.js` (1 em 1.1.18) | identifica o contrato de campos/fórmulas (documento 12 passa a 2 em 1.2.0) |
| `DATA_BUILD_ID` | `versionInfo.js` (`schema-v6`) | rótulo derivado do esquema, para logs e manifesto |
| `gitCommit`, `buildTimestamp` | `__BUILD_INFO__` injetado por `vite.config.js` (`git rev-parse --short HEAD`, ISO do build); em Node ficam `null` | exibidos em Manutenção › Status › Versões e no manifesto |

Marcadores mudam sem SemVer e sem migração; servem para responder "que build é este?".

## 4. Onde cada número aparece

| Lugar | Conteúdo |
|---|---|
| Sistema › Backup e Manutenção › Status do banco › **Versões** | Aplicativo, Esquema do banco, Formato do backup, Manifesto, Build (commit · data), Contrato UI/dados |
| Botão **Copiar diagnóstico** | os mesmos campos, em texto, mais estatísticas e caminho do log |
| `release-manifest.json` | `releaseManifestVersion, productName, appVersion, version, dbSchemaVersion, backupFormatVersion, uiBuildId, dataBuildId, uiContract, dataContract, gitCommit, buildTimestamp, platform, arch, installer{file,sha256,sizeBytes,builtAt}, signed, distribution, features` |
| Backup JSON (`manifest`) | `appVersion`, `dbVersion`, `formatVersion` (= `BACKUP_FORMAT_VERSION`) |
| `CHANGELOG.md` | um bloco `## [X.Y.Z] — AAAA-MM-DD` por versão, seções Added / Changed / Fixed / Removed / Migration / Security |
| `docs/release/<versão>/` | `RELEASE-NOTES.md`, `RELEASE-CHECKLIST.md` (e `MIGRATION-*.md` quando o esquema muda) |

## 5. Gate `release:version-contract:verify`

`scripts/verify-version-contract.mjs` (em `test:quick` e `test:full`, logo após
`release:current-only:verify`) falha se:

- `package.json`, `package-lock.json` (`version` e `packages[""].version`) ou o fallback de
  `appVersion.js` divergirem;
- `docs/release/<versão>/RELEASE-NOTES.md` ou `RELEASE-CHECKLIST.md` faltarem ou não citarem a versão;
- `CHANGELOG.md` não tiver `## [<versão>] — AAAA-MM-DD` com data ISO real, ou ainda tiver bloco
  "Não lançado";
- `release/` ou `release-unsigned/` tiverem `release-manifest.json` de outra versão ou um Setup de
  outra versão (artefato antigo nunca é "current"; pastas ausentes são aceitas);
- `RELEASE_MANIFEST_VERSION` divergir entre gerador e `versionInfo.js`.

`node scripts/verify-version-contract.mjs --self-test` prova o próprio gate com fixtures positivas e
negativas em pasta temporária.

## 6. Marcos do programa (ADR-047)

| Marco | App | Esquema | Backup | Manifesto | Conteúdo |
|---|---|---|---|---|---|
| **1.1.18** | 1.1.18 | 6 | 2 | 2 | baseline verde, contrato de versão, ADRs 041–048, docs de engenharia, gate `release:version-contract`; **sem esquema novo** |
| 1.2.0 | 1.2.0 | 7 | 3 | 2 | usuários e login local, cadastros mestres, preflight/backfill, Lançamento seleciona cadastros |
| 1.3.0 | 1.3.0 | 7 | 3 | 2 | faixas/exceções de identificadores, resolução indexada, tela Faixas |
| 1.4.0 | 1.4.0 | 7 | 3 | 2 | lançamento enxuto, Apartações/Lotes, contexto de sessão |
| 1.5.0 | 1.5.0 | 8 | 3 | 2 | operações comerciais, embarques com estados, relatórios mínimos |
| 1.6.0 | 1.6.0 | 8 | 3 | 2 | sessão real, fechamento, Animais/ficha, auditoria consolidada |

Valores de esquema/backup dos marcos futuros são os previstos no documento 13; só valem quando o
respectivo marco for taggeado com gates verdes. Cada marco deixa `package.json`, CHANGELOG,
`docs/release/<versão>/` e `docs/evidence/<slice>/` coerentes para rollback e `git bisect`.

## 7. Como subir a versão (passo a passo)

1. Decidir PATCH/MINOR/MAJOR pela tabela do §2.
2. Editar `package.json`, `package-lock.json` (dois campos) e o fallback de `src/lib/appVersion.js`.
3. Se o esquema mudar: `DB_VERSION` em `schema.js`, `BACKUP_FORMAT_VERSION` em `versionInfo.js`,
   `DATA_CONTRACT_VERSION`, migração conforme documento 14 e `MIGRATION-*.md` na pasta da release.
4. Consolidar o CHANGELOG no bloco da versão com a data real.
5. Criar `docs/release/<versão>/RELEASE-NOTES.md` e `RELEASE-CHECKLIST.md`; atualizar `docs/user`.
6. `npm run test:quick` (inclui o gate de versão) e `npm run build`.
7. Seguir `docs/engineering/RELEASE-POLICY.md` para pacote, checksum, manifesto e tag.
