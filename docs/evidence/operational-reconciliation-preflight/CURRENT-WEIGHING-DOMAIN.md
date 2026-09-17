# CURRENT-WEIGHING-DOMAIN — mapa do domínio canônico de pesagens e animais (estado atual)

**Preflight de reconciliação operacional · 17/09/2026 · branch `program/sanity-launch-import` (HEAD `d44d5b9`) · somente leitura**

Escopo: tudo o que a **importação** e o **lançamento** precisam compartilhar para gravar eventos de animal (Cadastro, Manejo, Saída), calcular a série de peso, resolver a identidade do animal, aplicar a categoria automática e manter as projeções. Fonte da verdade: **o código** desta branch. Onde documento antigo diverge, isso está dito em §17.

Convenções: `arquivo:linha` é relativo à raiz `MAKGESTAO-main`. "Adapter" = `src/modules/weighing/infrastructure/weighingDataAdapter.js`. "Service" = `src/modules/weighing/application/weighingService.js`. "Lançamento" = `src/pages/LancamentoPesagensIndividuais.jsx`. "Relação" = `src/pages/PesagensIndividuais.jsx` (onde vive a importação CSV atual).

---

## 0. Resumo executivo

1. **Não existe um "domínio único" hoje.** A regra está espalhada em quatro camadas: funções puras (`weighingCalculations`, `weighingSeries`, `weighingMapper`, `categorySuggestion`, `animalHistory`), o service (derivados e recálculo), o adapter (cronologia, identidade na importação, categoria, projeções, auditoria, transações) e **a tela do Lançamento** (identidade por número, duplicidade no mesmo dia, "já cadastrado", "animal inativo"). Parte das regras que a missão considera canônicas só existe na tela.
2. **Derivados (peso anterior/data anterior/dias/ganho/GMD):** uma única fórmula pura (`calculateWeightGain`, `src/modules/weighing/domain/weighingCalculations.js:13-35`) e uma única recomposição de série (`recalculateWeightSeries`, `src/modules/weighing/domain/weighingSeries.js:10-46`). Só `tipo_manejo === 'Manejo'` recebe valores; Cadastro e Saída recebem `null`. Referência anterior = último evento **com peso** de data **estritamente anterior** (mesmo dia nunca é referência).
3. **Três regras da missão divergem do código:**
   - "Manejo NÃO muda categoria automaticamente por peso" — **hoje muda** (adapter `:197-207` e `:232-243`), e dois gates **exigem** esse comportamento (`scripts/verify-animal-history-integrity.mjs:131-135`, `scripts/verify-category-projection.mjs:26-29`).
   - "Evento mais antigo de animal inexistente = Cadastro" — **hoje a importação cria o animal a partir de qualquer tipo** (adapter `:556-574`) e não cria Cadastro; o `createEntry` aceita Manejo/Saída com `animal_id` nulo (adapter `:303`).
   - "Nunca dois Cadastros" — **só é garantido por `animal_id`** (adapter `:172-174`, `:580-582`). Por número+marca, só a tela do Lançamento bloqueia (`Lançamento:883-887`).
4. **Custo:** `createEntry`/`updateEntry`/`deleteEntry` recalculam só o animal (índice `animal_id`), mas **importação, edição coletiva e a exclusão pela tela** (inclusive a exclusão do Lançamento) chamam `recalculateAllWeightSeries`, que lê a base inteira e **regrava todas as pesagens** sem comparar valores (service `:113`, `:133`, `:140`; `src/modules/animals/application/animalHistoryService.js:22`; `weighingSeries.js:36-41`).
5. **Transação:** a gravação do evento + projeções é uma transação Dexie única por operação, mas a **validação cronológica do `createEntry`/`updateEntry` roda fora dela** (adapter `:309`, `:402`) e o **recálculo da série é uma segunda transação** (service `:86-88`, `:113`, `:210`).
6. **Projeções:** `animais` e `animalLotes` são reconstruídas pelo adapter; **`movimentosAnimais` é só append** e nunca é corrigida em edição/exclusão (confirmado pelo próprio relatório: `src/modules/reporting/definitions/operacional.js:95`). A importação **não reconstrói `animalLotes`** para eventos retroativos.
7. **Identidade canônica não tem um dono.** Há pelo menos quatro implementações de "número+marca" com normalizações diferentes (§9); os índices compostos `[tipo+valor_normalizado]` e `[marca_id+valor_normalizado]` existem no schema mas **não são usados para resolver animal** em lugar nenhum.

---

## 1. Mapa de arquivos e responsabilidades

| Arquivo | Camada | Responsabilidade | Exporta (relevante) |
|---|---|---|---|
| `src/modules/weighing/domain/weighingCalculations.js` | domínio puro | ganho/dias/GMD contra histórico | `calculateWeightGain` (`:13`) |
| `src/modules/weighing/domain/weighingSeries.js` | domínio puro | agrupa por animal, ordena, recompõe a série | `recalculateWeightSeries` (`:10`), `animalIdentityKey` (`:48`) |
| `src/modules/weighing/domain/weighingMapper.js` | domínio puro | allowlist do `legacy_payload`, validação, UI↔storage | `LEGACY_PAYLOAD_ALLOWLIST` (`:6`), `LEGACY_PAYLOAD_FORBIDDEN` (`:23`), `filterLegacyPayload` (`:30`), `findDisallowedLegacyKeys` (`:39`), `validateUiPayload` (`:51`), `uiToStorageRecord` (`:81`), `storageRecordToViewModel` (`:115`) |
| `src/modules/weighing/domain/weighingErrors.js` | domínio puro | erro tipado | `WeighingError` (`:1`), `WEIGHING_ERROR_CODES` (`:10`), `toUserMessage` (`:17`) |
| `src/modules/weighing/domain/commercialCalculations.js` | domínio puro | carcaça, arroba (15 kg de carcaça), rendimento | `ARROBA_CARCASS_KG` (`:7`), `YIELD_ORIGIN` (`:9`), `normalizeCarcassYield` (`:16`), `resolveCarcassYield` (`:26`), `arrobasFromCarcassKg` (`:40`), `calculateCarcassTrade` (`:44`) |
| `src/modules/weighing/domain/weighingWarnings.js` | domínio puro | avisos de conferência (usa `calculateWeightGain`) | `DEFAULT_WEIGHT_WARNING_POLICY` (`:4`), `buildWeightWarningPolicy` (`:22`), `evaluateWeighingWarnings` (`:38`) |
| `src/modules/weighing/domain/brazilianValues.js` | domínio puro | número/data brasileiros | `parseBrazilianNumber` (`:4`), `parseCivilDate` (`:42`), `isFutureCivilDate` (`:63`) |
| `src/modules/weighing/application/weighingService.js` | aplicação | permissão, derivados, recálculo, orquestração | `createEntry` (`:53`), `bulkCreateEntries` (`:105`), `bulkUpdateEntries` (`:117`), `bulkDeleteEntries` (`:137`), `recalculateAllWeightSeries` (`:144`), `updateEntry` (`:199`), `deleteEntry` (`:218`), `getEntryById` (`:233`), `listEntries` (`:237`). **Privada:** `recalculateWeightSeriesForKeys` (`:148`) |
| `src/modules/weighing/infrastructure/weighingDataAdapter.js` | infraestrutura | transações, cronologia, identidade (import), criação de animal, categoria, projeções, sessões, auditoria | exportadas: `createEntry` (`:297`), `updateEntry` (`:393`), `deleteEntry` (`:438`), `bulkCreateEntries` (`:442`), `bulkUpdateEntries` (`:668`), `bulkDeleteEntries` (`:753`), `getEntryById` (`:777`), `listAllEntries` (`:787`). **Privadas:** `validateAnimalChronology` (`:165`), `stampAutomaticCategory` (`:197`), `weightOf` (`:210`), `rebuildAnimalStateProjection` (`:215`), `rebuildAnimalLotProjection` (`:260`), `existingRegistryId` (`:67`), `resolveRegistryId` (`:54`), `findDefaultRegistryId` (`:47`), `newAnimal` (`:116`), `newVisualIdentifier` (`:144`), `newSession` (`:96`), `auditRow` (`:73`), `changedFields` (`:78`) |
| `src/modules/animals/domain/animalHistory.js` | domínio puro | identidade legada NÚMERO::MARCA, animais "cadastrados" derivados das pesagens, plano de exclusão | `normalizeAnimalText` (`:1`), `createAnimalId` (`:3`), `legacyAnimalKey` (`:6`), `sameAnimal` (`:10`), `getAnimalHistory` (`:17`), `getRegisteredAnimals` (`:22`), `buildAnimalLookupIndex` (`:93`), `findAnimalsByNumber` (`:111`), `buildDeletionPlan` (`:121`), `canonicalProfile` (`:143`) |
| `src/modules/animals/domain/snAnimal.js` | domínio puro | animal "SN" (sem número) | `isSnIdentifier` (`:1`), `normalizeAnimalIdentifier` (`:3`), `findLatestSnProfile` (`:6`) |
| `src/modules/animals/application/animalHistoryService.js` | aplicação | propagação de perfil (só `animal_id` em legados) e exclusão protegida | `propagateAnimalProfile` (`:4`), `deleteEntriesRespectingHistory` (`:16`) |
| `src/modules/operations/domain/categorySuggestion.js` | domínio puro | categoria por sexo+peso | `sexMatches` (`:14`), `hasWeightRange` (`:22`), `weightMatches` (`:26`), `categoriesForSex` (`:43`), `suggestCategory` (`:48`), `eraOfCategory` (`:53`) |
| `src/modules/operations/domain/importRegistryResolution.js` | domínio puro | marca/raça das linhas de importação → ids | `collectRegistryTexts` (`:22`), `splitImportRowsByRegistry` (`:57`) |
| `src/modules/operations/domain/closingPendencies.js` | domínio puro | pendências (usa `gmd` persistido) | `exitRequiresDocument` (`:9`), `pendenciesOf` (`:21`) |
| `src/modules/operations/application/operationalPolicies.js` | aplicação | padrões, política comercial, avisos | `loadOperationalPolicies` (`:82`), `resolveDefaultRegistry` (`:102`) |
| `src/modules/operations/application/operationalInsightsService.js` | aplicação | fechar/reabrir dia, ler registro `animais` | `closeWeighingDay` (`:16`), `reopenWeighingDay` (`:38`), `getAnimalRecord` (`:45`) |
| `src/modules/catalog/application/masterRegistryService.js` | aplicação | CRUD de cadastros mestres com auditoria e unicidade | `createMasterRegistryService` (`:136`), `resolveByName` (`:396`) |
| `src/modules/catalog/domain/registryDefinitions.js` | domínio | definição de `categoriasAnimal` (faixas de peso, era, ordem) | `CATEGORIAS_ANIMAL` (`:200-238`) |
| `src/modules/catalog/domain/catalogResolver.js` / `application/catalogResolver.js` | domínio/aplicação | texto → id por `nome_normalizado` | `buildNameIndex` (`:17`), `resolveNamesAgainst` (`:29`), `resolveMany` (`application:21`) |
| `src/modules/catalog/domain/normalize.js` e `src/storage/indexedDb/normalize.js` | puro | `normalizeName`, `situacaoFromExitReason` | `normalizeName` (`catalog:4`, `storage:13`), `situacaoFromExitReason` (`storage:35`), `isOpenSessionStatus` (`storage:48`) |
| `src/modules/settings/application/appConfigService.js` | aplicação | padrões operacionais e política de avisos | `OPERATIONAL_DEFAULTS` (`:26`), `WEIGHT_WARNING_POLICY_DEFAULTS` (`:42`) |
| `src/storage/indexedDb/schema.js` | storage | stores e índices v7 | `STORES_V7` (`:51-82`) |
| `src/storage/indexedDb/repositories/index.js` | storage | `weighing.listByPeriodo` | `:49-92` |
| `src/storage/indexedDb/health/health.js` | storage | integridade lógica (identificadores, órfãos) | `logicalIntegrity` (`:21`) |

