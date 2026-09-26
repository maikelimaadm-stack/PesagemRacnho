# Checklist da release 1.4.0

Versão 1.4.0 (E1 + E1B + E1C) · esquema Dexie 8 (sem mudança) · backup formato 3 · `signed=false` · branch
`program/e1-relatorios` (main só avança com autorização da responsável, depois do teste no instalador).

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.4.0.
- [x] CHANGELOG `## [1.4.0] — 2026-09-25`, sem bloco "Não lançado" (E1, E1B e E1C no mesmo bloco).
- [x] `RELEASE-NOTES.md`, este checklist e `MIGRATION-1.3.0-TO-1.4.0.md` em `docs/release/1.4.0/`.
- [x] `docs/user/RELATORIOS.md` ("A folha do relatório", "Cabeçalho da propriedade", barra de filtros,
      Tipo de relatório, Excel com TOTAL POR, título de Pesagens), `CADASTROS.md` (máscara de CPF/CNPJ),
      `USUARIOS.md` (GESTOR em Configurações › Relatórios), `BACKUP-E-RESTAURACAO.md`,
      `INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md` citam a 1.4.0.

## Validações automatizadas
- [x] `npm run test:quick` completo verde (inclui, da E1B, `reports:sheet-data:verify`,
      `reports:document-layout:verify` e `registry:property-header:verify`; da E1C,
      `registry:document-mask:verify`, `reports:sheet-xlsx-parity:verify` e `ui:dark-field-text:verify`).
- [x] `npm run test:full` completo verde (inclui `storage:all:verify`, com os gates do Dexie corrigidos).
- [x] `npm run release:version-contract:verify`.
- [x] `npm run docs:user:verify`.
- [x] Tudo commitado ANTES do build (manifesto com `gitCommit` sem "-dirty").
- [x] `npm run dist:unsigned` (build + electron-builder sem assinatura + checksum + manifesto +
      `diagnostic:packaged:source:verify` + `diagnostic:packaged:build:verify` +
      `diagnostic:e2e:verify`) — instalador FINAL da 1.4.0, com `gitCommit` `31f7733`.
- [x] SHA-256 do `Pesagens Individuais Setup 1.4.0.exe` final anotado no REPORT da E1C
      (`e584a7fa…3a49bec`).

## Evidências
- E1 (`docs/evidence/e1/`): Resumido de Rebanho atual (claro e escuro), Desempenho por lote, Detalhado
  de um lote, PDF A4 do Resumido, XLSX e Manutenção › aba Controle.
- E1B (`docs/evidence/e1b/`): Pesagens "Por apartação (resumo por data)" em paisagem na tela, a mesma
  folha em PDF A4 retrato e a ficha da Propriedade com logo e pré-visualização.
- E1C (`docs/evidence/e1c/`):
  - [x] ficha com a máscara de CPF/CNPJ;
  - [x] XLSX aberto no Excel mostrando o bloco TOTAL POR;
  - [x] tema escuro antes/depois (fichas de Propriedade e de Parceiro; Configurações depois).

## Teste manual no app instalado (responsável)
O roteiro completo e atualizado está em `docs/evidence/e1c/REPORT.md`, seção 7.

## Teste físico
- [ ] Balança, impressora, curral: **não executado** (a impressão da folha numa impressora real faz parte
      do teste da responsável).
