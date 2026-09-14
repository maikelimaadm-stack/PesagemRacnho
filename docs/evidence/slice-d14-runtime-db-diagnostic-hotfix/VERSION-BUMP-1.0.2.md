# VERSION-BUMP-1.0.2

## Motivo
Hotfix real: o 1.0.1 continuou falhando no teste físico de inicialização do
banco/backup. O bump para 1.0.2 força novo artefato identificável e elimina
ambiguidade.

## Alterações
- `package.json`: 1.0.1 → **1.0.2**.
- `release-manifest.json`: aponta para `Pesagens Individuais Setup 1.0.2.exe`.
- `CHANGELOG.md`: seção 1.0.2.
- `docs/release/1.0.2/RELEASE-NOTES.md` + `RELEASE-CHECKLIST.md`.
- Metadados de versão continuam dinâmicos (leem package.json) — sem 1.0.x hardcoded.
- Tela de Manutenção mostra **Versão: 1.0.2** (IPC `app:getDiagnosticInfo`).

## Artefato
- `release/Pesagens Individuais Setup 1.0.2.exe`.
- Artefatos 1.0.1 removidos de `release/`. Manifesto NÃO aponta para 1.0.0/1.0.1.

## Scripts de release
`generate-release-checksum.mjs` / `generate-release-manifest.mjs` leem a versão
do package.json — alvo virou 1.0.2 automaticamente.