**Não existem** hoje: serviço de `animais`, serviço de `animalIdentificadores`, serviço de `faixasIdentificadores`/`excecoesIdentificadores` (só as stores em `schema.js:78-79` e a contagem de uso em `masterRegistryService.js:36-43`, `:69`, `:74`). A "sequência de brincos" do Lançamento é UI pura (`src/components/pesagens/SequenciaBrincos.jsx:122`), sem vínculo com as faixas.

---

## 2. Dados envolvidos (schema v7)

| Store | Índices (`schema.js`) | Uso no domínio |
|---|---|---|
| `pesagens` | `++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, created_at, updated_at, deleted_at` (`:53-54`) | evento do animal. `id` **não é único** no índice (chave primária é `localId`). Colunas: `id, data_pesagem, peso_kg, lote_id, animal_id, tipo_pesagem, observacao, legacy_payload` (`weighingMapper.js:92-101`) + `sessao_id, created_by_user_id, updated_by_user_id, created_at, updated_at, deleted_at` (adapter `:305`). Todo o resto (tipo_manejo, motivo_saida, número, marca, sexo, derivados, categoria…) vive em `legacy_payload`. |
| `animais` | `++localId, &id, empresa_id, identificacao_normalizada, situacao, marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data, …` (`:59-60`) | registro canônico + projeção de estado |
| `animalIdentificadores` | `++localId, &id, animal_id, tipo, [tipo+valor_normalizado], [marca_id+valor_normalizado], faixa_id, ativo, …` (`:61-62`) | VISUAL criado no Cadastro/importação |
| `movimentosAnimais` | `… animal_id, tipo, data_evento, lote_origem_id, lote_destino_id …` (`:63`) | log append-only |
| `animalLotes` | `… animal_id, lote_id, inicio, fim …` (`:64`) | permanência animal×lote (projeção) |
| `sessoesPesagem` | `… data, [data+local], status, operador, operador_usuario_id …` (`:65`) | sessão automática por data |
| `auditoria` | `… entidade, entidade_id, acao, usuario_id, created_at` (`:66`) | trilha |
| `importacoes` | `… &arquivo_hash, status …` (`:67`) | idempotência por hash de arquivo |
| `categoriasAnimal` | `… nome_normalizado, ativo …` (`:73`) | faixas de peso por sexo |
| `marcas`, `racas`, `propriedades` | `… nome_normalizado, ativo …` (`:71-75`) | cadastros mestres |

Datas de evento são **datas civis** `YYYY-MM-DD` sem hora (`parseCivilDate`, `brazilianValues.js:42-61`). Não há hora de pesagem; a única informação de "ordem dentro do dia" é `created_at` (timestamp de gravação) e o `id`.

---

## 3. Contratos das funções canônicas

### 3.1 `calculateWeightGain({ history, date, weight })` — `weighingCalculations.js:13-35`

- Entrada: `history` = eventos do **mesmo animal** (quem chama filtra), cada um com `data_pesagem` e `peso`; `date` (usa só os 10 primeiros caracteres, `:1`); `weight`.
- Sem data ou peso não finito → todos `null` (`:16-18`).
- Anterior = eventos com `data_pesagem < date` (**estrito**) e `Number(peso)` finito, ordenados por data desc; pega `[0]` (`:20-22`).
- `dias = round((UTC(date) − UTC(dataAnterior)) / 86 400 000)` (`:30`); `ganho = round2(weight − pesoAnterior)` (`:31`); `gmd = dias > 0 ? round3(ganho / dias) : 0` (`:32`) — o GMD sai do **ganho já arredondado**.
- Sem anterior → todos `null` (`:24-26`).
- **Não** olha tipo de evento: quem chama decide se aplica (só Manejo).
- **Não** valida formato: `date` em `DD/MM/AAAA` quebra a comparação textual (`asIsoDate` só faz `slice(0,10)`).
- Ramo `gmd = 0` para `dias = 0` é inalcançável (mesmo dia é excluído) — pendência D1 dos docs F0.

### 3.2 `recalculateWeightSeries(entries, affectedKeys = null)` — `weighingSeries.js:10-46`

- Descarta `deleted_at` (`:12`); agrupa por `animalIdentityKey` = `id:<animal_id>` ou `legacy:<NÚMERO::MARCA>` (`:4`, `:48-50`); filtra pelos `affectedKeys` quando informado (`:14`).
- Ordena cada grupo por `data_pesagem`, depois `created_date || created_at`, depois `id` (`localeCompare`, `:5-8`).
- Percorre em ordem; para `tipo_manejo === 'Manejo'` chama `calculateWeightGain` com o histórico acumulado; para qualquer outro tipo grava os cinco campos `null` (`:26-28`).
- Todo evento com `Number(peso ?? peso_kg)` finito entra no histórico, **de qualquer tipo** (`:42`).
- Devolve **um update para cada evento do grupo** (`:36-41`), sem comparar com o valor atual: `{ id, localId, legacyPayload: {...viewModel, ...patch}, patch }`.
- Entrada esperada: **view models** (`storageRecordToViewModel`), porque usa `peso`, `tipo_manejo`, `created_date`.

### 3.3 `weighingMapper.js`

- `LEGACY_PAYLOAD_ALLOWLIST` (`:6-19`): chaves aceitas em `legacy_payload`. Inclui os derivados (`data_anterior, peso_anterior, dias, ganho, gmd`), `categoria_id, categoria_automatica`, `marca_id, raca_id, causa_morte_id, rendimento_origem`, `id_externo`, `origem`, `operador`, `sessao_id`.
- `LEGACY_PAYLOAD_FORBIDDEN` (`:23-25`): `_localId, peso_kg, created_date, updated_date, status_animal, sanidade_ids, sanidades`. Qualquer chave fora da allowlist é descartada (`filterLegacyPayload`, `:30-36`).
- `validateUiPayload(payload, { isUpdate })` (`:51-79`): data obrigatória na criação e nunca futura; peso > 0 obrigatório **exceto** `Saída` com motivo `Morte`/`Doação`/`Transferência` (`:59`, `:70`). **Não valida** `tipo_manejo` (nem enum nem presença) nem `motivo_saida`.
- `uiToStorageRecord(ui, { isUpdate, id })` (`:81-113`): colunas + `legacy_payload` filtrado; se `peso` não veio no payload mas há peso, copia `peso_kg` (`:90`). **Não** inclui `created_at` → o adapter sempre usa o timestamp da gravação.
- `storageRecordToViewModel(row)` (`:115-150`): espalha o payload e sobrepõe as colunas; `status_animal` é derivado do tipo (`Saída` → `Inativo`, `:146`); `created_date` = `legacy.created_date ?? row.created_at` (`:147`).

