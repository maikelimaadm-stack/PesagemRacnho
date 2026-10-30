# Matriz dos 52 itens — missão pesagens-integrada

Legenda do diagnóstico: **confirmado** (caminho de código que causa o defeito, reproduzido em teste), **risco reproduzido**, **risco não reproduzido** (teste negativo prova que não acontece), **decisão preservada** (comportamento intencional mantido e documentado).
Status final: **PASS** (implementado e com teste automatizado verde), **FAIL**, **BLOQUEADO** (depende de algo fora do repositório), **PREEXISTENTE** (já correto antes; teste prova), **PENDENTE** (ainda não tratado nesta execução — ver `CONTINUIDADE.md`).

Base: `origin/main` 9392274 (app 1.5.6, Dexie v8). Atualizado a cada checkpoint.

## Auditoria corretiva R3 (2026-10-30)

Os achados R3-01 a R3-03 estão em `AUDITORIA-CORRETIVA-R3.md`, com as reproduções VERMELHO em `b3f8b61` e os testes
VERDE.

| Item | Reaberto por | Assunto |
|---|---|---|
| F16, F23 | R3-01 | estado crítico de restauração só na memória; sumia ao reiniciar |
| F16, F23 | R3-02 | compensação e restauração conferiam contagens, não conteúdo |
| F19 | R3-01 | página Backup e Restauração sem o estado crítico persistente |
| F10 | R3-03 | esclarecimento de carência vazio virava zero dia |

Nenhum item novo é declarado homologado. P16, P18, o R04 no Windows real e o teste em cópia isolada do banco real
continuam pendentes.

## Auditoria corretiva R2 (2026-10-30)

Os achados R2-01 a R2-06 estão em `AUDITORIA-CORRETIVA-R2.md`, com as reproduções VERMELHO em `a14bc3f` e os testes
VERDE.

| Item | Reaberto por | Assunto |
|---|---|---|
| P14, F20 | R2-01 | periódico adiado por backup parcial |
| P19 | R2-01 | backup parcial tratado como verificado |
| P21 | R2-01, R2-06 | backup parcial tratado como verificado; conferência limitada não declarada |
| F22 | R2-01 | retenção e estado do parcial |
| F16, F23 | R2-02 | restauração sem compensação depois da troca da base |
| F10 | R2-03 | carência desconhecida expirava em 180 dias |
| F17 | R2-04 | indeterminado contado duas vezes |

Esses itens ficaram EM_CORREÇÃO durante a R2 e só voltaram a PASS com o teste novo. O `test:full` não terminava (R2-05);
agora ele usa `import:contract:verify`, e a capacidade é medida à parte.

Continuam pendentes:

- **P16** e **P18**: BLOQUEADOS;
- **R04** (instalador no Windows): BLOQUEADO PARA HOMOLOGAÇÃO WINDOWS.

## Auditoria corretiva R1 (2026-10-29/30)

Achados R01–R09 sobre a PR #4: diagnóstico, reproduções ANTES/DEPOIS e testes em `AUDITORIA-CORRETIVA-R1.md`.
Os itens cujo PASS foi invalidado por um achado ficaram **EM_CORREÇÃO** durante a auditoria. Foram corrigidos e
voltaram a PASS só com o teste novo verde: P14, P15, P19, P21, F01, F02, F10, F15, F16, F17, F20, F21 e F23. Cada
linha diz qual achado a reabriu.

Limites que continuam:

- **P16** e **P18** continuam **BLOQUEADOS**.
- A volta para a 1.5.x (R04) tem os dados executados aqui; os passos de instalador no Windows real ficam
  **BLOQUEADOS PARA HOMOLOGAÇÃO WINDOWS**.


## Fase A — correções e investigações (P01–P26)

