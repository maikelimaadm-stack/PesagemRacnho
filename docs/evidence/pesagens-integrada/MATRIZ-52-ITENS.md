# Matriz dos 52 itens — missão pesagens-integrada

Legenda do diagnóstico: **confirmado** (caminho de código que causa o defeito, reproduzido em teste), **risco reproduzido**, **risco não reproduzido** (teste negativo prova que não acontece), **decisão preservada** (comportamento intencional mantido e documentado).
Status final: **PASS** (implementado e com teste automatizado verde), **FAIL**, **BLOQUEADO** (depende de algo fora do repositório), **PREEXISTENTE** (já correto antes; teste prova), **PENDENTE** (ainda não tratado nesta execução — ver `CONTINUIDADE.md`).

Base: `origin/main` 9392274 (app 1.5.6, Dexie v8). Atualizado a cada checkpoint.

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
| P14 | confirmado: só há backups pré-operação; não há agenda periódica nem cópia externa | — | — | — | PENDENTE |
| P15 | **decisão preservada**: peso inteiro (`Math.floor`) mantido; leitura bruta guardada em `balanca_leitura.kg_bruto` | ADR-052 (`docs/arquitetura-produto/16-MISSAO-INTEGRADA.md`), allowlist `peso_origem`/`balanca_leitura` | `equipment:contract:verify` (formatWeightForField), E2E (bruto 328,4 → gravado 328) | — | PASS |
| P16 | homologação física da S3 — sem balança no ambiente da missão | roteiro `VALIDACAO-MANUAL-WINDOWS-S3.md` (12 cenários) | simulador modo S3 + E2E + testes de unidade/serviço | não executado com equipamento real | BLOQUEADO (pendente de homologação física) |
| P17 | sem defeito relatado; auditoria achou fechamento do dia que deixava sessão aberta → corrigido; refresh pós-lançamento/importação coberto por `refetchOnMount` (1.5.6) e E2E | `closeWeighingDay`/`reopenWeighingDay`, ADR-056 | `scripts/verify-weighing-integrity.mjs` (`npm run weighing:integrity:verify`) (fechar, lançar, fechar), E2E Relação | — | PASS |
| P18 | configuração administrativa do GitHub (proteção da `main`) — fora do alcance; registrar recomendação | — | — | — | PENDENTE |
| P19 | confirmado: `createDatabaseBackup` e `createFullDataBackup` chamam `persistFullBackup` igual; dois botões | — | — | — | PENDENTE |
| P20 | confirmado: Manutenção mistura backup, migração, export/import, limpeza, diagnóstico e relatórios | — | — | — | PENDENTE |
| P21 | confirmado: `listBackups` lista nome/tamanho/data dos 10 primeiros, sem "último verificado" | — | — | — | PENDENTE |
| P22 | confirmado: backup só na pasta local do app; nenhuma cópia em destino independente | — | — | — | PENDENTE |
| P23 | confirmado: Configurações num formulário misto (geral, curral, comercial, segurança, relatórios, balança, dados) | — | — | — | PENDENTE |
| P24 | confirmado: JSON de backup, export de pesagens e import JSON na mesma tela | — | — | — | PENDENTE |
| P25 | confirmado: docs de backup citam 1.2.0/banco v7; detalhes técnicos na área comum | — | — | — | PENDENTE |
| P26 | confirmado: backup completo é JSON em texto puro com dados comerciais e hash/salt de senha | — | — | — | PENDENTE |

## Fase B — novas capacidades (F01–F26)

| ID | Capacidade | Código | Teste automatizado | Evidência | Status |
|---|---|---|---|---|---|
| F01 | Entradas (Compra, Transferência recebida, Nascimento, Ajuste) | — | — | — | PENDENTE |
| F02 | Saídas (Venda, Abate, Transferência enviada, Morte, Doação, Ajuste) | — | — | — | PENDENTE |
| F03 | Movimentações / livro de movimentos | — | — | — | PENDENTE |
| F04 | Nascimento/idade com precisão conhecida | — | — | — | PENDENTE |
| F05 | Idade × era × categoria produtiva × dentição | — | — | — | PENDENTE |
| F06 | Identificadores / estoque de brincos | — | — | — | PENDENTE |
| F07 | "Marcas a Fogo" (rótulo) | — | — | — | PENDENTE |
| F08 | Medicamentos com posologia estruturada | — | — | — | PENDENTE |
| F09 | Painel de dose sugerida | — | — | — | PENDENTE |
| F10 | Carência operacional | — | — | — | PENDENTE |
| F11 | Desempenho comparativo | — | — | — | PENDENTE |
| F12 | Calendário de águas/seca | — | — | — | PENDENTE |
| F13 | Metas e cenários | — | — | — | PENDENTE |
| F14 | Planejado × realizado | — | — | — | PENDENTE |
| F15 | Rastreabilidade interna | — | — | — | PENDENTE |
| F16 | Documentos/anexos offline | — | — | — | PENDENTE |
| F17 | Conciliação de inventário | — | — | — | PENDENTE |
| F18 | Painel do gestor | — | — | — | PENDENTE |
| F19 | Página Backup e Restauração | — | — | — | PENDENTE |
| F20 | Backup periódico | — | — | — | PENDENTE |
| F21 | Destino externo | — | — | — | PENDENTE |
| F22 | Catálogo e retenção | — | — | — | PENDENTE |
| F23 | Restauração guiada | — | — | — | PENDENTE |
| F24 | Separação funcional (Importação/Exportação/Manutenção avançada) | — | — | — | PENDENTE |
| F25 | Parametrização | — | — | — | PENDENTE |
| F26 | Arquitetura/UX dos parâmetros | — | — | — | PENDENTE |
