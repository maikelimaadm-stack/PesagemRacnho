# 21 — Plano de gates futuros

Nenhum gate foi criado nesta missão. Padrão proposto: scripts `scripts/verify-report-*.mjs` em node (domínio puro e
IndexedDB fake como os gates atuais), entrando no `test:quick` à medida que cada fatia fica pronta.

| Gate | Prova | Como | Fatia |
|---|---|---|---|
| `verify-report-parity` | Relação e relatório `pesagens.periodo` retornam **as mesmas linhas e os mesmos valores formatados** para o mesmo filtro | massa fixa; comparar ids e células da tela (via funções extraídas) × `ReportResult` | R1 |
| `verify-report-filters` | cada operador × tipo (texto, número, data, enum, entidade, booleano), `in/not_in`, acento, vírgula decimal, vazio/não vazio, período inclusivo | tabela de casos; também prova que o comportamento antigo da Relação foi preservado onde não era bug | R1 |
| `verify-report-indexed-prefilter` | relatório de período usa `where('data_pesagem')` e o resultado é idêntico ao `toArray` + filtro | espiar chamadas do repositório | R1 |
| `verify-report-grouping` | árvore de até 3 níveis; grupo “Não informado”; ordem estável | massa com nulos | R2 |
| `verify-report-subtotals` | subtotal de cada grupo = agregação recalculada da população do grupo | comparação com cálculo ingênuo | R2 |
| `verify-report-grand-total` | total geral recalculado sobre a população inteira, **não** soma de subtotais para média/countDistinct | caso onde soma de médias diverge | R2 |
| `verify-report-unique-animals` | animal com várias pesagens conta 1 em “animais únicos”; animal em 2 grupos conta 1 no total | massa específica | R2 |
| `verify-report-null-semantics` | nulo excluído de média/mín/máx; `n_ausentes` correto; grupo sem valor → `null` (não 0) | inclui regressão do `ResumoPersonalizado` | R2 |
| `verify-report-weighted-avg` | GMD ponderado = Σganho/Σdias emparelhados; linhas com ganho sem dias (ou o contrário) excluídas | casos de borda `dias<=0` | R2 |
| `verify-report-grain` | definição recusa coluna/métrica de grão incompatível; peso total de eventos não aparece como estoque | — | R2 |
| `verify-report-permissions` | CONSULTA sem `commercial.values` não recebe colunas comerciais (tela, filtro, modelo, exportação); OPERADOR sem `reports.read` barrado no service; `password_*`/`recovery_*` nunca aparecem | matriz de perfis | R1/R3 |
| `verify-report-no-duplication` | linhas com `id` repetido (localId diferente) resolvidas para a ativa mais recente; excluídas nunca aparecem | massa com duplicata | R1 |
| `verify-report-templates` | modelo serializa/desserializa; coluna desconhecida removida com aviso; preset relativo resolvido na emissão; modelo não amplia permissão | appSettings fake | R3 |
| `verify-report-export-csv` | `;`, BOM, aspas/quebra de linha escapadas, números sem separador de milhar, `tipo_linha` (detalhe/subtotal/total), sha256 bate com o conteúdo | round-trip de parse | R3 |
| `verify-report-manifest` | manifesto contém usuário, perfil, período resolvido, filtros, versão e hash | — | R3 |
| `verify-report-print-layout` | cabeçalho repetido, quebra por grupo, rodapé com página | inspeção do HTML gerado (DOM) | R4 |
| `verify-report-large` | 36k eventos: período 30d ≤ 300 ms p95; rebanho atual ≤ 500 ms; CSV 36k ≤ 3 s; 250k: sem estouro de memória com leitura em blocos | `modules/perf/testMass.js` | R5 |
| `verify-category-projection` (pré-requisito) | Saída sem peso mantém categoria do último evento com peso | massa com Morte/Doação | R0 |

Regra: **gate existente não é afrouxado**; paridade é prova, não ajuste do gate.
