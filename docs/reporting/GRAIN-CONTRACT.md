# Contrato de grão

Fonte: `src/modules/reporting/domain/reportGrain.js`. O grão responde **"o que é UMA linha?"**. Todo
relatório declara exatamente um grão; toda coluna declara em quais grãos existe (`grains`). Uma coluna de
outro grão faz `defineReport` falhar (gate `reports:grain:verify`).

## 1. Grãos, fontes e chave única

| Grão | Rótulo (`GRAIN_LABELS`) | Fonte (`source`) → função | Leitura | Chave única da linha |
|---|---|---|---|---|
| `EVENT` | uma linha por pesagem (evento) | `events.byPeriod` → `loadEventRows` (`eventSource.js`) + `enrichEventRows` (`eventRows.js`) | índice `pesagens.data_pesagem` (between inclusivo); animais e sessões por `anyOf` | `id` da pesagem; duplicatas do mesmo `id` resolvidas por `dedupeById` (fica o maior `localId`) |
| `EXIT` | uma linha por saída definitiva | `events.byPeriod` com `sourceOptions.tipos: ['Saída']` | igual ao EVENT, só tipo Saída | `id` da pesagem de saída |
| `ANIMAL_CURRENT` | uma linha por animal (estado atual) | `animals.current` → `loadAnimalCurrentRows` + `toAnimalCurrentRows` (`animalRows.js`) | projeção `animais` (não reconstrói histórico) | `animais.id` |
| `ANIMAL_PERIOD` | uma linha por animal no período | `animals.period` → `loadAnimalPeriodRows` + `toAnimalPeriodRows` | eventos do período pelo índice `data_pesagem`, agrupados por animal; `animais` por `anyOf` | `animal_id`; registro legado sem id: `legado:<número normalizado>::<marca normalizada>` (`animalKeyOf`) |
| `LOT` | uma linha por lote | `lots.current` → `loadLotRows` (`controlSources.js`) | `loteApartacoes`, `apartacoes` e `animais` pelo índice `situacao = ATIVO` | `loteApartacoes.id` |
| `LOT_STAY` | uma linha por permanência do animal no lote | `lotStays.byPeriod` → `loadLotStayRows` | índice `animalLotes.inicio ≤ fim do período`, descartando as encerradas antes do início | `animalLotes.id` |
| `SHIPMENT_DOCUMENT` | uma linha por animal do documento de embarque | `shipments.documents` → `loadShipmentDocumentRows` | `documentosEmbarque`, `embarques` e saídas pelo índice `pesagens.tipo_pesagem` | `documentosEmbarque.id` (ver nota) |
| `AUDIT_ENTRY` | uma linha por registro de auditoria | `audit.byPeriod` → `loadAuditRows` | índice `auditoria.created_at` | `auditoria.id` |
| `DATA_ISSUE` | uma linha por inconsistência encontrada | `data.quality` → `loadDataIssueRows` | `logicalIntegrity()` + `animais` + `pesagens` (Cadastro/Manejo) | id sintético `integridade-<n>` / `extra-<n>` |
| `REGISTRY_ITEM` | uma linha por item de cadastro | `registry.<store>` → `loadRegistryRows` | store inteira (cadastros são pequenos) | `id` do cadastro |
| `BACKUP_ENTRY` | uma linha por backup registrado | `backups.history` → `loadBackupRows` | store `backupHistory` | `id` (ou `localId`) |
| `SESSION` | uma linha por sessão de pesagem | — | nenhuma fonte registrada | nenhum relatório usa este grão hoje |

Todas as fontes descartam registros com `deleted_at`.

**Nota SHIPMENT_DOCUMENT:** o rótulo do grão fala em "animal do documento", mas a fonte atual produz
**uma linha por documento de embarque**, com contagens de previsto × realizado. O romaneio por animal
(`embarques.romaneio`) usa o grão `EXIT`.

## 2. Grãos com animal

`ANIMAL_KEYED_GRAINS` = `EVENT`, `ANIMAL_CURRENT`, `ANIMAL_PERIOD`, `LOT_STAY`, `EXIT`,
`SHIPMENT_DOCUMENT`. Só nesses grãos:

