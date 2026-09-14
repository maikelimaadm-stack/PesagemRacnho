# CHECKSUM-AND-MANIFEST (D.13)

## release:checksum → OK
- Arquivo: `release/Pesagens Individuais Setup 1.0.1.exe.sha256`
- SHA256: `23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7`
- Conteúdo:
  ```
  23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7  Pesagens Individuais Setup 1.0.1.exe
  ```

## release:manifest → OK
```json
{
  "productName": "Pesagens Individuais",
  "version": "1.0.1",
  "platform": "win32",
  "installer": {
    "file": "Pesagens Individuais Setup 1.0.1.exe",
    "sha256": "23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7",
    "sizeBytes": <do arquivo>
  },
  "database": { "engine": "SQLite", "storage": "userData/data/pesagens.db", "preservesDataOnUninstall": true },
  "features": { "offline": true, "backup": true, "restore": true, "exportCsv": true, "exportJson": true, "importJson": true, "login": false, "permissions": false, "cloud": false }
}
```

- version = **1.0.1**, installer.file = **Setup 1.0.1.exe**.
- login/permissions/cloud = false; preservesDataOnUninstall = true.
- Manifesto NÃO aponta mais para 1.0.0.
