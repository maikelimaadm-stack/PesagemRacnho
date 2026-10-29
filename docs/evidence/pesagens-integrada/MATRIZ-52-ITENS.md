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
| P04 | confirmado na leitura: `bulkDeleteEntries` não cancela o `movimentosAnimais` da pesagem cancelada (só no animal órfão); o comentário de `replaceEntries` admite | — | — | — | PENDENTE |
| P05 | risco a reproduzir: editar o Cadastro ignora o próprio registro e não confere eventos anteriores à nova data | — | — | — | PENDENTE |
| P06 | confirmado na leitura: `updateEntry` (Cadastro) muda número/marca em `animais` sem tocar `animalIdentificadores` nem checar colisão | — | — | — | PENDENTE |
| P07 | risco a reproduzir: `validateAnimalChronology` roda fora da transação e não há regra de uma pesagem de Manejo por animal/dia no serviço | — | — | — | PENDENTE |
| P08 | confirmado na leitura: `replaceSameDayEntry` grava e só depois recalcula a série; falha no recálculo deixa derivados velhos sem marca | — | — | — | PENDENTE |
| P09 | confirmado na leitura: `updateEntry` reconstrói `animalLotes`, mas não reconcilia o movimento de mudança de lote da versão anterior | — | — | — | PENDENTE |
| P10 | confirmado na leitura: `weighingService.listEntries` engole a exceção e devolve `[]` | — | — | — | PENDENTE |
| P11 | risco a reproduzir: `sameAnimal` cai em número+marca quando um lado não tem `animal_id` | — | — | — | PENDENTE |
| P12 | confirmado na leitura: `calculateWeightGain` valida a data atual com `parseCivilDate`, mas a anterior só com `toUtcDay` (30/02 vira 02/03) | — | — | — | PENDENTE |
| P13 | confirmado na leitura: `rebuildAnimalLotProjection` apaga (soft) e recria todas as permanências a cada chamada | — | — | — | PENDENTE |
| P14 | confirmado: só há backups pré-operação; não há agenda periódica nem cópia externa | — | — | — | PENDENTE |
| P15 | **decisão preservada**: peso inteiro (`Math.floor`) mantido; leitura bruta guardada em `balanca_leitura.kg_bruto` | ADR-052 (`docs/arquitetura-produto/16-MISSAO-INTEGRADA.md`), allowlist `peso_origem`/`balanca_leitura` | `equipment:contract:verify` (formatWeightForField), E2E (bruto 328,4 → gravado 328) | — | PASS |
| P16 | homologação física da S3 — sem balança no ambiente da missão | roteiro `VALIDACAO-MANUAL-WINDOWS-S3.md` (12 cenários) | simulador modo S3 + E2E + testes de unidade/serviço | não executado com equipamento real | BLOQUEADO (pendente de homologação física) |
| P17 | sem defeito relatado; auditar sessão/cache/refresh pós-importação e repesagem | — | — | — | PENDENTE |
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
