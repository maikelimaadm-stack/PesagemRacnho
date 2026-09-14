# RELEASE-CHECKSUM

## Script
`scripts/generate-release-checksum.mjs` (npm run `release:checksum`).

Calcula o SHA256 do instalador definido em `package.json` (productName + version)
e grava um arquivo compatível com `sha256sum -c`.

## Execução (2026-07-16)
`npm run release:checksum` → **OK**.

| Campo | Valor |
|---|---|
| Instalador | `Pesagens Individuais Setup 1.0.0.exe` |
| Tamanho | 93.849.224 bytes |
| SHA256 | `e1315feebd6068b9bf3fdefb400453b7513c706a7208f8007804451145232688` |
| Arquivo gerado | `release/Pesagens Individuais Setup 1.0.0.exe.sha256` |

## Conteúdo do arquivo .sha256
```
e1315feebd6068b9bf3fdefb400453b7513c706a7208f8007804451145232688  Pesagens Individuais Setup 1.0.0.exe
```

## Verificação pelo usuário (opcional)
No PowerShell:
```
Get-FileHash ".\release\Pesagens Individuais Setup 1.0.0.exe" -Algorithm SHA256
```
O valor deve bater com o SHA256 acima.