| ID | Diagnóstico (inicial → final) | Código | Teste automatizado | Evidência | Status |
|---|---|---|---|---|---|
| P01 | **confirmado** → corrigido: o animal B era liberado com o peso do A (campo pós-save = monitor) | `domain/captureGate.js`, `scaleService.js` (`evaluateCapture`/`consumeCapture`), Lançamento (salva o peso da leitura liberada; `consumeCapture` só após gravar; `is-waiting`) | `captureGate.test.js` (A→B, plataforma vazia, troca sem esvaziar, mesmo peso, leitura tardia), `scaleService.test.js` (P01), E2E 7003/7004 | E2E falha com o portão desligado (7004 salvo com 328) | PASS |
| P02 | **confirmado** → corrigido: `captureWeightForLaunch` promovia `lastReading` a estável após 5 s | `scaleService.captureWeightForLaunch` rejeita `SCALE_NOT_STABLE` | `scaleService.test.js` (oscilação > 5 s), `captureGate.test.js` (oscilação contínua) | — | PASS |
| P03 | **confirmado** → corrigido: `lastStable` sobrevivia à desconexão/tearDown | `scaleService` (`epoch`, `bumpEpoch` em conexão/queda/tearDown/disconnect; `getLastStableReading` só da época atual; silêncio durante queda não confirma) | `scaleService.test.js` (queda do link, desconectar, troca de aparelho, seq monotônica), `captureGate.test.js` (reconexão) | — | PASS |
| P04 | **confirmado** (main: 1 movimento ativo da pesagem cancelada) → corrigido | `domain/weighingMovements.js`, `reconcileWeighingMovements` (cancela com auditoria; movimento sem pesagem intocado), ADR-054 | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`): cancelamento + movimento livre | reprodução na main registrada | PASS |
| P05 | **risco reproduzido** (main aceitou mover o Cadastro para depois do Manejo) → corrigido | `domain/animalTimeline.js`, `assertAnimalTimeline` na transação de update/create, ADR-053 | `animalTimeline.test.js`, `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) | main: SOFTFAIL 'Cadastro depois do Manejo' | PASS |
| P06 | **confirmado** → corrigido: correção de número/marca no Cadastro sincroniza o identificador VISUAL e recusa colisão com outro animal ativo (auditoria CORRIGIR) | `correctVisualIdentification` em `updateEntry` | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (501, colisão 600 sem gravar) | — | PASS |
| P07 | **risco reproduzido** (main gravou as duas concorrentes) → corrigido: um Manejo oficial por animal/dia na transação; id do ciclo contra envio repetido | `animalTimeline`, `assertAnimalTimeline`, `cicloLancamentoRef` (A1) | `animalTimeline.test.js`, `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (concorrente e id repetido) | main: SOFTFAIL 'só uma das concorrentes grava'; importação com duplicata explícita preservada (ADR-053) | PASS |
| P08 | **confirmado** → corrigido: derivados recalculados na mesma transação; falha injetada não grava nada | `recalculateAnimalSeriesInTransaction`, `reconcileAnimalAfterChange`, serviço com `onlyChanged`, ADR-054 | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (falha injetada no recálculo) | — | PASS |
| P09 | **confirmado** → corrigido: editar lote passado reconcilia movimentos e permanências | `updateEntry` + `reconcileAnimalAfterChange` | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (L1→L3→L2) | — | PASS |
| P10 | **confirmado** (main: `[]` com banco falhando) → corrigido: erro `WEIGHING_STORAGE_001`; Lançamento mostra aviso e bloqueia salvar | `weighingService.listEntries`, Lançamento (`erroCarregamento`), ADR-055 | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (banco bloqueado) | reprodução na main registrada | PASS |
| P11 | **risco reproduzido** em teste de domínio (número reaproveitado na marca) → corrigido: sem ligação por coincidência quando ambíguo; lista de exceções na integridade | `ambiguousLegacyKeys`/`getAnimalHistory` (domain/animalHistory), `logicalIntegrity().warnings`, ADR-056 | `animalHistory.test.js` | — | PASS |
| P12 | **confirmado** → corrigido: data anterior validada com `parseCivilDate`; timeline recusa data impossível | `weighingCalculations.js`, `animalTimeline` | `weighingCalculations.test.js` (30/02, negativos e zero), `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) | — | PASS |
| P13 | **confirmado** (main: 3 → 8 linhas em 5 reconstruções) → corrigido: só grava a diferença | `rebuildAnimalLotProjection` + `deriveLotStays`, ADR-054 | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (5 reconstruções sem mudança; movimentos idem; reparo geral idempotente) | reprodução na main registrada | PASS |
| P14 | **confirmado** → corrigido: backup periódico com o app aberto (política configurável, sem duplicar, espera após falha) + cópia externa conferida | `backupCenterService.runPeriodicIfDue`, `PeriodicBackupScheduler`, `backupStore.cjs` | `scripts/verify-backup-center.mjs` (`npm run backup:center:verify`), `backupPolicy.test.js` | ADR-063 | PASS → reaberto na auditoria R1 (R03) → PASS de novo com o teste novo → reaberto na R2 (R2-01) → PASS de novo com o teste novo |
| P15 | **decisão preservada**: peso inteiro (`Math.floor`) mantido; leitura bruta guardada em `balanca_leitura.kg_bruto` | ADR-052 (`docs/arquitetura-produto/16-MISSAO-INTEGRADA.md`), allowlist `peso_origem`/`balanca_leitura` | `equipment:contract:verify` (formatWeightForField), E2E (bruto 328,4 → gravado 328) | — | PASS → reaberto na auditoria R1 (R07) → PASS de novo com o teste novo |
| P16 | homologação física da S3 — sem balança no ambiente da missão | roteiro `VALIDACAO-MANUAL-WINDOWS-S3.md` (12 cenários) | simulador modo S3 + E2E + testes de unidade/serviço | não executado com equipamento real | BLOQUEADO (pendente de homologação física) |
| P17 | sem defeito relatado; auditoria achou fechamento do dia que deixava sessão aberta → corrigido; refresh pós-lançamento/importação coberto por `refetchOnMount` (1.5.6) e E2E | `closeWeighingDay`/`reopenWeighingDay`, ADR-056 | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (fechar, lançar, fechar), E2E Relação | — | PASS |
| P18 | configuração administrativa do GitHub — não alterada (sem permissão; proibido pelo prompt) | recomendação exata em `RECOMENDACAO-P18.md` (checks `testes`/`instalador`, PR obrigatório, sem force-push); publicação só por tag (job `publicar` separado) | — | — | BLOQUEADO (ação do proprietário) |
| P19 | **confirmado** → corrigido: um comando `createBackupNow` (grava + verifica); nomes antigos delegam a ele; tela com um botão só | `maintenanceDataAdapter.createBackupNow`, `maintenanceService`, `ManutencaoSistema` | `scripts/verify-backup-recovery.mjs` (`npm run backup:recovery:verify`), E2E (botão único + verificado) | — | PASS → reaberto na auditoria R1 (R01) → PASS de novo com o teste novo → reaberto na R2 (R2-01) → PASS de novo com o teste novo |
| P20 | **confirmado** → corrigido: Backup e Restauração em página própria; Manutenção avançada sem o botão de backup e com limpeza/reset em aba própria; importação/exportação nas telas de origem | `BackupRestauracao.jsx`, `ManutencaoSistema.jsx`, `Importacao.jsx`, `PesagensIndividuais.jsx` | `maintenance:ui:verify`, `backup:recovery:verify`, E2E passo 8 | ADR-063 | PASS |
| P21 | **confirmado** → corrigido: "verificado" só com leitura de volta (IPC `app:readUserFile` contido); status separa último verificado × não verificado × falhou; botão Verificar por arquivo | `electron/main.cjs` (`app:readUserFile`), `verifyBackupFile`, `getBackupStatus`, tela | `scripts/verify-backup-recovery.mjs` (`npm run backup:recovery:verify`) (truncado, adulterado, trocado), E2E | — | PASS → reaberto na auditoria R1 (R03) → PASS de novo com o teste novo → reaberto na R2 (R2-01, R2-06) → PASS de novo com o teste novo |
| P22 | **confirmado** → corrigido: cópia para destino escolhido no diálogo (pendrive/disco/pasta), conferida por SHA-256; destino ausente = "cópia pendente" sem falso positivo; destino dentro dos dados recusado | `backupStore.cjs`, `backupIpc.cjs`, página Backup | `backup:center:verify` | ADR-063 | PASS |
| P23 | **confirmado** → corrigido: Configurações gerais (Geral, Segurança) × Parametrização (regras, seção por seção, mesmas chaves) × Balança e Equipamentos | `Configuracoes.jsx` (`ConfigSection`), `Parametrizacao.jsx`, `Equipamentos.jsx` | `ui:shell-settings:verify`, `auth:permissions:verify`, E2E passos 7 e 12 | ADR-063 | PASS |
| P24 | **confirmado** → corrigido: exportação rotulada "(não é backup)"; restauração recusa exportação de pesagens com mensagem clara (`DEXIE_BACKUP_007`) | `backupService.readBackup`, tela | `scripts/verify-backup-recovery.mjs` (`npm run backup:recovery:verify`) | — | PASS |
| P25 | **confirmado** → corrigido: `docs/user/BACKUP-E-RESTAURACAO.md` reescrito para a versão vigente (banco 8, formato 3, botão único, verificação, reconciliar, exportação ≠ backup) | doc de usuário | `npm run docs:user:verify` | — | PASS (detalhes técnicos sob Avançado: ver F24) |
| P26 | **confirmado** (risco, sem vazamento) → corrigido: aviso na tela e no guia; diagnóstico sem hash/salt; backup protegido opcional AES-GCM-256 (PBKDF2, senha não guardada) | tela Backup, `protectedBackup.js` | `backup:recovery:verify`, `backup:center:verify` | ADR-063 | PASS |

