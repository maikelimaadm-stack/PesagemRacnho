# 03 — Sistema de colunas

## 1. Como cada tela define uma coluna

| Aspecto | Relação | Lançamento | Cadastros | Fechamento / Ficha |
|---|---|---|---|---|
| Definição | `COLUNAS_DISPONIVEIS` no módulo (`PesagensIndividuais.jsx:66-100`): `{id,label,default,fixo?,sortable,align}` | `COLUNAS_DISPONIVEIS` **dentro do componente**, recriada a cada render (`Lancamento…jsx:414-447`) | `definition.colunas` (`registryDefinitions.js`) `{id,label,render?,referencia?}` + `definition.campos` + sintéticas `_typeLabel`/`_uso` | JSX solto (`FechamentoDia.jsx:191`; `FichaAnimal.jsx:161`) |
| Tipo | implícito: `NUMBER_COLUMN_IDS`/`DATE_COLUMN_IDS` (`:102-103`) | sets próprios (`:79-81`) | `campo.tipo`; filtro sempre `text`, exceto `_uso` | — |
| Formatter | `if` por id no corpo (`:1062-1170`) | `if` no corpo (~`:2110-2229`) **e** `switch` separado no CSV (`:1186-1244`) | **`formatCellValue` único** (`registryFormModel.js:79-90`) | inline |
| Accessor | `getPesagemColumnValue` (`:125-130`) | `linha[campo]` | `record[id]` + render/referência | inline |
| Ordenação | `sortable` + comparador por tipo | só 8 ids (`:2063`) + `switch` | **não há** | fixa |
| Filtro | tipo por set + `listOptions` crus | tipo por set, sem `listOptions` | texto formatado | controles próprios |
| Largura | `COLUMN_WIDTHS` (padrão 138 px) | CSS | `<colgroup>` fixo por id | CSS |
| Visibilidade/posição | `default` + localStorage | `default` + localStorage + `COLUMN_MODEL_VERSION` que **reseta** preferências (`:449,466,486-490`) | localStorage `aux-colunas:…` | — |
| Agregação | nenhuma na coluna | `RESUMO_FIELDS` (outra lista) | `_uso` | KPIs inline |
| Exportação | lista fixa de 17 | colunas visíveis na ordem | não há | listas fixas |

## 2. Respostas

**(1) Existe `ColumnDefinition` reutilizável?** **Não.** Três formatos (Relação, Lançamento, Cadastros) e duas
telas sem modelo. O mais próximo é o dos Cadastros (`formatCellValue` para tabela, cartões, filtro e pesquisa), sem
ordenação, largura, tipo de filtro, agregação e exportação.

**(2) A mesma definição serve tabela/filtro/agrupamento/subtotal/exportação?** Relação: não. Lançamento: não
(tabela e CSV em blocos paralelos; agregação em `RESUMO_FIELDS`). Cadastros: tabela, filtro e pesquisa sim; sem
exportação e agrupamento.

**(3) Colunas calculadas**