### 3.4 `weighingErrors.js`

`WeighingError(code, message, details)`; códigos `WEIGHING_MAP_001` (payload), `WEIGHING_LIST_001`, `WEIGHING_SAVE_001`, `WEIGHING_DELETE_001` (`:10-15`). As regras de cronologia e identidade do adapter lançam **`Error` genérico** (adapter `:173`, `:176`, `:181`, `:189`, `:330`, `:460`, `:480-482`, `:581-590`), que o service embrulha em `WEIGHING_SAVE_001` só em `createEntry`/`updateEntry` (service `:99-102`, `:212-215`); `bulkCreateEntries` e `bulkUpdateEntries` deixam o `Error` passar sem código.

### 3.5 `commercialCalculations.js`

`calculateCarcassTrade({ weight, yieldPercent, pricePerArroba })` (`:44-58`): sem rendimento válido (0,100], carcaça/arrobas/valor = `null`. Usado no Lançamento para gravar `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas` (`Lançamento:947-951`, `:1031-1034`). Não participa da série de peso.

### 3.6 `categorySuggestion.js`

`suggestCategory({ categorias, sexo, peso })` (`:48-50`): entre categorias ativas e não excluídas do sexo (`AMBOS` legado vale para os dois, `:19`), ordenadas por `ordem` e nome (`:38-40`), a primeira cuja faixa contém o peso; limites inclusivos, mínimo vazio = 0, máximo vazio = sem limite (`:26-34`); categoria sem nenhum limite **nunca** é automática (`:22-24`, `:28`). `eraOfCategory` devolve a era como texto ou `null` (`:53-56`). As categorias semeadas vêm **sem faixa** (`src/modules/catalog/domain/seeds.js:9-18`), então sem configuração a automática devolve `null`.

---

## 4. (a) Cronologia e ordenação

### 4.1 Regra de ordem vigente

Não há uma só. Há estas ordenações no código:

| # | Onde | Critério | Observação |
|---|---|---|---|
| O1 | `weighingSeries.js:5-8` (recálculo) | `data_pesagem` → `created_date \|\| created_at` → `id` | view model; `created_date` legado foi removido pelo backfill B10 (`v7Backfill.js:570-597`), então na prática é `created_at` |
| O2 | adapter `:27-30` (`eventOrder`) | `data_pesagem` → `created_at` → `id` | usado por cronologia, projeção de estado e estado inicial da importação |
| O3 | adapter `:266` (`rebuildAnimalLotProjection`) | igual O2 (inline) | |
| O4 | adapter `:550` (importação) | `data_pesagem` → `id` | **sem `created_at`**; todas as linhas do lote recebem o mesmo `created_at = ts` (`:610`), então dentro do mesmo dia a ordem é a do `id` (UUID aleatório quando o arquivo não traz id) |
| O5 | `calculateWeightGain` (`weighingCalculations.js:21-22`) | só `data_pesagem` desc | empate resolvido pela ordem de entrada (sort estável) |
| O6 | service `createEntry` (`:60-62`) | ordem do índice `animal_id` do Dexie = `localId` (inserção) | histórico que alimenta O5 na criação |
| O7 | `getRegisteredAnimals` (`animalHistory.js:23-25`, `:73-75`) | só `data_pesagem`; "último" = primeiro com data maior | |
| O8 | Lançamento `:877` (`ultimoRegistro`) | só `data_pesagem` desc | decide "animal inativo" na tela |
| O9 | Lançamento `:578-581` (`pesagensDia`) | `created_date` | numeração do dia |

`created_at` **não é atributo de negócio**: é o instante da gravação. O `uiToStorageRecord` não o repassa (`weighingMapper.js:92-101`) e o adapter usa `payload.created_at || ts` (`:305`, `:610`), então a importação não consegue preservar a ordem original de linhas do mesmo dia.

### 4.2 Desempate na mesma data

- **Na série (derivados):** eventos do mesmo dia **nunca** servem de referência entre si (`weighingCalculations.js:21`, filtro `<`). Para o próximo Manejo de data posterior, entre vários eventos no último dia anterior, `calculateWeightGain` escolhe o **primeiro na ordem de entrada** (sort estável sobre O1/O6): **o mais antigo gravado**, não o último. Consequência: uma "repesagem" gravada depois não vira referência — a primeira pesagem do dia vence.
- **Na projeção de estado:** `latest`, `latestExit` e `latestWeighed` usam O2 (adapter `:220-232`) → o **último gravado** vence (`ultimo_peso_kg` = peso da repesagem). Ou seja, projeção e série escolhem eventos diferentes no mesmo dia.
- **Na importação:** dentro do mesmo dia a ordem é por `id` (O4), inclusive entre tipos. Exemplo real: Manejo + Saída do mesmo animal na mesma data no mesmo arquivo. Se o UUID da Saída ordenar antes, o Manejo cai em `eventDate >= exitDate` e **o arquivo inteiro falha** (`:586-588`); se ordenar depois, passa. Resultado dependente de UUID aleatório.

### 4.3 Validações de cronologia (onde vivem)

`validateAnimalChronology(db, { animalId, data, ui, ignoredEntryId })` — adapter `:165-191`, só quando há `animalId` e data (`:166`):

| Regra | Código | Comparação |
|---|---|---|
| Cadastro duplicado | `:172-174` | existe outro Cadastro não excluído com o mesmo `animal_id` |
| Evento antes do Cadastro | `:175-177` | `data < dataCadastro` (mesma data é aceita) |
| Saída retroativa | `:178-183` | existe evento com `data_pesagem > data` (estrito) |
| Evento após Saída | `:184-190` | `data >= data da primeira Saída` (O2) — vale para **qualquer tipo**, inclusive outra Saída e inclusive a **edição** de um evento na mesma data da Saída |

Chamadas: `createEntry` (**fora da transação**, `:309`), `updateEntry` (**fora da transação**, `:402`), `bulkUpdateEntries` (dentro, `:720`). A importação tem cópia própria em memória (`:529-539`, `:577-595`) com as mesmas quatro regras.

Lacunas da regra (valem para todos os caminhos):
- **Cadastro depois de eventos existentes** não é verificado (nenhuma regra impede um Cadastro com data posterior a Manejos do mesmo `animal_id`). Também é possível **editar a data do Cadastro** para depois dos Manejos (`:402` exclui o próprio registro; não há verificação de "Cadastro ≤ primeiro evento").
- Um Manejo na **mesma data** de uma Saída não pode mais ser **editado** (nem a observação): `data >= exitDate` (`:187`).
- Sem `animal_id`, nenhuma regra roda (`:166`).

---

## 5. (b) Peso anterior, data anterior, dias, ganho e GMD

### 5.1 Onde são calculados

| Caminho | Cálculo | Persistência | Recompõe posteriores? |
|---|---|---|---|
| Lançamento (tela) | `calculateWeightGain` com `getAnimalHistory(pesagens, cadastro)` (`Lançamento:910-916`) e envia no payload (`:1048-1052`) | **descartado**: o service recalcula e sobrescreve (service `:70-77`) | — |
| `weighingService.createEntry` | `calculateWeightGain` com a série lida por `animal_id` **antes** da gravação (`:59-69`); só para `tipo_manejo === 'Manejo'` | no `legacy_payload` do novo registro (`:78-79`) | só se existe evento com data **estritamente maior** (`:81-88`) → `recalculateWeightSeriesForKeys({id:<animal>})` |
| `weighingService.updateEntry` | não calcula direto | — | sempre recompõe o(s) animal(is) antigo e novo (`:208-210`) |
| `weighingService.deleteEntry` | — | — | recompõe o animal (`:225`) |
| `weighingService.bulkCreateEntries` (importação) | **não calcula**; a Relação manda os derivados `null` (`PesagensIndividuais.jsx:408-414`) | `null` até o recálculo | `recalculateAllWeightSeries()` depois do commit (`:113`) |
| `bulkUpdateEntries` / `bulkDeleteEntries` | — | — | `recalculateAllWeightSeries()` quando `recalculate` (`:133`, `:140`) |
| Prévia visual | `buildWeightPreview` (`src/components/pesagens/weightPreview.js:6-30`) → `calculateWeightGain` com filtro próprio `peso > 0` (`:11`) | não persiste | — |
| Avisos | `evaluateWeighingWarnings` (`weighingWarnings.js:38-57`) → `calculateWeightGain` | `alertas_confirmados` (`Lançamento:1011`) | — |

