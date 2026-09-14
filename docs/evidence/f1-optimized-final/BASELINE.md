# Baseline de desempenho — F0

Gerado em 2026-09-08T20:47:13.924Z — aplicação 1.1.17. Valores em milissegundos.
Orçamentos (07-ROADMAP §4): busca indexada p95 < 100 ms; identificação → peso sem bloqueio perceptível; salvamento local p95 < 250 ms.

| runtime | massa | métrica | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| node | 36 mil | carga_inicial_listEntries | 3 | 348.737 | 376.05 | 376.05 | 376.05 |
| node | 36 mil | indice_animais_rebuild | 3 | 1304.852 | 1368.817 | 1368.817 | 1368.817 |
| node | 36 mil | identificacao_para_peso | 200 | 1.783 | 2.848 | 4.017 | 4.11 |
| node | 36 mil | busca_indexada_animal | 200 | 0.093 | 0.238 | 0.727 | 129.644 |
| node | 36 mil | busca_indexada_periodo_30d | 20 | 31.383 | 51.206 | 53.738 | 53.738 |
| node | 36 mil | salvamento_local | 10 | 56.704 | 76.334 | 76.334 | 76.334 |
| node | 36 mil | recarga_apos_salvar | 3 | 323.051 | 325.525 | 325.525 | 325.525 |

Arquivos de origem: `baseline-node-36k.json`
