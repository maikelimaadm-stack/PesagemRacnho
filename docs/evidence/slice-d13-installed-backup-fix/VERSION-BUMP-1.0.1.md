# VERSION-BUMP-1.0.1

## Motivo
Correção funcional real de bug crítico no backup do app instalado. O bump
elimina a ambiguidade de instaladores todos chamados "1.0.0" (D.10.1/D.11/D.12)
e força um novo nome de artefato identificável.

## Alterações
- `package.json`: `version` 1.0.0 → **1.0.1**.
- `release-manifest.json`: gerado apontando para `Pesagens Individuais Setup 1.0.1.exe`.
- `CHANGELOG.md`: seção 1.0.1 no topo.
- `docs/release/1.0.1/RELEASE-NOTES.md` e `RELEASE-CHECKLIST.md` criados.
- Metadados de versão dinâmicos (leem `package.json`) em `backupService.cjs`,
  `exportService.cjs` e `legacyPesagemMigration.cjs` — sem "1.0.0" hardcoded.
- Tela de Manutenção mostra **Versão: 1.0.1** (via IPC `app:getReleaseInfo`).

## Artefato
- `release/Pesagens Individuais Setup 1.0.1.exe`
- Os artefatos antigos **1.0.0 foram removidos** de `release/` para evitar uso
  do instalador errado. Manifesto NÃO aponta mais para 1.0.0.

## Scripts de release
`generate-release-checksum.mjs` e `generate-release-manifest.mjs` já leem a
versão do `package.json` (dinâmicos) — o alvo virou 1.0.1 automaticamente.
