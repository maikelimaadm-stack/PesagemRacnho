# Baseline de desempenho — F0

Gerado em 2026-09-08T20:42:34.708Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.

| runtime | massa | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| node | 36 mil | carga_inicial_listEntries | 3 | 397.953 | 488.791 | 488.791 | 488.791 |
| node | 36 mil | indice_animais_rebuild | 3 | 1710.768 | 1739.131 | 1739.131 | 1739.131 |
| node | 36 mil | identificacao_para_peso | 50 | 0.879 | 3.471 | 4.058 | 4.058 |
| node | 36 mil | busca_indexada_animal | 50 | 0.102 | 0.275 | 99.448 | 99.448 |
| node | 36 mil | busca_indexada_periodo_30d | 20 | 34.119 | 84.397 | 84.943 | 84.943 |
| node | 36 mil | salvamento_local | 5 | 1794.079 | 1930.83 | 1930.83 | 1930.83 |
| node | 36 mil | recarga_apos_salvar | 3 | 337.971 | 339.523 | 339.523 | 339.523 |

Arquivos de origem: `baseline-node-36k.json`
