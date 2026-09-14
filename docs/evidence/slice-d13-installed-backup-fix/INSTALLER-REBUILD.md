# INSTALLER-REBUILD

## Ação
`npm run dist` (versão 1.0.1) → exit 0. Rebuild final feito após alinhar todo o
source (incluindo metadados de versão dinâmicos), para garantir
**pacote == source corrigido**.

Log electron-builder:
- `@electron/rebuild` Electron 35.7.5, better-sqlite3 (N-API).
- `building target=nsis file=release\Pesagens Individuais Setup 1.0.1.exe`.
- `default Electron icon` (pendente) / `signing skipped` (sem certificado).

## Artefato final
- `release/Pesagens Individuais Setup 1.0.1.exe`
- SHA256 (recalculado do arquivo, confere com .sha256/manifest):
  `23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7`
- Antigos 1.0.0 removidos de `release/`.

## Histórico de SHA256 (apenas o 1.0.1 abaixo é válido)
- D.10.1: e1315fee... (sumiu do ambiente)
- D.11: 9d8c97bc...
- D.12: 292c399d...
- **D.13 (1.0.1, atual): 23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7**

## Validação pós-dist (todas PASS)
packaged:source:verify, e2e:installed:verify, first-run:db:verify,
maintenance:first-run-backup:verify, maintenance:ui-backup-flow:verify,
installer:sqlite:verify, desktop:smoke:verify.
