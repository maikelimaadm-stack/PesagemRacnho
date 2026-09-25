# Checklist da release 1.4.0

Versão 1.4.0 · esquema Dexie 8 (sem mudança) · backup formato 3 · `signed=false` · branch
`program/e1-relatorios` (main só avança com autorização da responsável).

## Versão
- [ ] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.4.0.
- [ ] CHANGELOG `## [1.4.0] — 2026-09-25`, sem bloco "Não lançado".
- [ ] `RELEASE-NOTES.md`, este checklist e `MIGRATION-1.3.0-TO-1.4.0.md` em `docs/release/1.4.0/`.
- [ ] `docs/user/RELATORIOS.md`, `INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md` citam a 1.4.0.

## Validações automatizadas
- [ ] `npm run test:quick` completo verde (inclui `reports:summary-mode:verify`,
      `reports:summary-export-parity:verify` e `reports:catalog-consolidation:verify`).
- [ ] `npm run release:version-contract:verify`.
- [ ] `npm run docs:user:verify`.
- [ ] `npm run dist:unsigned` (build + electron-builder sem assinatura + checksum + manifesto +
      `diagnostic:packaged:source:verify` + `diagnostic:packaged:build:verify` +
      `diagnostic:e2e:verify`).
- [ ] SHA-256 do `Pesagens Individuais Setup 1.4.0.exe` anotado no REPORT da E1.

## Evidências (docs/evidence/e1/)
- [ ] Resumido de **Rebanho atual por lote** (claro e escuro).
- [ ] Resumido de **Desempenho por lote**.
- [ ] Detalhado de um lote aberto pelo clique no grupo.
- [ ] PDF A4 do Resumido de Desempenho (1 página, retrato).
- [ ] XLSX do Resumido de Rebanho atual.
- [ ] Manutenção › aba Controle.

## Teste manual no app instalado (responsável)
1. Fechar todas as janelas da versão 1.3.2.
2. Criar um backup completo na 1.3.2 (Backup e Manutenção) e guardar fora do computador.
3. Executar `Pesagens Individuais Setup 1.4.0.exe`.
4. Confirmar **v1.4.0** na barra superior e **Pesagens Individuais 1.4.0** no título da janela.
5. Relatórios: 12 cartões; favoritos antigos aparecem com o nome de antes.
6. Rebanho atual abre resumido por lote; clicar num lote mostra só os animais dele.
7. Desempenho, período "Últimos 365 dias": imprimir o Resumido em A4.
8. Relação de Pesagens › Ações em lote › **Data, apartação e lote** abre sem erro.
9. Backup e Manutenção › aba **Controle** lista os 4 relatórios de conferência.
10. Verificar integridade: "Banco íntegro."; contagens iguais às de antes.

## Teste físico
- [ ] Balança, impressora, curral: **não executado** (sem mudança nessas partes nesta versão).
