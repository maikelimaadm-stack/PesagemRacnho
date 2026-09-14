# Baseline de desempenho — F0

Gerado em 2026-09-08T20:19:40.762Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.

| runtime | massa | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| browser | 36 mil | carga_inicial_listEntries | 3 | 2654.9 | 2835 | 2835 | 2835 |
| browser | 36 mil | indice_animais_rebuild | 3 | 6460.1 | 7422.8 | 7422.8 | 7422.8 |
| browser | 36 mil | identificacao_para_peso | 200 | 5.9 | 19.8 | 41.4 | 54.1 |
| browser | 36 mil | busca_indexada_animal | 200 | 2.2 | 12.6 | 15.1 | 18.6 |
| browser | 36 mil | busca_indexada_periodo_30d | 20 | 233.3 | 596.5 | 660.4 | 660.4 |
| browser | 36 mil | salvamento_local | 20 | 2561.4 | 3168.6 | 3498.3 | 3498.3 |
| browser | 36 mil | recarga_apos_salvar | 3 | 2953.2 | 3248.5 | 3248.5 | 3248.5 |
| browser | Pequena | carga_inicial_listEntries | 3 | 24.1 | 36.8 | 36.8 | 36.8 |
| browser | Pequena | indice_animais_rebuild | 3 | 59.7 | 152.2 | 152.2 | 152.2 |
| browser | Pequena | identificacao_para_peso | 200 | 0 | 0.3 | 0.4 | 0.9 |
| browser | Pequena | busca_indexada_animal | 200 | 2.2 | 7.3 | 18.9 | 138.5 |
| browser | Pequena | busca_indexada_periodo_30d | 20 | 4.1 | 8 | 11.6 | 11.6 |
| browser | Pequena | salvamento_local | 30 | 85.4 | 137.9 | 185.8 | 185.8 |
| browser | Pequena | recarga_apos_salvar | 3 | 34.1 | 225.8 | 225.8 | 225.8 |
| node | 250 mil | carga_inicial_listEntries | 1 | 12139.526 | 12139.526 | 12139.526 | 12139.526 |
| node | 250 mil | indice_animais_rebuild | 1 | 25907.6 | 25907.6 | 25907.6 | 25907.6 |
| node | 250 mil | identificacao_para_peso | 200 | 34.594 | 39.883 | 43.674 | 57.352 |
| node | 250 mil | busca_indexada_animal | 200 | 2.228 | 4.644 | 7.718 | 256.893 |
| node | 250 mil | busca_indexada_periodo_30d | 20 | 835.369 | 2291.508 | 2398.416 | 2398.416 |
| node | 250 mil | salvamento_local | 10 | 56384.257 | 64501.867 | 64501.867 | 64501.867 |
| node | 250 mil | recarga_apos_salvar | 1 | 14677.245 | 14677.245 | 14677.245 | 14677.245 |
| node | 36 mil | carga_inicial_listEntries | 3 | 348.379 | 354.091 | 354.091 | 354.091 |
| node | 36 mil | indice_animais_rebuild | 3 | 2363.529 | 4622.294 | 4622.294 | 4622.294 |
| node | 36 mil | identificacao_para_peso | 200 | 2.341 | 3.932 | 5.87 | 7.147 |
| node | 36 mil | busca_indexada_animal | 200 | 0.244 | 1.001 | 1.763 | 20.37 |
| node | 36 mil | busca_indexada_periodo_30d | 20 | 29.402 | 65.54 | 107.216 | 107.216 |
| node | 36 mil | salvamento_local | 30 | 3068.894 | 4979.964 | 5212.519 | 5212.519 |
| node | 36 mil | recarga_apos_salvar | 3 | 1339.313 | 1370.691 | 1370.691 | 1370.691 |
| node | Pequena | carga_inicial_listEntries | 3 | 2.348 | 2.824 | 2.824 | 2.824 |
| node | Pequena | indice_animais_rebuild | 3 | 3.705 | 5.138 | 5.138 | 5.138 |
| node | Pequena | identificacao_para_peso | 200 | 0.007 | 0.02 | 0.053 | 0.243 |
| node | Pequena | busca_indexada_animal | 200 | 0.052 | 0.094 | 0.502 | 1.157 |
| node | Pequena | busca_indexada_periodo_30d | 20 | 0.175 | 0.348 | 0.472 | 0.472 |
| node | Pequena | salvamento_local | 30 | 10.894 | 16.299 | 17.227 | 17.227 |
| node | Pequena | recarga_apos_salvar | 3 | 2.393 | 2.486 | 2.486 | 2.486 |
| node | Vazia | carga_inicial_listEntries | 3 | 0.18 | 1.487 | 1.487 | 1.487 |
| node | Vazia | indice_animais_rebuild | 3 | 0.006 | 0.216 | 0.216 | 0.216 |
| node | Vazia | salvamento_local_primeiro_registro | 1 | 22.753 | 22.753 | 22.753 | 22.753 |

Arquivos de origem: `baseline-browser-36k.json`, `baseline-browser-pequena.json`, `baseline-node-250k.json`, `baseline-node-36k.json`, `baseline-node-pequena.json`, `baseline-node-vazia.json`
