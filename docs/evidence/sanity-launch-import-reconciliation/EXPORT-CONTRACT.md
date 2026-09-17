# EXPORT-CONTRACT — Contrato de colunas e exportação de pesagens

**Reconciliação sanidade · lançamento · importação — fatia D · 17/09/2026 · branch `program/sanity-launch-import` (base `69b996a`) · app 1.2.0**

Documento de evidência da fatia D. A fonte da verdade é o código; "ANTES" cita a base `69b996a` (mesmas linhas do
inventário `docs/evidence/operational-reconciliation-preflight/CURRENT-IMPORT-EXPORT-CONTRACT.md` §5, quando não houve
deslocamento) e "DEPOIS" cita a árvore de trabalho desta fatia.

---

## 1. Resumo

1. Existe agora **um único contrato de colunas** para pesagens: `src/modules/weighing/export/weighingExportContract.js`.
   Cada coluna declara id, rótulo, cabeçalho técnico, perfis, tipo, sensibilidade e um `accessor` que lê o view model de
   pesagem (`weighingMapper.storageRecordToViewModel`) ou a linha da Relação (`eventRows.enrichEventRows`).
2. **Dois perfis que não se misturam**:
   - `FRIENDLY` — relatório amigável para planilha: rótulos em português, `dd/mm/aaaa`, vírgula decimal, sem milhar,
     ausente = célula vazia;
   - `REIMPORT` — técnico para reimportação: 19 cabeçalhos fixos em snake_case, `AAAA-MM-DD`, ponto decimal e **sem
     derivados** (a importação sempre recalcula data/peso anterior, dias, ganho e GMD com as funções canônicas).
3. O CSV é o **canônico do reporting** (`csvExporter.js`: `CSV_BOM`, `;`, CRLF, `csvCell` com escape e proteção contra
   fórmula). A formatação amigável é `formatCell(..., 'csv')` (`reportFormatting.js:62-97`). Nenhuma tela monta CSV à mão.
4. A permissão é verificada **no serviço** (`weighingExportService.js`): `reports.export` obrigatória; colunas comerciais
   só com `commercial.values` do papel — o pedido da tela só restringe, nunca amplia. Mesmo padrão de falha fechada de
   `requireWeighingPermission` (`weighingService.js:16-24`).
5. Relação, Fechamento e Lançamento (este último trocado pela fatia do Lançamento) usam o contrato. Ficha (fatia F) e
   CSV da Manutenção (fatia A) estão registrados como pendências de integração (§5).

## 2. API

| Export | Arquivo:linha | Contrato |
|---|---|---|
| `EXPORT_PROFILES` | `weighingExportContract.js:21` | `{ FRIENDLY, REIMPORT }` |
| `REIMPORT_HEADERS` | `:24` | os 19 cabeçalhos técnicos, nesta ordem |
| `DERIVED_COLUMN_IDS` | `:30` | `data_anterior, peso_anterior, dias, ganho, gmd` (nunca no REIMPORT) |
| `WEIGHING_EXPORT_COLUMNS` | `:107` | 45 colunas: 27 do domínio (`:59`) + demais colunas da Relação e valores comerciais do evento, reaproveitando `EVENT_COLUMNS` (`:95`) |
| `FRIENDLY_REQUIRED_COLUMN_IDS` | `:113` | `tipo_manejo`, `motivo_saida` — sempre no amigável |
| `FRIENDLY_DEFAULT_COLUMN_IDS` / `COMMERCIAL_EXPORT_COLUMN_IDS` | `:114` / `:115` | padrão amigável (sem valores) / colunas sensíveis |
| `columnsForProfile(profile, { columns, canSeeCommercial })` | `:128` | REIMPORT: sempre os 19. FRIENDLY: ids na ordem pedida (desconhecidos como `selecao`/`acoes` e repetidos são ignorados) ou o padrão; Tipo e Motivo inseridos logo após a Data se faltarem; comerciais só com `canSeeCommercial` |
| `buildWeighingCsv(rows, { profile, columns, canSeeCommercial, fileBase, now })` | `:213` | `{ content, headers, columnIds, fileName, rowCount, profile }`; linhas nulas ignoradas; função pura |
| `buildWeighingTechnicalCsv(rows, { lookups, fileBase, now })` | `:244` | REIMPORT para a Manutenção: aceita registros Dexie crus (com `legacy_payload`) ou view models; ignora `deleted_at`; deduplica por id (`dedupeById`, maior `localId`); ordena por `compareWeighingEvents`; `lookups` `{ marcas, racas, categorias }` (Map id→nome ou lista) completa nomes |
| `resolveExportAccess()` / `exportWeighingCsv(rows, options)` | `weighingExportService.js:15` / `:26` | permissão no serviço + `buildWeighingCsv` |
| `downloadCsvFile({ content, fileName })` | `csvDownload.js:6` | Blob `text/csv;charset=utf-8` + download no renderer |

