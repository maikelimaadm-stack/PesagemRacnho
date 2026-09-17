# R1 — Gates

| Gate | Script | Prova | Negativos |
|---|---|---|---|
| `reports:definitions:verify` | `verify-reports-definitions.mjs` | catálogo congelado, ids únicos, permissões genéricas existentes, fontes registradas, todo relatório disponível executa | sem `reports.read`, família/grão/versão inválidos, coluna de outro grão, >3 grupos, agregação inválida, EVENT sem período, parâmetro `sql` |
| `reports:filters:verify` | `verify-reports-filters.mjs` | 49 casos de operador × tipo; `applyFilters` AND + pesquisa sem acento; serialização | `not_equals` com lista, ausente ≠ 0, entidade não casa por nome, tipo de filtro desconhecido, coluna desconhecida |
| `reports:columns:verify` | `verify-reports-columns.mjs` | tipos do contrato, agregações por tipo, entidade id/nome/grupo, formatação por destino, ordenação | texto sem SUM, data sem AVG, percentual sem soma, GMD ponderado sem declaração, número agrupável |
| `reports:relation-parity:verify` | `verify-reports-relation-parity.mjs` | 12 critérios Relação × relatório: ids, ordem e todas as células iguais; CONSULTA mesma população sem colunas de valor; tela usa as funções compartilhadas | critério diferente detectado; predicado paralelo na tela proibido |
| `reports:index-prefilter:verify` | `verify-reports-index-prefilter.mjs` | estratégia `index:data_pesagem`, `rowsRead` = linhas do período, resultado = varredura completa | leitura > 10 % da base falha; id duplicado ativo vira uma linha |
| `reports:grain:verify` | `verify-reports-grain.mjs` | colunas pertencem ao grão; EVENT: A1 = 3 linhas, 9 eventos, 4 animais únicos | coluna fora da definição recusada |

Todos incluídos em `test:quick` e `test:full`. `npm run test:quick` → EXIT 0.