As **mesmas funções puras** (`calculateWeightGain`, `recalculateWeightSeries`) servem lançamento e importação. A diferença está na entrada: `createEntry` usa ordem de inserção (O6), o recálculo usa O1. Em dados normais o resultado é igual; divergem só quando há vários eventos no mesmo dia anterior com `created_at` fora da ordem de inserção.

### 5.2 Quais tipos entram na série

| Tipo | Recebe derivados? | Entra como referência (histórico)? |
|---|---|---|
| **Cadastro** | não — grava `null` nos cinco campos (`weighingSeries.js:26-28`; service `:63-69`) | **sim**, se tiver peso (`weighingSeries.js:42`). O primeiro Manejo calcula ganho contra o peso do Cadastro. |
| **Manejo** | **sim** (única fonte de ganho/GMD) | sim |
| **Saída com peso** (Venda/Abate) | não (`null`) — pendência D2 dos docs F0 | sim, mas como nada pode vir depois da Saída (`adapter:184-190`), nunca é usada na prática |
| **Saída sem peso** (Morte/Doação/Transferência) | não | **deveria não entrar, mas entra com peso 0** — ver 5.3 |
| Tipo desconhecido (ex.: `'MANEJO'`, vazio) | não (comparação exata `=== 'Manejo'`) | sim, se tiver peso |

A comparação é de string exata. `validateUiPayload` não valida o enum, então uma importação JSON (`src/storage/indexedDb/backup/backupService.js:328-355`) com outra grafia grava o evento sem derivados e fora de todas as regras de Cadastro/Saída.

### 5.3 Eventos sem peso

- Só Saída por Morte/Doação/Transferência pode não ter peso (`weighingMapper.js:59`; `Lançamento:810-815`; `health.js:60-61`). A importação CSV **exige peso > 0 em toda linha**, inclusive Saída por Morte (`PesagensIndividuais.jsx:422-425`).
- **Bug latente de coerção:** o Lançamento envia `peso: null` (`Lançamento:1009`); `filterLegacyPayload` mantém a chave com `null`; o view model devolve `peso: null` (`weighingMapper.js:139`). `Number(null) === 0` é finito, então a Saída sem peso **entra no histórico com peso 0** (`weighingSeries.js:42`) e passa no filtro de `calculateWeightGain` (`weighingCalculations.js:21`). Hoje não aparece porque nada pode vir depois da Saída. Qualquer reconstrução que permita eventos após uma Saída sem peso (reversão, importação de histórico com erro) vai gerar `peso_anterior = 0`. O adapter tem a semântica correta em `weightOf` (`adapter:210-213`: `null` quando ausente ou ≤ 0), mas o domínio puro não usa essa função.
- Na projeção, eventos sem peso não zeram `ultimo_peso_kg` nem a categoria (`adapter:231-243`; gate `verify-category-projection.mjs:31-39`).

### 5.4 Onde os derivados ficam gravados

Dentro de `legacy_payload` (allowlist `weighingMapper.js:9-10`). O recálculo **também grava os cinco campos no nível superior da linha** (`adapter:691-696` espalha `item.patch`), criando cópias soltas que o view model ignora. Consumidores dos valores persistidos: pendência "GMD negativo" (`closingPendencies.js:23`), relatórios (GMD ponderado etc.).

---

## 6. (c) Duplicidade e repesagem na mesma data

| Camada | Política atual |
|---|---|
| Domínio puro | nenhuma. Mesmo dia só é excluído como referência (§4.2). |
| Service | nenhuma. |
| Adapter `createEntry` | só `id` duplicado: `Pesagem duplicada (<id>)` (`:330`). Nenhuma verificação de animal+data. |
| Adapter `bulkCreateEntries` | `id` duplicado no lote ou já existente (`:477-484`); arquivo repetido pelo **hash** (`:457-462`, `importacoes.&arquivo_hash`). Nenhuma verificação de animal+data nem de conteúdo (`id_externo` está na allowlist mas nunca é usado para deduplicar; a coluna `id` do CSV é mapeada e ignorada, `PesagensIndividuais.jsx:370`). |
| Tela do Lançamento | bloqueia **qualquer** segundo lançamento do mesmo animal na data selecionada, de **qualquer tipo** (`Lançamento:868-875`) — inclusive uma Saída no mesmo dia de um Manejo. Não vale para edição nem para SN. |
| Integridade (`health.js`) | não verifica. |

Não existe o conceito de "repesagem". O desenho antigo pedia `substitui_pesagem_id` (`docs/evidence/auditoria-master-produto-pecuario/WEIGHING-DOMAIN-MODEL.md:55`); **nada disso está implementado**. Se hoje entrarem duas pesagens no mesmo dia (importação, chamada direta ao service), a série usa a **primeira** como referência e a projeção usa a **última** (§4.2).

---

## 7. (d) "Um Cadastro por animal"

| Caminho | Validação | Chave |
|---|---|---|
| `createEntry` / `updateEntry` / `bulkUpdateEntries` | `validateAnimalChronology` (`adapter:172-174`) | **`animal_id`** |
| Importação | `chronology.registrationDate` (`adapter:580-582`) | `animal_id` resolvido por número+marca (§9.3) |
| Tela do Lançamento | "já cadastrado" se **qualquer** pesagem com o mesmo número+marca normalizados existe (`Lançamento:864-866`, `:883-887`) | texto `NÚMERO` + `MARCA` (trim+maiúsculas), inclusive de animais que já saíram |
| `health.js` | **não verifica** um Cadastro por animal | — |

Buracos:
1. **Cadastro sem `animal_id`** recebe UUID novo no adapter (`:303`); nenhuma verificação por identidade. Quem chama o service direto (gates, `src/modules/perf/baselineBench.js:204`, futura importação) cria um segundo animal com o mesmo número+marca.
2. **Animal criado pela importação a partir de Manejo/Saída não tem Cadastro**; um Cadastro importado depois para o mesmo número+marca é aceito (`registrationDate` nulo), com data possivelmente **posterior** aos Manejos.
3. **Cadastro excluído sem histórico** (`buildDeletionPlan`, `animalHistory.js:121-141`) só marca a pesagem como excluída (`adapter:765`). O registro em `animais` e o identificador VISUAL **continuam ativos**. Como a tela olha só as pesagens, permite um novo Cadastro com o mesmo número+marca → dois `animais` e dois VISUAL ativos na mesma marca (`health.js:97-100` acusa). A importação passa a resolver para qualquer um dos dois (§9.3).
4. Dentro de **um mesmo arquivo**, dois Cadastros do mesmo número+marca → o segundo falha e **aborta o arquivo inteiro** (`:580-582`; transação `:456`).

---

## 8. (e) Manejo antes do Cadastro, evento após Saída, Saída retroativa

| Situação | `createEntry` | `updateEntry` / `bulkUpdateEntries` | Importação | Tela do Lançamento |
|---|---|---|---|---|
| Manejo com data < Cadastro (mesmo `animal_id`) | recusa (`:175-177`) | recusa | recusa só se o Cadastro já foi processado (`:583-585`) | — |
| Manejo e **depois** Cadastro com data posterior (animal novo no arquivo) | n/a | n/a | **aceita**: ordena por data (`:550`); o Manejo cria o animal (`:556-574`) e o Cadastro não é comparado com eventos anteriores | — |
| Manejo/Saída de animal **inexistente** | **aceita com `animal_id = null`** (`:303`): nenhum animal, nenhuma projeção, derivados `null` | — | **cria o animal** com o tipo da linha (situação pela Saída, `:566`), sem Cadastro | recusa: "Animal não cadastrado. Faça o Cadastro antes…" (`:376-379`, `:853-857`), exceto SN |
| Evento em data ≥ Saída | recusa (`:184-190`) | recusa (inclusive editar evento da mesma data) | recusa (`:586-588`) | recusa pela `status_animal` do último por data (`:877-882`) |
| Saída com eventos posteriores | recusa (`:178-183`) | recusa | recusa (`:589-591`) | — |
| Evento no mesmo dia da Saída | aceito **antes** da Saída; depois dela, recusado (`>=`) | edição recusada | depende da ordem por `id` (§4.2) | tela recusa segundo lançamento do dia (`:868-875`) |

**SN:** para número "SN", a tela gera `animal_id` novo a cada lançamento, qualquer que seja o tipo (`Lançamento:956`). Em Manejo/Saída, o adapter não cria `animais` (só Cadastro cria, `:336-345`) → pesagem e `animalLotes` com `animal_id` órfão (`health.js:62`, `:113` acusam).

**Beco sem saída para animais importados sem Cadastro:** o Lançamento só reconhece animais que têm pesagem de Cadastro (`getRegisteredAnimals` filtra `tipo_manejo === 'Cadastro'`, `animalHistory.js:23-25`; índice `Lançamento:203-204`). Um animal criado pela importação de Manejos não aparece na busca (`:365-380`), e o Cadastro manual é bloqueado porque já existem pesagens com o mesmo número+marca (`:883-887`).

---

## 9. (f) Identidade canônica do animal

### 9.1 O que existe no modelo

