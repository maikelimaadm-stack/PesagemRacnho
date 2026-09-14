# Baseline de desempenho — F0

Gerado em 2026-09-08T20:46:39.955Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.

| runtime | massa | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| node | 36 mil | carga_inicial_listEntries | 3 | 378.832 | 416.154 | 416.154 | 416.154 |
| node | 36 mil | indice_animais_rebuild | 3 | 1811.177 | 2005.876 | 2005.876 | 2005.876 |
| node | 36 mil | identificacao_para_peso | 1 | 6.262 | 6.262 | 6.262 | 6.262 |
| node | 36 mil | busca_indexada_animal | 1 | 3.372 | 3.372 | 3.372 | 3.372 |
| node | 36 mil | busca_indexada_periodo_30d | 1 | 143.219 | 143.219 | 143.219 | 143.219 |
| node | 36 mil | salvamento_local | 1 | 74.626 | 74.626 | 74.626 | 74.626 |
| node | 36 mil | recarga_apos_salvar | 3 | 468.36 | 480.212 | 480.212 | 480.212 |

Arquivos de origem: `baseline-node-36k.json`
