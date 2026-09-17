# 1.3.0 RC1 — instalador candidato

Status: **Candidato** — não promover a `v1.3.0` sem o teste físico (`RELEASE-CHECKLIST.md` §4).

| Item | Valor |
|---|---|
| Tag | `v1.3.0-rc1` → `f10290a` (RC1 anterior, sem o assistente de importação: `98de70d`) |
| Instalador | `release-unsigned/Pesagens Individuais Setup 1.3.0.exe` (cópia em `C:\Users\maike\Desktop\projeto\`) |
| Tamanho | 92.134.590 bytes |
| SHA-256 do Setup | `a2f73211da49ba03ae3619131cc1bee2367d29911d952fd4f846741b7d3601b1` |
| SHA-256 do `app.asar` | `5586c03f12e1a35e541e173d67b26ec221fe1259e5460c1fe18400b220315074` |
| Gerado em | 2026-09-17T19:20Z (`npm run dist:unsigned`, exit 0) |
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
