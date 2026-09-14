# Baseline de desempenho — F0

Gerado em 2026-09-08T20:40:18.672Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.

| runtime | massa | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| node | 36 mil | carga_inicial_listEntries | 3 | 412.948 | 424.314 | 424.314 | 424.314 |
| node | 36 mil | indice_animais_rebuild | 3 | 1705.644 | 2110.368 | 2110.368 | 2110.368 |
| node | 36 mil | identificacao_para_peso | 200 | 1.591 | 3.768 | 5.11 | 10.696 |
| node | 36 mil | busca_indexada_animal | 200 | 0.106 | 0.338 | 0.853 | 150.437 |
| node | 36 mil | busca_indexada_periodo_30d | 20 | 44.399 | 84.565 | 88.44 | 88.44 |
| node | 36 mil | salvamento_local | 10 | 1960.98 | 2200.302 | 2200.302 | 2200.302 |
| node | 36 mil | recarga_apos_salvar | 3 | 429.285 | 435.719 | 435.719 | 435.719 |

Arquivos de origem: `baseline-node-36k.json`
