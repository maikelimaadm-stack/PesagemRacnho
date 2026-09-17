# R3 — Catálogo, modelos, CSV/JSON e permissões (16/09/2026)

Commits `a38ca48..0ec4311`. Sem schema (modelos em `appSettings`), sem dependência nova.

## Entregue

| Peça | Detalhe |
|---|---|
| Menu | **uma** entrada “Relatórios” (grupo Relatórios, `reports.read`) — rota `#/Relatorios` |
| Catálogo | abas Todos · Favoritos · Meus relatórios · Recentes; seções por família (só famílias com relatório disponível); cartão com nome, descrição, grão, métricas, permissões exigidas (valores comerciais/auditoria), classificação “DADOS LEGADOS/POR EVENTO”, último uso e estrela de favorito; pesquisa sem acento |
| Tela do relatório | barra ModeloBase1 (voltar, breadcrumb, favorito, período com presets e personalizado, parâmetros inteiros, Agrupar, Totais, Colunas, Atualizar, Salvar modelo, Exportar); faixa de pílulas por coluna visível + pílulas de condição fixa (cadeado); menu de coluna no cabeçalho (filtrar/ocultar); contexto (período resolvido, grão, agrupamento, tempo e estratégia); avisos; notas do relatório; tabela com linhas de grupo, subtotais (“n de N” quando há ausentes), total geral e paginação de apresentação |
| Configurar colunas | `MakColumnConfigDialog` existente — só colunas do grão visíveis ao perfil; mostrar/ocultar/reordenar/restaurar |
| Agrupar | até 3 níveis, reordenação, direção; só colunas `groupable` |
| Totais | por coluna, só operações da ColumnDefinition (texto: distintos; data: mín/máx; GMD: simples/ponderado) |
| Modelos | `reportTemplateService`: PERSONAL/SHARED, `reports.templates.share`, nome único por escopo, dono preservado, só configuração, revalidação ao abrir (remove com aviso o que o perfil não vê) |
| Favoritos/recentes | `report-favorites:<empresa>:<usuário>`, `report-recents:<empresa>:<usuário>` |
| CSV | `csvExporter` único: BOM, `;`, CRLF, escape, proteção contra fórmula, números pt-BR, `tipo_linha` GROUP/DATA/SUBTOTAL/GRAND_TOTAL (+ `nivel`, `grupo`, `metrica`, `valor`) |
| JSON | `manifest`, `definition`, `parameters`, `period`, `filters`, `lockedFilters`, `sort`, `groups`, `columns`, `aggregates`, `data`, `tree`, `totals`; `contentSha256` do corpo |
| Manifesto | `reportId`, `reportName`, `reportDefinitionVersion`, `emissionId`, `emittedAt`, `emittedBy {id,nome,role}`, `appVersion`, `schemaVersion`, `dataBuildId`, filtros, período (resolvido e descrito), grupos, colunas, agregações, `recordCount`, `uniqueAnimalCount`, `hiddenByPermission`, `sha256`, `fileName` |
| Gravação | Electron: `app:writeUserFile` em `<dados>/relatorios` com SHA-256 conferido (arquivo divergente → `REPORT_INTEGRITY`); navegador de desenvolvimento: download |
| Permissões | serviço recusa: sem sessão, OPERADOR exporta, coluna sensível injetada no view model, view model de outra sessão; filtro/ordenação/total/pesquisa em coluna sensível descartados para O/C (sem canal lateral); carcaça estimada também é sensível (arrobas = carcaça ÷ 15) |

## Verificação na tela (navegador de desenvolvimento, 1440×900, ADMIN)

- Catálogo renderizado com as famílias Rebanho, Pesagens e Desempenho.
- “Pesagens por lote e apartação”: grupos, subtotais e total geral; contexto dentro do card.
- “Desempenho individual”: Salvar modelo → toast “Modelo ‘Teste desempenho’ salvo (pessoal).” e registro em `report-templates:local` (11 colunas, dono `maike`).
- Exportação não foi clicada no navegador (geraria download); coberta pelos gates.

## Gates

`reports:templates:verify`, `reports:permissions:verify`, `reports:csv-parity:verify`, `reports:json-manifest:verify`,
`reports:sensitive-data:verify` — todos no `test:quick` (EXIT 0).

## Riscos

| Risco | Mitigação |
|---|---|
| Filtros de entidade/enum salvos no modelo guardam o rótulo exibido (pílula) | tradução rótulo→id na execução pela população base; rótulo renomeado no cadastro deixa de casar (aviso: refazer o filtro) |
| CSV/JSON gravados na pasta de dados do app (sem escolher pasta) | toast mostra o caminho; seletor de destino chega com o IPC do R4 |
| Opções da pílula limitadas a 500 valores distintos | suficiente para dimensões; identificadores usam “contém” |
