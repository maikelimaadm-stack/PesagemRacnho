# F0 — Contratos e baseline: status

**Data:** 08/09/2026  
**Aplicação:** 1.1.17 (esquema Dexie v6)  
**Referência:** [07-ROADMAP-E-CRITERIOS-DE-ACEITE.md](./07-ROADMAP-E-CRITERIOS-DE-ACEITE.md) §3

## 1. Entregas

| Entrega (07 §3) | Situação | Evidência |
|---|---|---|
| Aprovar este pacote documental | Em uso como fonte de verdade desde 08/09/2026 | `README.md` da raiz aponta para o pacote |
| Mapear campos atuais para o modelo-alvo | Concluída | [F0-01-MAPA-DE-CAMPOS.md](./F0-01-MAPA-DE-CAMPOS.md) |
| Catalogar fórmulas existentes | Concluída, com 7 divergências registradas (D1–D7) | [F0-02-CATALOGO-DE-FORMULAS.md](./F0-02-CATALOGO-DE-FORMULAS.md) |
| Massa de teste anônima: vazia, pequena, 36 mil e 250 mil | Concluída; determinística por semente, regenerável a qualquer momento | `src/modules/perf/testMass.js`, `npm run perf:testmass -- --mass=36k` |
| Medir p50/p95/p99 de busca, troca de campo e salvamento | Concluída em Node e no navegador (Chromium/IndexedDB real) | [../evidence/f0-baseline/BASELINE.md](../evidence/f0-baseline/BASELINE.md) |
| Capturas visuais das telas atuais | Concluída: 3 telas × claro/escuro, massa pequena, userData isolado | `docs/evidence/f0-baseline/screens/` |
| Definir marcas/modelos de equipamentos prioritários | **Pendente — decisão do responsável** (P-001, P-002) | [08-DECISOES-ARQUITETURAIS.md](./08-DECISOES-ARQUITETURAIS.md) |

## 2. O que o baseline mostrou

Números completos em `docs/evidence/f0-baseline/BASELINE.md`. Resumo (p95 em
milissegundos; "navegador" = Chromium com IndexedDB real, "Node" =
fake-indexeddb em memória):

| Massa | Runtime | Carga inicial | Índice de animais | Identificação → peso | Busca por animal | Salvamento local | Recarga após salvar |
|---|---|---|---|---|---|---|---|
| Pequena (300) | navegador | 37 | 152 | 0,3 | 7 | **138** | 226 |
| Pequena (300) | Node | 3 | 5 | 0,4 | 1,5 | 16 | 5 |
| 36 mil | navegador | 2 835 | 7 423 | 20 | 13 | **3 169** | 3 249 |
| 36 mil | Node | 354 | 4 622 | 8 | 1,8 | 4 980 | 1 693 |
| 250 mil | Node | 12 140 | 25 908 | 40 | 4,6 | 64 502 | 14 677 |

Orçamento: busca indexada e identificação → peso p95 < 100 ms (**dentro** em
todas as massas); salvamento local p95 < 250 ms (**dentro** só na massa
pequena; **fora** a partir de 36 mil). Leitura:

- **Busca indexada por animal** (Dexie, índice `animal_id`) fica dentro do
  orçamento (p95 < 100 ms) em todas as massas, inclusive 250 mil.
- **Identificação → peso** (índice em memória por número + histórico do animal
  + ganho/GMD) fica dentro do orçamento por operação. O custo escondido está na
  **reconstrução do índice** (`getRegisteredAnimals` + `buildAnimalLookupIndex`),
  que acontece a cada recarga da tela e cresce com a base: 2,0 s na massa de
  36 mil em Node, dos quais 1,7 s são a ordenação final com `localeCompare`
  `pt-BR` numérico (divergência D8). O gate existente não enxerga isso porque
  sua massa já nasce ordenada.
- **Salvamento local sai do orçamento a partir de 36 mil registros.** Causa
  localizada: `createEntry` chama `recalculateWeightSeriesForKeys`, que executa
  `listEntries()` sobre a base inteira (leitura + mapeamento de todos os
  registros) para recalcular a série de um único animal. Além disso a tela faz
  `loadAllData()` (nova leitura completa) depois de cada gravação.
- **Busca por período de 30 dias** usa índice, mas devolve milhares de linhas
  em bases grandes; a paginação da Relação já limita a renderização, não a
  consulta.
- No navegador real (IndexedDB em disco), a massa **pequena** já apresenta
  salvamento com p95 próximo de 230 ms; isso confirma que o orçamento de 250 ms
  precisa ser medido no runtime real, não só em memória.

Esses resultados fixam a prioridade da F1: PERF-002 (índice/cache de animais
ativos) e a correção do recálculo por animal (D3) sem varrer a base.

## 3. Aceite da F0 (07 §3)

| Critério | Resultado |
|---|---|
| Nenhuma ambiguidade de identidade, fórmula ou escopo P0 | Identidade e escopo fechados em F0-01 §10; fórmulas com divergências D1–D7 listadas e atribuídas a fases (D2 exige ADR antes da F3) |
| Baseline reproduzível em desenvolvimento e pacote instalado | Reproduzível em Node (`npm run perf:baseline`) e no navegador/Electron dev (`runBaseline` via `import('/src/modules/perf/baselineBench.js')`). **No pacote instalado ainda não foi executado**: exige o teste físico em máquina limpa do responsável (ver docs/user/TESTE-MAQUINA-LIMPA.md) |
| Decisão explícita sobre hardware inicial | **Pendente** (P-001 balança, P-002 leitor RFID) |

## 4. Como reproduzir

```powershell
npm run perf:contract:verify          # contrato do gerador e do bench (rápido)
npm run perf:baseline                 # vazia, pequena e 36 mil em Node
npm run perf:baseline:full            # inclui 250 mil (demorado; heap de 8 GB)
npm run evidence:screens              # capturas claro/escuro com massa pequena
```

No aplicativo em desenvolvimento (`npm run desktop:dev` ou navegador em
`http://localhost:5173`), no console:

```js
const m = await import('/src/modules/perf/baselineBench.js');
const r = await m.runBaseline({ massKey: '36k' });
console.log(m.formatReportTable(r));
await m.clearMass(); // apaga o banco de teste
```

Atenção: `runBaseline` e `seedMass` **apagam o banco IndexedDB da origem em
que rodam**. Nunca executar no aplicativo instalado com dados reais sem backup
validado.

## 5. Pendências herdadas encontradas durante a F0

- `npm run docs:user:verify` falha porque `package.json` está em 1.1.17 e não
  existe `docs/release/1.1.17/`. A F0 não cria notas de release; a pasta deve
  ser criada quando a versão for de fato preparada para distribuição.
- A store `lotes` existe no esquema mas a interface usa `loteApartacoes`
  (F0-01 §6). Decidir reaproveitamento ou remoção por ADR antes da F2.
- `npm run main:boot:verify` falhava porque o stub do Electron em Node não
  definia `process.resourcesPath` (usado pelo caminho do ícone empacotado em
  `electron/main.cjs`). Corrigido no próprio stub; `test:quick` integral
  (19 gates) aprovado em 08/09/2026.

## 6. Próximo passo

Iniciar a **F1 — Desempenho e confiabilidade** com PERF-002 e a correção do
recálculo por animal, usando este baseline como comparação obrigatória
(ADR-017). Em paralelo, o responsável decide P-001/P-002 para destravar a F5.
