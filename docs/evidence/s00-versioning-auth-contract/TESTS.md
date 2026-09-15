# S-00.1 — Testes executados (marco 1.1.18)

**Onde:** worktree `C:\Users\maike\Desktop\projeto\MAKGESTAO-1.1.18` (branch `release/1.1.18`,
HEAD `e4d4278` + alterações do marco não commitadas) · **Quando:** 14/09/2026 · **Node/npm:** os do
repositório principal (`node_modules` por junção) · **Instalador:** não gerado; nenhum gate de
pacote executado.

## 1. Comandos obrigatórios do marco

| # | Comando | Exit | Tempo | Resultado |
|---|---|---|---|---|
| 1 | `npm.cmd run lint` | 0 | 18 s | `eslint .` sem erros |
| 2 | `npm.cmd run build` | 0 | 71 s | `vite build` ok; bundle `dist/assets/index-*.js` contém `gitCommit:"e4d4278"` (`__BUILD_INFO__`) e `ModeloBase1-R34` |
| 3 | `npm.cmd run release:version-contract:verify` | 0 | < 1 s | `OK verify-version-contract` — 11 checagens (JSON abaixo) |
| 4 | `node scripts/verify-version-contract.mjs --self-test` | 0 | < 1 s | 13 cenários corretos: 2 positivos, 11 negativos |
| 5 | `npm.cmd run docs:user:verify` | 0 | 2 s | 8 documentos OK, incluindo `docs/release/1.1.18/RELEASE-NOTES.md` e `RELEASE-CHECKLIST.md` |
| 6 | `npm.cmd run test:quick` | 0 | 40 s | **21/21** verificações verdes (lista em §2) |
| 7 | `npx eslint src/pages/ManutencaoSistema.jsx` | 0 | — | sem erros |

Gates que inspecionam `ManutencaoSistema.jsx`, executados isoladamente após o bloco Versões:
`maintenance:ui:verify`, `desktop:smoke:verify`, `storage:maintenance-ui-flow:verify`,
`storage:legacy-detached:verify` → todos `OK`. Varredura das palavras proibidas pelos dois primeiros
(`login`, `senha`, `RBAC`, `autentic`, `permissão`, `ipcRenderer`) na página: nenhuma ocorrência.

## 2. `test:quick` — ordem executada (exit 0)

```text
lint · release:current-only:verify · release:version-contract:verify · runtime:legacy:verify ·
ui:locale-dialog:verify · ui:operational-customization:verify · animal:history-integrity:verify ·
import:selection:verify · ui:scrollbar-contract:verify · ui:consistency:verify ·
weighing:calculations:verify · perf:contract:verify · enterprise:hardening:verify ·
main:boot:verify · preload:contract:verify · storage:dexie:verify · storage:first-run:verify ·
storage:ui-first-run-persistence:verify · storage:maintenance-ui-flow:verify ·
storage:legacy-detached:verify · desktop:smoke:verify
```

Linhas `OK` do log (20 gates + lint):

```text
OK release: pastas de artefatos ainda não existem.
OK verify-version-contract
OK verify-no-legacy-runtime
OK verify-brazilian-format-contract
OK verify-operational-customization
OK verify-animal-history-integrity
OK verify-import-selection
OK verify-scrollbar-contract
OK verify-ui-consistency
OK verify-weighing-calculations
OK verify-perf-baseline-contract
OK verify-enterprise-hardening
OK verify-main-boot
OK verify-preload-contract
OK verify-dexie-storage
OK verify-dexie-first-run
OK verify-dexie-ui-first-run-persistence
OK verify-dexie-maintenance-ui-flow
OK verify-no-legacy-storage
OK verify-desktop-smoke
```

Nenhuma linha `FAIL`, `AssertionError` ou `Error:` no log. Nenhum gate foi afrouxado.

## 3. `release:version-contract:verify` — saída

