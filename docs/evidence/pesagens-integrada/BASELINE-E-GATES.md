# Baseline e gates — missão pesagens-integrada

Missão: `PESAGENS-52-ITENS-CORRECOES-IMPLANTACOES-2026-10-29` (prompt em `PROMPT-MISSAO.md`).

## Ponto de partida

| Item | Valor |
|---|---|
| Base | `origin/main` = `9392274972d41efb29007122c7a9ed826be9b283` (merge do PR #3, app 1.5.6) |
| Branch da missão | `claude/pesagens-estabilizacao-e-gestao-integrada-01` |
| Banco local | IndexedDB/Dexie **v8** (`DB_VERSION = 8`), backup formato 3 |
| Runtime | Node v22.22.0, npm 10.9.4, Electron 44.9.3 (Linux CI/xvfb) |
| `package-lock.json` | SHA-256 (prefixo) `4d132815c8ab6321` |
| PR #1 (Supabase) | ignorada por instrução; não tocada |
| `CLAUDE.md` na raiz | não existe |

## Gates no início (29/10/2026, 22:17 UTC) — todos verdes

| Comando | Resultado | Tempo |
|---|---|---|
| `npm ci` | OK | 18 s |
| `npm run build` | OK | 13 s |
| `npm run test:unit` | OK (36 testes) | 5 s |
| `xvfb-run -a npm run test:quick` | OK | 103 s |
| `xvfb-run -a npm run e2e:electron:verify` | OK | 32 s |
| `npm run storage:all:verify` | OK | 30 s |
| `npm run weighing:repesagem:verify` | OK | 1 s |
| `npm run weighing:interval-rule:verify` | OK | < 1 s |
| `npm run weighing:regression:verify` | OK | 1 s |
| `npm run animal:history-integrity:verify` | OK | 1 s |
| `npm run sanity:launch-integration:verify` | OK | < 1 s |
| `npm run import:idempotency:verify` | OK | 1 s |
| `npm run reports:weighted-gmd:verify` | OK | 1 s |
| `npm run reports:xlsx-parity:verify` | OK | < 1 s |
| `npm run docs:user:verify` | OK | < 1 s |
| `npm run storage:backup:verify` | OK | 1 s |
| `npm run storage:import-restore:verify` | OK | < 1 s |
| `npm run equipment:contract:verify` | OK | 1 s |

Os testes antigos (gates `verify-*.mjs`) provam o comportamento **anterior** à missão; não servem de prova das funcionalidades novas. Cada item da matriz aponta o teste próprio.

## Desempenho no início (Node + fake-indexeddb, em memória)

`node scripts/measure-perf-baseline.mjs --mass=pequena,36k --samples=20 --saves=5` — valores em ms.

| massa | métrica | p50 | p95 |
|---|---|---|---|
| 36 mil | carga_inicial_listEntries | 546 | 562 |
| 36 mil | indice_animais_rebuild | 1484 | 2386 |
| 36 mil | abertura_lancamento_simulada | 1873 | **2052** (orçamento 1000 — **fora já antes da missão**) |
| 36 mil | identificacao_para_peso | 1.1 | 3.2 |
| 36 mil | busca_indexada_animal | 0.16 | 0.49 |
| 36 mil | busca_indexada_periodo_30d | 49 | 69 |
| 36 mil | salvamento_local | 154 | 164 |
| 36 mil | recarga_apos_salvar | 577 | 599 |
| pequena | salvamento_local | 6.4 | 13.8 |
| pequena | abertura_lancamento_simulada | 9.7 | 12.5 |

Problema **preexistente**: `abertura_lancamento_simulada` com 36 mil pesagens já estoura o orçamento de 1 s (p95 ≈ 2 s). Registrado; a missão não pode piorar e mede de novo no fechamento.

## Gates durante a missão

Cada checkpoint roda o gate do que mudou e, antes de cada push: `npm run lint`, `npm run test:unit`, `xvfb-run -a npm run test:quick`, `xvfb-run -a npm run e2e:electron:verify`. Resultados por checkpoint ficam em `MATRIZ-52-ITENS.md` e no fim deste arquivo.

## Auditoria corretiva R2 (30/10/2026) — gates no HEAD da R2

| Comando | Resultado | Tempo |
|---|---|---|
| `npm ci` | OK | 19s |
| `npm run lint` | OK | 11s |
| `npm run test:unit` | OK | 11s |
| `npm run build` | OK | 13s |
| `xvfb-run -a npm run e2e:electron:verify` | OK | 37s |
| `npm run storage:all:verify` | OK | 24s |
| `npm run migration:v9:verify` | OK | 1s |
| `npm run backup:recovery:verify` | OK | 0s |
| `npm run documents:backup:verify` | OK | 1s |
| `npm run backup:center:verify` | FALHOU 1 vez (teste defeituoso, ver abaixo) → corrigido; OK 52/52 seguidas | 1s |
| `npm run safety:backup:verify` | OK | 1s |
| `npm run restore:preflight:verify` | OK | 1s |
| `npm run backup:availability:verify` | OK | 0s |
| `npm run livestock:operations:verify` | OK | 1s |
| `npm run sanity:posology:verify` | OK | 0s |
| `npm run weighing:integrity:verify` | OK | 1s |
| `npm run cross:surface:verify` | OK | 1s |
| `npm run backup:partial:verify` | OK | 0s |
| `npm run restore:compensation:verify` | OK | 1s |
| `npm run import:contract:verify` | OK | 5s |
| `xvfb-run -a npm run test:quick` | OK | 110s |
| `xvfb-run -a npm run test:full` | OK | 152s |

- **`backup:center:verify`.** A única falha foi do teste, não do app. O detalhe está em
  `AUDITORIA-CORRETIVA-R2.md` §Gates. Depois da correção: 52 de 52.
- **`test:full`** agora termina. O benchmark de 36.000 linhas foi trocado por `import:contract:verify` (600 × 3).
- **Medições de capacidade (36.000 linhas):**

  | Motor | Comando | Tempo |
  |---|---|---|
  | IndexedDB real (Electron) | `perf:import:electron` | 85 s |
  | fake-indexeddb | `perf:import:node` | 16 min 21 s |

