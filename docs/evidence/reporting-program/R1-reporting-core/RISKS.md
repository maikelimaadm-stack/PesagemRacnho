# R1 — Riscos

| Risco | Mitigação |
|---|---|
| Relação ainda lê a store inteira (`full-scan`) — comportamento anterior preservado | relatórios usam índice; período opcional na Relação fica para decisão de UX (R5 mede 250k) |
| `doc_qtd` é contado dentro da população carregada (base inteira na Relação; período no relatório) | coluna documentada; não entra nos critérios de paridade de população |
| Filtros salvos antigos em memória de sessão com “É diferente de” + lista mudam de resultado (agora correto) | não havia persistência de filtros; mudança é correção |
| Colunas `marca`/`raca`/`lote` exibem o texto do evento; grupo usa id | grafias diferentes do mesmo cadastro caem no mesmo grupo; rótulo = nome atual do cadastro |
| Enum filtrado por pílula de texto (tipo, sexo, motivo) | `matchesAccessor` casa código ou rótulo; coberto em gate |