- `animais.id` (UUID) é o `animal_id` canônico (`schema.js:59-60`).
- `animais.identificacao_normalizada` = número com trim+maiúsculas (`adapter:120`, `:418`).
- `animalIdentificadores`: VISUAL com `valor_normalizado` = só o número e `marca_id` (`adapter:144-163`; B8 converteu o legado `NÚMERO::MARCA`, `v7Backfill.js:541-567`). Índices `[tipo+valor_normalizado]` e `[marca_id+valor_normalizado]` (`schema.js:62`).
- Unicidade declarada: VISUAL ativo único por `(marca_id, valor_normalizado)`; demais por `(tipo, valor)` — **só como diagnóstico** em `health.js:87-104`, não como bloqueio na gravação.

### 9.2 Onde a identidade é resolvida hoje

| Onde | Chave | Fonte | Ambiguidade | Inativos |
|---|---|---|---|---|
| **Lançamento (tela)** | só **número** (`buildAnimalLookupIndex.byNumber`, `animalHistory.js:93-109`); se houver mais de uma marca, abre escolha (`Lançamento:365-375`) | **pesagens de Cadastro** carregadas da base inteira (`Lançamento:203`, `:533-554`), não `animais` nem identificadores | detectada e resolvida pelo operador | incluídos (bloqueados depois por `status_animal`, `:878`) |
| **Service/adapter `createEntry`** | nenhuma resolução: confia em `payload.animal_id`; Cadastro sem id → UUID novo (`adapter:303`) | — | — | — |
| **Importação (adapter)** | `animal_id` do payload → `ui.animal_id` → mapa `NÚMERO::MARCA` (`adapter:553-554`) | mapa montado de `animalIdentificadores` ativos (VISUAL com `marca_id` → nome atual da marca; senão `valor_normalizado` puro) **e** de `animais` (`numero_animal \|\| identificacao_normalizada` :: `animal.marca` em texto) (`:508-523`) | **não detecta**: `Map.set` sobrescreve, o último vence (`:519`, `:522`) | incluídos: um número reaproveitado casa com o animal que já saiu e o arquivo falha com "já possui saída" |
| **Série (`weighingSeries`)** | `id:<animal_id>` ou `legacy:<NÚMERO::MARCA>` (`weighingSeries.js:4`) | pesagem | — | — |
| **UI legada (`sameAnimal`)** | ids quando os dois têm; se um não tem, cai para `NÚMERO::MARCA` (`animalHistory.js:10-15`) | pesagem | — | — |
| **Relatórios** | `NÚMERO::MARCA` com o nome atual da marca por `marca_id` (`src/modules/reporting/infrastructure/reportSources/eventRows.js:47-58`) | `animais` | **remove** chaves ambíguas | incluídos |

Os índices compostos de identificador **não são usados** para resolver animal em nenhum ponto (só `countByBrandIndex`, `masterRegistryService.js:36-43`).

### 9.3 Normalizações diferentes da "mesma" chave

| Função | Regra | Onde |
|---|---|---|
| `normalized` (adapter) | `trim` + `toUpperCase()` | `adapter:36` (importação, `identificacao_normalizada`, `valor_normalizado`) |
| `normalizeAnimalText` | `trim` + `toUpperCase()` | `animalHistory.js:1` |
| `normalizeAnimalIdentifier` | `toLocaleUpperCase('pt-BR')`, **sem trim** | `snAnimal.js:3-4` (número digitado e CSV, `PesagensIndividuais.jsx:399`) |
| `normalizeName` | `trim` + `toLocaleUpperCase('pt-BR')` + espaços internos únicos | `catalog/domain/normalize.js:4-9`, `storage/indexedDb/normalize.js:13-15` (marcas/raças) |
| `normalizeText` (relatórios) | sem acento + minúsculas + espaços únicos | `src/modules/reporting/domain/filterEngine.js:59-64` |

Consequências: "12  A" (dois espaços) casa com "12 A" nos cadastros mestres e nos relatórios, mas **não** na importação nem no Lançamento. A marca entra na chave como **texto do evento** (`ui.marca`), não como `marca_id`, embora a Relação já resolva `marca_id` antes de importar (`importRegistryResolution.js:57-98`). O adapter da importação ignora `ui.marca_id` e resolve de novo pelo texto (`adapter:558`). O `createEntry`, ao contrário, prefere `ui.marca_id` (`:339`).

### 9.4 Troca de número/marca

`updateEntry` de um Cadastro atualiza `animais.numero_animal`, `identificacao_normalizada`, `marca_id`, `raca_id` e sexo (`adapter:411-429`), mas **não mexe em `animalIdentificadores`** (a store nem está na transação, `:403`). O VISUAL antigo continua ativo com o número antigo, sem `fim` nem `motivo_troca`. Na importação, o número antigo (via identificador) e o novo (via `animais`) passam a resolver para o mesmo animal. `propagateAnimalProfile` só grava `animal_id` em pesagens legadas sem id (`animalHistoryService.js:4-14`) e não reescreve o snapshot histórico (gate `verify-animal-history-integrity.mjs:97-100`).

### 9.5 Criação do animal

- **Lançamento/Cadastro** (`adapter:336-345`), só se `animais` ainda não tem o id: marca = `existingRegistryId(ui.marca_id)` → texto via `resolveRegistryId` com fallback para a marca `padrao` (`:339`, `:54-63`); raça = id → texto, sem padrão (`:340`); propriedade = `propriedades.padrao === true` (`:341`); `newAnimal` (`:116-142`) com `situacao: 'ATIVO'`, `categoria_automatica = ui.categoria_automatica !== false` (`:132`); identificador VISUAL com `inicio = data do Cadastro` (`:343`). Se `animais` já existe (ex.: criado pela importação), o Cadastro **não** atualiza o perfil nem cria identificador.
- **Importação** (`adapter:556-574`): qualquer tipo; marca/raça pelo texto (`resolveInBatch`, `:496-506`), marca padrão por `padrao === true` (`:492`); `origem: 'importacao'`; situação derivada da Saída se a primeira linha for Saída (`:566`).
- **Criação silenciosa de cadastro mestre:** `resolveRegistryId` e `resolveInBatch` **inserem** marca/raça desconhecida direto na store, sem `registry.write`, sem `assertUnique` por empresa e sem auditoria (`adapter:40-45`, `:60-62`, `:501-503`, `:640-641`). A Relação CSV evita isso filtrando as linhas antes (`PesagensIndividuais.jsx:447-451`); a importação JSON de manutenção não filtra (`backupService.js:338-352`). O comentário do Lançamento diz que o adapter "recusa marca/raça não cadastradas (MARCA_NAO_CADASTRADA/RACA_NAO_CADASTRADA)" (`Lançamento:1003-1004`), mas **esses códigos não existem**.
- **Padrão de marca/propriedade com duas fontes:** a tela usa `operational-defaults.marca_padrao_id` com fallback para `padrao` (`operationalPolicies.js:102-109`, `Lançamento:310-311`); o adapter usa só a flag `padrao` (`:47-50`, `:492-493`). `propriedade_padrao_id` da configuração (`appConfigService.js:29`, com texto de ajuda que promete uso no Lançamento em `src/pages/Configuracoes.jsx:34`) **não é lido pelo adapter**.
- O campo `nome` do animal vem de `ui.nome_animal` (`:122`), chave fora da allowlist → sempre `null`.

---

## 10. (g) Categoria automática por peso

### 10.1 Regra e dados

Faixas em `categoriasAnimal` (`registryDefinitions.js:200-238`: `sexo_aplicavel` M/F obrigatório, `peso_min_kg`, `peso_max_kg`, `era` inteiro, `ordem`). Seleção: `suggestCategory` (§3.6). O adapter lê `categoriasAnimal.toArray()` **sem filtro de empresa** (`:201`, `:235`).

`animais.categoria_automatica`: `true` salvo escolha manual (`adapter:132`; backfill B7 põe `true` nos existentes, `v7Backfill.js:521-522`).

### 10.2 Onde é aplicada HOJE

| Operação | Carimbo na pesagem (`stampAutomaticCategory`, `:197-207`) | Projeção no animal (`rebuildAnimalStateProjection`, `:232-243`) |
|---|---|---|
| Cadastro (`createEntry`) | sim, com `ui.sexo` e `ui.categoria_automatica` (`:332-333`) | sim |
| **Manejo (`createEntry`)** | **sim**, se o animal existe e é automático (`:331`, `:334`) → grava `categoria_id` **e sobrescreve `era`** do evento | **sim**: categoria e era pelo **último evento com peso por data**, de qualquer tipo |
| Saída com peso | sim | sim |
| Saída sem peso | herda `categoria_id` atual do animal (`:203`) | preserva a última válida (`:237-238`) |
| `updateEntry` | sim (re-carimba o evento editado, `:407-409`) | sim |
| `bulkUpdateEntries` (edição coletiva) | **não** | sim (`:748`) |
| `bulkDeleteEntries` | — | sim → excluir o Manejo volta a categoria pelo peso anterior (gate `verify-animal-history-integrity.mjs:138-140`) |
| **Importação** (`bulkCreateEntries`) | **não carimba nenhuma pesagem** | sim, para cada animal afetado (`:650`) |
| Recálculo de série (`systemDerived`) | não | não |