**Gate A:** CI verde (Testes + Gerar instalador) em 0cb292f.

## Fase B — novas capacidades (F01–F26)

**Checkpoint B0 — base de dados v9 (aditiva):** Dexie v9 com `STORES_V9` (v7/v8 intactas), stores novas vazias,
`natureza` ENTRADA/SAIDA/INTERNA nos movimentos, operações LEGADAS (Entrada por dia, Saída por dia e motivo) com
item por pesagem, sem inventar parceiro/preço/documento; backfill idempotente com backup pré-migração; backup v8
restaurável no app v9. Gate: `npm run migration:v9:verify` (no `test:quick`/`test:full`). Modelo:
`docs/arquitetura-produto/17-MODELO-DADOS-V9.md`.

| ID | Capacidade | Código | Teste automatizado | Evidência | Status |
|---|---|---|---|---|---|
| F01 | Entradas (Compra, Transferência recebida, Nascimento, Ajuste) | `modules/livestock` (operationRules, operationsDataAdapter, operationsService), tela Rebanho › Entradas | `scripts/verify-livestock-operations.mjs` (`npm run livestock:operations:verify`), `operationRules.test.js`, E2E passo 9 | entrada sem peso = PENDENTE_PESAGEM (sem 0 kg); Cadastro posterior adota a entrada; identificação em uso recusada sem gravar; nascimento com mãe | PASS → reaberto na auditoria R1 (R07) → PASS de novo com o teste novo |
| F02 | Saídas (Venda, Abate, Transferência enviada, Morte, Doação, Ajuste) | idem, tela Rebanho › Saídas | `livestock:operations:verify`, `sanity:posology:verify` | Venda/Abate exigem peso; Morte sem peso = nulo; operação atômica; ajuste com justificativa; cancelamento reabre o animal; carência no abate (F10) | PASS → reaberto na auditoria R1 (R05, R07) → PASS de novo com o teste novo |
| F03 | Movimentações / livro de movimentos | idem + `weighingMovements` (`lotEvents`), tela Rebanho › Movimentações | `livestock:operations:verify` | movimentação sem pesagem; pesagem seguinte no lote novo não duplica; reconciliação idempotente; mudança de propriedade; ADR-058 | PASS |
| F04 | Nascimento/idade com precisão conhecida | `domain/ageModel.js` (ageAt, validateBirthInput), `animalProfileService`, Ficha › Identidade | `scripts/verify-animal-profile.mjs` (`npm run animal:profile:verify`), `ageModel.test.js`, E2E passo 10 | data exata/mês estimado (faixa)/idade declarada/desconhecida; idade muda com o calendário sem pesagem; correção auditada | PASS |
| F05 | Separar idade, era, categoria produtiva e dentição | `ageModel` (eraAt, categoriaProdutiva, validateDentition), `age-policy:local`, Sistema › Parametrização | `animal:profile:verify`, `ageModel.test.js` | era por idade parametrizável; era legada (peso) intacta; categoria informada × sugerida (política desligada por padrão); dentição observada | PASS |
| F06 | Identificadores / estoque de brincos | `domain/identifierStock.js`, `animalProfileDataAdapter`, Cadastros › Identificadores, Ficha (aplicar/trocar) | `animal:profile:verify`, `identifierStock.test.js`, E2E passo 10 | livro imutável; recebimento atômico; aplicação única (concorrente); oficial não reaproveitado; troca conserva animal; conferência física; backup | PASS |
| F07 | Cadastro “Marcas a fogo” | rótulos (menu, página, campo) em `registryDefinitions`/`Marcas.jsx`/`Layout.jsx` | `registry:ui:verify`, E2E (campo "Marca a fogo") | store/chaves/importação/colunas de relatório inalterados (compatibilidade) | PASS |
| F08 | Posologia estruturada e versionada | `sanity/domain/posology.js`, `posologyDataAdapter`, Sanidade › Posologias | `scripts/verify-sanity-posology.mjs` (`npm run sanity:posology:verify`), `posology.test.js`, E2E passo 11 | rascunho incompleto não aprova nem calcula; aprovada imutável; nova versão substitui; texto legado = referência; ADR-060 | PASS |
| F09 | Painel de dose sugerida × aplicada | `computeDose`, `getDoseSuggestion`, painel do Lançamento e aplicação avulsa | `sanity:posology:verify`, `sanity:launch-integration:verify` | arredondamento da regra; faixas; peso estimado/futuro bloqueia; só peso estável na pesagem automática; confirmação; snapshot; peso mudou = recalcular | PASS |
| F10 | Carência e liberação para abate | `withdrawalEnd`/`withdrawalStatus`, Saídas (bloqueio + liberação técnica) | `sanity:posology:verify` | data civil; zero ≠ desconhecida; abate em carência bloqueado sem liberação auditada; venda avisa | PASS → reaberto na auditoria R1 (R05) → PASS de novo com o teste novo → reaberto na R2 (R2-03) → PASS de novo com o teste novo → reaberto na R3 (R3-03) → PASS de novo com o teste novo |
| F11 | Desempenho por raça, sexo, idade/era, lote, origem e época | `analytics/domain/performance.js`, Relatórios › Desempenho | `scripts/verify-analytics-forecast.mjs` (`npm run analytics:forecast:verify`) | intervalo observado com dimensões no início; n/dias/GMD ponderado/IC; amostra insuficiente ≠ zero; intervalo curto fora; quem perde peso; ADR-061 | PASS |
| F12 | Calendário de águas, transição e seca | `seasonCalendar.js`, Parametrização › Calendário | `analytics:forecast:verify`, E2E passo 12 | por propriedade/ano com fonte; sem sobreposição; específico prevalece; dias expostos; intervalo misto não atribuído | PASS |
| F13 | Metas e cenários de peso/GMD | `targets.js`, `projection.js`, Parametrização › Metas e cenários | `analytics:forecast:verify`, `projection.test.js` | oráculo 314,6 kg; bissexto; troca no meio do mês; precedência; conflito explícito; projeção nunca gravada | PASS |
| F14 | Planejado × realizado por coorte | `compareToTarget`, `monthlyObserved`, painel › Metas | `analytics:forecast:verify` | GMD observado × meta; peso na data observado/projetado; 01/01→01/03 não vira GMD mensal | PASS |
| F15 | Rastreabilidade interna completa | `domain/traceability.js`, Ficha › Dossiê CSV/JSON | `animal:profile:verify` | origem/documentos/propriedades/lotes/sanidade+carência/dentição/destino; desconhecidos listados; aviso de não-certificação | PASS → reaberto na auditoria R1 (R06) → PASS de novo com o teste novo |
| F16 | Documentos e anexos offline + backup completo | `modules/documents`, `electron/ipc/attachmentStore.cjs`/`attachmentIpc.cjs`, quadro Documentos (operação e ficha), `maintenanceDataAdapter` (pacote) | `scripts/verify-documents-backup.mjs` (`npm run documents:backup:verify`), E2E passo 9 | anexo por diálogo nativo (sem caminho do renderer), extensão/25 MB; backup = JSON + `.anexos` verificado; faltando = não completo; corrompido = falha; restauração em base limpa com mesmo hash; cancelado conserva arquivo; ADR-062 | PASS → reaberto na auditoria R1 (R02) → PASS de novo com o teste novo → reaberto na R2 (R2-02) → PASS de novo com o teste novo → reaberto na R3 (R3-01, R3-02) → PASS de novo com o teste novo |
| F17 | Conciliação de inventário | `domain/inventory.js`, tela Rebanho › Inventário (CSV) | `inventory.test.js`, `livestock:operations:verify`, E2E passo 9 | saldo pela data do evento; lote/propriedade com internas separadas; conferência por animal; cancelado não conta | PASS (categoria na data → F05) → reaberto na auditoria R1 (R06) → PASS de novo com o teste novo → reaberto na R2 (R2-04) → PASS de novo com o teste novo |
| F18 | Relatório gestor | `dashboard.js` + `dashboardExport.js`, Relatórios › Desempenho | `analytics:forecast:verify` (paridade CSV/XLSX/HTML), E2E passo 12 | ranking com amostra; perdendo peso; seca por lote; metas; comparação com ano anterior; exportação CSV/Excel/PDF | PASS |
| F19 | Página Backup e Restauração | `BackupRestauracao.jsx`, `backupCenterService` | `backup:center:verify`, E2E passo 8 | situação local × externa × periódico; botão único; catálogo paginado/pesquisável com Verificar | PASS → reaberto na R3 (R3-01) → PASS de novo com o teste novo |
| F20 | Backup periódico | `runPeriodicIfDue`, `PeriodicBackupScheduler`, snapshot em transação única | `backup:center:verify`, `backupPolicy.test.js` | só com app aberto; não duplica (concorrente); intervalo; espera após falha; 3 falhas/dia | PASS → reaberto na auditoria R1 (R03) → PASS de novo com o teste novo → reaberto na R2 (R2-01) → PASS de novo com o teste novo |
| F21 | Destino externo | `backupStore.cjs`/`backupIpc.cjs` | `backup:center:verify` | diálogo nativo; SHA-256 lido de volta; espaço; indisponível = pendente | PASS → reaberto na auditoria R1 (R03) → PASS de novo com o teste novo |
| F22 | Catálogo, retenção e criptografia | `planRetention`, `backup:delete`, `protectedBackup.js` | `backup:center:verify`, `backupPolicy.test.js` | só periódicos rotacionam; último verificado/segurança preservados; AES-GCM com senha certa/errada/alterado | PASS → reaberto na R2 (R2-01) → PASS de novo com o teste novo |
| F23 | Restauração guiada | `inspectBackup`/`restoreGuided`, assistente na página | `backup:center:verify` | inspecionar sem gravar; comparar; RESTAURAR digitado; só ADMIN; pré-backup; anexos; integridade; sessão encerrada | PASS → reaberto na auditoria R1 (R01, R02) → PASS de novo com o teste novo → reaberto na R2 (R2-02) → PASS de novo com o teste novo → reaberto na R3 (R3-01, R3-02) → PASS de novo com o teste novo |
| F24 | Separação funcional | Manutenção avançada (Sistema/Dados/Controle), Importação (JSON técnico), Relação (exportação técnica) | `maintenance:ui:verify`, `ui:consistency:verify`, E2E | destrutivo longe do backup; deep links antigos mantidos | PASS |
| F25 | Parametrização | `Parametrizacao.jsx` + `ConfigSection` (mesmas chaves), idade, calendário, metas, link sanidade | `auth:permissions:verify`, `ui:shell-settings:verify`, `analytics:forecast:verify`, `animal:profile:verify` | salvamento isolado por seção, descarte, aviso de pendência, permissão por grupo, sem duplicar fonte | PASS |
| F26 | Arquitetura/UX dos parâmetros | Configurações gerais × Parametrização × Balança e Equipamentos × Usuários | `ui:shell-settings:verify`, E2E passo 7 (balança em Equipamentos) | guia PARAMETRIZACAO-EQUIPAMENTOS | PASS |
