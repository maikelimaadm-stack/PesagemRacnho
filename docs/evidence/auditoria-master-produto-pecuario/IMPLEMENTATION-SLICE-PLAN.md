# IMPLEMENTATION-SLICE-PLAN — Plano de fatias (para execução futura, após decisões)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

Cada fatia é pequena, deixa o sistema utilizável e termina com gate verde e evidência. Nenhuma fatia começa sem a ADR correspondente (M0). Os caminhos de arquivo são os atuais; nomes de arquivos novos são propostas.

## M0

### S-00.1 Medições prévias
- **Arquivos:** `scripts/measure-perf-baseline.mjs` (leitura), novo `scripts/measure-payload-size.mjs`.
- **Stores:** nenhuma. **Migração:** nenhuma. **UI:** nenhuma.
- **Testes:** execução das massas 36k/250k; relatório em `docs/evidence/auditoria-master-produto-pecuario/medicoes-m0/`.
- **Gate:** `perf:contract:verify`. **Rollback:** n/a.

### S-00.2 ADRs
- **Arquivos:** `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` (ADR-018…), `README.md` do pacote.
- **Gate:** revisão do responsável. **Rollback:** n/a.

## M1 — Cadastros mestres (v7)

### S-01.1 Esquema v7 + migração com dry-run
- **Arquivos:** `src/storage/indexedDb/schema.js` (`DB_VERSION=7`, `STORES_V6`, `REMOVED_STORES_V7`), `db.js` (upgrade), novo `src/storage/indexedDb/migrations/v7Backfill.js`, novo `src/modules/catalog/domain/catalogResolver.js`, `backupService.js` (`formatVersion 3`, `schemaUpgradeRequired`), `maintenanceDataAdapter.js` (backup físico antes da migração; ação "Executar backfill").
- **Stores:** `marcas`, `racas`, `categoriasAnimal`, `causasMorte`, `parceiros`, (`propriedades`); remover `lotes`.
- **Migração:** semear a partir dos valores distintos; preencher `marca_id/raca_id/categoria_id`; converter `situacao`; limpar `_localId/peso_kg/created_date/updated_date/status_animal` do payload; migrar `appSettings` catálogos; exportar sanidade e apagar chave.
- **UI:** Manutenção mostra dry-run e progresso.
- **Testes:** `verify-dexie-storage.mjs` (v7), `verify-dexie-backup.mjs` (restore v6 → backfill), `verify-dexie-import-restore.mjs`, novo `verify-v7-migration.mjs` com massas vazia/pequena/36k (250k opcional em `test:full`).
- **Gate:** `storage:all:verify`, `perf:contract:verify`.
- **Rollback:** backup físico pré-migração; app v6 recusa banco v7 (Dexie) → restaurar backup no v6.

### S-01.2 Serviços de cadastro
- **Arquivos:** novos `src/modules/catalog/application/{brandService,breedService,categoryService,deathCauseService,partnerService}.js` sobre `genericRepository`; retirar `registryService.js`.
- **Testes:** novo `scripts/verify-master-registry.mjs` (unicidade normalizada, inativação com vínculo, resolução por nome).
- **Gate:** `registry:master:verify` (novo, entra no `test:quick`).
- **Rollback:** fatia isolada; reverter arquivos.

### S-01.3 Telas ModeloBase1 dos cadastros
- **Arquivos:** `src/components/cadastros/CadastroAuxiliarPage.jsx` (porta `persistence: {list, save, remove}`), novas páginas `src/pages/{Marcas,Racas,Categorias,CausasMorte,Parceiros,Propriedades}.jsx`, `src/pages.config.js`, `src/Layout.jsx` (menu; remover Sanidade), `src/pages/CadastrosComerciais.jsx` e `ConfiguracoesSanidade.jsx` removidos.
- **Testes:** `verify-ui-consistency.mjs` (asserções por tela), capturas `evidence:screens` claro/escuro.
- **Gate:** `ui:consistency:verify`, `docs:user:verify` (guia atualizado).
- **Rollback:** reverter páginas; stores permanecem (sem dano).

