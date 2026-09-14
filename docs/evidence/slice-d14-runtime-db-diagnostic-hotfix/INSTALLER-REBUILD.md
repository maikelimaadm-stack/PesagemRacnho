# INSTALLER-REBUILD (D.14)

`npm run dist` (versão 1.0.2) → exit 0. Necessário (código empacotado mudou:
databaseRuntime, databaseReady, diagnostics, main, preload, maintenanceIpc,
ManutencaoSistema).

Log: `@electron/rebuild` Electron 35.7.5, better-sqlite3 (N-API);
`building target=nsis file=release\Pesagens Individuais Setup 1.0.2.exe`;
`default Electron icon` (pendente); `signing skipped` (sem certificado).

## Artefato
- `release/Pesagens Individuais Setup 1.0.2.exe`
- SHA256: `eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303`
- 1.0.1 removido de release/.

## Histórico de SHA256 (apenas 1.0.2 é válido)
- D.11: 9d8c97bc... (1.0.0)
- D.12: 292c399d... (1.0.0)
- D.13: 23863975... (1.0.1)
- **D.14 (1.0.2, atual): eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303**

## Validação pós-dist (todas PASS)
packaged:source:verify, e2e:installed:verify, installed:runtime:diagnostic:verify,
first-run:db:verify, maintenance:first-run-backup:verify, installer:sqlite:verify,
desktop:smoke:verify.