Reaproveitado sem alterar o módulo pausado de relatórios: `EVENT_COLUMNS`/`RELATION_COLUMN_IDS` (`eventColumns.js`),
`formatCell` (`reportFormatting.js`), `CSV_BOM`/`CSV_SEPARATOR`/`CSV_NEWLINE`/`csvCell` (`csvExporter.js`),
`normalizeText` (`filterEngine.js`), `dedupeById`/`storageRowToEventViewModel` (`eventRows.js`). Do domínio de pesagens:
`measuredWeightOf` e `compareWeighingEvents` (`weighingSeries.js`), `parseCivilDate`/`parseBrazilianNumber`
(`brazilianValues.js`). Nenhum cálculo de ganho/GMD novo: o amigável só formata o que está gravado.

## 3. Cabeçalhos exatos

### 3.1 REIMPORT (técnico)

```
id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao
```

| Cabeçalho | Coluna do contrato | Valor |
|---|---|---|
| `id` | `id` | id da pesagem (idempotência por linha na importação) |
| `animal_id` | `animal_id` | `animal_id` do evento; legado sem id → `animal_id_resolvido` (número+marca único) |
| `id_externo` | `id_externo` | texto |
| `data` | `data_pesagem` | `AAAA-MM-DD` |
| `tipo` | `tipo_manejo` | `Cadastro` \| `Manejo` \| `Saída` |
| `motivo_saida` | `motivo_saida` | `Venda`, `Abate`, `Morte`, `Doação`, `Transferência`, `Outros` ou vazio |
| `causa_morte` | `causa_morte` | texto (o `causa_morte_id` não faz parte do contrato) |
| `numero` | `numero_animal` | identificação (brinco/`SN`) |
| `marca` / `marca_id` | `marca` / `marca_id` | texto do evento (ou nome do cadastro) / id do evento (ou id resolvido pelo nome) |
| `sexo` | `sexo` | `M` \| `F` (legado `Macho`/`Fêmea` normalizado) |
| `raca` / `raca_id` | `raca` / `raca_id` | como marca |
| `categoria` / `categoria_id` | `categoria` / `categoria_id` | categoria **gravada no evento** e seu nome |
| `peso` | `peso` | `measuredWeightOf`: número com ponto (`300.5`); null/vazio/0 → vazio |
| `apartacao` / `lote` | `nome_apartacao` / `nome_lote` | texto do evento |
| `observacao` | `observacao` | texto (escape CSV) |

### 3.2 FRIENDLY (relatório amigável)

Padrão (sem `columns`):

```
Data;Tipo;Motivo da saída;Causa da morte;Identificação;Marca;Sexo;Raça;Categoria;Era;Peso;Data anterior;Peso anterior;Dias;Ganho;GMD;Apartação;Lote;Sessão;Observação
```

Com `canSeeCommercial` o padrão acrescenta: `Valor compra;Valor venda;Preço/@ carcaça;'@ carcaça estimada;Rendimento;Carcaça estimada;Preço/@ abate;Valor abate`
(o cabeçalho também passa por `csvCell`, então o rótulo que começa com `@` sai com apóstrofo, igual ao CSV dos relatórios;
`headers` devolve o rótulo sem apóstrofo).

Relação com as colunas visíveis de fábrica (`selecao` e `acoes` são ignoradas):

```
Data;Tipo;Motivo da saída;Identificação;Marca;Sexo;Raça;Era;Peso;Lote;Apartação;GMD
```

