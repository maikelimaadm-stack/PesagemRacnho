# PERFORMANCE — importação conciliada (fatia B)

**Reconciliação sanidade · lançamento · importação — fatia B · 17/09/2026 · branch `program/sanity-launch-import` (base `69b996a`) · Node v24.18.0 · fake-indexeddb 6 · Windows 11, 12 núcleos**

Medição pedida pela missão: histórico sintético de ~36 mil linhas / ~12 mil animais importado em Node +
fake-indexeddb, com tempos de análise (dry-run) e de gravação. Script: `scripts/verify-import-performance.mjs`
(`node scripts/verify-import-performance.mjs [animais] [eventosPorAnimal]`, padrão 12.000 × 3).

## 1. Massa e etapas

- Arquivo `Brinco;Marca;Sexo;Raça;Data;Peso`, 4 marcas, número repetido entre marcas (desambiguação por marca),
  3 eventos por animal com 45 dias de intervalo, **linhas embaralhadas por evento** (o 3º evento de todos os animais
  vem antes do 1º), categorias por faixa de peso e tipo `HISTORICO` com categoria `AUTOMATICA`.
- Etapas medidas, na ordem: `readImportFile` → `analyzeImport` em base vazia (100% NOVO) → `applyImport` em lotes de
  200 animais → reanálise do mesmo arquivo (100% JÁ EXISTE) → `applyImport` do plano reimportado (zero gravações) →
  análise e gravação de **um Manejo retroativo para 10% dos animais** (tipo `MANEJOS`, data entre o 1º e o 2º evento,
  o que obriga a recalcular o evento seguinte de cada série).
- Asserções do script (não só tempo): contagem de eventos e animais gravados, número de lotes, reimportação sem
  gravação, e `seriesRecalculadas` igual ao número de animais do arquivo retroativo (nunca a base inteira).

## 2. Resultados

Tempos em milissegundos; heap = `process.memoryUsage().heapUsed` ao fim da etapa. As execuções de 9 mil e 18 mil
linhas rodaram em sequência, em paralelo com a de 36 mil (máquina de 12 núcleos, um processo Node por medição).

| Etapa | 3.000 × 3 = 9.000 linhas | 6.000 × 3 = 18.000 linhas | 12.000 × 3 = 36.000 linhas |
|---|---:|---:|---:|
| `readImportFile` (parse + SHA-256 síncrono) | 23 | 47 | 80 |
| `analyzeImport`, base vazia | 209 | 425 | 730 |
| `applyImport`, lotes de 200 animais | 38.557 (15 lotes) | 155.731 (30 lotes) | 776.252 (60 lotes) |
| `analyzeImport`, reimportação (100% JÁ EXISTE) | 297 | 1.800 | 1.473 |
| `applyImport` do plano reimportado (sem gravar) | 295 | 1.396 | 1.461 |
| `analyzeImport`, Manejos retroativos (10%) | 144 | 668 | 727 |
| `applyImport`, Manejos retroativos (10%) | 26.398 (300 séries) | 131.118 (600 séries) | 629.827 (1.200 séries) |
| Heap máximo observado | 235 MB | 431 MB | 744 MB |

Referência menor (1.000 × 3, execução isolada): análise 104–129 ms; gravação 5,3–5,9 s; retroativos (100 séries) 2,8 s.

As três medições maiores rodaram antes de duas mudanças finais do mesmo dia: a guarda contra gravação concorrente
(uma leitura por índice a mais por animal, ~0,1 ms) e a troca de listas por `Set` nas linhas ignoradas e nos
cadastros ausentes (só afeta a análise). Nenhuma das duas acrescenta atualização de registro existente.

## 3. Leitura

1. **Análise (dry-run) é linear e rápida**: 730 ms para 36 mil linhas em base vazia e ~1,5 s na reimportação sobre
   36 mil pesagens gravadas (lê `animais`/identificadores/cadastros uma vez e a série só dos animais candidatos —
   acima de 64 animais, uma leitura de `pesagens` filtrada por `Set`, nunca `anyOf` com milhares de chaves).
   A reimportação não grava nada: nem job, nem auditoria, nem sessão.
2. **A gravação cresce de forma quadrática no fake-indexeddb, e o motivo é do próprio fake-indexeddb.** Toda
   atualização de um registro existente (`table.update`/`put`) chama `RecordStore.deleteByValue` em cada índice da
   store, que percorre **todos** os registros do índice (`node_modules/fake-indexeddb/build/esm/lib/RecordStore.js:30-40`,
   chamado em `lib/ObjectStore.js:172`). Micro-medição na store `animais` (14 índices), 200 operações por tamanho:

   | Registros na store | `update` por registro | leitura por `id` | inserção por registro |
   |---:|---:|---:|---:|
   | 1.000 | 7,0 ms | 0,06 ms | 0,15 ms |
   | 3.000 | 43,1 ms | 0,06 ms | 0,12 ms |
   | 6.000 | 67,7 ms | 0,03 ms | 0,07 ms |
   | 12.000 | 152,8 ms | 0,10 ms | 0,22 ms |

   Perfil de CPU (`node --cpu-prof`, 2.000 animais): `binarySearchTree._findRecords` 14,0 s de tempo próprio,
   `RecordStore.deleteByValue` 1,4 s e o gerador `getAllRecords/getRecords` ~3,4 s — mais de 70% da gravação.
   Leitura por índice e inserção ficam constantes. No IndexedDB do Chromium (Electron) atualização por chave é
   logarítmica; o custo quadrático acima **não** se transfere ao aplicativo.
3. **Quantas atualizações a gravação faz** (é isso que o fake-indexeddb cobra): uma por animal afetado
   (`rebuildAnimalStateProjection`, helper canônico do Lançamento), uma por evento gravado cuja série muda
   (derivados recalculados só quando mudam — no retroativo, 1 por animal) e uma por lote no job (`importacoes`,
   checkpoint na mesma transação). Eventos, animais novos, identificadores, sessões, movimentos e auditoria são
   inserções (`bulkAdd`). Nenhuma etapa recalcula a base inteira.
4. **Lotes**: cada lote de 200 animais é uma transação com as 9 stores; o checkpoint avança na mesma transação.
   Uma falha desfaz só o lote corrente e a retomada continua do checkpoint (`import:idempotency:verify`).

## 4. Para reproduzir

```
node scripts/verify-import-performance.mjs 12000 3   # medição desta evidência (~24 min no fake-indexeddb)
node scripts/verify-import-performance.mjs 3000 3     # versão proposta para a suíte full (~65 s)
```

## 5. Achado durante a medição (corrigido)

Com lotes de 150+ animais cujos eventos não liam `categoriasAnimal` (categoria manual ou evento sem peso), a
transação do lote fechava antes da hora (`PrematureCommitError`): aguardar uma função `async` que termina sem tocar
o IndexedDB, repetidas vezes dentro da transação, esgota o rastreio de zona do Dexie. A gravação agora só aguarda
`stampAutomaticCategory` quando ele realmente lê o banco (`importWriter.js`, `needsCategoryRead`); sem peso, aplica o
mesmo efeito do helper (herdar a categoria atual). Regressão coberta em `import:idempotency:verify` (lote de 250
animais manuais numa transação), comprovada falhando com a versão anterior.
