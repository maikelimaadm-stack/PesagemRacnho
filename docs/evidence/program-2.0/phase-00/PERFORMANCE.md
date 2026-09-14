# Fase 0 — Medições

**14/09/2026 · commit `986c502` (runtime da F1 + esquema v7 estrutural) · `saves=10`, `samples=200` · seed 20260908**

## 1. Tamanho do `legacy_payload` e da auditoria (massa 36 mil, Node)

| Medida | Valor |
|---|---|
| Linhas em `pesagens` | 36 000 |
| Bytes por linha (JSON) — média / p95 | 1 136 / 1 140 |
| Bytes do `legacy_payload` — média / p95 | 723 / 728 |
| Participação do payload na linha | **63,7 %** |
| Chaves no payload | 28 (constante) |
| Uma edição via `weighingService.updateEntry` | payload passa de 28 para **29 chaves** (`peso_kg` copiado do view model), 725 → 753 B |
| Auditoria gerada por uma edição | 1 linha de **2 550 B** (antes/depois completos = 2,2× a linha) |

Fonte: `payload-size-36k.json` (`scripts/measure-payload-size.mjs`). Confirma ADR-027 (congelar + lista permitida) e a mudança da auditoria para resumo de campos (documento 12 §3.2).

## 2. Desempenho em Node (fake-indexeddb) — p95 em ms

| Métrica | Pequena (300) | 36 mil | 250 mil | Orçamento |
|---|---:|---:|---:|---:|
| Carga inicial (`listEntries`) | 5,2 | 1 029 | 6 446 | — |
| Reconstrução do índice de animais (tela) | 6,6 | 4 141 | 15 528 | — |
| Identificação → peso | 0,02 | 4,6 | 28,1 | < 100 |
| Busca indexada por animal | 0,19 | 0,50 | 3,5 | < 100 |
| Busca por período (30 d) | 0,39 | 143 | 1 122 | — |
| **Salvamento local** | 10,6 | **198** | **1 411** | < 250 |
| Recarga após salvar | 3,4 | 1 000 | 5 866 | — |

Tempo total: 36 mil = 37 s; 250 mil = 195 s (heap 8 GB). Arquivos: `perf/baseline-node-*.json`, `perf/BASELINE.md`.

## 3. Desempenho no Chromium (IndexedDB real) — 36 mil

| Métrica | p50 | p95 | Orçamento | Veredito |
|---|---:|---:|---:|---|
| Carga inicial (`listEntries`) | 519 | 560 | — | — |
| Reconstrução do índice de animais | 860 | 883 | — | pendência da F1 (ler por identificadores na Fase 2) |
| Identificação → peso | 1,1 | 1,8 | < 100 | dentro |
| Busca indexada por animal | 0,3 | 0,6 | < 100 | dentro |
| Busca por período (30 d) | 38 | 72 | — | — |
| **Salvamento local** | 4,5 | **19,1** | < 250 | dentro (F0: 3 169) |
| Recarga após salvar | 495 | 538 | — | — |

Semeadura de 36 mil no IndexedDB real: 5,4 s. Arquivo: `perf/baseline-browser-36k.json`. Ambiente: Chromium do Claude Desktop sobre o servidor Vite (`npm run dev`), sem Electron.

## 4. Comparação com F0/F1

| Salvamento p95 | F0 | F1 (Node) | Fase 0 do 2.0 (Node) | Fase 0 do 2.0 (Chromium) |
|---|---:|---:|---:|---:|
| 36 mil | 4 980 (Node) / 3 169 (navegador) | 76 | 198 | 19 |

A diferença Node 76 → 198 ms decorre de `saves=10` com amostras mais dispersas e da carga do sistema durante a medição (outra bateria de gates rodou em paralelo no início); o valor do Chromium é o de referência para o orçamento do produto.

## 5. Orçamentos adotados para as próximas fases (programa §84)

36 mil: identificação < 100 ms; salvar p95 < 250 ms; abrir Lançamento < 1 s; abrir Fechamento < 500 ms. 250 mil: medir a cada fase; sem travamento; sem carregar catálogo inteiro.