Rótulos das colunas do domínio: `ID`, `Animal ID`, `ID externo`, `Nº` (número do registro no Lançamento), `Data`, `Tipo`,
`Motivo da saída`, `Causa da morte`, `Identificação`, `Marca`, `Marca ID`, `Sexo`, `Raça`, `Raça ID`, `Categoria`,
`Categoria ID`, `Era`, `Peso`, `Data anterior`, `Peso anterior`, `Dias`, `Ganho`, `GMD`, `Apartação`, `Lote`, `Sessão`,
`Observação`. As demais colunas da Relação mantêm o rótulo canônico (`Origem`, `Comprador`, `Destino`, `Frigorífico`,
`Embarque`, `Doc`, `Nº doc`, `Motorista`, `Placa`, `Qtd doc (dia)`, valores comerciais). O número do animal sai como
**Identificação** (na tela da Relação a coluna se chama "Animal") para não se confundir com **Animal ID**.

## 4. Regras de formato

| Regra | FRIENDLY | REIMPORT |
|---|---|---|
| Codificação / BOM | UTF-8 com BOM (um único) | idem |
| Separador / quebra | `;` / CRLF, arquivo termina com CRLF | idem |
| Escape | aspas quando há `;`, `"`, CR, LF ou espaço nas bordas; aspas dobradas (`csvCell`) | idem |
| Fórmula | texto iniciado por `=`, `+`, `@` ou `-` não numérico ganha `'` (`protectFormula`); `-3,50` não | idem (`'=1+1`); a importação deve remover o apóstrofo |
| Data | `dd/mm/aaaa` | `AAAA-MM-DD` (`parseCivilDate`) |
| Número | vírgula, sem milhar, casas fixas do tipo: peso/ganho/dinheiro 2, GMD 3, inteiro 0 (`1234,50`, `1,358`) | ponto, sem milhar, sem casas fixas nem ruído binário (`1234.5`, `320.4`) |
| Peso ausente (null, vazio, 0) | vazio | vazio |
| Outro ausente (null/undefined/texto em branco) | vazio — nunca `0`, `0,00`, `--/--/----`, `—`, `null`, `undefined` | vazio |
| Zero real (dias 0, GMD 0) | `0` / `0,000` | n/a |
| Enum | rótulo (`Macho`, `Fêmea`) | código (`M`, `F`) |
| Objeto/lista no dado | nome/label ou itens unidos por `, `; objeto sem nome → vazio (nunca `[object Object]`) | idem |
| Derivados | exportados como gravados | **ausentes** |
| Valores comerciais | só com permissão | **nunca** |
| Nome do arquivo | `<base>-AAAAMMDD-HHMMSS.csv` (hora local) | `<base>-reimportacao-AAAAMMDD-HHMMSS.csv` |

## 5. Inventário ANTES × DEPOIS

