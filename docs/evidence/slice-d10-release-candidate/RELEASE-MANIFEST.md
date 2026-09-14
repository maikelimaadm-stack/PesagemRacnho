# RELEASE-MANIFEST

## Script
`scripts/generate-release-manifest.mjs` (npm run `release:manifest`).

Gera `release/release-manifest.json` a partir do `package.json` e do instalador
real (SHA256 e tamanho calculados do arquivo). O campo
`database.preservesDataOnUninstall` é derivado de
`build.nsis.deleteAppDataOnUninstall === false`.

## Execução (2026-07-16)
`npm run release:manifest` → **OK**.

## Conteúdo gerado
```json
{
  "productName": "Pesagens Individuais",
  "version": "1.0.0",
  "platform": "win32",
  "installer": {
    "file": "Pesagens Individuais Setup 1.0.0.exe",
    "sha256": "e1315feebd6068b9bf3fdefb400453b7513c706a7208f8007804451145232688",
    "sizeBytes": 93849224
  },
  "database": {
    "engine": "SQLite",
    "storage": "userData/data/pesagens.db",
    "preservesDataOnUninstall": true
  },
  "features": {
    "offline": true,
    "backup": true,
    "restore": true,
    "exportCsv": true,
    "exportJson": true,
    "importJson": true,
    "login": false,
    "permissions": false,
    "cloud": false
  }
}
```

## Observações
- `login`, `permissions`, `cloud` = `false` — refletem a decisão de simplicidade.
- SHA256 do manifesto coincide com o de `RELEASE-CHECKSUM.md`.
