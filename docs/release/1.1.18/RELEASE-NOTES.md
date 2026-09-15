# Pesagens Individuais 1.1.18

**Data:** 14/09/2026 · **Tipo:** PATCH (marco 1.1.18 do Programa Master de Evolução, ADR-047)
· **Esquema Dexie:** 6 (inalterado) · **Formato de backup:** 2 (inalterado) · **Manifesto:** formato 2
· **Interface:** D.17D.2R33 / `ModeloBase1-R34`.

## O que esta versão é

1.1.18 é a versão de **baseline e governança** do programa que leva o produto até 1.6.0. Ela
consolida o estado verde dos gates sobre o código 1.1.17, formaliza o contrato de versão em quatro
eixos e registra as decisões (ADR-041 a ADR-048) e os documentos de engenharia que os próximos marcos
vão seguir. **Não há esquema novo, login, stores novas nem telas novas.**

## Principais alterações

- **Contrato de versão** (`src/versioning/versionInfo.js`): versão do app, esquema do banco, formato
  do backup e formato do manifesto nunca se confundem; marcadores de build (commit, data, contrato
  UI/dados) reunidos em `describeVersions()`.
- **Manutenção › Status do banco › Versões** mostra Aplicativo, Esquema do banco, Formato do backup,
  Manifesto, Build (commit · data) e Contrato UI/dados; "Copiar diagnóstico" inclui os mesmos campos.
- **Gate `release:version-contract:verify`** em `test:quick`: package.json, package-lock, fallback,
  notas, checklist, CHANGELOG e pastas de release precisam concordar na versão 1.1.18.
- **Manifesto de release formato 2** com `appVersion`, `dbSchemaVersion`, `backupFormatVersion`,
  `gitCommit`, `buildTimestamp`, `arch`, `installer.builtAt` e `signed` (sempre `false` até
  Authenticode).
- **Correção de dois gates** que estavam vermelhos na tag `v1.1.17-baseline`
  (`ui:operational-customization`, `ui:consistency`): a causa estava no teste, não no código.
- **Documentos de engenharia:** `VERSIONING.md`, `RELEASE-POLICY.md` e `AUTH-THREAT-MODEL.md`.
- Consolidação no CHANGELOG das mudanças de interface já presentes no código 1.1.17 (Tela Mãe do
  ModeloBase1 na Relação e nos cadastros; design "Lançamento de Pesagens" R29–R33; F0 baseline).

Detalhe completo: `CHANGELOG.md`, bloco `[1.1.18] — 2026-09-14`.

## Compatibilidade e dados

- Backups criados por 1.1.16 e 1.1.17 restauram sem conversão (formato 2).
- Nenhum dado é migrado ou regravado. O banco IndexedDB `pesagens-individuais` e a pasta `userData`
  não mudam.
- Rollback: reinstalar/rodar a versão anterior; não há migração a desfazer.

## Distribuição

- **Instalador: não gerado neste marco.** Não existe `Pesagens Individuais Setup 1.1.18.exe`; as
  pastas `release/` e `release-unsigned/` desta árvore estão vazias.
- Quando for gerado, o pacote sem assinatura em `release-unsigned/` continua sendo diagnóstico local
  (`signed: false`); a distribuição oficial depende de certificado Authenticode (ADR-039).
- Teste físico em máquina limpa, balança e RFID: **NÃO EXECUTADO** nesta versão.

## Evidências

- `docs/evidence/s00-baseline-recovery/` — diagnóstico e correção dos dois gates.
- `docs/evidence/s00-versioning-auth-contract/` — este marco (arquivos, testes, riscos, rollback).
- `docs/evidence/STATE-OF-REPO-BEFORE.md` e `docs/evidence/program-2.0/phase-00/GATES.md` — estado
  de partida.
