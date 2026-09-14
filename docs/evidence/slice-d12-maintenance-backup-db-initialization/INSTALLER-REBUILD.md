# INSTALLER-REBUILD

## Necessidade
A correção alterou código empacotado (`electron/**`: sqliteConnection, index,
maintenance/backupService, ipc/maintenanceIpc, ipc/databaseIpc). Portanto o
instalador PRECISA ser regenerado para conter o fix.

## Ação
`npm run dist` → exit 0.
- `@electron/rebuild` para Electron 35.7.5, better-sqlite3 (N-API).
- NSIS oneClick=false, perMachine=false.
- `default Electron icon` (pendente) / `signing skipped` (sem certificado).

## Resultado
- Instalador: `release/Pesagens Individuais Setup 1.0.0.exe`
- Novo SHA256: `292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52`
  (substitui o do D.11 `9d8c97bc...945a`; o antigo não deve mais ser usado)
- Versão mantida em **1.0.0** (correção de bug, sem nova funcionalidade).

## Validação pós-dist
- e2e:installed:verify (estrito): PASS
- first-run:db:verify: PASS
- maintenance:first-run-backup:verify: PASS
- installer:sqlite:verify: PASS
- desktop:smoke:verify: PASS
