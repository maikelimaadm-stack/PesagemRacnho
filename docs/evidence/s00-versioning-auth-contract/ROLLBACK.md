# S-00.1 — Rollback (marco 1.1.18)

## Natureza da mudança

Só código de apoio, scripts, documentação e metadados de versão. **Nenhuma migração, nenhum
esquema novo, nenhum dado regravado**: `DB_VERSION = 6` e `BACKUP_FORMAT_VERSION = 2` são os mesmos
de 1.1.17. Um app 1.1.17 abre o mesmo banco e restaura os mesmos backups.

## Desfazer o marco inteiro

```text
git checkout e4d4278          # árvore imediatamente anterior ao marco (gates verdes, ADRs 018–040)
# ou
git checkout v1.1.17-baseline # ponto de partida imutável do programa
```

Se o marco já tiver sido commitado/taggeado como `v1.1.18`: `git revert <commit do marco>` mantém o
histórico; a tag pode ser removida localmente (`git tag -d v1.1.18`) — nada foi publicado remotamente.

## Desfazer partes isoladas

| Peça | Como | Efeito colateral |
|---|---|---|
| Versão 1.1.18 → 1.1.17 | `package.json`, `package-lock.json` (2 campos), fallback de `appVersion.js`; renomear `docs/release/1.1.18` → `1.1.17` e restaurar `docs/release/1.1.17` (existe só no repositório principal, fora do git até esta correção do `.gitignore`) | o gate de versão passa a exigir bloco `[1.1.17]` no CHANGELOG |
| `versionInfo.js` | apagar o arquivo, voltar `const BACKUP_FORMAT_VERSION = 2` em `backupService.js`, remover import em `ManutencaoSistema.jsx` e em `generate-release-manifest.mjs`/`verify-version-contract.mjs` | o gate de versão deixa de existir (remover dos scripts npm) |
| Bloco Versões na Manutenção | remover `VERSION_LINES`, o `<div>` e a linha do `copyDiag` | nenhum; gates de Manutenção continuam verdes |
| Manifesto formato 2 | restaurar o gerador anterior (`git show e4d4278:scripts/generate-release-manifest.mjs`) | `verify-packaged-ui-build.mjs` continua funcionando (lê `version`) |
| `__BUILD_INFO__` | remover a chave de `define` em `vite.config.js` | `BUILD_INFO` cai no fallback nulo; UI mostra "—" |
| `.gitignore` ancorado | voltar a `release/` | `docs/release/**` volta a ser ignorado — **não recomendado** |
| CHANGELOG consolidado | `git show e4d4278:CHANGELOG.md` | volta aos três blocos "Não lançado" (o gate de versão falha) |

## Dados do usuário

Nada a fazer. Instalação, `userData`, banco IndexedDB `pesagens-individuais` e backups não são
tocados por este marco.
