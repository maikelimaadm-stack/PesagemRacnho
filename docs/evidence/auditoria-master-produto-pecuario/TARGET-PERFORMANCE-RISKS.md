# TARGET-PERFORMANCE-RISKS — Riscos de desempenho do modelo alvo

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Referência (F0/F1)

| Métrica p95 | F0 Node 36 mil | F0 navegador 36 mil | F1 Node 36 mil | Orçamento |
|---|---:|---:|---:|---:|
| Busca indexada por animal | 1,8 ms | 13 ms | 0,24 ms | < 100 ms |
| Identificação → peso | 8 ms | 20 ms | 2,8 ms | < 100 ms |
| Salvamento local | 4 980 ms | 3 169 ms | 76 ms | < 250 ms |
| Reconstrução do índice de animais (tela) | ~2 000 ms | 7 423 ms | pendente | — |

Fontes: `docs/evidence/f0-baseline/BASELINE.md`, `f1-optimized-final/BASELINE.md`, `F1-STATUS.md`. O navegador ainda não foi remedido após F1.

## 2. Riscos existentes que o modelo alvo herda

| ID | Risco | Onde | Efeito em 36 mil / 250 mil | Mitigação no alvo |
|---|---|---|---|---|
| R-01 | Índice de animais reconstruído das pesagens a cada recarga (D8) | Lançamento (`getRegisteredAnimals`) | 2–7 s / dezenas de s | resolver por `animalIdentificadores` + `animais` (índices); pendência F1 |
| R-02 | `FechamentoDia` e `FichaAnimal` carregam a base inteira | `loadOperationalCatalog` | segundos por abertura e por ação | consultas por `sessao_id` e `animal_id` |
| R-03 | Ocupação de lote por contagem de pesagens | `isLoteCheio` | O(N) por avaliação de lote, por animal | `animalLotes` abertos por `lote_id` |
| R-04 | Renomear apartação/lote regrava todas as pesagens + auditoria | `propagateApartacaoRename` | escrita em massa; auditoria dobra | parar de propagar; junção por id |
| R-05 | `auditoria.antes/depois` completos | adapter | backup cresce; restore lento | `resumo` de campos alterados para ATUALIZAR |
| R-06 | `bulkCreateEntries` carrega `animais`, `identificadores`, `pesagens` inteiros em memória | importação | 250 mil → heap alta (F0 exigiu 8 GB em Node) | consultas por chave em lote (`anyOf`) e importação em blocos com checkpoint |
| R-07 | `genericRepository.list()` faz `toArray()` + filtro em memória | todos os cadastros | irrelevante para cadastros pequenos; grave se `parceiros`/`animais` crescerem | usar `where()` nos índices declarados |

## 3. Riscos novos introduzidos pelo alvo

| ID | Risco | Análise | Mitigação |
|---|---|---|---|
| N-01 | Migração v7 com backfill de `marca_id/raca_id` em `animais` (12 mil em 36 mil pesagens; ~80 mil em 250 mil) dentro de `upgrade()` | `modify` em transação de versão; v6 já fez isso em `pesagens` | medir com massa 250 mil; opção de backfill fora da transação de versão |
| N-02 | Junção marca/raça/categoria/parceiro na grade da Relação | grades de 36 mil linhas paginadas; mapas em memória de ≤ centenas de registros | carregar cadastros uma vez em `Map`; custo desprezível |
| N-03 | Unicidade aplicativa de identificadores em transação | uma consulta indexada por `[marca_id+valor_normalizado]` por cadastro | dentro do orçamento (< 1 ms) |
| N-04 | Próximo número livre em faixa com muitas exceções | exceções por faixa raramente passam de dezenas; `[faixa_id+numero]` indexado | ok; teste com 1 000 exceções |
| N-05 | Operação comercial com centenas de animais fechada em uma transação | 1 evento SAÍDA + projeção por animal | igual a hoje por animal; transação única de ~300 animais é aceitável; acima disso, lotes com checkpoint |
| N-06 | Fechamento por sessão com snapshot | lê só a sessão | melhora em relação a hoje |
| N-07 | Stores novas no backup | dezenas/centenas de linhas cada | desprezível; `operacoesComerciais` cresce com as vendas (1 linha por operação, não por animal) |
| N-08 | Índices adicionais em `pesagens` (`motivo_saida`, `operacao_id`) | cada índice custa escrita; Dexie/IndexedDB tolera bem 2 índices a mais | medir salvamento após v7 contra 76 ms |

## 4. Orçamentos que o plano deve manter (ADR-017)

- salvar Manejo p95 < 250 ms na massa de 36 mil no **navegador** (ainda não remedido após F1);
- abertura de Lançamento < 1 s na massa de 36 mil (R-01);
- abertura de Fechamento < 500 ms por sessão (R-02);
- migração v7: < 60 s em 36 mil, com progresso visível; 250 mil medido antes de liberar.

## 5. Medições a fazer antes de implementar (sem alterar código)

1. Tamanho médio de `legacy_payload` e de `auditoria` por registro (massa 36 mil).
2. Tempo de `getRegisteredAnimals` no Chromium após F1.
3. Tempo de `db.version(7).upgrade` simulado em Node com `fake-indexeddb` na massa 250 mil.

Esses números entram como baseline do slice de migração (`IMPLEMENTATION-SLICE-PLAN.md`).
