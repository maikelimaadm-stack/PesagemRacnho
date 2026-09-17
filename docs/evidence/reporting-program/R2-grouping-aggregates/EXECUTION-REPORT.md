# R2 — Agrupamento, agregação, Rebanho e Desempenho (16/09/2026)

Commits `c8c2f1d..9a830b6` em `program/reporting-1.3.0`. Sem schema, sem cache, sem dependência.

## Entregue

| Peça | Detalhe |
|---|---|
| `groupEngine` | até 3 níveis; chave = id canônico (texto normalizado sem id); rótulo = nome atual; “Não informado” por último; árvore estrutural `{ id, level, key, label, path, rows, rowCount, aggregates, children }`; `flattenTree` → GROUP/DATA/SUBTOTAL |
| `reportAggregates` | especificação `{ id, columnId, op }` validada contra `column.aggregations`; datas min/max como data; `weightedAvg`, `weightedGmd`, `ratio` só onde declarados |
| Subtotal / total | cada nó recalcula sobre a própria população; total geral sobre o dataset final filtrado |
| Grão `ANIMAL_CURRENT` | fonte `animals.current`: projeção `animais` + cadastros; `dias_sem_pesagem`, faixa de peso |
| Grão `ANIMAL_PERIOD` | fonte `animals.period`: eventos do período (índice) → 1 linha por animal: pesagens, peso inicial/final (primeira/última COM peso), dias, ganho, GMD (só com par válido) |
| Faixas de peso | das categorias com faixa configurada (sexo respeitado) ou do modelo; sem faixa → aviso `NO_WEIGHT_BANDS` e “Não informado” — nenhuma faixa inventada |
| Filtros padrão / fixos | `defaultFilters` (ex.: só ativos, removível) e `lockedFilters(params)` (ex.: ganho < 0; dias sem pesagem > N) |

## Relatórios

| Id | Grão | Agrupamento padrão |
|---|---|---|
| `rebanho.inventario` | ANIMAL_CURRENT | — |
| `rebanho.dimensao.{marca,raca,categoria,sexo,situacao,lote,apartacao,faixa_peso}` | ANIMAL_CURRENT | a dimensão |
| `rebanho.sem-pesagem-recente` | ANIMAL_CURRENT | — (parâmetro `dias_sem_pesagem`, padrão 30) |
| `desempenho.individual` | ANIMAL_PERIOD | — |
| `desempenho.lote` | ANIMAL_PERIOD | Apartação → Lote |
| `desempenho.dimensao.{marca,raca,categoria,sexo,lote,apartacao}` | ANIMAL_PERIOD | a dimensão |
| `desempenho.perdendo-peso` | ANIMAL_PERIOD | — (ganho < 0 fixo) |
| `desempenho.faixa-peso` | ANIMAL_PERIOD | faixa do peso final |

## Critério de conclusão R2

| Critério | Prova |
|---|---|
| agrupamento até 3 níveis | `reports:grouping:verify` |
| subtotal correto | `reports:subtotals:verify` — 23 nós × 6 agregações contra referência ingênua independente, 240 linhas com ausentes |
| total geral correto | `reports:grand-total:verify` — média dos subtotais ≠ total (negativo) |
| countDistinct correto | `reports:unique-animals:verify` — A(3)+B(2) = 5 eventos / 2 animais; pai 2 ≠ soma dos filhos 3 |
| GMD ponderado correto | `reports:weighted-gmd:verify` — 10/10 + 40/20: simples 1,5 × ponderado 1,667; massa: (45+30)/(40+31) |
| null semantics | `reports:null-semantics:verify` — 100/null/200: média 150, soma 300, n_validos 2, n_ausentes 1 |
| Rebanho/Desempenho funcionando | todos os relatórios executam em `reports:definitions:verify` |

`npm run test:quick` → EXIT 0.
