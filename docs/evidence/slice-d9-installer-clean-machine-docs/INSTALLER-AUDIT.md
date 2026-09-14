# INSTALLER-AUDIT

| Campo | Valor | Classificação |
|---|---|---|
| productName | Pesagens Individuais | ok |
| appId | com.pesagens.individuais | ok |
| version | 1.0.0 | ok |
| artifactName | `${productName} Setup ${version}.${ext}` | corrigido (D.9) |
| directories.output | release | ok |
| files | dist, electron, package.json, better-sqlite3 | ok |
| asar | true | corrigido (explícito) |
| asarUnpack | better-sqlite3/**, **/*.node | ok |
| win.target | nsis x64 | ok |
| oneClick | false | corrigido (wizard + pasta) |
| perMachine | false | ok (dados em userData) |
| allowToChangeInstallationDirectory | true | corrigido |
| shortcutName | Pesagens Individuais | ok |
| uninstallDisplayName | Pesagens Individuais | corrigido |
| createDesktopShortcut | true | ok |
| createStartMenuShortcut | true | ok |
| deleteAppDataOnUninstall | false | corrigido (preserva dados) |
| icon | não configurado | pendente |
| code signing | ausente | risco aceito / documentado |

## better-sqlite3
Empacotado em `app.asar.unpacked` — validado no dist D.9.

## Resultado
Auditoria concluída; polimento NSIS aplicado; ícone e assinatura pendentes.
