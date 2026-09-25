# Checklist da release 1.4.0

Versão 1.4.0 (E1 + E1B) · esquema Dexie 8 (sem mudança) · backup formato 3 · `signed=false` · branch
`program/e1-relatorios` (main só avança com autorização da responsável, depois do teste no instalador).

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.4.0.
- [x] CHANGELOG `## [1.4.0] — 2026-09-25`, sem bloco "Não lançado" (E1 e E1B no mesmo bloco).
- [x] `RELEASE-NOTES.md`, este checklist e `MIGRATION-1.3.0-TO-1.4.0.md` em `docs/release/1.4.0/`.
- [x] `docs/user/RELATORIOS.md` ("A folha do relatório", "Cabeçalho da propriedade", barra de filtros,
      Tipo de relatório), `CADASTROS.md`, `BACKUP-E-RESTAURACAO.md`, `INSTALACAO-WINDOWS.md` e
      `TESTE-MAQUINA-LIMPA.md` citam a 1.4.0.

## Validações automatizadas
- [x] `npm run test:quick` completo verde (inclui `reports:summary-mode:verify`,
      `reports:summary-export-parity:verify`, `reports:catalog-consolidation:verify` e, da E1B,
      `reports:sheet-data:verify`, `reports:document-layout:verify` e `registry:property-header:verify`).
- [x] `npm run release:version-contract:verify`.
- [x] `npm run docs:user:verify`.
- [x] `npm run dist:unsigned` (build + electron-builder sem assinatura + checksum + manifesto +
      `diagnostic:packaged:source:verify` + `diagnostic:packaged:build:verify` +
      `diagnostic:e2e:verify`) — refeito depois da E1B (novo SHA-256).
- [x] SHA-256 do `Pesagens Individuais Setup 1.4.0.exe` anotado no REPORT da E1B.

## Evidências
- E1 (`docs/evidence/e1/`): Resumido de Rebanho atual (claro e escuro), Desempenho por lote, Detalhado
  de um lote, PDF A4 do Resumido, XLSX e Manutenção › aba Controle.
- E1B (`docs/evidence/e1b/`):
  - [x] (a) Pesagens "Por apartação (resumo por data)" em paisagem na tela (claro, escuro e o bloco
        TOTAL POR LOTE).
  - [x] (b) a mesma folha em PDF A4 retrato (arquivo PDF + primeira e última páginas).
  - [x] (c) ficha da Propriedade com logo e pré-visualização do cabeçalho.

## Teste manual no app instalado (responsável)
1. Fechar todas as janelas da versão 1.3.2.
2. Criar um backup completo na 1.3.2 (Backup e Manutenção) e guardar fora do computador.
3. Executar `Pesagens Individuais Setup 1.4.0.exe`.
4. Confirmar **v1.4.0** na barra superior e **Pesagens Individuais 1.4.0** no título da janela.
5. Relatórios: 12 cartões; favoritos antigos aparecem com o nome de antes.
6. Cadastros › Propriedades › propriedade padrão: preencher **Cabeçalho dos relatórios** e escolher um
   logo; conferir a pré-visualização e salvar.
7. Relatórios › Pesagens › Tipo **Por apartação (resumo por data)**, período com pesagens,
   Orientação **Paisagem**: conferir cabeçalho com logo, colunas alinhadas, GMD "—" onde não há
   anterior, TOTAL POR LOTE e TOTAL GERAL.
8. **PDF** da mesma folha em retrato e **Imprimir** numa impressora real (teste físico).
9. Clicar numa apartação da folha → Detalhado filtrado; **Ver como folha**.
10. Configurações › Relatórios: trocar o divisor da @ para 15 e ver o rodapé "@ = peso vivo ÷ 15";
    voltar para 30.
11. Relação de Pesagens › Ações em lote › **Data, apartação e lote** abre sem erro.
12. Backup e Manutenção › aba **Controle** lista os 4 relatórios de conferência; criar um backup e
    verificar integridade: "Banco íntegro."; contagens iguais às de antes.

## Teste físico
- [ ] Balança, impressora, curral: **não executado** (a impressão da folha numa impressora real é o
      passo 8 do teste da responsável).
