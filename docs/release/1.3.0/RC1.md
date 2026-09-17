# 1.3.0 RC1 — instalador candidato

Status: **Candidato** — não promover a `v1.3.0` sem o teste físico (`RELEASE-CHECKLIST.md` §4).

| Item | Valor |
|---|---|
| Tag | `v1.3.0-rc1` → `f10290a` (RC1 anterior, sem o assistente de importação: `98de70d`) |
| Instalador | `release-unsigned/Pesagens Individuais Setup 1.3.0.exe` (cópia em `C:\Users\maike\Desktop\projeto\`) |
| Tamanho | 92.134.488 bytes |
| SHA-256 do Setup | `0978af11a10d0dd1bd2c850065a043d09edd29a4e8fcdc434964cc9f64020fd6` |
| SHA-256 do `app.asar` | `f379d60611ed62e4837ca84f8cc2ffe6c8fec723445b5bf8af7d7d95ba21e842` |
| Gerado em | 2026-09-17T18:35Z (`npm run dist:unsigned`, exit 0) |
| Manifesto | appVersion 1.3.0 · dbSchemaVersion 8 · backupFormatVersion 3 · dataBuildId schema-v8 · signed false |
| gitCommit no manifesto | `f10290a` (árvore limpa) |

## Gates antes do build
- `npm run lint` — verde.
- `npm run test:quick` — verde (72 comandos, com os gates novos de sanidade, lançamento, importação e exportação), depois de atualizar gates presos à versão anterior:
  `ui:operational-customization` (era na grade; cancelar edição via `endEdit`),
  `ui:consistency` (menu "Exportar relatório/para reimportação"), `reports:json-manifest` e
  `reports:print-contract` (esquema 8).
- `dist:unsigned` — checksum, manifesto, `packaged:source`, `packaged:build` e
  `verify-installed-app-e2e` (validação de artefatos) OK. Execução do Setup não automatizada.

## Artefatos anteriores
- 1.2.0-rc1 arquivado em `release-archive/1.2.0-rc1/` (SHA-256 `fd44a5ee…c0c6` conferido).

## Assistente de importação
Incluído: tela Importação (7 etapas) com a pergunta de conciliação automática entre Cadastro e Manejo,
aferição de animais repetidos no arquivo, mapeamento de colunas só com campos digitáveis, dry-run bloqueante e relatórios. A importação antiga da Relação foi removida.
