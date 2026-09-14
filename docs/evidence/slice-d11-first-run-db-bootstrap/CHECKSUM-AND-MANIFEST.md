# CHECKSUM-AND-MANIFEST

Refeitos após a regeneração do instalador (D.11).

## release:checksum → OK
- Arquivo: `release/Pesagens Individuais Setup 1.0.0.exe.sha256`
- Instalador: `Pesagens Individuais Setup 1.0.0.exe`
- Tamanho: 93.849.464 bytes
- SHA256: `9d8c97bc71ff6e7a51c873e26bc67155fd7bb815df54d7ed16f661a3cb75945a`
- Conteúdo:
  ```
  9d8c97bc71ff6e7a51c873e26bc67155fd7bb815df54d7ed16f661a3cb75945a  Pesagens Individuais Setup 1.0.0.exe
  ```

## release:manifest → OK
- Arquivo: `release/release-manifest.json`
- version: 1.0.0
- installer.sha256: `9d8c97bc...945a` (coincide com o checksum)
- installer.sizeBytes: 93.849.464
- database.preservesDataOnUninstall: **true**
- features: offline/backup/restore/exportCsv/exportJson/importJson = true;
  login/permissions/cloud = false

## e2e:installed:verify (estrito) → OK
Com o instalador presente, o modo estrito passou:
- Setup.exe presente
- `.sha256` presente
- `release-manifest.json` presente
- app.asar + app.asar.unpacked + better_sqlite3.node presentes
- releaseFinal.mode = "strict"