| ID | Exportação | ANTES (`69b996a`) | DEPOIS |
|---|---|---|---|
| EXP-1 | Relação › Mais opções | Um item "Exportar CSV" (`PesagensIndividuais.jsx:882`) → `exportarCSV` (`:720-750`): cabeçalhos fixos `ID;ID_Externo;Data;NumeroAnimal;Sexo;Raça;Era;Marca;Peso;Lote;Apartação;Observação;DataAnterior;PesoAnterior;Dias;Ganho;GMD`, LF, **sem escape**, milhar (`1.234`), `--/--/----` para data anterior ausente, sem Tipo/Motivo, ignorava colunas visíveis; `pesagens_individuais_yyyyMMdd.csv`; permissão só na UI | Dois itens (`PesagensIndividuais.jsx:871-872`), ambos dentro de `podeExportar` (`reports.export`): **"Exportar relatório (CSV)"** (FRIENDLY, colunas visíveis na ordem da tela, Tipo/Motivo sempre, comerciais com `commercial.values`) e **"Exportar para reimportação (CSV)"** (REIMPORT). `exportarCSV(profile)` (`:726`) chama `exportWeighingCsv(pesagensFiltradas, …)` — mesma população pesquisada/filtrada/ordenada da tela, todas as páginas — e `downloadCsvFile`. Permissão repetida no serviço |
| EXP-2 | Relação › Baixar modelo CSV | `baixarModelo` (`:703-718`) | **Sem mudança nesta fatia** (`:705`): pertence à importação antiga, que será substituída pelo assistente (fatia B). O modelo técnico passa a ser o próprio CSV de reimportação |
| EXP-3 | Lançamento › rodapé "Exportar" | `exportarExcel` (`LancamentoPesagensIndividuais.jsx:1178-1272`): rótulos visíveis, LF, só `;`→`,`, `fmtNum` com milhar, `--/--/----`, `R$` | Feito pela fatia do Lançamento sobre este contrato: `exportarExcel` (`LancamentoPesagensIndividuais.jsx:1356`) chama `exportWeighingCsv(linhas, { profile: 'FRIENDLY', columns: colunas visíveis, canSeeCommercial: podeVerValores, fileBase: \`pesagens-${data}\` })` (`:1362`) com `doc_qtd` do dia na linha; o contrato cobre `numero_registro` (`Nº`) e todas as colunas da grade. Resíduo: `quantidade_arrobas` sai como gravada (a Relação anula sem rendimento válido, `eventRows.js:93-101`) |
| EXP-4 | Fechamento do Dia › Exportar CSV | `exportCsv` (`FechamentoDia.jsx:126-131`): `Data;Animal;Marca;Tipo;Peso;GMD;Apartação;Lote;Observação`, data **ISO**, peso ausente **`0,00`**, milhar, LF, todas as células entre aspas, sem checar `reports.export` | `exportCsv` (`FechamentoDia.jsx:135`) → `exportWeighingCsv` com `FECHAMENTO_CSV_COLUMNS` (`:38`): `Data;Identificação;Marca;Tipo;Motivo da saída;Peso;GMD;Apartação;Lote;Observação`, `dd/mm/aaaa`, peso ausente vazio, CRLF, escape canônico, linhas na cronologia canônica; botão só com `reports.export` (`:44`, `:199`) e checagem no serviço; `fechamento-<data>-AAAAMMDD-HHMMSS.csv` |
| EXP-5 | Fechamento › Backup do dia (JSON) | `backupDay` (`:133-136`) | **Sem mudança** (`:146`). Dívida: sem hash, leva valores comerciais sem checar `commercial.values` e o aviso diz "validado" |
| EXP-6 | Ficha do Animal › Exportar histórico | `exportHistory` (`FichaAnimal.jsx:141-146`): aspas sempre, LF, `dias` cru, sem proteção contra fórmula, nome sem saneamento | **Fatia F** (arquivo fora desta fatia): trocar por `exportWeighingCsv(historyRows, { columns: ['data_pesagem','tipo_manejo','motivo_saida','peso','dias','ganho','gmd','nome_lote','nome_apartacao','observacao'], fileBase: \`ficha-${número}-${marca}\` })` (o contrato saneia o nome) |
| EXP-7 | Manutenção › Exportar pesagens em CSV | `exportPesagensCsv` (`backupService.js:97-104`): separador **`,`**, LF, colunas cruas `id,data_pesagem,peso_kg,animal_id,lote_id,tipo_pesagem,operador,origem,observacao,created_at,updated_at` (operador/origem sempre vazios), sem número/marca/tipo | **Fatia A** (dona de `backupService.js`): trocar por `buildWeighingTechnicalCsv(rows, { lookups: { marcas, racas, categorias } })` — mesmo contrato REIMPORT da Relação, reimportável pelo assistente. Pronto e coberto por gate; a troca e o ajuste de `verify-dexie-backup.mjs:60-62` (cabeçalho `data_pesagem` e escape com vírgula) ficam com a fatia A |
| EXP-8 | Manutenção › Exportar pesagens em JSON | `exportPesagensJson` (`:107-121`) | Sem mudança |
| EXP-9/10 | Backups completo e pré-migração | `createFullBackup`, `createPreMigrationBackup` | Sem mudança (fatia A cuida das stores v8) |
| EXP-11 | Sanidade legada (B11) | `v7Backfill.js:667-682` | Sem mudança nesta fatia |
| EXP-12 | Copiar diagnóstico | `ManutencaoSistema.jsx:321-358` | n/a |
| EXP-13 | Relatórios (pausados) | `reportExportService`, `csvExporter`, `xlsxExporter`… | **Sem alteração**; só reaproveitamento de funções utilitárias |

## 6. Compatibilidade com a reimportação (fatia B)