### S-01.4 Lançamento seleciona cadastros
- **Arquivos:** `src/pages/LancamentoPesagensIndividuais.jsx` (substituir `ComboboxComNovo` de marca/raça/era por seletores de cadastro; remover `marcasExistentes/racasExistentes/erasExistentes`), `src/components/pesagens/ConfirmarAnimalSnDialog.jsx`, `src/modules/animals/domain/snAnimal.js` (raça padrão da empresa), `weighingMapper.js` (colunas `marca_id`, `categoria_id`), `weighingDataAdapter.js` (gravar ids no animal/identificador).
- **Testes:** `verify-animal-history-integrity.mjs`, `verify-enterprise-hardening.mjs`, `verify-operational-customization.mjs` (reescrito).
- **Gate:** `test:quick`.
- **Rollback:** reverter tela; dados já têm ids e texto.

### S-01.5 Remoção do legado comercial em `appSettings`
- **Arquivos:** `src/components/pesagens/GerenciarSaidasDialog.jsx` (remover), Lançamento (remover import/uso), `registryService.js` (remover).
- **Gate:** `runtime:legacy:verify`, `lint`.
- **Rollback:** reverter arquivos.

## M2 — Identificadores (v7, mesma versão se lançado junto; senão v7.1 lógica sem bump)

### S-02.1 Faixas e exceções
- **Arquivos:** `schema.js` (`faixasIdentificadores`, `excecoesIdentificadores`), novo `src/modules/identifiers/application/identifierInventoryService.js`, domínio `src/modules/identifiers/domain/rangeMath.js` (próximo livre, saldo).
- **Testes:** novo `scripts/verify-identifier-inventory.mjs`.
- **Gate:** `identifier:inventory:verify` (novo). **Rollback:** stores vazias; reverter.

### S-02.2 Identificadores com tipo e validade + unicidade no serviço
- **Arquivos:** `weighingDataAdapter.js` (criação do identificador: `tipo`, `marca_id`, `faixa_id`, `inicio`), novo `animalIdentifierService.js` (troca com `fim/motivo`), `health.js` (regras novas), migração de `visual_marca` → `VISUAL`.
- **Testes:** `verify-animal-history-integrity.mjs`, `verify-enterprise-hardening.mjs`.
- **Gate:** `test:quick`. **Rollback:** migração reversível (tipo é string).

### S-02.3 Resolução por índice no Lançamento e tela Faixas
- **Arquivos:** Lançamento (`buildAnimalLookupIndex` das pesagens → consulta a `animalIdentificadores`/`animais`), `SequenciaBrincos.jsx` (visão do serviço; remover `window.__sequenciaBrincos`), nova `src/pages/FaixasIdentificadores.jsx`, `Layout.jsx`.
- **Testes:** `perf:baseline` 36k navegador (abertura < 1 s), `verify-ui-consistency.mjs`.
- **Gate:** `perf:contract:verify`, `ui:consistency:verify`. **Rollback:** reverter tela; serviço permanece.

## M3 — Lançamento enxuto

### S-03.1 Domínio: peso por evento, duplicidade, lote por projeção
- **Arquivos:** `weighingMapper.js` (`weightRequiredFor`), `weighingDataAdapter.js` (duplicidade no dia; ocupação por `animalLotes`), `health.js` (usa a mesma função), novo `src/modules/lots/application/lotSuggestionService.js`.
- **Testes:** `verify-weighing-mapper.mjs`, `verify-enterprise-hardening.mjs` (casos novos).
- **Gate:** `test:quick`. **Rollback:** reverter.

### S-03.2 Telas Apartações/Lotes e remoção do popup
- **Arquivos:** nova `src/pages/ApartacoesLotes.jsx`, remover `GerenciarApartacoesDialog.jsx` e propagação de renome (`propagateApartacaoRename/propagateLoteRename`), Lançamento.
- **Gate:** `ui:consistency:verify`. **Rollback:** reverter.

