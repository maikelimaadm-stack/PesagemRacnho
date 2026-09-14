# Baseline de desempenho — F0

Gerado em 2026-09-14T22:09:01.043Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.

| runtime | massa | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| node | 250 mil | carga_inicial_listEntries | 1 | 6445.687 | 6445.687 | 6445.687 | 6445.687 |
| node | 250 mil | indice_animais_rebuild | 1 | 15527.861 | 15527.861 | 15527.861 | 15527.861 |
| node | 250 mil | identificacao_para_peso | 200 | 18.793 | 28.132 | 101.849 | 190.642 |
| node | 250 mil | busca_indexada_animal | 200 | 1.798 | 3.548 | 6.211 | 186.252 |
| node | 250 mil | busca_indexada_periodo_30d | 20 | 590.612 | 1122.156 | 1659.338 | 1659.338 |
| node | 250 mil | salvamento_local | 10 | 557.65 | 1410.98 | 1410.98 | 1410.98 |
| node | 250 mil | recarga_apos_salvar | 1 | 5866.387 | 5866.387 | 5866.387 | 5866.387 |
| node | 36 mil | carga_inicial_listEntries | 3 | 960.955 | 1028.545 | 1028.545 | 1028.545 |
| node | 36 mil | indice_animais_rebuild | 3 | 3856.382 | 4141.025 | 4141.025 | 4141.025 |
| node | 36 mil | identificacao_para_peso | 200 | 3.886 | 4.568 | 4.9 | 6.857 |
| node | 36 mil | busca_indexada_animal | 200 | 0.267 | 0.495 | 0.854 | 56.699 |
| node | 36 mil | busca_indexada_periodo_30d | 20 | 89.266 | 142.846 | 173.907 | 173.907 |
| node | 36 mil | salvamento_local | 10 | 98.941 | 198.394 | 198.394 | 198.394 |
| node | 36 mil | recarga_apos_salvar | 3 | 955.308 | 999.695 | 999.695 | 999.695 |
| node | Pequena | carga_inicial_listEntries | 3 | 3.448 | 5.237 | 5.237 | 5.237 |
| node | Pequena | indice_animais_rebuild | 3 | 5.848 | 6.601 | 6.601 | 6.601 |
| node | Pequena | identificacao_para_peso | 200 | 0.008 | 0.02 | 0.055 | 0.362 |
| node | Pequena | busca_indexada_animal | 200 | 0.07 | 0.192 | 0.84 | 1.439 |
| node | Pequena | busca_indexada_periodo_30d | 20 | 0.207 | 0.392 | 0.524 | 0.524 |
| node | Pequena | salvamento_local | 10 | 2.113 | 10.607 | 10.607 | 10.607 |
| node | Pequena | recarga_apos_salvar | 3 | 2.724 | 3.399 | 3.399 | 3.399 |

Arquivos de origem: `baseline-node-250k.json`, `baseline-node-36k.json`, `baseline-node-pequena.json`