- `countDistinct` na coluna `animal` é aceito em `defaultAggregates` (validação de `defineReport`);
- `runReport` calcula `uniqueAnimalCount` quando a definição declara `animalColumnId`.

## 3. Regras

### 3.1 Um animal com 8 pesagens

| Grão | Linhas desse animal | Motivo |
|---|---|---|
| `EVENT` | **8** | uma por pesagem |
| `ANIMAL_CURRENT` | **1** | um registro na projeção `animais` |
| `ANIMAL_PERIOD` | **1** (se ao menos uma pesagem estiver no período) | eventos do período agrupados por `animalKeyOf` |

No grão EVENT, "Registros" conta 8 e "Animais únicos" conta 1. A nota de "Pesagens por período" diz:
um animal pesado 3 vezes aparece 3 vezes; "Animais únicos" conta cada animal uma vez.

### 3.2 Animais únicos nunca são somados

`countDistinct` é recalculado sobre a população de cada grupo e do total geral (nunca soma de filhos).
Um animal que aparece em dois lotes do mesmo período conta 1 em cada subtotal de lote e **1** no total
geral — a soma dos subtotais (2) não é o total. Ver AGGREGATION-CONTRACT.md.

### 3.3 Soma de peso de eventos não é estoque

No grão EVENT, `sum(peso)` é a soma dos pesos **registrados em pesagens** do período: o mesmo animal
pesado várias vezes entra várias vezes. Não representa o peso do rebanho. Peso do rebanho (estoque) é
`sum(ultimo_peso_kg)` em `ANIMAL_CURRENT` ("Peso total" do Inventário). Rebanho em data passada e
balanço de estoque não existem (relatórios bloqueados: `rebanho.historico-data`, `movimentacao.balanco`).

### 3.4 ANIMAL_PERIOD: peso inicial, final, ganho e GMD

`toAnimalPeriodRows`:

- eventos ordenados por `data_pesagem`, `created_date`, `id`;
- consideradas "com peso" só as pesagens com peso numérico > 0;
- peso/data inicial = primeira pesagem com peso; peso/data final = última;
- `ganho` e `dias` só existem com **≥ 2** pesagens com peso; senão `null`;
- `gmd` = ganho ÷ dias apenas com dias > 0; senão `null`;
- `pesagens` = todos os eventos do animal no período; `pesagens_com_peso` = só os com peso;
- dimensões (marca, raça, categoria, sexo, situação) vêm da projeção do animal quando existe; lote e
  apartação vêm da **última** pesagem do período.

### 3.5 ANIMAL_CURRENT

Peso atual = `animais.ultimo_peso_kg`; `dias_sem_pesagem` = dias entre `ultima_pesagem_data` e `today`
(ausente se não há data). Faixa de peso: faixas do parâmetro `faixas` ou, sem elas, das categorias com
faixa configurada, considerando o sexo; sem faixa → "Não informado" e aviso `NO_WEIGHT_BANDS`.

### 3.6 LOT

Ocupação e peso médio pela projeção atual (`animais.lote_atual_id`, só ATIVO). Sem capacidade informada
(ou ≤ 0), `capacidade` e `ocupacao` ficam ausentes (não 0 nem 100 %).

### 3.7 LOT_STAY

Permanências reconstruídas da projeção `animalLotes`. `mudanca` = existe permanência anterior do mesmo
animal; `lote_origem` = lote da permanência anterior; `dias_no_lote` = de `inicio` até `fim` (ou até
`today` se aberta).

### 3.8 DATA_ISSUE, AUDIT_ENTRY, REGISTRY_ITEM

- Auditoria: nunca devolve conteúdo anterior/posterior dos registros (podem conter valores comerciais).
- Usuários (`registry.usuarios`): projeção campo a campo (`id`, `nome`, `login`, `role`, `ativo`,
  `last_login_at`, `created_at`); hash, salt e chave de recuperação nunca saem da fonte.