Peso fora de todas as faixas: pesagem e animal mantêm a última categoria válida (`:203`, `:237-238`; gate `verify-category-projection.mjs:47-51`). Categoria manual (`categoria_automatica === false`) nunca é recalculada (`:199`, `:234`; gates `verify-animal-history-integrity.mjs:142-146`, `verify-category-projection.mjs:53-56`).

Edição do Cadastro grava `animais.categoria_id = ui.categoria_id ?? atual` (`:425`), mas a projeção roda logo depois (`:433`) e, se o animal é automático, **sobrescreve** com a categoria do último evento com peso.

### 10.3 Divergência com a missão

A regra da missão "Manejo NÃO muda categoria automaticamente por peso" **contradiz o código, os comentários, os gates e a decisão registrada em 16/09**:
- adapter `:131` ("o Manejo recalcula pelo peso"), `:197-207`, `:232-243`;
- Lançamento `:977` ("o gravador recalcula categoria e era pelo peso desta pesagem");
- `scripts/verify-animal-history-integrity.mjs:109-110`, `:131-136` ("Manejo recalcula: passou de 350 kg → Garrote");
- `scripts/verify-category-projection.mjs:26-29`, `:49-51`;
- nota de memória `pesagens-categoria-por-peso` de 16/09/2026: "Manejo reclassifica o animal automático pelo novo peso".

Para a regra nova valer, é preciso mudar **as duas** funções (carimbo e projeção; hoje a projeção usa `latestWeighed` de qualquer tipo) e **inverter os dois gates**. Também é preciso decidir o que a projeção usa quando o animal automático não tem peso de Cadastro, e se `era` no snapshot do Manejo continua vindo da categoria (hoje é sobrescrita, `:206`).

---

## 11. (h) Custo de recálculo

### 11.1 `recalculateAllWeightSeries` recalcula a base inteira?

**Sim.** `recalculateAllWeightSeries()` → `recalculateWeightSeriesForKeys(null)` (service `:144-146`) → `listEntries()` → `listAllEntries({})` → `table.toArray()` + view model de **todas** as pesagens (`repositories/index.js:76-77`; adapter `:787-790`) → `recalculateWeightSeries` devolve um update para **cada** pesagem não excluída (`weighingSeries.js:36-41`, sem comparar valores) → o adapter faz `table.update` **linha a linha** numa transação única (`adapter:703-707`), regravando `legacy_payload` inteiro, os cinco campos no nível superior e `updated_at` em **todas as linhas**.

Custo: leitura O(N) + mapeamento O(N) + **N escritas** + ordenação O(Σ k log k). `updated_at` deixa de indicar alteração real. Sem auditoria (`audit: false`). Se `listEntries` falhar, o erro é engolido e o recálculo vira no-op silencioso (service `:243-245`).

Quem dispara o recálculo total:

| Chamador | Linha |
|---|---|
| `bulkCreateEntries` (toda importação CSV/JSON) | service `:113` |
| `bulkUpdateEntries` com `recalculate: true` (padrão) — "Editar lote" da Relação | service `:133`; `PesagensIndividuais.jsx:644` |
| `bulkDeleteEntries` com `recalculate: true` (padrão) | service `:140` |
| `deleteEntriesRespectingHistory` → **exclusão pela Relação e pelo Lançamento** | `animalHistoryService.js:22`; `Lançamento:1099`; `PesagensIndividuais.jsx:593` |
| Qualquer chave `legacy:` (registro sem `animal_id`) em `recalculateWeightSeriesForKeys` | service `:160`, `:167-168` |

### 11.2 O que existe para um animal só

- `recalculateWeightSeriesForKeys(new Set(['id:<animal_id>']))` — **privada** (service `:148`, não exportada). Lê só pelo índice `animal_id` (`:169-172`) e regrava as k pesagens do animal. Usada por `createEntry` retroativo (`:87`), `updateEntry` (`:210`) e `deleteEntry` (`:225`).
- `recalculateWeightSeries(entries, affectedKeys)` — pura, exportada (`weighingSeries.js:10`).
- `rebuildAnimalStateProjection(db, animalId)` e `rebuildAnimalLotProjection(db, animalId)` — **privadas** do adapter (`:215`, `:260`), exigem transação aberta com as stores certas.
- **Não existe** um orquestrador público "reconstruir animal X" (série + estado + lotes + movimentos) nem reconstrução de `movimentosAnimais`.

### 11.3 Custo de um `createEntry` normal

Leituras da série do animal: service `:61` (fora da transação), `validateAnimalChronology` `:167` (fora), verificação de retroativo `:375`, projeção `:219`; mais `categoriasAnimal.toArray()` até 2× (`:201`, `:235`), `animalLotes` do animal (`:347`, `:226`), sessões da data (`:319`) e `getEntryById` (service `:90`). Retroativo soma o recálculo do animal (k escritas) e `rebuildAnimalLotProjection`. `updateEntry` **sempre** reconstrói lotes (`:431`): marca como excluídas todas as linhas de `animalLotes` do animal e insere novas com ids novos (`:267-268`, `:280`, `:284`), então linhas excluídas se acumulam a cada edição. O Lançamento também carrega **a base inteira** em memória para resolver identidade (`Lançamento:533-554`).

---

## 12. (i) Stores tocadas e transações

| Operação | Transação Dexie (`rw`) | Stores gravadas | Fora da transação |
|---|---|---|---|
| `adapter.createEntry` (`:311-389`) | **uma**: `pesagens, auditoria, sessoesPesagem, animalLotes, categoriasAnimal` + `animais, movimentosAnimais` (com `animalId`) + `animalIdentificadores, marcas, racas, propriedades` (Cadastro) | `sessoesPesagem` (se não há aberta na data), `pesagens`, `animais` (novo e/ou projeção), `animalIdentificadores` (Cadastro novo), `marcas`/`racas` (criação silenciosa), `animalLotes` (fecha/abre/reconstrói), `movimentosAnimais`, `auditoria` | `validateAnimalChronology` (`:309`); no service: leitura da série (`:61`), **recálculo da série em outra transação** (`:87`), `getEntryById` (`:90`) |
| `adapter.updateEntry` (`:403-434`) | **uma**: `pesagens, animais, animalLotes, auditoria, marcas, racas, categoriasAnimal` | `pesagens`, `animais` (perfil no Cadastro + projeção), `marcas`/`racas`, `animalLotes` (reconstrução total), `auditoria` | validação (`:402`); recálculo no service (`:210`). **Não toca** `animalIdentificadores`, `movimentosAnimais`, `sessoesPesagem` (mudar a data mantém o `sessao_id` da data antiga) |
| `adapter.bulkCreateEntries` (`:450-664`) | **uma** com 12 stores: `pesagens, animais, animalIdentificadores, movimentosAnimais, animalLotes, sessoesPesagem, auditoria, importacoes, marcas, racas, propriedades, categoriasAnimal` | todas menos `propriedades`/`categoriasAnimal` (lidas) | **recálculo total** em outra transação (service `:113`). O registro `importacoes` com `status: 'CONCLUIDA'` é gravado **antes** do recálculo. Se o recálculo falhar, a importação fica com derivados `null` e o hash bloqueia a reimportação. |
| `adapter.bulkUpdateEntries` normal (`:713-749`) | **uma**: `pesagens, animais, animalLotes, auditoria, categoriasAnimal` | `pesagens`, `animalLotes` (só se animal/data/lote/tipo/apartação mudou, `:724-733`), `animais` (projeção), `auditoria` | recálculo total no service (`:133`) |
| `adapter.bulkUpdateEntries` `systemDerived` (`:673-709`) | **uma**: `pesagens` | `pesagens` | — |
| `adapter.bulkDeleteEntries` (`:759-773`) | **uma**: `pesagens, animais, animalLotes, auditoria, categoriasAnimal` | `pesagens` (exclusão lógica), `animalLotes` (reconstrução), `animais` (projeção), `auditoria` | recálculo (service `:140` ou `:225`). **Não toca** `movimentosAnimais`, `animais.deleted_at` nem identificadores |

Toda escrita passa por `storage.assertWritable` (bloqueio de migração): adapter `:298`, `:394`, `:446`, `:670`, `:754`.

---

## 13. (j) Projeções

### 13.1 `animais` — `rebuildAnimalStateProjection(db, animalId, ts)` (`adapter:215-258`)

Lê o animal (sai se não existe ou está excluído, `:217-218`) e todas as pesagens ativas dele em O2. Grava:
- `categoria_id`, `era`: só se automático e existe evento com peso (§10);
- `situacao`: `situacaoFromExitReason(motivo)` se existe **qualquer** Saída (`:224`, `:230`, `:247`) — Venda→VENDIDO, Abate→ABATIDO, Morte→MORTO, Doação→DOADO, Transferência→TRANSFERIDO, outro→INATIVO (`storage/indexedDb/normalize.js:19-38`); sem Saída → `ATIVO`;
- `data_saida`, `motivo_saida` (`:248-249`);
- `ultima_pesagem_data` (último com peso; senão último evento) e `ultimo_peso_kg` (`:250-251`);
- `lote_atual_id` / `apartacao_atual_id`: `null` se inativo; senão lote aberto de `animalLotes` com maior `inicio`, fallback para `lote_id`/`apartacao_id` do último evento (`:226-229`, `:252-253`).

