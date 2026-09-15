# Checklist da release 1.2.0

Política: `docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` §4 (ADR-039).
Nenhum item automatizado é marcado sem o comando ter sido executado nesta árvore;
itens manuais sem GUI disponível ficam como **MANUAL PENDENTE**, nunca "aprovado".

## 1. Versões e documentos

- [ ] `package.json` e `package-lock.json` (inclusive `packages[""]`) em **1.2.0**.
- [ ] `src/versioning/versionInfo.js`: `DB_SCHEMA_VERSION = 7`, `BACKUP_FORMAT_VERSION = 3`,
      `DATA_CONTRACT_VERSION = 2`, `DATA_BUILD_ID = 'schema-v7'`.
- [ ] `uiBuildInfo.js` com o `UI_BUILD_ID` desta release.
- [ ] `CHANGELOG.md` com o bloco `## [1.2.0]` consolidado
      (Added/Changed/Fixed/Removed/Migration/Security), sem blocos "Não lançado" pendentes.
- [ ] `docs/user/*` atualizados (LOGIN, USUARIOS, CADASTROS, GUIA-RAPIDO,
      INSTALACAO-WINDOWS, BACKUP-E-RESTAURACAO, TESTE-MAQUINA-LIMPA).
- [ ] `docs/release/1.2.0/RELEASE-NOTES.md` e `MIGRATION-1.1.17-TO-1.2.0.md` com tempos medidos.
- [ ] `npm run docs:user:verify` verde.

## 2. Gates automatizados

- [ ] `npm run lint`
- [ ] `npm run test:quick` (todos os gates, inclusive os novos da Fase 1)
- [ ] `npm run migration:v7:verify` (massas vazia, pequena e 36 mil; reentrância; bloqueio sem backup)
- [ ] `npm run auth:local:verify` e `npm run auth:access:verify`
- [ ] `npm run master-registry:verify` (cadastros mestres)
- [ ] `npm run storage:backup:verify` e `npm run storage:import-restore:verify` (formato 3; restore v6 → backfill; usuários)
- [ ] `npm run ui:consistency:verify` (menu novo, RequirePermission, telas de cadastro)
- [ ] `npm run packaged:build:verify -- --self-test` (fixtures positivas e negativas do gate de pacote)
- [ ] `npm run test:full` após as últimas alterações (inclui build e `e2e:installed:verify:dev`).

## 3. Build e pacote

- [ ] `npm run release:clean` (nenhum Setup de outra versão em `release/` ou `release-unsigned/`).
- [ ] `npm run build` limpo; `dist/assets` contém `UI_BUILD_ID`, `schema-v7` e `"1.2.0"`.
- [ ] `electron-builder --win` (assinado em `release/`; sem certificado, `npm run dist:unsigned`).
- [ ] `npm run packaged:build:verify` (ou `diagnostic:packaged:build:verify`): versão, marcadores,
      manifesto com os cinco eixos, SHA-256, tamanho, `builtAt`, `signed`, Setup não anterior aos bundles.
- [ ] `npm run release:checksum` gera `Pesagens Individuais Setup 1.2.0.exe.sha256`.
- [ ] `npm run release:manifest` gera `release-manifest.json` com `version`, `dbSchema`, `backupFormat`,
      `uiContract`, `dataContract`, `uiBuildId`, `dataBuildId`, `installer{file,sha256,sizeBytes,builtAt}`,
      `signed`, `distribution`.
- [ ] `npm run release:current-only:verify` (um único Setup, da versão atual).
- [ ] `npm run packaged:source:verify` (main enxuto, preload, sem módulo nativo).

## 4. Evidências

- [ ] `docs/evidence/program-2.0/phase-01/` com: saída dos gates, relatório da migração nas massas
      (vazia, pequena, 36 mil; 250 mil em `test:full`), capturas de Login, Configuração Inicial,
      Usuários, cadastros e Status da Manutenção (claro e escuro), manifesto e checksum.

## 5. Teste instalado (manual)

- [ ] Máquina limpa: instalar, Configuração Inicial, login, cadastros, lançamento, fechar/abrir,
      backup, restauração, versão e UI (`docs/user/TESTE-MAQUINA-LIMPA.md`).
- [ ] Atualização 1.1.17 → 1.2.0 com dados reais de teste: backup pré-migração, migração,
      relatório, integridade, contagens.
- [ ] Restauração de um backup 1.1.17 na 1.2.0 (conversão automática).
- [ ] Teste com balança real. **MANUAL PENDENTE**
- [ ] Teste com bastão RFID real. **MANUAL PENDENTE**

## 6. Distribuição oficial

- [ ] Assinatura Authenticode e carimbo de tempo (`npm run release:signature:verify`).
- [ ] Reputação SmartScreen do publicador.
- [ ] `signed: true` no manifesto **somente** após a assinatura ser verificada.

## 7. Fechamento

- [ ] Commit semântico de release em `program/2.0`; merge em `main`.
- [ ] Tag `v1.2.0` **somente** após todos os gates acima.
- [ ] Relatório do coordenador da Fase 1.

Os itens de hardware não são simulados: enquanto não houver driver e conexão
reais, a interface informa que os equipamentos não estão configurados.