### S-03.3 Formulário enxuto e contexto de sessão
- **Arquivos:** Lançamento (remover blocos compra/venda/abate e olhinhos; faixa de contexto; cadastro rápido), `sessoesPesagem` padrões (`weighingDataAdapter`), novo `sessionContextService.js`, `PesagensIndividuais.jsx` (edição dos campos comerciais legados permanece só aqui até M4).
- **Testes:** `verify-operational-customization.mjs` e `verify-ui-consistency.mjs` reescritos; roteiro humano de 50 animais.
- **Gate:** `test:quick` + evidência humana. **Rollback:** reverter tela (dados intactos).

## M4 — Comercial e embarque (v8)

### S-04.1 Esquema v8 + migração de operações
- **Arquivos:** `schema.js` (`operacoesComerciais`, índices `pesagens.operacao_id/motivo_saida`, enum `embarques.status`, `parceiro_id`), `migrations/v8Backfill.js` (agrupamento de saídas/compras legadas), `backupService.js`.
- **Testes:** `verify-v8-migration.mjs` (novo), `storage:all:verify`.
- **Gate:** `storage:all:verify`. **Rollback:** backup físico pré-migração.

### S-04.2 Serviços comerciais e de embarque
- **Arquivos:** novos `src/modules/commercial/application/commercialOperationService.js`, `domain/operationStateMachine.js`; `shipmentService.js` (máquina de estados), `shipmentMapper.js`.
- **Testes:** novos `verify-commercial-operations.mjs`, `verify-shipment-state.mjs`.
- **Gate:** ambos entram no `test:quick`. **Rollback:** reverter.

### S-04.3 Telas Operações e Embarques; Lançamento seleciona operação
- **Arquivos:** novas `src/pages/OperacoesComerciais.jsx`, `src/pages/Embarques.jsx`; remover `GerenciarEmbarquesDialog.jsx`; Lançamento (motivo → operação aberta); `ResumoVendaDia.jsx`/`ResumoEmbarque.jsx` lendo operação/embarque.
- **Gate:** `ui:consistency:verify`, capturas. **Rollback:** reverter telas.

### S-04.4 Relatórios comerciais mínimos com manifesto
- **Arquivos:** novo `src/modules/reports/application/reportExportService.js` (CSV + manifesto + hash), páginas de operação (aba Relatório).
- **Gate:** novo `reports:manifest:verify`. **Rollback:** reverter.

## M5 — Sessão, fechamento e ficha

### S-05.1 Sessão com enum, snapshot, bloqueio
- **Arquivos:** `weighingDataAdapter.js` (recusa evento em sessão fechada; índice `[data+local]`), `operationalInsightsService.js` (pendências no serviço, snapshot, `motivo_reabertura`), migração de valores.
- **Testes:** novo `verify-session-closing.mjs`. **Gate:** `session:closing:verify`. **Rollback:** reverter.

### S-05.2 Fechamento na Tela Mãe
- **Arquivos:** `src/pages/FechamentoDia.jsx` → `FechamentoSessao.jsx`, remover `operational-insights.css` desta tela.
- **Gate:** `ui:consistency:verify`, capturas. **Rollback:** reverter.

### S-05.3 Animais (lista + ficha) e auditoria com resumo
- **Arquivos:** nova `src/pages/Animais.jsx` (absorve `FichaAnimal.jsx`), `weighingDataAdapter.js` (auditoria `resumo`), tela administrativa de auditoria mínima em Manutenção.
- **Gate:** `ui:consistency:verify`, `animal:history-integrity:verify`. **Rollback:** reverter.

## Regras de execução

1. Uma fatia por vez, um dono por vez; a próxima só começa com `test:quick` verde.
2. Toda fatia registra evidência em `docs/evidence/<slice>/` (capturas, relatório, medição).
3. Documentação do usuário atualizada na mesma fatia quando o comportamento muda (07 §13).
4. Nenhuma fatia edita gates para "passar"; gates mudam apenas quando o contrato muda, com registro.
