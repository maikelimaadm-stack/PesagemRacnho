# 17 — Gaps e riscos

Nada abaixo foi corrigido nesta missão (somente auditoria). Severidade:
**P0** bloqueia relatório confiável ou é falha de segurança · **P1** distorce número ou expõe dado · **P2** limita escopo/performance · **P3** acabamento.

## P0

| ID | Gap | Evidência | Efeito em relatórios | Correção proposta (fatia) |
|---|---|---|---|---|
| G-P0-01 | Restrição ADMIN da manutenção **nunca dispara**: `getActor()` não traz perfil | `maintenanceService.js:12-26`; `auditActor.js` `getActor()` → `{usuario_id, usuario_nome_snapshot}` | GESTOR pode restaurar backup, limpar e resetar base | usar `getCurrentActor()`/`getActorRole()`; gate de perfil (fora de relatórios, prioridade de segurança) |
| G-P0-02 | Animal com categoria automática perde a categoria quando o último evento é Saída sem peso (Morte/Doação/Transferência) — **regressão não commitada de 16/09** | `weighingDataAdapter.js:198-221` usa `latest.peso_kg ?? latestUi.peso` | inventário e saídas por categoria mostram “Não informado” | calcular pelo último evento **com peso**; gate em `verify-animal-history-integrity` |
| G-P0-03 | `marca_id`, `raca_id`, `rendimento_origem` enviados pela UI e **descartados** pela allowlist | `weighingMapper.js` `LEGACY_PAYLOAD_ALLOWLIST`; `Lancamento:1026,1148` | agrupamento histórico por marca/raça só por texto; abate sem origem do rendimento | incluir na allowlist (sem schema, é payload) |
| G-P0-04 | Nenhuma permissão de exportação e valores comerciais visíveis a todos (`commercial.values` declarado e não usado) | `permissions`; Relação | CONSULTA exporta valores de venda/abate | aplicar `reports.read`, `commercial.values` e nova `reports.export` |

## P1

| ID | Gap | Evidência | Efeito |
|---|---|---|---|
| G-P1-01 | `ResumoPersonalizado` retorna 0 sem valores (null→0) | `ResumoPersonalizado.jsx:21` | média “0” em vez de “—” |
| G-P1-02 | Eventos contados como animais em resumos | agente 2 / doc 05 | cabeças infladas |
| G-P1-03 | Sem GMD ponderado; três fórmulas de arroba | doc 05 | médias de grupo divergentes |
| G-P1-04 | `resolveRegistryId` cria marca/raça silenciosamente a partir do texto | `weighingDataAdapter.js:52-63` | cadastros duplicados por grafia; sem auditoria |
| G-P1-05 | Joins por nome de lote/apartação (Fechamento) | doc 06 | lotes homônimos misturados |
| G-P1-06 | Cinco variantes de CSV, escape incompleto | doc 13 | arquivo quebra no Excel com `;`/aspas |
| G-P1-07 | Métricas de rodapé escondidas por CSS | `d17b-modelobase1.css:861,1133` | total da tabela não aparece |
| G-P1-08 | `movimentosAnimais` não acompanha edição/exclusão | doc 07 | movimentação errada se usada |
| G-P1-09 | Fechamento não congela números; “backup do dia” sem hash | doc 01 | relatório do dia muda depois |
| G-P1-10 | CONSULTA vê importar/editar em lote/excluir na Relação sem bloqueio | doc 18 | risco de alteração por perfil de leitura |
| G-P1-11 | `assertRegistryWrite` permite gravação sem ator | doc 18 | escrita sem usuário |
| G-P1-12 | SN em Manejo/Saída deixa `animal_id` órfão; `bulkCreate` cria animal para qualquer tipo | doc 07 | animais fantasmas / eventos sem animal |
| G-P1-13 | Categorias semeadas sem faixa de peso → categoria automática null até configurar | `seeds.js` | relatórios por categoria vazios |
| G-P1-14 | `id` de domínio não único (chave `localId`) | `schema.js` | duplicidade em joins |
| G-P1-15 | GTA/NF-e/frete de venda e abate não persistidos | doc 07 | conciliação documental incompleta |

## P2

| ID | Gap | Evidência |
|---|---|---|
| G-P2-01 | Nenhum filtro de usuário usa índice; `listEntries` lê tudo | doc 04, 14 |
| G-P2-02 | Índices vazios: `pesagens.embarque_id`, `apartacoes.nome` (campo `nome_apartacao`), `documentosEmbarque.tipo` (campo `tipo_documento`), `embarques.parceiro_id`, `ativo`, `[data+local]` | `schema.js:55-58` |
| G-P2-03 | N+1 em bulk e contagens de uso; `FichaAnimal.jsx:39` quadrático | doc 14 |
| G-P2-04 | Sem medição v7 em 250k; salvar estoura orçamento em 36k | doc 14 |
| G-P2-05 | Sem ColumnDefinition, groupBy genérico ou agregador único | docs 03, 05, 06 |
| G-P2-06 | Filtros sem persistência; `values` ignora operador; texto sensível a acento | doc 04 |
| G-P2-07 | Sem impressão/PDF/XLSX; `window.open` negado; `writeUserFile` só texto | doc 13 |
| G-P2-08 | Auditoria não registra exportação, backup, fechamento | doc 07 |
| G-P2-09 | Parceiros não referenciados por id (comprador/frigorífico texto) | doc 07 |
| G-P2-10 | `animalIdentificadores` não atualiza ao editar | doc 07 |
| G-P2-11 | Duplicidade de pesagem no mesmo dia bloqueada só na UI | doc 07 |

## P3

| ID | Gap |
|---|---|
| G-P3-01 | `totaisDocsAbate` produz NaN (código morto) |
| G-P3-02 | CSV da manutenção com `operador`/`origem` sempre vazios |
| G-P3-03 | `weighing.summary` sem uso; componentes órfãos (MgCmdSelect, MgPortalPanel, useMgPanelPosition, ModeloBase1ActionBar) |
| G-P3-04 | Rótulos divergentes (“Tipo de Saída” × “Motivo Saída”); sexo exibido como código |
| G-P3-05 | `doc_qtd` sem semântica e filtro que nunca casa (`Lancamento:629`) |
| G-P3-06 | `backupHistory` sem usuário; `sessoesPesagem` sem auditoria de fechar/reabrir |
| G-P3-07 | Fallback de rendimento 50% silencioso |

## Riscos de processo

| Risco | Situação |
|---|---|
| 37 arquivos não commitados (1.2.0 + categoria por peso) | perda de trabalho; auditoria baseada em árvore suja |
| Instalador `Setup 1.2.0.exe` anterior à regra de categoria | não distribuir |
| Documentos antigos divergem do código (doc 00 §divergências) | não usar docs de 14/09 como verdade |

## Validação executada nesta auditoria (somente leitura)

| Verificação | Resultado |
|---|---|
| `npm run lint` | verde |
| `npm run build` | verde |
| 10 gates do `test:quick` executados | verdes |
| `packaged:ui-build:verify` | **vermelho esperado** — pasta `release/` não existe (instalador não gerado nesta missão) |
| `diagnostic:packaged:ui-build:verify` | **vermelho esperado** — instalador existente é mais antigo que o `dist` recém-gerado |

Nenhum gate foi alterado para passar.
