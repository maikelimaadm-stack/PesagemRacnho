# CHECKSUM-AND-MANIFEST (D.12)

Refeitos após a regeneração do instalador com a correção.

## release:checksum → OK
- Arquivo: `release/Pesagens Individuais Setup 1.0.0.exe.sha256`
- SHA256: `292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52`
- Conteúdo:
  ```
  292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52  Pesagens Individuais Setup 1.0.0.exe
  ```

## release:manifest → OK
- Arquivo: `release/release-manifest.json`
- version: 1.0.0
- installer.sha256: `292c399d...5e52` (coincide com o checksum)
- database.preservesDataOnUninstall: true
- features: login/permissions/cloud = false

## Histórico de SHA256
- D.10.1: `e1315fee...2688` (instalador sumiu do ambiente)
- D.11: `9d8c97bc...945a` (regenerado)
- **D.12: `292c399d...5e52` (atual — com o fix do backup)**
Somente o SHA256 do D.12 é válido para distribuição.