```json
{
  "version": "1.1.18",
  "releaseManifestVersion": 2,
  "checks": [
    { "id": "version.semver",        "detail": "package.json.version = \"1.1.18\"" },
    { "id": "a.lock.version",        "detail": "package-lock.version = \"1.1.18\" (esperado \"1.1.18\")" },
    { "id": "a.lock.packages",       "detail": "package-lock.packages[\"\"].version = \"1.1.18\" (esperado \"1.1.18\")" },
    { "id": "b.appVersion",          "detail": "fallback de appVersion.js = \"1.1.18\" (esperado \"1.1.18\")" },
    { "id": "c.RELEASE-NOTES.md",    "detail": "docs/release/1.1.18/RELEASE-NOTES.md cita 1.1.18" },
    { "id": "c.RELEASE-CHECKLIST.md","detail": "docs/release/1.1.18/RELEASE-CHECKLIST.md cita 1.1.18" },
    { "id": "d.changelog.block",     "detail": "bloco [1.1.18] datado \"2026-09-14\"" },
    { "id": "d.changelog.unreleased","detail": "nenhum bloco \"Não lançado\"" },
    { "id": "e.release",             "detail": "release/ ausente (aceito)" },
    { "id": "e.release-unsigned",    "detail": "release-unsigned/ ausente (aceito)" },
    { "id": "f.releaseManifestVersion", "detail": "versionInfo.js = 2, generate-release-manifest.mjs = 2" }
  ]
}
```

Antes do bump e das notas, o mesmo gate falhava exatamente onde devia (prova de que não é
tautológico): `b.appVersion` (fallback 1.1.18 × package 1.1.17), `c.*` (notas 1.1.17 ausentes),
`d.changelog.block` (sem bloco `[1.1.17]`), `d.changelog.unreleased` (três blocos "Não lançado").

## 4. `--self-test` — cenários

| Cenário | Esperado | Observado |
|---|---|---|
| árvore mínima sem pastas de release | verde | verde |
| `release-unsigned/` com Setup atual + manifesto v2 gerado por `buildReleaseManifest` (18 campos, `installer{file,sha256,sizeBytes,builtAt}`, `signed=false`, `gitCommit`/`buildTimestamp` propagados; o manifesto gerado passa no gate) | verde | verde |
| `package-lock.version` divergente | vermelho | vermelho |
| `package-lock.packages[""].version` divergente | vermelho | vermelho |
| fallback de `appVersion.js` errado | vermelho | vermelho |
| `RELEASE-NOTES.md` ausente | vermelho | vermelho |
| `RELEASE-CHECKLIST.md` não cita a versão | vermelho | vermelho |
| CHANGELOG sem bloco da versão | vermelho | vermelho |
| CHANGELOG com data placeholder `AAAA-MM-DD` | vermelho | vermelho |
| CHANGELOG com data inexistente `2026-02-30` | vermelho | vermelho |
| bloco "Não lançado" presente | vermelho | vermelho |
| Setup de outra versão em `release-unsigned/` | vermelho | vermelho |
| manifesto com `appVersion` divergente | vermelho | vermelho |

Fixtures em `os.tmpdir()/verify-version-contract-*`, removidas ao final.

## 5. Verificações manuais de código (Node, sem bundler)

```text
$ node -e "import('./src/versioning/versionInfo.js').then(m => console.log(JSON.stringify(m.describeVersions())))"
{"app":"1.1.18","dbSchema":6,"backupFormat":2,"releaseManifest":2,"uiContract":"ModeloBase1-R34",
 "dataContract":1,"uiBuildId":"d17d2r33-design-lancamento-2026-09-10","dataBuildId":"schema-v6",
 "uiModel":"ModeloBase1","uiVersion":"D.17D.2R33","gitCommit":null,"buildTimestamp":null}

$ node scripts/generate-release-manifest.mjs
FAIL: instalador não encontrado: ...\release\Pesagens Individuais Setup 1.1.18.exe   (exit 1, esperado: sem pacote)

$ git check-ignore -v docs/release/1.1.18/RELEASE-NOTES.md   → não ignorado (exit 1)
$ git check-ignore -v release/x.exe release-unsigned/x.exe    → .gitignore:/release/, /release-unsigned/
```

## 6. Não executado neste marco

- `npm run dist` / `dist:unsigned` (proibidos no marco; sem instalador).
- `packaged:source:verify`, `packaged:ui-build:verify`, `release:checksum`, `release:manifest`,
  `e2e:installed:verify` (exigem pacote).
- `test:full` (inclui `e2e:installed:verify:dev`, que exige pacote instalado).
- Teste físico em máquina limpa, balança, RFID: **NÃO EXECUTADO**.
- Conferência visual do bloco Versões no app em execução: não executada (verificada por build,
  eslint e gates estáticos).