- `src/modules/import/domain/importFields.js` declara `TECHNICAL_IMPORT_HEADERS` idênticos a `REIMPORT_HEADERS` e
  `suggestMapping` casa cada cabeçalho técnico com o campo de mesmo id (mapeamento 1:1 sem intervenção);
  `isTechnicalLayout` reconhece o arquivo (datas ISO, ponto decimal).
- O perfil técnico usa **ponto decimal sem milhar**: o parser da importação não pode aplicar a heurística de
  `parseBrazilianNumber` em layout técnico (`1.625` seria lido como 1625). Os valores exportados têm no máximo 6 casas.
- Proteção contra fórmula: texto começando com `=`, `+`, `@` ou `-` não numérico chega com `'` na frente; a importação
  deve remover esse apóstrofo antes de comparar/gravar (pedido registrado para a fatia B; em 17/09 o layout técnico já
  usa ponto decimal em `importRules.js:29`, mas a remoção do apóstrofo ainda não aparece em `src/modules/import`).
- Ida e volta esperada na mesma base: todas as linhas `JÁ EXISTE` (idempotência por `id`), zero gravações. `Cadastro` e
  `Manejo` vão para o tipo `HISTORICO`; `Saída` para `SAIDAS` (o gate separa os dois arquivos).
- Não fazem parte do contrato técnico (decisão desta fatia): `era` (vem da categoria), sessão (a importação resolve pela
  data), `causa_morte_id`, valores comerciais, embarque/documento, derivados.
- O amigável **não** é para reimportar: não leva `id`, usa `dd/mm/aaaa` e vírgula. O assistente pode mapear seus
  cabeçalhos por alias, mas sem idempotência por linha.
- Observação de domínio encontrada: o Manejo de animal com categoria **manual** não grava `categoria_id` no evento
  (`stampAutomaticCategory` só carimba automáticos, `weighingDataAdapter.js:197-207`); o CSV técnico sai com `categoria`
  vazia nessa linha — é o dado gravado, não perda da exportação.

## 7. Gates

| Script (`npm run …`) | Arquivo | Cobre | Situação em 17/09 |
|---|---|---|---|
| `export:weighing-contract:verify` | `scripts/verify-export-weighing-contract.mjs` | definições; BOM, `;`, CRLF; escape de `;`, aspas, LF e CRLF; fórmula (`=`, `+`, `@`, `-`) e negativo numérico; ausente vazio (nunca `0`, `0,00`, `--/--/----`, `—`, `[object Object]`); zero real; cabeçalhos FRIENDLY e REIMPORT exatos; Tipo/Motivo sempre; colunas da tela, ids ignorados e ordem; valores comerciais só com permissão no contrato e no serviço (CONSULTA, GESTOR, OPERADOR negado, sessão ausente negada); CSV técnico de registros crus (apagado, duplicado, cronologia, ruído binário, nomes por lookup); inspeção de fonte da Relação, Fechamento e Lançamento | Verde (`ok: true`, 45 colunas, 20 cabeçalhos amigáveis padrão, 19 técnicos, 8 comerciais) |
| `export:reimport-contract:verify` | `scripts/verify-export-reimport-contract.mjs` | cabeçalhos técnicos exatos; massa real pelo `weighingService` (Cadastro, Manejos com retroativo, Venda, Morte sem peso, categoria automática e manual); Relação × Manutenção iguais por linha; ISO/ponto/vazio; valores iguais aos gravados; sem derivados; ida e volta por `analyzeImport` = 100% `JÁ EXISTE` e contagem de todas as stores inalterada | Tudo verde até a ida e volta; falha como **PENDENTE** enquanto `src/modules/import/application/importService.js` (fatia B) não existe |

Gates antigos que leem os arquivos desta fatia, executados em 17/09: `auth:weighing-access:verify`,
`ui:operational-customization:verify`, `reports:relation-parity:verify`, `import:selection:verify`,
`animal:history-integrity:verify`, `ui:locale-dialog:verify`, `reports:catalog:verify` — verdes.
`ui:consistency:verify` (`scripts/verify-ui-consistency.mjs:79`) procura o rótulo antigo "Exportar CSV" no menu da
Relação; a regra de produto mudou (dois perfis) e o ajuste do regex foi pedido a quem é dono do gate.