| Campo | Onde | Persistido |
|---|---|---|
| `data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | domínio (`weighingCalculations.js:13-34`), chamado e sobrescrito pelo service (`weighingService.js:36-50`); série recalculada em editar/excluir/importar | sim, `legacy_payload` (e no topo pelo recálculo em lote, `weighingDataAdapter.js:659-664`) |
| `doc_qtd` | **tela**; Relação conta em todas as datas, Lançamento só no dia — **mesmo rótulo, semânticas diferentes** | não |
| `numero_registro` | tela do Lançamento (posição no dia) | não |
| `peso_carcaca_estimado`, `quantidade_arrobas`, `rendimento_carcaca` | tela do Lançamento via `calculateCarcassTrade` | sim, snapshot |
| `era`, `categoria_id`, `categoria_automatica` | adapter (`stampAutomaticCategory`, `weighingDataAdapter.js:186-195`) | sim, snapshot (desde 16/09) |
| `status_animal` | mapper, derivado do tipo (`weighingMapper.js:143`) | **não** (proibido no payload) |

**(4) Colunas que só vivem no `legacy_payload`**

Topo do registro `pesagens`: `id`, `data_pesagem`, `peso_kg`, `lote_id`, `animal_id`, `tipo_pesagem`, `observacao`,
`sessao_id`, `created_at/updated_at/deleted_at`, `created_by_user_id/updated_by_user_id`.

Só no payload: `tipo_manejo`, `motivo_saida`, `causa_morte`, `numero_animal`, `sexo`, `raca`, `era`, `marca`,
`apartacao_id`, `nome_apartacao`, `nome_lote`, `origem`, `operador`, `id_externo`, `data_anterior`, `peso_anterior`,
`dias`, `ganho`, `gmd`, `alertas_confirmados`, `justificativa_alerta`, `valor_pago_cabeca`, `origem_animal`,
`documentacao` (JSON em string), `comprador`, `destino_venda`, `valor_venda_total`, `valor_arroba`,
`rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas`, `frigorifico`, `valor_arroba_abate`,
`valor_total_abate`, `embarque_id`, `embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero`,
`motorista_nome`, `placa_carreta`, `categoria_id`, `categoria_automatica`, `empresa_id`.

**Enviados pela tela e descartados** (fora da allowlist): `marca_id`, `raca_id`, `rendimento_origem`, `status_animal`.
O índice `pesagens.embarque_id` existe no esquema (`schema.js:54`), mas nenhum caminho grava `embarque_id` no topo:
**índice vazio na prática**.

**(5) Nomes duplicados para a mesma dimensão**

| Dimensão | Variações |
|---|---|
| `motivo_saida` | “Tipo de Saída” (Relação), “Motivo Saída” (Lançamento), “Motivo da Saída” (importação), “Por motivo de saída” (resumo), `animais.motivo_saida` (projeção) |
| `numero_animal` | “Animal”, “Identificação”, “Nº Ident./Nome”, “NumeroAnimal” (CSV), `animais.identificacao_normalizada`, identificador VISUAL |
| `tipo_manejo` × `tipo_pesagem` | payload × topo |
| `peso` × `peso_kg` | payload × topo (view model expõe os dois) |
| `nome_lote` × `lote_id`; `nome_apartacao` × `apartacao_id` | texto × id; Fechamento casa **id OU nome** |
| `marca`/`raca` × `marca_id`/`raca_id` | na pesagem só texto; id só no animal |
| `era` | snapshot na pesagem × `animais.era` |
| `status_animal` × `animais.situacao` | “Ativo/Inativo” × enum |
| `comprador`/`frigorifico` | texto livre × cadastro `parceiros` |

**(6) Colunas não seguras para relatório**

| Coluna | Motivo |
|---|---|
| `marca`, `raca`, `nome_lote`, `nome_apartacao`, `comprador`, `frigorifico`, `destino_venda`, `origem_animal`, `embarque_nome`, `documento_*`, `motorista_nome`, `placa_carreta` | texto snapshot; grafia variável; renomear cadastro não atualiza |
| `sexo`, `era` | snapshot do perfil na gravação |
| `doc_qtd` | semântica difere por tela |
| `dias`, `ganho`, `gmd`, `data_anterior`, `peso_anterior` | recalculados em cascata; só Manejo; GMD arredondado antes de médias |
| `quantidade_arrobas`, `peso_carcaca_estimado`, `valor_arroba` | dependem do rendimento da época; origem descartada |
| `status_animal` | derivado do evento, não é situação atual |
| `documentacao` | JSON em string |
| `empresa_id` | só no payload |

## 3. Recomendação — definição única de coluna

Uma definição declarativa por **fonte de dados** (não por tela), consumida por tabela, filtro, ordenação, agrupamento,
agregação e exportação:

```text
{ id, label, grain[], type: text|number|date|enum|boolean|entity|currency|weight|gmd,
  accessor(row) → valor cru tipado (null quando ausente),
  display(valor) → texto (pt-BR),
  export(valor) → valor para arquivo (número sem milhar),
  entity?: { store, idField, labelField },       // dimensões com id
  filter: { operators[], options?: 'distinct'|'entity'|fixed },
  sortable, groupable, aggregations[], width, align, unit, sensitive? }
```

Regras: dimensões com cadastro agrupam e filtram **por id**, exibindo o nome atual; o texto snapshot fica como coluna
“histórica” separada e marcada. Colunas derivadas declaram a fórmula e a versão. `formatCellValue` dos Cadastros e
`formatNumber.js` são a base de `display`.