**Não** atualiza número, marca, sexo, raça (só `updateEntry` do Cadastro, `:411-429`). Chamada por `createEntry` (`:388`), `updateEntry` (`:433`), `bulkCreateEntries` (`:650`), `bulkUpdateEntries` (`:748`), `bulkDeleteEntries` (`:771`). Cancelar a Saída devolve `ATIVO` (gate `verify-enterprise-hardening.mjs:77-79`).

### 13.2 `animalLotes`

- **Incremental** em `createEntry` (`:346-356`): Saída fecha o lote aberto (`fim = data`); evento com `lote_id` diferente do aberto fecha o atual e abre outro (`origem: 'lancamento'`).
- **Reconstrução** `rebuildAnimalLotProjection` (`:260-286`): marca como excluídas **todas** as linhas do animal (inclusive as de outras origens) e recria a partir das pesagens em O3: evento com `lote_id` diferente abre período; Saída fecha; evento sem `lote_id` não fecha; troca só de apartação não abre período; `origem: 'projecao'`. Chamada: `createEntry` só se há evento posterior (`:374-378`), `updateEntry` sempre (`:431`), `bulkUpdateEntries` condicional (`:747`), `bulkDeleteEntries` sempre (`:770`).
- **Importação: só incremental** (`:616-631`), **sem reconstrução**. Uma linha retroativa com lote diferente fecha o lote aberto com `fim` **anterior** ao `inicio` e vira lote atual (`health.js:116` acusa "fim anterior ao início"). O gate só cobre o retroativo no `createEntry` (`verify-category-projection.mjs:63-70`).
- Quem lê: relatórios operacionais (`src/modules/reporting/infrastructure/reportSources/controlSources.js:61-75`).

### 13.3 `movimentosAnimais`

- Só append em `createEntry` (`:357-371`) e na importação (`:632-636`). Tipos: `Entrada` (Cadastro), `motivo_saida || 'Saída'` (Saída), `Mudança de lote` (lote mudou **e** havia lote aberto).
- **Nunca** é atualizado nem cancelado por `updateEntry`, `bulkUpdateEntries` ou `bulkDeleteEntries`. Excluir uma Saída deixa o movimento "Venda/Morte" ativo, apontando para pesagem excluída (`health.js:108` acusa `pesagem_id órfão`). O relatório já trata a store como não confiável (`operacional.js:95`).
- Em `createEntry` retroativo, `lote_origem_id` é o lote **atual**, não o da data do evento (`:364`).
- Animal criado pela importação a partir de Manejo não recebe `Entrada`.

### 13.4 `sessoesPesagem`

`createEntry` procura sessão **aberta** da data; se só existe fechada, cria **outra** aberta na mesma data (`:318-329`; C-05 do registro de contradições, ainda válido). A importação usa um `Map` data→sessão aberta (`:525-526`, `:597-602`). `closeWeighingDay` só muda o status (`operationalInsightsService.js:16-36`); nenhuma gravação é bloqueada por sessão fechada.

---

## 14. (k) Auditoria de pesagem

| Operação | `acao` | Conteúdo | `origem` | Linha |
|---|---|---|---|---|
| `createEntry` | `CRIAR` | `depois` = registro completo | `ui.origem \|\| 'manual'` | adapter `:379-387` |
| `updateEntry` | `ATUALIZAR` | `antes` e `depois` completos | `'manual'` | `:432` |
| `bulkUpdateEntries` (`audit: true`) | `ATUALIZAR` | `resumo` + `campos_alterados` (inclui `legacy_payload.<chave>`) | `'edicao-coletiva'` | `:734-744`, `changedFields` `:78-94` |
| Recálculo (`systemDerived`) | — | **sem auditoria** | `'recalculo-automatico'` (só no parâmetro) | service `:181-185` |
| `bulkDeleteEntries` | `CANCELAR` | `antes` completo, `motivo: 'Exclusão lógica pela interface'` | — | `:766` |
| Importação | `CRIAR` por linha | `depois` completo | `'importacao'` | `:637` |

Ator: `auditRow` espalha `getActor()` → `usuario_id`, `usuario_nome_snapshot` (`adapter:73-75`; `auditActor.js:33-40`). A pesagem também guarda `created_by_user_id`/`updated_by_user_id` (`:305`, `:400`, `:608-609`, `:718`).

**Sem auditoria:** criação de `animais`, `animalIdentificadores`, `movimentosAnimais`, `animalLotes`, `sessoesPesagem`, `importacoes`; marcas/raças criadas de passagem; mudanças de projeção (categoria, situação); recálculo de derivados. A auditoria de cadastros mestres feita pelo serviço próprio (`masterRegistryService.js:209-222`) não é usada pelo adapter.

Permissões no service: `weighing.write` para criar/importar e `weighing.edit` para editar/excluir (service `:16-24`, `:54`, `:106`, `:118`, `:138`, `:200`, `:219`); valores comerciais digitados são removidos sem `commercial.write` (`:28-35`). Matriz: ADMIN/GESTOR/OPERADOR podem gravar pesagem; só ADMIN/GESTOR têm `registry.write` (`src/modules/auth/domain/permissionService.js:21-28`). `recalculateAllWeightSeries` é exportada sem verificação de permissão.

---

## 15. Configurações que o domínio lê

| Chave (`appSettings`) | Campos | Consumidor | Observação |
|---|---|---|---|
| `operational-defaults:<empresa>` | `marca_padrao_id`, `raca_padrao_id`, `propriedade_padrao_id`, `apartacao_padrao_id`, `intervalo_pesagem_dias` (30), `rendimento_padrao` (null), `rendimento_padrao_origem` (`appConfigService.js:26-36`) | tela do Lançamento via `loadOperationalPolicies` (`operationalPolicies.js:82-96`) | o adapter **não lê**; usa a flag `padrao` das stores (§9.5) |
| `weight-warning-policy:<empresa>` | `faixa_peso_min` 20, `faixa_peso_max` 1500, `limite_gmd_alerta` 5, `variacao_max_percent` 35 (`:42-47`) | `evaluateWeighingWarnings` na tela | não é aplicada no service nem na importação |
| `sales-policy:<empresa>` | `exigir_documento_venda` | tela (`Lançamento:826-833`) e pendências (`closingPendencies.js:9-14`) | não é aplicada no service |

---

## 16. Divergências explícitas com as regras da missão

| Regra da missão | Código atual | Evidência | O que precisa mudar (sem implementar) |
|---|---|---|---|
| **Manejo NÃO muda categoria automaticamente por peso** | Manejo (e Saída com peso, e edição) carimba categoria/era na pesagem e a projeção reclassifica o animal pelo último evento com peso | adapter `:131`, `:197-207`, `:331-334`, `:407-409`, `:232-243`; Lançamento `:977`; gates `verify-animal-history-integrity.mjs:131-140`, `verify-category-projection.mjs:26-29`, `:47-51`; memória de 16/09 | carimbo só no Cadastro; projeção pela categoria do Cadastro (ou manual); inverter os dois gates; decidir `era` no snapshot do Manejo; a importação deve seguir a mesma regra (hoje não carimba nada e reclassifica pela projeção) |
| **Evento mais antigo de animal inexistente = Cadastro** | `createEntry` aceita Manejo/Saída sem `animal_id` (`:303`); a importação cria o animal a partir de qualquer tipo e mantém o tipo (`:556-574`), sem `Entrada`; Cadastro importado depois de Manejos é aceito | adapter `:303`, `:550-595`, `:617`; tela bloqueia só no Lançamento (`:376-379`, `:853-857`) | regra no domínio compartilhado: para identidade nova, o primeiro evento cronológico precisa ser (ou virar) Cadastro; recusar Cadastro com data posterior a eventos existentes; resolver o beco sem saída dos animais importados sem Cadastro (§8) |
| **Nunca dois Cadastros** | garantido só por `animal_id`; por número+marca só na tela; Cadastro excluído deixa `animais`/VISUAL ativos | adapter `:172-174`, `:303`, `:580-582`, `:765`; Lançamento `:883-887`; `health.js` sem regra | unicidade por identidade canônica (VISUAL `[marca_id+valor_normalizado]` ativo) validada **no domínio**, dentro da transação; política para número reaproveitado após Saída; exclusão de Cadastro deve inativar identificador/animal |

