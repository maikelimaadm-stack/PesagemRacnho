# Checklist da release 1.2.0

Política: `docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` §4 (ADR-039).
Nenhum item automatizado é marcado sem o comando ter sido executado nesta árvore;
itens manuais sem GUI disponível ficam como **MANUAL PENDENTE**, nunca "aprovado".

## 1. Versões e documentos

- [x] `package.json` e `package-lock.json` (inclusive `packages[""]`) em **1.2.0** (15/09/2026;
      o fallback de `src/lib/appVersion.js` estava em 1.1.18 e foi alinhado).
- [ ] `src/versioning/versionInfo.js`: `DB_SCHEMA_VERSION = 7`, `BACKUP_FORMAT_VERSION = 3`,
      `DATA_CONTRACT_VERSION = 2`, `DATA_BUILD_ID = 'schema-v7'`.
- [ ] `uiBuildInfo.js` com o `UI_BUILD_ID` desta release.
- [x] `CHANGELOG.md` com o bloco `## [1.2.0] — 2026-09-15` consolidado
      (Added/Changed/Removed), sem blocos "Não lançado" pendentes.
- [ ] `docs/user/*` atualizados (LOGIN, USUARIOS, CADASTROS, GUIA-RAPIDO,
      INSTALACAO-WINDOWS, BACKUP-E-RESTAURACAO, TESTE-MAQUINA-LIMPA).
- [ ] `docs/release/1.2.0/RELEASE-NOTES.md` e `MIGRATION-1.1.17-TO-1.2.0.md` com tempos medidos.
- [ ] `npm run docs:user:verify` verde.

## 2. Gates automatizados

- [x] `npm run lint`
- [x] `npm run test:quick` (todos os gates, inclusive os novos da Fase 1) — verde em 15/09/2026,
      após corrigir três gates que tinham ficado desatualizados na onda 1 interrompida:
      `verify-local-auth` (checava a ausência da store `usuarios` em vez de `usuariosLocais`),
      `verify-v7-migration` (nascimento estimado e `operador_usuario_id`) e
      `verify-packaged-build` (chamada de `buildReleaseManifest` e nomes do manifesto formato 2).
- [ ] `npm run migration:v7:verify` (massas vazia, pequena e 36 mil; reentrância; bloqueio sem backup)
- [ ] `npm run auth:local:verify` e `npm run auth:access:verify`
- [ ] `npm run master-registry:verify` (cadastros mestres)
- [ ] `npm run storage:backup:verify` e `npm run storage:import-restore:verify` (formato 3; restore v6 → backfill; usuários)
- [ ] `npm run ui:consistency:verify` (menu novo, RequirePermission, telas de cadastro)
- [ ] `npm run packaged:build:verify -- --self-test` (fixtures positivas e negativas do gate de pacote)
- [ ] `npm run test:full` após as últimas alterações (inclui build e `e2e:installed:verify:dev`).

## 3. Build e pacote

- [x] `npm run release:clean` (nenhum Setup de outra versão em `release/` ou `release-unsigned/`;
      o pacote da 1.1.17 foi guardado em `release-archive/1.1.17/`, fora dos diretórios de release).
- [x] `npm run build` limpo; `dist/assets` contém `UI_BUILD_ID`, `schema-v7` e `"1.2.0"`.
- [x] `npm run dist:unsigned` (sem certificado neste ambiente): `Pesagens Individuais Setup 1.2.0.exe`,
      92.036.630 bytes, SHA-256 `7a40cc29b52d3bc9e0160efea83f7b0886abe185db6bb40e3263941b0f3883df`,
      build de 15/09/2026, `gitCommit` `cc024d8-dirty` (árvore com alterações não commitadas).
- [x] `npm run diagnostic:packaged:build:verify` verde (marcadores no `dist` e no `app.asar`,
      manifesto conferido, SHA-256 e tamanho batendo, Setup mais novo que os bundles).
      Para o marcador `schema-v7` existir no bundle, `DATA_BUILD_ID` deixou de ser interpolado;
      a coerência com o esquema virou a verificação `g.dataBuildId` do contrato de versão.
- [x] `npm run diagnostic:checksum` gerou `Pesagens Individuais Setup 1.2.0.exe.sha256`.
- [x] `npm run diagnostic:manifest` gerou `release-manifest.json` (formato 2) com `appVersion`,
      `dbSchemaVersion`, `backupFormatVersion`, `uiContract`, `dataContract`, `uiBuildId`,
      `dataBuildId`, `installer{file,sha256,sizeBytes,builtAt}`, `signed: false`,
      `distribution: unsigned-diagnostic`.
- [x] `npm run release:current-only:verify` (um único Setup, da versão atual).
- [x] `npm run diagnostic:packaged:source:verify` (main enxuto, preload, sem módulo nativo).
- [x] `npm run diagnostic:e2e:verify` (app instalado abre e responde no modo permissivo de dev).
- [ ] Versão **assinada** em `release/` (`npm run dist`): pendente de certificado Authenticode.

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
