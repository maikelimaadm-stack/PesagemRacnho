# 1.3.0 RC1 — instalador candidato

Status: **Candidato** — não promover a `v1.3.0` sem o teste físico (`RELEASE-CHECKLIST.md` §4).

| Item | Valor |
|---|---|
| Tag | `v1.3.0-rc1` → `98de70d` |
| Instalador | `release-unsigned/Pesagens Individuais Setup 1.3.0.exe` (cópia em `C:\Users\maike\Desktop\projeto\`) |
| Tamanho | 92.107.862 bytes |
| SHA-256 do Setup | `fa09198f80911b6bee5c740f5804ecd1e65a6563bd44b12eaaac3759a0b93bdf` |
| SHA-256 do `app.asar` | `3586b7c7e01490f1ff0d80f7474a87fdd39d67b1cd959d8b9cf81a19d88e0d44` |
| Gerado em | 2026-09-17T12:27:06Z (`npm run dist:unsigned`, exit 0) |
| Manifesto | appVersion 1.3.0 · dbSchemaVersion 8 · backupFormatVersion 3 · dataBuildId schema-v8 · signed false |
| gitCommit no manifesto | `98de70d-dirty` — a árvore tinha arquivos NÃO commitados do motor de importação novo (`src/modules/import/application`, `infrastructure`, domínio e gates `verify-import-*`). Nenhuma tela importa esses arquivos, então não entram no pacote; o único arquivo de `src/modules/import` usado pelo app (`domain/spreadsheetTemplate.js`) está no commit. |

## Gates antes do build
- `npm run lint` — verde.
- `npm run test:quick` — verde (56 comandos), depois de atualizar gates presos à versão anterior:
  `ui:operational-customization` (era na grade; cancelar edição via `endEdit`),
  `ui:consistency` (menu "Exportar relatório/para reimportação"), `reports:json-manifest` e
  `reports:print-contract` (esquema 8).
- `dist:unsigned` — checksum, manifesto, `packaged:source`, `packaged:build` e
  `verify-installed-app-e2e` (validação de artefatos) OK. Execução do Setup não automatizada.

## Artefatos anteriores
- 1.2.0-rc1 arquivado em `release-archive/1.2.0-rc1/` (SHA-256 `fd44a5ee…c0c6` conferido).

## Fora desta RC
- Assistente de importação novo (histórico conciliado): motor pronto em paralelo, tela ainda não.