Relacionadas com a missão (importação inteligente e Lançamento):
- **Mesmas funções canônicas:** a importação já usa `recalculateWeightSeries` → `calculateWeightGain`, mas pelo recálculo total. Para reconstruir só os animais afetados, `recalculateWeightSeriesForKeys` precisa virar API pública (ou equivalente) e a semântica de "tem peso" precisa ser única (`weightOf` × `Number.isFinite(Number(peso))`, §5.3).
- **Cronologia dentro do dia:** sem hora nem sequência, a importação ordena por UUID (§4.2). Reconstruir a série de um arquivo exige uma chave de ordem explícita (linha do arquivo, `id_externo` ou sequência).
- **Retroativos na importação** quebram `animalLotes` (§13.2) e não geram movimentos corretos (§13.3).
- **Idempotência:** só por hash do arquivo (§6). Nada por linha nem por `id_externo`.
- **Saídas em fluxo próprio:** a importação CSV força um único tipo por arquivo (`PesagensIndividuais.jsx:553-560`) e peso > 0 em toda linha (`:422-425`), então não importa Saída sem peso.
- **Contexto do Lançamento após salvar:** hoje o salvamento limpa `editingId`, `animalIdSelecionado`, `peso`, número (exceto na sequência de brincos), observação e aviso, e grava a configuração do tipo (`Lançamento:1074-1083`). Marca, raça, apartação, lote e dados de saída ficam no estado por tipo (`:398-406`).

---

## 17. Divergências entre documentos antigos e o código

| Documento | Afirma | Código atual |
|---|---|---|
| `docs/evidence/auditoria-master-produto-pecuario/WEIGHING-DOMAIN-MODEL.md:12` | "Cronologia (um Cadastro; nada antes dele; nada após Saída) — MADURA" | um Cadastro só por `animal_id`; "nada antes do Cadastro" falha na importação e quando o Cadastro chega depois (§7, §8) |
| mesmo, `:14` | "Projeções (`animais`, `animalLotes`) e movimentos em transação — MADURA" | movimentos não acompanham edição/exclusão; importação não reconstrói lotes (§13) |
| mesmo, `:16` | auditoria com `antes/depois` completos | edição coletiva já grava `resumo` + `campos_alterados` (adapter `:734-744`); criar/editar individual continuam completos |
| `docs/arquitetura-produto/F0-02-CATALOGO-DE-FORMULAS.md:21` (D3) | "o recálculo lê a base inteira" | criar/editar/excluir unitário já é por animal (service `:148-173`); **continua total** em importação, edição coletiva e exclusão pela tela (§11) |
| mesmo, `:19` (D1) e `:20` (D2) | `gmd = 0` com `dias = 0`; Saída sem ganho | continuam iguais (`weighingCalculations.js:32`; `weighingSeries.js:26-28`) |
| mesmo, `:101` e `WEIGHING-DOMAIN-MODEL.md:17`, `:55` (D6) | duplicidade no mesmo dia só na UI; alvo `substitui_pesagem_id` | continua só na UI; nada de repesagem implementado (§6) |
| `WEIGHING-DOMAIN-MODEL.md:35`, `:40` | alvo com `tipo_evento` em enum maiúsculo e peso de Cadastro opcional | não implementado: tipo continua `'Cadastro' \| 'Manejo' \| 'Saída'` em `legacy_payload`; Cadastro exige peso (`weighingMapper.js:70`) |
| `WEIGHING-DOMAIN-MODEL.md:59` | política de avisos em `appSettings['politica-avisos:<empresa>']` | implementada como `weight-warning-policy:<empresa>` (`appConfigService.js:54`) |
| `docs/evidence/auditoria-master-produto-pecuario/ANIMAL-LIFECYCLE-TARGET.md:62-64` | invariantes "Cadastro precede tudo; um Cadastro por animal; nada após a saída" | só parcialmente garantidos (§7, §8) |
| `AUDITORIA-MASTER-COMPLETA.md:308` (C-05) | sessão fechada não bloqueia e `createEntry` cria outra sessão | **ainda verdadeiro** (adapter `:318-329`) |
| Memória `pesagens-categoria-por-peso` (16/09) | "Manejo reclassifica" | igual ao código, **oposto à regra da missão atual** (§10.3) |
| Comentário `Lançamento:1003-1004` | adapter recusa marca/raça não cadastradas (`MARCA_NAO_CADASTRADA`) | o adapter **cria** a marca/raça (§9.5); os códigos não existem |
| `src/pages/Configuracoes.jsx:34` | propriedade padrão usada ao cadastrar animal no Lançamento | o adapter ignora `propriedade_padrao_id` (`:341`) |

---

## 18. Problemas encontrados (inventário)

1. Manejo reclassifica categoria (diverge da missão) — §10.3.
2. Importação cria animal a partir de Manejo/Saída sem Cadastro; `createEntry` aceita evento sem `animal_id` — §8.
3. Unicidade de Cadastro só por `animal_id`; exclusão de Cadastro deixa animal e identificador ativos — §7.
4. Beco sem saída: animal importado sem Cadastro some do Lançamento e não pode ser cadastrado — §8.
5. Importação resolve identidade com "último vence", sem ambiguidade nem filtro de situação — §9.2.
6. Normalizações diferentes da chave número+marca; marca por texto em vez de `marca_id` na importação — §9.3.
7. Troca de número no Cadastro não atualiza `animalIdentificadores` — §9.4.
8. Ordem dentro do dia na importação por UUID; Manejo+Saída no mesmo dia falha ou passa ao acaso — §4.2.
9. Série usa a **primeira** pesagem do dia como referência e a projeção usa a **última** — §4.2.
10. Coerção `Number(null) = 0` põe Saída sem peso no histórico com peso 0 — §5.3.
11. Derivados gravados em dobro (payload e nível superior) pelo recálculo — §5.4.
12. Recálculo total regrava todas as linhas sem diff, sem auditoria, e é disparado por importação, edição coletiva e exclusão pela tela — §11.1.
13. Validação cronológica fora da transação em `createEntry`/`updateEntry` — §4.3, §12.
14. Recálculo da série em transação separada da gravação; importação marcada `CONCLUIDA` antes do recálculo — §12.
15. Importação retroativa corrompe `animalLotes` — §13.2.
16. `movimentosAnimais` não acompanha edição/exclusão; `lote_origem_id` errado em retroativo — §13.3.
17. `rebuildAnimalLotProjection` recria ids e acumula linhas excluídas a cada edição — §11.3.
18. Edição de data não reatribui `sessao_id`; sessão fechada não bloqueia — §12, §13.4.
19. Criação silenciosa de marca/raça no adapter sem permissão nem auditoria; comentário do Lançamento afirma o contrário — §9.5.
20. Padrão de marca/propriedade: configuração × flag `padrao` — §9.5, §15.
21. `validateUiPayload` não valida `tipo_manejo`/`motivo_saida` — §3.3, §5.2.
22. Evento na mesma data da Saída não pode ser editado — §4.3.
23. Cadastro com data posterior aos Manejos (criação ou edição) não é recusado — §4.3.
24. `bulkUpdateEntries` não carimba categoria nem atualiza perfil do animal, ao contrário de `updateEntry` — §10.2.
25. `categoriasAnimal` lida sem filtro de empresa — §10.1.
26. SN em Manejo/Saída gera `animal_id` órfão — §8.
27. `calculateWeightGain` recebe a data crua do payload no `createEntry` (service `:66`); data em `DD/MM/AAAA` quebraria a comparação (hoje a tela e a importação mandam ISO).
28. `listEntries` engole erro e devolve `[]`, e o recálculo total vira no-op silencioso (service `:243-245`).

---

## 19. Pontos de contato para o desenho (sem implementação)

- **Núcleo puro reaproveitável como está:** `calculateWeightGain`, `recalculateWeightSeries` (com correção da semântica de peso), `suggestCategory`/`eraOfCategory`, `filterLegacyPayload`/allowlist, `parseCivilDate`/`parseBrazilianNumber`, `situacaoFromExitReason`, `calculateCarcassTrade`.
- **Regras que hoje só existem na tela e precisam descer para o domínio** (para valerem na importação): duplicidade no mesmo dia (`Lançamento:868-875`), "já cadastrado" por identidade (`:883-887`), "animal não cadastrado" para Manejo/Saída (`:376-379`), animal inativo (`:878-882`), rendimento obrigatório em Venda/Abate (`:894-901`), documento obrigatório (`:826-833`), avisos de conferência (`:888-893`).
- **Regras privadas do adapter que precisam de API compartilhada:** `validateAnimalChronology` (hoje duplicada na importação `:529-595`), `stampAutomaticCategory`, `rebuildAnimalStateProjection`, `rebuildAnimalLotProjection`, `recalculateWeightSeriesForKeys` (service).
- **Sanidade (item 1 da missão):** `sanidade_ids`/`sanidades` estão **proibidas** no `legacy_payload` (`weighingMapper.js:24`) e são apagadas no view model (`:124-125`); as stores antigas `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal` foram removidas na v6 (`schema.js:33-44`) e exportadas antes da limpeza no backfill B11 (`v7Backfill.js:659-711`). Stores novas exigem nova versão do Dexie e **não** podem voltar pelo payload da pesagem sem mudar a allowlist e o gate `payload:allowlist:verify`.
- **Exportação:** a allowlist (`weighingMapper.js:6-19`) + colunas (`:92-101`) é hoje o contrato de fato do evento; qualquer "CSV para reimportação" precisa trazer uma chave de ordem dentro do dia e a identidade (`animal_id` e/ou número+`marca_id`), que o CSV atual não traz de forma utilizável (a coluna `id` é ignorada na leitura, `PesagensIndividuais.jsx:370`).
