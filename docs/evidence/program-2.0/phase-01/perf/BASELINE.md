# Baseline de desempenho

Gerado em 2026-09-14T22:41:08.671Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4, TARGET-PERFORMANCE-RISKS §4): busca_indexada_animal p95 < 100 ms; identificacao_para_peso p95 < 100 ms; salvamento_local p95 < 250 ms; abertura_lancamento_simulada p95 < 1000 ms.

| runtime | massa | esquema | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|
| node | 36 mil | v7 | carga_inicial_listEntries | 3 | 479.138 | 551.158 | 551.158 | 551.158 |
| node | 36 mil | v7 | indice_animais_rebuild | 3 | 2152.989 | 2260.515 | 2260.515 | 2260.515 |
| node | 36 mil | v7 | abertura_lancamento_simulada | 3 | 2606.68 | 2865.902 | 2865.902 | 2865.902 |
| node | 36 mil | v7 | identificacao_para_peso | 200 | 1.448 | 2.743 | 3.281 | 6.803 |
| node | 36 mil | v7 | busca_indexada_animal | 200 | 0.163 | 0.506 | 1.366 | 51.414 |
| node | 36 mil | v7 | busca_indexada_periodo_30d | 20 | 62.581 | 91.233 | 97.318 | 97.318 |
| node | 36 mil | v7 | salvamento_local | 10 | 211.001 | 264.151 | 264.151 | 264.151 |
| node | 36 mil | v7 | recarga_apos_salvar | 3 | 491.154 | 502.489 | 502.489 | 502.489 |
| node | Pequena | v7 | carga_inicial_listEntries | 3 | 4.817 | 8.566 | 8.566 | 8.566 |
| node | Pequena | v7 | indice_animais_rebuild | 3 | 9.334 | 11.291 | 11.291 | 11.291 |
| node | Pequena | v7 | abertura_lancamento_simulada | 3 | 14.059 | 15.015 | 15.015 | 15.015 |
| node | Pequena | v7 | identificacao_para_peso | 200 | 0.016 | 0.054 | 0.294 | 0.949 |
| node | Pequena | v7 | busca_indexada_animal | 200 | 0.147 | 0.405 | 1.308 | 3.774 |
| node | Pequena | v7 | busca_indexada_periodo_30d | 20 | 0.734 | 3.923 | 5.674 | 5.674 |
| node | Pequena | v7 | salvamento_local | 30 | 3.486 | 6.57 | 25.64 | 25.64 |
| node | Pequena | v7 | recarga_apos_salvar | 3 | 5.174 | 5.25 | 5.25 | 5.25 |

Arquivos de origem: `baseline-node-36k.json`, `baseline-node-pequena.json`
