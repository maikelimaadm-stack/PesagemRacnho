# S-00.0 — Arquivos alterados

Commit `8c79022` (`test(gates): align operational-customization and ui-consistency with the
current contract`), sobre a tag `v1.1.17-baseline` (`77eeb3b`).

| Arquivo | Tipo | Mudança |
|---|---|---|
| `scripts/verify-operational-customization.mjs` | gate | +21/−8: contrato do registry (`cadastros-auxiliares:comerciais:<empresa>`), `doesNotMatch(/GerenciarSaidasDialog/)`, seleção via `auxiliaryCatalogs.* → <SelectItem>`, saída JSON com `registrySelectedInLaunch` e `legacyExitProfilesDialog: false` |
| `scripts/verify-ui-consistency.mjs` | gate | +6/−1: quatro asserções estruturais no lugar da regex de sintaxe do segmento Registro/Tabela |

Nenhum arquivo de produto (`src/**`, `electron/**`, `package.json`, `schema.js`) foi tocado.

Verificação: `git show 8c79022 --stat` → `2 files changed, 28 insertions(+), 8 deletions(-)`.
